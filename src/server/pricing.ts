import {
  PRIX_CONTROLE_COMMANDES,
  PRIX_MARGE_MIN_PCT,
} from './config.ts';
import type { Client, NiveauPrix } from './store.ts';
import { store } from './store.ts';

export const NIVEAU_DEFAUT: NiveauPrix = 'detail';

export const NIVEAU_LIBELLE: Record<NiveauPrix, string> = {
  super_gros: 'SUPER GROS',
  gros: 'GROS',
  detail: 'DÉTAIL',
  special: 'SPÉCIAL',
};

export interface PrixResult {
  prix: number;
  source: 'special_client' | 'palier' | 'niveau' | 'prix_vente' | 'introuvable';
  niveau: NiveauPrix;
  qte_min?: number;
  libelle: string;
}

export function normaliserNiveau(niveau?: string | null): NiveauPrix {
  const n = (niveau || '').trim().toLowerCase();
  if (n === 'super_gros' || n === 'gros' || n === 'detail' || n === 'special') {
    return n;
  }
  return NIVEAU_DEFAUT;
}

export function getNiveauClient(clientId?: number | null): NiveauPrix {
  if (!clientId) return NIVEAU_DEFAUT;
  const c = store.clients.find((x) => x.id === clientId);
  return normaliserNiveau(c?.niveau_prix);
}

export function resoudrePrix(
  produitId: number,
  options: {
    clientId?: number | null;
    quantite?: number | null;
    niveau?: string | null;
    jour?: string | null;
  } = {}
): PrixResult {
  const jour = options.jour || new Date().toISOString().slice(0, 10);
  const force = options.niveau != null && options.niveau !== '';
  const niveauEff = force
    ? normaliserNiveau(options.niveau)
    : getNiveauClient(options.clientId);

  // 1. Prix spécial client
  if (options.clientId && !force) {
    const sp = store.prix_speciaux_clients.find(
      (x) =>
        x.client_id === options.clientId &&
        x.produit_id === produitId &&
        x.actif === 1 &&
        (!x.date_debut || x.date_debut <= jour) &&
        (!x.date_fin || x.date_fin >= jour)
    );
    if (sp && sp.prix_special > 0) {
      return {
        prix: sp.prix_special,
        source: 'special_client',
        niveau: 'special',
        libelle: 'Prix spécial client ★',
      };
    }
  }

  // 2. Palier de quantité pour ce niveau
  if (options.quantite && options.quantite > 0) {
    const paliers = store.prix_paliers
      .filter(
        (p) =>
          p.produit_id === produitId &&
          p.niveau === niveauEff &&
          p.actif === 1 &&
          p.prix > 0 &&
          p.qte_min <= options.quantite!
      )
      .sort((a, b) => b.qte_min - a.qte_min);
    if (paliers.length > 0) {
      const best = paliers[0];
      return {
        prix: best.prix,
        source: 'palier',
        niveau: niveauEff,
        qte_min: best.qte_min,
        libelle: `Palier ≥ ${best.qte_min} (${NIVEAU_LIBELLE[niveauEff]})`,
      };
    }
  }

  // 3. Prix du niveau, 4. repli prix_vente
  const prod = store.produits.find((p) => p.id === produitId);
  if (!prod) {
    return {
      prix: 0,
      source: 'introuvable',
      niveau: niveauEff,
      libelle: 'Produit introuvable',
    };
  }

  const colMap: Record<NiveauPrix, number> = {
    super_gros: prod.prix_super_gros,
    gros: prod.prix_gros,
    detail: prod.prix_detail,
    special: prod.prix_special,
  };
  const val = Number(colMap[niveauEff] || 0);
  if (val > 0) {
    return {
      prix: val,
      source: 'niveau',
      niveau: niveauEff,
      libelle: `Niveau ${NIVEAU_LIBELLE[niveauEff]}`,
    };
  }
  return {
    prix: Number(prod.prix_vente || 0),
    source: 'prix_vente',
    niveau: niveauEff,
    libelle: 'Prix standard (niveau non renseigné)',
  };
}

