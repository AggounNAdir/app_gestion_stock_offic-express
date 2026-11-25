import { hashPassword } from './security.ts';

export type NiveauPrix = 'super_gros' | 'gros' | 'detail' | 'special';

export interface Produit {
  id: number;
  code: string;
  barcode?: string | null;
  designation: string;
  marque?: string | null;
  fournisseur?: string | null;
  unite: string;
  facteur_conversion: number;
  prix_achat: number;
  prix_moyen_pondere: number;
  cout_total_stock: number;
  prix_super_gros: number;
  prix_gros: number;
  prix_detail: number;
  prix_special: number;
  prix_vente: number;
  tva: number;
  stock_actuel: number;
  stock_min: number;
  stock_retours_pieces: number;
  actif: number;
  supprime: number;
}

export interface Client {
  id: number;
  code: string;
  nom: string;
  adresse: string;
  tel: string;
  email: string;
  ville?: string;
  nif?: string;
  nis?: string;
  nrc?: string;
  solde: number;
  solde_initial?: number;
  niveau_prix: NiveauPrix;
  portail_actif: number;
  password_hash?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  vendeur_id?: number | null;
  plafond_credit?: number;
  bloquer_si_depasse?: number;
}

export interface Fournisseur {
  id: number;
  code: string;
  nom: string;
  adresse: string;
  tel: string;
  email: string;
  ville?: string;
  nif?: string;
  solde: number;
  solde_initial?: number;
}

export interface PrixSpecialClient {
  id: number;
  client_id: number;
  produit_id: number;
  prix_special: number;
  date_debut?: string | null;
  date_fin?: string | null;
  actif: number;
  date_modification?: string | null;
}

export interface PrixPalier {
  id: number;
  produit_id: number;
  niveau: NiveauPrix;
  qte_min: number;
  prix: number;
  actif: number;
}

export interface LigneVente {
  id: number;
  bon_id: number;
  produit_id: number;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  remise?: number;
  niveau_prix?: NiveauPrix;
  total: number;
  total_ht: number;
  tva_taux: number;
  total_tva: number;
  total_ttc: number;
}

export interface BonVente {
  id: number;
  numero: string;
  date_bon: string;
  client_id: number;
  prospect_id?: number | null;
  vendeur_id?: number | null;
  total: number;
  total_ht: number;
  tva_total: number;
  total_ttc: number;
  remise_type?: 'aucune' | 'montant' | 'pourcentage';
  remise_valeur?: number;
  remise_montant?: number;
  remise_motif?: string | null;
  montant_verse: number;
  montant_recu?: number | null;
  rendu_monnaie?: number | null;
  mode_reglement?: string | null;
  caissier_nom?: string | null;
  reste_payer: number;
  statut: string;
  date_echeance?: string | null;
  observations?: string | null;
  signature_bl?: string | null;
  signataire_nom?: string | null;
  date_signature?: string | null;
  lignes: LigneVente[];
}

export interface LigneAchat {
  id: number;
  bon_id: number;
  produit_id: number;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  total: number;
  tva_taux: number;
  total_ht: number;
  total_ttc: number;
}

export interface BonAchat {
  id: number;
  numero: string;
  date_bon: string;
  fournisseur_id: number;
  total: number;
  statut: string;
  observations?: string | null;
  lignes: LigneAchat[];
}

export interface Facture {
  id: number;
  numero: string;
  date_facture: string;
  bon_vente_id: number;
  client_id: number;
  total_ht: number;
  tva: number;
  total_ttc: number;
  statut: string;
  date_echeance?: string | null;
  observations?: string | null;
}

export interface VersementClient {
  id: number;
  numero: string;
  date_vers: string;
  client_id: number;
  vendeur_id?: number | null;
  montant: number;
  mode: string;
  reference?: string | null;
  observations?: string | null;
}

export interface VersementFournisseur {
  id: number;
  numero: string;
  date_vers: string;
  fournisseur_id: number;
  montant: number;
  mode: string;
  reference?: string | null;
  observations?: string | null;
}

export interface VersementProspect {
  id: number;
  numero: string;
  date_vers: string;
  prospect_id: number;
  vendeur_id?: number | null;
  montant: number;
  mode: string;
  reference?: string | null;
}

export interface VersementVendeur {
  id: number;
  numero: string;
  date_vers: string;
  vendeur_id: number;
  montant: number;
  mode: string;
  reference?: string | null;
  observations?: string | null;
  statut: string;
  cree_par?: string | null;
  date_creation: string;
}

export interface LigneCommande {
  produit_id: number;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  facteur_conversion: number;
  total: number;
}

export interface CommandeClient {
  id: number;
  numero: string;
  client_id: number;
  vendeur_id?: number | null;
  date_commande: string;
  statut: string;
  montant_total: number;
  observations?: string | null;
  bon_vente_id?: number | null;
  lignes: LigneCommande[];
}

export interface CommandeProspect {
  id: number;
  numero: string;
  prospect_id: number;
  vendeur_id?: number | null;
  date_commande: string;
  statut: string;
  montant_total: number;
  observations?: string | null;
  lignes: LigneCommande[];
}

export interface Vendeur {
  id: number;
  code: string;
  nom: string;
  tel: string;
  actif: number;
  password_hash?: string | null;
  session_salt?: string | null;
}

export interface StockCamionItem {
  id: number;
  vendeur_id: number;
  produit_id: number;
  quantite_colis: number;
  quantite_pieces: number;
  date_maj: string;
}

export interface BonChargement {
  id: number;
  numero: string;
  date_chargement: string;
  vendeur_id: number;
  statut: string;
  total_colis: number;
  total_pieces: number;
  observations?: string | null;
  lignes: {
    produit_id: number;
    designation: string;
    quantite_colis: number;
    quantite_pieces: number;
  }[];
}

export interface ProspectClient {
  id: number;
  code: string;
  nom: string;
  tel?: string | null;
  adresse?: string | null;
  wilaya?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  vendeur_id?: number | null;
  date_creation: string;
  statut: string;
  client_id?: number | null;
  solde: number;
}

export interface TourneePointage {
  id: number;
  client_id?: number | null;
  vendeur_id: number;
  code_client?: string | null;
  nom_client?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  date_pointage: string;
  observations?: string | null;
}

