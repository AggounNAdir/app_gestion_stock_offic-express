import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { hashPassword, verifyPassword } from '../security.ts';
import { peut, peutVoirPage, ROLES } from '../rbac.ts';
import {
  ajouterAudit,
  enregistrerMouvementStock,
  prochainNumero,
  resoudrePrix,
  verifierPlafondCredit,
} from '../pricing.ts';
import type {
  BackupSnapshot,
  BonVente,
  DechargementCamion,
  Devis,
  LigneDevis,
  LigneRetour,
  LigneVente,
  RetourAchat,
  RetourVendeur,
  RetourVente,
  StatutDevis,
  Utilisateur,
} from '../store.ts';
import { store } from '../store.ts';
import { forceSyncPostgres, isPostgresActive } from '../db/postgres.ts';

export const bureauExtrasRouter = express.Router();

interface AdminReq extends Request {
  adminUser?: Utilisateur;
}

function checkPage(pageKey: string) {
  return (req: AdminReq, res: Response, next: express.NextFunction) => {
    if (!peutVoirPage(req.adminUser?.role, pageKey)) {
      res
        .status(403)
        .json({ detail: 'Accès refusé à cette section pour votre rôle.' });
      return;
    }
    next();
  };
}

function forbidReadOnly(req: AdminReq, res: Response): boolean {
  if (req.adminUser?.role === 'lecture_seule') {
    res.status(403).json({ detail: 'Action non autorisée en lecture seule.' });
    return true;
  }
  return false;
}

// ── Produits : Référentiels marques/unités & suppression définitive ──
bureauExtrasRouter.get('/produits/referentiels', checkPage('produits'), (_req, res) => {
  const marques = Array.from(
    new Set([
      ...store.marques_custom,
      ...store.produits.map((p) => (p.marque || '').trim()).filter(Boolean),
    ])
  ).sort();
  const unites = Array.from(
    new Set([
      'Pcs',
      'carton',
      'kg',
      'g',
      'L',
      'mL',
      'boîte',
      'fardeau',
      'pack',
      'sac',
      'palette',
      ...store.unites_custom,
      ...store.produits.map((p) => (p.unite || '').trim()).filter(Boolean),
    ])
  );
  res.json({ marques, unites });
});

bureauExtrasRouter.post('/produits/marques', checkPage('produits'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const nom = String(req.body?.nom || '').trim();
  if (!nom) {
    res.status(400).json({ detail: 'Nom de marque requis.' });
    return;
  }
  if (!store.marques_custom.includes(nom)) {
    store.marques_custom.push(nom);
  }
  res.status(201).json({ nom });
});

bureauExtrasRouter.post('/produits/unites', checkPage('produits'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const nom = String(req.body?.nom || '').trim();
  if (!nom) {
    res.status(400).json({ detail: "Nom d'unité requis." });
    return;
  }
  if (!store.unites_custom.includes(nom)) {
    store.unites_custom.push(nom);
  }
  res.status(201).json({ nom });
});

bureauExtrasRouter.delete(
  '/produits/:id/definitif',
  checkPage('produits'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'supprimer_definitivement')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const idx = store.produits.findIndex((p) => p.id === Number(req.params.id));
    if (idx === -1) {
      res.status(404).json({ detail: 'Produit introuvable.' });
      return;
    }
    const p = store.produits[idx];
    p.supprime = 1;
    p.actif = 0;
    ajouterAudit({
      action: 'SUPPRESSION_DEFINITIVE_PRODUIT',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'produit',
      cible_id: p.id,
      details: `${p.code} - ${p.designation}`,
    });
    res.json({ ok: true });
  }
);

// ── Tiers : Suppression & Solde Initial / Dette ──
bureauExtrasRouter.delete('/clients/:id', checkPage('clients'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const id = Number(req.params.id);
  const idx = store.clients.findIndex((c) => c.id === id);
  if (idx === -1) {
    res.status(404).json({ detail: 'Client introuvable.' });
    return;
  }
  const c = store.clients[idx];
  if (c.code === 'CLT-COMPTOIR') {
    res.status(400).json({ detail: 'Impossible de supprimer le client COMPTOIR.' });
    return;
  }
  store.clients.splice(idx, 1);
  ajouterAudit({
    action: 'SUPPRESSION_CLIENT',
    utilisateur: req.adminUser!.nom_complet,
    cible_type: 'client',
    cible_id: id,
    details: `${c.code} - ${c.nom}`,
  });
  res.json({ ok: true });
});

bureauExtrasRouter.post(
  '/clients/:id/solde-initial',
  checkPage('clients'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const c = store.clients.find((x) => x.id === Number(req.params.id));
    if (!c) {
      res.status(404).json({ detail: 'Client introuvable.' });
      return;
    }
    const mode = String(req.body?.mode || 'solde_initial');
    const montant = Number(req.body?.montant || 0);
    if (montant <= 0) {
      res.status(400).json({ detail: 'Montant doit être > 0.' });
      return;
    }
    if (mode === 'remboursement') {
      const today = new Date().toISOString().slice(0, 10);
      const v = {
        id: store.nextId('versements_clients'),
        numero: prochainNumero(
          store.versements_clients.map((x) => x.numero),
          `VC-${today.replace(/-/g, '')}-`
        ),
        date_vers: today,
        client_id: c.id,
        montant,
        mode: String(req.body?.mode_reglement || 'Espèces'),
        reference: String(req.body?.motif || 'Remboursement dette'),
        observations: String(req.body?.motif || ''),
      };
      store.versements_clients.push(v);
      c.solde = Math.max(0, Number((c.solde - montant).toFixed(2)));
    } else {
      const prevSi = Number(c.solde_initial || 0);
      const delta = montant - prevSi;
      c.solde_initial = montant;
      c.solde = Number((c.solde + delta).toFixed(2));
    }
    ajouterAudit({
      action: 'GESTION_DETTE_CLIENT',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'client',
      cible_id: c.id,
      details: `${mode} = ${montant} DA (Solde: ${c.solde} DA)`,
    });
    res.json(c);
  }
);

bureauExtrasRouter.delete(
  '/clients/:id/solde-initial',
  checkPage('clients'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const c = store.clients.find((x) => x.id === Number(req.params.id));
    if (!c) {
      res.status(404).json({ detail: 'Client introuvable.' });
      return;
    }
    const si = Number(c.solde_initial || 0);
    c.solde = Math.max(0, Number((c.solde - si).toFixed(2)));
    c.solde_initial = 0;
    res.json(c);
  }
);

bureauExtrasRouter.delete(
  '/fournisseurs/:id',
  checkPage('fournisseurs'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const id = Number(req.params.id);
    const idx = store.fournisseurs.findIndex((f) => f.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: 'Fournisseur introuvable.' });
      return;
    }
    const f = store.fournisseurs[idx];
    store.fournisseurs.splice(idx, 1);
    ajouterAudit({
      action: 'SUPPRESSION_FOURNISSEUR',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'fournisseur',
      cible_id: id,
      details: `${f.code} - ${f.nom}`,
    });
    res.json({ ok: true });
  }
);

bureauExtrasRouter.post(
  '/fournisseurs/:id/solde-initial',
  checkPage('fournisseurs'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const f = store.fournisseurs.find((x) => x.id === Number(req.params.id));
    if (!f) {
      res.status(404).json({ detail: 'Fournisseur introuvable.' });
      return;
    }
    const mode = String(req.body?.mode || 'solde_initial');
    const montant = Number(req.body?.montant || 0);
    if (montant <= 0) {
      res.status(400).json({ detail: 'Montant doit être > 0.' });
      return;
    }
    if (mode === 'remboursement') {
      const today = new Date().toISOString().slice(0, 10);
      store.versements_fournisseurs.push({
        id: store.nextId('versements_fournisseurs'),
        numero: prochainNumero(
          store.versements_fournisseurs.map((x) => x.numero),
          `VF-${today.replace(/-/g, '')}-`
        ),
        date_vers: today,
        fournisseur_id: f.id,
        montant,
        mode: String(req.body?.mode_reglement || 'Espèces'),
        reference: String(req.body?.motif || 'Règlement dette'),
        observations: String(req.body?.motif || ''),
      });
      f.solde = Math.max(0, Number((f.solde - montant).toFixed(2)));
    } else {
      const prevSi = Number(f.solde_initial || 0);
      const delta = montant - prevSi;
      f.solde_initial = montant;
      f.solde = Number((f.solde + delta).toFixed(2));
    }
    res.json(f);
  }
);

bureauExtrasRouter.delete(
  '/fournisseurs/:id/solde-initial',
  checkPage('fournisseurs'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const f = store.fournisseurs.find((x) => x.id === Number(req.params.id));
    if (!f) {
      res.status(404).json({ detail: 'Fournisseur introuvable.' });
      return;
    }
    const si = Number(f.solde_initial || 0);
    f.solde = Math.max(0, Number((f.solde - si).toFixed(2)));
    f.solde_initial = 0;
    res.json(f);
  }
);

// ── Bons de Vente : Modification & Suppression ──
bureauExtrasRouter.put('/bons-vente/:id', checkPage('bons_vente'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const bon = store.bons_vente.find((b) => b.id === Number(req.params.id));
  if (!bon) {
    res.status(404).json({ detail: 'Bon introuvable.' });
    return;
  }
  const b = req.body || {};
  const newClientId = Number(b.client_id || bon.client_id);
  const newClient = store.clients.find((c) => c.id === newClientId);
  if (!newClient) {
    res.status(404).json({ detail: 'Client introuvable.' });
    return;
  }
  const lignesIn = Array.isArray(b.lignes) ? b.lignes : [];
  if (lignesIn.length === 0) {
    res.status(400).json({ detail: 'Ajoutez au moins une ligne.' });
    return;
  }

  const dateBon = String(b.date_bon || bon.date_bon);
  let totalHT = 0;
  let totalTVA = 0;
  let brutTTC = 0;
  const preparedNew: {
    prod: (typeof store.produits)[number];
    qte: number;
    pu: number;
    lineRemise: number;
    niveau_prix: any;
    tot: number;
    ht: number;
    tvaTaux: number;
    tva: number;
  }[] = [];

  for (const l of lignesIn) {
    const prod = store.produits.find((p) => p.id === Number(l.produit_id));
    if (!prod) {
      res.status(404).json({ detail: `Produit #${l.produit_id} introuvable.` });
      return;
    }
    const qte = Number(l.quantite || 0);
    if (qte <= 0) continue;
    const pu =
      Number(l.prix_unitaire || 0) > 0
        ? Number(l.prix_unitaire)
        : resoudrePrix(prod.id, { clientId: newClientId, quantite: qte }).prix;
    const lineRemise = Math.max(0, Number(l.remise || 0));
    const tot = Math.max(0, Number((qte * pu - lineRemise).toFixed(2)));
    const tvaTaux = prod.tva || 0;
    const ht = Number((tot / (1 + tvaTaux / 100)).toFixed(2));
    const tva = Number((tot - ht).toFixed(2));
    totalHT += ht;
    totalTVA += tva;
    brutTTC += tot;
    preparedNew.push({
      prod,
      qte,
      pu,
      lineRemise,
      niveau_prix: l.niveau_prix,
      tot,
      ht,
      tvaTaux,
      tva,
    });
  }

  const remiseType = (b.remise_type || 'aucune') as 'aucune' | 'montant' | 'pourcentage';
  const remiseVal = Math.max(0, Number(b.remise_valeur || 0));
  const remiseMontant =
    remiseType === 'pourcentage'
      ? Number(((brutTTC * Math.min(100, remiseVal)) / 100).toFixed(2))
      : remiseType === 'montant'
      ? Math.min(brutTTC, remiseVal)
      : 0;
  const totalTTC = Math.max(0, Number((brutTTC - remiseMontant).toFixed(2)));
  const ratio = brutTTC > 0 ? totalTTC / brutTTC : 1;
  const montantVerse = Math.min(totalTTC, Math.max(0, Number(b.montant_verse ?? bon.montant_verse)));
  const reste = Number((totalTTC - montantVerse).toFixed(2));

  const soldeBaseOverride =
    bon.statut !== 'Annulé' && newClient.id === bon.client_id
      ? Math.max(0, Number((newClient.solde - bon.reste_payer).toFixed(2)))
      : newClient.solde;
  const creditCheck = verifierPlafondCredit(newClient, reste, {
    forcerAdmin: Boolean(b.forcer_plafond),
    role: req.adminUser?.role,
    soldeBaseOverride,
  });
  if (creditCheck.bloquant) {
    res.status(409).json({
      detail: creditCheck.avertissement,
      code: 'PLAFOND_CREDIT_DEPASSE',
      credit_info: creditCheck,
    });
    return;
  }

  // Reverser l'ancien impact si le bon n'était pas annulé
  if (bon.statut !== 'Annulé') {
    const oldClient = store.clients.find((c) => c.id === bon.client_id);
    if (oldClient && oldClient.code !== 'CLT-COMPTOIR') {
      oldClient.solde = Math.max(
        0,
        Number((oldClient.solde - bon.reste_payer).toFixed(2))
      );
    }
    for (const oldL of bon.lignes) {
      const prod = store.produits.find((p) => p.id === oldL.produit_id);
      if (prod) {
        const avant = prod.stock_actuel;
        prod.stock_actuel = Number((avant + oldL.quantite).toFixed(4));
        enregistrerMouvementStock({
          produit_id: prod.id,
          type_mouvement: 'MODIF_VENTE_ANNUL',
          stock_avant: avant,
          stock_apres: prod.stock_actuel,
          cout_unitaire: prod.prix_moyen_pondere || prod.prix_achat,
          document_type: 'bon_vente',
          document_id: bon.id,
          document_numero: bon.numero,
          tiers_nom: oldClient?.nom,
          utilisateur: req.adminUser!.nom_complet,
        });
      }
    }
  }

  const newLignes = preparedNew.map((item) => {
    const avant = item.prod.stock_actuel;
    item.prod.stock_actuel = Math.max(0, Number((avant - item.qte).toFixed(4)));
    enregistrerMouvementStock({
      produit_id: item.prod.id,
      type_mouvement: 'VENTE',
      stock_avant: avant,
      stock_apres: item.prod.stock_actuel,
      cout_unitaire: item.prod.prix_moyen_pondere || item.prod.prix_achat,
      document_type: 'bon_vente',
      document_id: bon.id,
      document_numero: bon.numero,
      tiers_nom: newClient.nom,
      date_document: dateBon,
      utilisateur: req.adminUser!.nom_complet,
    });

    return {
      id: store.nextId('lignes_vente'),
      bon_id: bon.id,
      produit_id: item.prod.id,
      designation: item.prod.designation,
      quantite: item.qte,
      prix_unitaire: item.pu,
      remise: item.lineRemise,
      niveau_prix: item.niveau_prix,
      total: item.tot,
      total_ht: item.ht,
      tva_taux: item.tvaTaux,
      total_tva: item.tva,
      total_ttc: item.tot,
    };
  });

  if (newClient.code !== 'CLT-COMPTOIR') {
    newClient.solde = Number((newClient.solde + reste).toFixed(2));
  }

  bon.client_id = newClientId;
  bon.date_bon = dateBon;
  bon.lignes = newLignes;
  bon.remise_type = remiseType;
  bon.remise_valeur = remiseVal;
  bon.remise_montant = remiseMontant;
  bon.remise_motif = b.remise_motif || null;
  bon.total = totalTTC;
  bon.total_ht = Number((totalHT * ratio).toFixed(2));
  bon.tva_total = Number((totalTVA * ratio).toFixed(2));
  bon.total_ttc = totalTTC;
  bon.montant_verse = montantVerse;
  if (b.mode_reglement !== undefined) {
    bon.mode_reglement = String(b.mode_reglement || 'Espèces');
  }
  if (b.montant_recu !== undefined && b.montant_recu !== null && b.montant_recu !== '') {
    const recu = Math.max(0, Number(b.montant_recu || 0));
    bon.montant_recu = Number(recu.toFixed(2));
    bon.rendu_monnaie = Math.max(0, Number((recu - totalTTC).toFixed(2)));
  } else {
    bon.montant_recu = montantVerse;
    bon.rendu_monnaie = 0;
  }
  bon.reste_payer = reste;
  if (b.date_echeance !== undefined) {
    bon.date_echeance = b.date_echeance ? String(b.date_echeance) : null;
  }
  bon.observations = b.observations ?? bon.observations;
  bon.statut = 'Validé';

  ajouterAudit({
    action: creditCheck.force_applique
      ? 'FORCAGE_PLAFOND_CREDIT'
      : 'MODIFICATION_BON_VENTE',
    utilisateur: req.adminUser!.nom_complet,
    cible_type: 'bon_vente',
    cible_id: bon.id,
    details: `${bon.numero} — Nouveau total: ${bon.total} DA${
      creditCheck.avertissement ? ` · ${creditCheck.avertissement}` : ''
    }`,
  });
  res.json({
    ...bon,
    credit_warning: creditCheck.avertissement,
    credit_info: creditCheck,
  });
});

