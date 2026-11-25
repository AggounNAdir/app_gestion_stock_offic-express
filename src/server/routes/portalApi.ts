import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  createAccessToken,
  createAdminToken,
  createVendeurToken,
  decodeAccessToken,
  decodeAdminToken,
  decodeVendeurToken,
  effacerEchecs,
  empreinteMotDePasse,
  enregistrerEchec,
  MAX_ESSAIS_IP,
  nouveauSelSession,
  verifierTentatives,
  verifyPassword,
} from '../security.ts';
import { peut, peutVoirPage } from '../rbac.ts';
import {
  ajouterAudit,
  controlerLignesCommande,
  prochainNumero,
  resoudrePrix,
  verifierPlafondCredit,
} from '../pricing.ts';
import type { Client, Utilisateur, Vendeur } from '../store.ts';
import { store } from '../store.ts';
import { createPortalExtrasRouter } from './portalExtrasApi.ts';

export const portalRouter = express.Router();

interface AuthedRequest extends Request {
  client?: Client;
  vendeur?: Vendeur;
  adminUser?: Utilisateur;
  authType?: 'client' | 'vendeur';
}

function getBearer(req: Request): string | null {
  const h = req.headers.authorization || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  return null;
}

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'inconnue';
}

function requireClient(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = getBearer(req);
  const payload = token ? decodeAccessToken(token) : null;
  if (!payload) {
    res
      .status(401)
      .json({ detail: 'Session invalide ou expirée, veuillez vous reconnecter.' });
    return;
  }
  const client = store.clients.find((c) => c.id === Number(payload.sub));
  if (!client || payload.pw !== empreinteMotDePasse(client.password_hash)) {
    res
      .status(401)
      .json({ detail: 'Session invalide ou expirée, veuillez vous reconnecter.' });
    return;
  }
  if (!client.portail_actif) {
    res.status(403).json({
      detail:
        'Accès au portail désactivé pour ce compte. Contactez votre fournisseur.',
    });
    return;
  }
  req.client = client;
  req.authType = 'client';
  next();
}

function requireVendeur(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = getBearer(req);
  const payload = token ? decodeVendeurToken(token) : null;
  if (!payload) {
    res.status(401).json({
      detail: 'Session vendeur invalide ou expirée, veuillez vous reconnecter.',
    });
    return;
  }
  const vendeur = store.vendeurs.find((v) => v.id === Number(payload.sub));
  if (!vendeur || !payload.sv || vendeur.session_salt !== payload.sv) {
    res.status(401).json({
      detail: 'Session vendeur invalide ou expirée, veuillez vous reconnecter.',
    });
    return;
  }
  if (!vendeur.actif) {
    res.status(403).json({
      detail:
        'Accès désactivé pour ce compte vendeur. Contactez votre administrateur.',
    });
    return;
  }
  req.vendeur = vendeur;
  req.authType = 'vendeur';
  next();
}

function requireClientOrVendeur(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = getBearer(req);
  if (!token) {
    res
      .status(401)
      .json({ detail: 'Session invalide ou expirée, veuillez vous reconnecter.' });
    return;
  }
  const cp = decodeAccessToken(token);
  if (cp) {
    const client = store.clients.find((c) => c.id === Number(cp.sub));
    if (client && cp.pw === empreinteMotDePasse(client.password_hash)) {
      if (!client.portail_actif) {
        res.status(403).json({
          detail:
            'Accès au portail désactivé pour ce compte. Contactez votre fournisseur.',
        });
        return;
      }
      req.client = client;
      req.authType = 'client';
      next();
      return;
    }
  }
  const vp = decodeVendeurToken(token);
  if (vp) {
    const vendeur = store.vendeurs.find((v) => v.id === Number(vp.sub));
    if (vendeur && vp.sv && vendeur.session_salt === vp.sv) {
      if (!vendeur.actif) {
        res.status(403).json({
          detail:
            'Accès désactivé pour ce compte vendeur. Contactez votre administrateur.',
        });
        return;
      }
      req.vendeur = vendeur;
      req.authType = 'vendeur';
      next();
      return;
    }
  }
  res
    .status(401)
    .json({ detail: 'Session invalide ou expirée, veuillez vous reconnecter.' });
}

export function requireAdminUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = getBearer(req);
  const payload = token ? decodeAdminToken(token) : null;
  if (!payload) {
    res.status(401).json({
      detail:
        'Session administrateur invalide ou expirée, veuillez vous reconnecter.',
    });
    return;
  }
  const user = store.utilisateurs.find((u) => u.id === Number(payload.sub));
  if (
    !user ||
    !user.actif ||
    payload.pw !== empreinteMotDePasse(user.password_hash)
  ) {
    res.status(401).json({
      detail:
        'Session administrateur invalide ou expirée, veuillez vous reconnecter.',
    });
    return;
  }
  req.adminUser = user;
  next();
}

