import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  ajouterAudit,
  enregistrerMouvementStock,
  prochainNumero,
  resoudrePrix,
  verifierPlafondCredit,
} from '../pricing.ts';
import type {
  BonChargement,
  BonVente,
  DechargementCamion,
  LigneDechargement,
  LigneRetourVendeur,
  LigneVente,
  RetourVendeur,
  Vendeur,
} from '../store.ts';
import { store } from '../store.ts';

export interface VendeurAuthedRequest extends Request {
  vendeur?: Vendeur;
}

type VendeurMiddleware = (
  req: VendeurAuthedRequest,
  res: Response,
  next: NextFunction
) => void;

const MOTIFS_RETOUR_VENDEUR = [
  { code: 'INVENDU', libelle: 'Invendu' },
  { code: 'CASSE', libelle: 'Cassé / abîmé' },
  { code: 'PERIME', libelle: 'Périmé / date courte' },
  { code: 'ERREUR_CHARGEMENT', libelle: 'Erreur de chargement' },
  { code: 'RETOUR_CLIENT', libelle: 'Repris chez un client' },
  { code: 'AUTRE', libelle: 'Autre (préciser)' },
];

function serializeDechargement(d: DechargementCamion) {
  const theo = d.lignes.reduce((s, l) => s + Number(l.theorique_pieces || 0), 0);
  const reel = d.lignes.reduce((s, l) => s + Number(l.reel_pieces || 0), 0);
  const ecart = d.lignes.reduce((s, l) => s + Number(l.ecart_pieces || 0), 0);
  const casse = d.lignes.reduce((s, l) => s + Number(l.casse_pieces || 0), 0);
  const valeurEcart = d.lignes.reduce((s, l) => {
    const prod = store.produits.find((p) => p.id === l.produit_id);
    return s + Number(l.ecart_pieces || 0) * Number(prod?.prix_vente || 0);
  }, 0);
  return {
    id: d.id,
    numero: d.numero,
    date_demande: d.date_dechargement,
    statut: d.statut,
    total_theorique_pieces: Number(theo.toFixed(2)),
    total_reel_pieces: Number(reel.toFixed(2)),
    total_ecart_pieces: Number(ecart.toFixed(2)),
    valeur_ecart: Number(valeurEcart.toFixed(2)),
    total_casse_pieces: Number(casse.toFixed(2)),
    observations: d.observations ?? null,
    motif_rejet: d.motif_rejet ?? null,
    lignes: d.lignes,
  };
}

function serializeRetourVendeur(r: RetourVendeur) {
  const totalColis = r.lignes.reduce(
    (s, l) => s + Number(l.quantite_colis || 0),
    0
  );
  return {
    id: r.id,
    numero: r.numero,
    date_demande: r.date_retour,
    statut: r.statut,
    retourne_par: r.retourne_par ?? null,
    nb_lignes: r.lignes.length,
    total_colis: Number(totalColis.toFixed(2)),
    lignes_a_decider: r.statut === 'En attente' ? r.lignes.length : 0,
    motif_rejet: r.motif_rejet ?? null,
    observations: r.observations ?? null,
    lignes: r.lignes,
  };
}

