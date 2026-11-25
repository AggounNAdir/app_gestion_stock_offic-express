import express from 'express';
import type { Request, Response } from 'express';
import { hashPassword } from '../security.ts';
import { peut, peutVoirPage, ROLES } from '../rbac.ts';
import {
  ajouterAudit,
  enregistrerMouvementStock,
  prochainNumero,
  resoudrePrix,
  verifierPlafondCredit,
} from '../pricing.ts';
import type { ProfilEntreprise, Utilisateur } from '../store.ts';
import { store } from '../store.ts';
import { requireAdminUser } from './portalApi.ts';
import { bureauExtrasRouter } from './bureauExtrasApi.ts';

export const bureauRouter = express.Router();

interface AdminReq extends Request {
  adminUser?: Utilisateur;
}

bureauRouter.use(requireAdminUser);

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

// ── Session Info ──
bureauRouter.get('/me', (req: AdminReq, res) => {
  const u = req.adminUser!;
  res.json({
    id: u.id,
    username: u.username,
    nom_complet: u.nom_complet,
    role: u.role,
    role_libelle: ROLES[u.role],
  });
});

// ── Dashboard KPIs & Alerts (modules/dashboardpage.py) ──
bureauRouter.get('/dashboard', checkPage('dashboard'), (_req, res) => {
  const actifs = store.produits.filter((p) => p.supprime === 0 && p.actif === 1);
  const bonsVenteValides = store.bons_vente.filter(
    (b) => b.statut === 'Validé'
  );
  const bonsAchatValides = store.bons_achat.filter(
    (b) => b.statut === 'Validé'
  );
  const alertes = actifs
    .filter((p) => p.stock_actuel <= p.stock_min)
    .sort((a, b) => a.stock_actuel - b.stock_actuel)
    .slice(0, 8);

  res.json({
    kpis: {
      nb_produits: actifs.length,
      nb_clients: store.clients.length,
      nb_fournisseurs: store.fournisseurs.length,
      nb_bons_achat: bonsAchatValides.length,
      nb_bons_vente: bonsVenteValides.length,
      nb_factures: store.factures.length,
      ca_ventes: bonsVenteValides.reduce((acc, b) => acc + b.total, 0),
      total_achats: bonsAchatValides.reduce((acc, b) => acc + b.total, 0),
      stock_alerte: actifs.filter((p) => p.stock_actuel <= p.stock_min).length,
      commandes_en_attente: store.commandes_clients.filter(
        (c) => c.statut === 'En attente'
      ).length,
    },
    alertes,
  });
});

bureauRouter.get('/store', checkPage('dashboard'), (_req, res) => {
  res.json({
    produits: store.produits,
    clients: store.clients,
    fournisseurs: store.fournisseurs,
    bons_vente: store.bons_vente,
    bons_achat: store.bons_achat,
    factures: store.factures,
    depenses: [],
    versements_clients: store.versements_clients,
    devis: store.devis,
  });
});

// ── Produits CRUD & Grille des Prix (modules/produitpage.py, prix_niveaux.py) ──
bureauRouter.get('/produits', checkPage('produits'), (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const inclureInactifs = req.query.inactifs === '1';
  const rows = store.produits
    .filter((p) => p.supprime === 0 && (inclureInactifs || p.actif === 1))
    .filter(
      (p) =>
        !q ||
        p.designation.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
    )
    .map((p) => ({
      ...p,
      paliers: store.prix_paliers.filter(
        (pal) => pal.produit_id === p.id && pal.actif === 1
      ),
    }));
  res.json(rows);
});

bureauRouter.post('/produits', checkPage('produits'), (req: AdminReq, res) => {
  const b = req.body || {};
  const designation = String(b.designation || '').trim();
  if (!designation) {
    res.status(400).json({ detail: 'La désignation du produit est obligatoire.' });
    return;
  }
  const code =
    String(b.code || '').trim() ||
    prochainNumero(
      store.produits.map((p) => p.code),
      'PRD-'
    );
  if (store.produits.some((p) => p.code === code && p.supprime === 0)) {
    res.status(409).json({ detail: `Le code '${code}' existe déjà.` });
    return;
  }
  const prixAchat = Number(b.prix_achat || 0);
  const prixDetail = Number(b.prix_detail || b.prix_vente || 0);
  const prixVente = prixDetail > 0 ? prixDetail : Number((prixAchat * 1.35).toFixed(2));
  const stockInit = Number(b.stock_actuel || 0);

  const prod = {
    id: store.nextId('produits'),
    code,
    barcode: b.barcode || null,
    designation,
    marque: b.marque || null,
    fournisseur: b.fournisseur || null,
    unite: String(b.unite || 'carton'),
    facteur_conversion: Math.max(1, Number(b.facteur_conversion || 1)),
    prix_achat: prixAchat,
    prix_moyen_pondere: prixAchat,
    cout_total_stock: Number((stockInit * prixAchat).toFixed(2)),
    prix_super_gros: Number(b.prix_super_gros || prixVente),
    prix_gros: Number(b.prix_gros || prixVente),
    prix_detail: prixDetail || prixVente,
    prix_special: Number(b.prix_special || prixVente),
    prix_vente: prixVente,
    tva: Number(b.tva ?? 19),
    stock_actuel: stockInit,
    stock_min: Number(b.stock_min || 0),
    stock_retours_pieces: 0,
    actif: 1,
    supprime: 0,
  };
  store.produits.push(prod);
  if (stockInit > 0) {
    enregistrerMouvementStock({
      produit_id: prod.id,
      type_mouvement: 'STOCK_INITIAL',
      stock_avant: 0,
      stock_apres: stockInit,
      cout_unitaire: prixAchat,
      pmp_apres: prixAchat,
      document_numero: 'CREATION',
      tiers_nom: 'Dépôt Central',
      motif: 'Création fiche produit',
      utilisateur: req.adminUser!.nom_complet,
    });
  }
  res.status(201).json(prod);
});

bureauRouter.put('/produits/:id', checkPage('produits'), (req: AdminReq, res) => {
  const id = Number(req.params.id);
  const prod = store.produits.find((p) => p.id === id && p.supprime === 0);
  if (!prod) {
    res.status(404).json({ detail: 'Produit introuvable.' });
    return;
  }
  const b = req.body || {};
  if (b.designation !== undefined) prod.designation = String(b.designation).trim();
  if (b.marque !== undefined) prod.marque = b.marque || null;
  if (b.fournisseur !== undefined) prod.fournisseur = b.fournisseur || null;
  if (b.barcode !== undefined) prod.barcode = b.barcode || null;
  if (b.unite !== undefined) prod.unite = String(b.unite || 'Pcs');
  if (b.facteur_conversion !== undefined)
    prod.facteur_conversion = Math.max(1, Number(b.facteur_conversion || 1));
  if (b.prix_achat !== undefined) prod.prix_achat = Number(b.prix_achat || 0);
  if (b.prix_super_gros !== undefined)
    prod.prix_super_gros = Number(b.prix_super_gros || 0);
  if (b.prix_gros !== undefined) prod.prix_gros = Number(b.prix_gros || 0);
  if (b.prix_detail !== undefined) prod.prix_detail = Number(b.prix_detail || 0);
  if (b.prix_special !== undefined)
    prod.prix_special = Number(b.prix_special || 0);
  if (b.prix_vente !== undefined) prod.prix_vente = Number(b.prix_vente || 0);
  if (prod.prix_detail > 0) prod.prix_vente = prod.prix_detail;
  if (b.tva !== undefined) prod.tva = Number(b.tva || 0);
  if (b.stock_min !== undefined) prod.stock_min = Number(b.stock_min || 0);
  if (b.actif !== undefined) prod.actif = b.actif ? 1 : 0;

  res.json(prod);
});