// ── Health ──
portalRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ── Auth ──
portalRouter.post('/auth/login', (req, res) => {
  const { code_client, password } = req.body || {};
  const ip = getClientIp(req);
  const cleIp = `client-ip:${ip}`;
  const cleId = `client:${ip}:${code_client || ''}`;
  if (!verifierTentatives(cleIp, MAX_ESSAIS_IP) || !verifierTentatives(cleId)) {
    res.status(429).json({ detail: 'Trop de tentatives. Réessayez plus tard.' });
    return;
  }

  const client = store.clients.find(
    (c) => c.code.toUpperCase() === String(code_client || '').trim().toUpperCase()
  );
  if (!client || !verifyPassword(String(password || ''), client.password_hash)) {
    enregistrerEchec(cleId);
    enregistrerEchec(cleIp);
    res
      .status(401)
      .json({ detail: 'Code client ou mot de passe incorrect.' });
    return;
  }
  if (!client.portail_actif) {
    res.status(403).json({
      detail:
        'Accès au portail désactivé pour ce compte. Contactez votre fournisseur.',
    });
    return;
  }
  effacerEchecs(cleId);
  const token = createAccessToken(
    client.id,
    client.code,
    empreinteMotDePasse(client.password_hash)
  );
  res.json({ access_token: token, token_type: 'bearer' });
});

portalRouter.post('/auth/login-vendeur', (req, res) => {
  const { code_vendeur, password } = req.body || {};
  const ip = getClientIp(req);
  const cleIp = `vendeur-ip:${ip}`;
  const cleId = `vendeur:${ip}:${code_vendeur || ''}`;
  if (!verifierTentatives(cleIp, MAX_ESSAIS_IP) || !verifierTentatives(cleId)) {
    res.status(429).json({ detail: 'Trop de tentatives. Réessayez plus tard.' });
    return;
  }

  const vendeur = store.vendeurs.find(
    (v) => v.code.toUpperCase() === String(code_vendeur || '').trim().toUpperCase()
  );
  if (
    !vendeur ||
    !verifyPassword(String(password || ''), vendeur.password_hash)
  ) {
    enregistrerEchec(cleId);
    enregistrerEchec(cleIp);
    res
      .status(401)
      .json({ detail: 'Code vendeur ou mot de passe incorrect.' });
    return;
  }
  if (!vendeur.actif) {
    res.status(403).json({
      detail:
        'Accès désactivé pour ce compte vendeur. Contactez votre administrateur.',
    });
    return;
  }
  effacerEchecs(cleId);
  if (!vendeur.session_salt) {
    vendeur.session_salt = nouveauSelSession();
  }
  const token = createVendeurToken(
    vendeur.id,
    vendeur.code,
    vendeur.session_salt
  );
  res.json({
    access_token: token,
    token_type: 'bearer',
    vendeur: {
      id: vendeur.id,
      code: vendeur.code,
      nom: vendeur.nom,
      tel: vendeur.tel,
    },
  });
});

portalRouter.post('/auth/login-admin', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const ip = getClientIp(req);
  const cleIp = `admin-ip:${ip}`;
  const cleId = `admin:${ip}:${username}`;
  if (!verifierTentatives(cleIp, MAX_ESSAIS_IP) || !verifierTentatives(cleId)) {
    res.status(429).json({ detail: 'Trop de tentatives. Réessayez plus tard.' });
    return;
  }

  const user = store.utilisateurs.find((u) => u.username === username);
  if (!user || !user.actif || !verifyPassword(password, user.password_hash)) {
    enregistrerEchec(cleId);
    enregistrerEchec(cleIp);
    ajouterAudit({
      action: 'CONNEXION_ECHEC',
      utilisateur: username || 'inconnu',
      details: 'Identifiant ou mot de passe incorrect',
      reussite: false,
    });
    res.status(401).json({ detail: 'Identifiant ou mot de passe incorrect.' });
    return;
  }
  effacerEchecs(cleId);
  user.derniere_connexion = new Date()
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  ajouterAudit({
    action: 'CONNEXION',
    utilisateur: user.nom_complet,
    cible_type: 'utilisateur',
    cible_id: user.id,
    details: 'Connexion web/API',
  });
  const token = createAdminToken(
    user.id,
    user.username,
    empreinteMotDePasse(user.password_hash)
  );
  res.json({
    access_token: token,
    token_type: 'bearer',
    username: user.username,
    nom_complet: user.nom_complet,
    role: user.role,
  });
});