export interface MouvementStock {
  id: number;
  date_mouvement: string;
  date_document?: string | null;
  produit_id: number;
  type_mouvement: string;
  quantite: number;
  stock_avant: number;
  stock_apres: number;
  cout_unitaire: number;
  valeur: number;
  pmp_apres?: number | null;
  document_type?: string | null;
  document_id?: number | null;
  document_numero?: string | null;
  tiers_nom?: string | null;
  motif?: string | null;
  utilisateur: string;
}

export interface Utilisateur {
  id: number;
  username: string;
  nom_complet: string;
  password_hash: string;
  role: 'admin' | 'gestionnaire' | 'vendeur' | 'caissier' | 'lecture_seule';
  actif: number;
  doit_changer_mdp: number;
  date_creation: string;
  derniere_connexion?: string | null;
  cree_par?: string | null;
}

export interface JournalAudit {
  id: number;
  date_action: string;
  utilisateur: string;
  action: string;
  cible_type?: string | null;
  cible_id?: number | null;
  details?: string | null;
  reussite: number;
}

export interface ProfilEntreprise {
  id: number;
  code: string;
  nom: string;
  type_profil: string;
  forme_juridique?: string;
  activite?: string;
  capital_social?: string;
  adresse: string;
  telephone: string;
  telephone2?: string;
  email: string;
  site_web?: string;
  ville: string;
  code_postal?: string;
  nif: string;
  nis: string;
  nrc: string;
  registre_commerce?: string;
  art_imp: string;
  banque?: string;
  rib?: string;
  devise?: string;
  tva_defaut?: number;
  prefixe_bv?: string;
  prefixe_facture?: string;
  pied_page?: string;
  logo_data?: string | null;
  est_defaut: number;
  actif: number;
  date_creation?: string;
}

export interface LigneRetour {
  id: number;
  produit_id: number;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  total: number;
}

export interface RetourVente {
  id: number;
  numero: string;
  date_retour: string;
  bon_vente_id?: number | null;
  client_id: number;
  total: number;
  motif?: string | null;
  observations?: string | null;
  statut: string;
  lignes: LigneRetour[];
}

export interface RetourAchat {
  id: number;
  numero: string;
  date_retour: string;
  bon_achat_id?: number | null;
  fournisseur_id: number;
  total: number;
  motif?: string | null;
  observations?: string | null;
  statut: string;
  lignes: LigneRetour[];
}

export interface LigneRetourVendeur {
  produit_id: number;
  designation: string;
  quantite_colis: number;
  quantite_pieces: number;
  facteur_conversion: number;
  prix_unitaire: number;
  motif: string;
  decision?: 'VENDABLE' | 'CASSE' | 'FOURNISSEUR';
}

export interface RetourVendeur {
  id: number;
  numero: string;
  date_retour: string;
  vendeur_id: number;
  retourne_par?: string | null;
  motif: string;
  decision: 'VENDABLE' | 'CASSE' | 'FOURNISSEUR';
  imputation: 'ENTREPRISE' | 'VENDEUR';
  statut: 'En attente' | 'Confirmé' | 'Rejeté' | 'Annulé';
  valeur_totale: number;
  observations?: string | null;
  motif_rejet?: string | null;
  traite_par?: string | null;
  date_traitement?: string | null;
  lignes: LigneRetourVendeur[];
}

export interface LigneDechargement {
  produit_id: number;
  designation: string;
  facteur_conversion: number;
  theorique_pieces: number;
  reel_pieces: number;
  casse_pieces?: number;
  ecart_pieces: number;
  motif_ecart?: string | null;
}

export interface DechargementCamion {
  id: number;
  numero: string;
  date_dechargement: string;
  vendeur_id: number;
  statut: 'En attente' | 'Validé' | 'Rejeté' | 'Annulé';
  observations?: string | null;
  motif_rejet?: string | null;
  traite_par?: string | null;
  lignes: LigneDechargement[];
}

export type StatutDevis = 'Brouillon' | 'Envoyé' | 'Accepté' | 'Refusé' | 'Converti';

export interface LigneDevis {
  id: number;
  devis_id: number;
  produit_id: number;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  remise?: number;
  niveau_prix?: NiveauPrix;
  total: number;
  total_ht: number;
  tva_taux: number;
  total_tva: number;
  total_ttc: number;
}

export interface Devis {
  id: number;
  numero: string;
  date_devis: string;
  date_validite?: string | null;
  client_id: number;
  vendeur_id?: number | null;
  total_ht: number;
  tva_total: number;
  total_ttc: number;
  remise_type?: 'aucune' | 'montant' | 'pourcentage';
  remise_valeur?: number;
  remise_montant?: number;
  remise_motif?: string | null;
  remise: number;
  statut: StatutDevis;
  observations?: string | null;
  bon_vente_id?: number | null;
  lignes: LigneDevis[];
}

export interface DocumentProfilConfig {
  facture: number;
  bon_livraison: number;
  devis: number;
  situation: number;
}

export class InMemoryStore {
  produits: Produit[] = [];
  clients: Client[] = [];
  fournisseurs: Fournisseur[] = [];
  prix_speciaux_clients: PrixSpecialClient[] = [];
  prix_paliers: PrixPalier[] = [];
  bons_vente: BonVente[] = [];
  bons_achat: BonAchat[] = [];
  factures: Facture[] = [];
  versements_clients: VersementClient[] = [];
  versements_fournisseurs: VersementFournisseur[] = [];
  versements_prospects: VersementProspect[] = [];
  versements_vendeurs: VersementVendeur[] = [];
  commandes_clients: CommandeClient[] = [];
  commandes_prospects: CommandeProspect[] = [];
  vendeurs: Vendeur[] = [];
  stock_camion_vendeur: StockCamionItem[] = [];
  bons_chargement: BonChargement[] = [];
  dechargements_camion: DechargementCamion[] = [];
  retours_vendeur: RetourVendeur[] = [];
  prospects_clients: ProspectClient[] = [];
  tournee_pointages: TourneePointage[] = [];
  mouvements_stock: MouvementStock[] = [];
  utilisateurs: Utilisateur[] = [];
  journal_audit: JournalAudit[] = [];
  profils_entreprise: ProfilEntreprise[] = [];
  document_profils: DocumentProfilConfig = {
    facture: 1,
    bon_livraison: 1,
    devis: 1,
    situation: 1,
  };
  marques_custom: string[] = ['Cevital', 'Benamor', 'Soummam', 'Ifri', 'Bimo', 'Faderco'];
  unites_custom: string[] = [];
  retours_vente: RetourVente[] = [];
  retours_achat: RetourAchat[] = [];
  devis: Devis[] = [];