export function coutProduit(produitId: number): number {
  const prod = store.produits.find((p) => p.id === produitId);
  if (!prod) return 0;
  return prod.prix_moyen_pondere > 0 ? prod.prix_moyen_pondere : prod.prix_achat;
}

export function verifierMarge(
  produitId: number,
  prix: number,
  margeMinPct = PRIX_MARGE_MIN_PCT
): { ok: boolean; statut: string; message: string } {
  const cout = coutProduit(produitId);
  if (cout <= 0) return { ok: true, statut: 'cout_inconnu', message: '' };
  const marge = ((prix - cout) / cout) * 100;
  if (prix < cout) {
    return {
      ok: false,
      statut: 'sous_cout',
      message: `Prix ${prix.toFixed(2)} DA inférieur au coût (${cout.toFixed(2)} DA) : vente à perte.`,
    };
  }
  if (marge < margeMinPct) {
    return {
      ok: false,
      statut: 'sous_marge',
      message: `Marge ${marge.toFixed(1)} % inférieure au minimum autorisé (${margeMinPct.toFixed(1)} %).`,
    };
  }
  return { ok: true, statut: 'ok', message: '' };
}

export function controlerLignesCommande(
  clientId: number | null,
  lignes: {
    produit_id: number;
    quantite: number;
    facteur_conversion: number;
    prix_unitaire: number;
  }[],
  estVendeur: boolean
): { produit_id: number; message: string; bloquant: boolean }[] {
  if (PRIX_CONTROLE_COMMANDES === 'off') return [];
  const anomalies: { produit_id: number; message: string; bloquant: boolean }[] = [];

  for (const item of lignes) {
    if (!item.produit_id || item.prix_unitaire <= 0) continue;
    const qteBase = item.quantite * (item.facteur_conversion || 1);
    if (clientId && !estVendeur) {
      const attendu = resoudrePrix(item.produit_id, {
        clientId,
        quantite: qteBase,
      }).prix;
      if (attendu > 0 && item.prix_unitaire < attendu - 0.01) {
        anomalies.push({
          produit_id: item.produit_id,
          message: `Produit ${item.produit_id} : prix reçu ${item.prix_unitaire.toFixed(2)} < tarif ${attendu.toFixed(2)}`,
          bloquant: PRIX_CONTROLE_COMMANDES === 'enforce',
        });
      }
    }
    const m = verifierMarge(item.produit_id, item.prix_unitaire);
    if (!m.ok) {
      anomalies.push({
        produit_id: item.produit_id,
        message: `Produit ${item.produit_id} : ${m.message}`,
        bloquant: PRIX_CONTROLE_COMMANDES === 'enforce',
      });
    }
  }
  return anomalies;
}

export function prochainNumero(
  existingNumeros: string[],
  prefixe: string
): string {
  const matches = existingNumeros.filter((n) => n && n.startsWith(prefixe));
  let maxSeq = 0;
  for (const num of matches) {
    const tail = Number.parseInt(num.slice(-4), 10);
    if (!Number.isNaN(tail) && tail > maxSeq) maxSeq = tail;
  }
  return `${prefixe}${String(maxSeq + 1).padStart(4, '0')}`;
}

export function enregistrerMouvementStock(params: {
  produit_id: number;
  type_mouvement: string;
  stock_avant: number;
  stock_apres: number;
  cout_unitaire?: number;
  pmp_apres?: number | null;
  document_type?: string | null;
  document_id?: number | null;
  document_numero?: string | null;
  tiers_nom?: string | null;
  date_document?: string | null;
  motif?: string | null;
  utilisateur?: string;
}): void {
  const quantite = Number((params.stock_apres - params.stock_avant).toFixed(6));
  if (Math.abs(quantite) < 1e-9) return;
  const cout = Number(params.cout_unitaire || 0);
  const nowTs = new Date().toISOString().replace('T', ' ').slice(0, 19);
  store.mouvements_stock.push({
    id: store.nextId('mouvements_stock'),
    date_mouvement: nowTs,
    date_document: params.date_document || nowTs.slice(0, 10),
    produit_id: params.produit_id,
    type_mouvement: params.type_mouvement,
    quantite,
    stock_avant: Number(params.stock_avant.toFixed(6)),
    stock_apres: Number(params.stock_apres.toFixed(6)),
    cout_unitaire: cout,
    valeur: Number((quantite * cout).toFixed(4)),
    pmp_apres: params.pmp_apres ?? null,
    document_type: params.document_type ?? null,
    document_id: params.document_id ?? null,
    document_numero: params.document_numero ?? null,
    tiers_nom: params.tiers_nom ?? null,
    motif: params.motif ?? null,
    utilisateur: params.utilisateur || 'Système',
  });
}

