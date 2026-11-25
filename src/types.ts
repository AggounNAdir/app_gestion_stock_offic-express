export type Role = 'admin' | 'gestionnaire' | 'vendeur' | 'client';

export interface Produit {
  id: string;
  code: string;
  code_barre?: string;
  nom: string;
  categorie: string;
  prix_achat: number;
  prix_vente: number;
  stock_actuel: number;
  stock_alerte: number;
  unite: string;
  depot_id?: string;
  actif: boolean;
  image_url?: string;
}

export interface LotProduit {
  id: string;
  produit_id: string;
  numero_lot: string;
  date_fabrication?: string;
  date_expiration?: string;
  quantite_initiale: number;
  quantite_restante: number;
  bon_achat_id?: string;
  actif: boolean;
}

export interface Depot {
  id: string;
  code: string;
  nom: string;
  adresse: string;
  est_principal: boolean;
  actif: boolean;
}

export interface StockParDepot {
  depot_id: string;
  produit_id: string;
  quantite: number;
}

export interface TransfertDepot {
  id: string;
  numero: string;
  date_transfert: string;
  depot_source_id: string;
  depot_dest_id: string;
  statut: 'Brouillon' | 'Validé' | 'Annulé';
  lignes: { produit_id: string; quantite: number; numero_lot?: string }[];
  utilisateur: string;
  observations?: string;
}

export interface Client {
  id: string;
  code: string;
  nom: string;
  telephone: string;
  adresse: string;
  ville: string;
  solde: number;
  plafond_credit: number; // 0 = illimité
  bloquer_si_depasse: number; // 0 ou 1
  latitude?: number;
  longitude?: number;
  type_client: 'Gros' | 'Demi-Gros' | 'Détail' | 'Comptoir';
  actif: boolean;
}

export interface Vendeur {
  id: string;
  nom: string;
  telephone: string;
  zone: string;
  actif: boolean;
}

export interface LigneVente {
  produit_id: string;
  produit_nom: string;
  quantite: number;
  prix_unitaire: number;
  remise_pct: number;
  total_ligne: number;
  numero_lot?: string;
}

export interface Vente {
  id: string;
  numero: string;
  date_vente: string;
  client_id: string;
  client_nom: string;
  vendeur_id: string;
  vendeur_nom: string;
  depot_id: string;
  lignes: LigneVente[];
  total_ht: number;
  tva_total: number;
  remise_globale: number;
  total_ttc: number;
  montant_verse: number;
  reste_payer: number;
  statut: 'Validé' | 'Annulé' | 'Comptoir';
  mode_paiement: 'Espèces' | 'Chèque' | 'Crédit' | 'Virement';
  observations?: string;
}

export interface Devis {
  id: string;
  numero: string; // DEV-YYYYMMDD-XXXX
  date_devis: string;
  date_validite: string;
  client_id: string;
  client_nom: string;
  vendeur_id: string;
  vendeur_nom: string;
  lignes: LigneVente[];
  total_ht: number;
  tva_total: number;
  remise: number;
  total_ttc: number;
  statut: 'Brouillon' | 'Envoyé' | 'Accepté' | 'Refusé' | 'Converti';
  observations?: string;
  bon_vente_id?: string;
}

export interface InventaireLigne {
  produit_id: string;
  produit_nom: string;
  stock_theorique: number;
  stock_compte: number;
  ecart: number;
  valeur_ecart: number;
}

export interface Inventaire {
  id: string;
  numero: string; // INV-YYYYMMDD-XXXX
  date_inventaire: string;
  statut: 'En cours' | 'Validé' | 'Annulé';
  depot_id: string;
  observations?: string;
  utilisateur: string;
  lignes: InventaireLigne[];
}

export interface Depense {
  id: string;
  numero: string; // DEP-YYYYMMDD-XXXX
  date_depense: string;
  categorie: 'Carburant' | 'Loyer' | 'Salaires' | 'Entretien Camion' | 'Électricité/Eau' | 'Fournitures' | 'Autre';
  libelle: string;
  montant: number;
  mode_paiement: 'Espèces' | 'Chèque' | 'Virement' | 'Carte';
  vendeur_id?: string;
  reference?: string;
  observations?: string;
  cree_par: string;
}

export interface Cheque {
  id: string;
  type: 'Client' | 'Fournisseur';
  numero_cheque: string;
  banque: string;
  date_emission: string;
  date_echeance: string;
  tiers_id: string;
  tiers_nom: string;
  montant: number;
  statut: 'En attente' | 'Déposé' | 'Encaissé' | 'Rejeté';
  versement_id?: string;
  observations?: string;
}

export interface ObjectifVendeur {
  id: string;
  vendeur_id: string;
  mois: string; // 'YYYY-MM'
  objectif_ca: number;
  objectif_encaissement: number;
  taux_commission_pct: number;
  prime_fixe: number;
}

export interface MouvementStock {
  id: string;
  date_mouvement: string;
  produit_id: string;
  produit_nom: string;
  depot_id: string;
  type: 'ENTREE_ACHAT' | 'SORTIE_VENTE' | 'INVENTAIRE_ENTREE' | 'INVENTAIRE_SORTIE' | 'TRANSFERT' | 'CORRECTION';
  quantite: number;
  reference_id?: string;
  utilisateur: string;
}

export interface JournalAudit {
  id: string;
  date_heure: string;
  utilisateur: string;
  action: string;
  details: string;
  ip?: string;
}

export interface NotificationItem {
  id: string;
  titre: string;
  message: string;
  date_heure: string;
  lu: boolean;
  lien?: string;
}

export interface BackupAutoConfig {
  actif: boolean;
  heure: string; // ex: "23:00"
  frequence_heures: number;
  max_copies: number;
}

export interface DocumentProfil {
  entete_nom: string;
  slogan: string;
  rc: string;
  nif: string;
  ai: string;
  nis: string;
  telephone: string;
  email: string;
  adresse: string;
  pied_de_page: string;
  logo_url?: string;
}

export interface LicenseInfo {
  cle: string;
  client_nom: string;
  date_expiration: string;
  max_utilisateurs: number;
  est_valide: boolean;
  jours_restants: number;
  mode_essai: boolean;
}

export interface StoreData {
  produits: Produit[];
  lots: LotProduit[];
  depots: Depot[];
  stock_depots: StockParDepot[];
  transferts: TransfertDepot[];
  clients: Client[];
  vendeurs: Vendeur[];
  ventes: Vente[];
  devis: Devis[];
  inventaires: Inventaire[];
  depenses: Depense[];
  cheques: Cheque[];
  objectifs: ObjectifVendeur[];
  mouvements: MouvementStock[];
  audit: JournalAudit[];
  notifications: NotificationItem[];
  backup_config: BackupAutoConfig;
  profils_entreprise: {
    devis: DocumentProfil;
    facture: DocumentProfil;
    ticket: DocumentProfil;
  };
  license: LicenseInfo;
}