bureauExtrasRouter.delete(
  '/bons-vente/:id',
  checkPage('bons_vente'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'annuler_bon')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const idx = store.bons_vente.findIndex((b) => b.id === Number(req.params.id));
    if (idx === -1) {
      res.status(404).json({ detail: 'Bon introuvable.' });
      return;
    }
    const bon = store.bons_vente[idx];
    if (bon.statut !== 'Annulé') {
      const client = store.clients.find((c) => c.id === bon.client_id);
      if (client && client.code !== 'CLT-COMPTOIR') {
        client.solde = Math.max(0, Number((client.solde - bon.reste_payer).toFixed(2)));
      }
      for (const l of bon.lignes) {
        const prod = store.produits.find((p) => p.id === l.produit_id);
        if (prod) {
          const avant = prod.stock_actuel;
          prod.stock_actuel = Number((avant + l.quantite).toFixed(4));
          enregistrerMouvementStock({
            produit_id: prod.id,
            type_mouvement: 'SUPPRESSION_VENTE',
            stock_avant: avant,
            stock_apres: prod.stock_actuel,
            cout_unitaire: prod.prix_moyen_pondere || prod.prix_achat,
            document_type: 'bon_vente',
            document_id: bon.id,
            document_numero: bon.numero,
            tiers_nom: client?.nom,
            utilisateur: req.adminUser!.nom_complet,
          });
        }
      }
    }
    store.bons_vente.splice(idx, 1);
    ajouterAudit({
      action: 'SUPPRESSION_BON_VENTE',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'bon_vente',
      cible_id: bon.id,
      details: bon.numero,
    });
    res.json({ ok: true });
  }
);

// ── Bons d'Achat : Modification, Annulation, Suppression ──
bureauExtrasRouter.put('/bons-achat/:id', checkPage('bons_achat'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const ba = store.bons_achat.find((x) => x.id === Number(req.params.id));
  if (!ba) {
    res.status(404).json({ detail: "Bon d'achat introuvable." });
    return;
  }
  const b = req.body || {};
  const fournId = Number(b.fournisseur_id || ba.fournisseur_id);
  const fourn = store.fournisseurs.find((f) => f.id === fournId);
  if (!fourn) {
    res.status(404).json({ detail: 'Fournisseur introuvable.' });
    return;
  }
  const lignesIn = Array.isArray(b.lignes) ? b.lignes : [];
  if (lignesIn.length === 0) {
    res.status(400).json({ detail: 'Ajoutez au moins une ligne.' });
    return;
  }

  if (ba.statut !== 'Annulé') {
    const oldF = store.fournisseurs.find((f) => f.id === ba.fournisseur_id);
    if (oldF) oldF.solde = Math.max(0, Number((oldF.solde - ba.total).toFixed(2)));
    for (const l of ba.lignes) {
      const prod = store.produits.find((p) => p.id === l.produit_id);
      if (prod) {
        const avant = prod.stock_actuel;
        prod.stock_actuel = Math.max(0, Number((avant - l.quantite).toFixed(4)));
        enregistrerMouvementStock({
          produit_id: prod.id,
          type_mouvement: 'MODIF_ACHAT_ANNUL',
          stock_avant: avant,
          stock_apres: prod.stock_actuel,
          cout_unitaire: l.prix_unitaire,
          document_type: 'bon_achat',
          document_id: ba.id,
          document_numero: ba.numero,
          utilisateur: req.adminUser!.nom_complet,
        });
      }
    }
  }

  const dateBon = String(b.date_bon || ba.date_bon);
  let total = 0;
  const newLignes = [];
  for (const l of lignesIn) {
    const prod = store.produits.find((p) => p.id === Number(l.produit_id));
    if (!prod) continue;
    const qte = Number(l.quantite || 0);
    const pu = Number(l.prix_unitaire ?? prod.prix_achat);
    if (qte <= 0) continue;
    const tot = Number((qte * pu).toFixed(2));
    total += tot;
    const avant = prod.stock_actuel;
    const newStock = Number((avant + qte).toFixed(4));
    prod.stock_actuel = newStock;
    prod.prix_achat = pu;
    enregistrerMouvementStock({
      produit_id: prod.id,
      type_mouvement: 'ACHAT',
      stock_avant: avant,
      stock_apres: newStock,
      cout_unitaire: pu,
      document_type: 'bon_achat',
      document_id: ba.id,
      document_numero: ba.numero,
      tiers_nom: fourn.nom,
      date_document: dateBon,
      utilisateur: req.adminUser!.nom_complet,
    });
    newLignes.push({
      id: store.nextId('lignes_achat'),
      bon_id: ba.id,
      produit_id: prod.id,
      designation: prod.designation,
      quantite: qte,
      prix_unitaire: pu,
      total: tot,
      tva_taux: prod.tva,
      total_ht: tot,
      total_ttc: Number((tot * (1 + prod.tva / 100)).toFixed(2)),
    });
  }
  fourn.solde = Number((fourn.solde + total).toFixed(2));
  ba.fournisseur_id = fournId;
  ba.date_bon = dateBon;
  ba.total = Number(total.toFixed(2));
  ba.observations = b.observations ?? ba.observations;
  ba.lignes = newLignes;
  ba.statut = 'Validé';
  res.json(ba);
});

bureauExtrasRouter.post(
  '/bons-achat/:id/annuler',
  checkPage('bons_achat'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'annuler_bon')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const ba = store.bons_achat.find((x) => x.id === Number(req.params.id));
    if (!ba) {
      res.status(404).json({ detail: "Bon d'achat introuvable." });
      return;
    }
    if (ba.statut === 'Annulé') {
      res.status(400).json({ detail: 'Déjà annulé.' });
      return;
    }
    ba.statut = 'Annulé';
    const fourn = store.fournisseurs.find((f) => f.id === ba.fournisseur_id);
    if (fourn) fourn.solde = Math.max(0, Number((fourn.solde - ba.total).toFixed(2)));
    for (const l of ba.lignes) {
      const prod = store.produits.find((p) => p.id === l.produit_id);
      if (prod) {
        const avant = prod.stock_actuel;
        prod.stock_actuel = Math.max(0, Number((avant - l.quantite).toFixed(4)));
        enregistrerMouvementStock({
          produit_id: prod.id,
          type_mouvement: 'ANNULATION_ACHAT',
          stock_avant: avant,
          stock_apres: prod.stock_actuel,
          cout_unitaire: l.prix_unitaire,
          document_type: 'bon_achat',
          document_id: ba.id,
          document_numero: ba.numero,
          utilisateur: req.adminUser!.nom_complet,
        });
      }
    }
    res.json(ba);
  }
);

bureauExtrasRouter.delete('/bons-achat/:id', checkPage('bons_achat'), (req: AdminReq, res) => {
  if (!peut(req.adminUser?.role, 'annuler_bon')) {
    res.status(403).json({ detail: 'Permission insuffisante.' });
    return;
  }
  const idx = store.bons_achat.findIndex((x) => x.id === Number(req.params.id));
  if (idx === -1) {
    res.status(404).json({ detail: "Bon d'achat introuvable." });
    return;
  }
  const ba = store.bons_achat[idx];
  if (ba.statut !== 'Annulé') {
    const fourn = store.fournisseurs.find((f) => f.id === ba.fournisseur_id);
    if (fourn) fourn.solde = Math.max(0, Number((fourn.solde - ba.total).toFixed(2)));
    for (const l of ba.lignes) {
      const prod = store.produits.find((p) => p.id === l.produit_id);
      if (prod) {
        const avant = prod.stock_actuel;
        prod.stock_actuel = Math.max(0, Number((avant - l.quantite).toFixed(4)));
        enregistrerMouvementStock({
          produit_id: prod.id,
          type_mouvement: 'SUPPRESSION_ACHAT',
          stock_avant: avant,
          stock_apres: prod.stock_actuel,
          cout_unitaire: l.prix_unitaire,
          document_type: 'bon_achat',
          document_id: ba.id,
          document_numero: ba.numero,
          utilisateur: req.adminUser!.nom_complet,
        });
      }
    }
  }
  store.bons_achat.splice(idx, 1);
  res.json({ ok: true });
});

// ── Factures : Modification & Suppression ──
bureauExtrasRouter.put('/factures/:id', checkPage('factures'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const fac = store.factures.find((f) => f.id === Number(req.params.id));
  if (!fac) {
    res.status(404).json({ detail: 'Facture introuvable.' });
    return;
  }
  const b = req.body || {};
  if (b.date_facture !== undefined) fac.date_facture = String(b.date_facture);
  if (b.date_echeance !== undefined) fac.date_echeance = b.date_echeance || null;
  if (b.observations !== undefined) fac.observations = b.observations || null;
  if (b.statut !== undefined) fac.statut = String(b.statut);
  if (b.tva !== undefined) fac.tva = Number(b.tva);
  if (b.total_ht !== undefined) {
    fac.total_ht = Number(b.total_ht);
    fac.total_ttc =
      b.total_ttc !== undefined
        ? Number(b.total_ttc)
        : Number((fac.total_ht * (1 + fac.tva / 100)).toFixed(2));
  }
  res.json(fac);
});

bureauExtrasRouter.delete('/factures/:id', checkPage('factures'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const idx = store.factures.findIndex((f) => f.id === Number(req.params.id));
  if (idx === -1) {
    res.status(404).json({ detail: 'Facture introuvable.' });
    return;
  }
  store.factures.splice(idx, 1);
  res.json({ ok: true });
});

// ── Commandes Portail : Validation ajustée au stock réel ──
bureauExtrasRouter.post(
  '/commandes-portail/:id/valider-ajuste',
  checkPage('cmd_portail'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'valider_commandes')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const cmd = store.commandes_clients.find((c) => c.id === Number(req.params.id));
    if (!cmd) {
      res.status(404).json({ detail: 'Commande introuvable.' });
      return;
    }
    if (cmd.statut !== 'En attente') {
      res.status(400).json({ detail: 'Commande déjà traitée.' });
      return;
    }
    const client = store.clients.find((c) => c.id === cmd.client_id);
    if (!client) {
      res.status(404).json({ detail: 'Client introuvable.' });
      return;
    }

    const preparedAdj: {
      prod: (typeof store.produits)[number];
      qteReelle: number;
      pu: number;
      tot: number;
      ht: number;
      tvaTaux: number;
      tva: number;
    }[] = [];
    let totalTTC = 0;
    let totalHT = 0;
    let totalTVA = 0;
    const bonId = store.nextId('bons_vente');
    const today = new Date().toISOString().slice(0, 10);
    const numero = prochainNumero(
      store.bons_vente.map((x) => x.numero),
      `BV-${today.replace(/-/g, '')}-`
    );

    for (const l of cmd.lignes) {
      const prod = store.produits.find((p) => p.id === l.produit_id);
      if (!prod || prod.stock_actuel <= 0) continue;
      const demandPieces = l.quantite * (l.facteur_conversion || 1);
      const qteReelle = Math.min(demandPieces, prod.stock_actuel);
      if (qteReelle <= 0) continue;
      const tot = Number((qteReelle * l.prix_unitaire).toFixed(2));
      const tvaTaux = prod.tva || 0;
      const ht = Number((tot / (1 + tvaTaux / 100)).toFixed(2));
      const tva = Number((tot - ht).toFixed(2));
      totalTTC += tot;
      totalHT += ht;
      totalTVA += tva;
      preparedAdj.push({
        prod,
        qteReelle,
        pu: l.prix_unitaire,
        tot,
        ht,
        tvaTaux,
        tva,
      });
    }

    if (preparedAdj.length === 0) {
      res.status(400).json({ detail: 'Aucun produit disponible en stock pour cette commande.' });
      return;
    }

    const creditCheck = verifierPlafondCredit(client, totalTTC, {
      forcerAdmin: Boolean(req.body?.forcer_plafond),
      role: req.adminUser?.role,
    });
    if (creditCheck.bloquant) {
      res.status(409).json({
        detail: creditCheck.avertissement,
        code: 'PLAFOND_CREDIT_DEPASSE',
        credit_info: creditCheck,
      });
      return;
    }

    const lignesAjustees = preparedAdj.map((item) => {
      const avant = item.prod.stock_actuel;
      item.prod.stock_actuel = Math.max(
        0,
        Number((avant - item.qteReelle).toFixed(4))
      );
      enregistrerMouvementStock({
        produit_id: item.prod.id,
        type_mouvement: 'VENTE_PORTAIL_AJUSTEE',
        stock_avant: avant,
        stock_apres: item.prod.stock_actuel,
        cout_unitaire: item.prod.prix_moyen_pondere || item.prod.prix_achat,
        document_type: 'bon_vente',
        document_id: bonId,
        document_numero: numero,
        tiers_nom: client.nom,
        date_document: today,
        utilisateur: req.adminUser!.nom_complet,
      });

      return {
        id: store.nextId('lignes_vente'),
        bon_id: bonId,
        produit_id: item.prod.id,
        designation: item.prod.designation,
        quantite: item.qteReelle,
        prix_unitaire: item.pu,
        total: item.tot,
        total_ht: item.ht,
        tva_taux: item.tvaTaux,
        total_tva: item.tva,
        total_ttc: item.tot,
      };
    });

    store.bons_vente.push({
      id: bonId,
      numero,
      date_bon: today,
      client_id: client.id,
      vendeur_id: cmd.vendeur_id,
      total: Number(totalTTC.toFixed(2)),
      total_ht: Number(totalHT.toFixed(2)),
      tva_total: Number(totalTVA.toFixed(2)),
      total_ttc: Number(totalTTC.toFixed(2)),
      montant_verse: 0,
      reste_payer: Number(totalTTC.toFixed(2)),
      statut: 'Validé',
      observations: `Validation ajustée stock réel — ${cmd.numero}`,
      lignes: lignesAjustees,
    });
    client.solde = Number((client.solde + totalTTC).toFixed(2));
    cmd.statut = 'Validée (Ajustée)';
    cmd.bon_vente_id = bonId;

    if (creditCheck.force_applique) {
      ajouterAudit({
        action: 'FORCAGE_PLAFOND_CREDIT',
        utilisateur: req.adminUser!.nom_complet,
        cible_type: 'commande_client',
        cible_id: cmd.id,
        details: `${cmd.numero} -> ${numero} · ${creditCheck.avertissement}`,
      });
    }

    res.json({
      ok: true,
      bon_numero: numero,
      montant: totalTTC,
      credit_warning: creditCheck.avertissement,
      credit_info: creditCheck,
    });
  }
);

// ── Prospects & Commandes Prospects ──
bureauExtrasRouter.post(
  '/prospects/:id/convertir',
  checkPage('prospects_vendeurs'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const p = store.prospects_clients.find((x) => x.id === Number(req.params.id));
    if (!p) {
      res.status(404).json({ detail: 'Prospect introuvable.' });
      return;
    }
    if (p.client_id) {
      res.status(400).json({ detail: 'Ce prospect est déjà converti.' });
      return;
    }
    const id = store.nextId('clients');
    const code = prochainNumero(
      store.clients.map((c) => c.code),
      'CLT-'
    );
    const client = {
      id,
      code,
      nom: p.nom,
      adresse: p.adresse || '',
      tel: p.tel || '',
      email: '',
      ville: p.wilaya || '',
      solde: p.solde || 0,
      niveau_prix: 'detail' as const,
      portail_actif: 1,
      password_hash: hashPassword('client123'),
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      vendeur_id: p.vendeur_id ?? null,
    };
    store.clients.push(client);
    p.client_id = id;
    p.statut = 'Converti';
    ajouterAudit({
      action: 'CONVERSION_PROSPECT',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'prospect',
      cible_id: p.id,
      details: `${p.nom} -> ${client.code}`,
    });
    res.status(201).json({ prospect: p, client });
  }
);

bureauExtrasRouter.delete(
  '/prospects/:id',
  checkPage('prospects_vendeurs'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const idx = store.prospects_clients.findIndex((x) => x.id === Number(req.params.id));
    if (idx === -1) {
      res.status(404).json({ detail: 'Prospect introuvable.' });
      return;
    }
    store.prospects_clients.splice(idx, 1);
    res.json({ ok: true });
  }
);