  private seq = new Map<string, number>();

  nextId(table: string): number {
    const val = (this.seq.get(table) || 0) + 1;
    this.seq.set(table, val);
    return val;
  }

  getSeqSnapshot(): Record<string, number> {
    return Object.fromEntries(this.seq.entries());
  }

  restoreSeqSnapshot(snapshot: Record<string, number> | null | undefined): void {
    if (!snapshot) return;
    for (const [k, v] of Object.entries(snapshot)) {
      const n = Number(v || 0);
      if (Number.isFinite(n) && n > (this.seq.get(k) || 0)) {
        this.seq.set(k, n);
      }
    }
  }

  constructor() {
    this.seed();
  }

  private seed(): void {
    const today = new Date().toISOString().slice(0, 10);
    const nowTs = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const adminHash = hashPassword('admin123');
    const gestHash = hashPassword('gest123');
    const caisseHash = hashPassword('caisse123');
    const clientHash = hashPassword('client123');
    const vendHash = hashPassword('vendeur123');

    this.utilisateurs = [
      {
        id: this.nextId('utilisateurs'),
        username: 'admin',
        nom_complet: 'Administrateur Principal',
        password_hash: adminHash,
        role: 'admin',
        actif: 1,
        doit_changer_mdp: 0,
        date_creation: nowTs,
        derniere_connexion: nowTs,
        cree_par: 'Système',
      },
      {
        id: this.nextId('utilisateurs'),
        username: 'gestionnaire',
        nom_complet: 'Samira Khelifi',
        password_hash: gestHash,
        role: 'gestionnaire',
        actif: 1,
        doit_changer_mdp: 0,
        date_creation: nowTs,
        cree_par: 'admin',
      },
      {
        id: this.nextId('utilisateurs'),
        username: 'caissier',
        nom_complet: 'Nabil Boudjema',
        password_hash: caisseHash,
        role: 'caissier',
        actif: 1,
        doit_changer_mdp: 0,
        date_creation: nowTs,
        cree_par: 'admin',
      },
    ];

    this.profils_entreprise = [
      {
        id: this.nextId('profils_entreprise'),
        code: 'SOCIETE_GH001',
        nom: 'GHILASS GLACE',
        type_profil: 'complet',
        forme_juridique: 'SARL',
        activite: 'Distribution Agroalimentaire & Gros',
        capital_social: '10 000 000 DA',
        adresse: 'Zone Industrielle Oued Smar, Lot 14',
        telephone: '023 92 45 10',
        telephone2: '0550 12 34 56',
        email: 'contact@ghilass-distribution.dz',
        site_web: 'https://ghilass-distribution.dz',
        ville: 'Alger',
        code_postal: '16309',
        nif: '001216009841234',
        nis: '099816004521001',
        nrc: '16/00-0987654B19',
        art_imp: '16041234567',
        banque: 'BNA Agence Oued Smar',
        rib: '001 00602 0300 123456 78',
        devise: 'DA',
        tva_defaut: 19,
        prefixe_bv: 'BV',
        prefixe_facture: 'FAC',
        pied_page: 'Merci pour votre confiance — Marchandise vendue ni reprise ni échangée après 48h.',
        logo_data: null,
        est_defaut: 1,
        actif: 1,
        date_creation: nowTs,
      },
    ];

    this.fournisseurs = [
      {
        id: this.nextId('fournisseurs'),
        code: 'FRN-0001',
        nom: 'Cevital Agro-Industrie',
        adresse: 'Nouveau Quai, Port de Béjaïa',
        tel: '034 20 12 00',
        email: 'commercial@cevital.dz',
        ville: 'Béjaïa',
        nif: '000106000123456',
        solde: 145000,
      },
      {
        id: this.nextId('fournisseurs'),
        code: 'FRN-0002',
        nom: 'Groupe Benamor',
        adresse: 'Zone Industrielle Bouati Mahmoud',
        tel: '037 26 44 10',
        email: 'ventes@benamor.dz',
        ville: 'Guelma',
        nif: '000224000567890',
        solde: 62000,
      },
      {
        id: this.nextId('fournisseurs'),
        code: 'FRN-0003',
        nom: 'Laiterie Soummam',
        adresse: 'Zone Industrielle Taharacht',
        tel: '034 36 81 00',
        email: 'distribution@soummam.dz',
        ville: 'Akbou',
        nif: '000306000891234',
        solde: 0,
      },
    ];

    this.produits = [
      {
        id: this.nextId('produits'),
        code: 'PRD-0001',
        barcode: '6130001000015',
        designation: 'Huile de Table Elio 5L',
        fournisseur: 'Cevital Agro-Industrie',
        unite: 'Carton (4x5L)',
        facteur_conversion: 4,
        prix_achat: 580,
        prix_moyen_pondere: 580,
        cout_total_stock: 580 * 120,
        prix_super_gros: 620,
        prix_gros: 640,
        prix_detail: 680,
        prix_special: 610,
        prix_vente: 680,
        tva: 19,
        stock_actuel: 120,
        stock_min: 40,
        stock_retours_pieces: 0,
        actif: 1,
        supprime: 0,
      },
      {
        id: this.nextId('produits'),
        code: 'PRD-0002',
        barcode: '6130001000022',
        designation: 'Sucre Cristal Skor 1kg',
        fournisseur: 'Cevital Agro-Industrie',
        unite: 'Fardeau (10x1kg)',
        facteur_conversion: 10,
        prix_achat: 95,
        prix_moyen_pondere: 95,
        cout_total_stock: 95 * 450,
        prix_super_gros: 105,
        prix_gros: 110,
        prix_detail: 120,
        prix_special: 102,
        prix_vente: 120,
        tva: 9,
        stock_actuel: 450,
        stock_min: 100,
        stock_retours_pieces: 0,
        actif: 1,
        supprime: 0,
      },
      {
        id: this.nextId('produits'),
        code: 'PRD-0003',
        barcode: '6130001000039',
        designation: 'Double Concentré Tomate Benamor 400g',
        fournisseur: 'Groupe Benamor',
        unite: 'Carton (24 pcs)',
        facteur_conversion: 24,
        prix_achat: 145,
        prix_moyen_pondere: 145,
        cout_total_stock: 145 * 48,
        prix_super_gros: 160,
        prix_gros: 168,
        prix_detail: 185,
        prix_special: 158,
        prix_vente: 185,
        tva: 19,
        stock_actuel: 48,
        stock_min: 72,
        stock_retours_pieces: 0,
        actif: 1,
        supprime: 0,
      },
      {
        id: this.nextId('produits'),
        code: 'PRD-0004',
        barcode: '6130001000046',
        designation: 'Lait UHT Soummam 1L',
        fournisseur: 'Laiterie Soummam',
        unite: 'Pack (12x1L)',
        facteur_conversion: 12,
        prix_achat: 105,
        prix_moyen_pondere: 105,
        cout_total_stock: 105 * 24,
        prix_super_gros: 115,
        prix_gros: 120,
        prix_detail: 130,
        prix_special: 114,
        prix_vente: 130,
        tva: 9,
        stock_actuel: 24,
        stock_min: 60,
        stock_retours_pieces: 0,
        actif: 1,
        supprime: 0,
      },
      {
        id: this.nextId('produits'),
        code: 'PRD-0005',
        barcode: '6130001000053',
        designation: 'Pâtes Spaghetti Benamor 500g',
        fournisseur: 'Groupe Benamor',
        unite: 'Carton (20 pcs)',
        facteur_conversion: 20,
        prix_achat: 72,
        prix_moyen_pondere: 72,
        cout_total_stock: 72 * 300,
        prix_super_gros: 82,
        prix_gros: 86,
        prix_detail: 95,
        prix_special: 80,
        prix_vente: 95,
        tva: 9,
        stock_actuel: 300,
        stock_min: 80,
        stock_retours_pieces: 0,
        actif: 1,
        supprime: 0,
      },
      {
        id: this.nextId('produits'),
        code: 'PRD-0006',
        barcode: '6130001000060',
        designation: 'Café Moulu Arabica 250g',
        fournisseur: 'Cevital Agro-Industrie',
        unite: 'Carton (24 pcs)',
        facteur_conversion: 24,
        prix_achat: 320,
        prix_moyen_pondere: 320,
        cout_total_stock: 320 * 144,
        prix_super_gros: 355,
        prix_gros: 370,
        prix_detail: 400,
        prix_special: 350,
        prix_vente: 400,
        tva: 19,
        stock_actuel: 144,
        stock_min: 48,
        stock_retours_pieces: 0,
        actif: 1,
        supprime: 0,
      },
    ];

    this.vendeurs = [
      {
        id: this.nextId('vendeurs'),
        code: 'VND-0001',
        nom: 'Karim Benali',
        tel: '0550 12 34 56',
        actif: 1,
        password_hash: vendHash,
        session_salt: 'seed-salt-v1',
      },
      {
        id: this.nextId('vendeurs'),
        code: 'VND-0002',
        nom: 'Yacine Mansouri',
        tel: '0661 78 90 12',
        actif: 1,
        password_hash: vendHash,
        session_salt: 'seed-salt-v2',
      },
    ];

    this.clients = [
      {
        id: this.nextId('clients'),
        code: 'CLT-COMPTOIR',
        nom: 'COMPTOIR',
        adresse: 'Vente directe magasin',
        tel: '',
        email: '',
        solde: 0,
        niveau_prix: 'detail',
        portail_actif: 0,
        password_hash: null,
        latitude: null,
        longitude: null,
        vendeur_id: null,
        plafond_credit: 0,
        bloquer_si_depasse: 0,
      },
      {
        id: this.nextId('clients'),
        code: 'CLT-0001',
        nom: 'Superette El Baraka',
        adresse: 'Rue Didouche Mourad 42, Alger',
        tel: '0551 44 22 11',
        email: 'elbaraka@client.dz',
        ville: 'Alger',
        solde: 48500,
        niveau_prix: 'gros',
        portail_actif: 1,
        password_hash: clientHash,
        latitude: 36.7655,
        longitude: 3.0588,
        vendeur_id: 1,
        plafond_credit: 150000,
        bloquer_si_depasse: 1,
      },
      {
        id: this.nextId('clients'),
        code: 'CLT-0002',
        nom: 'Grossiste Hydra Distribution',
        adresse: 'Chemin Sidi Yahia 18, Hydra',
        tel: '0555 88 99 00',
        email: 'hydra.dist@client.dz',
        ville: 'Alger',
        solde: 112000,
        niveau_prix: 'super_gros',
        portail_actif: 1,
        password_hash: clientHash,
        latitude: 36.7421,
        longitude: 3.0389,
        vendeur_id: 1,
        plafond_credit: 100000,
        bloquer_si_depasse: 1,
      },
      {
        id: this.nextId('clients'),
        code: 'CLT-0003',
        nom: 'Alimentation El Nour',
        adresse: 'Cité 11 Décembre, Kouba',
        tel: '0770 33 11 45',
        email: 'elnour@client.dz',
        ville: 'Kouba',
        solde: 19400,
        niveau_prix: 'detail',
        portail_actif: 1,
        password_hash: clientHash,
        latitude: 36.7267,
        longitude: 3.0894,
        vendeur_id: 2,
        plafond_credit: 50000,
        bloquer_si_depasse: 0,
      },
    ];

    this.prix_speciaux_clients = [
      {
        id: this.nextId('prix_speciaux_clients'),
        client_id: 2,
        produit_id: 1,
        prix_special: 615,
        date_debut: '2026-01-01',
        date_fin: '2026-12-31',
        actif: 1,
        date_modification: nowTs,
      },
    ];

    this.prix_paliers = [
      {
        id: this.nextId('prix_paliers'),
        produit_id: 2,
        niveau: 'gros',
        qte_min: 100,
        prix: 104,
        actif: 1,
      },
      {
        id: this.nextId('prix_paliers'),
        produit_id: 5,
        niveau: 'detail',
        qte_min: 40,
        prix: 88,
        actif: 1,
      },
    ];

    this.stock_camion_vendeur = [
      {
        id: this.nextId('stock_camion_vendeur'),
        vendeur_id: 1,
        produit_id: 1,
        quantite_colis: 10,
        quantite_pieces: 40,
        date_maj: nowTs,
      },
      {
        id: this.nextId('stock_camion_vendeur'),
        vendeur_id: 1,
        produit_id: 2,
        quantite_colis: 15,
        quantite_pieces: 150,
        date_maj: nowTs,
      },
      {
        id: this.nextId('stock_camion_vendeur'),
        vendeur_id: 2,
        produit_id: 5,
        quantite_colis: 8,
        quantite_pieces: 160,
        date_maj: nowTs,
      },
    ];

    this.bons_chargement = [
      {
        id: this.nextId('bons_chargement'),
        numero: 'CHG-20261120-0001',
        date_chargement: today,
        vendeur_id: 1,
        statut: 'Validé',
        total_colis: 25,
        total_pieces: 190,
        observations: 'Chargement tournée Alger Centre',
        lignes: [
          {
            produit_id: 1,
            designation: 'Huile de Table Elio 5L',
            quantite_colis: 10,
            quantite_pieces: 40,
          },
          {
            produit_id: 2,
            designation: 'Sucre Cristal Skor 1kg',
            quantite_colis: 15,
            quantite_pieces: 150,
          },
        ],
      },
    ];

    this.prospects_clients = [
      {
        id: this.nextId('prospects_clients'),
        code: 'PROSP-20261120-0001',
        nom: 'Épicerie El Wafa',
        tel: '0552 90 11 22',
        adresse: 'Rue Hassiba Ben Bouali 112',
        wilaya: 'Alger',
        latitude: 36.7538,
        longitude: 3.0588,
        vendeur_id: 1,
        date_creation: nowTs,
        statut: 'Nouveau',
        client_id: null,
        solde: 0,
      },
    ];

    // Seed Bons d'Achat
    this.bons_achat = [
      {
        id: this.nextId('bons_achat'),
        numero: 'BA-20261118-0001',
        date_bon: '2026-11-18',
        fournisseur_id: 1,
        total: 145000,
        statut: 'Validé',
        observations: 'Approvisionnement hebdomadaire Cevital',
        lignes: [
          {
            id: this.nextId('lignes_achat'),
            bon_id: 1,
            produit_id: 1,
            designation: 'Huile de Table Elio 5L',
            quantite: 160,
            prix_unitaire: 580,
            total: 92800,
            tva_taux: 19,
            total_ht: 92800,
            total_ttc: 110432,
          },
          {
            id: this.nextId('lignes_achat'),
            bon_id: 1,
            produit_id: 2,
            designation: 'Sucre Cristal Skor 1kg',
            quantite: 549.47,
            prix_unitaire: 95,
            total: 52200,
            tva_taux: 9,
            total_ht: 52200,
            total_ttc: 56898,
          },
        ],
      },
    ];

    // Seed Bons de Vente & Factures
    this.bons_vente = [
      {
        id: this.nextId('bons_vente'),
        numero: 'BV-20261119-0001',
        date_bon: '2026-11-19',
        client_id: 2,
        vendeur_id: 1,
        total: 78500,
        total_ht: 66000,
        tva_total: 12500,
        total_ttc: 78500,
        montant_verse: 30000,
        reste_payer: 48500,
        statut: 'Validé',
        observations: 'Livraison matin Alger Centre',
        lignes: [
          {
            id: this.nextId('lignes_vente'),
            bon_id: 1,
            produit_id: 1,
            designation: 'Huile de Table Elio 5L',
            quantite: 80,
            prix_unitaire: 615,
            total: 49200,
            total_ht: 41344.54,
            tva_taux: 19,
            total_tva: 7855.46,
            total_ttc: 49200,
          },
          {
            id: this.nextId('lignes_vente'),
            bon_id: 1,
            produit_id: 6,
            designation: 'Café Moulu Arabica 250g',
            quantite: 79.19,
            prix_unitaire: 370,
            total: 29300,
            total_ht: 24655.46,
            tva_taux: 19,
            total_tva: 4644.54,
            total_ttc: 29300,
          },
        ],
      },
      {
        id: this.nextId('bons_vente'),
        numero: 'BV-20261120-0002',
        date_bon: '2026-11-20',
        client_id: 3,
        vendeur_id: 1,
        total: 112000,
        total_ht: 94117.65,
        tva_total: 17882.35,
        total_ttc: 112000,
        montant_verse: 0,
        reste_payer: 112000,
        statut: 'Validé',
        date_echeance: '2026-11-21',
        observations: 'Commande gros Hydra',
        lignes: [
          {
            id: this.nextId('lignes_vente'),
            bon_id: 2,
            produit_id: 1,
            designation: 'Huile de Table Elio 5L',
            quantite: 100,
            prix_unitaire: 620,
            total: 62000,
            total_ht: 52100.84,
            tva_taux: 19,
            total_tva: 9899.16,
            total_ttc: 62000,
          },
          {
            id: this.nextId('lignes_vente'),
            bon_id: 2,
            produit_id: 2,
            designation: 'Sucre Cristal Skor 1kg',
            quantite: 476.19,
            prix_unitaire: 105,
            total: 50000,
            total_ht: 42016.81,
            tva_taux: 19,
            total_tva: 7983.19,
            total_ttc: 50000,
          },
        ],
      },
    ];

    this.factures = [
      {
        id: this.nextId('factures'),
        numero: 'FAC-20261119-0001',
        date_facture: '2026-11-19',
        bon_vente_id: 1,
        client_id: 2,
        total_ht: 66000,
        tva: 19,
        total_ttc: 78500,
        statut: 'Émise',
        date_echeance: '2026-12-19',
        observations: 'Facture sur BV-20261119-0001',
      },
    ];

    this.versements_clients = [
      {
        id: this.nextId('versements_clients'),
        numero: 'VC-20261119-0001',
        date_vers: '2026-11-19',
        client_id: 2,
        vendeur_id: 1,
        montant: 30000,
        mode: 'Espèces',
        reference: 'Acompte livraison',
      },
    ];

    this.commandes_clients = [
      {
        id: this.nextId('commandes_clients'),
        numero: `CMD-${today.replace(/-/g, '')}-0001`,
        client_id: 2,
        vendeur_id: 1,
        date_commande: today,
        statut: 'En attente',
        montant_total: 24600,
        observations: 'Livraison souhaitée demain matin',
        bon_vente_id: null,
        lignes: [
          {
            produit_id: 1,
            designation: 'Huile de Table Elio 5L',
            quantite: 10,
            prix_unitaire: 615,
            facteur_conversion: 4,
            total: 24600,
          },
        ],
      },
    ];

    this.tournee_pointages = [
      {
        id: this.nextId('tournee_pointages'),
        client_id: 2,
        vendeur_id: 1,
        code_client: 'CLT-0001',
        nom_client: 'Superette El Baraka',
        latitude: 36.7655,
        longitude: 3.0588,
        date_pointage: nowTs,
        observations: 'Visite commerciale et prise de commande',
      },
    ];

    for (const p of this.produits) {
      this.mouvements_stock.push({
        id: this.nextId('mouvements_stock'),
        date_mouvement: nowTs,
        date_document: today,
        produit_id: p.id,
        type_mouvement: 'STOCK_INITIAL',
        quantite: p.stock_actuel,
        stock_avant: 0,
        stock_apres: p.stock_actuel,
        cout_unitaire: p.prix_achat,
        valeur: Number((p.stock_actuel * p.prix_achat).toFixed(2)),
        pmp_apres: p.prix_moyen_pondere,
        document_type: null,
        document_id: null,
        document_numero: 'INIT',
        tiers_nom: 'Dépôt Central',
        motif: 'Initialisation du stock',
        utilisateur: 'Système',
      });
    }

    this.versements_vendeurs = [
      {
        id: this.nextId('versements_vendeurs'),
        numero: `VV-${today.replace(/-/g, '')}-0001`,
        date_vers: today,
        vendeur_id: 1,
        montant: 25000,
        mode: 'Espèces',
        reference: 'Remise recette tournée',
        observations: 'Encaissement caisse matin',
        statut: 'Validé',
        cree_par: 'Administrateur Principal',
        date_creation: nowTs,
      },
    ];

    this.commandes_prospects = [
      {
        id: this.nextId('commandes_prospects'),
        numero: `CP-${today.replace(/-/g, '')}-0001`,
        prospect_id: 1,
        vendeur_id: 1,
        date_commande: today,
        statut: 'En attente',
        montant_total: 12800,
        observations: 'Première commande découverte',
        lignes: [
          {
            produit_id: 2,
            designation: 'Sucre Cristal Skor 1kg',
            quantite: 10,
            prix_unitaire: 120,
            facteur_conversion: 10,
            total: 12000,
          },
        ],
      },
    ];

    this.retours_vente = [
      {
        id: this.nextId('retours_vente'),
        numero: `RV-${today.replace(/-/g, '')}-0001`,
        date_retour: today,
        bon_vente_id: 1,
        client_id: 2,
        total: 2460,
        motif: 'Carton endommagé à la livraison',
        observations: 'Repris par le livreur',
        statut: 'Validé',
        lignes: [
          {
            id: this.nextId('lignes_retour_vente'),
            produit_id: 1,
            designation: 'Huile de Table Elio 5L',
            quantite: 4,
            prix_unitaire: 615,
            total: 2460,
          },
        ],
      },
    ];

    this.retours_vendeur = [
      {
        id: this.nextId('retours_vendeur'),
        numero: `RTV-${today.replace(/-/g, '')}-0001`,
        date_retour: today,
        vendeur_id: 1,
        motif: 'INVENDU',
        decision: 'VENDABLE',
        imputation: 'ENTREPRISE',
        statut: 'En attente',
        valeur_totale: 5800,
        observations: 'Fin de tournée secteur centre',
        lignes: [
          {
            produit_id: 1,
            designation: 'Huile de Table Elio 5L',
            quantite_colis: 2,
            quantite_pieces: 8,
            facteur_conversion: 4,
            prix_unitaire: 580,
            motif: 'INVENDU',
            decision: 'VENDABLE',
          },
        ],
      },
    ];

    this.dechargements_camion = [
      {
        id: this.nextId('dechargements_camion'),
        numero: `DEC-${today.replace(/-/g, '')}-0001`,
        date_dechargement: today,
        vendeur_id: 2,
        statut: 'En attente',
        observations: 'Contrôle fin de journée Kouba',
        lignes: [
          {
            produit_id: 5,
            designation: 'Eau Minérale Ifri 1.5L',
            facteur_conversion: 6,
            theorique_pieces: 160,
            reel_pieces: 158,
            ecart_pieces: -2,
          },
        ],
      },
    ];

    this.devis = [
      {
        id: this.nextId('devis'),
        numero: `DEV-${today.replace(/-/g, '')}-0001`,
        date_devis: today,
        date_validite: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        client_id: 2,
        vendeur_id: 1,
        total_ht: 25840.34,
        tva_total: 4909.66,
        total_ttc: 30750,
        remise_type: 'aucune',
        remise_valeur: 0,
        remise_montant: 0,
        remise_motif: null,
        remise: 0,
        statut: 'Envoyé',
        observations: 'Offre de prix valable 15 jours — Livraison incluse',
        bon_vente_id: null,
        lignes: [
          {
            id: this.nextId('lignes_devis'),
            devis_id: 1,
            produit_id: 1,
            designation: 'Huile de Table Elio 5L',
            quantite: 50,
            prix_unitaire: 615,
            remise: 0,
            niveau_prix: 'gros',
            total: 30750,
            total_ht: 25840.34,
            tva_taux: 19,
            total_tva: 4909.66,
            total_ttc: 30750,
          },
        ],
      },
    ];

    this.journal_audit.push({
      id: this.nextId('journal_audit'),
      date_action: nowTs,
      utilisateur: 'Système',
      action: 'DEMARRAGE_APPLICATION',
      cible_type: 'system',
      cible_id: null,
      details: 'Initialisation du serveur Node.js avec données de démonstration',
      reussite: 1,
    });
  }

