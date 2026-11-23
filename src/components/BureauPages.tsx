import React, { useEffect, useState } from 'react';
import { apiFetch, fmtDA } from '../api.ts';
import type { ThemeKey } from '../api.ts';
import { RetoursPage, RetoursVendeursPage } from './RetoursPages.tsx';
import { VendeursPage, ChargementsPage } from './VendeursEtChargements.tsx';
import { StatistiquesPage } from './StatistiquesEtAnalyse.tsx';
import {
  VersementsPage,
  SituationsPage,
  MouvementsStockPage,
} from './FinancesEtStockPages.tsx';
import {
  UtilisateursPage,
  JournalAuditPage,
  ProfilDocsAndSystemSection,
} from './AdministrationPages.tsx';
import { DevisPage } from './DevisPage.tsx';
import { EcheancierRelancesPanel } from './EcheancierRelancesPage.tsx';
import { PosCaissePage, Ticket80mmModal } from './PosCaissePage.tsx';

function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const UNITES_STANDARD = [
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
];

const TYPES_PROFIL = [
  { value: 'complet', label: 'Complet (Toutes fonctionnalités)' },
  { value: 'gros', label: 'Grossiste / Distributeur' },
  { value: 'detail', label: 'Détaillant / Comptoir' },
  { value: 'simple', label: 'Simplifié' },
  { value: 'export', label: 'Facturation & Export' },
];

const FORMES_JURIDIQUES = [
  'SARL',
  'EURL',
  'SPA',
  'SNC',
  'Personne Physique',
  'Auto-Entrepreneur',
  'Autre',
];