bureauExtrasRouter.get(
  '/commandes-prospects',
  checkPage('portail_suivi'),
  (_req, res) => {
    res.json(
      store.commandes_prospects
        .map((c) => ({
          ...c,
          prospect_nom:
            store.prospects_clients.find((p) => p.id === c.prospect_id)?.nom || '',
          vendeur_nom:
            store.vendeurs.find((v) => v.id === c.vendeur_id)?.nom || '',
        }))
        .sort((a, b) => b.id - a.id)
    );
  }
);

bureauExtrasRouter.post(
  '/commandes-prospects/:id/valider',
  checkPage('portail_suivi'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'valider_commandes')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const c = store.commandes_prospects.find((x) => x.id === Number(req.params.id));
    if (!c || c.statut !== 'En attente') {
      res.status(400).json({ detail: 'Commande introuvable ou déjà traitée.' });
      return;
    }
    const prosp = store.prospects_clients.find((p) => p.id === c.prospect_id);
    for (const l of c.lignes) {
      const prod = store.produits.find((p) => p.id === l.produit_id);
      if (prod) {
        const avant = prod.stock_actuel;
        const qte = l.quantite * (l.facteur_conversion || 1);
        prod.stock_actuel = Math.max(0, Number((avant - qte).toFixed(4)));
        enregistrerMouvementStock({
          produit_id: prod.id,
          type_mouvement: 'VENTE_PROSPECT',
          stock_avant: avant,
          stock_apres: prod.stock_actuel,
          cout_unitaire: prod.prix_moyen_pondere || prod.prix_achat,
          document_type: 'commande_prospect',
          document_id: c.id,
          document_numero: c.numero,
          tiers_nom: prosp?.nom,
          utilisateur: req.adminUser!.nom_complet,
        });
      }
    }
    if (prosp) prosp.solde = Number((prosp.solde + c.montant_total).toFixed(2));
    c.statut = 'Validée';
    res.json(c);
  }
);

bureauExtrasRouter.post(
  '/commandes-prospects/:id/rejeter',
  checkPage('portail_suivi'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'valider_commandes')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const c = store.commandes_prospects.find((x) => x.id === Number(req.params.id));
    if (!c) {
      res.status(404).json({ detail: 'Commande introuvable.' });
      return;
    }
    c.statut = 'Rejetée';
    res.json(c);
  }
);

// ── Versements Unifiés (Clients, Fournisseurs, Prospects, Vendeurs) ──
bureauExtrasRouter.get('/versements-unifies', checkPage('versements'), (_req, res) => {
  res.json({
    clients: store.versements_clients
      .map((v) => ({
        ...v,
        tiers_nom: store.clients.find((c) => c.id === v.client_id)?.nom || '',
      }))
      .sort((a, b) => b.id - a.id),
    fournisseurs: store.versements_fournisseurs
      .map((v) => ({
        ...v,
        tiers_nom: store.fournisseurs.find((f) => f.id === v.fournisseur_id)?.nom || '',
      }))
      .sort((a, b) => b.id - a.id),
    prospects: store.versements_prospects
      .map((v) => ({
        ...v,
        tiers_nom: store.prospects_clients.find((p) => p.id === v.prospect_id)?.nom || '',
      }))
      .sort((a, b) => b.id - a.id),
    vendeurs: store.versements_vendeurs
      .map((v) => ({
        ...v,
        tiers_nom: store.vendeurs.find((vd) => vd.id === v.vendeur_id)?.nom || '',
      }))
      .sort((a, b) => b.id - a.id),
    referentiels: {
      clients: store.clients,
      fournisseurs: store.fournisseurs,
      prospects: store.prospects_clients,
      vendeurs: store.vendeurs.map(({ password_hash: _p, session_salt: _s, ...v }) => v),
    },
  });
});

bureauExtrasRouter.post(
  '/versements-unifies',
  checkPage('versements'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const b = req.body || {};
    const type = String(b.type || 'client');
    const montant = Number(b.montant || 0);
    if (montant <= 0) {
      res.status(400).json({ detail: 'Montant doit être > 0.' });
      return;
    }
    const today = String(b.date_vers || new Date().toISOString().slice(0, 10));
    const mode = String(b.mode || 'Espèces');
    const reference = b.reference || null;
    const observations = b.observations || null;

    if (type === 'fournisseur') {
      const fourn = store.fournisseurs.find((f) => f.id === Number(b.tiers_id));
      if (!fourn) {
        res.status(404).json({ detail: 'Fournisseur introuvable.' });
        return;
      }
      const v = {
        id: store.nextId('versements_fournisseurs'),
        numero: prochainNumero(
          store.versements_fournisseurs.map((x) => x.numero),
          `VF-${today.replace(/-/g, '')}-`
        ),
        date_vers: today,
        fournisseur_id: fourn.id,
        montant,
        mode,
        reference,
        observations,
      };
      store.versements_fournisseurs.push(v);
      fourn.solde = Math.max(0, Number((fourn.solde - montant).toFixed(2)));
      res.status(201).json(v);
      return;
    }

    if (type === 'prospect') {
      const prosp = store.prospects_clients.find((p) => p.id === Number(b.tiers_id));
      if (!prosp) {
        res.status(404).json({ detail: 'Prospect introuvable.' });
        return;
      }
      const v = {
        id: store.nextId('versements_prospects'),
        numero: prochainNumero(
          store.versements_prospects.map((x) => x.numero),
          `VP-${today.replace(/-/g, '')}-`
        ),
        date_vers: today,
        prospect_id: prosp.id,
        vendeur_id: prosp.vendeur_id || null,
        montant,
        mode,
        reference,
      };
      store.versements_prospects.push(v);
      prosp.solde = Math.max(0, Number((prosp.solde - montant).toFixed(2)));
      res.status(201).json(v);
      return;
    }

    if (type === 'vendeur') {
      if (!peut(req.adminUser?.role, 'encaisser_versement_vendeur')) {
        res.status(403).json({ detail: 'Permission insuffisante.' });
        return;
      }
      const vend = store.vendeurs.find((vd) => vd.id === Number(b.tiers_id));
      if (!vend) {
        res.status(404).json({ detail: 'Vendeur introuvable.' });
        return;
      }
      const v = {
        id: store.nextId('versements_vendeurs'),
        numero: prochainNumero(
          store.versements_vendeurs.map((x) => x.numero),
          `VV-${today.replace(/-/g, '')}-`
        ),
        date_vers: today,
        vendeur_id: vend.id,
        montant,
        mode,
        reference,
        observations,
        statut: 'Validé',
        cree_par: req.adminUser!.nom_complet,
        date_creation: new Date().toISOString().replace('T', ' ').slice(0, 19),
      };
      store.versements_vendeurs.push(v);
      res.status(201).json(v);
      return;
    }

    const client = store.clients.find((c) => c.id === Number(b.tiers_id));
    if (!client) {
      res.status(404).json({ detail: 'Client introuvable.' });
      return;
    }
    const v = {
      id: store.nextId('versements_clients'),
      numero: prochainNumero(
        store.versements_clients.map((x) => x.numero),
        `VC-${today.replace(/-/g, '')}-`
      ),
      date_vers: today,
      client_id: client.id,
      montant,
      mode,
      reference,
      observations,
    };
    store.versements_clients.push(v);
    client.solde = Math.max(0, Number((client.solde - montant).toFixed(2)));
    res.status(201).json(v);
  }
);

bureauExtrasRouter.put(
  '/versements-unifies/:type/:id',
  checkPage('versements'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const kind = String(req.params.type);
    const id = Number(req.params.id);
    const b = req.body || {};
    const nextMontant = b.montant !== undefined ? Number(b.montant) : undefined;
    if (nextMontant !== undefined && nextMontant <= 0) {
      res.status(400).json({ detail: 'Montant doit être > 0.' });
      return;
    }
    if (kind === 'client') {
      const v = store.versements_clients.find((x) => x.id === id);
      if (!v) {
        res.status(404).json({ detail: 'Versement introuvable.' });
        return;
      }
      const c = store.clients.find((x) => x.id === v.client_id);
      if (nextMontant !== undefined && c) {
        c.solde = Math.max(0, Number((c.solde + v.montant - nextMontant).toFixed(2)));
        v.montant = nextMontant;
      }
      if (b.date_vers) v.date_vers = String(b.date_vers);
      if (b.mode) v.mode = String(b.mode);
      if (b.reference !== undefined) v.reference = b.reference || null;
      if (b.observations !== undefined) v.observations = b.observations || null;
      res.json(v);
      return;
    }
    if (kind === 'fournisseur') {
      const v = store.versements_fournisseurs.find((x) => x.id === id);
      if (!v) {
        res.status(404).json({ detail: 'Versement introuvable.' });
        return;
      }
      const f = store.fournisseurs.find((x) => x.id === v.fournisseur_id);
      if (nextMontant !== undefined && f) {
        f.solde = Math.max(0, Number((f.solde + v.montant - nextMontant).toFixed(2)));
        v.montant = nextMontant;
      }
      if (b.date_vers) v.date_vers = String(b.date_vers);
      if (b.mode) v.mode = String(b.mode);
      if (b.reference !== undefined) v.reference = b.reference || null;
      if (b.observations !== undefined) v.observations = b.observations || null;
      res.json(v);
      return;
    }
    if (kind === 'prospect') {
      const v = store.versements_prospects.find((x) => x.id === id);
      if (!v) {
        res.status(404).json({ detail: 'Versement introuvable.' });
        return;
      }
      const p = store.prospects_clients.find((x) => x.id === v.prospect_id);
      if (nextMontant !== undefined && p) {
        p.solde = Math.max(0, Number((p.solde + v.montant - nextMontant).toFixed(2)));
        v.montant = nextMontant;
      }
      if (b.date_vers) v.date_vers = String(b.date_vers);
      if (b.mode) v.mode = String(b.mode);
      if (b.reference !== undefined) v.reference = b.reference || null;
      res.json(v);
      return;
    }
    const v = store.versements_vendeurs.find((x) => x.id === id);
    if (!v) {
      res.status(404).json({ detail: 'Versement introuvable.' });
      return;
    }
    if (nextMontant !== undefined) v.montant = nextMontant;
    if (b.date_vers) v.date_vers = String(b.date_vers);
    if (b.mode) v.mode = String(b.mode);
    if (b.reference !== undefined) v.reference = b.reference || null;
    if (b.observations !== undefined) v.observations = b.observations || null;
    res.json(v);
  }
);

bureauExtrasRouter.delete(
  '/versements-unifies/:type/:id',
  checkPage('versements'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const kind = String(req.params.type);
    const id = Number(req.params.id);
    if (kind === 'client') {
      const idx = store.versements_clients.findIndex((x) => x.id === id);
      if (idx === -1) {
        res.status(404).json({ detail: 'Versement introuvable.' });
        return;
      }
      const v = store.versements_clients[idx];
      const c = store.clients.find((x) => x.id === v.client_id);
      if (c) c.solde = Number((c.solde + v.montant).toFixed(2));
      store.versements_clients.splice(idx, 1);
      res.json({ ok: true });
      return;
    }
    if (kind === 'fournisseur') {
      const idx = store.versements_fournisseurs.findIndex((x) => x.id === id);
      if (idx === -1) {
        res.status(404).json({ detail: 'Versement introuvable.' });
        return;
      }
      const v = store.versements_fournisseurs[idx];
      const f = store.fournisseurs.find((x) => x.id === v.fournisseur_id);
      if (f) f.solde = Number((f.solde + v.montant).toFixed(2));
      store.versements_fournisseurs.splice(idx, 1);
      res.json({ ok: true });
      return;
    }
    if (kind === 'prospect') {
      const idx = store.versements_prospects.findIndex((x) => x.id === id);
      if (idx === -1) {
        res.status(404).json({ detail: 'Versement introuvable.' });
        return;
      }
      const v = store.versements_prospects[idx];
      const p = store.prospects_clients.find((x) => x.id === v.prospect_id);
      if (p) p.solde = Number((p.solde + v.montant).toFixed(2));
      store.versements_prospects.splice(idx, 1);
      res.json({ ok: true });
      return;
    }
    const idx = store.versements_vendeurs.findIndex((x) => x.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: 'Versement introuvable.' });
      return;
    }
    store.versements_vendeurs.splice(idx, 1);
    res.json({ ok: true });
  }
);

bureauExtrasRouter.post(
  '/versements-vendeurs/:id/annuler',
  checkPage('versements'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'encaisser_versement_vendeur')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const v = store.versements_vendeurs.find((x) => x.id === Number(req.params.id));
    if (!v) {
      res.status(404).json({ detail: 'Versement introuvable.' });
      return;
    }
    v.statut = 'Annulé';
    res.json(v);
  }
);

// ── Situations Détaillées avec filtre de dates & édition observation ──
bureauExtrasRouter.get(
  '/situations-detaillees/:type/:id',
  checkPage('situations'),
  (req, res) => {
    const kind = String(req.params.type);
    const id = Number(req.params.id);
    const du = req.query.du ? String(req.query.du) : '';
    const au = req.query.au ? String(req.query.au) : '';

    const allMvts: {
      date: string;
      ordre: number;
      id: number;
      type: string;
      numero: string;
      libelle: string;
      observation: string;
      debit: number;
      credit: number;
      solde: number;
    }[] = [];

    let tiersNom = '';
    let tiersCode = '';
    let soldeActuel = 0;

    if (kind === 'client') {
      const client = store.clients.find((c) => c.id === id);
      if (!client) {
        res.status(404).json({ detail: 'Client introuvable.' });
        return;
      }
      tiersNom = client.nom;
      tiersCode = client.code;
      soldeActuel = client.solde;
      for (const b of store.bons_vente) {
        if (b.client_id === id && !b.prospect_id && b.statut !== 'Annulé') {
          allMvts.push({
            date: b.date_bon,
            ordre: 0,
            id: b.id,
            type: 'bon',
            numero: b.numero,
            libelle: 'Bon de vente',
            observation: b.observations || '',
            debit: b.total,
            credit: 0,
            solde: 0,
          });
        }
      }
      for (const r of store.retours_vente) {
        if (r.client_id === id && r.statut !== 'Annulé') {
          allMvts.push({
            date: r.date_retour,
            ordre: 1,
            id: r.id,
            type: 'retour',
            numero: r.numero,
            libelle: `Avoir / Retour (${r.motif || 'Client'})`,
            observation: r.observations || r.motif || '',
            debit: 0,
            credit: r.total,
            solde: 0,
          });
        }
      }
      for (const v of store.versements_clients) {
        if (v.client_id === id) {
          allMvts.push({
            date: v.date_vers,
            ordre: 2,
            id: v.id,
            type: 'versement',
            numero: v.numero,
            libelle: `Règlement (${v.mode})`,
            observation: v.observations || v.reference || '',
            debit: 0,
            credit: v.montant,
            solde: 0,
          });
        }
      }
    } else {
      const fourn = store.fournisseurs.find((f) => f.id === id);
      if (!fourn) {
        res.status(404).json({ detail: 'Fournisseur introuvable.' });
        return;
      }
      tiersNom = fourn.nom;
      tiersCode = fourn.code;
      soldeActuel = fourn.solde;
      for (const ba of store.bons_achat) {
        if (ba.fournisseur_id === id && ba.statut !== 'Annulé') {
          allMvts.push({
            date: ba.date_bon,
            ordre: 0,
            id: ba.id,
            type: 'achat',
            numero: ba.numero,
            libelle: "Bon d'achat",
            observation: ba.observations || '',
            debit: ba.total,
            credit: 0,
            solde: 0,
          });
        }
      }
      for (const ra of store.retours_achat) {
        if (ra.fournisseur_id === id && ra.statut !== 'Annulé') {
          allMvts.push({
            date: ra.date_retour,
            ordre: 1,
            id: ra.id,
            type: 'retour',
            numero: ra.numero,
            libelle: `Retour fournisseur (${ra.motif || ''})`,
            observation: ra.observations || ra.motif || '',
            debit: 0,
            credit: ra.total,
            solde: 0,
          });
        }
      }
      for (const vf of store.versements_fournisseurs) {
        if (vf.fournisseur_id === id) {
          allMvts.push({
            date: vf.date_vers,
            ordre: 2,
            id: vf.id,
            type: 'versement',
            numero: vf.numero,
            libelle: `Règlement (${vf.mode})`,
            observation: vf.observations || vf.reference || '',
            debit: 0,
            credit: vf.montant,
            solde: 0,
          });
        }
      }
    }

    allMvts.sort((a, b) => a.date.localeCompare(b.date) || a.ordre - b.ordre || a.id - b.id);
    const totalNetAll = allMvts.reduce((acc, m) => acc + m.debit - m.credit, 0);
    let courant = Number((soldeActuel - totalNetAll).toFixed(2));
    const soldeReportInitial = courant;
    for (const m of allMvts) {
      courant = Number((courant + m.debit - m.credit).toFixed(2));
      m.solde = courant;
    }

    const filtered = allMvts.filter((m) => (!du || m.date >= du) && (!au || m.date <= au));
    const reportPeriode =
      du && allMvts.some((m) => m.date < du)
        ? allMvts.filter((m) => m.date < du).slice(-1)[0].solde
        : soldeReportInitial;

    res.json({
      tiers_nom: tiersNom,
      tiers_code: tiersCode,
      solde_report: reportPeriode,
      total_debit: Number(filtered.reduce((a, m) => a + m.debit, 0).toFixed(2)),
      total_credit: Number(filtered.reduce((a, m) => a + m.credit, 0).toFixed(2)),
      solde_final: filtered.length > 0 ? filtered[filtered.length - 1].solde : reportPeriode,
      solde_global: soldeActuel,
      lignes: filtered,
      versements: filtered.filter((m) => m.type === 'versement'),
    });
  }
);