// ── Produits Catalogue ──
portalRouter.get(
  '/produits',
  requireClientOrVendeur,
  (req: AuthedRequest, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const clientIdParam = req.query.client_id
      ? Number(req.query.client_id)
      : null;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    let targetClientId: number | null = null;
    if (req.authType === 'client' && req.client) {
      if (clientIdParam !== null && clientIdParam !== req.client.id) {
        res
          .status(403)
          .json({ detail: "Accès refusé aux tarifs d'un autre client." });
        return;
      }
      targetClientId = req.client.id;
    } else {
      targetClientId = clientIdParam;
    }

    const filtered = store.produits
      .filter((p) => p.supprime === 0 && p.actif === 1)
      .filter(
        (p) =>
          !q ||
          p.designation.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q)
      )
      .sort((a, b) => a.designation.localeCompare(b.designation))
      .slice(offset, offset + limit);

    res.json(
      filtered.map((p) => {
        const prix = targetClientId
          ? resoudrePrix(p.id, { clientId: targetClientId }).prix
          : Number(p.prix_vente || p.prix_detail || 0);
        return {
          id: p.id,
          code: p.code,
          designation: p.designation,
          unite: p.unite || 'Pièce',
          facteur_conversion: p.facteur_conversion > 0 ? p.facteur_conversion : 1,
          prix_unitaire: prix,
          stock_actuel: p.stock_actuel,
          tva: p.tva,
        };
      })
    );
  }
);

// ── Clients & Prospects ──
portalRouter.get('/clients/me', requireClient, (req: AuthedRequest, res) => {
  const c = req.client!;
  res.json({
    id: c.id,
    code: c.code,
    nom: c.nom,
    adresse: c.adresse,
    tel: c.tel,
    email: c.email,
    solde: c.solde,
    plafond_credit: Math.max(0, Number(c.plafond_credit || 0)),
    bloquer_si_depasse: Number(c.bloquer_si_depasse ? 1 : 0),
    niveau_prix: c.niveau_prix || 'detail',
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
  });
});

portalRouter.get(
  '/clients/me/ventes',
  requireClient,
  (req: AuthedRequest, res) => {
    const c = req.client!;
    const rows = store.bons_vente
      .filter((b) => b.client_id === c.id && !b.prospect_id && b.statut !== 'Annulé')
      .sort((a, b) => b.id - a.id);
    res.json(rows);
  }
);

portalRouter.get(
  '/clients/me/factures',
  requireClient,
  (req: AuthedRequest, res) => {
    const c = req.client!;
    res.json(
      store.factures
        .filter((f) => f.client_id === c.id)
        .sort((a, b) => b.id - a.id)
    );
  }
);

portalRouter.get(
  '/clients/me/versements',
  requireClient,
  (req: AuthedRequest, res) => {
    const c = req.client!;
    res.json(
      store.versements_clients
        .filter((v) => v.client_id === c.id)
        .sort((a, b) => b.id - a.id)
    );
  }
);

