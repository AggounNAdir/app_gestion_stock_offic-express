export type RoleKey =
  | 'admin'
  | 'gestionnaire'
  | 'vendeur'
  | 'caissier'
  | 'lecture_seule';

export const ROLES: Record<RoleKey, string> = {
  admin: 'Administrateur',
  gestionnaire: 'Gestionnaire',
  vendeur: 'Vendeur',
  caissier: 'Caissier',
  lecture_seule: 'Lecture seule',
};

export const CATEGORIES: Record<string, string> = {
  dashboard: 'Tableau de bord',
  catalogue: 'Produits et grille des prix',
  tiers: 'Clients, fournisseurs, prospects',
  ventes: 'Ventes, factures, retours et commandes portail',
  achats: 'Achats et retours fournisseur',
  stock: 'Mouvements et ajustements de stock',
  finances: 'Versements et situations',
  rapports: 'Statistiques et analyses',
  equipe: 'Vendeurs et suivi portail',
  profils: 'Profils entreprise',
  utilisateurs: 'Utilisateurs et droits',
};

export const PAGE_CATEGORIE: Record<string, string> = {
  dashboard: 'dashboard',
  produits: 'catalogue',
  grille_prix: 'catalogue',
  mouvements_stock: 'stock',
  clients: 'tiers',
  fournisseurs: 'tiers',
  prospects_vendeurs: 'equipe',
  factures: 'ventes',
  devis: 'ventes',
  pos_caisse: 'ventes',
  bons_vente: 'ventes',
  retours_vente: 'ventes',
  cmd_portail: 'ventes',
  bons_achat: 'achats',
  retours_achat: 'achats',
  vers_clients: 'finances',
  vers_fourn: 'finances',
  versements: 'finances',
  situations: 'finances',
  echeancier: 'finances',
  sit_clients: 'finances',
  sit_fourn: 'finances',
  statistiques: 'rapports',
  stats_achats: 'rapports',
  stats_ventes: 'rapports',
  analyse_produits: 'rapports',
  vendeurs: 'equipe',
  chargements: 'equipe',
  retours_vendeur: 'equipe',
  portail_suivi: 'equipe',
  profils: 'profils',
  utilisateurs: 'utilisateurs',
  journal_audit: 'utilisateurs',
};

export const ROLE_CATEGORIES: Record<RoleKey, Set<string>> = {
  admin: new Set(Object.keys(CATEGORIES)),
  gestionnaire: new Set(
    Object.keys(CATEGORIES).filter((c) => c !== 'utilisateurs')
  ),
  vendeur: new Set([
    'dashboard',
    'catalogue',
    'tiers',
    'ventes',
    'finances',
    'rapports',
  ]),
  caissier: new Set(['dashboard', 'ventes', 'finances']),
  lecture_seule: new Set(
    Object.keys(CATEGORIES).filter((c) => c !== 'utilisateurs')
  ),
};

export const ACTIONS: Record<string, Set<RoleKey>> = {
  gerer_utilisateurs: new Set(['admin']),
  gerer_chargements: new Set(['admin', 'gestionnaire']),
  valider_commandes: new Set(['admin', 'gestionnaire']),
  encaisser_versement_vendeur: new Set(['admin', 'gestionnaire', 'caissier']),
  supprimer_definitivement: new Set(['admin', 'gestionnaire']),
  ajuster_stock: new Set(['admin', 'gestionnaire']),
  annuler_bon: new Set(['admin', 'gestionnaire']),
};

export function peutVoirPage(role: string | undefined, pageKey: string): boolean {
  if (!role || !(role in ROLE_CATEGORIES)) return false;
  const cats = ROLE_CATEGORIES[role as RoleKey];
  if (pageKey === 'retours') {
    return cats.has('ventes') || cats.has('achats');
  }
  const cat = PAGE_CATEGORIE[pageKey];
  if (!cat) return true;
  return cats.has(cat);
}

export function peut(role: string | undefined, actionCle: string): boolean {
  if (!role || !(role in ROLES)) return false;
  const allowed = ACTIONS[actionCle];
  return allowed ? allowed.has(role as RoleKey) : false;
}