bureauExtrasRouter.put('/situations/observation', checkPage('situations'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const { kind, doc_type, doc_id, observation } = req.body || {};
  const obs = String(observation || '');
  if (doc_type === 'bon' && kind === 'client') {
    const b = store.bons_vente.find((x) => x.id === Number(doc_id));
    if (b) b.observations = obs;
  } else if (doc_type === 'achat') {
    const ba = store.bons_achat.find((x) => x.id === Number(doc_id));
    if (ba) ba.observations = obs;
  } else if (doc_type === 'versement' && kind === 'client') {
    const v = store.versements_clients.find((x) => x.id === Number(doc_id));
    if (v) v.observations = obs;
  } else if (doc_type === 'versement' && kind === 'fournisseur') {
    const v = store.versements_fournisseurs.find((x) => x.id === Number(doc_id));
    if (v) v.observations = obs;
  } else if (doc_type === 'retour') {
    const r =
      kind === 'client'
        ? store.retours_vente.find((x) => x.id === Number(doc_id))
        : store.retours_achat.find((x) => x.id === Number(doc_id));
    if (r) r.observations = obs;
  }
  res.json({ ok: true });
});

// ── Contrôle de Cohérence du Stock & Régularisation ──
bureauExtrasRouter.get(
  '/mouvements-stock/coherence',
  checkPage('mouvements_stock'),
  (_req, res) => {
    const ecarts = store.produits
      .filter((p) => p.supprime === 0)
      .map((p) => {
        const stockJournal = store.mouvements_stock
          .filter((m) => m.produit_id === p.id)
          .reduce((acc, m) => acc + m.quantite, 0);
        const ecart = Number((p.stock_actuel - stockJournal).toFixed(4));
        return {
          produit_id: p.id,
          code: p.code,
          designation: p.designation,
          unite: p.unite,
          stock_produit: p.stock_actuel,
          stock_journal: Number(stockJournal.toFixed(4)),
          ecart,
        };
      })
      .filter((row) => Math.abs(row.ecart) > 1e-4);
    res.json(ecarts);
  }
);

bureauExtrasRouter.post(
  '/mouvements-stock/regulariser',
  checkPage('mouvements_stock'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'ajuster_stock')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const ids: number[] = Array.isArray(req.body?.produit_ids)
      ? req.body.produit_ids.map(Number)
      : [];
    let count = 0;
    for (const p of store.produits.filter((x) => x.supprime === 0)) {
      if (ids.length > 0 && !ids.includes(p.id)) continue;
      const stockJournal = store.mouvements_stock
        .filter((m) => m.produit_id === p.id)
        .reduce((acc, m) => acc + m.quantite, 0);
      const ecart = Number((p.stock_actuel - stockJournal).toFixed(4));
      if (Math.abs(ecart) <= 1e-4) continue;
      enregistrerMouvementStock({
        produit_id: p.id,
        type_mouvement: 'REGULARISATION',
        stock_avant: stockJournal,
        stock_apres: p.stock_actuel,
        cout_unitaire: p.prix_moyen_pondere || p.prix_achat,
        pmp_apres: p.prix_moyen_pondere,
        tiers_nom: 'Contrôle cohérence',
        motif: `Régularisation écart journal (${ecart > 0 ? '+' : ''}${ecart})`,
        utilisateur: req.adminUser!.nom_complet,
      });
      count += 1;
    }
    ajouterAudit({
      action: 'REGULARISATION_COHERENCE_STOCK',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'stock',
      details: `${count} produit(s) régularisé(s)`,
    });
    res.json({ regularises: count });
  }
);

// ── Retours Clients & Fournisseurs (modules/retourpage.py) ──
bureauExtrasRouter.get('/retours', checkPage('retours'), (req, res) => {
  const kind = String(req.query.type || 'vente');
  if (kind === 'achat') {
    res.json(
      store.retours_achat
        .map((r) => ({
          ...r,
          tiers_nom:
            store.fournisseurs.find((f) => f.id === r.fournisseur_id)?.nom || '',
        }))
        .sort((a, b) => b.id - a.id)
    );
    return;
  }
  res.json(
    store.retours_vente
      .map((r) => ({
        ...r,
        tiers_nom: store.clients.find((c) => c.id === r.client_id)?.nom || '',
      }))
      .sort((a, b) => b.id - a.id)
  );
});

bureauExtrasRouter.post('/retours', checkPage('retours'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const b = req.body || {};
  const kind = String(b.type || 'vente');
  const today = String(b.date_retour || new Date().toISOString().slice(0, 10));
  const tiersId = Number(b.tiers_id || 0);
  const lignesIn = Array.isArray(b.lignes) ? b.lignes : [];
  if (lignesIn.length === 0) {
    res.status(400).json({ detail: 'Ajoutez au moins une ligne de retour.' });
    return;
  }

  if (kind === 'achat') {
    const fourn = store.fournisseurs.find((f) => f.id === tiersId);
    if (!fourn) {
      res.status(404).json({ detail: 'Fournisseur introuvable.' });
      return;
    }
    const id = store.nextId('retours_achat');
    const numero = prochainNumero(
      store.retours_achat.map((x) => x.numero),
      `RA-${today.replace(/-/g, '')}-`
    );
    const lignes: LigneRetour[] = [];
    let total = 0;
    for (const l of lignesIn) {
      const prod = store.produits.find((p) => p.id === Number(l.produit_id));
      if (!prod) continue;
      const qte = Number(l.quantite || 0);
      const pu = Number(l.prix_unitaire ?? prod.prix_achat);
      if (qte <= 0) continue;
      const tot = Number((qte * pu).toFixed(2));
      total += tot;
      const avant = prod.stock_actuel;
      prod.stock_actuel = Math.max(0, Number((avant - qte).toFixed(4)));
      enregistrerMouvementStock({
        produit_id: prod.id,
        type_mouvement: 'RETOUR_ACHAT',
        stock_avant: avant,
        stock_apres: prod.stock_actuel,
        cout_unitaire: pu,
        document_type: 'retour_achat',
        document_id: id,
        document_numero: numero,
        tiers_nom: fourn.nom,
        motif: b.motif || 'Retour fournisseur',
        date_document: today,
        utilisateur: req.adminUser!.nom_complet,
      });
      lignes.push({
        id: store.nextId('lignes_retour_achat'),
        produit_id: prod.id,
        designation: prod.designation,
        quantite: qte,
        prix_unitaire: pu,
        total: tot,
      });
    }
    fourn.solde = Math.max(0, Number((fourn.solde - total).toFixed(2)));
    const rec: RetourAchat = {
      id,
      numero,
      date_retour: today,
      bon_achat_id: b.bon_id ? Number(b.bon_id) : null,
      fournisseur_id: fourn.id,
      total: Number(total.toFixed(2)),
      motif: b.motif || null,
      observations: b.observations || null,
      statut: 'Validé',
      lignes,
    };
    store.retours_achat.push(rec);
    res.status(201).json(rec);
    return;
  }

  const client = store.clients.find((c) => c.id === tiersId);
  if (!client) {
    res.status(404).json({ detail: 'Client introuvable.' });
    return;
  }
  const id = store.nextId('retours_vente');
  const numero = prochainNumero(
    store.retours_vente.map((x) => x.numero),
    `RV-${today.replace(/-/g, '')}-`
  );
  const lignes: LigneRetour[] = [];
  let total = 0;
  for (const l of lignesIn) {
    const prod = store.produits.find((p) => p.id === Number(l.produit_id));
    if (!prod) continue;
    const qte = Number(l.quantite || 0);
    const pu = Number(l.prix_unitaire ?? prod.prix_vente);
    if (qte <= 0) continue;
    const tot = Number((qte * pu).toFixed(2));
    total += tot;
    const avant = prod.stock_actuel;
    prod.stock_actuel = Number((avant + qte).toFixed(4));
    enregistrerMouvementStock({
      produit_id: prod.id,
      type_mouvement: 'RETOUR_VENTE',
      stock_avant: avant,
      stock_apres: prod.stock_actuel,
      cout_unitaire: prod.prix_moyen_pondere || prod.prix_achat,
      document_type: 'retour_vente',
      document_id: id,
      document_numero: numero,
      tiers_nom: client.nom,
      motif: b.motif || 'Retour client',
      date_document: today,
      utilisateur: req.adminUser!.nom_complet,
    });
    lignes.push({
      id: store.nextId('lignes_retour_vente'),
      produit_id: prod.id,
      designation: prod.designation,
      quantite: qte,
      prix_unitaire: pu,
      total: tot,
    });
  }
  if (client.code !== 'CLT-COMPTOIR') {
    client.solde = Math.max(0, Number((client.solde - total).toFixed(2)));
  }
  const rec: RetourVente = {
    id,
    numero,
    date_retour: today,
    bon_vente_id: b.bon_id ? Number(b.bon_id) : null,
    client_id: client.id,
    total: Number(total.toFixed(2)),
    motif: b.motif || null,
    observations: b.observations || null,
    statut: 'Validé',
    lignes,
  };
  store.retours_vente.push(rec);
  res.status(201).json(rec);
});

bureauExtrasRouter.put('/retours/:type/:id', checkPage('retours'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const kind = String(req.params.type);
  const id = Number(req.params.id);
  const b = req.body || {};
  const list = kind === 'achat' ? store.retours_achat : store.retours_vente;
  const r = list.find((x) => x.id === id);
  if (!r) {
    res.status(404).json({ detail: 'Retour introuvable.' });
    return;
  }
  if (b.date_retour) r.date_retour = String(b.date_retour);
  if (b.motif !== undefined) r.motif = b.motif || null;
  if (b.observations !== undefined) r.observations = b.observations || null;
  res.json(r);
});

bureauExtrasRouter.delete(
  '/retours/:type/:id',
  checkPage('retours'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const kind = String(req.params.type);
    const id = Number(req.params.id);
    if (kind === 'achat') {
      const idx = store.retours_achat.findIndex((x) => x.id === id);
      if (idx === -1) {
        res.status(404).json({ detail: 'Retour introuvable.' });
        return;
      }
      const r = store.retours_achat[idx];
      const f = store.fournisseurs.find((x) => x.id === r.fournisseur_id);
      if (f) f.solde = Number((f.solde + r.total).toFixed(2));
      for (const l of r.lignes) {
        const p = store.produits.find((x) => x.id === l.produit_id);
        if (p) p.stock_actuel = Number((p.stock_actuel + l.quantite).toFixed(4));
      }
      store.retours_achat.splice(idx, 1);
      res.json({ ok: true });
      return;
    }
    const idx = store.retours_vente.findIndex((x) => x.id === id);
    if (idx === -1) {
      res.status(404).json({ detail: 'Retour introuvable.' });
      return;
    }
    const r = store.retours_vente[idx];
    const c = store.clients.find((x) => x.id === r.client_id);
    if (c && c.code !== 'CLT-COMPTOIR') c.solde = Number((c.solde + r.total).toFixed(2));
    for (const l of r.lignes) {
      const p = store.produits.find((x) => x.id === l.produit_id);
      if (p) p.stock_actuel = Math.max(0, Number((p.stock_actuel - l.quantite).toFixed(4)));
    }
    store.retours_vente.splice(idx, 1);
    res.json({ ok: true });
  }
);

// ── Vendeurs, Fiche Vendeur, Chargements, Déchargements & Retours Vendeurs ──
bureauExtrasRouter.post('/vendeurs', checkPage('vendeurs'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const b = req.body || {};
  const nom = String(b.nom || '').trim();
  if (!nom) {
    res.status(400).json({ detail: 'Nom du vendeur requis.' });
    return;
  }
  const id = store.nextId('vendeurs');
  const code =
    String(b.code || '').trim() ||
    prochainNumero(
      store.vendeurs.map((v) => v.code),
      'VND-'
    );
  const v = {
    id,
    code,
    nom,
    tel: String(b.tel || ''),
    actif: 1,
    password_hash: b.password ? hashPassword(String(b.password)) : hashPassword('vendeur123'),
    session_salt: 'salt',
  };
  store.vendeurs.push(v);
  res.status(201).json({ id: v.id, code: v.code, nom: v.nom, tel: v.tel, actif: v.actif });
});

bureauExtrasRouter.put('/vendeurs/:id', checkPage('vendeurs'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const v = store.vendeurs.find((x) => x.id === Number(req.params.id));
  if (!v) {
    res.status(404).json({ detail: 'Vendeur introuvable.' });
    return;
  }
  const b = req.body || {};
  if (b.nom !== undefined && String(b.nom).trim()) v.nom = String(b.nom).trim();
  if (b.tel !== undefined) v.tel = String(b.tel);
  if (b.actif !== undefined) v.actif = Number(b.actif) ? 1 : 0;
  if (b.password && String(b.password).length >= 4) {
    v.password_hash = hashPassword(String(b.password));
  }
  res.json({ id: v.id, code: v.code, nom: v.nom, tel: v.tel, actif: v.actif });
});

bureauExtrasRouter.get('/vendeurs/:id/fiche', checkPage('vendeurs'), (req, res) => {
  const id = Number(req.params.id);
  const v = store.vendeurs.find((x) => x.id === id);
  if (!v) {
    res.status(404).json({ detail: 'Vendeur introuvable.' });
    return;
  }
  const ventes = store.bons_vente.filter((b) => b.vendeur_id === id && b.statut !== 'Annulé');
  const versements = store.versements_vendeurs
    .filter((vv) => vv.vendeur_id === id)
    .sort((a, b) => b.id - a.id);
  const chargements = store.bons_chargement
    .filter((c) => c.vendeur_id === id)
    .sort((a, b) => b.id - a.id);
  const dechargements = store.dechargements_camion
    .filter((d) => d.vendeur_id === id)
    .sort((a, b) => b.id - a.id);
  const retours = store.retours_vendeur
    .filter((r) => r.vendeur_id === id)
    .sort((a, b) => b.id - a.id);
  const stockCamion = store.stock_camion_vendeur
    .filter((s) => s.vendeur_id === id)
    .map((s) => {
      const p = store.produits.find((pr) => pr.id === s.produit_id);
      return {
        ...s,
        code: p?.code || '',
        designation: p?.designation || '',
        facteur_conversion: p?.facteur_conversion || 1,
        prix_vente: p?.prix_vente || 0,
        valeur: Number((s.quantite_pieces * (p?.prix_vente || 0)).toFixed(2)),
      };
    });
  const caTotal = ventes.reduce((a, b) => a + b.total, 0);
  const totalVerseVendeur = versements
    .filter((vv) => vv.statut !== 'Annulé')
    .reduce((a, vv) => a + vv.montant, 0);
  res.json({
    vendeur: { id: v.id, code: v.code, nom: v.nom, tel: v.tel, actif: v.actif },
    kpis: {
      ca_total: caTotal,
      nb_ventes: ventes.length,
      total_verse_vendeur: totalVerseVendeur,
      reste_recette: Number((caTotal - totalVerseVendeur).toFixed(2)),
      valeur_camion: stockCamion.reduce((a, s) => a + s.valeur, 0),
    },
    stock_camion: stockCamion,
    chargements,
    dechargements,
    retours,
    versements,
    ventes,
  });
});

