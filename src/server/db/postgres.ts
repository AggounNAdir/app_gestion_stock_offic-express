import crypto from 'node:crypto';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { store } from '../store.ts';
import type {
  BonAchat,
  BonChargement,
  BonVente,
  Client,
  CommandeClient,
  CommandeProspect,
  DechargementCamion,
  Devis,
  Facture,
  Fournisseur,
  JournalAudit,
  LigneAchat,
  LigneVente,
  MouvementStock,
  PrixPalier,
  PrixSpecialClient,
  Produit,
  ProfilEntreprise,
  ProspectClient,
  RetourAchat,
  RetourVendeur,
  RetourVente,
  StockCamionItem,
  TourneePointage,
  Utilisateur,
  Vendeur,
  VersementClient,
  VersementFournisseur,
  VersementProspect,
  VersementVendeur,
} from '../store.ts';

let pool: Pool | null = null;
let pgActive = false;
let syncChain: Promise<void> = Promise.resolve();
const lastHashes: Record<string, string> = {};

function sha(val: unknown): string {
  return crypto.createHash('sha1').update(JSON.stringify(val)).digest('hex');
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS produits (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  barcode TEXT,
  designation TEXT NOT NULL,
  marque TEXT,
  fournisseur TEXT,
  unite TEXT NOT NULL,
  facteur_conversion DOUBLE PRECISION NOT NULL DEFAULT 1,
  prix_achat DOUBLE PRECISION NOT NULL DEFAULT 0,
  prix_moyen_pondere DOUBLE PRECISION NOT NULL DEFAULT 0,
  cout_total_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
  prix_super_gros DOUBLE PRECISION NOT NULL DEFAULT 0,
  prix_gros DOUBLE PRECISION NOT NULL DEFAULT 0,
  prix_detail DOUBLE PRECISION NOT NULL DEFAULT 0,
  prix_special DOUBLE PRECISION NOT NULL DEFAULT 0,
  prix_vente DOUBLE PRECISION NOT NULL DEFAULT 0,
  tva DOUBLE PRECISION NOT NULL DEFAULT 0,
  stock_actuel DOUBLE PRECISION NOT NULL DEFAULT 0,
  stock_min DOUBLE PRECISION NOT NULL DEFAULT 0,
  stock_retours_pieces DOUBLE PRECISION NOT NULL DEFAULT 0,
  actif INTEGER NOT NULL DEFAULT 1,
  supprime INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  adresse TEXT NOT NULL DEFAULT '',
  tel TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  ville TEXT,
  nif TEXT,
  nis TEXT,
  nrc TEXT,
  solde DOUBLE PRECISION NOT NULL DEFAULT 0,
  solde_initial DOUBLE PRECISION DEFAULT 0,
  niveau_prix TEXT NOT NULL DEFAULT 'detail',
  portail_actif INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  vendeur_id INTEGER,
  plafond_credit DOUBLE PRECISION NOT NULL DEFAULT 0,
  bloquer_si_depasse INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS plafond_credit DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS bloquer_si_depasse INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS fournisseurs (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  adresse TEXT NOT NULL DEFAULT '',
  tel TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  ville TEXT,
  nif TEXT,
  solde DOUBLE PRECISION NOT NULL DEFAULT 0,
  solde_initial DOUBLE PRECISION DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prix_speciaux_clients (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL,
  produit_id INTEGER NOT NULL,
  prix_special DOUBLE PRECISION NOT NULL,
  date_debut TEXT,
  date_fin TEXT,
  actif INTEGER NOT NULL DEFAULT 1,
  date_modification TEXT
);

CREATE TABLE IF NOT EXISTS prix_paliers (
  id INTEGER PRIMARY KEY,
  produit_id INTEGER NOT NULL,
  niveau TEXT NOT NULL,
  qte_min DOUBLE PRECISION NOT NULL,
  prix DOUBLE PRECISION NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bons_vente (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_bon TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  prospect_id INTEGER,
  vendeur_id INTEGER,
  total DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_ht DOUBLE PRECISION NOT NULL DEFAULT 0,
  tva_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_ttc DOUBLE PRECISION NOT NULL DEFAULT 0,
  remise_type TEXT,
  remise_valeur DOUBLE PRECISION DEFAULT 0,
  remise_montant DOUBLE PRECISION DEFAULT 0,
  remise_motif TEXT,
  montant_verse DOUBLE PRECISION NOT NULL DEFAULT 0,
  montant_recu DOUBLE PRECISION DEFAULT 0,
  rendu_monnaie DOUBLE PRECISION DEFAULT 0,
  mode_reglement TEXT,
  caissier_nom TEXT,
  reste_payer DOUBLE PRECISION NOT NULL DEFAULT 0,
  statut TEXT NOT NULL,
  date_echeance TEXT,
  observations TEXT,
  signature_bl TEXT,
  signataire_nom TEXT,
  date_signature TEXT
);

CREATE TABLE IF NOT EXISTS lignes_vente (
  id INTEGER PRIMARY KEY,
  bon_id INTEGER NOT NULL,
  produit_id INTEGER NOT NULL,
  designation TEXT NOT NULL,
  quantite DOUBLE PRECISION NOT NULL,
  prix_unitaire DOUBLE PRECISION NOT NULL,
  remise DOUBLE PRECISION DEFAULT 0,
  niveau_prix TEXT,
  total DOUBLE PRECISION NOT NULL,
  total_ht DOUBLE PRECISION NOT NULL,
  tva_taux DOUBLE PRECISION NOT NULL,
  total_tva DOUBLE PRECISION NOT NULL,
  total_ttc DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS bons_achat (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_bon TEXT NOT NULL,
  fournisseur_id INTEGER NOT NULL,
  total DOUBLE PRECISION NOT NULL DEFAULT 0,
  statut TEXT NOT NULL,
  observations TEXT
);

CREATE TABLE IF NOT EXISTS lignes_achat (
  id INTEGER PRIMARY KEY,
  bon_id INTEGER NOT NULL,
  produit_id INTEGER NOT NULL,
  designation TEXT NOT NULL,
  quantite DOUBLE PRECISION NOT NULL,
  prix_unitaire DOUBLE PRECISION NOT NULL,
  total DOUBLE PRECISION NOT NULL,
  tva_taux DOUBLE PRECISION NOT NULL,
  total_ht DOUBLE PRECISION NOT NULL,
  total_ttc DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS factures (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_facture TEXT NOT NULL,
  bon_vente_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  total_ht DOUBLE PRECISION NOT NULL,
  tva DOUBLE PRECISION NOT NULL,
  total_ttc DOUBLE PRECISION NOT NULL,
  statut TEXT NOT NULL,
  date_echeance TEXT,
  observations TEXT
);

CREATE TABLE IF NOT EXISTS devis (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_devis TEXT NOT NULL,
  date_validite TEXT,
  client_id INTEGER NOT NULL,
  vendeur_id INTEGER,
  total_ht DOUBLE PRECISION NOT NULL DEFAULT 0,
  tva_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_ttc DOUBLE PRECISION NOT NULL DEFAULT 0,
  remise_type TEXT,
  remise_valeur DOUBLE PRECISION DEFAULT 0,
  remise_montant DOUBLE PRECISION DEFAULT 0,
  remise_motif TEXT,
  remise DOUBLE PRECISION NOT NULL DEFAULT 0,
  statut TEXT NOT NULL,
  observations TEXT,
  bon_vente_id INTEGER,
  lignes JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS versements_clients (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_vers TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  vendeur_id INTEGER,
  montant DOUBLE PRECISION NOT NULL,
  mode TEXT NOT NULL,
  reference TEXT,
  observations TEXT
);

CREATE TABLE IF NOT EXISTS versements_fournisseurs (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_vers TEXT NOT NULL,
  fournisseur_id INTEGER NOT NULL,
  montant DOUBLE PRECISION NOT NULL,
  mode TEXT NOT NULL,
  reference TEXT,
  observations TEXT
);

CREATE TABLE IF NOT EXISTS versements_prospects (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_vers TEXT NOT NULL,
  prospect_id INTEGER NOT NULL,
  vendeur_id INTEGER,
  montant DOUBLE PRECISION NOT NULL,
  mode TEXT NOT NULL,
  reference TEXT
);

CREATE TABLE IF NOT EXISTS versements_vendeurs (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_vers TEXT NOT NULL,
  vendeur_id INTEGER NOT NULL,
  montant DOUBLE PRECISION NOT NULL,
  mode TEXT NOT NULL,
  reference TEXT,
  observations TEXT,
  statut TEXT NOT NULL,
  cree_par TEXT,
  date_creation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commandes_clients (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  vendeur_id INTEGER,
  date_commande TEXT NOT NULL,
  statut TEXT NOT NULL,
  montant_total DOUBLE PRECISION NOT NULL,
  observations TEXT,
  bon_vente_id INTEGER,
  lignes JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS commandes_prospects (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  prospect_id INTEGER NOT NULL,
  vendeur_id INTEGER,
  date_commande TEXT NOT NULL,
  statut TEXT NOT NULL,
  montant_total DOUBLE PRECISION NOT NULL,
  observations TEXT,
  lignes JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS vendeurs (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  tel TEXT NOT NULL DEFAULT '',
  actif INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT,
  session_salt TEXT
);

CREATE TABLE IF NOT EXISTS stock_camion_vendeur (
  id INTEGER PRIMARY KEY,
  vendeur_id INTEGER NOT NULL,
  produit_id INTEGER NOT NULL,
  quantite_colis DOUBLE PRECISION NOT NULL DEFAULT 0,
  quantite_pieces DOUBLE PRECISION NOT NULL DEFAULT 0,
  date_maj TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bons_chargement (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_chargement TEXT NOT NULL,
  vendeur_id INTEGER NOT NULL,
  statut TEXT NOT NULL,
  total_colis DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_pieces DOUBLE PRECISION NOT NULL DEFAULT 0,
  observations TEXT,
  lignes JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS dechargements_camion (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_dechargement TEXT NOT NULL,
  vendeur_id INTEGER NOT NULL,
  statut TEXT NOT NULL,
  observations TEXT,
  motif_rejet TEXT,
  traite_par TEXT,
  lignes JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS retours_vente (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_retour TEXT NOT NULL,
  bon_vente_id INTEGER,
  client_id INTEGER NOT NULL,
  total DOUBLE PRECISION NOT NULL DEFAULT 0,
  motif TEXT,
  observations TEXT,
  statut TEXT NOT NULL,
  lignes JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS retours_achat (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_retour TEXT NOT NULL,
  bon_achat_id INTEGER,
  fournisseur_id INTEGER NOT NULL,
  total DOUBLE PRECISION NOT NULL DEFAULT 0,
  motif TEXT,
  observations TEXT,
  statut TEXT NOT NULL,
  lignes JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS retours_vendeur (
  id INTEGER PRIMARY KEY,
  numero TEXT NOT NULL,
  date_retour TEXT NOT NULL,
  vendeur_id INTEGER NOT NULL,
  retourne_par TEXT,
  motif TEXT NOT NULL,
  decision TEXT NOT NULL,
  imputation TEXT NOT NULL,
  statut TEXT NOT NULL,
  valeur_totale DOUBLE PRECISION NOT NULL DEFAULT 0,
  observations TEXT,
  motif_rejet TEXT,
  traite_par TEXT,
  date_traitement TEXT,
  lignes JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS prospects_clients (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  tel TEXT,
  adresse TEXT,
  wilaya TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  vendeur_id INTEGER,
  date_creation TEXT NOT NULL,
  statut TEXT NOT NULL,
  client_id INTEGER,
  solde DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tournee_pointages (
  id INTEGER PRIMARY KEY,
  client_id INTEGER,
  vendeur_id INTEGER NOT NULL,
  code_client TEXT,
  nom_client TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  date_pointage TEXT NOT NULL,
  observations TEXT
);

CREATE TABLE IF NOT EXISTS mouvements_stock (
  id INTEGER PRIMARY KEY,
  date_mouvement TEXT NOT NULL,
  date_document TEXT,
  produit_id INTEGER NOT NULL,
  type_mouvement TEXT NOT NULL,
  quantite DOUBLE PRECISION NOT NULL,
  stock_avant DOUBLE PRECISION NOT NULL,
  stock_apres DOUBLE PRECISION NOT NULL,
  cout_unitaire DOUBLE PRECISION NOT NULL,
  valeur DOUBLE PRECISION NOT NULL,
  pmp_apres DOUBLE PRECISION,
  document_type TEXT,
  document_id INTEGER,
  document_numero TEXT,
  tiers_nom TEXT,
  motif TEXT,
  utilisateur TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS utilisateurs (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  nom_complet TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1,
  doit_changer_mdp INTEGER NOT NULL DEFAULT 0,
  date_creation TEXT NOT NULL,
  derniere_connexion TEXT,
  cree_par TEXT
);

CREATE TABLE IF NOT EXISTS journal_audit (
  id INTEGER PRIMARY KEY,
  date_action TEXT NOT NULL,
  utilisateur TEXT NOT NULL,
  action TEXT NOT NULL,
  cible_type TEXT,
  cible_id INTEGER,
  details TEXT,
  reussite INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS profils_entreprise (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  type_profil TEXT NOT NULL,
  forme_juridique TEXT,
  activite TEXT,
  capital_social TEXT,
  adresse TEXT NOT NULL DEFAULT '',
  telephone TEXT NOT NULL DEFAULT '',
  telephone2 TEXT,
  email TEXT NOT NULL DEFAULT '',
  site_web TEXT,
  ville TEXT NOT NULL DEFAULT '',
  code_postal TEXT,
  nif TEXT NOT NULL DEFAULT '',
  nis TEXT NOT NULL DEFAULT '',
  nrc TEXT NOT NULL DEFAULT '',
  registre_commerce TEXT,
  art_imp TEXT NOT NULL DEFAULT '',
  banque TEXT,
  rib TEXT,
  devise TEXT,
  tva_defaut DOUBLE PRECISION,
  prefixe_bv TEXT,
  prefixe_facture TEXT,
  pied_page TEXT,
  logo_data TEXT,
  est_defaut INTEGER NOT NULL DEFAULT 0,
  actif INTEGER NOT NULL DEFAULT 1,
  date_creation TEXT
);

ALTER TABLE bons_vente ADD COLUMN IF NOT EXISTS date_echeance TEXT;
ALTER TABLE bons_vente ADD COLUMN IF NOT EXISTS montant_recu DOUBLE PRECISION DEFAULT 0;
ALTER TABLE bons_vente ADD COLUMN IF NOT EXISTS rendu_monnaie DOUBLE PRECISION DEFAULT 0;
ALTER TABLE bons_vente ADD COLUMN IF NOT EXISTS mode_reglement TEXT;
ALTER TABLE bons_vente ADD COLUMN IF NOT EXISTS caissier_nom TEXT;
`;

async function replaceTableRows(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: unknown[][]
): Promise<void> {
  await client.query(`DELETE FROM ${table}`);
  if (rows.length === 0) return;

  const colCount = columns.length;
  const colList = columns.join(', ');
  const batchSize = 200;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders = batch
      .map((row, rowIdx) => {
        const base = rowIdx * colCount;
        for (let c = 0; c < colCount; c++) {
          values.push(row[c] === undefined ? null : row[c]);
        }
        return `(${columns.map((_, c) => `$${base + c + 1}`).join(', ')})`;
      })
      .join(', ');
    await client.query(
      `INSERT INTO ${table} (${colList}) VALUES ${placeholders}`,
      values
    );
  }
}

function buildTableData(): Record<
  string,
  { columns: string[]; rows: unknown[][] }
> {
  const lignesVente: LigneVente[] = [];
  for (const b of store.bons_vente) {
    for (const l of b.lignes || []) {
      lignesVente.push({ ...l, bon_id: b.id });
    }
  }
  const lignesAchat: LigneAchat[] = [];
  for (const b of store.bons_achat) {
    for (const l of b.lignes || []) {
      lignesAchat.push({ ...l, bon_id: b.id });
    }
  }

  return {
    produits: {
      columns: [
        'id', 'code', 'barcode', 'designation', 'marque', 'fournisseur', 'unite',
        'facteur_conversion', 'prix_achat', 'prix_moyen_pondere', 'cout_total_stock',
        'prix_super_gros', 'prix_gros', 'prix_detail', 'prix_special', 'prix_vente',
        'tva', 'stock_actuel', 'stock_min', 'stock_retours_pieces', 'actif', 'supprime',
      ],
      rows: store.produits.map((p) => [
        p.id, p.code, p.barcode ?? null, p.designation, p.marque ?? null,
        p.fournisseur ?? null, p.unite, p.facteur_conversion, p.prix_achat,
        p.prix_moyen_pondere, p.cout_total_stock, p.prix_super_gros, p.prix_gros,
        p.prix_detail, p.prix_special, p.prix_vente, p.tva, p.stock_actuel,
        p.stock_min, p.stock_retours_pieces, p.actif, p.supprime,
      ]),
    },
    clients: {
      columns: [
        'id', 'code', 'nom', 'adresse', 'tel', 'email', 'ville', 'nif', 'nis',
        'nrc', 'solde', 'solde_initial', 'niveau_prix', 'portail_actif',
        'password_hash', 'latitude', 'longitude', 'vendeur_id',
        'plafond_credit', 'bloquer_si_depasse',
      ],
      rows: store.clients.map((c) => [
        c.id, c.code, c.nom, c.adresse, c.tel, c.email, c.ville ?? null,
        c.nif ?? null, c.nis ?? null, c.nrc ?? null, c.solde,
        c.solde_initial ?? 0, c.niveau_prix, c.portail_actif,
        c.password_hash ?? null, c.latitude ?? null, c.longitude ?? null,
        c.vendeur_id ?? null,
        Math.max(0, Number(c.plafond_credit || 0)),
        Number(c.bloquer_si_depasse ? 1 : 0),
      ]),
    },
    fournisseurs: {
      columns: [
        'id', 'code', 'nom', 'adresse', 'tel', 'email', 'ville', 'nif',
        'solde', 'solde_initial',
      ],
      rows: store.fournisseurs.map((f) => [
        f.id, f.code, f.nom, f.adresse, f.tel, f.email, f.ville ?? null,
        f.nif ?? null, f.solde, f.solde_initial ?? 0,
      ]),
    },
    prix_speciaux_clients: {
      columns: [
        'id', 'client_id', 'produit_id', 'prix_special', 'date_debut',
        'date_fin', 'actif', 'date_modification',
      ],
      rows: store.prix_speciaux_clients.map((x) => [
        x.id, x.client_id, x.produit_id, x.prix_special, x.date_debut ?? null,
        x.date_fin ?? null, x.actif, x.date_modification ?? null,
      ]),
    },
    prix_paliers: {
      columns: ['id', 'produit_id', 'niveau', 'qte_min', 'prix', 'actif'],
      rows: store.prix_paliers.map((x) => [
        x.id, x.produit_id, x.niveau, x.qte_min, x.prix, x.actif,
      ]),
    },
    bons_vente: {
      columns: [
        'id', 'numero', 'date_bon', 'client_id', 'prospect_id', 'vendeur_id',
        'total', 'total_ht', 'tva_total', 'total_ttc', 'remise_type',
        'remise_valeur', 'remise_montant', 'remise_motif', 'montant_verse',
        'montant_recu', 'rendu_monnaie', 'mode_reglement', 'caissier_nom',
        'reste_payer', 'statut', 'date_echeance', 'observations', 'signature_bl',
        'signataire_nom', 'date_signature',
      ],
      rows: store.bons_vente.map((b) => [
        b.id, b.numero, b.date_bon, b.client_id, b.prospect_id ?? null,
        b.vendeur_id ?? null, b.total, b.total_ht, b.tva_total, b.total_ttc,
        b.remise_type ?? null, b.remise_valeur ?? 0, b.remise_montant ?? 0,
        b.remise_motif ?? null, b.montant_verse, b.montant_recu ?? null,
        b.rendu_monnaie ?? null, b.mode_reglement ?? null, b.caissier_nom ?? null,
        b.reste_payer, b.statut, b.date_echeance ?? null, b.observations ?? null,
        b.signature_bl ?? null, b.signataire_nom ?? null, b.date_signature ?? null,
      ]),
    },
    lignes_vente: {
      columns: [
        'id', 'bon_id', 'produit_id', 'designation', 'quantite',
        'prix_unitaire', 'remise', 'niveau_prix', 'total', 'total_ht',
        'tva_taux', 'total_tva', 'total_ttc',
      ],
      rows: lignesVente.map((l) => [
        l.id, l.bon_id, l.produit_id, l.designation, l.quantite,
        l.prix_unitaire, l.remise ?? 0, l.niveau_prix ?? null, l.total,
        l.total_ht, l.tva_taux, l.total_tva, l.total_ttc,
      ]),
    },
    bons_achat: {
      columns: [
        'id', 'numero', 'date_bon', 'fournisseur_id', 'total', 'statut',
        'observations',
      ],
      rows: store.bons_achat.map((b) => [
        b.id, b.numero, b.date_bon, b.fournisseur_id, b.total, b.statut,
        b.observations ?? null,
      ]),
    },
    lignes_achat: {
      columns: [
        'id', 'bon_id', 'produit_id', 'designation', 'quantite',
        'prix_unitaire', 'total', 'tva_taux', 'total_ht', 'total_ttc',
      ],
      rows: lignesAchat.map((l) => [
        l.id, l.bon_id, l.produit_id, l.designation, l.quantite,
        l.prix_unitaire, l.total, l.tva_taux, l.total_ht, l.total_ttc,
      ]),
    },
    factures: {
      columns: [
        'id', 'numero', 'date_facture', 'bon_vente_id', 'client_id',
        'total_ht', 'tva', 'total_ttc', 'statut', 'date_echeance',
        'observations',
      ],
      rows: store.factures.map((f) => [
        f.id, f.numero, f.date_facture, f.bon_vente_id, f.client_id,
        f.total_ht, f.tva, f.total_ttc, f.statut, f.date_echeance ?? null,
        f.observations ?? null,
      ]),
    },
    devis: {
      columns: [
        'id', 'numero', 'date_devis', 'date_validite', 'client_id', 'vendeur_id',
        'total_ht', 'tva_total', 'total_ttc', 'remise_type', 'remise_valeur',
        'remise_montant', 'remise_motif', 'remise', 'statut', 'observations',
        'bon_vente_id', 'lignes',
      ],
      rows: store.devis.map((dv) => [
        dv.id, dv.numero, dv.date_devis, dv.date_validite ?? null, dv.client_id,
        dv.vendeur_id ?? null, dv.total_ht, dv.tva_total, dv.total_ttc,
        dv.remise_type ?? 'aucune', dv.remise_valeur ?? 0,
        dv.remise_montant ?? 0, dv.remise_motif ?? null, dv.remise ?? 0,
        dv.statut, dv.observations ?? null, dv.bon_vente_id ?? null,
        JSON.stringify(dv.lignes || []),
      ]),
    },
    versements_clients: {
      columns: [
        'id', 'numero', 'date_vers', 'client_id', 'vendeur_id', 'montant',
        'mode', 'reference', 'observations',
      ],
      rows: store.versements_clients.map((v) => [
        v.id, v.numero, v.date_vers, v.client_id, v.vendeur_id ?? null,
        v.montant, v.mode, v.reference ?? null, v.observations ?? null,
      ]),
    },
    versements_fournisseurs: {
      columns: [
        'id', 'numero', 'date_vers', 'fournisseur_id', 'montant', 'mode',
        'reference', 'observations',
      ],
      rows: store.versements_fournisseurs.map((v) => [
        v.id, v.numero, v.date_vers, v.fournisseur_id, v.montant, v.mode,
        v.reference ?? null, v.observations ?? null,
      ]),
    },
    versements_prospects: {
      columns: [
        'id', 'numero', 'date_vers', 'prospect_id', 'vendeur_id', 'montant',
        'mode', 'reference',
      ],
      rows: store.versements_prospects.map((v) => [
        v.id, v.numero, v.date_vers, v.prospect_id, v.vendeur_id ?? null,
        v.montant, v.mode, v.reference ?? null,
      ]),
    },
    versements_vendeurs: {
      columns: [
        'id', 'numero', 'date_vers', 'vendeur_id', 'montant', 'mode',
        'reference', 'observations', 'statut', 'cree_par', 'date_creation',
      ],
      rows: store.versements_vendeurs.map((v) => [
        v.id, v.numero, v.date_vers, v.vendeur_id, v.montant, v.mode,
        v.reference ?? null, v.observations ?? null, v.statut,
        v.cree_par ?? null, v.date_creation,
      ]),
    },
    commandes_clients: {
      columns: [
        'id', 'numero', 'client_id', 'vendeur_id', 'date_commande', 'statut',
        'montant_total', 'observations', 'bon_vente_id', 'lignes',
      ],
      rows: store.commandes_clients.map((c) => [
        c.id, c.numero, c.client_id, c.vendeur_id ?? null, c.date_commande,
        c.statut, c.montant_total, c.observations ?? null,
        c.bon_vente_id ?? null, JSON.stringify(c.lignes || []),
      ]),
    },
    commandes_prospects: {
      columns: [
        'id', 'numero', 'prospect_id', 'vendeur_id', 'date_commande', 'statut',
        'montant_total', 'observations', 'lignes',
      ],
      rows: store.commandes_prospects.map((c) => [
        c.id, c.numero, c.prospect_id, c.vendeur_id ?? null, c.date_commande,
        c.statut, c.montant_total, c.observations ?? null,
        JSON.stringify(c.lignes || []),
      ]),
    },
    vendeurs: {
      columns: [
        'id', 'code', 'nom', 'tel', 'actif', 'password_hash', 'session_salt',
      ],
      rows: store.vendeurs.map((v) => [
        v.id, v.code, v.nom, v.tel, v.actif, v.password_hash ?? null,
        v.session_salt ?? null,
      ]),
    },
    stock_camion_vendeur: {
      columns: [
        'id', 'vendeur_id', 'produit_id', 'quantite_colis', 'quantite_pieces',
        'date_maj',
      ],
      rows: store.stock_camion_vendeur.map((s) => [
        s.id, s.vendeur_id, s.produit_id, s.quantite_colis, s.quantite_pieces,
        s.date_maj,
      ]),
    },
    bons_chargement: {
      columns: [
        'id', 'numero', 'date_chargement', 'vendeur_id', 'statut',
        'total_colis', 'total_pieces', 'observations', 'lignes',
      ],
      rows: store.bons_chargement.map((b) => [
        b.id, b.numero, b.date_chargement, b.vendeur_id, b.statut,
        b.total_colis, b.total_pieces, b.observations ?? null,
        JSON.stringify(b.lignes || []),
      ]),
    },
    dechargements_camion: {
      columns: [
        'id', 'numero', 'date_dechargement', 'vendeur_id', 'statut',
        'observations', 'motif_rejet', 'traite_par', 'lignes',
      ],
      rows: store.dechargements_camion.map((d) => [
        d.id, d.numero, d.date_dechargement, d.vendeur_id, d.statut,
        d.observations ?? null, d.motif_rejet ?? null, d.traite_par ?? null,
        JSON.stringify(d.lignes || []),
      ]),
    },
    retours_vente: {
      columns: [
        'id', 'numero', 'date_retour', 'bon_vente_id', 'client_id', 'total',
        'motif', 'observations', 'statut', 'lignes',
      ],
      rows: store.retours_vente.map((r) => [
        r.id, r.numero, r.date_retour, r.bon_vente_id ?? null, r.client_id,
        r.total, r.motif ?? null, r.observations ?? null, r.statut,
        JSON.stringify(r.lignes || []),
      ]),
    },
    retours_achat: {
      columns: [
        'id', 'numero', 'date_retour', 'bon_achat_id', 'fournisseur_id',
        'total', 'motif', 'observations', 'statut', 'lignes',
      ],
      rows: store.retours_achat.map((r) => [
        r.id, r.numero, r.date_retour, r.bon_achat_id ?? null,
        r.fournisseur_id, r.total, r.motif ?? null, r.observations ?? null,
        r.statut, JSON.stringify(r.lignes || []),
      ]),
    },
    retours_vendeur: {
      columns: [
        'id', 'numero', 'date_retour', 'vendeur_id', 'retourne_par', 'motif',
        'decision', 'imputation', 'statut', 'valeur_totale', 'observations',
        'motif_rejet', 'traite_par', 'date_traitement', 'lignes',
      ],
      rows: store.retours_vendeur.map((r) => [
        r.id, r.numero, r.date_retour, r.vendeur_id, r.retourne_par ?? null,
        r.motif, r.decision, r.imputation, r.statut, r.valeur_totale,
        r.observations ?? null, r.motif_rejet ?? null, r.traite_par ?? null,
        r.date_traitement ?? null, JSON.stringify(r.lignes || []),
      ]),
    },
    prospects_clients: {
      columns: [
        'id', 'code', 'nom', 'tel', 'adresse', 'wilaya', 'latitude',
        'longitude', 'vendeur_id', 'date_creation', 'statut', 'client_id',
        'solde',
      ],
      rows: store.prospects_clients.map((p) => [
        p.id, p.code, p.nom, p.tel ?? null, p.adresse ?? null,
        p.wilaya ?? null, p.latitude ?? null, p.longitude ?? null,
        p.vendeur_id ?? null, p.date_creation, p.statut,
        p.client_id ?? null, p.solde,
      ]),
    },
    tournee_pointages: {
      columns: [
        'id', 'client_id', 'vendeur_id', 'code_client', 'nom_client',
        'latitude', 'longitude', 'date_pointage', 'observations',
      ],
      rows: store.tournee_pointages.map((t) => [
        t.id, t.client_id ?? null, t.vendeur_id, t.code_client ?? null,
        t.nom_client ?? null, t.latitude ?? null, t.longitude ?? null,
        t.date_pointage, t.observations ?? null,
      ]),
    },
    mouvements_stock: {
      columns: [
        'id', 'date_mouvement', 'date_document', 'produit_id', 'type_mouvement',
        'quantite', 'stock_avant', 'stock_apres', 'cout_unitaire', 'valeur',
        'pmp_apres', 'document_type', 'document_id', 'document_numero',
        'tiers_nom', 'motif', 'utilisateur',
      ],
      rows: store.mouvements_stock.map((m) => [
        m.id, m.date_mouvement, m.date_document ?? null, m.produit_id,
        m.type_mouvement, m.quantite, m.stock_avant, m.stock_apres,
        m.cout_unitaire, m.valeur, m.pmp_apres ?? null,
        m.document_type ?? null, m.document_id ?? null,
        m.document_numero ?? null, m.tiers_nom ?? null, m.motif ?? null,
        m.utilisateur,
      ]),
    },
    utilisateurs: {
      columns: [
        'id', 'username', 'nom_complet', 'password_hash', 'role', 'actif',
        'doit_changer_mdp', 'date_creation', 'derniere_connexion', 'cree_par',
      ],
      rows: store.utilisateurs.map((u) => [
        u.id, u.username, u.nom_complet, u.password_hash, u.role, u.actif,
        u.doit_changer_mdp, u.date_creation, u.derniere_connexion ?? null,
        u.cree_par ?? null,
      ]),
    },
    journal_audit: {
      columns: [
        'id', 'date_action', 'utilisateur', 'action', 'cible_type',
        'cible_id', 'details', 'reussite',
      ],
      rows: store.journal_audit.map((j) => [
        j.id, j.date_action, j.utilisateur, j.action, j.cible_type ?? null,
        j.cible_id ?? null, j.details ?? null, j.reussite,
      ]),
    },
    profils_entreprise: {
      columns: [
        'id', 'code', 'nom', 'type_profil', 'forme_juridique', 'activite',
        'capital_social', 'adresse', 'telephone', 'telephone2', 'email',
        'site_web', 'ville', 'code_postal', 'nif', 'nis', 'nrc',
        'registre_commerce', 'art_imp', 'banque', 'rib', 'devise',
        'tva_defaut', 'prefixe_bv', 'prefixe_facture', 'pied_page',
        'logo_data', 'est_defaut', 'actif', 'date_creation',
      ],
      rows: store.profils_entreprise.map((pr) => [
        pr.id, pr.code, pr.nom, pr.type_profil, pr.forme_juridique ?? null,
        pr.activite ?? null, pr.capital_social ?? null, pr.adresse,
        pr.telephone, pr.telephone2 ?? null, pr.email, pr.site_web ?? null,
        pr.ville, pr.code_postal ?? null, pr.nif, pr.nis, pr.nrc,
        pr.registre_commerce ?? null, pr.art_imp, pr.banque ?? null,
        pr.rib ?? null, pr.devise ?? null, pr.tva_defaut ?? null,
        pr.prefixe_bv ?? null, pr.prefixe_facture ?? null,
        pr.pied_page ?? null, pr.logo_data ?? null, pr.est_defaut,
        pr.actif, pr.date_creation ?? null,
      ]),
    },
  };
}

function getConfigEntries(): Record<string, unknown> {
  return {
    document_profils: store.document_profils,
    marques_custom: store.marques_custom,
    unites_custom: store.unites_custom,
    sequences: store.getSeqSnapshot(),
  };
}

async function flushAllOrDiff(forceAll: boolean): Promise<void> {
  if (!pgActive || !pool) return;
  const tables = buildTableData();
  const configs = getConfigEntries();

  const dirtyTables: string[] = [];
  for (const [name, data] of Object.entries(tables)) {
    const h = sha(data.rows);
    if (forceAll || lastHashes[name] !== h) {
      dirtyTables.push(name);
    }
  }
  const configHash = sha(configs);
  const configDirty = forceAll || lastHashes.__app_config !== configHash;

  if (dirtyTables.length === 0 && !configDirty) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const name of dirtyTables) {
      await replaceTableRows(client, name, tables[name].columns, tables[name].rows);
    }
    if (configDirty) {
      for (const [key, value] of Object.entries(configs)) {
        await client.query(
          `INSERT INTO app_config (key, value) VALUES ($1, $2::jsonb)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [key, JSON.stringify(value)]
        );
      }
    }
    await client.query('COMMIT');
    for (const name of dirtyTables) {
      lastHashes[name] = sha(tables[name].rows);
    }
    if (configDirty) {
      lastHashes.__app_config = configHash;
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function hydrateFromPostgres(): Promise<void> {
  if (!pool) return;
  const q = async <T = any>(sql: string): Promise<T[]> => {
    const res = await pool!.query(sql);
    return res.rows as T[];
  };

  store.produits = (await q<Produit>('SELECT * FROM produits ORDER BY id')).map((p) => ({
    ...p,
    code: p.code || `PRD-${p.id}`,
    designation: p.designation || 'Produit',
    unite: p.unite || 'Pièce',
    facteur_conversion: Number(p.facteur_conversion || 1),
    prix_achat: Number(p.prix_achat || 0),
    prix_moyen_pondere: Number(p.prix_moyen_pondere || p.prix_achat || 0),
    cout_total_stock: Number(p.cout_total_stock || 0),
    prix_super_gros: Number(p.prix_super_gros || 0),
    prix_gros: Number(p.prix_gros || 0),
    prix_detail: Number(p.prix_detail || p.prix_vente || 0),
    prix_special: Number(p.prix_special || 0),
    prix_vente: Number(p.prix_vente || p.prix_detail || 0),
    tva: Number(p.tva || 0),
    stock_actuel: Number(p.stock_actuel || 0),
    stock_min: Number(p.stock_min || 0),
    stock_retours_pieces: Number(p.stock_retours_pieces || 0),
    actif: Number(p.actif ?? 1),
    supprime: Number(p.supprime ?? 0),
  }));
  store.clients = (await q<Client>('SELECT * FROM clients ORDER BY id')).map((c) => ({
    ...c,
    code: c.code || `CLT-${c.id}`,
    nom: c.nom || 'Client',
    adresse: c.adresse ?? '',
    tel: c.tel ?? '',
    email: c.email ?? '',
    solde: Number(c.solde || 0),
    solde_initial: Number(c.solde_initial || 0),
    niveau_prix: (c.niveau_prix || 'detail') as Client['niveau_prix'],
    portail_actif: Number(c.portail_actif ?? 1),
    plafond_credit: Math.max(0, Number(c.plafond_credit || 0)),
    bloquer_si_depasse: Number(c.bloquer_si_depasse ? 1 : 0),
  }));
  store.fournisseurs = (await q<Fournisseur>('SELECT * FROM fournisseurs ORDER BY id')).map((f) => ({
    ...f,
    code: f.code || `FRN-${f.id}`,
    nom: f.nom || 'Fournisseur',
    adresse: f.adresse ?? '',
    tel: f.tel ?? '',
    email: f.email ?? '',
    solde: Number(f.solde || 0),
    solde_initial: Number(f.solde_initial || 0),
  }));
  store.prix_speciaux_clients = await q<PrixSpecialClient>(
    'SELECT * FROM prix_speciaux_clients ORDER BY id'
  );
  store.prix_paliers = await q<PrixPalier>('SELECT * FROM prix_paliers ORDER BY id');

  const bvRows = await q<Omit<BonVente, 'lignes'>>('SELECT * FROM bons_vente ORDER BY id');
  const lvRows = await q<LigneVente>('SELECT * FROM lignes_vente ORDER BY id');
  const lvByBon = new Map<number, LigneVente[]>();
  for (const l of lvRows) {
    const arr = lvByBon.get(l.bon_id) || [];
    arr.push(l);
    lvByBon.set(l.bon_id, arr);
  }
  store.bons_vente = bvRows.map((b) => ({
    ...b,
    montant_recu: b.montant_recu ?? null,
    rendu_monnaie: b.rendu_monnaie ?? null,
    mode_reglement: b.mode_reglement ?? null,
    caissier_nom: b.caissier_nom ?? null,
    date_echeance: b.date_echeance ?? null,
    lignes: lvByBon.get(b.id) || [],
  }));

  const baRows = await q<Omit<BonAchat, 'lignes'>>('SELECT * FROM bons_achat ORDER BY id');
  const laRows = await q<LigneAchat>('SELECT * FROM lignes_achat ORDER BY id');
  const laByBon = new Map<number, LigneAchat[]>();
  for (const l of laRows) {
    const arr = laByBon.get(l.bon_id) || [];
    arr.push(l);
    laByBon.set(l.bon_id, arr);
  }
  store.bons_achat = baRows.map((b) => ({ ...b, lignes: laByBon.get(b.id) || [] }));

  store.factures = await q<Facture>('SELECT * FROM factures ORDER BY id');
  store.devis = (await q<Devis>('SELECT * FROM devis ORDER BY id')).map((dv) => ({
    ...dv,
    total_ht: Number(dv.total_ht || 0),
    tva_total: Number(dv.tva_total || 0),
    total_ttc: Number(dv.total_ttc || 0),
    remise_valeur: Number(dv.remise_valeur || 0),
    remise_montant: Number(dv.remise_montant || 0),
    remise: Number(dv.remise || 0),
    lignes: Array.isArray(dv.lignes) ? dv.lignes : [],
  }));
  store.versements_clients = await q<VersementClient>(
    'SELECT * FROM versements_clients ORDER BY id'
  );
  store.versements_fournisseurs = await q<VersementFournisseur>(
    'SELECT * FROM versements_fournisseurs ORDER BY id'
  );
  store.versements_prospects = await q<VersementProspect>(
    'SELECT * FROM versements_prospects ORDER BY id'
  );
  store.versements_vendeurs = await q<VersementVendeur>(
    'SELECT * FROM versements_vendeurs ORDER BY id'
  );
  store.commandes_clients = await q<CommandeClient>(
    'SELECT * FROM commandes_clients ORDER BY id'
  );
  store.commandes_prospects = await q<CommandeProspect>(
    'SELECT * FROM commandes_prospects ORDER BY id'
  );
  store.vendeurs = await q<Vendeur>('SELECT * FROM vendeurs ORDER BY id');
  store.stock_camion_vendeur = await q<StockCamionItem>(
    'SELECT * FROM stock_camion_vendeur ORDER BY id'
  );
  store.bons_chargement = await q<BonChargement>(
    'SELECT * FROM bons_chargement ORDER BY id'
  );
  store.dechargements_camion = await q<DechargementCamion>(
    'SELECT * FROM dechargements_camion ORDER BY id'
  );
  store.retours_vente = await q<RetourVente>('SELECT * FROM retours_vente ORDER BY id');
  store.retours_achat = await q<RetourAchat>('SELECT * FROM retours_achat ORDER BY id');
  store.retours_vendeur = await q<RetourVendeur>(
    'SELECT * FROM retours_vendeur ORDER BY id'
  );
  store.prospects_clients = await q<ProspectClient>(
    'SELECT * FROM prospects_clients ORDER BY id'
  );
  store.tournee_pointages = await q<TourneePointage>(
    'SELECT * FROM tournee_pointages ORDER BY id'
  );
  store.mouvements_stock = await q<MouvementStock>(
    'SELECT * FROM mouvements_stock ORDER BY id'
  );
  store.utilisateurs = await q<Utilisateur>('SELECT * FROM utilisateurs ORDER BY id');
  store.journal_audit = await q<JournalAudit>('SELECT * FROM journal_audit ORDER BY id');
  store.profils_entreprise = await q<ProfilEntreprise>(
    'SELECT * FROM profils_entreprise ORDER BY id'
  );

  const cfgRows = await q<{ key: string; value: any }>('SELECT key, value FROM app_config');
  for (const row of cfgRows) {
    if (row.key === 'document_profils' && row.value) store.document_profils = row.value;
    if (row.key === 'marques_custom' && Array.isArray(row.value)) {
      store.marques_custom = row.value;
    }
    if (row.key === 'unites_custom' && Array.isArray(row.value)) {
      store.unites_custom = row.value;
    }
    if (row.key === 'sequences' && row.value) {
      store.restoreSeqSnapshot(row.value);
    }
  }

  // Ensure sequence counters are always >= max(id) of loaded rows
  const maxIds: Record<string, number> = {
    produits: Math.max(0, ...store.produits.map((x) => x.id)),
    clients: Math.max(0, ...store.clients.map((x) => x.id)),
    fournisseurs: Math.max(0, ...store.fournisseurs.map((x) => x.id)),
    prix_speciaux_clients: Math.max(0, ...store.prix_speciaux_clients.map((x) => x.id)),
    prix_paliers: Math.max(0, ...store.prix_paliers.map((x) => x.id)),
    bons_vente: Math.max(0, ...store.bons_vente.map((x) => x.id)),
    lignes_vente: Math.max(0, ...lvRows.map((x) => x.id)),
    bons_achat: Math.max(0, ...store.bons_achat.map((x) => x.id)),
    lignes_achat: Math.max(0, ...laRows.map((x) => x.id)),
    factures: Math.max(0, ...store.factures.map((x) => x.id)),
    devis: Math.max(0, ...store.devis.map((x) => x.id)),
    lignes_devis: Math.max(0, ...store.devis.flatMap((dv) => (dv.lignes || []).map((l) => l.id || 0))),
    versements_clients: Math.max(0, ...store.versements_clients.map((x) => x.id)),
    versements_fournisseurs: Math.max(
      0,
      ...store.versements_fournisseurs.map((x) => x.id)
    ),
    versements_prospects: Math.max(0, ...store.versements_prospects.map((x) => x.id)),
    versements_vendeurs: Math.max(0, ...store.versements_vendeurs.map((x) => x.id)),
    commandes_clients: Math.max(0, ...store.commandes_clients.map((x) => x.id)),
    commandes_prospects: Math.max(0, ...store.commandes_prospects.map((x) => x.id)),
    vendeurs: Math.max(0, ...store.vendeurs.map((x) => x.id)),
    stock_camion_vendeur: Math.max(0, ...store.stock_camion_vendeur.map((x) => x.id)),
    bons_chargement: Math.max(0, ...store.bons_chargement.map((x) => x.id)),
    dechargements_camion: Math.max(0, ...store.dechargements_camion.map((x) => x.id)),
    retours_vente: Math.max(0, ...store.retours_vente.map((x) => x.id)),
    retours_achat: Math.max(0, ...store.retours_achat.map((x) => x.id)),
    retours_vendeur: Math.max(0, ...store.retours_vendeur.map((x) => x.id)),
    prospects_clients: Math.max(0, ...store.prospects_clients.map((x) => x.id)),
    tournee_pointages: Math.max(0, ...store.tournee_pointages.map((x) => x.id)),
    mouvements_stock: Math.max(0, ...store.mouvements_stock.map((x) => x.id)),
    utilisateurs: Math.max(0, ...store.utilisateurs.map((x) => x.id)),
    journal_audit: Math.max(0, ...store.journal_audit.map((x) => x.id)),
    profils_entreprise: Math.max(0, ...store.profils_entreprise.map((x) => x.id)),
  };
  store.restoreSeqSnapshot(maxIds);

  // Snapshot initial hashes so unchanged tables are not re-written
  const tables = buildTableData();
  for (const [name, data] of Object.entries(tables)) {
    lastHashes[name] = sha(data.rows);
  }
  lastHashes.__app_config = sha(getConfigEntries());
}

export async function initPostgresStore(): Promise<void> {
  const database = (process.env.PGDATABASE || '').trim();
  const host = (process.env.PGHOST || 'localhost').trim();
  const port = Number(process.env.PGPORT || 5432);
  const user = (process.env.PGUSER || 'postgres').trim();
  const password = process.env.PGPASSWORD ?? '';

  if (!database || password === 'votre_mot_de_passe') {
    console.log(
      '[PostgreSQL] Configuration .env absente ou exemple — mode mémoire actif.'
    );
    return;
  }

  const candidatePool = new Pool({
    host,
    port,
    user,
    password,
    database,
    max: 10,
    connectionTimeoutMillis: 3000,
  });

  candidatePool.on('error', (err) => {
    console.error('[PostgreSQL] Erreur pool idle:', err.message);
  });

  try {
    await candidatePool.query('SELECT 1');
    pool = candidatePool;
    pgActive = true;

    await pool.query(SCHEMA_SQL);
    const countRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM utilisateurs');
    const cnt = Number(countRes.rows[0]?.cnt || 0);

    if (cnt === 0) {
      // Preserve any tables the user already populated manually in pgAdmin
      const tables = buildTableData();
      const nonEmpty = new Set<string>();
      for (const tableName of Object.keys(tables)) {
        const r = await pool.query(`SELECT COUNT(*)::int AS cnt FROM ${tableName}`);
        if (Number(r.rows[0]?.cnt || 0) > 0) {
          nonEmpty.add(tableName);
        }
      }
      if (nonEmpty.size > 0) {
        const backup = {
          produits: store.produits,
          clients: store.clients,
          fournisseurs: store.fournisseurs,
          prix_speciaux_clients: store.prix_speciaux_clients,
          prix_paliers: store.prix_paliers,
          bons_vente: store.bons_vente,
          bons_achat: store.bons_achat,
          factures: store.factures,
          devis: store.devis,
          versements_clients: store.versements_clients,
          versements_fournisseurs: store.versements_fournisseurs,
          versements_prospects: store.versements_prospects,
          versements_vendeurs: store.versements_vendeurs,
          commandes_clients: store.commandes_clients,
          commandes_prospects: store.commandes_prospects,
          vendeurs: store.vendeurs,
          stock_camion_vendeur: store.stock_camion_vendeur,
          bons_chargement: store.bons_chargement,
          dechargements_camion: store.dechargements_camion,
          retours_vente: store.retours_vente,
          retours_achat: store.retours_achat,
          retours_vendeur: store.retours_vendeur,
          prospects_clients: store.prospects_clients,
          tournee_pointages: store.tournee_pointages,
          mouvements_stock: store.mouvements_stock,
          utilisateurs: store.utilisateurs,
          journal_audit: store.journal_audit,
          profils_entreprise: store.profils_entreprise,
          document_profils: store.document_profils,
          marques_custom: store.marques_custom,
          unites_custom: store.unites_custom,
        };
        await hydrateFromPostgres();
        if (!nonEmpty.has('produits')) store.produits = backup.produits;
        if (!nonEmpty.has('clients')) store.clients = backup.clients;
        if (!nonEmpty.has('fournisseurs')) store.fournisseurs = backup.fournisseurs;
        if (!nonEmpty.has('prix_speciaux_clients')) store.prix_speciaux_clients = backup.prix_speciaux_clients;
        if (!nonEmpty.has('prix_paliers')) store.prix_paliers = backup.prix_paliers;
        if (!nonEmpty.has('bons_vente')) store.bons_vente = backup.bons_vente;
        if (!nonEmpty.has('bons_achat')) store.bons_achat = backup.bons_achat;
        if (!nonEmpty.has('factures')) store.factures = backup.factures;
        if (!nonEmpty.has('devis')) store.devis = backup.devis;
        if (!nonEmpty.has('versements_clients')) store.versements_clients = backup.versements_clients;
        if (!nonEmpty.has('versements_fournisseurs')) store.versements_fournisseurs = backup.versements_fournisseurs;
        if (!nonEmpty.has('versements_prospects')) store.versements_prospects = backup.versements_prospects;
        if (!nonEmpty.has('versements_vendeurs')) store.versements_vendeurs = backup.versements_vendeurs;
        if (!nonEmpty.has('commandes_clients')) store.commandes_clients = backup.commandes_clients;
        if (!nonEmpty.has('commandes_prospects')) store.commandes_prospects = backup.commandes_prospects;
        if (!nonEmpty.has('vendeurs')) store.vendeurs = backup.vendeurs;
        if (!nonEmpty.has('stock_camion_vendeur')) store.stock_camion_vendeur = backup.stock_camion_vendeur;
        if (!nonEmpty.has('bons_chargement')) store.bons_chargement = backup.bons_chargement;
        if (!nonEmpty.has('dechargements_camion')) store.dechargements_camion = backup.dechargements_camion;
        if (!nonEmpty.has('retours_vente')) store.retours_vente = backup.retours_vente;
        if (!nonEmpty.has('retours_achat')) store.retours_achat = backup.retours_achat;
        if (!nonEmpty.has('retours_vendeur')) store.retours_vendeur = backup.retours_vendeur;
        if (!nonEmpty.has('prospects_clients')) store.prospects_clients = backup.prospects_clients;
        if (!nonEmpty.has('tournee_pointages')) store.tournee_pointages = backup.tournee_pointages;
        if (!nonEmpty.has('mouvements_stock')) store.mouvements_stock = backup.mouvements_stock;
        store.utilisateurs = backup.utilisateurs;
        if (!nonEmpty.has('journal_audit')) store.journal_audit = backup.journal_audit;
        if (!nonEmpty.has('profils_entreprise')) store.profils_entreprise = backup.profils_entreprise;
        store.document_profils = backup.document_profils;
        store.marques_custom = backup.marques_custom;
        store.unites_custom = backup.unites_custom;
      }
      await flushAllOrDiff(true);
      console.log(
        `[PostgreSQL] Connecté à "${database}" (${host}:${port}) — schéma initialisé (${store.clients.length} clients).`
      );
    } else {
      await hydrateFromPostgres();
      console.log(
        `[PostgreSQL] Connecté à "${database}" (${host}:${port}) — données restaurées (${store.produits.length} produits, ${store.clients.length} clients).`
      );
    }
  } catch (err: any) {
    pgActive = false;
    await candidatePool.end().catch(() => {});
    pool = null;
    console.warn(
      `[PostgreSQL] Connexion impossible à "${database}" (${host}:${port}) : ${err?.message || err}. Mode mémoire actif.`
    );
  }
}

export function syncStoreToPostgres(): Promise<void> {
  if (!pgActive) return Promise.resolve();
  syncChain = syncChain
    .then(() => flushAllOrDiff(false))
    .catch((err) => {
      console.error('[PostgreSQL] Erreur synchronisation:', err);
    });
  return syncChain;
}

export function forceSyncPostgres(): Promise<void> {
  if (!pgActive) return Promise.resolve();
  syncChain = syncChain
    .then(() => flushAllOrDiff(true))
    .catch((err) => {
      console.error('[PostgreSQL] Erreur synchronisation forcée:', err);
      throw err;
    });
  return syncChain;
}

export function isPostgresActive(): boolean {
  return pgActive;
}