  exportBackupSnapshot(createdBy: string): BackupSnapshot {
    return {
      format: 'gestion-stock-backup',
      version: 1,
      created_at: new Date().toISOString(),
      created_by: createdBy,
      stats: {
        produits: this.produits.filter((p) => p.supprime === 0).length,
        clients: this.clients.length,
        fournisseurs: this.fournisseurs.length,
        bons_vente: this.bons_vente.length,
        bons_achat: this.bons_achat.length,
        factures: this.factures.length,
        devis: this.devis.length,
        utilisateurs: this.utilisateurs.length,
      },
      sequences: this.getSeqSnapshot(),
      data: structuredClone({
        produits: this.produits,
        clients: this.clients,
        fournisseurs: this.fournisseurs,
        prix_speciaux_clients: this.prix_speciaux_clients,
        prix_paliers: this.prix_paliers,
        bons_vente: this.bons_vente,
        bons_achat: this.bons_achat,
        factures: this.factures,
        devis: this.devis,
        versements_clients: this.versements_clients,
        versements_fournisseurs: this.versements_fournisseurs,
        versements_prospects: this.versements_prospects,
        versements_vendeurs: this.versements_vendeurs,
        commandes_clients: this.commandes_clients,
        commandes_prospects: this.commandes_prospects,
        vendeurs: this.vendeurs,
        stock_camion_vendeur: this.stock_camion_vendeur,
        bons_chargement: this.bons_chargement,
        dechargements_camion: this.dechargements_camion,
        retours_vente: this.retours_vente,
        retours_achat: this.retours_achat,
        retours_vendeur: this.retours_vendeur,
        prospects_clients: this.prospects_clients,
        tournee_pointages: this.tournee_pointages,
        mouvements_stock: this.mouvements_stock,
        utilisateurs: this.utilisateurs,
        journal_audit: this.journal_audit,
        profils_entreprise: this.profils_entreprise,
        document_profils: this.document_profils,
        marques_custom: this.marques_custom,
        unites_custom: this.unites_custom,
      }),
    };
  }