bureauExtrasRouter.post(
  '/chargements/:id/annuler',
  checkPage('chargements'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'gerer_chargements')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const chg = store.bons_chargement.find((c) => c.id === Number(req.params.id));
    if (!chg) {
      res.status(404).json({ detail: 'Chargement introuvable.' });
      return;
    }
    if (chg.statut === 'Annulé') {
      res.status(400).json({ detail: 'Déjà annulé.' });
      return;
    }
    chg.statut = 'Annulé';
    for (const l of chg.lignes) {
      const p = store.produits.find((pr) => pr.id === l.produit_id);
      if (p) {
        const avant = p.stock_actuel;
        p.stock_actuel = Number((avant + l.quantite_pieces).toFixed(4));
        enregistrerMouvementStock({
          produit_id: p.id,
          type_mouvement: 'ANNULATION_CHARGEMENT',
          stock_avant: avant,
          stock_apres: p.stock_actuel,
          cout_unitaire: p.prix_moyen_pondere || p.prix_achat,
          document_type: 'bon_chargement',
          document_id: chg.id,
          document_numero: chg.numero,
          utilisateur: req.adminUser!.nom_complet,
        });
      }
      const sc = store.stock_camion_vendeur.find(
        (s) => s.vendeur_id === chg.vendeur_id && s.produit_id === l.produit_id
      );
      if (sc) {
        sc.quantite_colis = Math.max(0, Number((sc.quantite_colis - l.quantite_colis).toFixed(2)));
        sc.quantite_pieces = Math.max(0, Number((sc.quantite_pieces - l.quantite_pieces).toFixed(2)));
      }
    }
    res.json(chg);
  }
);

bureauExtrasRouter.delete(
  '/chargements/:id',
  checkPage('chargements'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'gerer_chargements')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const idx = store.bons_chargement.findIndex((c) => c.id === Number(req.params.id));
    if (idx === -1) {
      res.status(404).json({ detail: 'Chargement introuvable.' });
      return;
    }
    store.bons_chargement.splice(idx, 1);
    res.json({ ok: true });
  }
);

// ── Déchargements fin de tournée ──
bureauExtrasRouter.get('/dechargements', checkPage('chargements'), (_req, res) => {
  res.json(
    store.dechargements_camion
      .map((d) => ({
        ...d,
        vendeur_nom: store.vendeurs.find((v) => v.id === d.vendeur_id)?.nom || '',
      }))
      .sort((a, b) => b.id - a.id)
  );
});

bureauExtrasRouter.post('/dechargements', checkPage('chargements'), (req: AdminReq, res) => {
  if (!peut(req.adminUser?.role, 'gerer_chargements')) {
    res.status(403).json({ detail: 'Permission insuffisante.' });
    return;
  }
  const b = req.body || {};
  const vendeurId = Number(b.vendeur_id);
  const vendeur = store.vendeurs.find((v) => v.id === vendeurId);
  if (!vendeur) {
    res.status(404).json({ detail: 'Vendeur introuvable.' });
    return;
  }
  const lignesIn = Array.isArray(b.lignes) ? b.lignes : [];
  if (lignesIn.length === 0) {
    res.status(400).json({ detail: 'Aucune ligne de déchargement.' });
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const id = store.nextId('dechargements_camion');
  const numero = prochainNumero(
    store.dechargements_camion.map((d) => d.numero),
    `DEC-${today.replace(/-/g, '')}-`
  );
  const lignes = lignesIn.map((l: any) => {
    const prod = store.produits.find((p) => p.id === Number(l.produit_id));
    const sc = store.stock_camion_vendeur.find(
      (s) => s.vendeur_id === vendeurId && s.produit_id === Number(l.produit_id)
    );
    const theo = sc?.quantite_pieces || 0;
    const reel = Number(l.reel_pieces ?? theo);
    return {
      produit_id: Number(l.produit_id),
      designation: prod?.designation || 'Produit',
      facteur_conversion: prod?.facteur_conversion || 1,
      theorique_pieces: theo,
      reel_pieces: reel,
      ecart_pieces: Number((reel - theo).toFixed(2)),
    };
  });
  const dec: DechargementCamion = {
    id,
    numero,
    date_dechargement: today,
    vendeur_id: vendeurId,
    statut: 'En attente',
    observations: b.observations || null,
    lignes,
  };
  store.dechargements_camion.push(dec);
  res.status(201).json(dec);
});

bureauExtrasRouter.post(
  '/dechargements/:id/valider',
  checkPage('chargements'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'gerer_chargements')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const dec = store.dechargements_camion.find((d) => d.id === Number(req.params.id));
    if (!dec || dec.statut !== 'En attente') {
      res.status(400).json({ detail: 'Déchargement introuvable ou déjà traité.' });
      return;
    }
    const vendeur = store.vendeurs.find((v) => v.id === dec.vendeur_id);
    for (const l of dec.lignes) {
      const prod = store.produits.find((p) => p.id === l.produit_id);
      if (prod && l.reel_pieces > 0) {
        const avant = prod.stock_actuel;
        prod.stock_actuel = Number((avant + l.reel_pieces).toFixed(4));
        enregistrerMouvementStock({
          produit_id: prod.id,
          type_mouvement: 'DECHARGEMENT_CAMION',
          stock_avant: avant,
          stock_apres: prod.stock_actuel,
          cout_unitaire: prod.prix_moyen_pondere || prod.prix_achat,
          document_type: 'dechargement',
          document_id: dec.id,
          document_numero: dec.numero,
          tiers_nom: vendeur?.nom,
          utilisateur: req.adminUser!.nom_complet,
        });
      }
      const sc = store.stock_camion_vendeur.find(
        (s) => s.vendeur_id === dec.vendeur_id && s.produit_id === l.produit_id
      );
      if (sc) {
        sc.quantite_pieces = 0;
        sc.quantite_colis = 0;
      }
    }
    dec.statut = 'Validé';
    dec.traite_par = req.adminUser!.nom_complet;
    res.json(dec);
  }
);

bureauExtrasRouter.post(
  '/dechargements/:id/rejeter',
  checkPage('chargements'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'gerer_chargements')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const dec = store.dechargements_camion.find((d) => d.id === Number(req.params.id));
    if (!dec) {
      res.status(404).json({ detail: 'Déchargement introuvable.' });
      return;
    }
    dec.statut = 'Rejeté';
    dec.traite_par = req.adminUser!.nom_complet;
    res.json(dec);
  }
);

// ── Retours Vendeurs (modules/retourvendeurpage.py) ──
bureauExtrasRouter.get('/retours-vendeurs', checkPage('retours_vendeur'), (_req, res) => {
  const valeurDepot = store.produits
    .filter((p) => p.actif === 1 && p.supprime === 0)
    .reduce((acc, p) => acc + p.stock_actuel * p.prix_achat, 0);
  res.json({
    valeur_depot_achat: Number(valeurDepot.toFixed(2)),
    retours: store.retours_vendeur
      .map((r) => ({
        ...r,
        vendeur_nom: store.vendeurs.find((v) => v.id === r.vendeur_id)?.nom || '',
      }))
      .sort((a, b) => b.id - a.id),
  });
});

bureauExtrasRouter.post('/retours-vendeurs', checkPage('retours_vendeur'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const b = req.body || {};
  const vendeurId = Number(b.vendeur_id);
  const vendeur = store.vendeurs.find((v) => v.id === vendeurId);
  if (!vendeur) {
    res.status(404).json({ detail: 'Vendeur introuvable.' });
    return;
  }
  const lignesIn = Array.isArray(b.lignes) ? b.lignes : [];
  if (lignesIn.length === 0) {
    res.status(400).json({ detail: 'Ajoutez au moins un produit.' });
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const id = store.nextId('retours_vendeur');
  const numero = prochainNumero(
    store.retours_vendeur.map((r) => r.numero),
    `RTV-${today.replace(/-/g, '')}-`
  );
  let valeurTotale = 0;
  const lignes = lignesIn.map((l: any) => {
    const prod = store.produits.find((p) => p.id === Number(l.produit_id));
    const fc = prod?.facteur_conversion || 1;
    const colis = Number(l.quantite_colis || 0);
    const pieces = colis > 0 ? colis * fc : Number(l.quantite_pieces || 0);
    const pu = prod?.prix_achat || 0;
    valeurTotale += pieces * pu;
    return {
      produit_id: Number(l.produit_id),
      designation: prod?.designation || 'Produit',
      quantite_colis: colis || Number((pieces / fc).toFixed(2)),
      quantite_pieces: pieces,
      facteur_conversion: fc,
      prix_unitaire: pu,
      motif: String(b.motif || 'INVENDU'),
      decision: b.decision || 'VENDABLE',
    };
  });
  const rv: RetourVendeur = {
    id,
    numero,
    date_retour: today,
    vendeur_id: vendeurId,
    motif: String(b.motif || 'INVENDU'),
    decision: b.decision || 'VENDABLE',
    imputation: b.imputation || 'ENTREPRISE',
    statut: 'En attente',
    valeur_totale: Number(valeurTotale.toFixed(2)),
    observations: b.observations || null,
    lignes,
  };
  store.retours_vendeur.push(rv);
  res.status(201).json(rv);
});

bureauExtrasRouter.post(
  '/retours-vendeurs/:id/confirmer',
  checkPage('retours_vendeur'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'gerer_chargements')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const rv = store.retours_vendeur.find((x) => x.id === Number(req.params.id));
    if (!rv || rv.statut !== 'En attente') {
      res.status(400).json({ detail: 'Retour introuvable ou déjà traité.' });
      return;
    }
    const decision = (req.body?.decision || rv.decision) as 'VENDABLE' | 'CASSE' | 'FOURNISSEUR';
    const imputation = (req.body?.imputation || rv.imputation) as 'ENTREPRISE' | 'VENDEUR';
    const vendeur = store.vendeurs.find((v) => v.id === rv.vendeur_id);
    for (const l of rv.lignes) {
      const prod = store.produits.find((p) => p.id === l.produit_id);
      if (prod && decision === 'VENDABLE') {
        const avant = prod.stock_actuel;
        prod.stock_actuel = Number((avant + l.quantite_pieces).toFixed(4));
        enregistrerMouvementStock({
          produit_id: prod.id,
          type_mouvement: 'RETOUR_VENDEUR',
          stock_avant: avant,
          stock_apres: prod.stock_actuel,
          cout_unitaire: prod.prix_moyen_pondere || prod.prix_achat,
          document_type: 'retour_vendeur',
          document_id: rv.id,
          document_numero: rv.numero,
          tiers_nom: vendeur?.nom,
          motif: `${rv.motif} (${decision})`,
          utilisateur: req.adminUser!.nom_complet,
        });
      } else if (prod) {
        prod.stock_retours_pieces = Number(
          ((prod.stock_retours_pieces || 0) + l.quantite_pieces).toFixed(2)
        );
      }
      const sc = store.stock_camion_vendeur.find(
        (s) => s.vendeur_id === rv.vendeur_id && s.produit_id === l.produit_id
      );
      if (sc) {
        sc.quantite_pieces = Math.max(0, Number((sc.quantite_pieces - l.quantite_pieces).toFixed(2)));
        sc.quantite_colis = Math.max(0, Number((sc.quantite_colis - l.quantite_colis).toFixed(2)));
      }
    }
    rv.decision = decision;
    rv.imputation = imputation;
    rv.statut = 'Confirmé';
    rv.traite_par = req.adminUser!.nom_complet;
    rv.date_traitement = new Date().toISOString().replace('T', ' ').slice(0, 19);
    res.json(rv);
  }
);

bureauExtrasRouter.post(
  '/retours-vendeurs/:id/rejeter',
  checkPage('retours_vendeur'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'gerer_chargements')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const rv = store.retours_vendeur.find((x) => x.id === Number(req.params.id));
    if (!rv) {
      res.status(404).json({ detail: 'Retour introuvable.' });
      return;
    }
    rv.statut = 'Rejeté';
    rv.traite_par = req.adminUser!.nom_complet;
    rv.date_traitement = new Date().toISOString().replace('T', ' ').slice(0, 19);
    res.json(rv);
  }
);

// ── Statistiques Détaillées, Suivi Commercial & Analyse Produits ──
bureauExtrasRouter.get(
  '/statistiques-detaillees',
  checkPage('statistiques'),
  (req, res) => {
    const du = req.query.du ? String(req.query.du) : '';
    const au = req.query.au ? String(req.query.au) : '';

    const ventes = store.bons_vente.filter(
      (b) => b.statut !== 'Annulé' && (!du || b.date_bon >= du) && (!au || b.date_bon <= au)
    );
    const achats = store.bons_achat.filter(
      (b) => b.statut !== 'Annulé' && (!du || b.date_bon >= du) && (!au || b.date_bon <= au)
    );

    const ventesParClient = store.clients
      .map((c) => {
        const bons = ventes.filter((b) => b.client_id === c.id);
        return {
          client_id: c.id,
          code: c.code,
          nom: c.nom,
          nb_bons: bons.length,
          ca_total: bons.reduce((a, b) => a + b.total, 0),
          verse: bons.reduce((a, b) => a + b.montant_verse, 0),
          reste: bons.reduce((a, b) => a + b.reste_payer, 0),
        };
      })
      .filter((x) => x.nb_bons > 0)
      .sort((a, b) => b.ca_total - a.ca_total);

    const achatsParFournisseur = store.fournisseurs
      .map((f) => {
        const bons = achats.filter((b) => b.fournisseur_id === f.id);
        return {
          fournisseur_id: f.id,
          code: f.code,
          nom: f.nom,
          nb_bons: bons.length,
          total_achats: bons.reduce((a, b) => a + b.total, 0),
        };
      })
      .filter((x) => x.nb_bons > 0)
      .sort((a, b) => b.total_achats - a.total_achats);

    const suiviCommercial = store.vendeurs.map((vd) => {
      const bv = ventes.filter((b) => b.vendeur_id === vd.id);
      const ca = bv.reduce((a, b) => a + b.total, 0);
      const encaisse = bv.reduce((a, b) => a + b.montant_verse, 0);
      return {
        vendeur_id: vd.id,
        code: vd.code,
        nom: vd.nom,
        nb_ventes: bv.length,
        ca_total: ca,
        especes_encaissees: encaisse,
        credit_restant: Number((ca - encaisse).toFixed(2)),
      };
    });

    res.json({
      ventes_total: ventes.reduce((a, b) => a + b.total, 0),
      nb_ventes: ventes.length,
      achats_total: achats.reduce((a, b) => a + b.total, 0),
      nb_achats: achats.length,
      ventes_par_client: ventesParClient,
      achats_par_fournisseur: achatsParFournisseur,
      suivi_commercial: suiviCommercial,
      bons_ventes: ventes.map((b) => ({
        ...b,
        client_nom: store.clients.find((c) => c.id === b.client_id)?.nom || '',
      })),
      bons_achats: achats.map((b) => ({
        ...b,
        fournisseur_nom:
          store.fournisseurs.find((f) => f.id === b.fournisseur_id)?.nom || '',
      })),
    });
  }
);

bureauExtrasRouter.post('/analyse-produits', checkPage('statistiques'), (req, res) => {
  const b = req.body || {};
  const ids: number[] = Array.isArray(b.produit_ids) ? b.produit_ids.map(Number) : [];
  const du = b.du ? String(b.du) : '';
  const au = b.au ? String(b.au) : '';
  const tauxPartenaire = Math.max(0, Math.min(100, Number(b.taux_partenaire ?? 50)));

  const ventes = store.bons_vente.filter(
    (bv) => bv.statut !== 'Annulé' && (!du || bv.date_bon >= du) && (!au || bv.date_bon <= au)
  );
  const achats = store.bons_achat.filter(
    (ba) => ba.statut !== 'Annulé' && (!du || ba.date_bon >= du) && (!au || ba.date_bon <= au)
  );

  const prods = store.produits.filter(
    (p) => p.supprime === 0 && (ids.length === 0 || ids.includes(p.id))
  );
  const lignes = prods.map((p) => {
    let qteVendue = 0;
    let caVente = 0;
    for (const bv of ventes) {
      for (const l of bv.lignes) {
        if (l.produit_id === p.id) {
          qteVendue += l.quantite;
          caVente += l.total;
        }
      }
    }
    let qteAchetee = 0;
    let coutAchat = 0;
    for (const ba of achats) {
      for (const l of ba.lignes) {
        if (l.produit_id === p.id) {
          qteAchetee += l.quantite;
          coutAchat += l.total;
        }
      }
    }
    const coutMoyen = p.prix_moyen_pondere || p.prix_achat;
    const beneficeEstime = Number((caVente - qteVendue * coutMoyen).toFixed(2));
    return {
      produit_id: p.id,
      code: p.code,
      designation: p.designation,
      unite: p.unite,
      stock_actuel: p.stock_actuel,
      valeur_stock: Number((p.stock_actuel * coutMoyen).toFixed(2)),
      qte_achetee: Number(qteAchetee.toFixed(2)),
      cout_achats: Number(coutAchat.toFixed(2)),
      qte_vendue: Number(qteVendue.toFixed(2)),
      ca_ventes: Number(caVente.toFixed(2)),
      benefice_estime: beneficeEstime,
      part_partenaire: Number(((beneficeEstime * tauxPartenaire) / 100).toFixed(2)),
    };
  });

  const totaux = {
    ca_ventes: Number(lignes.reduce((a, l) => a + l.ca_ventes, 0).toFixed(2)),
    cout_achats: Number(lignes.reduce((a, l) => a + l.cout_achats, 0).toFixed(2)),
    valeur_stock: Number(lignes.reduce((a, l) => a + l.valeur_stock, 0).toFixed(2)),
    benefice_estime: Number(lignes.reduce((a, l) => a + l.benefice_estime, 0).toFixed(2)),
    part_partenaire: Number(lignes.reduce((a, l) => a + l.part_partenaire, 0).toFixed(2)),
    taux_partenaire: tauxPartenaire,
  };
  res.json({ lignes, totaux });
});