export function createPortalExtrasRouter(requireVendeur: VendeurMiddleware) {
  const router = express.Router();

  // ── Alias Pointage GPS (/tournee/pointage utilisé par portail_client_googleia) ──
  router.post(
    '/tournee/pointage',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const body = req.body || {};
      const clientId = body.client_id ?? body.clientId ?? null;
      const prospectId = body.prospect_id ?? body.prospectId ?? null;
      const codeClient = body.code_client ?? body.codeClient ?? null;
      const nomClient = body.nom_client ?? body.nomClient ?? null;

      if (!clientId && !prospectId && !codeClient && !nomClient) {
        res.status(400).json({
          detail:
            'client_id, code_client ou nom_client requis pour enregistrer un pointage.',
        });
        return;
      }

      const client = clientId
        ? store.clients.find((c) => c.id === Number(clientId))
        : codeClient
          ? store.clients.find(
              (c) => c.code.toUpperCase() === String(codeClient).toUpperCase()
            )
          : undefined;

      const prospect =
        !client && (prospectId || codeClient)
          ? store.prospects_clients.find((p) =>
              prospectId
                ? p.id === Number(prospectId)
                : p.code.toUpperCase() === String(codeClient).toUpperCase()
            )
          : undefined;

      const pointage = {
        id: store.nextId('tournee_pointages'),
        client_id: client?.id ?? (clientId ? Number(clientId) : null),
        vendeur_id: req.vendeur!.id,
        code_client: client?.code ?? prospect?.code ?? codeClient ?? null,
        nom_client: client?.nom ?? prospect?.nom ?? nomClient ?? null,
        latitude: body.latitude ?? body.lat ?? null,
        longitude: body.longitude ?? body.lng ?? null,
        date_pointage:
          body.timestamp || body.heure || new Date().toISOString().slice(0, 19),
        observations: body.observations ?? null,
      };
      store.tournee_pointages.push(pointage);
      res.status(201).json(pointage);
    }
  );

  // ── Mise à jour GPS Client & Prospect ──
  router.patch(
    '/clients/:id/gps',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const client = store.clients.find((c) => c.id === Number(req.params.id));
      if (!client) {
        res.status(404).json({ detail: 'Client introuvable.' });
        return;
      }
      const lat = Number(req.body?.latitude ?? req.body?.lat);
      const lng = Number(req.body?.longitude ?? req.body?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res
          .status(400)
          .json({ detail: 'Coordonnées latitude/longitude invalides.' });
        return;
      }
      client.latitude = Number(lat.toFixed(6));
      client.longitude = Number(lng.toFixed(6));
      res.json({
        id: client.id,
        code: client.code,
        nom: client.nom,
        latitude: client.latitude,
        longitude: client.longitude,
      });
    }
  );

  router.patch(
    '/clients/prospects/:id/gps',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const prospect = store.prospects_clients.find(
        (p) => p.id === Number(req.params.id)
      );
      if (!prospect) {
        res.status(404).json({ detail: 'Prospect introuvable.' });
        return;
      }
      const lat = Number(req.body?.latitude ?? req.body?.lat);
      const lng = Number(req.body?.longitude ?? req.body?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res
          .status(400)
          .json({ detail: 'Coordonnées latitude/longitude invalides.' });
        return;
      }
      prospect.latitude = Number(lat.toFixed(6));
      prospect.longitude = Number(lng.toFixed(6));
      res.json(prospect);
    }
  );

  // ── Chargement camion depuis le portail vendeur ──
  router.post(
    '/tournee/chargement',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const vid = req.vendeur!.id;
      const body = req.body || {};
      const lignesIn = Array.isArray(body.lignes) ? body.lignes : [];
      if (lignesIn.length === 0) {
        res
          .status(400)
          .json({ detail: 'Veuillez sélectionner au moins un produit.' });
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const lignesBon: BonChargement['lignes'] = [];

      for (const l of lignesIn) {
        const pid = Number(l.produit_id);
        const colis = Number(l.quantite_colis || 0);
        if (colis <= 0) {
          res.status(400).json({ detail: 'Quantité de colis invalide.' });
          return;
        }
        const prod = store.produits.find((p) => p.id === pid && p.supprime === 0);
        if (!prod) {
          res.status(404).json({ detail: `Produit #${pid} introuvable.` });
          return;
        }
        const fc = prod.facteur_conversion > 0 ? prod.facteur_conversion : 1;
        const pieces = Number((colis * fc).toFixed(4));
        if (prod.stock_actuel + 1e-6 < pieces) {
          res.status(409).json({
            detail: `Stock dépôt insuffisant pour ${prod.designation}.`,
          });
          return;
        }
        lignesBon.push({
          produit_id: pid,
          designation: prod.designation,
          quantite_colis: colis,
          quantite_pieces: pieces,
        });
      }

      const id = store.nextId('bons_chargement');
      const numero = prochainNumero(
        store.bons_chargement.map((b) => b.numero),
        `CHG-${today.replace(/-/g, '')}-`
      );

      for (const l of lignesBon) {
        const prod = store.produits.find((p) => p.id === l.produit_id)!;
        const avant = prod.stock_actuel;
        prod.stock_actuel = Math.max(
          0,
          Number((avant - l.quantite_pieces).toFixed(4))
        );
        enregistrerMouvementStock({
          produit_id: prod.id,
          type_mouvement: 'CHARGEMENT_CAMION',
          stock_avant: avant,
          stock_apres: prod.stock_actuel,
          cout_unitaire: prod.prix_moyen_pondere || prod.prix_achat,
          document_type: 'chargement',
          document_id: id,
          document_numero: numero,
          tiers_nom: req.vendeur!.nom,
          utilisateur: req.vendeur!.nom,
        });

        let sc = store.stock_camion_vendeur.find(
          (s) => s.vendeur_id === vid && s.produit_id === l.produit_id
        );
        if (!sc) {
          sc = {
            id: store.nextId('stock_camion_vendeur'),
            vendeur_id: vid,
            produit_id: l.produit_id,
            quantite_colis: 0,
            quantite_pieces: 0,
            date_maj: nowStr,
          };
          store.stock_camion_vendeur.push(sc);
        }
        sc.quantite_colis = Number(
          (sc.quantite_colis + l.quantite_colis).toFixed(2)
        );
        sc.quantite_pieces = Number(
          (sc.quantite_pieces + l.quantite_pieces).toFixed(2)
        );
        sc.date_maj = nowStr;
      }

      const bon: BonChargement = {
        id,
        numero,
        date_chargement: today,
        vendeur_id: vid,
        statut: 'Validé',
        total_colis: lignesBon.reduce((s, l) => s + l.quantite_colis, 0),
        total_pieces: lignesBon.reduce((s, l) => s + l.quantite_pieces, 0),
        observations: body.observations || null,
        lignes: lignesBon,
      };
      store.bons_chargement.push(bon);
      ajouterAudit({
        action: 'CHARGEMENT_TERRAIN',
        utilisateur: req.vendeur!.nom,
        cible_type: 'chargement',
        cible_id: id,
        details: `${numero} (${bon.total_colis} colis)`,
      });
      res.status(201).json(bon);
    }
  );

  // ── Vente directe terrain (camion -> client ou prospect) ──
  router.post(
    '/tournee/vente-directe',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const vid = req.vendeur!.id;
      const body = req.body || {};
      const lignesIn = Array.isArray(body.lignes) ? body.lignes : [];
      if (lignesIn.length === 0) {
        res
          .status(400)
          .json({ detail: 'La vente doit contenir au moins un produit.' });
        return;
      }

      const isProspect = Boolean(body.is_prospect || body.prospect_id);
      let client = !isProspect
        ? store.clients.find(
            (c) =>
              (body.client_id && c.id === Number(body.client_id)) ||
              (body.code_client &&
                c.code.toUpperCase() ===
                  String(body.code_client).trim().toUpperCase())
          )
        : undefined;

      const prospect = isProspect
        ? store.prospects_clients.find(
            (p) =>
              (body.prospect_id && p.id === Number(body.prospect_id)) ||
              (body.code_client &&
                p.code.toUpperCase() ===
                  String(body.code_client).trim().toUpperCase())
          )
        : undefined;

      if (!client && !prospect) {
        res
          .status(404)
          .json({ detail: 'Client ou prospect introuvable pour cette vente.' });
        return;
      }

      // If prospect already converted to client, link smoothly
      if (prospect?.client_id) {
        const linked = store.clients.find((c) => c.id === prospect.client_id);
        if (linked) client = linked;
      }

      const today = new Date().toISOString().slice(0, 10);
      const bonId = store.nextId('bons_vente');
      const numero = prochainNumero(
        store.bons_vente.map((b) => b.numero),
        `BV-${today.replace(/-/g, '')}-`
      );

      // Vérifier stock camion avant mutation
      const prepared: {
        produit_id: number;
        designation: string;
        qteColis: number;
        pieces: number;
        pu: number;
        totalHt: number;
        tvaTaux: number;
        totalTva: number;
        totalTtc: number;
      }[] = [];

      for (const l of lignesIn) {
        const pid = Number(l.produit_id);
        const qteColis = Number(l.quantite || 0);
        if (qteColis <= 0) {
          res.status(400).json({ detail: 'Quantité vendue invalide.' });
          return;
        }
        const prod = store.produits.find((p) => p.id === pid && p.supprime === 0);
        if (!prod) {
          res.status(404).json({ detail: `Produit #${pid} introuvable.` });
          return;
        }
        const fc = prod.facteur_conversion > 0 ? prod.facteur_conversion : 1;
        const pieces = Number((qteColis * fc).toFixed(4));
        const sc = store.stock_camion_vendeur.find(
          (s) => s.vendeur_id === vid && s.produit_id === pid
        );
        if (!sc || sc.quantite_colis + 1e-6 < qteColis) {
          res.status(409).json({
            detail: `Stock camion insuffisant pour ${prod.designation}.`,
          });
          return;
        }
        const pu =
          Number(l.prix_unitaire || 0) > 0
            ? Number(l.prix_unitaire)
            : resoudrePrix(pid, {
                clientId: client?.id ?? null,
                quantite: pieces,
              }).prix;
        const totalTtc = Number((pieces * pu).toFixed(2));
        const tvaTaux = Number(prod.tva || 0);
        const totalHt =
          tvaTaux > 0
            ? Number((totalTtc / (1 + tvaTaux / 100)).toFixed(2))
            : totalTtc;
        const totalTva = Number((totalTtc - totalHt).toFixed(2));

        prepared.push({
          produit_id: pid,
          designation: prod.designation,
          qteColis,
          pieces,
          pu,
          totalHt,
          tvaTaux,
          totalTva,
          totalTtc,
        });
      }

      const totalTtc = Number(
        prepared.reduce((s, p) => s + p.totalTtc, 0).toFixed(2)
      );
      const totalHt = Number(
        prepared.reduce((s, p) => s + p.totalHt, 0).toFixed(2)
      );
      const tvaTotal = Number(
        prepared.reduce((s, p) => s + p.totalTva, 0).toFixed(2)
      );
      const montantVerse = Math.max(
        0,
        Math.min(totalTtc, Number(body.montant_verse || 0))
      );
      const restePayer = Number(Math.max(0, totalTtc - montantVerse).toFixed(2));

      const creditCheck = client
        ? verifierPlafondCredit(client, restePayer)
        : null;
      if (creditCheck?.bloquant) {
        res.status(409).json({
          detail: creditCheck.avertissement,
          code: 'PLAFOND_CREDIT_DEPASSE',
          credit_info: creditCheck,
        });
        return;
      }

      // Décrémenter stock camion
      const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      for (const p of prepared) {
        const sc = store.stock_camion_vendeur.find(
          (s) => s.vendeur_id === vid && s.produit_id === p.produit_id
        )!;
        sc.quantite_colis = Math.max(
          0,
          Number((sc.quantite_colis - p.qteColis).toFixed(2))
        );
        sc.quantite_pieces = Math.max(
          0,
          Number((sc.quantite_pieces - p.pieces).toFixed(2))
        );
        sc.date_maj = nowStr;
      }

      const lignes: LigneVente[] = prepared.map((p) => ({
        id: store.nextId('lignes_vente'),
        bon_id: bonId,
        produit_id: p.produit_id,
        designation: p.designation,
        quantite: p.pieces,
        prix_unitaire: p.pu,
        total: p.totalTtc,
        total_ht: p.totalHt,
        tva_taux: p.tvaTaux,
        total_tva: p.totalTva,
        total_ttc: p.totalTtc,
      }));

      const bon: BonVente = {
        id: bonId,
        numero,
        date_bon: today,
        client_id: client ? client.id : 0,
        prospect_id: !client && prospect ? prospect.id : null,
        vendeur_id: vid,
        total: totalTtc,
        total_ht: totalHt,
        tva_total: tvaTotal,
        total_ttc: totalTtc,
        montant_verse: montantVerse,
        reste_payer: restePayer,
        statut: 'Validé',
        observations: body.observations || 'Vente directe terrain',
        lignes,
      };
      store.bons_vente.push(bon);

      // Solde & versement éventuel
      const mode = String(body.mode_reglement || 'Espèces');
      if (client) {
        client.solde = Number((client.solde + restePayer).toFixed(2));
        if (montantVerse > 0) {
          const numV = prochainNumero(
            store.versements_clients.map((v) => v.numero),
            `VC-${today.replace(/-/g, '')}-`
          );
          store.versements_clients.push({
            id: store.nextId('versements_clients'),
            numero: numV,
            date_vers: today,
            client_id: client.id,
            vendeur_id: vid,
            montant: montantVerse,
            mode,
            reference: numero,
          });
        }
      } else if (prospect) {
        prospect.solde = Number(((prospect.solde || 0) + restePayer).toFixed(2));
        if (montantVerse > 0) {
          const numVp = prochainNumero(
            store.versements_prospects.map((v) => v.numero),
            `VP-${today.replace(/-/g, '')}-`
          );
          store.versements_prospects.push({
            id: store.nextId('versements_prospects'),
            numero: numVp,
            date_vers: today,
            prospect_id: prospect.id,
            vendeur_id: vid,
            montant: montantVerse,
            mode,
            reference: numero,
          });
        }
      }

      ajouterAudit({
        action: 'VENTE_DIRECTE_TERRAIN',
        utilisateur: req.vendeur!.nom,
        cible_type: 'bon_vente',
        cible_id: bonId,
        details: `${numero} — ${totalTtc.toFixed(2)} DA (${client?.nom || prospect?.nom})`,
      });

      res.status(201).json({
        ...bon,
        client_nom: client?.nom || prospect?.nom || body.nom_client || 'Client',
        articles_count: lignes.length,
        credit_warning: creditCheck?.avertissement ?? null,
        credit_info: creditCheck,
      });
    }
  );

  // ── Liste des ventes terrain du vendeur ──
  router.get(
    '/tournee/ventes',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const vid = req.vendeur!.id;
      const rows = store.bons_vente
        .filter((b) => b.vendeur_id === vid && b.statut !== 'Annulé')
        .sort((a, b) => b.id - a.id)
        .map((b) => {
          const cl = b.client_id
            ? store.clients.find((c) => c.id === b.client_id)
            : null;
          const pr = b.prospect_id
            ? store.prospects_clients.find((p) => p.id === b.prospect_id)
            : null;
          return {
            ...b,
            client_nom: cl?.nom || pr?.nom || 'Client terrain',
            articles_count: b.lignes.length,
          };
        });
      res.json(rows);
    }
  );

  // ── Situation de caisse du vendeur ──
  router.get(
    '/tournee/ma-caisse',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const vid = req.vendeur!.id;
      const dateDebut = req.query.date_debut ? String(req.query.date_debut) : '';
      const dateFin = req.query.date_fin ? String(req.query.date_fin) : '';
      const inRange = (d: string) =>
        (!dateDebut || d >= dateDebut) && (!dateFin || d <= dateFin);

      const ventesPeriode = store.bons_vente.filter(
        (b) => b.vendeur_id === vid && b.statut !== 'Annulé' && inRange(b.date_bon)
      );
      const periode_ca = Number(
        ventesPeriode.reduce((s, b) => s + Number(b.total || 0), 0).toFixed(2)
      );
      const periode_credit = Number(
        ventesPeriode.reduce((s, b) => s + Number(b.reste_payer || 0), 0).toFixed(2)
      );

      const allVersClients = store.versements_clients.filter(
        (v) => v.vendeur_id === vid
      );
      const allVersProspects = store.versements_prospects.filter(
        (v) => v.vendeur_id === vid
      );
      const allVers = [...allVersClients, ...allVersProspects];
      const periodeVers = allVers.filter((v) => inRange(v.date_vers));

      const isEspeces = (mode?: string) =>
        !mode || mode.toLowerCase().includes('esp');

      const periode_encaisse_total = Number(
        periodeVers.reduce((s, v) => s + Number(v.montant || 0), 0).toFixed(2)
      );
      const periode_encaisse_especes = Number(
        periodeVers
          .filter((v) => isEspeces(v.mode))
          .reduce((s, v) => s + Number(v.montant || 0), 0)
          .toFixed(2)
      );

      const allRemises = store.versements_vendeurs.filter(
        (r) => r.vendeur_id === vid && r.statut !== 'Annulé'
      );
      const periodeRemises = allRemises.filter((r) => inRange(r.date_vers));
      const periode_verse_admin = Number(
        periodeRemises.reduce((s, r) => s + Number(r.montant || 0), 0).toFixed(2)
      );

      const cumul_encaisse_especes = Number(
        allVers
          .filter((v) => isEspeces(v.mode))
          .reduce((s, v) => s + Number(v.montant || 0), 0)
          .toFixed(2)
      );
      const cumul_verse_admin = Number(
        allRemises.reduce((s, r) => s + Number(r.montant || 0), 0).toFixed(2)
      );
      const reste_a_verser = Number(
        Math.max(0, cumul_encaisse_especes - cumul_verse_admin).toFixed(2)
      );

      const clientsVendeur = store.clients.filter(
        (c) => (c.vendeur_id === vid || c.vendeur_id == null) && c.solde > 0
      );
      const prospectsVendeur = store.prospects_clients.filter(
        (p) => (p.vendeur_id === vid || p.vendeur_id == null) && (p.solde || 0) > 0
      );
      const creances_clients = Number(
        (
          clientsVendeur.reduce((s, c) => s + c.solde, 0) +
          prospectsVendeur.reduce((s, p) => s + (p.solde || 0), 0)
        ).toFixed(2)
      );

      const camion_valeur = Number(
        store.stock_camion_vendeur
          .filter((s) => s.vendeur_id === vid && s.quantite_pieces > 0)
          .reduce((sum, s) => {
            const p = store.produits.find((pr) => pr.id === s.produit_id);
            return sum + s.quantite_pieces * Number(p?.prix_vente || 0);
          }, 0)
          .toFixed(2)
      );

      res.json({
        creances_clients,
        nb_clients_debiteurs: clientsVendeur.length + prospectsVendeur.length,
        periode_ca,
        periode_credit,
        periode_encaisse_total,
        periode_encaisse_especes,
        periode_verse_admin,
        periode_nb_remises: periodeRemises.length,
        cumul_encaisse_especes,
        cumul_verse_admin,
        reste_a_verser,
        camion_valeur,
      });
    }
  );

  // ── Remises versées à l'administration ──
  router.get(
    '/tournee/mes-remises',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const vid = req.vendeur!.id;
      const dateDebut = req.query.date_debut ? String(req.query.date_debut) : '';
      const dateFin = req.query.date_fin ? String(req.query.date_fin) : '';
      const rows = store.versements_vendeurs
        .filter(
          (r) =>
            r.vendeur_id === vid &&
            (!dateDebut || r.date_vers >= dateDebut) &&
            (!dateFin || r.date_vers <= dateFin)
        )
        .sort((a, b) => b.id - a.id)
        .map((r) => ({
          id: r.id,
          numero: r.numero,
          date_vers: r.date_vers,
          montant: r.montant,
          mode: r.mode,
          reference: r.reference ?? null,
          observations: r.observations ?? null,
          statut: r.statut,
          cree_par: r.cree_par ?? null,
        }));
      res.json(rows);
    }
  );

  // ── Déchargements fin de tournée (côté vendeur mobile) ──
  router.post(
    '/tournee/dechargement/demande',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const vid = req.vendeur!.id;
      const body = req.body || {};
      const lignesIn = Array.isArray(body.lignes) ? body.lignes : [];
      if (lignesIn.length === 0) {
        res
          .status(400)
          .json({ detail: 'Ajoutez au moins un produit à décharger.' });
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const id = store.nextId('dechargements_camion');
      const numero = prochainNumero(
        store.dechargements_camion.map((d) => d.numero),
        `DEC-${today.replace(/-/g, '')}-`
      );

      const lignes: LigneDechargement[] = lignesIn.map((l: any) => {
        const pid = Number(l.produit_id);
        const prod = store.produits.find((p) => p.id === pid);
        const fc =
          prod && prod.facteur_conversion > 0 ? prod.facteur_conversion : 1;
        const sc = store.stock_camion_vendeur.find(
          (s) => s.vendeur_id === vid && s.produit_id === pid
        );
        const theoPieces = sc?.quantite_pieces || 0;
        const reelPieces = Number((Number(l.quantite_colis || 0) * fc).toFixed(2));
        const cassePieces = Number(
          (Number(l.quantite_casse_colis || 0) * fc).toFixed(2)
        );
        return {
          produit_id: pid,
          designation: prod?.designation || `Produit #${pid}`,
          facteur_conversion: fc,
          theorique_pieces: theoPieces,
          reel_pieces: reelPieces,
          casse_pieces: cassePieces,
          ecart_pieces: Number((reelPieces - theoPieces).toFixed(2)),
          motif_ecart: l.motif_ecart || null,
        };
      });

      const dec: DechargementCamion = {
        id,
        numero,
        date_dechargement: today,
        vendeur_id: vid,
        statut: 'En attente',
        observations: body.observations || null,
        lignes,
      };
      store.dechargements_camion.push(dec);
      res.status(201).json(serializeDechargement(dec));
    }
  );

  router.get(
    '/tournee/dechargements',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const vid = req.vendeur!.id;
      res.json(
        store.dechargements_camion
          .filter((d) => d.vendeur_id === vid)
          .sort((a, b) => b.id - a.id)
          .map(serializeDechargement)
      );
    }
  );

  router.post(
    '/tournee/dechargements/:id/annuler',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const vid = req.vendeur!.id;
      const dec = store.dechargements_camion.find(
        (d) => d.id === Number(req.params.id) && d.vendeur_id === vid
      );
      if (!dec) {
        res.status(404).json({ detail: 'Demande de déchargement introuvable.' });
        return;
      }
      if (dec.statut !== 'En attente') {
        res
          .status(400)
          .json({ detail: 'Seule une demande en attente peut être annulée.' });
        return;
      }
      dec.statut = 'Annulé';
      res.json(serializeDechargement(dec));
    }
  );

  // ── Retours vendeur (côté vendeur mobile) ──
  router.get('/tournee/retours-vendeur/motifs', requireVendeur, (_req, res) => {
    res.json(MOTIFS_RETOUR_VENDEUR);
  });

  router.post(
    '/tournee/retour-vendeur',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const vid = req.vendeur!.id;
      const body = req.body || {};
      const lignesIn = Array.isArray(body.lignes) ? body.lignes : [];
      if (lignesIn.length === 0) {
        res
          .status(400)
          .json({ detail: 'Ajoutez au moins un produit à retourner.' });
        return;
      }

      const lignes: LigneRetourVendeur[] = [];
      let valeurTotale = 0;

      for (const l of lignesIn) {
        const pid = Number(l.produit_id);
        const colis = Number(l.quantite_colis || 0);
        if (colis <= 0) {
          res.status(400).json({ detail: 'Quantité de retour invalide.' });
          return;
        }
        const prod = store.produits.find((p) => p.id === pid);
        if (!prod) {
          res.status(404).json({ detail: `Produit #${pid} introuvable.` });
          return;
        }
        const sc = store.stock_camion_vendeur.find(
          (s) => s.vendeur_id === vid && s.produit_id === pid
        );
        if (!sc || sc.quantite_colis + 1e-6 < colis) {
          res.status(409).json({
            detail: `Stock camion insuffisant pour ${prod.designation}.`,
          });
          return;
        }
        const fc = prod.facteur_conversion > 0 ? prod.facteur_conversion : 1;
        const pieces = Number((colis * fc).toFixed(2));
        const pu = Number(prod.prix_achat || 0);
        valeurTotale += pieces * pu;
        lignes.push({
          produit_id: pid,
          designation: prod.designation,
          quantite_colis: colis,
          quantite_pieces: pieces,
          facteur_conversion: fc,
          prix_unitaire: pu,
          motif: String(l.motif || 'INVENDU'),
          decision: l.motif === 'CASSE' || l.motif === 'PERIME' ? 'CASSE' : 'VENDABLE',
        });
      }

      const today = new Date().toISOString().slice(0, 10);
      const id = store.nextId('retours_vendeur');
      const numero = prochainNumero(
        store.retours_vendeur.map((r) => r.numero),
        `RTV-${today.replace(/-/g, '')}-`
      );
      const rv: RetourVendeur = {
        id,
        numero,
        date_retour: today,
        vendeur_id: vid,
        retourne_par: body.retourne_par || null,
        motif: lignes[0]?.motif || 'INVENDU',
        decision: lignes[0]?.decision || 'VENDABLE',
        imputation: 'ENTREPRISE',
        statut: 'En attente',
        valeur_totale: Number(valeurTotale.toFixed(2)),
        observations: body.observations || null,
        lignes,
      };
      store.retours_vendeur.push(rv);
      res.status(201).json(serializeRetourVendeur(rv));
    }
  );

  router.get(
    '/tournee/retours-vendeur',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const vid = req.vendeur!.id;
      res.json(
        store.retours_vendeur
          .filter((r) => r.vendeur_id === vid)
          .sort((a, b) => b.id - a.id)
          .map(serializeRetourVendeur)
      );
    }
  );

  router.post(
    '/tournee/retours-vendeur/:id/annuler',
    requireVendeur,
    (req: VendeurAuthedRequest, res) => {
      const vid = req.vendeur!.id;
      const rv = store.retours_vendeur.find(
        (r) => r.id === Number(req.params.id) && r.vendeur_id === vid
      );
      if (!rv) {
        res.status(404).json({ detail: 'Demande de retour introuvable.' });
        return;
      }
      if (rv.statut !== 'En attente') {
        res
          .status(400)
          .json({ detail: 'Seule une demande en attente peut être annulée.' });
        return;
      }
      rv.statut = 'Annulé';
      res.json(serializeRetourVendeur(rv));
    }
  );

  return router;
}