  restoreBackupSnapshot(raw: unknown, utilisateur: string): void {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Fichier de sauvegarde JSON invalide.');
    }
    const snap = raw as Partial<BackupSnapshot>;
    if (snap.format !== 'gestion-stock-backup' || !snap.data || typeof snap.data !== 'object') {
      throw new Error('Format de sauvegarde non reconnu (format gestion-stock-backup attendu).');
    }
    const d = snap.data as Record<string, unknown>;

    const arrayKeys = [
      'produits',
      'clients',
      'fournisseurs',
      'prix_speciaux_clients',
      'prix_paliers',
      'bons_vente',
      'bons_achat',
      'factures',
      'devis',
      'versements_clients',
      'versements_fournisseurs',
      'versements_prospects',
      'versements_vendeurs',
      'commandes_clients',
      'commandes_prospects',
      'vendeurs',
      'stock_camion_vendeur',
      'bons_chargement',
      'dechargements_camion',
      'retours_vente',
      'retours_achat',
      'retours_vendeur',
      'prospects_clients',
      'tournee_pointages',
      'mouvements_stock',
      'utilisateurs',
      'journal_audit',
      'profils_entreprise',
    ] as const;

    const requiredKeys = new Set<string>([
      'produits',
      'clients',
      'fournisseurs',
      'utilisateurs',
      'profils_entreprise',
    ]);