// ── Profils-Documents, Utilisateurs (Edition / Reset MDP) & Maintenance Reset ──
bureauExtrasRouter.get('/profils-documents', checkPage('profils'), (_req, res) => {
  res.json(store.document_profils);
});

bureauExtrasRouter.put('/profils-documents', checkPage('profils'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const b = req.body || {};
  store.document_profils = {
    facture: Number(b.facture || store.document_profils.facture),
    bon_livraison: Number(b.bon_livraison || store.document_profils.bon_livraison),
    devis: Number(b.devis || store.document_profils.devis),
    situation: Number(b.situation || store.document_profils.situation),
  };
  ajouterAudit({
    action: 'CONFIG_PROFIL_DOCUMENTS',
    utilisateur: req.adminUser!.nom_complet,
    details: JSON.stringify(store.document_profils),
  });
  res.json(store.document_profils);
});

bureauExtrasRouter.post(
  '/systeme/reinitialiser',
  checkPage('profils'),
  (req: AdminReq, res) => {
    if (req.adminUser?.role !== 'admin') {
      res.status(403).json({ detail: 'Réservé aux administrateurs.' });
      return;
    }
    const pwd = String(req.body?.password || '');
    if (!verifyPassword(pwd, req.adminUser.password_hash)) {
      res.status(401).json({ detail: 'Mot de passe administrateur incorrect.' });
      return;
    }
    store.resetOperationalData(req.adminUser.nom_complet);
    res.json({ ok: true });
  }
);

// ── Sauvegarde & Restauration Complète (JSON Snapshot + Dossier backups/) ──
const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');