portalRouter.get(
  '/clients/me/situation',
  requireClient,
  (req: AuthedRequest, res) => {
    const c = req.client!;
    const dateDebut = req.query.date_debut
      ? String(req.query.date_debut)
      : null;
    const dateFin = req.query.date_fin ? String(req.query.date_fin) : null;

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

    for (const b of store.bons_vente) {
      if (b.client_id === c.id && !b.prospect_id && b.statut !== 'Annulé') {
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
    for (const r of store.retours_vente) {
      if (r.client_id === c.id) {
        mvts.push({
          date: r.date_retour,
          ordre: 1,
          id: r.id,
          type: 'retour',
          numero: r.numero,
          libelle: 'Retour marchandise',
          debit: 0,
          credit: r.total,
          solde: 0,
        });
      }
    }
    for (const v of store.versements_clients) {
      if (v.client_id === c.id) {
        mvts.push({
          date: v.date_vers,
          ordre: 2,
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

    mvts.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.ordre - b.ordre || a.id - b.id
    );
    const net = mvts.reduce((acc, m) => acc + m.debit - m.credit, 0);
    const soldeInitial = Number((c.solde - net).toFixed(2));
    let courant = soldeInitial;
    for (const m of mvts) {
      courant = Number((courant + m.debit - m.credit).toFixed(2));
      m.solde = courant;
    }
    let report = soldeInitial;
    const lignes = [];
    for (const m of mvts) {
      if (dateDebut && m.date < dateDebut) {
        report = m.solde;
        continue;
      }
      if (dateFin && m.date > dateFin) continue;
      lignes.push(m);
    }
    const soldeFinal =
      lignes.length > 0 ? lignes[lignes.length - 1].solde : report;
    res.json({
      client_code: c.code,
      client_nom: c.nom,
      date_edition: new Date().toISOString().slice(0, 10),
      solde_report: report,
      total_debit: Number(
        lignes.reduce((acc, l) => acc + l.debit, 0).toFixed(2)
      ),
      total_credit: Number(
        lignes.reduce((acc, l) => acc + l.credit, 0).toFixed(2)
      ),
      solde_final: soldeFinal,
      lignes,
    });
  }
);

portalRouter.get('/clients', requireVendeur, (req: AuthedRequest, res) => {
  const vid = req.vendeur!.id;
  res.json(
    store.clients
      .filter((c) => c.vendeur_id === vid || c.vendeur_id == null)
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .map((c) => ({
        id: c.id,
        code: c.code,
        nom: c.nom,
        adresse: c.adresse,
        tel: c.tel,
        email: c.email,
        solde: c.solde,
        plafond_credit: Math.max(0, Number(c.plafond_credit || 0)),
        bloquer_si_depasse: Number(c.bloquer_si_depasse ? 1 : 0),
        niveau_prix: c.niveau_prix || 'detail',
        latitude: c.latitude ?? null,
        longitude: c.longitude ?? null,
      }))
  );
});

portalRouter.post(
  '/clients/prospect',
  requireVendeur,
  (req: AuthedRequest, res) => {
    const body = req.body || {};
    const nom = String(body.nom || '').trim();
    if (!nom) {
      res.status(400).json({ detail: 'Le nom du prospect est obligatoire.' });
      return;
    }
    const todayNum = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const code =
      String(body.code || '').trim() ||
      prochainNumero(
        store.prospects_clients.map((p) => p.code),
        `PROSP-${todayNum}-`
      );
    const prospect = {
      id: store.nextId('prospects_clients'),
      code,
      nom,
      tel: body.tel || null,
      adresse: body.adresse || null,
      wilaya: body.wilaya || null,
      latitude: body.latitude ?? body.lat ?? null,
      longitude: body.longitude ?? body.lng ?? null,
      vendeur_id: req.vendeur!.id,
      date_creation: new Date().toISOString().slice(0, 19),
      statut: 'Nouveau',
      client_id: null,
      solde: 0,
    };
    store.prospects_clients.push(prospect);
    res.status(201).json(prospect);
  }
);

portalRouter.get(
  '/clients/prospects',
  requireVendeur,
  (req: AuthedRequest, res) => {
    const vid = req.vendeur!.id;
    const statut = req.query.statut ? String(req.query.statut) : null;
    res.json(
      store.prospects_clients
        .filter((p) => p.vendeur_id === vid || p.vendeur_id == null)
        .filter((p) => !statut || p.statut === statut)
        .sort((a, b) => b.id - a.id)
    );
  }
);

// ── Commandes ──
portalRouter.post(
  '/commandes',
  requireClientOrVendeur,
  (req: AuthedRequest, res) => {
    const body = req.body || {};
    const lignesIn = Array.isArray(body.lignes) ? body.lignes : [];
    if (lignesIn.length === 0) {
      res
        .status(400)
        .json({ detail: 'La commande doit contenir au moins un produit.' });
      return;
    }

    const isVendeur = req.authType === 'vendeur';
    const isProspect = Boolean(isVendeur && (body.is_prospect || body.prospect_id));
    let targetClientId: number | null = null;
    let targetProspectId: number | null = null;
    let vendeurId: number | null = null;

    if (!isVendeur && req.client) {
      targetClientId = req.client.id;
      vendeurId = req.client.vendeur_id ?? null;
    } else if (req.vendeur) {
      vendeurId = req.vendeur.id;
      if (isProspect) {
        const prospect = store.prospects_clients.find(
          (p) =>
            (body.prospect_id && p.id === Number(body.prospect_id)) ||
            (body.code_client &&
              p.code.toUpperCase() ===
                String(body.code_client).trim().toUpperCase())
        );
        if (prospect) {
          if (prospect.client_id) {
            targetClientId = prospect.client_id;
          } else {
            targetProspectId = prospect.id;
          }
        }
        if (!targetProspectId && !targetClientId) {
          res.status(404).json({ detail: 'Prospect introuvable.' });
          return;
        }
      } else {
        const found = store.clients.find(
          (c) =>
            (body.client_id && c.id === Number(body.client_id)) ||
            (body.code_client &&
              c.code.toUpperCase() ===
                String(body.code_client).trim().toUpperCase())
        );
        if (found) targetClientId = found.id;
        if (!targetClientId) {
          res.status(400).json({
            detail:
              'Client introuvable. Veuillez préciser un client_id ou code_client valide.',
          });
          return;
        }
      }
    }

    const lignesControle: {
      produit_id: number;
      quantite: number;
      facteur_conversion: number;
      prix_unitaire: number;
    }[] = [];

    for (const item of lignesIn) {
      const pid = Number(item.produit_id);
      const qte = Number(item.quantite || 0);
      if (qte <= 0) {
        res.status(400).json({
          detail: 'Chaque quantité commandée doit être supérieure à zéro.',
        });
        return;
      }
      const prod = store.produits.find(
        (p) => p.id === pid && p.supprime === 0
      );
      if (!prod) {
        res.status(404).json({ detail: `Produit #${pid} introuvable.` });
        return;
      }
      const facteur = prod.facteur_conversion > 0 ? prod.facteur_conversion : 1;
      const prixRecu = isVendeur
        ? Number(item.prix_unitaire || 0)
        : resoudrePrix(pid, {
            clientId: targetClientId,
            quantite: qte * facteur,
          }).prix;

      lignesControle.push({
        produit_id: pid,
        quantite: qte,
        facteur_conversion: facteur,
        prix_unitaire: prixRecu,
      });
    }

    const anomalies = controlerLignesCommande(
      targetClientId,
      lignesControle,
      isVendeur
    );
    const bloquantes = anomalies.filter((a) => a.bloquant);
    if (bloquantes.length > 0) {
      res.status(409).json({
        detail:
          'Prix non conforme au tarif : ' +
          bloquantes.map((b) => b.message).join(' ; '),
      });
      return;
    }

    const lignesData = lignesControle.map((lc) => {
      const prod = store.produits.find((p) => p.id === lc.produit_id)!;
      const pu =
        lc.prix_unitaire > 0
          ? lc.prix_unitaire
          : resoudrePrix(lc.produit_id, {
              clientId: targetClientId,
              quantite: lc.quantite * lc.facteur_conversion,
            }).prix;
      const total = Number(
        (lc.quantite * lc.facteur_conversion * pu).toFixed(2)
      );
      return {
        produit_id: lc.produit_id,
        designation: prod.designation,
        quantite: lc.quantite,
        prix_unitaire: pu,
        facteur_conversion: lc.facteur_conversion,
        total,
      };
    });

    const today = new Date().toISOString().slice(0, 10);
    const numDate = today.replace(/-/g, '');
    const montant_total = Number(
      lignesData.reduce((acc, l) => acc + l.total, 0).toFixed(2)
    );

    if (targetProspectId) {
      const numero = prochainNumero(
        store.commandes_prospects.map((c) => c.numero),
        `CMDP-${numDate}-`
      );
      const cmdP = {
        id: store.nextId('commandes_prospects'),
        numero,
        prospect_id: targetProspectId,
        vendeur_id: vendeurId,
        date_commande: today,
        statut: 'En attente',
        montant_total,
        observations: body.observations || '',
        lignes: lignesData,
      };
      store.commandes_prospects.push(cmdP);
      res.status(201).json({ ...cmdP, is_prospect: true });
      return;
    }

    const client = store.clients.find((c) => c.id === targetClientId);
    if (!client) {
      res.status(404).json({ detail: 'Client introuvable.' });
      return;
    }

    const creditCheck = verifierPlafondCredit(client, montant_total);
    if (creditCheck.bloquant) {
      res.status(409).json({
        detail: creditCheck.avertissement,
        code: 'PLAFOND_CREDIT_DEPASSE',
        credit_info: creditCheck,
      });
      return;
    }

    const numero = prochainNumero(
      store.commandes_clients.map((c) => c.numero),
      `CMD-${numDate}-`
    );
    const cmd = {
      id: store.nextId('commandes_clients'),
      numero,
      client_id: targetClientId!,
      vendeur_id: vendeurId,
      date_commande: today,
      statut: 'En attente',
      montant_total,
      observations: body.observations || '',
      bon_vente_id: null,
      lignes: lignesData,
    };
    store.commandes_clients.push(cmd);
    res.status(201).json({
      ...cmd,
      credit_warning: creditCheck.avertissement,
      credit_info: creditCheck,
    });
  }
);

portalRouter.get('/commandes', requireClient, (req: AuthedRequest, res) => {
  res.json(
    store.commandes_clients
      .filter((c) => c.client_id === req.client!.id)
      .sort((a, b) => b.id - a.id)
  );
});

portalRouter.get(
  '/commandes/mes-commandes',
  requireClient,
  (req: AuthedRequest, res) => {
    res.json(
      store.commandes_clients
        .filter((c) => c.client_id === req.client!.id)
        .sort((a, b) => b.id - a.id)
    );
  }
);

// ── Ventes / Factures / Versements ──
portalRouter.get('/ventes', requireClient, (req: AuthedRequest, res) => {
  res.json(
    store.bons_vente
      .filter(
        (b) =>
          b.client_id === req.client!.id &&
          !b.prospect_id &&
          b.statut !== 'Annulé'
      )
      .sort((a, b) => b.id - a.id)
  );
});

portalRouter.get('/ventes/:id', requireClient, (req: AuthedRequest, res) => {
  const bon = store.bons_vente.find(
    (b) =>
      b.id === Number(req.params.id) &&
      b.client_id === req.client!.id &&
      !b.prospect_id &&
      b.statut !== 'Annulé'
  );
  if (!bon) {
    res.status(404).json({ detail: 'Bon de vente introuvable.' });
    return;
  }
  res.json(bon);
});

portalRouter.post(
  '/ventes/bl/signature',
  requireVendeur,
  (req: AuthedRequest, res) => {
    const { bon_vente_id, numero, signature, signataire_nom } = req.body || {};
    if (!bon_vente_id && !numero) {
      res.status(400).json({
        detail: 'bon_vente_id ou numero requis pour identifier le bon de livraison.',
      });
      return;
    }
    if (!signature || !String(signature).trim()) {
      res.status(400).json({
        detail: 'La signature (image encodée) est obligatoire.',
      });
      return;
    }
    const bon = store.bons_vente.find((b) =>
      bon_vente_id ? b.id === Number(bon_vente_id) : b.numero === numero
    );
    if (!bon) {
      res.status(404).json({ detail: 'Bon de livraison introuvable.' });
      return;
    }
    if (bon.vendeur_id !== req.vendeur!.id) {
      res.status(403).json({ detail: "Ce bon n'est pas le vôtre." });
      return;
    }
    if (bon.signature_bl) {
      res.status(409).json({ detail: 'Ce bon est déjà signé.' });
      return;
    }
    const date_signature = new Date().toISOString().slice(0, 19);
    bon.signature_bl = String(signature);
    bon.signataire_nom = signataire_nom || null;
    bon.date_signature = date_signature;
    res.status(201).json({
      bon_vente_id: bon.id,
      numero: bon.numero,
      signataire_nom: bon.signataire_nom,
      date_signature,
      statut: 'Signé',
    });
  }
);

portalRouter.get('/factures', requireClient, (req: AuthedRequest, res) => {
  res.json(
    store.factures
      .filter((f) => f.client_id === req.client!.id)
      .sort((a, b) => b.id - a.id)
  );
});

portalRouter.get(
  '/factures/:id',
  requireClient,
  (req: AuthedRequest, res) => {
    const fac = store.factures.find(
      (f) => f.id === Number(req.params.id) && f.client_id === req.client!.id
    );
    if (!fac) {
      res.status(404).json({ detail: 'Facture introuvable.' });
      return;
    }
    res.json(fac);
  }
);

portalRouter.get(
  '/versements',
  requireClientOrVendeur,
  (req: AuthedRequest, res) => {
    if (req.authType === 'vendeur' && req.vendeur) {
      const vid = req.vendeur.id;
      const vc = store.versements_clients
        .filter((v) => v.vendeur_id === vid)
        .map((v) => {
          const cl = store.clients.find((c) => c.id === v.client_id);
          return {
            ...v,
            nom_client: cl?.nom ?? null,
            code_client: cl?.code ?? null,
            prospect_id: null,
          };
        });
      const vp = store.versements_prospects
        .filter((v) => v.vendeur_id === vid)
        .map((v) => {
          const pr = store.prospects_clients.find((p) => p.id === v.prospect_id);
          return {
            ...v,
            nom_client: pr?.nom ?? null,
            code_client: pr?.code ?? null,
            prospect_id: v.prospect_id,
          };
        });
      res.json([...vc, ...vp].sort((a, b) => b.date_vers.localeCompare(a.date_vers)));
      return;
    }
    res.json(
      store.versements_clients
        .filter((v) => v.client_id === req.client!.id)
        .sort((a, b) => b.id - a.id)
    );
  }
);

portalRouter.post(
  '/versements',
  requireClientOrVendeur,
  (req: AuthedRequest, res) => {
    if (req.authType === 'client') {
      res.status(403).json({
        detail:
          "L'enregistrement d'un versement est réservé à votre commercial ou au bureau.",
      });
      return;
    }
    const body = req.body || {};
    const montant = Number(body.montant || 0);
    if (montant <= 0) {
      res.status(400).json({ detail: 'Le montant doit être positif.' });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const isProspect = Boolean(body.is_prospect || body.prospect_id);

    if (isProspect) {
      const prospect = store.prospects_clients.find(
        (p) =>
          (body.prospect_id && p.id === Number(body.prospect_id)) ||
          (body.code_client &&
            p.code.toUpperCase() ===
              String(body.code_client).trim().toUpperCase())
      );
      if (!prospect) {
        res.status(404).json({ detail: 'Prospect introuvable.' });
        return;
      }
      if (!prospect.client_id) {
        if ((prospect.solde || 0) > 0 && montant > prospect.solde + 0.01) {
          res.status(400).json({
            detail: `Le versement (${montant.toFixed(2)}) dépasse le solde dû (${prospect.solde.toFixed(2)}).`,
          });
          return;
        }
        const numero = prochainNumero(
          store.versements_prospects.map((v) => v.numero),
          `VP-${today.replace(/-/g, '')}-`
        );
        const vp = {
          id: store.nextId('versements_prospects'),
          numero,
          date_vers: today,
          prospect_id: prospect.id,
          vendeur_id: req.vendeur?.id ?? null,
          montant,
          mode: String(body.mode || 'Espèces'),
          reference: body.reference || null,
        };
        store.versements_prospects.push(vp);
        prospect.solde = Math.max(
          0,
          Number(((prospect.solde || 0) - montant).toFixed(2))
        );
        res.status(201).json(vp);
        return;
      }
      body.client_id = prospect.client_id;
    }

    const client = store.clients.find(
      (c) =>
        (body.client_id && c.id === Number(body.client_id)) ||
        (body.code_client &&
          c.code.toUpperCase() ===
            String(body.code_client).trim().toUpperCase())
    );
    if (!client) {
      res.status(404).json({ detail: 'Client introuvable.' });
      return;
    }
    if (montant > client.solde + 0.01) {
      res.status(400).json({
        detail: `Le versement (${montant.toFixed(2)}) dépasse le solde dû (${client.solde.toFixed(2)}).`,
      });
      return;
    }
    const numero = prochainNumero(
      store.versements_clients.map((v) => v.numero),
      `VC-${today.replace(/-/g, '')}-`
    );
    const vers = {
      id: store.nextId('versements_clients'),
      numero,
      date_vers: today,
      client_id: client.id,
      vendeur_id: req.vendeur?.id ?? null,
      montant,
      mode: String(body.mode || 'Espèces'),
      reference: body.reference || null,
    };
    store.versements_clients.push(vers);
    client.solde = Math.max(0, Number((client.solde - montant).toFixed(2)));
    res.status(201).json(vers);
  }
);

// ── Tournée terrain ──
portalRouter.get(
  '/tournee/stock-camion',
  requireVendeur,
  (req: AuthedRequest, res) => {
    const vid = req.vendeur!.id;
    res.json(
      store.produits
        .filter((p) => p.actif === 1 && p.supprime === 0)
        .map((p) => {
          const f = p.facteur_conversion > 0 ? p.facteur_conversion : 1;
          const sc = store.stock_camion_vendeur.find(
            (s) => s.vendeur_id === vid && s.produit_id === p.id
          );
          return {
            produit_id: p.id,
            code: p.code,
            designation: p.designation,
            unite: p.unite,
            facteur_conversion: f,
            prix_unitaire: p.prix_vente,
            quantite_colis: sc?.quantite_colis ?? 0,
            quantite_pieces: sc?.quantite_pieces ?? 0,
            stock_depot_pieces: p.stock_actuel,
            stock_depot_colis: Number((p.stock_actuel / f).toFixed(2)),
          };
        })
    );
  }
);

portalRouter.post(
  '/tournee/pointage-gps',
  requireVendeur,
  (req: AuthedRequest, res) => {
    const body = req.body || {};
    const clientId = body.client_id ?? body.clientId ?? null;
    const codeClient = body.code_client ?? body.codeClient ?? null;
    if (!clientId && !codeClient) {
      res.status(400).json({
        detail: 'client_id (ou code_client) requis pour enregistrer un pointage.',
      });
      return;
    }
    const client = clientId
      ? store.clients.find((c) => c.id === Number(clientId))
      : store.clients.find((c) => c.code === codeClient);
    const pointage = {
      id: store.nextId('tournee_pointages'),
      client_id: client?.id ?? (clientId ? Number(clientId) : null),
      vendeur_id: req.vendeur!.id,
      code_client: client?.code ?? codeClient,
      nom_client: client?.nom ?? body.nom_client ?? body.nomClient ?? null,
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

portalRouter.get(
  '/tournee/pointages',
  requireVendeur,
  (req: AuthedRequest, res) => {
    const vid = req.vendeur!.id;
    res.json(
      store.tournee_pointages
        .filter((p) => p.vendeur_id === vid)
        .sort((a, b) => b.id - a.id)
    );
  }
);

// ── Admin / Vendeurs API ──
portalRouter.get('/admin/vendeurs', requireVendeur, (req: AuthedRequest, res) => {
  const v = req.vendeur!;
  res.json([{ id: v.id, code: v.code, nom: v.nom, tel: v.tel }]);
});

portalRouter.get(
  '/admin/vendeurs/:id/dossier',
  requireAdminUser,
  (req: AuthedRequest, res) => {
    if (!peutVoirPage(req.adminUser?.role, 'vendeurs')) {
      res
        .status(403)
        .json({ detail: 'Votre rôle ne donne pas accès à cette information.' });
      return;
    }
    const vid = Number(req.params.id);
    const vendeur = store.vendeurs.find((v) => v.id === vid);
    if (!vendeur) {
      res.status(404).json({ detail: 'Vendeur introuvable.' });
      return;
    }
    const ventes = store.bons_vente.filter(
      (b) => b.vendeur_id === vid && b.statut !== 'Annulé'
    );
    const encaisse = store.versements_clients
      .filter((v) => v.vendeur_id === vid)
      .reduce((acc, v) => acc + v.montant, 0);
    const remisAdmin = store.versements_vendeurs
      .filter((v) => v.vendeur_id === vid && v.statut !== 'Annulé')
      .reduce((acc, v) => acc + v.montant, 0);
    res.json({
      situation: {
        nb_ventes: ventes.length,
        ca_total: ventes.reduce((acc, b) => acc + b.total, 0),
        encaisse,
        remis_admin: remisAdmin,
        reste_a_verser: Math.max(0, encaisse - remisAdmin),
      },
      remises_admin: store.versements_vendeurs.filter(
        (v) => v.vendeur_id === vid
      ),
      stock_camion: store.stock_camion_vendeur
        .filter((s) => s.vendeur_id === vid)
        .map((s) => {
          const p = store.produits.find((pr) => pr.id === s.produit_id);
          return {
            ...s,
            code: p?.code,
            designation: p?.designation,
            prix_vente: p?.prix_vente ?? 0,
          };
        }),
    });
  }
);

portalRouter.post(
  '/admin/vendeurs/:id/versement',
  requireAdminUser,
  (req: AuthedRequest, res) => {
    if (!peut(req.adminUser?.role, 'encaisser_versement_vendeur')) {
      res
        .status(403)
        .json({ detail: 'Votre rôle ne permet pas cette opération.' });
      return;
    }
    const vid = Number(req.params.id);
    const vendeur = store.vendeurs.find((v) => v.id === vid);
    if (!vendeur) {
      res.status(404).json({ detail: 'Vendeur introuvable.' });
      return;
    }
    const montant = Number(req.body?.montant || 0);
    if (montant <= 0) {
      res.status(400).json({ detail: 'Montant invalide.' });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const numero = prochainNumero(
      store.versements_vendeurs.map((v) => v.numero),
      `VV-${today.replace(/-/g, '')}-`
    );
    const rem = {
      id: store.nextId('versements_vendeurs'),
      numero,
      date_vers: today,
      vendeur_id: vid,
      montant,
      mode: 'Espèces',
      observations: req.body?.observations || null,
      statut: 'Validé',
      cree_par: req.adminUser!.nom_complet,
      date_creation: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    store.versements_vendeurs.push(rem);
    ajouterAudit({
      action: 'VERSEMENT_VENDEUR',
      utilisateur: req.adminUser!.nom_complet,
      cible_type: 'vendeur',
      cible_id: vid,
      details: `${numero} — ${montant.toFixed(2)} DA`,
    });
    res.status(201).json(rem);
  }
);

// Mount complete mobile/portal vendor terrain endpoints
portalRouter.use(createPortalExtrasRouter(requireVendeur));