    for (const key of arrayKeys) {
      if (requiredKeys.has(key) && !Array.isArray(d[key])) {
        throw new Error(`Table obligatoire manquante ou invalide dans la sauvegarde : ${key}.`);
      }
      if (d[key] !== undefined && !Array.isArray(d[key])) {
        throw new Error(`Table invalide dans la sauvegarde : ${key}.`);
      }
    }

    const users = d.utilisateurs as Utilisateur[];
    if (!users.some((u) => u && u.role === 'admin' && Number(u.actif ?? 1) === 1)) {
      throw new Error('Sauvegarde refusée : aucun compte administrateur actif présent.');
    }

    this.produits = structuredClone((d.produits as Produit[]) || []);
    this.clients = structuredClone((d.clients as Client[]) || []).map((c) => ({
      ...c,
      plafond_credit: Math.max(0, Number(c.plafond_credit || 0)),
      bloquer_si_depasse: Number(c.bloquer_si_depasse ? 1 : 0),
    }));
    this.fournisseurs = structuredClone((d.fournisseurs as Fournisseur[]) || []);
    this.prix_speciaux_clients = structuredClone((d.prix_speciaux_clients as PrixSpecialClient[]) || []);
    this.prix_paliers = structuredClone((d.prix_paliers as PrixPalier[]) || []);
    this.bons_vente = structuredClone((d.bons_vente as BonVente[]) || []).map((b) => ({
      ...b,
      date_echeance: b.date_echeance ?? null,
    }));
    this.bons_achat = structuredClone((d.bons_achat as BonAchat[]) || []);
    this.factures = structuredClone((d.factures as Facture[]) || []);
    this.devis = structuredClone((d.devis as Devis[]) || []);
    this.versements_clients = structuredClone((d.versements_clients as VersementClient[]) || []);
    this.versements_fournisseurs = structuredClone((d.versements_fournisseurs as VersementFournisseur[]) || []);
    this.versements_prospects = structuredClone((d.versements_prospects as VersementProspect[]) || []);
    this.versements_vendeurs = structuredClone((d.versements_vendeurs as VersementVendeur[]) || []);
    this.commandes_clients = structuredClone((d.commandes_clients as CommandeClient[]) || []);
    this.commandes_prospects = structuredClone((d.commandes_prospects as CommandeProspect[]) || []);
    this.vendeurs = structuredClone((d.vendeurs as Vendeur[]) || []);
    this.stock_camion_vendeur = structuredClone((d.stock_camion_vendeur as StockCamionItem[]) || []);
    this.bons_chargement = structuredClone((d.bons_chargement as BonChargement[]) || []);
    this.dechargements_camion = structuredClone((d.dechargements_camion as DechargementCamion[]) || []);
    this.retours_vente = structuredClone((d.retours_vente as RetourVente[]) || []);
    this.retours_achat = structuredClone((d.retours_achat as RetourAchat[]) || []);
    this.retours_vendeur = structuredClone((d.retours_vendeur as RetourVendeur[]) || []);
    this.prospects_clients = structuredClone((d.prospects_clients as ProspectClient[]) || []);
    this.tournee_pointages = structuredClone((d.tournee_pointages as TourneePointage[]) || []);
    this.mouvements_stock = structuredClone((d.mouvements_stock as MouvementStock[]) || []);
    this.utilisateurs = structuredClone(users);
    this.journal_audit = structuredClone((d.journal_audit as JournalAudit[]) || []);
    this.profils_entreprise = structuredClone((d.profils_entreprise as ProfilEntreprise[]) || []);