bureauRouter.post(
  '/produits/:id/ajuster-stock',
  checkPage('mouvements_stock'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'ajuster_stock')) {
      res
        .status(403)
        .json({ detail: 'Votre rôle ne permet pas d’ajuster le stock.' });
      return;
    }
    const prod = store.produits.find((p) => p.id === Number(req.params.id));
    if (!prod) {
      res.status(404).json({ detail: 'Produit introuvable.' });
      return;
    }
    const nouveauStock = Number(req.body?.nouveau_stock);
    if (Number.isNaN(nouveauStock) || nouveauStock < 0) {
      res.status(400).json({ detail: 'Stock cible invalide.' });
      return;
    }
    const avant = prod.stock_actuel;
    prod.stock_actuel = nouveauStock;
    enregistrerMouvementStock({
      produit_id: prod.id,
      type_mouvement: 'AJUSTEMENT',
      stock_avant: avant,
      stock_apres: nouveauStock,
      cout_unitaire: prod.prix_moyen_pondere || prod.prix_achat,
      pmp_apres: prod.prix_moyen_pondere,
      motif: String(req.body?.motif || 'Ajustement manuel inventaire'),
      utilisateur: req.adminUser!.nom_complet,
    });
    res.json(prod);
  }
);

bureauRouter.delete(
  '/produits/:id',
  checkPage('produits'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'supprimer_definitivement')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const prod = store.produits.find((p) => p.id === Number(req.params.id));
    if (!prod) {
      res.status(404).json({ detail: 'Produit introuvable.' });
      return;
    }
    prod.actif = 0;
    res.json({ ok: true });
  }
);

// Prix speciaux client
bureauRouter.get('/prix-speciaux', checkPage('grille_prix'), (_req, res) => {
  res.json(
    store.prix_speciaux_clients.map((ps) => {
      const c = store.clients.find((x) => x.id === ps.client_id);
      const p = store.produits.find((x) => x.id === ps.produit_id);
      return {
        ...ps,
        client_nom: c?.nom || '',
        client_code: c?.code || '',
        produit_designation: p?.designation || '',
        prix_standard: p ? p.prix_vente || p.prix_detail : 0,
      };
    })
  );
});

bureauRouter.post('/prix-speciaux', checkPage('grille_prix'), (req, res) => {
  const { client_id, produit_id, prix_special, date_debut, date_fin } =
    req.body || {};
  const cid = Number(client_id);
  const pid = Number(produit_id);
  const prix = Number(prix_special);
  if (!cid || !pid || prix <= 0) {
    res
      .status(400)
      .json({ detail: 'Client, produit et prix spécial > 0 requis.' });
    return;
  }
  const existing = store.prix_speciaux_clients.find(
    (x) => x.client_id === cid && x.produit_id === pid
  );
  const nowTs = new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (existing) {
    existing.prix_special = prix;
    existing.date_debut = date_debut || null;
    existing.date_fin = date_fin || null;
    existing.actif = 1;
    existing.date_modification = nowTs;
    res.json(existing);
    return;
  }
  const item = {
    id: store.nextId('prix_speciaux_clients'),
    client_id: cid,
    produit_id: pid,
    prix_special: prix,
    date_debut: date_debut || null,
    date_fin: date_fin || null,
    actif: 1,
    date_modification: nowTs,
  };
  store.prix_speciaux_clients.push(item);
  res.status(201).json(item);
});

bureauRouter.delete(
  '/prix-speciaux/:id',
  checkPage('grille_prix'),
  (req, res) => {
    const idx = store.prix_speciaux_clients.findIndex(
      (x) => x.id === Number(req.params.id)
    );
    if (idx === -1) {
      res.status(404).json({ detail: 'Tarif spécial introuvable.' });
      return;
    }
    store.prix_speciaux_clients.splice(idx, 1);
    res.json({ ok: true });
  }
);

bureauRouter.get('/prix-paliers', checkPage('grille_prix'), (_req, res) => {
  res.json(
    store.prix_paliers.map((pal) => {
      const p = store.produits.find((x) => x.id === pal.produit_id);
      return {
        ...pal,
        produit_designation: p?.designation || '',
        produit_code: p?.code || '',
      };
    })
  );
});

bureauRouter.post('/prix-paliers', checkPage('grille_prix'), (req, res) => {
  const { produit_id, niveau, qte_min, prix } = req.body || {};
  const pid = Number(produit_id);
  const qte = Number(qte_min);
  const prx = Number(prix);
  if (!pid || qte <= 0 || prx <= 0) {
    res.status(400).json({ detail: 'Paramètres palier invalides.' });
    return;
  }
  const item = {
    id: store.nextId('prix_paliers'),
    produit_id: pid,
    niveau: niveau || 'detail',
    qte_min: qte,
    prix: prx,
    actif: 1,
  };
  store.prix_paliers.push(item);
  res.status(201).json(item);
});

// ── Clients & Fournisseurs (modules/tierspage.py) ──
bureauRouter.get('/clients', checkPage('clients'), (_req, res) => {
  res.json(
    store.clients.map(({ password_hash: _ph, ...rest }) => rest)
  );
});

bureauRouter.post('/clients', checkPage('clients'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const b = req.body || {};
  const nom = String(b.nom || '').trim();
  if (!nom) {
    res.status(400).json({ detail: 'Le nom du client est obligatoire.' });
    return;
  }
  const code =
    String(b.code || '').trim() ||
    prochainNumero(
      store.clients.map((c) => c.code),
      'CLT-'
    );
  const client = {
    id: store.nextId('clients'),
    code,
    nom,
    adresse: String(b.adresse || ''),
    tel: String(b.tel || ''),
    email: String(b.email || ''),
    ville: String(b.ville || ''),
    solde: Number(b.solde || 0),
    niveau_prix: b.niveau_prix || 'detail',
    portail_actif: b.portail_actif ? 1 : 0,
    password_hash: b.password ? hashPassword(String(b.password)) : null,
    latitude: b.latitude ?? null,
    longitude: b.longitude ?? null,
    vendeur_id: b.vendeur_id ? Number(b.vendeur_id) : null,
    plafond_credit: Math.max(0, Number(b.plafond_credit || 0)),
    bloquer_si_depasse: b.bloquer_si_depasse ? 1 : 0,
  };
  store.clients.push(client);
  const { password_hash: _ph, ...safe } = client;
  res.status(201).json(safe);
});

bureauRouter.get('/fournisseurs', checkPage('fournisseurs'), (_req, res) => {
  res.json(store.fournisseurs);
});

bureauRouter.post('/fournisseurs', checkPage('fournisseurs'), (req, res) => {
  const b = req.body || {};
  const nom = String(b.nom || '').trim();
  if (!nom) {
    res.status(400).json({ detail: 'Le nom du fournisseur est obligatoire.' });
    return;
  }
  const code =
    String(b.code || '').trim() ||
    prochainNumero(
      store.fournisseurs.map((f) => f.code),
      'FRN-'
    );
  const f = {
    id: store.nextId('fournisseurs'),
    code,
    nom,
    adresse: String(b.adresse || ''),
    tel: String(b.tel || ''),
    email: String(b.email || ''),
    ville: String(b.ville || ''),
    nif: String(b.nif || ''),
    solde: Number(b.solde || 0),
  };
  store.fournisseurs.push(f);
  res.status(201).json(f);
});