export function ajouterAudit(params: {
  action: string;
  utilisateur?: string;
  cible_type?: string | null;
  cible_id?: number | null;
  details?: string | null;
  reussite?: boolean;
}): void {
  const nowTs = new Date().toISOString().replace('T', ' ').slice(0, 19);
  store.journal_audit.push({
    id: store.nextId('journal_audit'),
    date_action: nowTs,
    utilisateur: params.utilisateur || 'Système',
    action: params.action,
    cible_type: params.cible_type ?? null,
    cible_id: params.cible_id ?? null,
    details: params.details ?? null,
    reussite: params.reussite === false ? 0 : 1,
  });
}

export interface VerificationPlafondResult {
  depasse: boolean;
  bloquant: boolean;
  force_applique: boolean;
  plafond_credit: number;
  bloquer_si_depasse: number;
  solde_actuel: number;
  reste_ajouter: number;
  solde_projete: number;
  depassement: number;
  taux_utilisation: number;
  avertissement: string | null;
}

export function verifierPlafondCredit(
  client: Client,
  resteAPayer: number,
  options: {
    forcerAdmin?: boolean;
    role?: string;
    soldeBaseOverride?: number;
  } = {}
): VerificationPlafondResult {
  const plafond = Math.max(0, Number(client.plafond_credit || 0));
  const bloquerFlag = Number(client.bloquer_si_depasse ? 1 : 0);
  const soldeActuel = Number(
    (options.soldeBaseOverride ?? client.solde ?? 0).toFixed(2)
  );
  const resteAjouter =
    client.code === 'CLT-COMPTOIR'
      ? 0
      : Math.max(0, Number(resteAPayer || 0));
  const soldeProjete = Number((soldeActuel + resteAjouter).toFixed(2));
  const depasse = plafond > 0 && soldeProjete > plafond;
  const depassement = depasse
    ? Number((soldeProjete - plafond).toFixed(2))
    : 0;
  const tauxUtilisation =
    plafond > 0 ? Number(((soldeProjete / plafond) * 100).toFixed(1)) : 0;
  const forceApplique = Boolean(
    depasse && options.forcerAdmin && options.role === 'admin'
  );
  const bloquant =
    depasse && bloquerFlag === 1 && resteAjouter > 0 && !forceApplique;

  let avertissement: string | null = null;
  if (depasse) {
    const f = (n: number) =>
      n.toLocaleString('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    const baseMsg = `Plafond de crédit dépassé pour ${client.nom} : solde projeté ${f(
      soldeProjete
    )} DA > plafond ${f(plafond)} DA (dépassement de ${f(
      depassement
    )} DA, utilisation ${tauxUtilisation}%).`;
    if (bloquant) {
      avertissement = `${baseMsg} Validation bloquée (forçage administrateur requis).`;
    } else if (forceApplique) {
      avertissement = `${baseMsg} Forçage administrateur appliqué.`;
    } else {
      avertissement = `${baseMsg} (Avertissement uniquement, blocage non activé).`;
    }
  }

  return {
    depasse,
    bloquant,
    force_applique: forceApplique,
    plafond_credit: plafond,
    bloquer_si_depasse: bloquerFlag,
    solde_actuel: soldeActuel,
    reste_ajouter: resteAjouter,
    solde_projete: soldeProjete,
    depassement,
    taux_utilisation: tauxUtilisation,
    avertissement,
  };
}