    if (d.document_profils && typeof d.document_profils === 'object' && !Array.isArray(d.document_profils)) {
      const dp = d.document_profils as Record<string, unknown>;
      this.document_profils = {
        facture: Number(dp.facture || 1),
        bon_livraison: Number(dp.bon_livraison || 1),
        devis: Number(dp.devis || 1),
        situation: Number(dp.situation || 1),
      };
    }
    if (Array.isArray(d.marques_custom)) {
      this.marques_custom = d.marques_custom.map((x) => String(x)).filter(Boolean);
    }
    if (Array.isArray(d.unites_custom)) {
      this.unites_custom = d.unites_custom.map((x) => String(x)).filter(Boolean);
    }

    this.seq.clear();
    if (snap.sequences && typeof snap.sequences === 'object') {
      this.restoreSeqSnapshot(snap.sequences);
    }

    const maxId = (items: { id?: number }[]) =>
      items.reduce((acc, x) => (Number(x?.id || 0) > acc ? Number(x.id) : acc), 0);

    const calcSeqs: Record<string, number> = {
      produits: maxId(this.produits),
      clients: maxId(this.clients),
      fournisseurs: maxId(this.fournisseurs),
      prix_speciaux_clients: maxId(this.prix_speciaux_clients),
      prix_paliers: maxId(this.prix_paliers),
      bons_vente: maxId(this.bons_vente),
      lignes_vente: maxId(this.bons_vente.flatMap((b) => b.lignes || [])),
      bons_achat: maxId(this.bons_achat),
      lignes_achat: maxId(this.bons_achat.flatMap((b) => b.lignes || [])),
      factures: maxId(this.factures),
      devis: maxId(this.devis),
      lignes_devis: maxId(this.devis.flatMap((dv) => dv.lignes || [])),
      versements_clients: maxId(this.versements_clients),
      versements_fournisseurs: maxId(this.versements_fournisseurs),
      versements_prospects: maxId(this.versements_prospects),
      versements_vendeurs: maxId(this.versements_vendeurs),
      commandes_clients: maxId(this.commandes_clients),
      commandes_prospects: maxId(this.commandes_prospects),
      vendeurs: maxId(this.vendeurs),
      stock_camion_vendeur: maxId(this.stock_camion_vendeur),
      bons_chargement: maxId(this.bons_chargement),
      dechargements_camion: maxId(this.dechargements_camion),
      retours_vente: maxId(this.retours_vente),
      retours_achat: maxId(this.retours_achat),
      retours_vendeur: maxId(this.retours_vendeur),
      prospects_clients: maxId(this.prospects_clients),
      tournee_pointages: maxId(this.tournee_pointages),
      mouvements_stock: maxId(this.mouvements_stock),
      utilisateurs: maxId(this.utilisateurs),
      journal_audit: maxId(this.journal_audit),
      profils_entreprise: maxId(this.profils_entreprise),
    };
    this.restoreSeqSnapshot(calcSeqs);