bureauRouter.put('/clients/:id', checkPage('clients'), (req: AdminReq, res) => {
  if (forbidReadOnly(req, res)) return;
  const client = store.clients.find((c) => c.id === Number(req.params.id));
  if (!client) {
    res.status(404).json({ detail: 'Client introuvable.' });
    return;
  }
  const b = req.body || {};
  if (b.nom !== undefined) client.nom = String(b.nom).trim();
  if (b.tel !== undefined) client.tel = String(b.tel || '');
  if (b.adresse !== undefined) client.adresse = String(b.adresse || '');
  if (b.email !== undefined) client.email = String(b.email || '');
  if (b.ville !== undefined) client.ville = String(b.ville || '');
  if (b.niveau_prix !== undefined) client.niveau_prix = b.niveau_prix;
  if (b.portail_actif !== undefined)
    client.portail_actif = b.portail_actif ? 1 : 0;
  if (b.plafond_credit !== undefined) {
    client.plafond_credit = Math.max(0, Number(b.plafond_credit || 0));
  }
  if (b.bloquer_si_depasse !== undefined) {
    client.bloquer_si_depasse = Number(b.bloquer_si_depasse) ? 1 : 0;
  }
  if (b.password && String(b.password).trim()) {
    client.password_hash = hashPassword(String(b.password).trim());
  }
  const { password_hash: _ph, ...safe } = client;
  res.json(safe);
});

bureauRouter.put('/fournisseurs/:id', checkPage('fournisseurs'), (req, res) => {
  const fourn = store.fournisseurs.find((f) => f.id === Number(req.params.id));
  if (!fourn) {
    res.status(404).json({ detail: 'Fournisseur introuvable.' });
    return;
  }
  const b = req.body || {};
  if (b.nom !== undefined) fourn.nom = String(b.nom).trim();
  if (b.tel !== undefined) fourn.tel = String(b.tel || '');
  if (b.adresse !== undefined) fourn.adresse = String(b.adresse || '');
  if (b.email !== undefined) fourn.email = String(b.email || '');
  if (b.ville !== undefined) fourn.ville = String(b.ville || '');
  if (b.nif !== undefined) fourn.nif = String(b.nif || '');
  res.json(fourn);
});

bureauRouter.get('/situations/:type/:id', checkPage('situations'), (req, res) => {
  const kind = String(req.params.type);
  const id = Number(req.params.id);
  const mvts: {
    date: string;
    ordre: number;
    id: number;
    type: string;
    numero: string;
    libelle: string;
    debit: number;
    credit: number;
    solde: number;
  }[] = [];

  if (kind === 'client') {
    const client = store.clients.find((c) => c.id === id);
    if (!client) {
      res.status(404).json({ detail: 'Client introuvable.' });
      return;
    }
    for (const b of store.bons_vente) {
      if (b.client_id === id && !b.prospect_id && b.statut !== 'Annulé') {
        mvts.push({
          date: b.date_bon,
          ordre: 0,
          id: b.id,
          type: 'bon',
          numero: b.numero,
          libelle: 'Bon de vente',
          debit: b.total,
          credit: 0,
          solde: 0,
        });
      }
    }
    for (const v of store.versements_clients) {
      if (v.client_id === id) {
        mvts.push({
          date: v.date_vers,
          ordre: 1,
          id: v.id,
          type: 'versement',
          numero: v.numero,
          libelle: `Règlement (${v.mode})`,
          debit: 0,
          credit: v.montant,
          solde: 0,
        });
      }
    }
    mvts.sort((a, b) => a.date.localeCompare(b.date) || a.ordre - b.ordre || a.id - b.id);
    const net = mvts.reduce((acc, m) => acc + m.debit - m.credit, 0);
    let courant = Number((client.solde - net).toFixed(2));
    const report = courant;
    for (const m of mvts) {
      courant = Number((courant + m.debit - m.credit).toFixed(2));
      m.solde = courant;
    }
    res.json({
      tiers_nom: client.nom,
      tiers_code: client.code,
      solde_report: report,
      total_debit: Number(mvts.reduce((a, m) => a + m.debit, 0).toFixed(2)),
      total_credit: Number(mvts.reduce((a, m) => a + m.credit, 0).toFixed(2)),
      solde_final: client.solde,
      lignes: mvts,
    });
    return;
  }

  const fourn = store.fournisseurs.find((f) => f.id === id);
  if (!fourn) {
    res.status(404).json({ detail: 'Fournisseur introuvable.' });
    return;
  }
  for (const ba of store.bons_achat) {
    if (ba.fournisseur_id === id && ba.statut !== 'Annulé') {
      mvts.push({
        date: ba.date_bon,
        ordre: 0,
        id: ba.id,
        type: 'achat',
        numero: ba.numero,
        libelle: "Bon d'achat",
        debit: ba.total,
        credit: 0,
        solde: 0,
      });
    }
  }
  for (const vf of store.versements_fournisseurs) {
    if (vf.fournisseur_id === id) {
      mvts.push({
        date: vf.date_vers,
        ordre: 1,
        id: vf.id,
        type: 'versement',
        numero: vf.numero,
        libelle: `Règlement (${vf.mode})`,
        debit: 0,
        credit: vf.montant,
        solde: 0,
      });
    }
  }
  mvts.sort((a, b) => a.date.localeCompare(b.date) || a.ordre - b.ordre || a.id - b.id);
  const net = mvts.reduce((acc, m) => acc + m.debit - m.credit, 0);
  let courant = Number((fourn.solde - net).toFixed(2));
  const report = courant;
  for (const m of mvts) {
    courant = Number((courant + m.debit - m.credit).toFixed(2));
    m.solde = courant;
  }
  res.json({
    tiers_nom: fourn.nom,
    tiers_code: fourn.code,
    solde_report: report,
    total_debit: Number(mvts.reduce((a, m) => a + m.debit, 0).toFixed(2)),
    total_credit: Number(mvts.reduce((a, m) => a + m.credit, 0).toFixed(2)),
    solde_final: fourn.solde,
    lignes: mvts,
  });
});

// ── Bons de Vente & Vente Comptoir (modules/bonventepage.py) ──
bureauRouter.get('/bons-vente', checkPage('bons_vente'), (_req, res) => {
  res.json(
    store.bons_vente
      .map((b) => {
        const client = store.clients.find((c) => c.id === b.client_id);
        const facture = store.factures.find((f) => f.bon_vente_id === b.id);
        const totalCartons = b.lignes.reduce((acc, l) => {
          const p = store.produits.find((pr) => pr.id === l.produit_id);
          const f = p && p.facteur_conversion > 0 ? p.facteur_conversion : 1;
          return acc + l.quantite / f;
        }, 0);
        return {
          ...b,
          client_nom: client?.nom || 'Client',
          facture_numero: facture?.numero || null,
          total_cartons: Number(totalCartons.toFixed(2)),
        };
      })
      .sort((a, b) => b.id - a.id)
  );
});