function ensureBackupsDir(): void {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

function resolveBackupFilePath(rawName: string): string | null {
  const clean = path.basename(String(rawName || '').trim());
  if (!clean || !/^[a-zA-Z0-9_.-]+\.json$/.test(clean) || clean.includes('..')) {
    return null;
  }
  const resolved = path.resolve(BACKUPS_DIR, clean);
  if (!resolved.startsWith(BACKUPS_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

function makeBackupFilename(prefix = 'sauvegarde', label?: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const cleanLabel = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return cleanLabel ? `${prefix}_${stamp}_${cleanLabel}.json` : `${prefix}_${stamp}.json`;
}

bureauExtrasRouter.get(
  '/systeme/sauvegardes',
  checkPage('profils'),
  (req: AdminReq, res) => {
    if (req.adminUser?.role !== 'admin') {
      res.status(403).json({ detail: 'Réservé aux administrateurs.' });
      return;
    }
    ensureBackupsDir();
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => /^[a-zA-Z0-9_.-]+\.json$/.test(f))
      .map((filename) => {
        const full = resolveBackupFilePath(filename);
        if (!full) return null;
        try {
          const stat = fs.statSync(full);
          if (!stat.isFile()) return null;
          let createdAt = stat.mtime.toISOString();
          let createdBy = 'Système';
          let stats: BackupSnapshot['stats'] | null = null;
          if (stat.size <= 30 * 1024 * 1024) {
            const parsed = JSON.parse(fs.readFileSync(full, 'utf8')) as Partial<BackupSnapshot>;
            if (parsed.format === 'gestion-stock-backup') {
              if (parsed.created_at) createdAt = parsed.created_at;
              if (parsed.created_by) createdBy = parsed.created_by;
              if (parsed.stats) stats = parsed.stats;
            }
          }
          return {
            filename,
            size_bytes: stat.size,
            created_at: createdAt,
            created_by: createdBy,
            stats,
          };
        } catch {
          return null;
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json({
      postgres_actif: isPostgresActive(),
      dossier: 'backups/',
      sauvegardes: files,
    });
  }
);

bureauExtrasRouter.post(
  '/systeme/sauvegardes/creer',
  checkPage('profils'),
  (req: AdminReq, res) => {
    if (req.adminUser?.role !== 'admin') {
      res.status(403).json({ detail: 'Réservé aux administrateurs.' });
      return;
    }
    ensureBackupsDir();
    const label = typeof req.body?.label === 'string' ? req.body.label : undefined;
    const filename = makeBackupFilename('sauvegarde', label);
    const fullPath = resolveBackupFilePath(filename);
    if (!fullPath) {
      res.status(400).json({ detail: 'Nom de fichier invalide.' });
      return;
    }
    const snapshot = store.exportBackupSnapshot(req.adminUser.nom_complet);
    const content = JSON.stringify(snapshot, null, 2);
    fs.writeFileSync(fullPath, content, 'utf8');
    const stat = fs.statSync(fullPath);

    ajouterAudit({
      action: 'CREATION_SAUVEGARDE',
      utilisateur: req.adminUser.nom_complet,
      cible_type: 'system',
      details: `${filename} (${Math.round(stat.size / 1024)} Ko)`,
    });

    res.json({
      ok: true,
      filename,
      size_bytes: stat.size,
      created_at: snapshot.created_at,
      created_by: snapshot.created_by,
      stats: snapshot.stats,
    });
  }
);

bureauExtrasRouter.get(
  '/systeme/sauvegardes/telecharger',
  checkPage('profils'),
  (req: AdminReq, res) => {
    if (req.adminUser?.role !== 'admin') {
      res.status(403).json({ detail: 'Réservé aux administrateurs.' });
      return;
    }
    const fileParam = typeof req.query.file === 'string' ? req.query.file.trim() : '';
    if (fileParam) {
      const fullPath = resolveBackupFilePath(fileParam);
      if (!fullPath || !fs.existsSync(fullPath)) {
        res.status(404).json({ detail: 'Fichier de sauvegarde introuvable.' });
        return;
      }
      const cleanName = path.basename(fullPath);
      ajouterAudit({
        action: 'TELECHARGEMENT_SAUVEGARDE',
        utilisateur: req.adminUser.nom_complet,
        cible_type: 'system',
        details: cleanName,
      });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanName}"`);
      res.send(fs.readFileSync(fullPath, 'utf8'));
      return;
    }

    const filename = makeBackupFilename('sauvegarde_gestion_stock');
    const snapshot = store.exportBackupSnapshot(req.adminUser.nom_complet);
    ajouterAudit({
      action: 'TELECHARGEMENT_SAUVEGARDE',
      utilisateur: req.adminUser.nom_complet,
      cible_type: 'system',
      details: `${filename} (export direct)`,
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(snapshot, null, 2));
  }
);

bureauExtrasRouter.delete(
  '/systeme/sauvegardes/:filename',
  checkPage('profils'),
  (req: AdminReq, res) => {
    if (req.adminUser?.role !== 'admin') {
      res.status(403).json({ detail: 'Réservé aux administrateurs.' });
      return;
    }
    const fullPath = resolveBackupFilePath(String(req.params.filename || ''));
    if (!fullPath || !fs.existsSync(fullPath)) {
      res.status(404).json({ detail: 'Fichier de sauvegarde introuvable.' });
      return;
    }
    const cleanName = path.basename(fullPath);
    fs.unlinkSync(fullPath);
    ajouterAudit({
      action: 'SUPPRESSION_SAUVEGARDE',
      utilisateur: req.adminUser.nom_complet,
      cible_type: 'system',
      details: cleanName,
    });
    res.json({ ok: true });
  }
);

bureauExtrasRouter.post(
  '/systeme/restaurer',
  checkPage('profils'),
  async (req: AdminReq, res) => {
    if (req.adminUser?.role !== 'admin') {
      res.status(403).json({ detail: 'Réservé aux administrateurs.' });
      return;
    }
    const pwd = String(req.body?.password || '');
    if (!verifyPassword(pwd, req.adminUser.password_hash)) {
      res.status(401).json({ detail: 'Mot de passe administrateur incorrect.' });
      return;
    }

    let snapshotPayload: unknown = req.body?.backup;
    const filename = typeof req.body?.filename === 'string' ? req.body.filename.trim() : '';

    if (filename) {
      const fullPath = resolveBackupFilePath(filename);
      if (!fullPath || !fs.existsSync(fullPath)) {
        res.status(404).json({ detail: 'Fichier de sauvegarde introuvable sur le serveur.' });
        return;
      }
      try {
        snapshotPayload = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      } catch {
        res.status(400).json({ detail: 'Le fichier sélectionné contient du JSON invalide.' });
        return;
      }
    }

    if (!snapshotPayload) {
      res.status(400).json({ detail: 'Aucune donnée de sauvegarde fournie.' });
      return;
    }

    // Sauvegarde de sécurité automatique avant d'écraser les données actives
    ensureBackupsDir();
    const safetyName = makeBackupFilename('auto_avant_restauration');
    const safetyPath = resolveBackupFilePath(safetyName);
    const currentSnapshot = store.exportBackupSnapshot(req.adminUser.nom_complet);

    try {
      store.restoreBackupSnapshot(snapshotPayload, req.adminUser.nom_complet);
      if (safetyPath) {
        fs.writeFileSync(safetyPath, JSON.stringify(currentSnapshot, null, 2), 'utf8');
      }
      if (isPostgresActive()) {
        await forceSyncPostgres();
      }
    } catch (err) {
      res.status(400).json({
        detail: err instanceof Error ? err.message : 'Erreur lors de la restauration de la sauvegarde.',
      });
      return;
    }

    res.json({
      ok: true,
      safety_backup: safetyName,
      stats: {
        produits: store.produits.filter((p) => p.supprime === 0).length,
        clients: store.clients.length,
        fournisseurs: store.fournisseurs.length,
        bons_vente: store.bons_vente.length,
        bons_achat: store.bons_achat.length,
        factures: store.factures.length,
      },
    });
  }
);

bureauExtrasRouter.put(
  '/utilisateurs/:id',
  checkPage('utilisateurs'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'gerer_utilisateurs')) {
      res.status(403).json({ detail: 'Réservé aux administrateurs.' });
      return;
    }
    const u = store.utilisateurs.find((x) => x.id === Number(req.params.id));
    if (!u) {
      res.status(404).json({ detail: 'Utilisateur introuvable.' });
      return;
    }
    const b = req.body || {};
    if (b.nom_complet !== undefined && String(b.nom_complet).trim()) {
      u.nom_complet = String(b.nom_complet).trim();
    }
    if (b.role !== undefined && b.role in ROLES) {
      u.role = b.role;
    }
    if (b.actif !== undefined) {
      if (u.username === 'admin' && Number(b.actif) === 0) {
        res.status(400).json({ detail: 'Impossible de désactiver le compte admin principal.' });
        return;
      }
      u.actif = Number(b.actif) ? 1 : 0;
    }
    ajouterAudit({
      action: 'MODIFICATION_UTILISATEUR',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'utilisateur',
      cible_id: u.id,
      details: `${u.username} -> ${ROLES[u.role]} (${u.actif ? 'Actif' : 'Désactivé'})`,
    });
    const { password_hash: _ph, ...safe } = u;
    res.json({ ...safe, role_libelle: ROLES[u.role] });
  }
);

bureauExtrasRouter.post(
  '/utilisateurs/:id/reset-password',
  checkPage('utilisateurs'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'gerer_utilisateurs')) {
      res.status(403).json({ detail: 'Réservé aux administrateurs.' });
      return;
    }
    const u = store.utilisateurs.find((x) => x.id === Number(req.params.id));
    if (!u) {
      res.status(404).json({ detail: 'Utilisateur introuvable.' });
      return;
    }
    const np = String(req.body?.password || '');
    if (np.length < 6) {
      res.status(400).json({ detail: 'Mot de passe min 6 caractères requis.' });
      return;
    }
    u.password_hash = hashPassword(np);
    ajouterAudit({
      action: 'RESET_MDP_UTILISATEUR',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'utilisateur',
      cible_id: u.id,
      details: u.username,
    });
    res.json({ ok: true });
  }
);

// ── Profil document résolu (accessible à tout utilisateur bureau) ──
bureauExtrasRouter.get(
  '/profil-document/:docType',
  (req: AdminReq, res) => {
    const docType = String(req.params.docType || 'devis') as
      | 'facture'
      | 'bon_livraison'
      | 'devis'
      | 'situation';
    const validTypes = ['facture', 'bon_livraison', 'devis', 'situation'];
    if (!validTypes.includes(docType)) {
      res.status(400).json({ detail: 'Type de document invalide.' });
      return;
    }
    const targetId = store.document_profils?.[docType];
    const profil =
      store.profils_entreprise.find((p) => p.id === targetId && p.actif !== 0) ||
      store.profils_entreprise.find((p) => p.id === targetId) ||
      store.profils_entreprise.find((p) => p.est_defaut === 1 && p.actif !== 0) ||
      store.profils_entreprise[0] ||
      null;
    res.json({ document_type: docType, profil });
  }
);

// ── Devis / Factures Proforma ──
const STATUTS_DEVIS_EDITABLES: StatutDevis[] = [
  'Brouillon',
  'Envoyé',
  'Accepté',
  'Refusé',
];

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function enrichDevis(dv: Devis) {
  const client = store.clients.find((c) => c.id === dv.client_id);
  const vendeur = dv.vendeur_id
    ? store.vendeurs.find((v) => v.id === dv.vendeur_id)
    : null;
  const bon = dv.bon_vente_id
    ? store.bons_vente.find((b) => b.id === dv.bon_vente_id)
    : null;
  return {
    ...dv,
    client_nom: client?.nom || 'Client',
    client_code: client?.code || '',
    client_adresse: client?.adresse || '',
    client_tel: client?.tel || '',
    client_email: client?.email || '',
    client_nif: client?.nif || '',
    client_nis: client?.nis || '',
    client_nrc: client?.nrc || '',
    vendeur_nom: vendeur?.nom || null,
    bon_vente_numero: bon?.numero || null,
  };
}

function buildDevisLignesEtTotaux(
  clientId: number,
  lignesIn: any[],
  remiseTypeIn: string | undefined,
  remiseValIn: number | undefined,
  remiseFixeIn: number | undefined,
  devisId: number
):
  | {
      errorStatus: number;
      errorDetail: string;
    }
  | {
      lignes: LigneDevis[];
      total_ht: number;
      tva_total: number;
      total_ttc: number;
      remise_type: 'aucune' | 'montant' | 'pourcentage';
      remise_valeur: number;
      remise_montant: number;
      remise: number;
    } {
  if (!Array.isArray(lignesIn) || lignesIn.length === 0) {
    return {
      errorStatus: 400,
      errorDetail: 'Ajoutez au moins une ligne au devis.',
    };
  }

  const lignes: LigneDevis[] = [];
  let sumHT = 0;
  let sumTVA = 0;
  let brutTTC = 0;

  for (const l of lignesIn) {
    const prod = store.produits.find((p) => p.id === Number(l.produit_id));
    if (!prod) {
      return {
        errorStatus: 404,
        errorDetail: `Produit #${l.produit_id} introuvable.`,
      };
    }
    const qte = Number(l.quantite || 0);
    if (qte <= 0) {
      return {
        errorStatus: 400,
        errorDetail: `Quantité invalide pour ${prod.designation}.`,
      };
    }
    const resolved = resoudrePrix(prod.id, {
      clientId,
      quantite: qte,
      niveau: l.niveau_prix,
    });
    const pu =
      Number(l.prix_unitaire || 0) > 0
        ? Number(l.prix_unitaire)
        : resolved.prix;
    const lineRemise = Math.max(0, Number(l.remise || 0));
    const tot = Math.max(0, Number((qte * pu - lineRemise).toFixed(2)));
    const tvaTaux =
      l.tva_taux !== undefined && l.tva_taux !== null
        ? Number(l.tva_taux)
        : prod.tva || 0;
    const ht = Number((tot / (1 + tvaTaux / 100)).toFixed(2));
    const tva = Number((tot - ht).toFixed(2));

    sumHT += ht;
    sumTVA += tva;
    brutTTC += tot;

    lignes.push({
      id: store.nextId('lignes_devis'),
      devis_id: devisId,
      produit_id: prod.id,
      designation: prod.designation,
      quantite: qte,
      prix_unitaire: Number(pu.toFixed(2)),
      remise: lineRemise,
      niveau_prix: l.niveau_prix || resolved.niveau,
      total: tot,
      total_ht: ht,
      tva_taux: tvaTaux,
      total_tva: tva,
      total_ttc: tot,
    });
  }

  let remiseType: 'aucune' | 'montant' | 'pourcentage' =
    remiseTypeIn === 'pourcentage' || remiseTypeIn === 'montant'
      ? remiseTypeIn
      : 'aucune';
  let remiseVal = Math.max(0, Number(remiseValIn || 0));

  if (
    remiseType === 'aucune' &&
    remiseFixeIn !== undefined &&
    Number(remiseFixeIn) > 0
  ) {
    remiseType = 'montant';
    remiseVal = Number(remiseFixeIn);
  }

  const remiseMontant =
    remiseType === 'pourcentage'
      ? Number(((brutTTC * Math.min(100, remiseVal)) / 100).toFixed(2))
      : remiseType === 'montant'
      ? Number(Math.min(brutTTC, remiseVal).toFixed(2))
      : 0;
  const totalTTC = Math.max(0, Number((brutTTC - remiseMontant).toFixed(2)));
  const ratio = brutTTC > 0 ? totalTTC / brutTTC : 1;

  return {
    lignes,
    total_ht: Number((sumHT * ratio).toFixed(2)),
    tva_total: Number((sumTVA * ratio).toFixed(2)),
    total_ttc: totalTTC,
    remise_type: remiseType,
    remise_valeur: remiseVal,
    remise_montant: remiseMontant,
    remise: remiseMontant,
  };
}

bureauExtrasRouter.get('/devis', checkPage('devis'), (req, res) => {
  const statutFilter = String(req.query.statut || '').trim();
  const clientFilter = req.query.client_id ? Number(req.query.client_id) : 0;
  const rows = store.devis
    .filter((d) => (!statutFilter ? true : d.statut === statutFilter))
    .filter((d) => (!clientFilter ? true : d.client_id === clientFilter))
    .map(enrichDevis)
    .sort((a, b) => b.id - a.id);
  res.json(rows);
});

bureauExtrasRouter.post('/devis', checkPage('devis'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const b = req.body || {};
  const clientId = Number(b.client_id || 0);
  const client = store.clients.find((c) => c.id === clientId);
  if (!client) {
    res.status(404).json({ detail: 'Client introuvable.' });
    return;
  }

  const vendeurId =
    b.vendeur_id !== undefined && b.vendeur_id !== null && b.vendeur_id !== ''
      ? Number(b.vendeur_id)
      : null;
  if (vendeurId !== null && !store.vendeurs.some((v) => v.id === vendeurId)) {
    res.status(404).json({ detail: 'Vendeur introuvable.' });
    return;
  }

  const statutReq = (b.statut || 'Brouillon') as StatutDevis;
  if (!STATUTS_DEVIS_EDITABLES.includes(statutReq)) {
    res.status(400).json({ detail: 'Statut de devis invalide.' });
    return;
  }

  const dateDevis = String(
    b.date_devis || new Date().toISOString().slice(0, 10)
  );
  const dateValidite = b.date_validite
    ? String(b.date_validite)
    : addDaysIso(dateDevis, 15);
  const devisId = store.nextId('devis');
  const numero = prochainNumero(
    store.devis.map((x) => x.numero),
    `DEV-${dateDevis.replace(/-/g, '')}-`
  );

  const built = buildDevisLignesEtTotaux(
    clientId,
    b.lignes,
    b.remise_type,
    b.remise_valeur,
    b.remise,
    devisId
  );
  if ('errorDetail' in built) {
    res.status(built.errorStatus).json({ detail: built.errorDetail });
    return;
  }

  const devis: Devis = {
    id: devisId,
    numero,
    date_devis: dateDevis,
    date_validite: dateValidite,
    client_id: client.id,
    vendeur_id: vendeurId,
    total_ht: built.total_ht,
    tva_total: built.tva_total,
    total_ttc: built.total_ttc,
    remise_type: built.remise_type,
    remise_valeur: built.remise_valeur,
    remise_montant: built.remise_montant,
    remise_motif: b.remise_motif ? String(b.remise_motif) : null,
    remise: built.remise,
    statut: statutReq,
    observations: b.observations ? String(b.observations) : null,
    bon_vente_id: null,
    lignes: built.lignes,
  };
  store.devis.push(devis);

  ajouterAudit({
    action: 'CREATION_DEVIS',
    utilisateur: req.adminUser!.nom_complet,
    cible_type: 'devis',
    cible_id: devis.id,
    details: `${devis.numero} · ${client.nom} · ${devis.total_ttc.toFixed(2)} DA`,
  });

  res.status(201).json(enrichDevis(devis));
});

bureauExtrasRouter.put('/devis/:id', checkPage('devis'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const dv = store.devis.find((d) => d.id === Number(req.params.id));
  if (!dv) {
    res.status(404).json({ detail: 'Devis introuvable.' });
    return;
  }
  if (dv.statut === 'Converti' || dv.bon_vente_id != null) {
    res
      .status(400)
      .json({ detail: 'Un devis déjà converti ne peut plus être modifié.' });
    return;
  }

  const b = req.body || {};
  const clientId = Number(b.client_id ?? dv.client_id);
  const client = store.clients.find((c) => c.id === clientId);
  if (!client) {
    res.status(404).json({ detail: 'Client introuvable.' });
    return;
  }

  const vendeurId =
    b.vendeur_id !== undefined
      ? b.vendeur_id === null || b.vendeur_id === ''
        ? null
        : Number(b.vendeur_id)
      : dv.vendeur_id ?? null;
  if (vendeurId !== null && !store.vendeurs.some((v) => v.id === vendeurId)) {
    res.status(404).json({ detail: 'Vendeur introuvable.' });
    return;
  }

  const statutReq = (b.statut || dv.statut) as StatutDevis;
  if (!STATUTS_DEVIS_EDITABLES.includes(statutReq)) {
    res.status(400).json({ detail: 'Statut de devis invalide.' });
    return;
  }

  const built = buildDevisLignesEtTotaux(
    clientId,
    b.lignes !== undefined ? b.lignes : dv.lignes,
    b.remise_type !== undefined ? b.remise_type : dv.remise_type,
    b.remise_valeur !== undefined ? b.remise_valeur : dv.remise_valeur,
    b.remise !== undefined ? b.remise : undefined,
    dv.id
  );
  if ('errorDetail' in built) {
    res.status(built.errorStatus).json({ detail: built.errorDetail });
    return;
  }

  dv.date_devis = b.date_devis ? String(b.date_devis) : dv.date_devis;
  dv.date_validite =
    b.date_validite !== undefined
      ? b.date_validite
        ? String(b.date_validite)
        : null
      : dv.date_validite;
  dv.client_id = client.id;
  dv.vendeur_id = vendeurId;
  dv.statut = statutReq;
  dv.observations =
    b.observations !== undefined
      ? b.observations
        ? String(b.observations)
        : null
      : dv.observations;
  dv.remise_motif =
    b.remise_motif !== undefined
      ? b.remise_motif
        ? String(b.remise_motif)
        : null
      : dv.remise_motif;
  dv.lignes = built.lignes;
  dv.total_ht = built.total_ht;
  dv.tva_total = built.tva_total;
  dv.total_ttc = built.total_ttc;
  dv.remise_type = built.remise_type;
  dv.remise_valeur = built.remise_valeur;
  dv.remise_montant = built.remise_montant;
  dv.remise = built.remise;

  ajouterAudit({
    action: 'MODIFICATION_DEVIS',
    utilisateur: req.adminUser!.nom_complet,
    cible_type: 'devis',
    cible_id: dv.id,
    details: `${dv.numero} · ${dv.statut} · ${dv.total_ttc.toFixed(2)} DA`,
  });

  res.json(enrichDevis(dv));
});

bureauExtrasRouter.patch(
  '/devis/:id/statut',
  checkPage('devis'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const dv = store.devis.find((d) => d.id === Number(req.params.id));
    if (!dv) {
      res.status(404).json({ detail: 'Devis introuvable.' });
      return;
    }
    if (dv.statut === 'Converti' || dv.bon_vente_id != null) {
      res
        .status(400)
        .json({ detail: 'Un devis déjà converti ne peut plus changer de statut.' });
      return;
    }
    const nextStatut = String(req.body?.statut || '') as StatutDevis;
    if (!STATUTS_DEVIS_EDITABLES.includes(nextStatut)) {
      res.status(400).json({ detail: 'Statut invalide.' });
      return;
    }
    const prev = dv.statut;
    dv.statut = nextStatut;
    ajouterAudit({
      action: 'STATUT_DEVIS',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'devis',
      cible_id: dv.id,
      details: `${dv.numero} : ${prev} -> ${nextStatut}`,
    });
    res.json(enrichDevis(dv));
  }
);

bureauExtrasRouter.delete(
  '/devis/:id',
  checkPage('devis'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const idx = store.devis.findIndex((d) => d.id === Number(req.params.id));
    if (idx === -1) {
      res.status(404).json({ detail: 'Devis introuvable.' });
      return;
    }
    const dv = store.devis[idx];
    if (dv.statut === 'Converti' || dv.bon_vente_id != null) {
      res.status(400).json({
        detail:
          'Impossible de supprimer un devis déjà converti en bon de vente.',
      });
      return;
    }
    store.devis.splice(idx, 1);
    ajouterAudit({
      action: 'SUPPRESSION_DEVIS',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'devis',
      cible_id: dv.id,
      details: `${dv.numero} (${dv.total_ttc.toFixed(2)} DA)`,
    });
    res.json({ ok: true });
  }
);

bureauExtrasRouter.post(
  '/devis/:id/convertir',
  checkPage('devis'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const dv = store.devis.find((d) => d.id === Number(req.params.id));
    if (!dv) {
      res.status(404).json({ detail: 'Devis introuvable.' });
      return;
    }
    if (dv.statut === 'Converti' || dv.bon_vente_id != null) {
      res.status(409).json({
        detail: 'Ce devis a déjà été converti en bon de vente.',
        bon_vente_id: dv.bon_vente_id,
      });
      return;
    }
    if (dv.statut === 'Refusé') {
      res.status(400).json({
        detail:
          'Un devis refusé ne peut pas être converti. Repassez-le en Brouillon/Accepté d’abord.',
      });
      return;
    }

    const client = store.clients.find((c) => c.id === dv.client_id);
    if (!client) {
      res.status(404).json({ detail: 'Client du devis introuvable.' });
      return;
    }
    if (!dv.lignes || dv.lignes.length === 0) {
      res.status(400).json({ detail: 'Le devis ne contient aucune ligne.' });
      return;
    }

    // Valider l'existence de tous les produits avant de muter le stock
    for (const l of dv.lignes) {
      const prod = store.produits.find((p) => p.id === l.produit_id);
      if (!prod) {
        res.status(404).json({
          detail: `Produit #${l.produit_id} (${l.designation}) introuvable.`,
        });
        return;
      }
      if (l.quantite <= 0) {
        res
          .status(400)
          .json({ detail: `Quantité invalide pour ${prod.designation}.` });
        return;
      }
    }

    const b = req.body || {};
    const totalTTC = Number(dv.total_ttc.toFixed(2));
    const montantVerse = Math.min(
      totalTTC,
      Math.max(0, Number(b.montant_verse || 0))
    );
    const reste = Number((totalTTC - montantVerse).toFixed(2));

    const creditCheck = verifierPlafondCredit(client, reste, {
      forcerAdmin: Boolean(b.forcer_plafond),
      role: req.adminUser?.role,
    });
    if (creditCheck.bloquant) {
      res.status(409).json({
        detail: creditCheck.avertissement,
        code: 'PLAFOND_CREDIT_DEPASSE',
        credit_info: creditCheck,
      });
      return;
    }

    const today = String(b.date_bon || new Date().toISOString().slice(0, 10));
    const bonId = store.nextId('bons_vente');
    const numeroBon = prochainNumero(
      store.bons_vente.map((x) => x.numero),
      `BV-${today.replace(/-/g, '')}-`
    );

    const lignesBon: LigneVente[] = [];
    for (const l of dv.lignes) {
      const prod = store.produits.find((p) => p.id === l.produit_id)!;
      const avant = prod.stock_actuel;
      prod.stock_actuel = Math.max(0, Number((avant - l.quantite).toFixed(4)));
      enregistrerMouvementStock({
        produit_id: prod.id,
        type_mouvement: 'VENTE',
        stock_avant: avant,
        stock_apres: prod.stock_actuel,
        cout_unitaire: prod.prix_moyen_pondere || prod.prix_achat,
        pmp_apres: prod.prix_moyen_pondere,
        document_type: 'bon_vente',
        document_id: bonId,
        document_numero: numeroBon,
        tiers_nom: client.nom,
        date_document: today,
        utilisateur: req.adminUser!.nom_complet,
      });

      lignesBon.push({
        id: store.nextId('lignes_vente'),
        bon_id: bonId,
        produit_id: prod.id,
        designation: l.designation || prod.designation,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        remise: l.remise || 0,
        niveau_prix: l.niveau_prix,
        total: l.total,
        total_ht: l.total_ht,
        tva_taux: l.tva_taux,
        total_tva: l.total_tva,
        total_ttc: l.total_ttc,
      });
    }

    if (client.code !== 'CLT-COMPTOIR') {
      client.solde = Number((client.solde + reste).toFixed(2));
    }

    if (montantVerse > 0) {
      store.versements_clients.push({
        id: store.nextId('versements_clients'),
        numero: prochainNumero(
          store.versements_clients.map((v) => v.numero),
          `VC-${today.replace(/-/g, '')}-`
        ),
        date_vers: today,
        client_id: client.id,
        vendeur_id: dv.vendeur_id ?? null,
        montant: montantVerse,
        mode: String(b.mode_reglement || 'Espèces'),
        reference: numeroBon,
        observations: `Règlement à la conversion du devis ${dv.numero}`,
      });
    }

    const bon: BonVente = {
      id: bonId,
      numero: numeroBon,
      date_bon: today,
      client_id: client.id,
      vendeur_id: dv.vendeur_id ?? null,
      total: totalTTC,
      total_ht: Number(dv.total_ht.toFixed(2)),
      tva_total: Number(dv.tva_total.toFixed(2)),
      total_ttc: totalTTC,
      remise_type: dv.remise_type || 'aucune',
      remise_valeur: dv.remise_valeur || 0,
      remise_montant: dv.remise_montant ?? dv.remise ?? 0,
      remise_motif: dv.remise_motif || null,
      montant_verse: montantVerse,
      reste_payer: reste,
      statut: 'Validé',
      date_echeance: b.date_echeance ? String(b.date_echeance) : null,
      observations: dv.observations
        ? `${dv.observations} (Converti depuis ${dv.numero})`
        : `Converti depuis devis ${dv.numero}`,
      lignes: lignesBon,
    };
    store.bons_vente.push(bon);

    dv.statut = 'Converti';
    dv.bon_vente_id = bon.id;

    ajouterAudit({
      action: creditCheck.force_applique
        ? 'FORCAGE_PLAFOND_CREDIT'
        : 'CONVERSION_DEVIS',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'devis',
      cible_id: dv.id,
      details: `${dv.numero} -> ${bon.numero} (${client.nom}, ${totalTTC.toFixed(2)} DA, versé ${montantVerse.toFixed(2)} DA)${
        creditCheck.avertissement ? ` · ${creditCheck.avertissement}` : ''
      }`,
    });

    res.status(201).json({
      ok: true,
      devis: enrichDevis(dv),
      bon_vente: bon,
      credit_warning: creditCheck.avertissement,
      credit_info: creditCheck,
    });
  }
);

// ══════════════════════════════════════════════════════════════
// ÉCHÉANCIER & RELANCES CLIENTS
// ══════════════════════════════════════════════════════════════
function diffDaysIso(fromDateStr: string, toDateStr: string): number {
  const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec((fromDateStr || '').slice(0, 10));
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec((toDateStr || '').slice(0, 10));
  if (!m1 || !m2) return 0;
  const t1 = Date.UTC(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]));
  const t2 = Date.UTC(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  return Math.round((t2 - t1) / 86400000);
}

function checkEcheancierAccess(
  req: AdminReq,
  res: Response,
  next: express.NextFunction
) {
  const role = req.adminUser?.role;
  if (!peutVoirPage(role, 'echeancier') && !peutVoirPage(role, 'factures')) {
    res
      .status(403)
      .json({ detail: 'Accès refusé à cette section pour votre rôle.' });
    return;
  }
  next();
}

type NiveauRetard = 'en_retard' | 'proche' | 'a_venir';

interface EcheancierItem {
  uid: string;
  doc_type: 'facture' | 'bon_vente';
  doc_id: number;
  numero: string;
  bon_numero: string | null;
  facture_numero: string | null;
  date_emission: string;
  date_echeance: string;
  echeance_source: 'facture' | 'bon' | 'defaut_30j';
  jours_retard: number;
  jours_restants: number;
  niveau_retard: NiveauRetard;
  total_ttc: number;
  montant_verse: number;
  reste_payer: number;
  statut: string;
  client_id: number;
  client_code: string;
  client_nom: string;
  client_tel: string;
  client_email: string;
  vendeur_id: number | null;
  vendeur_nom: string | null;
  nb_relances: number;
  derniere_relance: { date_action: string; utilisateur: string; details: string | null } | null;
}

function buildEcheancierItems(): EcheancierItem[] {
  const today = new Date().toISOString().slice(0, 10);

  // Réconcilier en FIFO les règlements clients non affectés directement à un bon
  const bonResteMap = new Map<number, number>();
  for (const client of store.clients) {
    if (client.code === 'CLT-COMPTOIR') continue;
    const bonsClient = store.bons_vente
      .filter(
        (b) =>
          b.client_id === client.id &&
          !b.prospect_id &&
          b.statut !== 'Annulé' &&
          Number(b.reste_payer || 0) > 0
      )
      .sort((a, b) => a.date_bon.localeCompare(b.date_bon) || a.id - b.id);
    const sumBonsReste = bonsClient.reduce(
      (acc, b) => acc + Number(b.reste_payer || 0),
      0
    );
    let surplusRegle = Math.max(
      0,
      Number((sumBonsReste - Math.max(0, Number(client.solde || 0))).toFixed(2))
    );
    for (const b of bonsClient) {
      const brut = Number(b.reste_payer || 0);
      const absorbe = Math.min(brut, surplusRegle);
      surplusRegle = Number((surplusRegle - absorbe).toFixed(2));
      bonResteMap.set(b.id, Math.max(0, Number((brut - absorbe).toFixed(2))));
    }
  }

  const relancesByDoc = new Map<
    string,
    { count: number; latest: { date_action: string; utilisateur: string; details: string | null } }
  >();
  for (const a of store.journal_audit) {
    if (a.action === 'RELANCE_CLIENT' && a.cible_type && a.cible_id != null) {
      const k = `${a.cible_type}:${a.cible_id}`;
      const cur = relancesByDoc.get(k);
      if (!cur) {
        relancesByDoc.set(k, {
          count: 1,
          latest: {
            date_action: a.date_action,
            utilisateur: a.utilisateur,
            details: a.details ?? null,
          },
        });
      } else {
        cur.count += 1;
        if (a.id >= 0 && a.date_action >= cur.latest.date_action) {
          cur.latest = {
            date_action: a.date_action,
            utilisateur: a.utilisateur,
            details: a.details ?? null,
          };
        }
      }
    }
  }

  const items: EcheancierItem[] = [];
  const linkedBonIds = new Set<number>();

  // 1. Factures non soldées
  for (const fac of store.factures) {
    if (fac.statut === 'Annulée') continue;
    const bon = store.bons_vente.find((b) => b.id === fac.bon_vente_id);
    if (bon) {
      linkedBonIds.add(bon.id);
      if (bon.statut === 'Annulé') continue;
    }
    if (fac.statut === 'Payée') continue;

    const client = store.clients.find((c) => c.id === fac.client_id);
    if (!client || client.code === 'CLT-COMPTOIR') continue;

    const totalTtc = Number((bon ? bon.total_ttc || bon.total : fac.total_ttc).toFixed(2));
    const restePayer = bon
      ? (bonResteMap.get(bon.id) ?? Number(bon.reste_payer || 0))
      : Number(fac.total_ttc || 0);
    if (restePayer <= 0.005) continue;

    const montantVerse = Math.max(0, Number((totalTtc - restePayer).toFixed(2)));
    const dateEcheance = fac.date_echeance
      ? fac.date_echeance.slice(0, 10)
      : bon?.date_echeance
        ? bon.date_echeance.slice(0, 10)
        : addDaysIso(fac.date_facture, 30);
    const echeanceSource = fac.date_echeance
      ? 'facture'
      : bon?.date_echeance
        ? 'bon'
        : 'defaut_30j';
    const joursRetard = diffDaysIso(dateEcheance, today);
    const niveauRetard: NiveauRetard =
      joursRetard > 0 ? 'en_retard' : joursRetard >= -7 ? 'proche' : 'a_venir';
    const vendeurId = bon?.vendeur_id ?? client.vendeur_id ?? null;
    const vendeur = vendeurId
      ? store.vendeurs.find((v) => v.id === vendeurId)
      : null;
    const rel = relancesByDoc.get(`facture:${fac.id}`);

    items.push({
      uid: `facture-${fac.id}`,
      doc_type: 'facture',
      doc_id: fac.id,
      numero: fac.numero,
      bon_numero: bon?.numero || null,
      facture_numero: fac.numero,
      date_emission: fac.date_facture,
      date_echeance: dateEcheance,
      echeance_source: echeanceSource,
      jours_retard: joursRetard,
      jours_restants: -joursRetard,
      niveau_retard: niveauRetard,
      total_ttc: totalTtc,
      montant_verse: montantVerse,
      reste_payer: restePayer,
      statut: fac.statut,
      client_id: client.id,
      client_code: client.code,
      client_nom: client.nom,
      client_tel: client.tel || '',
      client_email: client.email || '',
      vendeur_id: vendeurId,
      vendeur_nom: vendeur?.nom || null,
      nb_relances: rel?.count || 0,
      derniere_relance: rel?.latest || null,
    });
  }

  // 2. Bons de vente non soldés sans facture active
  for (const bon of store.bons_vente) {
    if (linkedBonIds.has(bon.id)) continue;
    if (bon.statut === 'Annulé' || bon.prospect_id) continue;
    const client = store.clients.find((c) => c.id === bon.client_id);
    if (!client || client.code === 'CLT-COMPTOIR') continue;

    const totalTtc = Number((bon.total_ttc || bon.total).toFixed(2));
    const restePayer = bonResteMap.get(bon.id) ?? Number(bon.reste_payer || 0);
    if (restePayer <= 0.005) continue;

    const montantVerse = Math.max(0, Number((totalTtc - restePayer).toFixed(2)));
    const dateEcheance = bon.date_echeance
      ? bon.date_echeance.slice(0, 10)
      : addDaysIso(bon.date_bon, 30);
    const echeanceSource = bon.date_echeance ? 'bon' : 'defaut_30j';
    const joursRetard = diffDaysIso(dateEcheance, today);
    const niveauRetard: NiveauRetard =
      joursRetard > 0 ? 'en_retard' : joursRetard >= -7 ? 'proche' : 'a_venir';
    const vendeurId = bon.vendeur_id ?? client.vendeur_id ?? null;
    const vendeur = vendeurId
      ? store.vendeurs.find((v) => v.id === vendeurId)
      : null;
    const rel = relancesByDoc.get(`bon_vente:${bon.id}`);

    items.push({
      uid: `bon_vente-${bon.id}`,
      doc_type: 'bon_vente',
      doc_id: bon.id,
      numero: bon.numero,
      bon_numero: bon.numero,
      facture_numero: null,
      date_emission: bon.date_bon,
      date_echeance: dateEcheance,
      echeance_source: echeanceSource,
      jours_retard: joursRetard,
      jours_restants: -joursRetard,
      niveau_retard: niveauRetard,
      total_ttc: totalTtc,
      montant_verse: montantVerse,
      reste_payer: restePayer,
      statut: bon.statut,
      client_id: client.id,
      client_code: client.code,
      client_nom: client.nom,
      client_tel: client.tel || '',
      client_email: client.email || '',
      vendeur_id: vendeurId,
      vendeur_nom: vendeur?.nom || null,
      nb_relances: rel?.count || 0,
      derniere_relance: rel?.latest || null,
    });
  }

  items.sort(
    (a, b) =>
      a.date_echeance.localeCompare(b.date_echeance) ||
      b.jours_retard - a.jours_retard ||
      b.reste_payer - a.reste_payer
  );
  return items;
}

function summarizeEcheancierKpis(items: EcheancierItem[]) {
  const enRetard = items.filter((i) => i.niveau_retard === 'en_retard');
  const proches = items.filter((i) => i.niveau_retard === 'proche');
  const aVenir = items.filter((i) => i.niveau_retard === 'a_venir');
  return {
    total_creances: Number(
      items.reduce((acc, i) => acc + i.reste_payer, 0).toFixed(2)
    ),
    montant_en_retard: Number(
      enRetard.reduce((acc, i) => acc + i.reste_payer, 0).toFixed(2)
    ),
    nb_clients_en_retard: new Set(enRetard.map((i) => i.client_id)).size,
    montant_proche_7j: Number(
      proches.reduce((acc, i) => acc + i.reste_payer, 0).toFixed(2)
    ),
    nb_documents: items.length,
    nb_en_retard: enRetard.length,
    nb_proche_7j: proches.length,
    nb_a_venir: aVenir.length,
  };
}

bureauExtrasRouter.get(
  '/echeancier',
  checkEcheancierAccess,
  (req: AdminReq, res) => {
    const allItems = buildEcheancierItems();
    const clientId = req.query.client_id ? Number(req.query.client_id) : 0;
    const vendeurId = req.query.vendeur_id ? Number(req.query.vendeur_id) : 0;
    const niveau = String(req.query.niveau_retard || '').trim();
    const q = String(req.query.q || '').trim().toLowerCase();

    const filtered = allItems.filter((item) => {
      if (clientId && item.client_id !== clientId) return false;
      if (vendeurId && item.vendeur_id !== vendeurId) return false;
      if (
        niveau &&
        niveau !== 'tous' &&
        item.niveau_retard !== niveau
      ) {
        return false;
      }
      if (
        q &&
        !item.numero.toLowerCase().includes(q) &&
        !(item.bon_numero || '').toLowerCase().includes(q) &&
        !item.client_nom.toLowerCase().includes(q) &&
        !item.client_code.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    const profilFac =
      store.profils_entreprise.find((p) => p.id === store.document_profils.facture) ||
      store.profils_entreprise.find((p) => p.est_defaut === 1) ||
      store.profils_entreprise[0] ||
      null;

    res.json({
      items: filtered,
      kpis: summarizeEcheancierKpis(filtered),
      kpis_globaux: summarizeEcheancierKpis(allItems),
      referentiels: {
        clients: store.clients
          .filter((c) => c.code !== 'CLT-COMPTOIR')
          .map((c) => ({
            id: c.id,
            code: c.code,
            nom: c.nom,
            tel: c.tel || '',
            email: c.email || '',
          })),
        vendeurs: store.vendeurs.map((v) => ({
          id: v.id,
          code: v.code,
          nom: v.nom,
        })),
        profil_nom: profilFac?.nom || 'Notre Société',
        profil_tel: profilFac?.telephone || '',
        profil_email: profilFac?.email || '',
      },
    });
  }
);

bureauExtrasRouter.patch(
  '/echeancier/:docType/:id/echeance',
  checkEcheancierAccess,
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const docType = String(req.params.docType);
    const id = Number(req.params.id);
    const dateEch = String(req.body?.date_echeance || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEch)) {
      res.status(400).json({ detail: "Format de date d'échéance invalide (AAAA-MM-JJ)." });
      return;
    }
    if (docType === 'facture') {
      const fac = store.factures.find((f) => f.id === id);
      if (!fac) {
        res.status(404).json({ detail: 'Facture introuvable.' });
        return;
      }
      fac.date_echeance = dateEch;
      ajouterAudit({
        action: 'MAJ_ECHEANCE',
        utilisateur: req.adminUser!.nom_complet,
        cible_type: 'facture',
        cible_id: fac.id,
        details: `${fac.numero} -> nouvelle échéance ${dateEch}`,
      });
      res.json({ ok: true, date_echeance: dateEch });
      return;
    }
    if (docType === 'bon_vente') {
      const bon = store.bons_vente.find((b) => b.id === id);
      if (!bon) {
        res.status(404).json({ detail: 'Bon de vente introuvable.' });
        return;
      }
      bon.date_echeance = dateEch;
      ajouterAudit({
        action: 'MAJ_ECHEANCE',
        utilisateur: req.adminUser!.nom_complet,
        cible_type: 'bon_vente',
        cible_id: bon.id,
        details: `${bon.numero} -> nouvelle échéance ${dateEch}`,
      });
      res.json({ ok: true, date_echeance: dateEch });
      return;
    }
    res.status(400).json({ detail: 'Type de document invalide.' });
  }
);

bureauExtrasRouter.post(
  '/echeancier/relance',
  checkEcheancierAccess,
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const b = req.body || {};
    const docType = String(b.doc_type || '');
    const docId = Number(b.doc_id || 0);
    const canal = String(b.canal || 'whatsapp');
    const message = String(b.message || '').trim();
    const destinataire = String(b.destinataire || '').trim();
    const objet = String(b.objet || '').trim();

    if (docType !== 'facture' && docType !== 'bon_vente') {
      res.status(400).json({ detail: 'Type de document invalide.' });
      return;
    }
    if (!['whatsapp', 'email', 'copie'].includes(canal)) {
      res.status(400).json({ detail: 'Canal de relance invalide.' });
      return;
    }
    if (!message || message.length > 4000) {
      res.status(400).json({ detail: 'Le message de relance est obligatoire (max 4000 caractères).' });
      return;
    }

    const item = buildEcheancierItems().find(
      (i) => i.doc_type === docType && i.doc_id === docId
    );
    let docNumero = '';
    let clientNom = '';
    let restePayer = 0;
    let joursRetard = 0;

    if (item) {
      docNumero = item.numero;
      clientNom = item.client_nom;
      restePayer = item.reste_payer;
      joursRetard = item.jours_retard;
    } else if (docType === 'facture') {
      const fac = store.factures.find((f) => f.id === docId);
      if (!fac) {
        res.status(404).json({ detail: 'Facture introuvable.' });
        return;
      }
      const cl = store.clients.find((c) => c.id === fac.client_id);
      docNumero = fac.numero;
      clientNom = cl?.nom || 'Client';
      restePayer = fac.total_ttc;
    } else {
      const bon = store.bons_vente.find((x) => x.id === docId);
      if (!bon) {
        res.status(404).json({ detail: 'Bon de vente introuvable.' });
        return;
      }
      const cl = store.clients.find((c) => c.id === bon.client_id);
      docNumero = bon.numero;
      clientNom = cl?.nom || 'Client';
      restePayer = bon.reste_payer;
    }

    const canalLib =
      canal === 'whatsapp' ? 'WhatsApp' : canal === 'email' ? 'Email' : 'Copie presse-papiers';
    const retardTxt =
      joursRetard > 0 ? `${joursRetard} j de retard` : 'échéance proche';
    const destTxt = destinataire ? ` · Dest: ${destinataire}` : '';
    const objetTxt = objet ? ` · Objet: ${objet}` : '';

    ajouterAudit({
      action: 'RELANCE_CLIENT',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: docType,
      cible_id: docId,
      details: `${canalLib} — ${docNumero} (${clientNom}, reste ${restePayer.toFixed(
        2
      )} DA, ${retardTxt})${destTxt}${objetTxt}`,
    });
    const audit = store.journal_audit[store.journal_audit.length - 1];

    res.status(201).json({
      ok: true,
      audit,
    });
  }
);