    this.journal_audit.push({
      id: this.nextId('journal_audit'),
      date_action: new Date().toISOString().replace('T', ' ').slice(0, 19),
      utilisateur,
      action: 'RESTAURATION_SAUVEGARDE',
      cible_type: 'system',
      cible_id: null,
      details: `Restauration complète (${this.produits.length} produits, ${this.clients.length} clients, ${this.bons_vente.length} bons de vente)`,
      reussite: 1,
    });
  }

  resetOperationalData(utilisateur: string): void {
    this.bons_vente = [];
    this.bons_achat = [];
    this.factures = [];
    this.devis = [];
    this.versements_clients = [];
    this.versements_fournisseurs = [];
    this.versements_prospects = [];
    this.versements_vendeurs = [];
    this.commandes_clients = [];
    this.commandes_prospects = [];
    this.bons_chargement = [];
    this.dechargements_camion = [];
    this.retours_vente = [];
    this.retours_achat = [];
    this.retours_vendeur = [];
    this.stock_camion_vendeur = [];
    this.tournee_pointages = [];
    this.mouvements_stock = [];
    for (const p of this.produits) {
      p.stock_actuel = 0;
      p.cout_total_stock = 0;
      p.stock_retours_pieces = 0;
    }
    for (const c of this.clients) {
      c.solde = 0;
      c.solde_initial = 0;
    }
    for (const f of this.fournisseurs) {
      f.solde = 0;
      f.solde_initial = 0;
    }
    for (const pr of this.prospects_clients) {
      pr.solde = 0;
    }
    this.journal_audit.push({
      id: this.nextId('journal_audit'),
      date_action: new Date().toISOString().replace('T', ' ').slice(0, 19),
      utilisateur,
      action: 'REINITIALISATION_BASE',
      cible_type: 'system',
      cible_id: null,
      details: 'Remise à zéro des documents, mouvements, stocks et soldes tiers',
      reussite: 1,
    });
  }
}

export interface BackupSnapshot {
  format: 'gestion-stock-backup';
  version: number;
  created_at: string;
  created_by: string;
  stats: {
    produits: number;
    clients: number;
    fournisseurs: number;
    bons_vente: number;
    bons_achat: number;
    factures: number;
    devis?: number;
    utilisateurs: number;
  };
  sequences: Record<string, number>;
  data: {
    produits: Produit[];
    clients: Client[];
    fournisseurs: Fournisseur[];
    prix_speciaux_clients: PrixSpecialClient[];
    prix_paliers: PrixPalier[];
    bons_vente: BonVente[];
    bons_achat: BonAchat[];
    factures: Facture[];
    devis: Devis[];
    versements_clients: VersementClient[];
    versements_fournisseurs: VersementFournisseur[];
    versements_prospects: VersementProspect[];
    versements_vendeurs: VersementVendeur[];
    commandes_clients: CommandeClient[];
    commandes_prospects: CommandeProspect[];
    vendeurs: Vendeur[];
    stock_camion_vendeur: StockCamionItem[];
    bons_chargement: BonChargement[];
    dechargements_camion: DechargementCamion[];
    retours_vente: RetourVente[];
    retours_achat: RetourAchat[];
    retours_vendeur: RetourVendeur[];
    prospects_clients: ProspectClient[];
    tournee_pointages: TourneePointage[];
    mouvements_stock: MouvementStock[];
    utilisateurs: Utilisateur[];
    journal_audit: JournalAudit[];
    profils_entreprise: ProfilEntreprise[];
    document_profils: DocumentProfilConfig;
    marques_custom: string[];
    unites_custom: string[];
  };
}

export const store = new InMemoryStore();