bureauRouter.post(
  '/bons-vente',
  checkPage('bons_vente'),
  (req: AdminReq, res) => {
    if (forbidReadOnly(req, res)) return;
    const b = req.body || {};
    const clientId = Number(b.client_id || 1);
    const client = store.clients.find((c) => c.id === clientId);
    if (!client) {
      res.status(404).json({ detail: 'Client introuvable.' });
      return;
    }
    const lignesIn = Array.isArray(b.lignes) ? b.lignes : [];
    if (lignesIn.length === 0) {
      res.status(400).json({ detail: 'Ajoutez au moins une ligne.' });
      return;
    }

    const today = String(b.date_bon || new Date().toISOString().slice(0, 10));
    const bonId = store.nextId('bons_vente');
    const numero = prochainNumero(
      store.bons_vente.map((x) => x.numero),
      `BV-${today.replace(/-/g, '')}-`
    );

    const prepared: {
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
    let totalHT = 0;
    let totalTVA = 0;
    let brutTTC = 0;

    for (const l of lignesIn) {
      const prod = store.produits.find((p) => p.id === Number(l.produit_id));
      if (!prod) {
        res
          .status(404)
          .json({ detail: `Produit #${l.produit_id} introuvable.` });
        return;
      }
      const qte = Number(l.quantite || 0);
      if (qte <= 0) {
        res.status(400).json({ detail: 'Quantité doit être > 0.' });
        return;
      }
      const pu =
        Number(l.prix_unitaire || 0) > 0
          ? Number(l.prix_unitaire)
          : resoudrePrix(prod.id, { clientId, quantite: qte }).prix;
      const lineRemise = Math.max(0, Number(l.remise || 0));
      const tot = Math.max(0, Number((qte * pu - lineRemise).toFixed(2)));
      const tvaTaux = prod.tva || 0;
      const ht = Number((tot / (1 + tvaTaux / 100)).toFixed(2));
      const tva = Number((tot - ht).toFixed(2));

      totalHT += ht;
      totalTVA += tva;
      brutTTC += tot;
      prepared.push({
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

    const remiseType = (b.remise_type || 'aucune') as
      | 'aucune'
      | 'montant'
      | 'pourcentage';
    const remiseVal = Math.max(0, Number(b.remise_valeur || 0));
    const remiseMontant =
      remiseType === 'pourcentage'
        ? Number(((brutTTC * Math.min(100, remiseVal)) / 100).toFixed(2))
        : remiseType === 'montant'
        ? Math.min(brutTTC, remiseVal)
        : 0;
    const totalTTC = Math.max(0, Number((brutTTC - remiseMontant).toFixed(2)));
    const ratio = brutTTC > 0 ? totalTTC / brutTTC : 1;

    const hasMontantRecu =
      b.montant_recu !== undefined &&
      b.montant_recu !== null &&
      b.montant_recu !== '';
    const montantRecuRaw = hasMontantRecu
      ? Math.max(0, Number(b.montant_recu || 0))
      : Math.max(0, Number(b.montant_verse || 0));
    const rawVerse =
      b.montant_verse !== undefined &&
      b.montant_verse !== null &&
      b.montant_verse !== ''
        ? Math.max(0, Number(b.montant_verse || 0))
        : montantRecuRaw;
    const montantVerse = Number(Math.min(totalTTC, rawVerse).toFixed(2));
    const reste = Number((totalTTC - montantVerse).toFixed(2));
    const renduMonnaie = hasMontantRecu
      ? Math.max(0, Number((montantRecuRaw - totalTTC).toFixed(2)))
      : Math.max(0, Number((rawVerse - totalTTC).toFixed(2)));
    const modeReglement = String(b.mode_reglement || 'Espèces');

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

    const lignes = prepared.map((item) => {
      const avant = item.prod.stock_actuel;
      item.prod.stock_actuel = Math.max(
        0,
        Number((avant - item.qte).toFixed(4))
      );
      enregistrerMouvementStock({
        produit_id: item.prod.id,
        type_mouvement: 'VENTE',
        stock_avant: avant,
        stock_apres: item.prod.stock_actuel,
        cout_unitaire: item.prod.prix_moyen_pondere || item.prod.prix_achat,
        pmp_apres: item.prod.prix_moyen_pondere,
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
        montant: montantVerse,
        mode: modeReglement,
        reference: numero,
      });
    }

    const bon = {
      id: bonId,
      numero,
      date_bon: today,
      client_id: client.id,
      total: Number(totalTTC.toFixed(2)),
      total_ht: Number((totalHT * ratio).toFixed(2)),
      tva_total: Number((totalTVA * ratio).toFixed(2)),
      total_ttc: Number(totalTTC.toFixed(2)),
      remise_type: remiseType,
      remise_valeur: remiseVal,
      remise_montant: remiseMontant,
      remise_motif: b.remise_motif || null,
      montant_verse: montantVerse,
      montant_recu: Number(montantRecuRaw.toFixed(2)),
      rendu_monnaie: renduMonnaie,
      mode_reglement: modeReglement,
      caissier_nom: req.adminUser?.nom_complet || null,
      reste_payer: reste,
      statut: 'Validé',
      date_echeance: b.date_echeance ? String(b.date_echeance) : null,
      observations: b.observations || null,
      lignes,
    };
    store.bons_vente.push(bon);

    if (b.pos_comptoir) {
      ajouterAudit({
        action: 'VENTE_COMPTOIR_POS',
        utilisateur: req.adminUser!.nom_complet,
        cible_type: 'bon_vente',
        cible_id: bon.id,
        details: `${bon.numero} · ${client.nom} · Total ${bon.total} DA · Reçu ${bon.montant_recu} DA · Rendu ${bon.rendu_monnaie} DA (${modeReglement})`,
      });
    }

    if (creditCheck.force_applique) {
      ajouterAudit({
        action: 'FORCAGE_PLAFOND_CREDIT',
        utilisateur: req.adminUser!.nom_complet,
        cible_type: 'bon_vente',
        cible_id: bon.id,
        details: `${bon.numero} · ${creditCheck.avertissement}`,
      });
    }

    res.status(201).json({
      ...bon,
      credit_warning: creditCheck.avertissement,
      credit_info: creditCheck,
    });
  }
);

bureauRouter.post(
  '/bons-vente/:id/annuler',
  checkPage('bons_vente'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'annuler_bon')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const bon = store.bons_vente.find((b) => b.id === Number(req.params.id));
    if (!bon) {
      res.status(404).json({ detail: 'Bon introuvable.' });
      return;
    }
    if (bon.statut === 'Annulé') {
      res.status(400).json({ detail: 'Bon déjà annulé.' });
      return;
    }
    bon.statut = 'Annulé';
    const client = store.clients.find((c) => c.id === bon.client_id);
    if (client && client.code !== 'CLT-COMPTOIR') {
      client.solde = Math.max(
        0,
        Number((client.solde - bon.reste_payer).toFixed(2))
      );
    }
    for (const l of bon.lignes) {
      const prod = store.produits.find((p) => p.id === l.produit_id);
      if (prod) {
        const avant = prod.stock_actuel;
        prod.stock_actuel = Number((avant + l.quantite).toFixed(4));
        enregistrerMouvementStock({
          produit_id: prod.id,
          type_mouvement: 'ANNULATION_VENTE',
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
    res.json(bon);
  }
);

// ── Bons d'Achat (modules/bonachatpage.py) ──
bureauRouter.get('/bons-achat', checkPage('bons_achat'), (_req, res) => {
  res.json(
    store.bons_achat
      .map((ba) => ({
        ...ba,
        fournisseur_nom:
          store.fournisseurs.find((f) => f.id === ba.fournisseur_id)?.nom || '',
      }))
      .sort((a, b) => b.id - a.id)
  );
});

bureauRouter.post(
  '/bons-achat',
  checkPage('bons_achat'),
  (req: AdminReq, res) => {
    const b = req.body || {};
    const fourn = store.fournisseurs.find(
      (f) => f.id === Number(b.fournisseur_id)
    );
    if (!fourn) {
      res.status(404).json({ detail: 'Fournisseur introuvable.' });
      return;
    }
    const lignesIn = Array.isArray(b.lignes) ? b.lignes : [];
    if (lignesIn.length === 0) {
      res.status(400).json({ detail: 'Ajoutez au moins une ligne.' });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const bonId = store.nextId('bons_achat');
    const numero = prochainNumero(
      store.bons_achat.map((x) => x.numero),
      `BA-${today.replace(/-/g, '')}-`
    );

    const lignes = [];
    let total = 0;
    for (const l of lignesIn) {
      const prod = store.produits.find((p) => p.id === Number(l.produit_id));
      if (!prod) {
        res.status(404).json({ detail: 'Produit introuvable.' });
        return;
      }
      const qte = Number(l.quantite || 0);
      const pu = Number(l.prix_unitaire || prod.prix_achat);
      if (qte <= 0 || pu < 0) {
        res.status(400).json({ detail: 'Quantité/prix invalide.' });
        return;
      }
      const tot = Number((qte * pu).toFixed(2));
      total += tot;

      const avant = prod.stock_actuel;
      const newStock = Number((avant + qte).toFixed(4));
      const newCoutTotal = avant * (prod.prix_moyen_pondere || prod.prix_achat) + qte * pu;
      const newPmp = newStock > 0 ? Number((newCoutTotal / newStock).toFixed(2)) : pu;

      prod.stock_actuel = newStock;
      prod.prix_achat = pu;
      prod.prix_moyen_pondere = newPmp;
      prod.cout_total_stock = Number(newCoutTotal.toFixed(2));

      enregistrerMouvementStock({
        produit_id: prod.id,
        type_mouvement: 'ACHAT',
        stock_avant: avant,
        stock_apres: newStock,
        cout_unitaire: pu,
        pmp_apres: newPmp,
        document_type: 'bon_achat',
        document_id: bonId,
        document_numero: numero,
        tiers_nom: fourn.nom,
        date_document: today,
        utilisateur: req.adminUser!.nom_complet,
      });

      lignes.push({
        id: store.nextId('lignes_achat'),
        bon_id: bonId,
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
    const ba = {
      id: bonId,
      numero,
      date_bon: today,
      fournisseur_id: fourn.id,
      total: Number(total.toFixed(2)),
      statut: 'Validé',
      observations: b.observations || null,
      lignes,
    };
    store.bons_achat.push(ba);
    res.status(201).json(ba);
  }
);

// ── Factures (modules/facturepage.py) ──
bureauRouter.get('/factures', checkPage('factures'), (_req, res) => {
  res.json(
    store.factures
      .map((f) => ({
        ...f,
        client_nom: store.clients.find((c) => c.id === f.client_id)?.nom || '',
        bon_numero:
          store.bons_vente.find((b) => b.id === f.bon_vente_id)?.numero || '',
      }))
      .sort((a, b) => b.id - a.id)
  );
});

bureauRouter.post('/factures', checkPage('factures'), (req, res) => {
  const bonId = Number(req.body?.bon_vente_id);
  const bon = store.bons_vente.find((b) => b.id === bonId);
  if (!bon) {
    res.status(404).json({ detail: 'Bon de vente introuvable.' });
    return;
  }
  if (store.factures.some((f) => f.bon_vente_id === bon.id)) {
    res.status(409).json({ detail: 'Ce bon est déjà facturé.' });
    return;
  }
  const today = String(req.body?.date_facture || new Date().toISOString().slice(0, 10));
  const fac = {
    id: store.nextId('factures'),
    numero: prochainNumero(
      store.factures.map((f) => f.numero),
      `FAC-${today.replace(/-/g, '')}-`
    ),
    date_facture: today,
    bon_vente_id: bon.id,
    client_id: bon.client_id,
    total_ht: bon.total_ht,
    tva: Number(req.body?.tva ?? 19),
    total_ttc: bon.total_ttc,
    statut: 'Émise',
    date_echeance: req.body?.date_echeance || null,
    observations: req.body?.observations || `Facture sur ${bon.numero}`,
  };
  store.factures.push(fac);
  res.status(201).json(fac);
});

// ── Commandes Portail (modules/commandesclientpage.py) ──
bureauRouter.get('/commandes-portail', checkPage('cmd_portail'), (_req, res) => {
  res.json(
    store.commandes_clients
      .map((c) => ({
        ...c,
        client_nom: store.clients.find((cl) => cl.id === c.client_id)?.nom || '',
        client_code:
          store.clients.find((cl) => cl.id === c.client_id)?.code || '',
      }))
      .sort((a, b) => b.id - a.id)
  );
});

bureauRouter.post(
  '/commandes-portail/:id/valider',
  checkPage('cmd_portail'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'valider_commandes')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const cmd = store.commandes_clients.find(
      (c) => c.id === Number(req.params.id)
    );
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

    const creditCheck = verifierPlafondCredit(client, cmd.montant_total, {
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

    const today = new Date().toISOString().slice(0, 10);
    const bonId = store.nextId('bons_vente');
    const numero = prochainNumero(
      store.bons_vente.map((x) => x.numero),
      `BV-${today.replace(/-/g, '')}-`
    );

    const lignes = cmd.lignes.map((l) => {
      const prod = store.produits.find((p) => p.id === l.produit_id);
      const qteBase = l.quantite * (l.facteur_conversion || 1);
      if (prod) {
        const avant = prod.stock_actuel;
        prod.stock_actuel = Math.max(0, Number((avant - qteBase).toFixed(4)));
        enregistrerMouvementStock({
          produit_id: prod.id,
          type_mouvement: 'VENTE',
          stock_avant: avant,
          stock_apres: prod.stock_actuel,
          cout_unitaire: prod.prix_moyen_pondere || prod.prix_achat,
          document_type: 'bon_vente',
          document_id: bonId,
          document_numero: numero,
          tiers_nom: client.nom,
          date_document: today,
          utilisateur: req.adminUser!.nom_complet,
        });
      }
      return {
        id: store.nextId('lignes_vente'),
        bon_id: bonId,
        produit_id: l.produit_id,
        designation: l.designation,
        quantite: qteBase,
        prix_unitaire: l.prix_unitaire,
        total: l.total,
        total_ht: Number((l.total / 1.19).toFixed(2)),
        tva_taux: 19,
        total_tva: Number((l.total - l.total / 1.19).toFixed(2)),
        total_ttc: l.total,
      };
    });

    const bon = {
      id: bonId,
      numero,
      date_bon: today,
      client_id: client.id,
      vendeur_id: cmd.vendeur_id ?? null,
      total: cmd.montant_total,
      total_ht: Number((cmd.montant_total / 1.19).toFixed(2)),
      tva_total: Number((cmd.montant_total - cmd.montant_total / 1.19).toFixed(2)),
      total_ttc: cmd.montant_total,
      montant_verse: 0,
      reste_payer: cmd.montant_total,
      statut: 'Validé',
      observations: `Validation commande ${cmd.numero}`,
      lignes,
    };
    store.bons_vente.push(bon);
    client.solde = Number((client.solde + cmd.montant_total).toFixed(2));
    cmd.statut = 'Validée';
    cmd.bon_vente_id = bon.id;

    if (creditCheck.force_applique) {
      ajouterAudit({
        action: 'FORCAGE_PLAFOND_CREDIT',
        utilisateur: req.adminUser!.nom_complet,
        cible_type: 'commande_client',
        cible_id: cmd.id,
        details: `${cmd.numero} -> ${bon.numero} · ${creditCheck.avertissement}`,
      });
    }

    res.json({
      commande: cmd,
      bon_vente: bon,
      credit_warning: creditCheck.avertissement,
      credit_info: creditCheck,
    });
  }
);

bureauRouter.post(
  '/commandes-portail/:id/refuser',
  checkPage('cmd_portail'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'valider_commandes')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const cmd = store.commandes_clients.find(
      (c) => c.id === Number(req.params.id)
    );
    if (!cmd) {
      res.status(404).json({ detail: 'Commande introuvable.' });
      return;
    }
    cmd.statut = 'Refusée';
    res.json(cmd);
  }
);

// ── Versements & Situations (modules/versementsunifiespage.py, situationpage.py) ──
bureauRouter.get('/versements', checkPage('versements'), (_req, res) => {
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
        tiers_nom:
          store.fournisseurs.find((f) => f.id === v.fournisseur_id)?.nom || '',
      }))
      .sort((a, b) => b.id - a.id),
  });
});

bureauRouter.post('/versements', checkPage('versements'), (req, res) => {
  const b = req.body || {};
  const type = String(b.type || 'client');
  const montant = Number(b.montant || 0);
  if (montant <= 0) {
    res.status(400).json({ detail: 'Montant doit être > 0.' });
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (type === 'fournisseur') {
    const fourn = store.fournisseurs.find(
      (f) => f.id === Number(b.fournisseur_id)
    );
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
      mode: String(b.mode || 'Espèces'),
      reference: b.reference || null,
    };
    store.versements_fournisseurs.push(v);
    fourn.solde = Math.max(0, Number((fourn.solde - montant).toFixed(2)));
    res.status(201).json(v);
    return;
  }
  const client = store.clients.find((c) => c.id === Number(b.client_id));
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
    mode: String(b.mode || 'Espèces'),
    reference: b.reference || null,
  };
  store.versements_clients.push(v);
  client.solde = Math.max(0, Number((client.solde - montant).toFixed(2)));
  res.status(201).json(v);
});

// ── Vendeurs & Chargements (modules/vendeurpage.py, chargementpage.py) ──
bureauRouter.get('/vendeurs', checkPage('vendeurs'), (_req, res) => {
  res.json(
    store.vendeurs.map((v) => {
      const ventes = store.bons_vente.filter(
        (b) => b.vendeur_id === v.id && b.statut !== 'Annulé'
      );
      const stockCamion = store.stock_camion_vendeur
        .filter((s) => s.vendeur_id === v.id)
        .map((s) => {
          const p = store.produits.find((pr) => pr.id === s.produit_id);
          return {
            ...s,
            code: p?.code || '',
            designation: p?.designation || '',
            prix_vente: p?.prix_vente || 0,
          };
        });
      return {
        id: v.id,
        code: v.code,
        nom: v.nom,
        tel: v.tel,
        actif: v.actif,
        ca_total: ventes.reduce((acc, b) => acc + b.total, 0),
        nb_ventes: ventes.length,
        stock_camion: stockCamion,
      };
    })
  );
});

bureauRouter.get('/chargements', checkPage('chargements'), (_req, res) => {
  res.json(
    store.bons_chargement
      .map((c) => ({
        ...c,
        vendeur_nom: store.vendeurs.find((v) => v.id === c.vendeur_id)?.nom || '',
      }))
      .sort((a, b) => b.id - a.id)
  );
});

bureauRouter.post(
  '/chargements',
  checkPage('chargements'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'gerer_chargements')) {
      res.status(403).json({ detail: 'Permission insuffisante.' });
      return;
    }
    const b = req.body || {};
    const vendeur = store.vendeurs.find((v) => v.id === Number(b.vendeur_id));
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
    const chgId = store.nextId('bons_chargement');
    const numero = prochainNumero(
      store.bons_chargement.map((c) => c.numero),
      `CHG-${today.replace(/-/g, '')}-`
    );

    let totalColis = 0;
    let totalPieces = 0;
    const lignes = [];

    for (const l of lignesIn) {
      const prod = store.produits.find((p) => p.id === Number(l.produit_id));
      if (!prod) continue;
      const colis = Number(l.quantite_colis || 0);
      if (colis <= 0) continue;
      const pieces = Number((colis * prod.facteur_conversion).toFixed(2));
      totalColis += colis;
      totalPieces += pieces;

      const avant = prod.stock_actuel;
      prod.stock_actuel = Math.max(0, Number((avant - pieces).toFixed(4)));
      enregistrerMouvementStock({
        produit_id: prod.id,
        type_mouvement: 'CHARGEMENT_CAMION',
        stock_avant: avant,
        stock_apres: prod.stock_actuel,
        cout_unitaire: prod.prix_moyen_pondere || prod.prix_achat,
        document_type: 'bon_chargement',
        document_id: chgId,
        document_numero: numero,
        tiers_nom: vendeur.nom,
        date_document: today,
        utilisateur: req.adminUser!.nom_complet,
      });

      const sc = store.stock_camion_vendeur.find(
        (s) => s.vendeur_id === vendeur.id && s.produit_id === prod.id
      );
      if (sc) {
        sc.quantite_colis = Number((sc.quantite_colis + colis).toFixed(2));
        sc.quantite_pieces = Number((sc.quantite_pieces + pieces).toFixed(2));
        sc.date_maj = new Date().toISOString().replace('T', ' ').slice(0, 19);
      } else {
        store.stock_camion_vendeur.push({
          id: store.nextId('stock_camion_vendeur'),
          vendeur_id: vendeur.id,
          produit_id: prod.id,
          quantite_colis: colis,
          quantite_pieces: pieces,
          date_maj: new Date().toISOString().replace('T', ' ').slice(0, 19),
        });
      }

      lignes.push({
        produit_id: prod.id,
        designation: prod.designation,
        quantite_colis: colis,
        quantite_pieces: pieces,
      });
    }

    const chg = {
      id: chgId,
      numero,
      date_chargement: today,
      vendeur_id: vendeur.id,
      statut: 'Validé',
      total_colis: totalColis,
      total_pieces: totalPieces,
      observations: b.observations || null,
      lignes,
    };
    store.bons_chargement.push(chg);
    res.status(201).json(chg);
  }
);

// ── Mouvements de stock (modules/mouvementstockpage.py) ──
bureauRouter.get(
  '/mouvements-stock',
  checkPage('mouvements_stock'),
  (req, res) => {
    const pid = req.query.produit_id ? Number(req.query.produit_id) : null;
    const type = req.query.type ? String(req.query.type) : null;
    res.json(
      store.mouvements_stock
        .filter((m) => (!pid || m.produit_id === pid) && (!type || m.type_mouvement === type))
        .map((m) => {
          const p = store.produits.find((pr) => pr.id === m.produit_id);
          return {
            ...m,
            produit_code: p?.code || '',
            produit_designation: p?.designation || '',
          };
        })
        .sort((a, b) => b.id - a.id)
    );
  }
);

// ── Utilisateurs & Audit (modules/utilisateurspage.py, journalauditpage.py) ──
bureauRouter.get('/utilisateurs', checkPage('utilisateurs'), (_req, res) => {
  res.json(
    store.utilisateurs.map(({ password_hash: _ph, ...u }) => ({
      ...u,
      role_libelle: ROLES[u.role],
    }))
  );
});

bureauRouter.post(
  '/utilisateurs',
  checkPage('utilisateurs'),
  (req: AdminReq, res) => {
    if (!peut(req.adminUser?.role, 'gerer_utilisateurs')) {
      res.status(403).json({ detail: 'Réservé aux administrateurs.' });
      return;
    }
    const { username, nom_complet, password, role } = req.body || {};
    if (!username || !nom_complet || !password || String(password).length < 6) {
      res.status(400).json({
        detail: 'Identifiant, nom complet et mot de passe (min 6 car.) requis.',
      });
      return;
    }
    if (store.utilisateurs.some((u) => u.username === String(username).trim())) {
      res.status(409).json({ detail: "Ce nom d'utilisateur est déjà pris." });
      return;
    }
    const u: Utilisateur = {
      id: store.nextId('utilisateurs'),
      username: String(username).trim(),
      nom_complet: String(nom_complet).trim(),
      password_hash: hashPassword(String(password)),
      role: role in ROLES ? role : 'vendeur',
      actif: 1,
      doit_changer_mdp: 0,
      date_creation: new Date().toISOString().replace('T', ' ').slice(0, 19),
      cree_par: req.adminUser!.nom_complet,
    };
    store.utilisateurs.push(u);
    ajouterAudit({
      action: 'CREATION_UTILISATEUR',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'utilisateur',
      cible_id: u.id,
      details: `${u.username} (${ROLES[u.role]})`,
    });
    const { password_hash: _ph, ...safe } = u;
    res.status(201).json(safe);
  }
);

bureauRouter.get('/journal-audit', checkPage('journal_audit'), (_req, res) => {
  res.json([...store.journal_audit].sort((a, b) => b.id - a.id));
});

bureauRouter.get('/profil-actif', (_req, res) => {
  const actif =
    store.profils_entreprise.find((p) => p.est_defaut === 1) ||
    store.profils_entreprise[0] ||
    null;
  res.json(actif);
});

bureauRouter.get('/profils', checkPage('profils'), (_req, res) => {
  res.json(
    [...store.profils_entreprise].sort(
      (a, b) => b.est_defaut - a.est_defaut || b.actif - a.actif || a.id - b.id
    )
  );
});

bureauRouter.post('/profils', checkPage('profils'), (req: AdminReq, res) => {
  if (req.adminUser?.role === 'lecture_seule') {
    res.status(403).json({ detail: 'Action non autorisée en lecture seule.' });
    return;
  }
  const b = req.body || {};
  const nom = String(b.nom || '').trim();
  if (!nom) {
    res.status(400).json({ detail: 'Le nom / raison sociale est requis.' });
    return;
  }
  const id = store.nextId('profils_entreprise');
  const code =
    String(b.code || '').trim() ||
    `SOCIETE_${String(id).padStart(3, '0')}`;
  if (store.profils_entreprise.some((p) => p.code.toLowerCase() === code.toLowerCase())) {
    res.status(409).json({ detail: 'Ce code de profil existe déjà.' });
    return;
  }
  const estDefaut = b.est_defaut ? 1 : 0;
  if (estDefaut === 1) {
    for (const pr of store.profils_entreprise) pr.est_defaut = 0;
  }
  const nouveau: ProfilEntreprise = {
    id,
    code,
    nom,
    type_profil: String(b.type_profil || 'complet'),
    forme_juridique: String(b.forme_juridique || 'SARL'),
    activite: String(b.activite || ''),
    capital_social: String(b.capital_social || ''),
    adresse: String(b.adresse || ''),
    telephone: String(b.telephone || ''),
    telephone2: String(b.telephone2 || ''),
    email: String(b.email || ''),
    site_web: String(b.site_web || ''),
    ville: String(b.ville || ''),
    code_postal: String(b.code_postal || ''),
    nif: String(b.nif || ''),
    nis: String(b.nis || ''),
    nrc: String(b.nrc || ''),
    art_imp: String(b.art_imp || ''),
    banque: String(b.banque || ''),
    rib: String(b.rib || ''),
    devise: String(b.devise || 'DA'),
    tva_defaut: b.tva_defaut !== undefined ? Number(b.tva_defaut) : 19,
    prefixe_bv: String(b.prefixe_bv || 'BV'),
    prefixe_facture: String(b.prefixe_facture || 'FAC'),
    pied_page: String(b.pied_page || ''),
    logo_data: b.logo_data || null,
    est_defaut: store.profils_entreprise.length === 0 ? 1 : estDefaut,
    actif: b.actif === 0 ? 0 : 1,
    date_creation: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
  store.profils_entreprise.push(nouveau);
  ajouterAudit({
    action: 'CREATION_PROFIL_ENTREPRISE',
    utilisateur: req.adminUser!.nom_complet,
    cible_type: 'profil_entreprise',
    cible_id: id,
    details: `${nouveau.nom} (${nouveau.code}) — ${nouveau.type_profil}`,
  });
  res.status(201).json(nouveau);
});

bureauRouter.put('/profils/:id', checkPage('profils'), (req: AdminReq, res) => {
  if (req.adminUser?.role === 'lecture_seule') {
    res.status(403).json({ detail: 'Action non autorisée en lecture seule.' });
    return;
  }
  const pr = store.profils_entreprise.find((x) => x.id === Number(req.params.id));
  if (!pr) {
    res.status(404).json({ detail: 'Profil entreprise introuvable.' });
    return;
  }
  const b = req.body || {};
  if (b.nom !== undefined && !String(b.nom).trim()) {
    res.status(400).json({ detail: 'Le nom / raison sociale est requis.' });
    return;
  }
  if (b.code !== undefined && String(b.code).trim()) {
    const nextCode = String(b.code).trim();
    if (
      store.profils_entreprise.some(
        (x) => x.id !== pr.id && x.code.toLowerCase() === nextCode.toLowerCase()
      )
    ) {
      res.status(409).json({ detail: 'Ce code de profil est déjà utilisé.' });
      return;
    }
    pr.code = nextCode;
  }
  if (b.nom !== undefined) pr.nom = String(b.nom).trim();
  if (b.type_profil !== undefined) pr.type_profil = String(b.type_profil);
  if (b.forme_juridique !== undefined) pr.forme_juridique = String(b.forme_juridique);
  if (b.activite !== undefined) pr.activite = String(b.activite);
  if (b.capital_social !== undefined) pr.capital_social = String(b.capital_social);
  if (b.adresse !== undefined) pr.adresse = String(b.adresse);
  if (b.telephone !== undefined) pr.telephone = String(b.telephone);
  if (b.telephone2 !== undefined) pr.telephone2 = String(b.telephone2);
  if (b.email !== undefined) pr.email = String(b.email);
  if (b.site_web !== undefined) pr.site_web = String(b.site_web);
  if (b.ville !== undefined) pr.ville = String(b.ville);
  if (b.code_postal !== undefined) pr.code_postal = String(b.code_postal);
  if (b.nif !== undefined) pr.nif = String(b.nif);
  if (b.nis !== undefined) pr.nis = String(b.nis);
  if (b.nrc !== undefined) pr.nrc = String(b.nrc);
  if (b.art_imp !== undefined) pr.art_imp = String(b.art_imp);
  if (b.banque !== undefined) pr.banque = String(b.banque);
  if (b.rib !== undefined) pr.rib = String(b.rib);
  if (b.devise !== undefined) pr.devise = String(b.devise);
  if (b.tva_defaut !== undefined) pr.tva_defaut = Number(b.tva_defaut);
  if (b.prefixe_bv !== undefined) pr.prefixe_bv = String(b.prefixe_bv);
  if (b.prefixe_facture !== undefined) pr.prefixe_facture = String(b.prefixe_facture);
  if (b.pied_page !== undefined) pr.pied_page = String(b.pied_page);
  if (b.logo_data !== undefined) pr.logo_data = b.logo_data;
  if (b.actif !== undefined) {
    if (pr.est_defaut === 1 && Number(b.actif) === 0) {
      res.status(400).json({ detail: 'Impossible de désactiver le profil actif par défaut.' });
      return;
    }
    pr.actif = Number(b.actif) ? 1 : 0;
  }
  if (b.est_defaut === 1 || b.est_defaut === true) {
    for (const x of store.profils_entreprise) x.est_defaut = 0;
    pr.est_defaut = 1;
    pr.actif = 1;
  }
  ajouterAudit({
    action: 'MODIFICATION_PROFIL_ENTREPRISE',
    utilisateur: req.adminUser!.nom_complet,
    cible_type: 'profil_entreprise',
    cible_id: pr.id,
    details: `${pr.nom} (${pr.code})`,
  });
  res.json(pr);
});

bureauRouter.post(
  '/profils/:id/defaut',
  checkPage('profils'),
  (req: AdminReq, res) => {
    if (req.adminUser?.role === 'lecture_seule') {
      res.status(403).json({ detail: 'Action non autorisée en lecture seule.' });
      return;
    }
    const pr = store.profils_entreprise.find((x) => x.id === Number(req.params.id));
    if (!pr) {
      res.status(404).json({ detail: 'Profil entreprise introuvable.' });
      return;
    }
    for (const x of store.profils_entreprise) x.est_defaut = 0;
    pr.est_defaut = 1;
    pr.actif = 1;
    ajouterAudit({
      action: 'ACTIVATION_PROFIL_ENTREPRISE',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'profil_entreprise',
      cible_id: pr.id,
      details: `Profil actif défini sur ${pr.nom} (${pr.code})`,
    });
    res.json(pr);
  }
);

bureauRouter.post(
  '/profils/:id/dupliquer',
  checkPage('profils'),
  (req: AdminReq, res) => {
    if (req.adminUser?.role === 'lecture_seule') {
      res.status(403).json({ detail: 'Action non autorisée en lecture seule.' });
      return;
    }
    const src = store.profils_entreprise.find((x) => x.id === Number(req.params.id));
    if (!src) {
      res.status(404).json({ detail: 'Profil entreprise introuvable.' });
      return;
    }
    const id = store.nextId('profils_entreprise');
    const copy: ProfilEntreprise = {
      ...src,
      id,
      code: `${src.code}_COPIE_${id}`,
      nom: `${src.nom} (Copie)`,
      est_defaut: 0,
      actif: 1,
      date_creation: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    store.profils_entreprise.push(copy);
    ajouterAudit({
      action: 'DUPLICATION_PROFIL_ENTREPRISE',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'profil_entreprise',
      cible_id: id,
      details: `Dupliqué depuis ${src.code} vers ${copy.code}`,
    });
    res.status(201).json(copy);
  }
);

bureauRouter.delete(
  '/profils/:id',
  checkPage('profils'),
  (req: AdminReq, res) => {
    if (req.adminUser?.role === 'lecture_seule') {
      res.status(403).json({ detail: 'Action non autorisée en lecture seule.' });
      return;
    }
    const idx = store.profils_entreprise.findIndex(
      (x) => x.id === Number(req.params.id)
    );
    if (idx === -1) {
      res.status(404).json({ detail: 'Profil entreprise introuvable.' });
      return;
    }
    const pr = store.profils_entreprise[idx];
    if (pr.est_defaut === 1) {
      res.status(400).json({
        detail: 'Impossible de supprimer le profil actif par défaut.',
      });
      return;
    }
    if (store.profils_entreprise.length <= 1) {
      res.status(400).json({
        detail: 'Au moins un profil entreprise doit être conservé.',
      });
      return;
    }
    store.profils_entreprise.splice(idx, 1);
    ajouterAudit({
      action: 'SUPPRESSION_PROFIL_ENTREPRISE',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'profil_entreprise',
      cible_id: pr.id,
      details: `${pr.nom} (${pr.code})`,
    });
    res.json({ ok: true });
  }
);

bureauRouter.get('/prospects', checkPage('prospects_vendeurs'), (_req, res) => {
  res.json(
    store.prospects_clients.map((p) => ({
      ...p,
      vendeur_nom: store.vendeurs.find((v) => v.id === p.vendeur_id)?.nom || '',
    }))
  );
});

bureauRouter.get('/pointages', checkPage('portail_suivi'), (_req, res) => {
  res.json(
    store.tournee_pointages
      .map((pt) => ({
        ...pt,
        vendeur_nom:
          store.vendeurs.find((v) => v.id === pt.vendeur_id)?.nom || '',
      }))
      .sort((a, b) => b.id - a.id)
  );
});

bureauRouter.get('/statistiques', checkPage('statistiques'), (_req, res) => {
  const ventesValides = store.bons_vente.filter((b) => b.statut !== 'Annulé');
  const achatsValides = store.bons_achat.filter((b) => b.statut !== 'Annulé');
  const valeurStock = store.produits
    .filter((p) => p.actif === 1)
    .reduce((acc, p) => acc + p.stock_actuel * (p.prix_moyen_pondere || p.prix_achat), 0);
  const topProduits = store.produits
    .map((p) => {
      const qteVendue = ventesValides.reduce(
        (acc, b) =>
          acc +
          b.lignes
            .filter((l) => l.produit_id === p.id)
            .reduce((s, l) => s + l.quantite, 0),
        0
      );
      const ca = ventesValides.reduce(
        (acc, b) =>
          acc +
          b.lignes
            .filter((l) => l.produit_id === p.id)
            .reduce((s, l) => s + l.total, 0),
        0
      );
      return { id: p.id, code: p.code, designation: p.designation, qte_vendue: qteVendue, ca };
    })
    .sort((a, b) => b.ca - a.ca);

  res.json({
    ca_total: ventesValides.reduce((acc, b) => acc + b.total, 0),
    achats_total: achatsValides.reduce((acc, b) => acc + b.total, 0),
    encaissements_total: store.versements_clients.reduce(
      (acc, v) => acc + v.montant,
      0
    ),
    creances_clients: store.clients.reduce((acc, c) => acc + c.solde, 0),
    dettes_fournisseurs: store.fournisseurs.reduce((acc, f) => acc + f.solde, 0),
    valeur_stock: Number(valeurStock.toFixed(2)),
    top_produits: topProduits,
  });
});

bureauRouter.use(bureauExtrasRouter);

// Stub any unmigrated desktop modules cleanly
bureauRouter.all('/*', (_req, res) => {
  res.status(501).json({ error: 'Not yet migrated' });
});