export function BureauPageContent({
  pageKey,
  token,
  userRole,
  onNavigate,
  themeKey,
  onChangeTheme,
}: {
  pageKey: string;
  token: string;
  userRole?: string;
  onNavigate: (key: string) => void;
  themeKey?: ThemeKey;
  onChangeTheme?: (k: ThemeKey) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  // Produits filters & referentiels
  const [unitFilter, setUnitFilter] = useState('Tous');
  const [sortBy, setSortBy] = useState('Désignation');
  const [showArchived, setShowArchived] = useState(false);
  const [fournisseursList, setFournisseursList] = useState<any[]>([]);
  const [marquesList, setMarquesList] = useState<string[]>([]);
  const [unitesList, setUnitesList] = useState<string[]>(UNITES_STANDARD);
  const [mvtProdFilter, setMvtProdFilter] = useState<number | null>(null);

  // Produit Create / Edit Modal
  const [showProdModal, setShowProdModal] = useState(false);
  const [editingProdId, setEditingProdId] = useState<number | null>(null);
  const [uniteChoice, setUniteChoice] = useState('carton');
  const [uniteCustom, setUniteCustom] = useState('');
  const [margePct, setMargePct] = useState('25');
  const [prodForm, setProdForm] = useState({
    code: '',
    barcode: '',
    designation: '',
    marque: '',
    fournisseur: '',
    facteur_conversion: '12',
    prix_achat: '100',
    prix_super_gros: '115',
    prix_gros: '125',
    prix_detail: '135',
    prix_special: '110',
    stock_actuel: '100',
    stock_min: '20',
    tva: '19',
  });

  // Ajustement stock modal
  const [ajustProd, setAjustProd] = useState<any>(null);
  const [ajustStockVal, setAjustStockVal] = useState('');
  const [ajustMotif, setAjustMotif] = useState('Inventaire physique');

  // Tiers Create / Edit + Dette / Solde initial Modal
  const [showTiersModal, setShowTiersModal] = useState(false);
  const [editingTiersId, setEditingTiersId] = useState<number | null>(null);
  const [tiersForm, setTiersForm] = useState({
    code: '',
    nom: '',
    tel: '',
    adresse: '',
    email: '',
    ville: '',
    nif: '',
    niveau_prix: 'detail',
    portail_actif: true,
    password: '',
    plafond_credit: '0',
    bloquer_si_depasse: false,
  });
  const [clientsDepasseOnly, setClientsDepasseOnly] = useState(false);
  const [detteTiers, setDetteTiers] = useState<{ kind: 'client' | 'fournisseur'; item: any } | null>(null);
  const [detteForm, setDetteForm] = useState({
    mode: 'solde_initial' as 'solde_initial' | 'remboursement',
    montant: '',
    mode_reglement: 'Espèces',
    motif: '',
  });

  // Bons Vente / Comptoir / Bons Achat state & modals
  const [bvClientFilter, setBvClientFilter] = useState('Tous');
  const [detailBon, setDetailBon] = useState<any>(null);
  const [ticketBon, setTicketBon] = useState<any>(null);
  const [detailCmd, setDetailCmd] = useState<any>(null);

  const [showVenteModal, setShowVenteModal] = useState(false);
  const [editingVenteId, setEditingVenteId] = useState<number | null>(null);
  const [isComptoir, setIsComptoir] = useState(false);
  const [venteDate, setVenteDate] = useState(new Date().toISOString().slice(0, 10));
  const [venteDateEcheance, setVenteDateEcheance] = useState('');
  const [venteBarcode, setVenteBarcode] = useState('');
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({ nom: '', tel: '' });
  const [venteClients, setVenteClients] = useState<any[]>([]);
  const [venteProduits, setVenteProduits] = useState<any[]>([]);
  const [venteClientId, setVenteClientId] = useState<number>(1);
  const [venteVerse, setVenteVerse] = useState<string>('0');
  const [venteModeRegl, setVenteModeRegl] = useState('Espèces');
  const [venteRemiseType, setVenteRemiseType] = useState<'aucune' | 'montant' | 'pourcentage'>('aucune');
  const [venteRemiseVal, setVenteRemiseVal] = useState('0');
  const [venteRemiseMotif, setVenteRemiseMotif] = useState('');
  const [venteObs, setVenteObs] = useState('');
  const [venteForcerPlafond, setVenteForcerPlafond] = useState(false);
  const [venteEditingBon, setVenteEditingBon] = useState<any>(null);
  const [cmdForcerPlafond, setCmdForcerPlafond] = useState(false);
  const [venteLignes, setVenteLignes] = useState<
    { produit_id: number; quantite: number; prix_unitaire: number; remise: number; niveau_prix: string }[]
  >([]);

  const [showAchatModal, setShowAchatModal] = useState(false);
  const [editingAchatId, setEditingAchatId] = useState<number | null>(null);
  const [achatDate, setAchatDate] = useState(new Date().toISOString().slice(0, 10));
  const [achatFournisseurs, setAchatFournisseurs] = useState<any[]>([]);
  const [achatFournId, setAchatFournId] = useState<number>(1);
  const [achatObs, setAchatObs] = useState('');
  const [achatLignes, setAchatLignes] = useState<
    { produit_id: number; quantite: number; prix_unitaire: number }[]
  >([]);

  // Factures tabs & modals
  const [facturesTab, setFacturesTab] = useState<'liste' | 'echeancier'>('liste');
  const [detailFacture, setDetailFacture] = useState<any>(null);
  const [editFacture, setEditFacture] = useState<any>(null);
  const [editFacForm, setEditFacForm] = useState({
    date_facture: '',
    date_echeance: '',
    tva: '19',
    statut: 'Émise',
    observations: '',
  });
  const [showNewFacModal, setShowNewFacModal] = useState(false);
  const [unbilledBons, setUnbilledBons] = useState<any[]>([]);
  const [newFacForm, setNewFacForm] = useState({
    bon_vente_id: 0,
    date_facture: new Date().toISOString().slice(0, 10),
    tva: '19',
    date_echeance: '',
    observations: '',
  });

  // Prospects & Suivi portail filters
  const [prospectStatutFilter, setProspectStatutFilter] = useState('Tous');
  const [suiviTab, setSuiviTab] = useState<'commandes' | 'tournee'>('commandes');

  const [sitType, setSitType] = useState<'client' | 'fournisseur'>('client');
  const [sitTiersId, setSitTiersId] = useState<number>(0);

  const [psForm, setPsForm] = useState({
    client_id: 0,
    produit_id: 0,
    prix_special: '',
  });

  const [palForm, setPalForm] = useState({
    produit_id: 0,
    niveau: 'gros',
    qte_min: '',
    prix: '',
  });

  // Profils Entreprise state & modal
  const [activeProfil, setActiveProfil] = useState<any>(null);
  const [profilTypeFilter, setProfilTypeFilter] = useState('Tous');
  const [profilStatutFilter, setProfilStatutFilter] = useState('Tous');
  const [showProfilModal, setShowProfilModal] = useState(false);
  const [editingProfilId, setEditingProfilId] = useState<number | null>(null);
  const [profilModalTab, setProfilModalTab] = useState<'general' | 'fiscal' | 'docs'>('general');
  const [confirmDeleteProfilId, setConfirmDeleteProfilId] = useState<number | null>(null);
  const [profilForm, setProfilForm] = useState({
    code: '',
    nom: '',
    type_profil: 'complet',
    forme_juridique: 'SARL',
    activite: '',
    capital_social: '',
    adresse: '',
    ville: '',
    code_postal: '',
    telephone: '',
    telephone2: '',
    email: '',
    site_web: '',
    nif: '',
    nis: '',
    nrc: '',
    art_imp: '',
    banque: '',
    rib: '',
    devise: 'DA',
    tva_defaut: '19',
    prefixe_bv: 'BV',
    prefixe_facture: 'FAC',
    pied_page: '',
    logo_data: '' as string | null,
    est_defaut: false,
    actif: true,
  });

  const loadPage = async (archivedOverride?: boolean) => {
    const delegatedPages = [
      'retours',
      'retours_vendeur',
      'vendeurs',
      'chargements',
      'statistiques',
      'versements',
      'situations',
      'mouvements_stock',
      'utilisateurs',
      'journal_audit',
      'devis',
      'pos_caisse',
    ];
    if (delegatedPages.includes(pageKey)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const incArch = archivedOverride ?? showArchived;
    try {
      if (pageKey === 'dashboard') {
        setData(await apiFetch('/api/bureau/dashboard', { token }));
      } else if (pageKey === 'produits') {
        const [prods, fourns, refs] = await Promise.all([
          apiFetch(`/api/bureau/produits${incArch ? '?inactifs=1' : ''}`, { token }),
          apiFetch<any[]>('/api/bureau/fournisseurs', { token }).catch(() => []),
          apiFetch<{ marques: string[]; unites: string[] }>('/api/bureau/produits/referentiels', {
            token,
          }).catch(() => ({ marques: [], unites: UNITES_STANDARD })),
        ]);
        setData(prods);
        setFournisseursList(fourns);
        setMarquesList(refs.marques || []);
        setUnitesList(refs.unites?.length ? refs.unites : UNITES_STANDARD);
      } else if (pageKey === 'grille_prix') {
        const [prods, ps, pal, cls] = await Promise.all([
          apiFetch('/api/bureau/produits', { token }),
          apiFetch('/api/bureau/prix-speciaux', { token }),
          apiFetch('/api/bureau/prix-paliers', { token }),
          apiFetch('/api/bureau/clients', { token }),
        ]);
        setData({ prods, ps, pal, cls });
      } else if (pageKey === 'clients') {
        setData(await apiFetch('/api/bureau/clients', { token }));
      } else if (pageKey === 'fournisseurs') {
        setData(await apiFetch('/api/bureau/fournisseurs', { token }));
      } else if (pageKey === 'prospects_vendeurs') {
        setData(await apiFetch('/api/bureau/prospects', { token }));
      } else if (pageKey === 'bons_vente') {
        setData(await apiFetch('/api/bureau/bons-vente', { token }));
      } else if (pageKey === 'bons_achat') {
        setData(await apiFetch('/api/bureau/bons-achat', { token }));
      } else if (pageKey === 'factures') {
        setData(await apiFetch('/api/bureau/factures', { token }));
      } else if (pageKey === 'cmd_portail') {
        setData(await apiFetch('/api/bureau/commandes-portail', { token }));
      } else if (pageKey === 'portail_suivi') {
        const [pointages, commandes] = await Promise.all([
          apiFetch<any[]>('/api/bureau/pointages', { token }),
          apiFetch<any[]>('/api/bureau/commandes-prospects', { token }).catch(() => []),
        ]);
        setData({ pointages, commandes });
      } else if (pageKey === 'profils') {
        const list = await apiFetch<any[]>('/api/bureau/profils', { token });
        setData(list);
        setActiveProfil(list.find((p) => p.est_defaut === 1) || list[0] || null);
      } else if (pageKey === 'echeancier') {
        setData({ standalone: true });
      } else {
        setData({ unmigrated: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiFetch('/api/bureau/profil-actif', { token })
      .then((p) => setActiveProfil(p))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    setMessage(null);
    setError(null);
    setSearch('');
    setConfirmKey(null);
    setConfirmDeleteProfilId(null);
    loadPage();
  }, [pageKey, token, mvtProdFilter]);

  const openNewProduit = () => {
    setEditingProdId(null);
    setUniteChoice('carton');
    setUniteCustom('');
    setProdForm({
      code: '',
      barcode: '',
      designation: '',
      marque: '',
      fournisseur: fournisseursList[0]?.nom || '',
      facteur_conversion: '12',
      prix_achat: '100',
      prix_super_gros: '115',
      prix_gros: '125',
      prix_detail: '135',
      prix_special: '110',
      stock_actuel: '100',
      stock_min: '20',
      tva: '19',
    });
    setShowProdModal(true);
  };

  const openEditProduit = (p: any) => {
    setEditingProdId(p.id);
    const u = p.unite || 'Pcs';
    if (UNITES_STANDARD.includes(u)) {
      setUniteChoice(u);
      setUniteCustom('');
    } else {
      setUniteChoice('Autre...');
      setUniteCustom(u);
    }
    setProdForm({
      code: p.code || '',
      barcode: p.barcode || '',
      designation: p.designation || '',
      marque: p.marque || '',
      fournisseur: p.fournisseur || '',
      facteur_conversion: String(p.facteur_conversion ?? 1),
      prix_achat: String(p.prix_achat ?? 0),
      prix_super_gros: String(p.prix_super_gros ?? 0),
      prix_gros: String(p.prix_gros ?? 0),
      prix_detail: String(p.prix_detail ?? p.prix_vente ?? 0),
      prix_special: String(p.prix_special ?? 0),
      stock_actuel: String(p.stock_actuel ?? 0),
      stock_min: String(p.stock_min ?? 0),
      tva: String(p.tva ?? 19),
    });
    setShowProdModal(true);
  };

  const appliquerMargeSurPrixAchat = () => {
    const pa = Number(prodForm.prix_achat || 0);
    const pct = Number(margePct || 0);
    if (pa <= 0) return;
    const pv = (pa * (1 + pct / 100)).toFixed(2);
    setProdForm((prev) => ({
      ...prev,
      prix_detail: pv,
      prix_gros: (pa * (1 + (pct * 0.75) / 100)).toFixed(2),
      prix_super_gros: (pa * (1 + (pct * 0.5) / 100)).toFixed(2),
    }));
  };

  const submitProduit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uniteFinale =
      uniteChoice === 'Autre...'
        ? uniteCustom.trim() || 'Pcs'
        : uniteChoice;
    try {
      const payload = { ...prodForm, unite: uniteFinale };
      if (editingProdId) {
        await apiFetch(`/api/bureau/produits/${editingProdId}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(payload),
        });
        setMessage('Produit modifié avec succès.');
      } else {
        await apiFetch('/api/bureau/produits', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setMessage('Produit ajouté au catalogue.');
      }
      setShowProdModal(false);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur produit');
    }
  };

  const exportProduitsCsv = (rows: any[]) => {
    const header = [
      'Code',
      'Code Barre',
      'Désignation',
      'Marque',
      'Unité',
      'Facteur',
      'Prix Achat',
      'PMP',
      'Prix Vente',
      'TVA',
      'Stock',
      'Stock Min',
    ].join(';');
    const lines = rows.map((p) =>
      [
        p.code,
        p.barcode || '',
        `"${(p.designation || '').replace(/"/g, '""')}"`,
        p.marque || '',
        p.unite,
        p.facteur_conversion,
        p.prix_achat,
        p.prix_moyen_pondere,
        p.prix_detail || p.prix_vente,
        p.tva,
        p.stock_actuel,
        p.stock_min,
      ].join(';')
    );
    const blob = new Blob([[header, ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventaire_produits_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const prixPourClientEtProduit = (clientId: number, prod: any): number => {
    const cl = venteClients.find((c) => c.id === clientId);
    const niv = cl?.niveau_prix || 'detail';
    if (niv === 'super_gros' && prod.prix_super_gros > 0)
      return prod.prix_super_gros;
    if (niv === 'gros' && prod.prix_gros > 0) return prod.prix_gros;
    if (niv === 'special' && prod.prix_special > 0) return prod.prix_special;
    return prod.prix_detail || prod.prix_vente || 0;
  };

  const prixParNiveau = (prod: any, niveau: string, clientId: number): number => {
    if (niveau === 'super_gros' && prod.prix_super_gros > 0) return prod.prix_super_gros;
    if (niveau === 'gros' && prod.prix_gros > 0) return prod.prix_gros;
    if (niveau === 'special' && prod.prix_special > 0) return prod.prix_special;
    if (niveau === 'detail' && (prod.prix_detail > 0 || prod.prix_vente > 0))
      return prod.prix_detail || prod.prix_vente;
    return prixPourClientEtProduit(clientId, prod);
  };

  const openNewVente = async (comptoir = false) => {
    const [cls, prods] = await Promise.all([
      apiFetch<any[]>('/api/bureau/clients', { token }),
      apiFetch<any[]>('/api/bureau/produits', { token }),
    ]);
    setVenteClients(cls);
    setVenteProduits(prods);
    setEditingVenteId(null);
    setIsComptoir(comptoir);
    setVenteDate(new Date().toISOString().slice(0, 10));
    setVenteDateEcheance('');
    setVenteBarcode('');
    setShowQuickClient(false);
    const defaultClient = comptoir
      ? cls.find((c) => c.code === 'CLT-COMPTOIR')?.id || cls[0]?.id || 1
      : cls.find((c) => c.code !== 'CLT-COMPTOIR')?.id || cls[0]?.id || 1;
    setVenteClientId(defaultClient);
    const clObj = cls.find((c) => c.id === defaultClient);
    const niv = clObj?.niveau_prix || 'detail';
    const firstProd = prods[0];
    const pu = firstProd ? prixParNiveau(firstProd, 'client', defaultClient) : 0;
    setVenteVerse(comptoir ? String(pu) : '0');
    setVenteModeRegl('Espèces');
    setVenteRemiseType('aucune');
    setVenteRemiseVal('0');
    setVenteRemiseMotif('');
    setVenteObs(comptoir ? 'Vente comptoir' : '');
    setVenteForcerPlafond(false);
    setVenteEditingBon(null);
    setVenteLignes(
      firstProd
        ? [{ produit_id: firstProd.id, quantite: 1, prix_unitaire: pu, remise: 0, niveau_prix: niv }]
        : []
    );
    setShowVenteModal(true);
  };

  const openEditVente = async (bon: any) => {
    const [cls, prods] = await Promise.all([
      apiFetch<any[]>('/api/bureau/clients', { token }),
      apiFetch<any[]>('/api/bureau/produits', { token }),
    ]);
    setVenteClients(cls);
    setVenteProduits(prods);
    setEditingVenteId(bon.id);
    setVenteEditingBon(bon);
    setVenteForcerPlafond(false);
    setIsComptoir(false);
    setVenteDate(bon.date_bon || new Date().toISOString().slice(0, 10));
    setVenteDateEcheance(bon.date_echeance || '');
    setVenteBarcode('');
    setShowQuickClient(false);
    setVenteClientId(bon.client_id);
    setVenteVerse(String(bon.montant_verse || 0));
    setVenteModeRegl('Espèces');
    setVenteRemiseType(bon.remise_type || 'aucune');
    setVenteRemiseVal(String(bon.remise_valeur || 0));
    setVenteRemiseMotif(bon.remise_motif || '');
    setVenteObs(bon.observations || '');
    setVenteLignes(
      (bon.lignes || []).map((l: any) => ({
        produit_id: l.produit_id,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        remise: l.remise || 0,
        niveau_prix: l.niveau_prix || 'client',
      }))
    );
    setShowVenteModal(true);
  };

  const openNewAchat = async () => {
    const [fourns, prods] = await Promise.all([
      apiFetch<any[]>('/api/bureau/fournisseurs', { token }),
      apiFetch<any[]>('/api/bureau/produits', { token }),
    ]);
    setAchatFournisseurs(fourns);
    setVenteProduits(prods);
    setEditingAchatId(null);
    setAchatDate(new Date().toISOString().slice(0, 10));
    setAchatFournId(fourns[0]?.id || 1);
    setAchatObs('');
    setAchatLignes(
      prods[0]
        ? [
            {
              produit_id: prods[0].id,
              quantite: 10,
              prix_unitaire: prods[0].prix_achat,
            },
          ]
        : []
    );
    setShowAchatModal(true);
  };

  const openEditAchat = async (ba: any) => {
    const [fourns, prods] = await Promise.all([
      apiFetch<any[]>('/api/bureau/fournisseurs', { token }),
      apiFetch<any[]>('/api/bureau/produits', { token }),
    ]);
    setAchatFournisseurs(fourns);
    setVenteProduits(prods);
    setEditingAchatId(ba.id);
    setAchatDate(ba.date_bon || new Date().toISOString().slice(0, 10));
    setAchatFournId(ba.fournisseur_id);
    setAchatObs(ba.observations || '');
    setAchatLignes(
      (ba.lignes || []).map((l: any) => ({
        produit_id: l.produit_id,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
      }))
    );
    setShowAchatModal(true);
  };

  const submitVente = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        client_id: venteClientId,
        date_bon: venteDate,
        date_echeance: venteDateEcheance || null,
        montant_verse: Number(venteVerse || 0),
        mode_reglement: venteModeRegl,
        remise_type: venteRemiseType,
        remise_valeur: Number(venteRemiseVal || 0),
        remise_motif: venteRemiseMotif,
        observations: venteObs,
        forcer_plafond: venteForcerPlafond,
        lignes: venteLignes,
      };
      if (editingVenteId) {
        const res = await apiFetch<any>(`/api/bureau/bons-vente/${editingVenteId}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(payload),
        });
        setMessage(
          `Bon de vente modifié avec recalcul du stock et du solde.${
            res?.credit_warning ? ` ⚠️ ${res.credit_warning}` : ''
          }`
        );
      } else {
        const res = await apiFetch<any>('/api/bureau/bons-vente', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setMessage(
          `Bon de vente enregistré avec mise à jour du stock et du solde.${
            res?.credit_warning ? ` ⚠️ ${res.credit_warning}` : ''
          }`
        );
      }
      setShowVenteModal(false);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur vente');
    }
  };

  const submitAchat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        fournisseur_id: achatFournId,
        date_bon: achatDate,
        observations: achatObs,
        lignes: achatLignes,
      };
      if (editingAchatId) {
        await apiFetch(`/api/bureau/bons-achat/${editingAchatId}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(payload),
        });
        setMessage("Bon d'achat modifié.");
      } else {
        await apiFetch('/api/bureau/bons-achat', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setMessage("Bon d'achat validé (stock et PMP recalculés).");
      }
      setShowAchatModal(false);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur achat');
    }
  };

  const submitTiers = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const base =
        pageKey === 'clients' ? '/api/bureau/clients' : '/api/bureau/fournisseurs';
      const bodyPayload =
        pageKey === 'clients'
          ? {
              ...tiersForm,
              plafond_credit: Math.max(0, Number(tiersForm.plafond_credit || 0)),
              bloquer_si_depasse: tiersForm.bloquer_si_depasse ? 1 : 0,
            }
          : tiersForm;
      if (editingTiersId) {
        await apiFetch(`${base}/${editingTiersId}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(bodyPayload),
        });
        setMessage('Fiche mise à jour.');
      } else {
        await apiFetch(base, {
          method: 'POST',
          token,
          body: JSON.stringify(bodyPayload),
        });
        setMessage('Fiche enregistrée.');
      }
      setShowTiersModal(false);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur enregistrement');
    }
  };

  const openNewProfil = () => {
    setEditingProfilId(null);
    setProfilModalTab('general');
    setProfilForm({
      code: '',
      nom: '',
      type_profil: 'complet',
      forme_juridique: 'SARL',
      activite: '',
      capital_social: '',
      adresse: '',
      ville: '',
      code_postal: '',
      telephone: '',
      telephone2: '',
      email: '',
      site_web: '',
      nif: '',
      nis: '',
      nrc: '',
      art_imp: '',
      banque: '',
      rib: '',
      devise: 'DA',
      tva_defaut: '19',
      prefixe_bv: 'BV',
      prefixe_facture: 'FAC',
      pied_page: '',
      logo_data: null,
      est_defaut: false,
      actif: true,
    });
    setShowProfilModal(true);
  };

  const openEditProfil = (pr: any) => {
    setEditingProfilId(pr.id);
    setProfilModalTab('general');
    setProfilForm({
      code: pr.code || '',
      nom: pr.nom || '',
      type_profil: pr.type_profil || 'complet',
      forme_juridique: pr.forme_juridique || 'SARL',
      activite: pr.activite || '',
      capital_social: pr.capital_social || '',
      adresse: pr.adresse || '',
      ville: pr.ville || '',
      code_postal: pr.code_postal || '',
      telephone: pr.telephone || '',
      telephone2: pr.telephone2 || '',
      email: pr.email || '',
      site_web: pr.site_web || '',
      nif: pr.nif || '',
      nis: pr.nis || '',
      nrc: pr.nrc || '',
      art_imp: pr.art_imp || '',
      banque: pr.banque || '',
      rib: pr.rib || '',
      devise: pr.devise || 'DA',
      tva_defaut: String(pr.tva_defaut ?? 19),
      prefixe_bv: pr.prefixe_bv || 'BV',
      prefixe_facture: pr.prefixe_facture || 'FAC',
      pied_page: pr.pied_page || '',
      logo_data: pr.logo_data || null,
      est_defaut: pr.est_defaut === 1,
      actif: pr.actif !== 0,
    });
    setShowProfilModal(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1500000) {
      setError('Le logo ne doit pas dépasser 1,5 Mo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfilForm((prev) => ({
        ...prev,
        logo_data: typeof reader.result === 'string' ? reader.result : null,
      }));
    };
    reader.readAsDataURL(file);
  };

  const submitProfil = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...profilForm,
        tva_defaut: Number(profilForm.tva_defaut || 19),
        actif: profilForm.actif ? 1 : 0,
        est_defaut: profilForm.est_defaut ? 1 : 0,
      };
      if (editingProfilId) {
        await apiFetch(`/api/bureau/profils/${editingProfilId}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(payload),
        });
        setMessage('Profil entreprise mis à jour.');
      } else {
        await apiFetch('/api/bureau/profils', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setMessage('Nouveau profil entreprise créé.');
      }
      setShowProfilModal(false);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur profil entreprise');
    }
  };

  const activerProfilDefaut = async (pr: any) => {
    try {
      await apiFetch(`/api/bureau/profils/${pr.id}/defaut`, {
        method: 'POST',
        token,
      });
      setMessage(`Profil "${pr.nom}" défini comme profil actif par défaut.`);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur activation');
    }
  };

  const dupliquerProfil = async (pr: any) => {
    try {
      await apiFetch(`/api/bureau/profils/${pr.id}/dupliquer`, {
        method: 'POST',
        token,
      });
      setMessage(`Profil "${pr.nom}" dupliqué.`);
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur duplication');
    }
  };

  const toggleActifProfil = async (pr: any) => {
    try {
      await apiFetch(`/api/bureau/profils/${pr.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ actif: pr.actif === 1 ? 0 : 1 }),
      });
      setMessage(pr.actif === 1 ? 'Profil désactivé.' : 'Profil réactivé.');
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur statut');
    }
  };

  const supprimerProfil = async (id: number) => {
    try {
      await apiFetch(`/api/bureau/profils/${id}`, {
        method: 'DELETE',
        token,
      });
      setConfirmDeleteProfilId(null);
      setMessage('Profil supprimé.');
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur suppression');
    }
  };

  // Filtered & sorted products
  const produitsAffiches =
    pageKey === 'produits' && Array.isArray(data)
      ? data
          .filter((p: any) => (showArchived ? p.actif === 0 : p.actif === 1))
          .filter(
            (p: any) =>
              unitFilter === 'Tous' ||
              (p.unite || '').toLowerCase().includes(unitFilter.toLowerCase())
          )
          .filter(
            (p: any) =>
              !search ||
              p.designation.toLowerCase().includes(search.toLowerCase()) ||
              p.code.toLowerCase().includes(search.toLowerCase()) ||
              (p.barcode || '').toLowerCase().includes(search.toLowerCase()) ||
              (p.marque || '').toLowerCase().includes(search.toLowerCase())
          )
          .sort((a: any, b: any) => {
            if (sortBy === 'Stock') return a.stock_actuel - b.stock_actuel;
            if (sortBy === 'Prix Achat') return b.prix_achat - a.prix_achat;
            if (sortBy === 'Prix Vente') return b.prix_detail - a.prix_detail;
            return a.designation.localeCompare(b.designation);
          })
      : [];

  return (
    <div>
      {error && <div className="alert-box alert-error">{error}</div>}
      {message && <div className="alert-box alert-success">{message}</div>}
      {loading && <div className="page-subtitle">Chargement...</div>}

      {/* ── DASHBOARD ── */}
      {pageKey === 'dashboard' && data?.kpis && (
        <>
          <div className="page-header">
            <div>
              <h2 className="page-title">🏠 Tableau de Bord</h2>
              <p className="page-subtitle">Vue d'ensemble de votre activité</p>
            </div>
            <button className="btn" onClick={() => loadPage()}>
              🔄 Actualiser
            </button>
          </div>

          <div className="kpi-grid">
            <div className="card">
              <div className="kpi-label">📦 Produits</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>
                {data.kpis.nb_produits}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">👥 Clients</div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>
                {data.kpis.nb_clients}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">🏭 Fournisseurs</div>
              <div className="kpi-value" style={{ color: 'var(--orange)' }}>
                {data.kpis.nb_fournisseurs}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">🛒 Bons d'Achat</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>
                {data.kpis.nb_bons_achat}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">🏷️ Bons de Vente</div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>
                {data.kpis.nb_bons_vente}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">🧾 Factures</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>
                {data.kpis.nb_factures}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">💰 CA Ventes</div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>
                {fmtDA(data.kpis.ca_ventes)}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">📥 Total Achats</div>
              <div className="kpi-value" style={{ color: 'var(--orange)' }}>
                {fmtDA(data.kpis.total_achats)}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">⚠️ Alertes Stock</div>
              <div className="kpi-value" style={{ color: 'var(--red)' }}>
                {data.kpis.stock_alerte}
              </div>
            </div>
          </div>

          <h3 style={{ color: 'var(--orange)', marginBottom: 10 }}>
            ⚠️ Alertes &amp; Notifications
          </h3>
          {data.alertes?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.alertes.map((a: any) => {
                const f = a.facteur_conversion || 1;
                return (
                  <div
                    key={a.id}
                    className="card"
                    style={{
                      padding: '10px 14px',
                      color: 'var(--red)',
                      fontWeight: 600,
                    }}
                  >
                    📦 {a.designation} ({a.code}) — Stock:{' '}
                    {(a.stock_actuel / f).toFixed(1)} ({a.stock_actuel} pcs) / Min:{' '}
                    {(a.stock_min / f).toFixed(1)} ({a.stock_min} pcs)
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ color: 'var(--green)' }}>
              ✅ Aucune alerte — Tous les stocks sont suffisants
            </div>
          )}
        </>
      )}

      {/* ── DÉLÉGATION VERS MODULES RESTAURÉS ── */}
      {pageKey === 'retours' && <RetoursPage token={token} />}
      {pageKey === 'retours_vendeur' && <RetoursVendeursPage token={token} />}
      {pageKey === 'vendeurs' && <VendeursPage token={token} />}
      {pageKey === 'chargements' && <ChargementsPage token={token} />}
      {pageKey === 'statistiques' && <StatistiquesPage token={token} />}
      {pageKey === 'versements' && <VersementsPage token={token} />}
      {pageKey === 'situations' && (
        <SituationsPage
          token={token}
          initialType={sitType}
          initialTiersId={sitTiersId}
        />
      )}
      {pageKey === 'mouvements_stock' && (
        <MouvementsStockPage
          token={token}
          mvtProdFilter={mvtProdFilter}
          onClearProdFilter={() => setMvtProdFilter(null)}
        />
      )}
      {pageKey === 'utilisateurs' && <UtilisateursPage token={token} />}
      {pageKey === 'journal_audit' && <JournalAuditPage token={token} />}
      {pageKey === 'devis' && (
        <DevisPage token={token} userRole={userRole} onNavigate={onNavigate} />
      )}
      {pageKey === 'pos_caisse' && (
        <PosCaissePage token={token} userRole={userRole} onNavigate={onNavigate} />
      )}
      {pageKey === 'echeancier' && (
        <EcheancierRelancesPanel token={token} userRole={userRole} standaloneTitle />
      )}

      {/* ── PRODUITS ── */}
      {pageKey === 'produits' && Array.isArray(data) && (
        <>
          <div className="page-header">
            <h2 className="page-title">
              📦 Gestion des Produits {showArchived ? '(Archivés)' : ''}
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-muted"
                onClick={() => exportProduitsCsv(produitsAffiches)}
              >
                📄 Export CSV
              </button>
              <button
                className="btn btn-muted"
                onClick={() => {
                  const rowsHtml = produitsAffiches
                    .map(
                      (p: any) =>
                        `<tr><td>${p.code}</td><td>${p.designation}</td><td>${p.marque || ''}</td><td>${p.unite}</td><td>${p.prix_achat}</td><td>${p.prix_detail}</td><td>${p.stock_actuel}</td></tr>`
                    )
                    .join('');
                  downloadTextFile(
                    `<!doctype html><html><head><meta charset="utf-8"><title>Catalogue Produits</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;font-size:12px}</style></head><body><h2>Catalogue Produits (${produitsAffiches.length})</h2><table><thead><tr><th>Code</th><th>Désignation</th><th>Marque</th><th>Unité</th><th>P. Achat</th><th>P. Détail</th><th>Stock</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`,
                    `catalogue_produits_${new Date().toISOString().slice(0, 10)}.html`,
                    'text/html;charset=utf-8;'
                  );
                }}
              >
                🌐 Export HTML
              </button>
              <button
                className="btn btn-muted"
                onClick={() => window.print()}
              >
                🖨 Imprimer
              </button>
              <button
                className={`btn ${showArchived ? 'btn-orange' : 'btn-muted'}`}
                onClick={() => {
                  const next = !showArchived;
                  setShowArchived(next);
                  loadPage(next);
                }}
              >
                📁 {showArchived ? 'Voir Actifs' : 'Voir Archivés'}
              </button>
              <button className="btn btn-green" onClick={openNewProduit}>
                + Nouveau Produit
              </button>
            </div>
          </div>

          <div className="toolbar">
            <input
              className="input"
              style={{ width: 250 }}
              placeholder="Rechercher code, barre, désignation, marque..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label style={{ color: 'var(--muted)', fontSize: 12 }}>
              Filtrer unité :
            </label>
            <select
              className="select"
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
            >
              <option value="Tous">Tous</option>
              {unitesList.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <label style={{ color: 'var(--muted)', fontSize: 12 }}>
              Trier par :
            </label>
            <select
              className="select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="Désignation">Désignation</option>
              <option value="Stock">Stock (croissant)</option>
              <option value="Prix Achat">Prix Achat</option>
              <option value="Prix Vente">Prix Vente</option>
            </select>
            <span style={{ color: 'var(--muted)' }}>
              {produitsAffiches.length} produit(s)
            </span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Code Barre</th>
                  <th>Désignation</th>
                  <th>Marque</th>
                  <th>Unité</th>
                  <th>Facteur</th>
                  <th>P. Achat</th>
                  <th>PMP</th>
                  <th>S. Gros</th>
                  <th>Gros</th>
                  <th>Détail</th>
                  <th>TVA</th>
                  <th>Stock</th>
                  <th>Min</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {produitsAffiches.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.code}</td>
                    <td>{p.barcode || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{p.designation}</td>
                    <td>{p.marque || '—'}</td>
                    <td>{p.unite}</td>
                    <td>x{p.facteur_conversion}</td>
                    <td>{fmtDA(p.prix_achat)}</td>
                    <td>{fmtDA(p.prix_moyen_pondere)}</td>
                    <td>{fmtDA(p.prix_super_gros)}</td>
                    <td>{fmtDA(p.prix_gros)}</td>
                    <td style={{ fontWeight: 700 }}>{fmtDA(p.prix_detail)}</td>
                    <td>{p.tva}%</td>
                    <td
                      style={{
                        fontWeight: 700,
                        color:
                          p.stock_actuel <= p.stock_min
                            ? 'var(--red)'
                            : 'var(--green)',
                      }}
                    >
                      {p.stock_actuel} pcs
                    </td>
                    <td>{p.stock_min}</td>
                    <td style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                      <button
                        className="btn"
                        style={{ padding: '4px 7px', fontSize: 11 }}
                        title="Modifier"
                        onClick={() => openEditProduit(p)}
                      >
                        ✏
                      </button>
                      <button
                        className="btn btn-orange"
                        style={{ padding: '4px 7px', fontSize: 11 }}
                        title="Ajuster Stock"
                        onClick={() => {
                          setAjustProd(p);
                          setAjustStockVal(String(p.stock_actuel));
                          setAjustMotif('Inventaire physique');
                        }}
                      >
                        ⚙
                      </button>
                      <button
                        className="btn btn-muted"
                        style={{ padding: '4px 7px', fontSize: 11 }}
                        title="Mouvements de stock"
                        onClick={() => {
                          setMvtProdFilter(p.id);
                          onNavigate('mouvements_stock');
                        }}
                      >
                        📋
                      </button>
                      {p.actif === 1 ? (
                        <button
                          className="btn btn-red"
                          style={{ padding: '4px 7px', fontSize: 11 }}
                          title="Archiver"
                          onClick={async () => {
                            await apiFetch(`/api/bureau/produits/${p.id}`, {
                              method: 'DELETE',
                              token,
                            });
                            setMessage(`${p.designation} archivé.`);
                            loadPage();
                          }}
                        >
                          🗑
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn btn-green"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            title="Restaurer"
                            onClick={async () => {
                              await apiFetch(`/api/bureau/produits/${p.id}`, {
                                method: 'PUT',
                                token,
                                body: JSON.stringify({ actif: 1 }),
                              });
                              setMessage(`${p.designation} restauré.`);
                              loadPage();
                            }}
                          >
                            ♻
                          </button>
                          {confirmKey === `prod-def-${p.id}` ? (
                            <>
                              <button
                                className="btn btn-red"
                                style={{ padding: '4px 7px', fontSize: 11 }}
                                onClick={async () => {
                                  await apiFetch(`/api/bureau/produits/${p.id}/definitif`, {
                                    method: 'DELETE',
                                    token,
                                  });
                                  setConfirmKey(null);
                                  setMessage(`${p.designation} supprimé définitivement.`);
                                  loadPage();
                                }}
                              >
                                Confirmer
                              </button>
                              <button
                                className="btn btn-muted"
                                style={{ padding: '4px 7px', fontSize: 11 }}
                                onClick={() => setConfirmKey(null)}
                              >
                                Non
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-red"
                              style={{ padding: '4px 7px', fontSize: 11 }}
                              title="Supprimer définitivement"
                              onClick={() => setConfirmKey(`prod-def-${p.id}`)}
                            >
                              ⚠️
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── GRILLE DES PRIX ── */}
      {pageKey === 'grille_prix' && data?.prods && (
        <>
          <div className="page-header">
            <h2 className="page-title">
              💲 Grille des Prix, Paliers &amp; Prix Spéciaux
            </h2>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 10px' }}>
              ★ Attribuer un Prix Spécial Client
            </h4>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/bureau/prix-speciaux', {
                  method: 'POST',
                  token,
                  body: JSON.stringify(psForm),
                });
                setMessage('Prix spécial enregistré.');
                loadPage();
              }}
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
            >
              <select
                className="select"
                value={psForm.client_id}
                onChange={(e) =>
                  setPsForm({ ...psForm, client_id: Number(e.target.value) })
                }
                required
              >
                <option value={0}>Client...</option>
                {data.cls.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.nom} ({c.code})
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={psForm.produit_id}
                onChange={(e) =>
                  setPsForm({ ...psForm, produit_id: Number(e.target.value) })
                }
                required
              >
                <option value={0}>Produit...</option>
                {data.prods.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.designation}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="input"
                placeholder="Prix spécial (DA)"
                value={psForm.prix_special}
                onChange={(e) =>
                  setPsForm({ ...psForm, prix_special: e.target.value })
                }
                required
              />
              <button className="btn btn-green" type="submit">
                + Enregistrer
              </button>
            </form>
          </div>

          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Produit</th>
                  <th>Prix Standard</th>
                  <th>Prix Spécial</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.ps.map((ps: any) => (
                  <tr key={ps.id}>
                    <td>{ps.client_nom}</td>
                    <td>{ps.produit_designation}</td>
                    <td>{fmtDA(ps.prix_standard)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--green)' }}>
                      {fmtDA(ps.prix_special)}
                    </td>
                    <td>
                      <button
                        className="btn btn-red"
                        onClick={async () => {
                          await apiFetch(`/api/bureau/prix-speciaux/${ps.id}`, {
                            method: 'DELETE',
                            token,
                          });
                          loadPage();
                        }}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '0 0 10px' }}>📊 Paliers de Quantité</h4>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/bureau/prix-paliers', {
                  method: 'POST',
                  token,
                  body: JSON.stringify(palForm),
                });
                setMessage('Palier ajouté.');
                loadPage();
              }}
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <select
                className="select"
                value={palForm.produit_id}
                onChange={(e) =>
                  setPalForm({ ...palForm, produit_id: Number(e.target.value) })
                }
                required
              >
                <option value={0}>Produit...</option>
                {data.prods.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.designation}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={palForm.niveau}
                onChange={(e) =>
                  setPalForm({ ...palForm, niveau: e.target.value })
                }
              >
                <option value="super_gros">Super Gros</option>
                <option value="gros">Gros</option>
                <option value="detail">Détail</option>
                <option value="special">Spécial</option>
              </select>
              <input
                type="number"
                className="input"
                placeholder="Qté min (pièces)"
                value={palForm.qte_min}
                onChange={(e) =>
                  setPalForm({ ...palForm, qte_min: e.target.value })
                }
                required
              />
              <input
                type="number"
                className="input"
                placeholder="Prix palier (DA)"
                value={palForm.prix}
                onChange={(e) =>
                  setPalForm({ ...palForm, prix: e.target.value })
                }
                required
              />
              <button className="btn" type="submit">
                + Ajouter Palier
              </button>
            </form>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Niveau</th>
                    <th>À partir de</th>
                    <th>Prix</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pal.map((p: any) => (
                    <tr key={p.id}>
                      <td>{p.produit_designation}</td>
                      <td>{p.niveau.toUpperCase()}</td>
                      <td>{p.qte_min} pcs</td>
                      <td style={{ fontWeight: 700 }}>{fmtDA(p.prix)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── CLIENTS / FOURNISSEURS ── */}
      {(pageKey === 'clients' || pageKey === 'fournisseurs') &&
        Array.isArray(data) && (
          <>
            <div className="page-header">
              <h2 className="page-title">
                {pageKey === 'clients' ? '👥 Clients' : '🏭 Fournisseurs'}
              </h2>
              <button
                className="btn btn-green"
                onClick={() => {
                  setEditingTiersId(null);
                  setTiersForm({
                    code: '',
                    nom: '',
                    tel: '',
                    adresse: '',
                    email: '',
                    ville: '',
                    nif: '',
                    niveau_prix: 'detail',
                    portail_actif: true,
                    password: '',
                    plafond_credit: '0',
                    bloquer_si_depasse: false,
                  });
                  setShowTiersModal(true);
                }}
              >
                + Nouveau {pageKey === 'clients' ? 'Client' : 'Fournisseur'}
              </button>
            </div>
            {pageKey === 'clients' && (() => {
              const nbDepasse = data.filter(
                (c: any) => Number(c.plafond_credit || 0) > 0 && Number(c.solde || 0) > Number(c.plafond_credit || 0)
              ).length;
              return nbDepasse > 0 ? (
                <div className="alert-box alert-warn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span>
                    🚨 <strong>{nbDepasse} client(s)</strong> dépassent actuellement leur plafond de crédit autorisé.
                  </span>
                  <button
                    type="button"
                    className="btn btn-muted"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                    onClick={() => setClientsDepasseOnly(!clientsDepasseOnly)}
                  >
                    {clientsDepasseOnly ? 'Afficher tous les clients' : 'Filtrer dépassements'}
                  </button>
                </div>
              ) : null;
            })()}
            <div className="toolbar">
              <input
                className="input"
                style={{ width: 260 }}
                placeholder="Rechercher par nom, code, tél..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {pageKey === 'clients' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={clientsDepasseOnly}
                    onChange={(e) => setClientsDepasseOnly(e.target.checked)}
                  />
                  En dépassement de plafond uniquement
                </label>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom</th>
                    <th>Téléphone</th>
                    <th>Adresse</th>
                    {pageKey === 'clients' && <th>Niveau Tarif</th>}
                    {pageKey === 'clients' && <th>Portail</th>}
                    <th>Solde</th>
                    {pageKey === 'clients' && <th>Plafond / Crédit</th>}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data
                    .filter(
                      (t: any) =>
                        (!search ||
                          t.nom.toLowerCase().includes(search.toLowerCase()) ||
                          t.code.toLowerCase().includes(search.toLowerCase()) ||
                          (t.tel || '').includes(search)) &&
                        (pageKey !== 'clients' ||
                          !clientsDepasseOnly ||
                          (Number(t.plafond_credit || 0) > 0 &&
                            Number(t.solde || 0) > Number(t.plafond_credit || 0)))
                    )
                    .map((t: any) => {
                      const plafond = Number(t.plafond_credit || 0);
                      const solde = Number(t.solde || 0);
                      const pct = plafond > 0 ? Math.round((solde / plafond) * 100) : 0;
                      const isOver = plafond > 0 && solde > plafond;
                      const isWarn = plafond > 0 && !isOver && pct >= 80;
                      const barColor = isOver
                        ? 'var(--red)'
                        : isWarn
                        ? 'var(--orange)'
                        : 'var(--green)';
                      return (
                      <tr key={t.id}>
                        <td>{t.code}</td>
                        <td style={{ fontWeight: 600 }}>{t.nom}</td>
                        <td>{t.tel || '—'}</td>
                        <td>
                          {t.adresse || '—'}
                          {t.latitude != null && t.longitude != null && (
                            <a
                              href={`https://maps.google.com/?q=${t.latitude},${t.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent)' }}
                            >
                              📍 Maps
                            </a>
                          )}
                        </td>
                        {pageKey === 'clients' && (
                          <td>
                            <span className="badge badge-blue">
                              {(t.niveau_prix || 'detail').toUpperCase()}
                            </span>
                          </td>
                        )}
                        {pageKey === 'clients' && (
                          <td>
                            {t.portail_actif ? (
                              <span className="badge badge-green">Actif</span>
                            ) : (
                              <span className="badge badge-orange">Inactif</span>
                            )}
                          </td>
                        )}
                        <td
                          style={{
                            fontWeight: 700,
                            color: isOver
                              ? 'var(--red)'
                              : solde > 0
                              ? 'var(--orange)'
                              : 'var(--green)',
                          }}
                        >
                          {fmtDA(t.solde)}
                        </td>
                        {pageKey === 'clients' && (
                          <td style={{ minWidth: 165 }}>
                            {plafond > 0 ? (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                                  <span>{fmtDA(plafond)}</span>
                                  <span
                                    className={`badge ${
                                      isOver
                                        ? 'badge-red'
                                        : isWarn
                                        ? 'badge-orange'
                                        : 'badge-green'
                                    }`}
                                  >
                                    {pct}%{isOver ? ' Dépassement' : ''}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    height: 6,
                                    width: '100%',
                                    background: 'var(--border)',
                                    borderRadius: 4,
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      height: '100%',
                                      width: `${Math.min(100, Math.max(0, pct))}%`,
                                      background: barColor,
                                    }}
                                  />
                                </div>
                                {Boolean(t.bloquer_si_depasse) && (
                                  <div style={{ fontSize: 10, color: isOver ? 'var(--red)' : 'var(--muted)', marginTop: 2 }}>
                                    🔒 Blocage auto {isOver ? '(Actif)' : 'si dépassé'}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                Illimité
                              </span>
                            )}
                          </td>
                        )}
                        <td style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                          <button
                            className="btn"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={() => {
                              setEditingTiersId(t.id);
                              setTiersForm({
                                code: t.code || '',
                                nom: t.nom || '',
                                tel: t.tel || '',
                                adresse: t.adresse || '',
                                email: t.email || '',
                                ville: t.ville || '',
                                nif: t.nif || '',
                                niveau_prix: t.niveau_prix || 'detail',
                                portail_actif: Boolean(t.portail_actif),
                                password: '',
                                plafond_credit: String(t.plafond_credit || 0),
                                bloquer_si_depasse: Boolean(t.bloquer_si_depasse),
                              });
                              setShowTiersModal(true);
                            }}
                          >
                            ✏
                          </button>
                          <button
                            className="btn btn-orange"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            title="Dette / Solde Initial"
                            onClick={() => {
                              setDetteTiers({
                                kind: pageKey === 'clients' ? 'client' : 'fournisseur',
                                item: t,
                              });
                              setDetteForm({
                                mode: 'solde_initial',
                                montant: String(t.solde_initial || ''),
                                mode_reglement: 'Espèces',
                                motif: '',
                              });
                            }}
                          >
                            💵 Dette
                          </button>
                          {pageKey === 'clients' && (
                            <button
                              className="btn btn-muted"
                              style={{ padding: '4px 7px', fontSize: 11 }}
                              title="Prix Spéciaux Client"
                              onClick={() => {
                                setPsForm({ ...psForm, client_id: t.id });
                                onNavigate('grille_prix');
                              }}
                            >
                              ★ Prix
                            </button>
                          )}
                          <button
                            className="btn btn-muted"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={() => {
                              setSitType(pageKey === 'clients' ? 'client' : 'fournisseur');
                              setSitTiersId(t.id);
                              onNavigate('situations');
                            }}
                          >
                            📊 Situation
                          </button>
                          {t.code !== 'CLT-COMPTOIR' &&
                            (confirmKey === `tiers-${t.id}` ? (
                              <>
                                <button
                                  className="btn btn-red"
                                  style={{ padding: '4px 7px', fontSize: 11 }}
                                  onClick={async () => {
                                    const ep =
                                      pageKey === 'clients' ? 'clients' : 'fournisseurs';
                                    await apiFetch(`/api/bureau/${ep}/${t.id}`, {
                                      method: 'DELETE',
                                      token,
                                    });
                                    setConfirmKey(null);
                                    setMessage(`${t.nom} supprimé.`);
                                    loadPage();
                                  }}
                                >
                                  Confirmer
                                </button>
                                <button
                                  className="btn btn-muted"
                                  style={{ padding: '4px 7px', fontSize: 11 }}
                                  onClick={() => setConfirmKey(null)}
                                >
                                  Non
                                </button>
                              </>
                            ) : (
                              <button
                                className="btn btn-red"
                                style={{ padding: '4px 7px', fontSize: 11 }}
                                onClick={() => setConfirmKey(`tiers-${t.id}`)}
                              >
                                🗑
                              </button>
                            ))}
                        </td>
                      </tr>
                    );
                    })}
                </tbody>
              </table>
            </div>
          </>
        )}

      {/* ── BONS DE VENTE ── */}
      {pageKey === 'bons_vente' && Array.isArray(data) && (
        <>
          <div className="page-header">
            <h2 className="page-title">🏷️ Bons de Vente &amp; Comptoir</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-muted"
                onClick={() => {
                  const header = ['Numéro', 'Date', 'Client', 'Total', 'Versé', 'Reste', 'Statut'].join(';');
                  const lines = data.map((b: any) =>
                    [b.numero, b.date_bon, `"${b.client_nom}"`, b.total, b.montant_verse, b.reste_payer, b.statut].join(';')
                  );
                  downloadTextFile([header, ...lines].join('\n'), `bons_vente_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
                }}
              >
                📊 Export CSV
              </button>
              <button className="btn btn-muted" onClick={() => window.print()}>
                🖨 Imprimer
              </button>
              <button className="btn btn-green" onClick={() => openNewVente(false)}>
                + Nouveau Bon
              </button>
              <button className="btn btn-orange" onClick={() => openNewVente(true)}>
                🛒 Vente Comptoir
              </button>
              <button className="btn" onClick={() => onNavigate('pos_caisse')}>
                🖥️ Mode Caisse POS
              </button>
            </div>
          </div>

          <div className="toolbar">
            <input
              className="input"
              style={{ width: 220 }}
              placeholder="Rechercher numéro ou client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label style={{ color: 'var(--muted)', fontSize: 12 }}>Client :</label>
            <select
              className="select"
              value={bvClientFilter}
              onChange={(e) => setBvClientFilter(e.target.value)}
            >
              <option value="Tous">Tous</option>
              {Array.from(new Set(data.map((b: any) => b.client_nom))).map((cn: any) => (
                <option key={cn} value={cn}>
                  {cn}
                </option>
              ))}
            </select>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Cartons</th>
                  <th>Total</th>
                  <th>Versé</th>
                  <th>Reste</th>
                  <th>Statut</th>
                  <th>Facturé</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data
                  .filter(
                    (b: any) =>
                      bvClientFilter === 'Tous' || b.client_nom === bvClientFilter
                  )
                  .filter(
                    (b: any) =>
                      !search ||
                      b.numero.toLowerCase().includes(search.toLowerCase()) ||
                      b.client_nom.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((b: any) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.numero}</td>
                      <td>{b.date_bon}</td>
                      <td>{b.client_nom}</td>
                      <td>{b.total_cartons}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDA(b.total)}</td>
                      <td>{fmtDA(b.montant_verse)}</td>
                      <td>{fmtDA(b.reste_payer)}</td>
                      <td>
                        <span
                          className={`badge ${
                            b.statut === 'Annulé' ? 'badge-red' : 'badge-green'
                          }`}
                        >
                          {b.statut}
                        </span>
                      </td>
                      <td>{b.facture_numero ? `✅ ${b.facture_numero}` : '❌ Non'}</td>
                      <td style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                        <button
                          className="btn btn-muted"
                          style={{ padding: '4px 7px', fontSize: 11 }}
                          onClick={() => setDetailBon(b)}
                          title="Détail & Imprimer"
                        >
                          👁
                        </button>
                        <button
                          className="btn btn-muted"
                          style={{ padding: '4px 7px', fontSize: 11 }}
                          onClick={() => setTicketBon(b)}
                          title="Ticket de Caisse 80mm"
                        >
                          🧾 Ticket
                        </button>
                        {b.statut !== 'Annulé' && (
                          <button
                            className="btn"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={() => openEditVente(b)}
                            title="Modifier"
                          >
                            ✏
                          </button>
                        )}
                        {!b.facture_numero && b.statut !== 'Annulé' && (
                          <button
                            className="btn"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={async () => {
                              await apiFetch('/api/bureau/factures', {
                                method: 'POST',
                                token,
                                body: JSON.stringify({ bon_vente_id: b.id }),
                              });
                              setMessage(`Facture émise pour ${b.numero}.`);
                              loadPage();
                            }}
                          >
                            Facturer
                          </button>
                        )}
                        {b.statut !== 'Annulé' && (
                          <button
                            className="btn btn-orange"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={async () => {
                              await apiFetch(`/api/bureau/bons-vente/${b.id}/annuler`, {
                                method: 'POST',
                                token,
                              });
                              setMessage(`Bon ${b.numero} annulé.`);
                              loadPage();
                            }}
                          >
                            Annuler
                          </button>
                        )}
                        {confirmKey === `bv-${b.id}` ? (
                          <>
                            <button
                              className="btn btn-red"
                              style={{ padding: '4px 7px', fontSize: 11 }}
                              onClick={async () => {
                                await apiFetch(`/api/bureau/bons-vente/${b.id}`, {
                                  method: 'DELETE',
                                  token,
                                });
                                setConfirmKey(null);
                                setMessage(`Bon ${b.numero} supprimé.`);
                                loadPage();
                              }}
                            >
                              Confirmer
                            </button>
                            <button
                              className="btn btn-muted"
                              style={{ padding: '4px 7px', fontSize: 11 }}
                              onClick={() => setConfirmKey(null)}
                            >
                              Non
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-red"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={() => setConfirmKey(`bv-${b.id}`)}
                            title="Supprimer"
                          >
                            🗑
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── BONS D'ACHAT ── */}
      {pageKey === 'bons_achat' && Array.isArray(data) && (
        <>
          <div className="page-header">
            <h2 className="page-title">🛒 Bons d'Achat</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-muted"
                onClick={() => {
                  const header = ['Numéro', 'Date', 'Fournisseur', 'Total', 'Statut'].join(';');
                  const lines = data.map((ba: any) =>
                    [ba.numero, ba.date_bon, `"${ba.fournisseur_nom}"`, ba.total, ba.statut].join(';')
                  );
                  downloadTextFile([header, ...lines].join('\n'), `bons_achat_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
                }}
              >
                📊 Export CSV
              </button>
              <button className="btn btn-muted" onClick={() => window.print()}>
                🖨 Imprimer
              </button>
              <button className="btn btn-green" onClick={openNewAchat}>
                + Nouveau Bon d'Achat
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Date</th>
                  <th>Fournisseur</th>
                  <th>Total</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((ba: any) => (
                  <tr key={ba.id}>
                    <td style={{ fontWeight: 600 }}>{ba.numero}</td>
                    <td>{ba.date_bon}</td>
                    <td>{ba.fournisseur_nom}</td>
                    <td style={{ fontWeight: 700 }}>{fmtDA(ba.total)}</td>
                    <td>
                      <span
                        className={`badge ${
                          ba.statut === 'Annulé' ? 'badge-red' : 'badge-green'
                        }`}
                      >
                        {ba.statut}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                      <button
                        className="btn btn-muted"
                        style={{ padding: '4px 7px', fontSize: 11 }}
                        onClick={() => setDetailBon(ba)}
                      >
                        👁 Détail
                      </button>
                      {ba.statut !== 'Annulé' && (
                        <>
                          <button
                            className="btn"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={() => openEditAchat(ba)}
                          >
                            ✏
                          </button>
                          <button
                            className="btn btn-orange"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={async () => {
                              await apiFetch(`/api/bureau/bons-achat/${ba.id}/annuler`, {
                                method: 'POST',
                                token,
                              });
                              setMessage(`Bon d'achat ${ba.numero} annulé.`);
                              loadPage();
                            }}
                          >
                            Annuler
                          </button>
                        </>
                      )}
                      {confirmKey === `ba-${ba.id}` ? (
                        <>
                          <button
                            className="btn btn-red"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={async () => {
                              await apiFetch(`/api/bureau/bons-achat/${ba.id}`, {
                                method: 'DELETE',
                                token,
                              });
                              setConfirmKey(null);
                              setMessage(`Bon d'achat ${ba.numero} supprimé.`);
                              loadPage();
                            }}
                          >
                            Confirmer
                          </button>
                          <button
                            className="btn btn-muted"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={() => setConfirmKey(null)}
                          >
                            Non
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-red"
                          style={{ padding: '4px 7px', fontSize: 11 }}
                          onClick={() => setConfirmKey(`ba-${ba.id}`)}
                        >
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── FACTURES ── */}
      {pageKey === 'factures' && Array.isArray(data) && (
        <>
          <div className="page-header">
            <h2 className="page-title">🧾 Factures &amp; Échéancier</h2>
            {facturesTab === 'liste' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-muted"
                  onClick={() => {
                    const header = ['Numéro', 'Date', 'Client', 'Bon', 'HT', 'TVA%', 'TTC', 'Statut', 'Échéance'].join(';');
                    const lines = data.map((f: any) =>
                      [f.numero, f.date_facture, `"${f.client_nom}"`, f.bon_numero, f.total_ht, f.tva, f.total_ttc, f.statut, f.date_echeance || ''].join(';')
                    );
                    downloadTextFile([header, ...lines].join('\n'), `factures_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
                  }}
                >
                  📊 Export CSV
                </button>
                <button className="btn btn-muted" onClick={() => window.print()}>
                  🖨 Imprimer
                </button>
                <button
                  className="btn btn-green"
                  onClick={async () => {
                    const bons = await apiFetch<any[]>('/api/bureau/bons-vente', { token });
                    const dispo = bons.filter((b) => !b.facture_numero && b.statut !== 'Annulé');
                    setUnbilledBons(dispo);
                    setNewFacForm({
                      bon_vente_id: dispo[0]?.id || 0,
                      date_facture: new Date().toISOString().slice(0, 10),
                      tva: String(activeProfil?.tva_defaut ?? 19),
                      date_echeance: '',
                      observations: '',
                    });
                    setShowNewFacModal(true);
                  }}
                >
                  + Nouvelle Facture
                </button>
              </div>
            )}
          </div>

          <div className="tabs" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={`tab-btn ${facturesTab === 'liste' ? 'active' : ''}`}
              onClick={() => setFacturesTab('liste')}
            >
              🧾 Factures ({data.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${facturesTab === 'echeancier' ? 'active' : ''}`}
              onClick={() => setFacturesTab('echeancier')}
            >
              📅 Échéancier &amp; Relances
            </button>
          </div>

          {facturesTab === 'echeancier' ? (
            <EcheancierRelancesPanel token={token} userRole={userRole} />
          ) : (
            <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Bon de Vente</th>
                  <th>HT</th>
                  <th>TVA</th>
                  <th>Total TTC</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((f: any) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.numero}</td>
                    <td>{f.date_facture}</td>
                    <td>{f.client_nom}</td>
                    <td>{f.bon_numero}</td>
                    <td>{fmtDA(f.total_ht)}</td>
                    <td>{f.tva}%</td>
                    <td style={{ fontWeight: 700 }}>{fmtDA(f.total_ttc)}</td>
                    <td>
                      <span className="badge badge-blue">{f.statut}</span>
                    </td>
                    <td style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                      <button
                        className="btn btn-muted"
                        style={{ padding: '4px 7px', fontSize: 11 }}
                        onClick={() => setDetailFacture(f)}
                      >
                        👁 Détail
                      </button>
                      <button
                        className="btn"
                        style={{ padding: '4px 7px', fontSize: 11 }}
                        onClick={() => {
                          setEditFacture(f);
                          setEditFacForm({
                            date_facture: f.date_facture || '',
                            date_echeance: f.date_echeance || '',
                            tva: String(f.tva ?? 19),
                            statut: f.statut || 'Émise',
                            observations: f.observations || '',
                          });
                        }}
                      >
                        ✏
                      </button>
                      {confirmKey === `fac-${f.id}` ? (
                        <>
                          <button
                            className="btn btn-red"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={async () => {
                              await apiFetch(`/api/bureau/factures/${f.id}`, {
                                method: 'DELETE',
                                token,
                              });
                              setConfirmKey(null);
                              setMessage(`Facture ${f.numero} supprimée.`);
                              loadPage();
                            }}
                          >
                            Confirmer
                          </button>
                          <button
                            className="btn btn-muted"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={() => setConfirmKey(null)}
                          >
                            Non
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-red"
                          style={{ padding: '4px 7px', fontSize: 11 }}
                          onClick={() => setConfirmKey(`fac-${f.id}`)}
                        >
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {/* ── COMMANDES PORTAIL ── */}
      {pageKey === 'cmd_portail' && Array.isArray(data) && (
        <>
          <div className="page-header">
            <h2 className="page-title">📩 Commandes Portail Client</h2>
            {userRole === 'admin' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={cmdForcerPlafond}
                  onChange={(e) => setCmdForcerPlafond(e.target.checked)}
                />
                🔓 Forcer validation même si plafond crédit dépassé (Admin)
              </label>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Montant Total</th>
                  <th>Statut</th>
                  <th>Observations</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.numero}</td>
                    <td>{c.date_commande}</td>
                    <td>
                      {c.client_nom} ({c.client_code})
                    </td>
                    <td style={{ fontWeight: 700 }}>{fmtDA(c.montant_total)}</td>
                    <td>
                      <span
                        className={`badge ${
                          c.statut.startsWith('Validée')
                            ? 'badge-green'
                            : c.statut === 'Refusée'
                              ? 'badge-red'
                              : 'badge-orange'
                        }`}
                      >
                        {c.statut}
                      </span>
                    </td>
                    <td>{c.observations || '—'}</td>
                    <td style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-muted"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => setDetailCmd(c)}
                      >
                        👁 Détail
                      </button>
                      {c.statut === 'En attente' && (
                        <>
                          <button
                            className="btn btn-green"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={async () => {
                              setError(null);
                              try {
                                const res = await apiFetch<any>(
                                  `/api/bureau/commandes-portail/${c.id}/valider`,
                                  {
                                    method: 'POST',
                                    token,
                                    body: JSON.stringify({
                                      forcer_plafond: cmdForcerPlafond,
                                    }),
                                  }
                                );
                                setMessage(
                                  `Commande ${c.numero} validée et convertie en Bon de Vente.${
                                    res?.credit_warning
                                      ? ` ⚠️ ${res.credit_warning}`
                                      : ''
                                  }`
                                );
                                loadPage();
                              } catch (err) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : 'Erreur validation commande'
                                );
                              }
                            }}
                          >
                            ✔ Valider → BL
                          </button>
                          <button
                            className="btn btn-orange"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            title="Limiter automatiquement aux quantités disponibles en stock"
                            onClick={async () => {
                              setError(null);
                              try {
                                const res = await apiFetch<any>(
                                  `/api/bureau/commandes-portail/${c.id}/valider-ajuste`,
                                  {
                                    method: 'POST',
                                    token,
                                    body: JSON.stringify({
                                      forcer_plafond: cmdForcerPlafond,
                                    }),
                                  }
                                );
                                setMessage(
                                  `Commande ${c.numero} validée (ajustée stock réel) → ${res.bon_numero}${
                                    res?.credit_warning
                                      ? ` ⚠️ ${res.credit_warning}`
                                      : ''
                                  }`
                                );
                                loadPage();
                              } catch (err) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : 'Erreur validation ajustée'
                                );
                              }
                            }}
                          >
                            ⚡ Valider Ajusté
                          </button>
                          <button
                            className="btn btn-red"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={async () => {
                              await apiFetch(
                                `/api/bureau/commandes-portail/${c.id}/refuser`,
                                { method: 'POST', token }
                              );
                              loadPage();
                            }}
                          >
                            ✕ Refuser
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── PROSPECTS VENDEURS ── */}
      {pageKey === 'prospects_vendeurs' && Array.isArray(data) && (
        <>
          <div className="page-header">
            <h2 className="page-title">🎯 Prospects Vendeurs Terrain</h2>
          </div>
          <div className="toolbar">
            <input
              className="input"
              style={{ width: 240 }}
              placeholder="Rechercher nom, code, tél, wilaya..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="select"
              value={prospectStatutFilter}
              onChange={(e) => setProspectStatutFilter(e.target.value)}
            >
              <option value="Tous">Tous statuts</option>
              <option value="Nouveau">Nouveau</option>
              <option value="Visité">Visité</option>
              <option value="À relancer">À relancer</option>
              <option value="Converti">Converti</option>
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nom</th>
                  <th>Téléphone</th>
                  <th>Wilaya / GPS</th>
                  <th>Vendeur</th>
                  <th>Solde</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data
                  .filter(
                    (p: any) =>
                      prospectStatutFilter === 'Tous' || p.statut === prospectStatutFilter
                  )
                  .filter(
                    (p: any) =>
                      !search ||
                      p.nom.toLowerCase().includes(search.toLowerCase()) ||
                      p.code.toLowerCase().includes(search.toLowerCase()) ||
                      (p.wilaya || '').toLowerCase().includes(search.toLowerCase())
                  )
                  .map((p: any) => (
                    <tr key={p.id}>
                      <td>{p.code}</td>
                      <td style={{ fontWeight: 600 }}>{p.nom}</td>
                      <td>{p.tel || '—'}</td>
                      <td>
                        {p.wilaya || '—'}
                        {p.latitude != null && p.longitude != null && (
                          <a
                            href={`https://maps.google.com/?q=${p.latitude},${p.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent)' }}
                          >
                            📍 Maps
                          </a>
                        )}
                      </td>
                      <td>{p.vendeur_nom || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDA(p.solde)}</td>
                      <td>
                        <span
                          className={`badge ${
                            p.statut === 'Converti' ? 'badge-green' : 'badge-blue'
                          }`}
                        >
                          {p.statut}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 5 }}>
                        {!p.client_id && (
                          <button
                            className="btn btn-green"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={async () => {
                              const res = await apiFetch<any>(
                                `/api/bureau/prospects/${p.id}/convertir`,
                                { method: 'POST', token }
                              );
                              setMessage(
                                `Prospect "${p.nom}" converti en Client officiel (${res.client?.code}).`
                              );
                              loadPage();
                            }}
                          >
                            ➕ Convertir Client
                          </button>
                        )}
                        {confirmKey === `prosp-${p.id}` ? (
                          <>
                            <button
                              className="btn btn-red"
                              style={{ padding: '4px 7px', fontSize: 11 }}
                              onClick={async () => {
                                await apiFetch(`/api/bureau/prospects/${p.id}`, {
                                  method: 'DELETE',
                                  token,
                                });
                                setConfirmKey(null);
                                setMessage(`Prospect "${p.nom}" supprimé.`);
                                loadPage();
                              }}
                            >
                              Confirmer
                            </button>
                            <button
                              className="btn btn-muted"
                              style={{ padding: '4px 7px', fontSize: 11 }}
                              onClick={() => setConfirmKey(null)}
                            >
                              Non
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-red"
                            style={{ padding: '4px 7px', fontSize: 11 }}
                            onClick={() => setConfirmKey(`prosp-${p.id}`)}
                          >
                            🗑
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── SUIVI PORTAIL (COMMANDES PROSPECTS + TOURNÉE GPS) ── */}
      {pageKey === 'portail_suivi' && data?.pointages && (
        <>
          <div className="page-header">
            <h2 className="page-title">🌐 Suivi Portail &amp; Tournées Terrain</h2>
          </div>

          <div className="tabs">
            <button
              className={`tab-btn ${suiviTab === 'commandes' ? 'active' : ''}`}
              onClick={() => setSuiviTab('commandes')}
            >
              🛒 Commandes Prospects ({(data.commandes || []).length})
            </button>
            <button
              className={`tab-btn ${suiviTab === 'tournee' ? 'active' : ''}`}
              onClick={() => setSuiviTab('tournee')}
            >
              📍 Tournée Terrain GPS ({(data.pointages || []).length})
            </button>
          </div>

          {suiviTab === 'commandes' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Date</th>
                    <th>Prospect</th>
                    <th>Vendeur</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.commandes || []).map((c: any) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.numero}</td>
                      <td>{c.date_commande}</td>
                      <td>{c.prospect_nom}</td>
                      <td>{c.vendeur_nom || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDA(c.montant_total)}</td>
                      <td>
                        <span
                          className={`badge ${
                            c.statut === 'Validée'
                              ? 'badge-green'
                              : c.statut === 'Rejetée'
                                ? 'badge-red'
                                : 'badge-orange'
                          }`}
                        >
                          {c.statut}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 5 }}>
                        <button
                          className="btn btn-muted"
                          style={{ padding: '4px 7px', fontSize: 11 }}
                          onClick={() =>
                            setDetailCmd({ ...c, client_nom: c.prospect_nom })
                          }
                        >
                          👁 Détail
                        </button>
                        {c.statut === 'En attente' && (
                          <>
                            <button
                              className="btn btn-green"
                              style={{ padding: '4px 7px', fontSize: 11 }}
                              onClick={async () => {
                                await apiFetch(
                                  `/api/bureau/commandes-prospects/${c.id}/valider`,
                                  { method: 'POST', token }
                                );
                                setMessage(`Commande prospect ${c.numero} validée.`);
                                loadPage();
                              }}
                            >
                              ✅ Valider
                            </button>
                            <button
                              className="btn btn-red"
                              style={{ padding: '4px 7px', fontSize: 11 }}
                              onClick={async () => {
                                await apiFetch(
                                  `/api/bureau/commandes-prospects/${c.id}/rejeter`,
                                  { method: 'POST', token }
                                );
                                setMessage(`Commande prospect ${c.numero} rejetée.`);
                                loadPage();
                              }}
                            >
                              ❌ Rejeter
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(data.commandes || []).length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        Aucune commande prospect.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {suiviTab === 'tournee' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vendeur</th>
                    <th>Client / Prospect</th>
                    <th>Coordonnées GPS</th>
                    <th>Observations</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.pointages || []).map((pt: any) => (
                    <tr key={pt.id}>
                      <td>{pt.date_pointage}</td>
                      <td>{pt.vendeur_nom}</td>
                      <td>{pt.nom_client}</td>
                      <td>
                        {pt.latitude != null ? (
                          <a
                            href={`https://maps.google.com/?q=${pt.latitude},${pt.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--accent)' }}
                          >
                            📍 {pt.latitude.toFixed(4)}, {pt.longitude.toFixed(4)}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{pt.observations || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── PROFILS ENTREPRISE ── */}
      {pageKey === 'profils' && Array.isArray(data) && (() => {
        const profilActifCourant = data.find((p: any) => p.est_defaut === 1) || data[0];
        const profilsFiltres = data.filter((pr: any) => {
          const matchType =
            profilTypeFilter === 'Tous' || pr.type_profil === profilTypeFilter;
          const matchStatut =
            profilStatutFilter === 'Tous' ||
            (profilStatutFilter === 'Actifs' ? pr.actif !== 0 : pr.actif === 0);
          const q = search.toLowerCase();
          const matchSearch =
            !q ||
            (pr.nom || '').toLowerCase().includes(q) ||
            (pr.code || '').toLowerCase().includes(q) ||
            (pr.ville || '').toLowerCase().includes(q) ||
            (pr.nif || '').toLowerCase().includes(q);
          return matchType && matchStatut && matchSearch;
        });
        const typeLibelle = (val: string) =>
          TYPES_PROFIL.find((t) => t.value === val)?.label || val;

        return (
          <>
            <div className="page-header">
              <div>
                <h2 className="page-title">🏢 Profils Entreprise</h2>
                <p className="page-subtitle">
                  Paramètres société, coordonnées fiscales (NIF / NIS / NRC / AI), banque, logo et profil actif des documents.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-green" onClick={openNewProfil}>
                  + Nouveau Profil
                </button>
                <button className="btn btn-muted" onClick={() => window.print()}>
                  🖨 Imprimer Fiche
                </button>
              </div>
            </div>

            {profilActifCourant && (
              <div
                className="card"
                style={{
                  marginBottom: 16,
                  borderColor: 'var(--accent)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1, minWidth: 260 }}>
                  {profilActifCourant.logo_data && (
                    <img
                      src={profilActifCourant.logo_data}
                      alt="Logo"
                      style={{
                        width: 68,
                        height: 68,
                        objectFit: 'contain',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: '#fff',
                        padding: 4,
                      }}
                    />
                  )}
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span className="badge badge-green">★ Profil Actif</span>
                      <span className="badge badge-blue">
                        {typeLibelle(profilActifCourant.type_profil)}
                      </span>
                      {profilActifCourant.forme_juridique && (
                        <span className="badge badge-orange">
                          {profilActifCourant.forme_juridique}
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '4px 0' }}>
                      {profilActifCourant.nom}{' '}
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                        ({profilActifCourant.code})
                      </span>
                    </h3>
                    {profilActifCourant.activite && (
                      <div style={{ fontSize: 12, marginBottom: 4 }}>
                        {profilActifCourant.activite}
                        {profilActifCourant.capital_social
                          ? ` • Capital : ${profilActifCourant.capital_social}`
                          : ''}
                      </div>
                    )}
                    <div style={{ color: 'var(--muted)', lineHeight: 1.65, fontSize: 12 }}>
                      <div>
                        📍 {profilActifCourant.adresse || '—'}
                        {profilActifCourant.ville ? `, ${profilActifCourant.ville}` : ''}
                        {profilActifCourant.code_postal ? ` (${profilActifCourant.code_postal})` : ''}
                      </div>
                      <div>
                        📞 {profilActifCourant.telephone || '—'}
                        {profilActifCourant.telephone2 ? ` / ${profilActifCourant.telephone2}` : ''}
                        {' | '}✉ {profilActifCourant.email || '—'}
                        {profilActifCourant.site_web ? ` | 🌐 ${profilActifCourant.site_web}` : ''}
                      </div>
                      <div>
                        NIF : {profilActifCourant.nif || '—'} | NIS :{' '}
                        {profilActifCourant.nis || '—'} | NRC :{' '}
                        {profilActifCourant.nrc || '—'} | AI :{' '}
                        {profilActifCourant.art_imp || '—'}
                      </div>
                      <div>
                        🏦 {profilActifCourant.banque || '—'} | RIB :{' '}
                        {profilActifCourant.rib || '—'} | Devise :{' '}
                        {profilActifCourant.devise || 'DA'} | TVA défaut :{' '}
                        {profilActifCourant.tva_defaut ?? 19}% | Préfixes :{' '}
                        {profilActifCourant.prefixe_bv || 'BV'} /{' '}
                        {profilActifCourant.prefixe_facture || 'FAC'}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  className="btn"
                  onClick={() => openEditProfil(profilActifCourant)}
                >
                  ✏ Modifier le profil actif
                </button>
              </div>
            )}

            <div className="toolbar">
              <input
                className="input"
                style={{ minWidth: 240 }}
                placeholder="Rechercher nom, code, ville, NIF..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="select"
                value={profilTypeFilter}
                onChange={(e) => setProfilTypeFilter(e.target.value)}
                title="Filtrer par type de profil"
              >
                <option value="Tous">Type de profil : Tous</option>
                {TYPES_PROFIL.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={profilStatutFilter}
                onChange={(e) => setProfilStatutFilter(e.target.value)}
                title="Filtrer par statut"
              >
                <option value="Tous">Statut : Tous</option>
                <option value="Actifs">Actifs uniquement</option>
                <option value="Inactifs">Désactivés uniquement</option>
              </select>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {profilsFiltres.map((pr: any) => (
                <div
                  key={pr.id}
                  className="card"
                  style={{ opacity: pr.actif === 0 ? 0.65 : 1 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                          marginBottom: 6,
                        }}
                      >
                        <strong style={{ fontSize: 15 }}>
                          {pr.nom} ({pr.code})
                        </strong>
                        {pr.est_defaut === 1 && (
                          <span className="badge badge-green">★ Par défaut</span>
                        )}
                        <span className="badge badge-blue">
                          {typeLibelle(pr.type_profil)}
                        </span>
                        {pr.forme_juridique && (
                          <span className="badge badge-orange">
                            {pr.forme_juridique}
                          </span>
                        )}
                        {pr.actif === 0 && (
                          <span className="badge badge-red">Désactivé</span>
                        )}
                      </div>
                      <div style={{ color: 'var(--muted)', lineHeight: 1.65, fontSize: 12 }}>
                        <div>
                          Adresse : {pr.adresse || '—'}
                          {pr.ville ? `, ${pr.ville}` : ''} | Tél :{' '}
                          {pr.telephone || '—'} | Email : {pr.email || '—'}
                        </div>
                        <div>
                          NIF : {pr.nif || '—'} | NIS : {pr.nis || '—'} | NRC :{' '}
                          {pr.nrc || '—'} | Art. Imp. : {pr.art_imp || '—'}
                        </div>
                        {(pr.banque || pr.rib) && (
                          <div>
                            Banque : {pr.banque || '—'} | RIB : {pr.rib || '—'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {pr.est_defaut !== 1 && (
                        <button
                          className="btn btn-green"
                          style={{ padding: '5px 10px' }}
                          onClick={() => activerProfilDefaut(pr)}
                        >
                          ★ Activer par défaut
                        </button>
                      )}
                      <button
                        className="btn btn-muted"
                        style={{ padding: '5px 10px' }}
                        onClick={() => openEditProfil(pr)}
                      >
                        ✏ Modifier
                      </button>
                      <button
                        className="btn btn-muted"
                        style={{ padding: '5px 10px' }}
                        onClick={() => dupliquerProfil(pr)}
                      >
                        📋 Dupliquer
                      </button>
                      {pr.est_defaut !== 1 && (
                        <button
                          className="btn btn-orange"
                          style={{ padding: '5px 10px' }}
                          onClick={() => toggleActifProfil(pr)}
                        >
                          {pr.actif === 0 ? '▶ Activer' : '⏸ Désactiver'}
                        </button>
                      )}
                      {pr.est_defaut !== 1 &&
                        (confirmDeleteProfilId === pr.id ? (
                          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                            <button
                              className="btn btn-red"
                              style={{ padding: '5px 9px' }}
                              onClick={() => supprimerProfil(pr.id)}
                            >
                              Confirmer
                            </button>
                            <button
                              className="btn btn-muted"
                              style={{ padding: '5px 9px' }}
                              onClick={() => setConfirmDeleteProfilId(null)}
                            >
                              Non
                            </button>
                          </span>
                        ) : (
                          <button
                            className="btn btn-red"
                            style={{ padding: '5px 10px' }}
                            onClick={() => setConfirmDeleteProfilId(pr.id)}
                          >
                            🗑 Supprimer
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
              {profilsFiltres.length === 0 && (
                <div className="card" style={{ color: 'var(--muted)' }}>
                  Aucun profil entreprise ne correspond aux filtres.
                </div>
              )}
            </div>

            <ProfilDocsAndSystemSection
              token={token}
              profils={data}
              themeKey={themeKey}
              onChangeTheme={onChangeTheme}
              onMessage={(m) => setMessage(m)}
              onError={(e) => setError(e)}
              onReload={() => loadPage()}
            />
          </>
        );
      })()}

      {/* ── MODAL PRODUIT (CRÉATION / ÉDITION AVEC COMBOBOX UNITÉ, FOURNISSEUR, TVA, MARGE) ── */}
      {showProdModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3 style={{ marginTop: 0 }}>
              {editingProdId ? '✏ Modifier Produit' : '+ Nouveau Produit'}
            </h3>
            <form onSubmit={submitProduit} className="form-grid">
              <div className="form-field">
                <label>Code (auto si vide)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={prodForm.code}
                    disabled={editingProdId !== null}
                    onChange={(e) =>
                      setProdForm({ ...prodForm, code: e.target.value })
                    }
                  />
                  {editingProdId === null && (
                    <button
                      type="button"
                      className="btn btn-muted"
                      title="Régénérer code"
                      onClick={() =>
                        setProdForm({
                          ...prodForm,
                          code: `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
                        })
                      }
                    >
                      🔄
                    </button>
                  )}
                </div>
              </div>
              <div className="form-field">
                <label>Code Barre (EAN)</label>
                <input
                  className="input"
                  value={prodForm.barcode}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, barcode: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label>Désignation *</label>
                <input
                  className="input"
                  value={prodForm.designation}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, designation: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-field">
                <label>Marque</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    list="marques-datalist"
                    value={prodForm.marque}
                    onChange={(e) =>
                      setProdForm({ ...prodForm, marque: e.target.value })
                    }
                  />
                  <datalist id="marques-datalist">
                    {marquesList.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    className="btn btn-muted"
                    title="Enregistrer nouvelle marque"
                    onClick={async () => {
                      const nom = prodForm.marque.trim();
                      if (!nom) return;
                      await apiFetch('/api/bureau/produits/marques', {
                        method: 'POST',
                        token,
                        body: JSON.stringify({ nom }),
                      });
                      if (!marquesList.includes(nom)) {
                        setMarquesList([...marquesList, nom].sort());
                      }
                      setMessage(`Marque "${nom}" ajoutée aux référentiels.`);
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label>Type d'Unité *</label>
                <select
                  className="select"
                  value={uniteChoice}
                  onChange={(e) => setUniteChoice(e.target.value)}
                >
                  {unitesList.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  <option value="Autre...">Autre (personnalisée)...</option>
                </select>
                {uniteChoice === 'Autre...' && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <input
                      className="input"
                      style={{ flex: 1 }}
                      placeholder="Saisir l'unité..."
                      value={uniteCustom}
                      onChange={(e) => setUniteCustom(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-muted"
                      title="Enregistrer cette unité"
                      onClick={async () => {
                        const nom = uniteCustom.trim();
                        if (!nom) return;
                        await apiFetch('/api/bureau/produits/unites', {
                          method: 'POST',
                          token,
                          body: JSON.stringify({ nom }),
                        });
                        if (!unitesList.includes(nom)) {
                          setUnitesList([...unitesList, nom]);
                        }
                        setUniteChoice(nom);
                        setUniteCustom('');
                        setMessage(`Unité "${nom}" ajoutée.`);
                      }}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              <div className="form-field">
                <label>Facteur conversion (pcs / unité)</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={prodForm.facteur_conversion}
                  onChange={(e) =>
                    setProdForm({
                      ...prodForm,
                      facteur_conversion: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-field">
                <label>Fournisseur principal</label>
                <select
                  className="select"
                  value={prodForm.fournisseur}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, fournisseur: e.target.value })
                  }
                >
                  <option value="">— Aucun —</option>
                  {fournisseursList.map((f) => (
                    <option key={f.id} value={f.nom}>
                      {f.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>TVA (%)</label>
                <select
                  className="select"
                  value={prodForm.tva}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, tva: e.target.value })
                  }
                >
                  <option value="0">0 % (Exonéré)</option>
                  <option value="9">9 % (Réduit)</option>
                  <option value="19">19 % (Normal)</option>
                </select>
              </div>

              <div className="form-field">
                <label>Prix d'Achat (DA)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={prodForm.prix_achat}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, prix_achat: e.target.value })
                  }
                />
              </div>

              <div className="form-field">
                <label>Calcul rapide par Marge (%)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number"
                    className="input"
                    style={{ width: 80 }}
                    value={margePct}
                    onChange={(e) => setMargePct(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-muted"
                    onClick={appliquerMargeSurPrixAchat}
                  >
                    Appliquer %
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label>Prix Détail (DA)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={prodForm.prix_detail}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, prix_detail: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label>Prix Gros (DA)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={prodForm.prix_gros}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, prix_gros: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label>Prix Super Gros (DA)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={prodForm.prix_super_gros}
                  onChange={(e) =>
                    setProdForm({
                      ...prodForm,
                      prix_super_gros: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-field">
                <label>Prix Spécial (DA)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={prodForm.prix_special}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, prix_special: e.target.value })
                  }
                />
              </div>

              {!editingProdId && (
                <div className="form-field">
                  <label>Stock Initial (pcs)</label>
                  <input
                    type="number"
                    className="input"
                    value={prodForm.stock_actuel}
                    onChange={(e) =>
                      setProdForm({ ...prodForm, stock_actuel: e.target.value })
                    }
                  />
                </div>
              )}
              <div className="form-field">
                <label>Stock Minimum Alerte (pcs)</label>
                <input
                  type="number"
                  className="input"
                  value={prodForm.stock_min}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, stock_min: e.target.value })
                  }
                />
              </div>
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'space-between',
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => {
                    if (editingProdId) {
                      setPalForm({ ...palForm, produit_id: editingProdId });
                    }
                    setShowProdModal(false);
                    onNavigate('grille_prix');
                  }}
                >
                  📊 Gérer Paliers
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-muted"
                    onClick={() => setShowProdModal(false)}
                  >
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-green">
                    {editingProdId ? 'Mettre à jour' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL AJUSTEMENT STOCK ── */}
      {ajustProd && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 440 }}>
            <h3 style={{ marginTop: 0 }}>
              ⚙ Ajustement de Stock — {ajustProd.designation}
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch(
                  `/api/bureau/produits/${ajustProd.id}/ajuster-stock`,
                  {
                    method: 'POST',
                    token,
                    body: JSON.stringify({
                      nouveau_stock: Number(ajustStockVal),
                      motif: ajustMotif,
                    }),
                  }
                );
                setAjustProd(null);
                setMessage('Stock ajusté et tracé dans le journal.');
                loadPage();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div className="form-field">
                <label>Stock actuel : {ajustProd.stock_actuel} pcs</label>
                <input
                  type="number"
                  className="input"
                  value={ajustStockVal}
                  onChange={(e) => setAjustStockVal(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label>Motif de l'ajustement</label>
                <input
                  className="input"
                  value={ajustMotif}
                  onChange={(e) => setAjustMotif(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setAjustProd(null)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-orange">
                  Valider Ajustement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL TIERS (CRÉATION / ÉDITION) ── */}
      {showTiersModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3 style={{ marginTop: 0 }}>
              {editingTiersId ? '✏ Modifier ' : '+ Nouveau '}
              {pageKey === 'clients' ? 'Client' : 'Fournisseur'}
            </h3>
            <form onSubmit={submitTiers} className="form-grid">
              <div className="form-field">
                <label>Code (auto si vide)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={tiersForm.code}
                    disabled={editingTiersId !== null}
                    onChange={(e) =>
                      setTiersForm({ ...tiersForm, code: e.target.value })
                    }
                  />
                  {editingTiersId === null && (
                    <button
                      type="button"
                      className="btn btn-muted"
                      title="Régénérer code"
                      onClick={() =>
                        setTiersForm({
                          ...tiersForm,
                          code: `${pageKey === 'clients' ? 'CLT' : 'FRN'}-${Math.floor(1000 + Math.random() * 9000)}`,
                        })
                      }
                    >
                      🔄
                    </button>
                  )}
                </div>
              </div>
              <div className="form-field">
                <label>Nom *</label>
                <input
                  className="input"
                  value={tiersForm.nom}
                  onChange={(e) =>
                    setTiersForm({ ...tiersForm, nom: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-field">
                <label>Téléphone</label>
                <input
                  className="input"
                  value={tiersForm.tel}
                  onChange={(e) =>
                    setTiersForm({ ...tiersForm, tel: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label>Adresse</label>
                <input
                  className="input"
                  value={tiersForm.adresse}
                  onChange={(e) =>
                    setTiersForm({ ...tiersForm, adresse: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label>Email</label>
                <input
                  className="input"
                  value={tiersForm.email}
                  onChange={(e) =>
                    setTiersForm({ ...tiersForm, email: e.target.value })
                  }
                />
              </div>
              {pageKey === 'clients' ? (
                <>
                  <div className="form-field">
                    <label>Niveau de Prix</label>
                    <select
                      className="select"
                      value={tiersForm.niveau_prix}
                      onChange={(e) =>
                        setTiersForm({
                          ...tiersForm,
                          niveau_prix: e.target.value,
                        })
                      }
                    >
                      <option value="detail">Détail</option>
                      <option value="gros">Gros</option>
                      <option value="super_gros">Super Gros</option>
                      <option value="special">Spécial</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Mot de passe portail (laisser vide = inchangé)</label>
                    <input
                      type="password"
                      className="input"
                      value={tiersForm.password}
                      onChange={(e) =>
                        setTiersForm({ ...tiersForm, password: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Plafond Crédit (DA, 0 = illimité)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      className="input"
                      value={tiersForm.plafond_credit}
                      onChange={(e) =>
                        setTiersForm({
                          ...tiersForm,
                          plafond_credit: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-field" style={{ justifyContent: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={tiersForm.bloquer_si_depasse}
                        onChange={(e) =>
                          setTiersForm({
                            ...tiersForm,
                            bloquer_si_depasse: e.target.checked,
                          })
                        }
                      />
                      Bloquer ventes/commandes si plafond dépassé
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <input
                        type="checkbox"
                        checked={tiersForm.portail_actif}
                        onChange={(e) =>
                          setTiersForm({
                            ...tiersForm,
                            portail_actif: e.target.checked,
                          })
                        }
                      />
                      Accès Portail Client activé
                    </label>
                  </div>
                </>
              ) : (
                <div className="form-field">
                  <label>NIF</label>
                  <input
                    className="input"
                    value={tiersForm.nif}
                    onChange={(e) =>
                      setTiersForm({ ...tiersForm, nif: e.target.value })
                    }
                  />
                </div>
              )}
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-end',
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setShowTiersModal(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-green">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DETTE / SOLDE INITIAL TIERS ── */}
      {detteTiers && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 460 }}>
            <h3 style={{ marginTop: 0 }}>
              💵 Dette / Solde Initial — {detteTiers.item.nom}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 12 }}>
              Solde actuel : <strong style={{ color: 'var(--orange)' }}>{fmtDA(detteTiers.item.solde)}</strong>
              {Number(detteTiers.item.solde_initial || 0) > 0 &&
                ` (dont solde initial : ${fmtDA(detteTiers.item.solde_initial)})`}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ep = detteTiers.kind === 'client' ? 'clients' : 'fournisseurs';
                await apiFetch(`/api/bureau/${ep}/${detteTiers.item.id}/solde-initial`, {
                  method: 'POST',
                  token,
                  body: JSON.stringify({
                    ...detteForm,
                    montant: Number(detteForm.montant),
                  }),
                });
                setDetteTiers(null);
                setMessage('Solde / dette mis à jour.');
                loadPage();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div className="form-field">
                <label>Opération</label>
                <select
                  className="select"
                  value={detteForm.mode}
                  onChange={(e) =>
                    setDetteForm({ ...detteForm, mode: e.target.value as any })
                  }
                >
                  <option value="solde_initial">Définir Solde Initial (report dette)</option>
                  <option value="remboursement">Remboursement rapide</option>
                </select>
              </div>
              <div className="form-field">
                <label>Montant (DA)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input"
                  value={detteForm.montant}
                  onChange={(e) => setDetteForm({ ...detteForm, montant: e.target.value })}
                  required
                />
              </div>
              {detteForm.mode === 'remboursement' && (
                <div className="form-field">
                  <label>Mode de règlement</label>
                  <select
                    className="select"
                    value={detteForm.mode_reglement}
                    onChange={(e) =>
                      setDetteForm({ ...detteForm, mode_reglement: e.target.value })
                    }
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Virement">Virement</option>
                  </select>
                </div>
              )}
              <div className="form-field">
                <label>Motif / Référence</label>
                <input
                  className="input"
                  value={detteForm.motif}
                  onChange={(e) => setDetteForm({ ...detteForm, motif: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
                {Number(detteTiers.item.solde_initial || 0) > 0 ? (
                  <button
                    type="button"
                    className="btn btn-red"
                    onClick={async () => {
                      const ep = detteTiers.kind === 'client' ? 'clients' : 'fournisseurs';
                      await apiFetch(`/api/bureau/${ep}/${detteTiers.item.id}/solde-initial`, {
                        method: 'DELETE',
                        token,
                      });
                      setDetteTiers(null);
                      setMessage('Solde initial annulé.');
                      loadPage();
                    }}
                  >
                    🗑 Effacer Solde Init.
                  </button>
                ) : (
                  <span />
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-muted" onClick={() => setDetteTiers(null)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-green">
                    Valider
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL NOUVEAU / ÉDITION BON DE VENTE & VENTE COMPTOIR ── */}
      {showVenteModal && (() => {
        const sousTotal = venteLignes.reduce(
          (s, l) => s + Math.max(0, l.quantite * l.prix_unitaire - (l.remise || 0)),
          0
        );
        const remVal = Number(venteRemiseVal || 0);
        const remMontant =
          venteRemiseType === 'pourcentage'
            ? (sousTotal * Math.min(100, Math.max(0, remVal))) / 100
            : venteRemiseType === 'montant'
              ? Math.min(sousTotal, Math.max(0, remVal))
              : 0;
        const netAPayer = Math.max(0, Number((sousTotal - remMontant).toFixed(2)));
        const verseNum = Number(venteVerse || 0);
        const monnaieARendre = verseNum > netAPayer ? Number((verseNum - netAPayer).toFixed(2)) : 0;
        const resteCredit = netAPayer > verseNum ? Number((netAPayer - verseNum).toFixed(2)) : 0;

        const addByBarcode = () => {
          const code = venteBarcode.trim().toLowerCase();
          if (!code) return;
          const pr = venteProduits.find(
            (p) => (p.barcode || '').toLowerCase() === code || p.code.toLowerCase() === code
          );
          if (!pr) {
            setError(`Aucun produit trouvé pour code "${venteBarcode}".`);
            return;
          }
          const idx = venteLignes.findIndex((l) => l.produit_id === pr.id);
          if (idx >= 0) {
            const copy = [...venteLignes];
            copy[idx] = { ...copy[idx], quantite: copy[idx].quantite + 1 };
            setVenteLignes(copy);
          } else {
            setVenteLignes([
              ...venteLignes,
              {
                produit_id: pr.id,
                quantite: 1,
                prix_unitaire: prixPourClientEtProduit(venteClientId, pr),
                remise: 0,
                niveau_prix: 'client',
              },
            ]);
          }
          setVenteBarcode('');
        };

        return (
          <div className="modal-backdrop">
            <div className="modal-panel" style={{ maxWidth: 820 }}>
              <h3 style={{ marginTop: 0 }}>
                {editingVenteId
                  ? `✏ Modifier Bon de Vente #${editingVenteId}`
                  : isComptoir
                    ? '🛒 Vente Comptoir (Caisse Rapide)'
                    : '🏷️ Nouveau Bon de Vente'}
              </h3>
              <form
                onSubmit={submitVente}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div className="form-grid">
                  <div className="form-field">
                    <label>Client</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        className="select"
                        style={{ flex: 1 }}
                        value={venteClientId}
                        onChange={(e) => {
                          const nextCid = Number(e.target.value);
                          setVenteClientId(nextCid);
                          setVenteLignes((prev) =>
                            prev.map((ln) => {
                              const pr = venteProduits.find((x) => x.id === ln.produit_id);
                              return pr
                                ? {
                                    ...ln,
                                    prix_unitaire: prixParNiveau(pr, ln.niveau_prix || 'client', nextCid),
                                  }
                                : ln;
                            })
                          );
                        }}
                      >
                        {venteClients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nom} ({c.code}) — {(c.niveau_prix || 'detail').toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-muted"
                        title="Créer client rapide"
                        onClick={() => setShowQuickClient(!showQuickClient)}
                      >
                        + Client
                      </button>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Date du bon</label>
                    <input
                      type="date"
                      className="input"
                      value={venteDate}
                      onChange={(e) => setVenteDate(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Date d&apos;échéance (optionnelle)</label>
                    <input
                      type="date"
                      className="input"
                      value={venteDateEcheance}
                      onChange={(e) => setVenteDateEcheance(e.target.value)}
                    />
                  </div>
                </div>

                {showQuickClient && (
                  <div className="card" style={{ padding: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      className="input"
                      placeholder="Nom client *"
                      value={quickClientForm.nom}
                      onChange={(e) => setQuickClientForm({ ...quickClientForm, nom: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Téléphone"
                      value={quickClientForm.tel}
                      onChange={(e) => setQuickClientForm({ ...quickClientForm, tel: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-green"
                      onClick={async () => {
                        if (!quickClientForm.nom.trim()) return;
                        const created = await apiFetch<any>('/api/bureau/clients', {
                          method: 'POST',
                          token,
                          body: JSON.stringify({ ...quickClientForm, niveau_prix: 'detail' }),
                        });
                        setVenteClients([...venteClients, created]);
                        setVenteClientId(created.id);
                        setQuickClientForm({ nom: '', tel: '' });
                        setShowQuickClient(false);
                      }}
                    >
                      Créer &amp; Sélectionner
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="🔎 Scanner ou saisir code-barres / code produit + Entrée..."
                    value={venteBarcode}
                    onChange={(e) => setVenteBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addByBarcode();
                      }
                    }}
                  />
                  <button type="button" className="btn btn-muted" onClick={addByBarcode}>
                    Ajouter Code
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  {venteLignes.map((l, idx) => (
                    <div
                      key={idx}
                      style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <select
                        className="select"
                        style={{ flex: 2, minWidth: 180 }}
                        value={l.produit_id}
                        onChange={(e) => {
                          const pid = Number(e.target.value);
                          const pr = venteProduits.find((x) => x.id === pid);
                          const copy = [...venteLignes];
                          copy[idx] = {
                            ...copy[idx],
                            produit_id: pid,
                            prix_unitaire: pr
                              ? prixParNiveau(pr, copy[idx].niveau_prix || 'client', venteClientId)
                              : 0,
                          };
                          setVenteLignes(copy);
                        }}
                      >
                        {venteProduits.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.designation} (Stock: {p.stock_actuel})
                          </option>
                        ))}
                      </select>

                      <select
                        className="select"
                        style={{ width: 120 }}
                        title="Niveau de Prix"
                        value={l.niveau_prix || 'client'}
                        onChange={(e) => {
                          const niv = e.target.value;
                          const pr = venteProduits.find((x) => x.id === l.produit_id);
                          const copy = [...venteLignes];
                          copy[idx] = {
                            ...copy[idx],
                            niveau_prix: niv,
                            prix_unitaire: pr ? prixParNiveau(pr, niv, venteClientId) : copy[idx].prix_unitaire,
                          };
                          setVenteLignes(copy);
                        }}
                      >
                        <option value="client">Tarif client</option>
                        <option value="detail">Détail</option>
                        <option value="gros">Gros</option>
                        <option value="super_gros">Super Gros</option>
                        <option value="special">Spécial</option>
                      </select>

                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="input"
                        style={{ width: 70 }}
                        title="Quantité"
                        value={l.quantite}
                        onChange={(e) => {
                          const copy = [...venteLignes];
                          copy[idx].quantite = Number(e.target.value);
                          setVenteLignes(copy);
                        }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        style={{ width: 90 }}
                        title="Prix Unitaire"
                        value={l.prix_unitaire}
                        onChange={(e) => {
                          const copy = [...venteLignes];
                          copy[idx].prix_unitaire = Number(e.target.value);
                          setVenteLignes(copy);
                        }}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input"
                        style={{ width: 75 }}
                        title="Remise ligne (DA)"
                        placeholder="Remise"
                        value={l.remise || 0}
                        onChange={(e) => {
                          const copy = [...venteLignes];
                          copy[idx].remise = Number(e.target.value);
                          setVenteLignes(copy);
                        }}
                      />
                      <span style={{ minWidth: 80, textAlign: 'right', fontWeight: 700, fontSize: 12 }}>
                        {fmtDA(Math.max(0, l.quantite * l.prix_unitaire - (l.remise || 0)))}
                      </span>
                      {venteLignes.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-red"
                          style={{ padding: '4px 8px' }}
                          onClick={() =>
                            setVenteLignes(venteLignes.filter((_, i) => i !== idx))
                          }
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() =>
                    venteProduits[0] &&
                    setVenteLignes([
                      ...venteLignes,
                      {
                        produit_id: venteProduits[0].id,
                        quantite: 1,
                        prix_unitaire: prixPourClientEtProduit(
                          venteClientId,
                          venteProduits[0]
                        ),
                        remise: 0,
                        niveau_prix: 'client',
                      },
                    ])
                  }
                >
                  + Ajouter Ligne
                </button>

                <div className="form-grid">
                  <div className="form-field">
                    <label>Remise Globale</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        className="select"
                        value={venteRemiseType}
                        onChange={(e) => setVenteRemiseType(e.target.value as any)}
                      >
                        <option value="aucune">Aucune</option>
                        <option value="montant">Montant (DA)</option>
                        <option value="pourcentage">Pourcentage (%)</option>
                      </select>
                      {venteRemiseType !== 'aucune' && (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input"
                          style={{ width: 95 }}
                          value={venteRemiseVal}
                          onChange={(e) => setVenteRemiseVal(e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Motif remise / Observations</label>
                    <input
                      className="input"
                      value={venteRemiseType !== 'aucune' ? venteRemiseMotif : venteObs}
                      onChange={(e) =>
                        venteRemiseType !== 'aucune'
                          ? setVenteRemiseMotif(e.target.value)
                          : setVenteObs(e.target.value)
                      }
                      placeholder={venteRemiseType !== 'aucune' ? 'Motif de remise...' : 'Observations...'}
                    />
                  </div>
                  <div className="form-field">
                    <label>Montant Reçu / Versé (DA)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={venteVerse}
                      onChange={(e) => setVenteVerse(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Mode de Règlement</label>
                    <select
                      className="select"
                      value={venteModeRegl}
                      onChange={(e) => setVenteModeRegl(e.target.value)}
                    >
                      <option value="Espèces">Espèces</option>
                      <option value="Chèque">Chèque</option>
                      <option value="Virement">Virement</option>
                      <option value="Carte">Carte / TPE</option>
                    </select>
                  </div>
                </div>

                <div
                  className="card"
                  style={{
                    padding: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <span>Brut : <strong>{fmtDA(sousTotal)}</strong></span>
                  {remMontant > 0 && (
                    <span style={{ color: 'var(--orange)' }}>
                      Remise : <strong>-{fmtDA(remMontant)}</strong>
                    </span>
                  )}
                  <span>
                    Net à payer : <strong style={{ color: 'var(--accent)', fontSize: 15 }}>{fmtDA(netAPayer)}</strong>
                  </span>
                  {monnaieARendre > 0 && (
                    <span style={{ color: 'var(--green)' }}>
                      Monnaie à rendre : <strong>{fmtDA(monnaieARendre)}</strong>
                    </span>
                  )}
                  {resteCredit > 0 && (
                    <span style={{ color: 'var(--orange)' }}>
                      Reste à crédit : <strong>{fmtDA(resteCredit)}</strong>
                    </span>
                  )}
                </div>

                {(() => {
                  const cl = venteClients.find((c) => c.id === venteClientId);
                  const plafond = Number(cl?.plafond_credit || 0);
                  if (!cl || cl.code === 'CLT-COMPTOIR' || plafond <= 0) return null;
                  const soldeBase =
                    venteEditingBon &&
                    venteEditingBon.statut !== 'Annulé' &&
                    venteEditingBon.client_id === cl.id
                      ? Math.max(0, Number((cl.solde - venteEditingBon.reste_payer).toFixed(2)))
                      : Number(cl.solde || 0);
                  const soldeProjete = Number((soldeBase + resteCredit).toFixed(2));
                  const depasse = soldeProjete > plafond;
                  if (!depasse) {
                    return (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        💳 Crédit client : solde projeté{' '}
                        <strong>{fmtDA(soldeProjete)}</strong> / plafond{' '}
                        <strong>{fmtDA(plafond)}</strong> (
                        {Math.round((soldeProjete / plafond) * 100)}%)
                      </div>
                    );
                  }
                  const bloquant = Boolean(cl.bloquer_si_depasse) && resteCredit > 0;
                  const depassement = soldeProjete - plafond;
                  return (
                    <div className={`alert-box ${bloquant ? 'alert-error' : 'alert-warn'}`} style={{ marginBottom: 0 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        {bloquant
                          ? '🚫 Dépassement du plafond de crédit (Validation bloquée)'
                          : '⚠️ Avertissement : Plafond de crédit dépassé'}
                      </div>
                      <div style={{ fontSize: 12 }}>
                        Solde actuel : <strong>{fmtDA(soldeBase)}</strong> + Reste à crédit :{' '}
                        <strong>{fmtDA(resteCredit)}</strong> = Solde projeté :{' '}
                        <strong>{fmtDA(soldeProjete)}</strong> (Plafond :{' '}
                        <strong>{fmtDA(plafond)}</strong>, dépassement :{' '}
                        <strong>+{fmtDA(depassement)}</strong>)
                      </div>
                      {bloquant && (
                        <div style={{ marginTop: 8 }}>
                          {userRole === 'admin' ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                              <input
                                type="checkbox"
                                checked={venteForcerPlafond}
                                onChange={(e) => setVenteForcerPlafond(e.target.checked)}
                              />
                              🔓 Forcer la validation malgré le dépassement (Administrateur)
                            </label>
                          ) : (
                            <span style={{ fontSize: 11 }}>
                              Augmentez le montant versé ou demandez à un administrateur de forcer la validation.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-muted"
                    onClick={() => setShowVenteModal(false)}
                  >
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-green">
                    {editingVenteId ? 'Enregistrer Modifications' : `Valider la Vente (${fmtDA(netAPayer)})`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL NOUVEAU / ÉDITION BON D'ACHAT ── */}
      {showAchatModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3 style={{ marginTop: 0 }}>
              {editingAchatId ? `✏ Modifier Bon d'Achat #${editingAchatId}` : "🛒 Nouveau Bon d'Achat"}
            </h3>
            <form
              onSubmit={submitAchat}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div className="form-grid">
                <div className="form-field">
                  <label>Fournisseur</label>
                  <select
                    className="select"
                    value={achatFournId}
                    onChange={(e) => setAchatFournId(Number(e.target.value))}
                  >
                    {achatFournisseurs.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nom} ({f.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Date du bon</label>
                  <input
                    type="date"
                    className="input"
                    value={achatDate}
                    onChange={(e) => setAchatDate(e.target.value)}
                  />
                </div>
              </div>

              {achatLignes.map((l, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="select"
                    style={{ flex: 2 }}
                    value={l.produit_id}
                    onChange={(e) => {
                      const pid = Number(e.target.value);
                      const pr = venteProduits.find((x) => x.id === pid);
                      const copy = [...achatLignes];
                      copy[idx] = {
                        ...copy[idx],
                        produit_id: pid,
                        prix_unitaire: pr?.prix_achat || 0,
                      };
                      setAchatLignes(copy);
                    }}
                  >
                    {venteProduits.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.designation}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="input"
                    style={{ width: 85 }}
                    value={l.quantite}
                    onChange={(e) => {
                      const copy = [...achatLignes];
                      copy[idx].quantite = Number(e.target.value);
                      setAchatLignes(copy);
                    }}
                  />
                  <input
                    type="number"
                    className="input"
                    style={{ width: 95 }}
                    value={l.prix_unitaire}
                    onChange={(e) => {
                      const copy = [...achatLignes];
                      copy[idx].prix_unitaire = Number(e.target.value);
                      setAchatLignes(copy);
                    }}
                  />
                  {achatLignes.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-red"
                      style={{ padding: '4px 8px' }}
                      onClick={() =>
                        setAchatLignes(achatLignes.filter((_, i) => i !== idx))
                      }
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="btn btn-muted"
                onClick={() =>
                  venteProduits[0] &&
                  setAchatLignes([
                    ...achatLignes,
                    {
                      produit_id: venteProduits[0].id,
                      quantite: 10,
                      prix_unitaire: venteProduits[0].prix_achat,
                    },
                  ])
                }
              >
                + Ajouter Ligne
              </button>

              <div className="form-field">
                <label>Observations</label>
                <input
                  className="input"
                  value={achatObs}
                  onChange={(e) => setAchatObs(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setShowAchatModal(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-green">
                  {editingAchatId ? 'Enregistrer Modifications' : "Valider l'Achat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL DÉTAIL BON VENTE / ACHAT ── */}
      {detailBon && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            {activeProfil && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 8,
                  marginBottom: 10,
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {activeProfil.logo_data && (
                    <img
                      src={activeProfil.logo_data}
                      alt="Logo"
                      style={{ width: 42, height: 42, objectFit: 'contain', background: '#fff', borderRadius: 4, padding: 2 }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {activeProfil.forme_juridique ? `${activeProfil.forme_juridique} ` : ''}
                      {activeProfil.nom}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {activeProfil.adresse} {activeProfil.ville ? `• ${activeProfil.ville}` : ''} • Tél : {activeProfil.telephone}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      NIF : {activeProfil.nif || '—'} | NIS : {activeProfil.nis || '—'} | RC : {activeProfil.nrc || '—'}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ marginTop: 0 }}>👁 Détail — {detailBon.numero}</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                {detailBon.client_id !== undefined && (
                  <button
                    className="btn btn-muted"
                    onClick={() => {
                      const bon = detailBon;
                      setDetailBon(null);
                      setTicketBon(bon);
                    }}
                  >
                    🧾 Ticket 80 mm
                  </button>
                )}
                <button className="btn btn-muted" onClick={() => window.print()}>
                  🖨 Imprimer
                </button>
              </div>
            </div>
            <p style={{ color: 'var(--muted)' }}>
              Date : {detailBon.date_bon} | Tiers :{' '}
              {detailBon.client_nom || detailBon.fournisseur_nom} | Statut :{' '}
              {detailBon.statut}
            </p>
            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Qté</th>
                    <th>P.U.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailBon.lignes || []).map((l: any, i: number) => (
                    <tr key={i}>
                      <td>{l.designation}</td>
                      <td>{l.quantite}</td>
                      <td>{fmtDA(l.prix_unitaire)}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDA(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {activeProfil?.pied_page && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, fontStyle: 'italic' }}>
                {activeProfil.pied_page}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Total : {fmtDA(detailBon.total)}</strong>
              <button className="btn" onClick={() => setDetailBon(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DÉTAIL COMMANDE PORTAIL ── */}
      {detailCmd && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3 style={{ marginTop: 0 }}>👁 Commande {detailCmd.numero}</h3>
            <p style={{ color: 'var(--muted)' }}>
              Client : {detailCmd.client_nom} | Date : {detailCmd.date_commande} |
              Observations : {detailCmd.observations || '—'}
            </p>
            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Qté (Colis)</th>
                    <th>Cond.</th>
                    <th>P.U.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailCmd.lignes || []).map((l: any, i: number) => (
                    <tr key={i}>
                      <td>{l.designation}</td>
                      <td>{l.quantite}</td>
                      <td>x{l.facteur_conversion || 1}</td>
                      <td>{fmtDA(l.prix_unitaire)}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDA(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Total Estimé : {fmtDA(detailCmd.montant_total)}</strong>
              <button className="btn" onClick={() => setDetailCmd(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL TICKET DE CAISSE 80MM ── */}
      {ticketBon && (
        <Ticket80mmModal
          bon={ticketBon}
          profil={activeProfil}
          onClose={() => setTicketBon(null)}
        />
      )}

      {/* ── MODAL DÉTAIL / ÉDITION / CRÉATION FACTURE ── */}
      {detailFacture && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            {activeProfil && (
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 10 }}>
                <strong>{activeProfil.forme_juridique ? `${activeProfil.forme_juridique} ` : ''}{activeProfil.nom}</strong>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {activeProfil.adresse} {activeProfil.ville} • Tél: {activeProfil.telephone}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                  NIF: {activeProfil.nif || '—'} | NIS: {activeProfil.nis || '—'} | RC: {activeProfil.nrc || '—'} | AI: {activeProfil.art_imp || '—'}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ marginTop: 0 }}>🧾 Facture {detailFacture.numero}</h3>
              <button className="btn btn-muted" onClick={() => window.print()}>
                🖨 Imprimer
              </button>
            </div>
            <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              <div>Client : <strong>{detailFacture.client_nom}</strong></div>
              <div>Date Facture : {detailFacture.date_facture} | Échéance : {detailFacture.date_echeance || 'Comptant'}</div>
              <div>Bon de Vente associé : <strong>{detailFacture.bon_numero}</strong></div>
              <div>Total HT : <strong>{fmtDA(detailFacture.total_ht)}</strong></div>
              <div>TVA ({detailFacture.tva}%) : <strong>{fmtDA(detailFacture.total_ttc - detailFacture.total_ht)}</strong></div>
              <div style={{ fontSize: 16 }}>Total TTC : <strong style={{ color: 'var(--green)' }}>{fmtDA(detailFacture.total_ttc)}</strong></div>
              <div>Observations : {detailFacture.observations || '—'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn" onClick={() => setDetailFacture(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {editFacture && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 460 }}>
            <h3 style={{ marginTop: 0 }}>✏ Modifier Facture — {editFacture.numero}</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch(`/api/bureau/factures/${editFacture.id}`, {
                  method: 'PUT',
                  token,
                  body: JSON.stringify({
                    ...editFacForm,
                    tva: Number(editFacForm.tva || 19),
                  }),
                });
                setEditFacture(null);
                setMessage('Facture mise à jour.');
                loadPage();
              }}
              className="form-grid"
            >
              <div className="form-field">
                <label>Date Facture</label>
                <input
                  type="date"
                  className="input"
                  value={editFacForm.date_facture}
                  onChange={(e) => setEditFacForm({ ...editFacForm, date_facture: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Échéance</label>
                <input
                  type="date"
                  className="input"
                  value={editFacForm.date_echeance}
                  onChange={(e) => setEditFacForm({ ...editFacForm, date_echeance: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>TVA (%)</label>
                <input
                  type="number"
                  className="input"
                  value={editFacForm.tva}
                  onChange={(e) => setEditFacForm({ ...editFacForm, tva: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Statut</label>
                <select
                  className="select"
                  value={editFacForm.statut}
                  onChange={(e) => setEditFacForm({ ...editFacForm, statut: e.target.value })}
                >
                  <option value="Émise">Émise</option>
                  <option value="Payée">Payée</option>
                  <option value="Partielle">Partielle</option>
                  <option value="Annulée">Annulée</option>
                </select>
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label>Observations</label>
                <input
                  className="input"
                  value={editFacForm.observations}
                  onChange={(e) => setEditFacForm({ ...editFacForm, observations: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-muted" onClick={() => setEditFacture(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-green">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewFacModal && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>🧾 Nouvelle Facture sur Bon de Vente</h3>
            {unbilledBons.length === 0 ? (
              <>
                <p style={{ color: 'var(--muted)' }}>
                  Tous les bons de vente valides sont déjà facturés.
                </p>
                <button className="btn" onClick={() => setShowNewFacModal(false)}>Fermer</button>
              </>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiFetch('/api/bureau/factures', {
                    method: 'POST',
                    token,
                    body: JSON.stringify({
                      ...newFacForm,
                      tva: Number(newFacForm.tva || 19),
                    }),
                  });
                  setShowNewFacModal(false);
                  setMessage('Facture créée avec succès.');
                  loadPage();
                }}
                className="form-grid"
              >
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Bon de Vente à Facturer</label>
                  <select
                    className="select"
                    value={newFacForm.bon_vente_id}
                    onChange={(e) =>
                      setNewFacForm({ ...newFacForm, bon_vente_id: Number(e.target.value) })
                    }
                  >
                    {unbilledBons.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.numero} — {b.client_nom} ({fmtDA(b.total)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Date Facture</label>
                  <input
                    type="date"
                    className="input"
                    value={newFacForm.date_facture}
                    onChange={(e) => setNewFacForm({ ...newFacForm, date_facture: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Date d'Échéance</label>
                  <input
                    type="date"
                    className="input"
                    value={newFacForm.date_echeance}
                    onChange={(e) => setNewFacForm({ ...newFacForm, date_echeance: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>TVA (%)</label>
                  <input
                    type="number"
                    className="input"
                    value={newFacForm.tva}
                    onChange={(e) => setNewFacForm({ ...newFacForm, tva: e.target.value })}
                  />
                </div>
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Observations</label>
                  <input
                    className="input"
                    value={newFacForm.observations}
                    onChange={(e) => setNewFacForm({ ...newFacForm, observations: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="btn btn-muted" onClick={() => setShowNewFacModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-green">
                    Émettre la Facture
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL CRÉATION / MODIFICATION PROFIL ENTREPRISE ── */}
      {showProfilModal && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 740 }}>
            <h3 style={{ marginTop: 0 }}>
              {editingProfilId
                ? `✏ Modifier Profil Entreprise — ${profilForm.nom}`
                : '🏢 Nouveau Profil Entreprise'}
            </h3>

            <div className="tabs">
              <button
                type="button"
                className={`tab-btn ${profilModalTab === 'general' ? 'active' : ''}`}
                onClick={() => setProfilModalTab('general')}
              >
                🏢 Identité &amp; Coordonnées
              </button>
              <button
                type="button"
                className={`tab-btn ${profilModalTab === 'fiscal' ? 'active' : ''}`}
                onClick={() => setProfilModalTab('fiscal')}
              >
                🏛 Fiscal &amp; Bancaire
              </button>
              <button
                type="button"
                className={`tab-btn ${profilModalTab === 'docs' ? 'active' : ''}`}
                onClick={() => setProfilModalTab('docs')}
              >
                🧾 Paramètres &amp; Logo
              </button>
            </div>

            <form
              onSubmit={submitProfil}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {profilModalTab === 'general' && (
                <div className="form-grid">
                  <div className="form-field">
                    <label>Code Profil (auto si vide)</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="input"
                        style={{ flex: 1 }}
                        placeholder="Ex: SOCIETE_GH001"
                        value={profilForm.code}
                        onChange={(e) =>
                          setProfilForm({ ...profilForm, code: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-muted"
                        title="Régénérer le code"
                        onClick={() =>
                          setProfilForm({
                            ...profilForm,
                            code: `SOCIETE_${Math.floor(100 + Math.random() * 900)}`,
                          })
                        }
                      >
                        🔄
                      </button>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Type de Profil *</label>
                    <select
                      className="select"
                      value={profilForm.type_profil}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, type_profil: e.target.value })
                      }
                    >
                      {TYPES_PROFIL.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Nom / Raison Sociale *</label>
                    <input
                      className="input"
                      value={profilForm.nom}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, nom: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>Forme Juridique</label>
                    <select
                      className="select"
                      value={profilForm.forme_juridique}
                      onChange={(e) =>
                        setProfilForm({
                          ...profilForm,
                          forme_juridique: e.target.value,
                        })
                      }
                    >
                      {FORMES_JURIDIQUES.map((fj) => (
                        <option key={fj} value={fj}>
                          {fj}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Activité / Secteur</label>
                    <input
                      className="input"
                      placeholder="Distribution Agroalimentaire..."
                      value={profilForm.activite}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, activite: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Capital Social</label>
                    <input
                      className="input"
                      placeholder="10 000 000 DA"
                      value={profilForm.capital_social}
                      onChange={(e) =>
                        setProfilForm({
                          ...profilForm,
                          capital_social: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Adresse</label>
                    <input
                      className="input"
                      value={profilForm.adresse}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, adresse: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Ville / Wilaya</label>
                    <input
                      className="input"
                      value={profilForm.ville}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, ville: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Code Postal</label>
                    <input
                      className="input"
                      value={profilForm.code_postal}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, code_postal: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Téléphone Principal</label>
                    <input
                      className="input"
                      value={profilForm.telephone}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, telephone: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Téléphone 2 / Mobile / Fax</label>
                    <input
                      className="input"
                      value={profilForm.telephone2}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, telephone2: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Email</label>
                    <input
                      type="email"
                      className="input"
                      value={profilForm.email}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Site Web</label>
                    <input
                      className="input"
                      placeholder="https://..."
                      value={profilForm.site_web}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, site_web: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {profilModalTab === 'fiscal' && (
                <div className="form-grid">
                  <div className="form-field">
                    <label>NIF (Numéro d'Identification Fiscale)</label>
                    <input
                      className="input"
                      value={profilForm.nif}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, nif: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>NIS (Numéro d'Identification Statistique)</label>
                    <input
                      className="input"
                      value={profilForm.nis}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, nis: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>N° RC (Registre de Commerce)</label>
                    <input
                      className="input"
                      value={profilForm.nrc}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, nrc: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Article d'Imposition (AI)</label>
                    <input
                      className="input"
                      value={profilForm.art_imp}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, art_imp: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Banque</label>
                    <input
                      className="input"
                      placeholder="Ex: BNA, BEA, CPA, AGB..."
                      value={profilForm.banque}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, banque: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>RIB / N° Compte Bancaire</label>
                    <input
                      className="input"
                      value={profilForm.rib}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, rib: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {profilModalTab === 'docs' && (
                <div className="form-grid">
                  <div className="form-field">
                    <label>Devise</label>
                    <select
                      className="select"
                      value={profilForm.devise}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, devise: e.target.value })
                      }
                    >
                      <option value="DA">DA (Dinar Algérien)</option>
                      <option value="DZD">DZD</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>TVA par défaut (%)</label>
                    <select
                      className="select"
                      value={profilForm.tva_defaut}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, tva_defaut: e.target.value })
                      }
                    >
                      <option value="19">19% (Taux normal)</option>
                      <option value="9">9% (Taux réduit)</option>
                      <option value="0">0% (Exonéré)</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Préfixe Bons de Vente</label>
                    <input
                      className="input"
                      value={profilForm.prefixe_bv}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, prefixe_bv: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field">
                    <label>Préfixe Factures</label>
                    <input
                      className="input"
                      value={profilForm.prefixe_facture}
                      onChange={(e) =>
                        setProfilForm({
                          ...profilForm,
                          prefixe_facture: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Pied de page / Mentions légales des documents</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={profilForm.pied_page}
                      onChange={(e) =>
                        setProfilForm({ ...profilForm, pied_page: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Logo Entreprise (PNG / JPG)</label>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                      />
                      {profilForm.logo_data && (
                        <>
                          <img
                            src={profilForm.logo_data}
                            alt="Aperçu logo"
                            style={{
                              width: 56,
                              height: 56,
                              objectFit: 'contain',
                              background: '#fff',
                              borderRadius: 4,
                              border: '1px solid var(--border)',
                              padding: 3,
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-red"
                            style={{ padding: '4px 9px' }}
                            onClick={() =>
                              setProfilForm({ ...profilForm, logo_data: null })
                            }
                          >
                            Supprimer logo
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={profilForm.est_defaut}
                        onChange={(e) =>
                          setProfilForm({
                            ...profilForm,
                            est_defaut: e.target.checked,
                          })
                        }
                      />
                      Définir comme profil actif par défaut
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={profilForm.actif}
                        onChange={(e) =>
                          setProfilForm({ ...profilForm, actif: e.target.checked })
                        }
                      />
                      Profil actif
                    </label>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setShowProfilModal(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-green">
                  {editingProfilId ? 'Enregistrer les modifications' : 'Créer le profil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
