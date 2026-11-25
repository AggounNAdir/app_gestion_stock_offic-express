import React, { useEffect, useState } from 'react';
import { apiFetch, fmtDA } from '../api.ts';

type StatutDevis = 'Brouillon' | 'Envoyé' | 'Accepté' | 'Refusé' | 'Converti';

interface LigneDevisForm {
  produit_id: number;
  quantite: number;
  prix_unitaire: number;
  remise: number;
  niveau_prix: string;
}

interface DevisRow {
  id: number;
  numero: string;
  date_devis: string;
  date_validite?: string | null;
  client_id: number;
  client_nom: string;
  client_code?: string;
  client_adresse?: string;
  client_tel?: string;
  client_email?: string;
  client_nif?: string;
  client_nis?: string;
  client_nrc?: string;
  vendeur_id?: number | null;
  vendeur_nom?: string | null;
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
  bon_vente_numero?: string | null;
  lignes: {
    id: number;
    produit_id: number;
    designation: string;
    quantite: number;
    prix_unitaire: number;
    remise?: number;
    niveau_prix?: string;
    total: number;
    total_ht: number;
    tva_taux: number;
    total_tva: number;
    total_ttc: number;
  }[];
}

interface ProfilEntrepriseDoc {
  id: number;
  nom: string;
  type_profil?: string;
  forme_juridique?: string;
  activite?: string;
  capital_social?: string;
  adresse?: string;
  telephone?: string;
  telephone2?: string;
  email?: string;
  site_web?: string;
  ville?: string;
  code_postal?: string;
  nif?: string;
  nis?: string;
  nrc?: string;
  registre_commerce?: string;
  art_imp?: string;
  banque?: string;
  rib?: string;
  devise?: string;
  pied_page?: string;
  logo_data?: string | null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeImageSrc(src?: string | null): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  return null;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUT_BADGE_CLASS: Record<StatutDevis, string> = {
  Brouillon: 'badge-orange',
  Envoyé: 'badge-blue',
  Accepté: 'badge-green',
  Refusé: 'badge-red',
  Converti: 'badge-green',
};

export function DevisPage({
  token,
  userRole,
  onNavigate,
}: {
  token: string;
  userRole?: string;
  onNavigate?: (page: string) => void;
}) {
  const [devisList, setDevisList] = useState<DevisRow[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [vendeurs, setVendeurs] = useState<any[]>([]);
  const [profilDoc, setProfilDoc] = useState<ProfilEntrepriseDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState<string>('Tous');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formClientId, setFormClientId] = useState<number>(0);
  const [formVendeurId, setFormVendeurId] = useState<string>('');
  const [formDateDevis, setFormDateDevis] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [formDateValidite, setFormDateValidite] = useState(
    addDays(new Date().toISOString().slice(0, 10), 15)
  );
  const [formStatut, setFormStatut] = useState<StatutDevis>('Brouillon');
  const [formRemiseType, setFormRemiseType] = useState<
    'aucune' | 'pourcentage' | 'montant'
  >('aucune');
  const [formRemiseValeur, setFormRemiseValeur] = useState<string>('0');
  const [formRemiseMotif, setFormRemiseMotif] = useState<string>('');
  const [formObservations, setFormObservations] = useState<string>('');
  const [formLignes, setFormLignes] = useState<LigneDevisForm[]>([]);
  const [saving, setSaving] = useState(false);

  // Convert modal state
  const [convertTarget, setConvertTarget] = useState<DevisRow | null>(null);
  const [convertDateBon, setConvertDateBon] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [convertVerse, setConvertVerse] = useState<string>('0');
  const [convertMode, setConvertMode] = useState<string>('Espèces');
  const [convertForcerPlafond, setConvertForcerPlafond] = useState(false);
  const [converting, setConverting] = useState(false);

  // Preview / Print modal state
  const [previewDevis, setPreviewDevis] = useState<DevisRow | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dv, cl, pr, vd, profRes] = await Promise.all([
        apiFetch<DevisRow[]>('/api/bureau/devis', { token }),
        apiFetch<any[]>('/api/bureau/clients', { token }).catch(() => []),
        apiFetch<any[]>('/api/bureau/produits', { token }).catch(() => []),
        apiFetch<any[]>('/api/bureau/vendeurs', { token }).catch(() => []),
        apiFetch<{ profil: ProfilEntrepriseDoc | null }>(
          '/api/bureau/profil-document/devis',
          { token }
        ).catch(() => ({ profil: null })),
      ]);
      setDevisList(dv);
      setClients(cl);
      setProduits(pr);
      setVendeurs(vd);
      setProfilDoc(profRes?.profil || null);
    } catch (e: any) {
      setError(e.message || 'Erreur lors du chargement des devis.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [token]);

  const prixPourClientEtProduit = (clientId: number, prod: any): number => {
    if (!prod) return 0;
    const cl = clients.find((c) => c.id === clientId);
    const niv = cl?.niveau_prix || 'detail';
    if (niv === 'super_gros' && prod.prix_super_gros > 0)
      return prod.prix_super_gros;
    if (niv === 'gros' && prod.prix_gros > 0) return prod.prix_gros;
    if (niv === 'special' && prod.prix_special > 0) return prod.prix_special;
    return prod.prix_detail || prod.prix_vente || 0;
  };

  const prixParNiveau = (
    prod: any,
    niveau: string,
    clientId: number
  ): number => {
    if (!prod) return 0;
    if (niveau === 'super_gros' && prod.prix_super_gros > 0)
      return prod.prix_super_gros;
    if (niveau === 'gros' && prod.prix_gros > 0) return prod.prix_gros;
    if (niveau === 'special' && prod.prix_special > 0) return prod.prix_special;
    if (niveau === 'detail' && (prod.prix_detail > 0 || prod.prix_vente > 0))
      return prod.prix_detail || prod.prix_vente;
    return prixPourClientEtProduit(clientId, prod);
  };

  const openNewDevis = () => {
    const today = new Date().toISOString().slice(0, 10);
    const defaultClient = clients[0]?.id || 0;
    const firstProd = produits[0];
    const pu = firstProd ? prixParNiveau(firstProd, 'client', defaultClient) : 0;
    setEditingId(null);
    setFormClientId(defaultClient);
    setFormVendeurId('');
    setFormDateDevis(today);
    setFormDateValidite(addDays(today, 15));
    setFormStatut('Brouillon');
    setFormRemiseType('aucune');
    setFormRemiseValeur('0');
    setFormRemiseMotif('');
    setFormObservations('');
    setFormLignes(
      firstProd
        ? [
            {
              produit_id: firstProd.id,
              quantite: 1,
              prix_unitaire: pu,
              remise: 0,
              niveau_prix: 'client',
            },
          ]
        : []
    );
    setModalOpen(true);
  };

  const openEditDevis = (dv: DevisRow) => {
    setEditingId(dv.id);
    setFormClientId(dv.client_id);
    setFormVendeurId(dv.vendeur_id ? String(dv.vendeur_id) : '');
    setFormDateDevis(dv.date_devis);
    setFormDateValidite(dv.date_validite || addDays(dv.date_devis, 15));
    setFormStatut(dv.statut);
    setFormRemiseType(dv.remise_type || 'aucune');
    setFormRemiseValeur(String(dv.remise_valeur ?? dv.remise ?? 0));
    setFormRemiseMotif(dv.remise_motif || '');
    setFormObservations(dv.observations || '');
    setFormLignes(
      (dv.lignes || []).map((l) => ({
        produit_id: l.produit_id,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        remise: l.remise || 0,
        niveau_prix: l.niveau_prix || 'client',
      }))
    );
    setModalOpen(true);
  };

  const computeModalTotals = () => {
    let sumHT = 0;
    let sumTVA = 0;
    let brutTTC = 0;
    for (const l of formLignes) {
      const prod = produits.find((p) => p.id === l.produit_id);
      const tvaTaux = prod?.tva || 0;
      const lineTot = Math.max(
        0,
        Number(l.quantite || 0) * Number(l.prix_unitaire || 0) -
          Number(l.remise || 0)
      );
      const ht = lineTot / (1 + tvaTaux / 100);
      const tva = lineTot - ht;
      sumHT += ht;
      sumTVA += tva;
      brutTTC += lineTot;
    }
    const rVal = Math.max(0, Number(formRemiseValeur || 0));
    const rMontant =
      formRemiseType === 'pourcentage'
        ? (brutTTC * Math.min(100, rVal)) / 100
        : formRemiseType === 'montant'
        ? Math.min(brutTTC, rVal)
        : 0;
    const totalTTC = Math.max(0, brutTTC - rMontant);
    const ratio = brutTTC > 0 ? totalTTC / brutTTC : 1;
    return {
      brutTTC,
      remiseMontant: rMontant,
      totalHT: sumHT * ratio,
      totalTVA: sumTVA * ratio,
      totalTTC,
    };
  };

  const handleSaveDevis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId) {
      setBanner({ type: 'error', text: 'Sélectionnez un client.' });
      return;
    }
    if (formLignes.length === 0) {
      setBanner({ type: 'error', text: 'Ajoutez au moins une ligne.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        client_id: formClientId,
        vendeur_id: formVendeurId ? Number(formVendeurId) : null,
        date_devis: formDateDevis,
        date_validite: formDateValidite || null,
        statut: formStatut,
        remise_type: formRemiseType,
        remise_valeur: Number(formRemiseValeur || 0),
        remise_motif: formRemiseMotif || null,
        observations: formObservations || null,
        lignes: formLignes.map((l) => ({
          produit_id: l.produit_id,
          quantite: Number(l.quantite),
          prix_unitaire: Number(l.prix_unitaire),
          remise: Number(l.remise || 0),
          niveau_prix:
            l.niveau_prix === 'client' ? undefined : l.niveau_prix,
        })),
      };
      if (editingId) {
        const updated = await apiFetch<DevisRow>(
          `/api/bureau/devis/${editingId}`,
          {
            method: 'PUT',
            token,
            body: JSON.stringify(payload),
          }
        );
        setBanner({
          type: 'success',
          text: `Devis ${updated.numero} mis à jour avec succès.`,
        });
      } else {
        const created = await apiFetch<DevisRow>('/api/bureau/devis', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setBanner({
          type: 'success',
          text: `Devis ${created.numero} créé (${fmtDA(created.total_ttc)}).`,
        });
      }
      setModalOpen(false);
      await loadAll();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatut = async (dv: DevisRow, nextStatut: StatutDevis) => {
    try {
      await apiFetch(`/api/bureau/devis/${dv.id}/statut`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ statut: nextStatut }),
      });
      setBanner({
        type: 'success',
        text: `Statut de ${dv.numero} mis à jour (${nextStatut}).`,
      });
      await loadAll();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const handleDeleteDevis = async (id: number) => {
    try {
      await apiFetch(`/api/bureau/devis/${id}`, {
        method: 'DELETE',
        token,
      });
      setConfirmDeleteId(null);
      setBanner({ type: 'success', text: 'Devis supprimé.' });
      await loadAll();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message });
    }
  };

  const openConvertModal = (dv: DevisRow) => {
    setConvertTarget(dv);
    setConvertDateBon(new Date().toISOString().slice(0, 10));
    setConvertVerse('0');
    setConvertMode('Espèces');
    setConvertForcerPlafond(false);
  };

  const handleConvertDevis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertTarget) return;
    setConverting(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        devis: DevisRow;
        bon_vente: { id: number; numero: string };
        credit_warning?: string | null;
      }>(`/api/bureau/devis/${convertTarget.id}/convertir`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          date_bon: convertDateBon,
          montant_verse: Number(convertVerse || 0),
          mode_reglement: convertMode,
          forcer_plafond: convertForcerPlafond,
        }),
      });
      setConvertTarget(null);
      setBanner({
        type: 'success',
        text: `Devis ${res.devis.numero} converti en Bon de Vente ${res.bon_vente.numero} (stock déduit & audit enregistré).${
          res.credit_warning ? ` ⚠️ ${res.credit_warning}` : ''
        }`,
      });
      await loadAll();
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message });
    } finally {
      setConverting(false);
    }
  };

  const buildProformaHtml = (dv: DevisRow): string => {
    const p = profilDoc;
    const logoUrl = safeImageSrc(p?.logo_data);
    const devise = p?.devise || 'DA';
    const rc = p?.registre_commerce || p?.nrc || '';
    const lignesHtml = (dv.lignes || [])
      .map(
        (l, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${escapeHtml(l.designation)}</td>
        <td style="text-align:right;">${Number(l.quantite).toFixed(2)}</td>
        <td style="text-align:right;">${Number(l.prix_unitaire).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align:right;">${Number(l.remise || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align:center;">${Number(l.tva_taux || 0)}%</td>
        <td style="text-align:right;font-weight:700;">${Number(l.total_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${escapeHtml(devise)}</td>
      </tr>`
      )
      .join('');

    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Facture Proforma ${escapeHtml(dv.numero)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 28px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #1e293b; padding-bottom: 14px; margin-bottom: 18px; }
    .company h1 { margin: 0 0 4px 0; font-size: 20px; color: #0f172a; }
    .muted { color: #475569; font-size: 12px; line-height: 1.45; }
    .doc-box { text-align: right; min-width: 240px; }
    .doc-title { font-size: 18px; font-weight: 800; color: #1d4ed8; letter-spacing: 0.4px; }
    .client-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #1e293b; color: #ffffff; padding: 8px 10px; font-size: 12px; text-align: left; }
    td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; font-size: 12px; }
    .totals { width: 320px; margin-left: auto; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
    .totals-row { display: flex; justify-content: space-between; padding: 7px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .totals-row.ttc { background: #eff6ff; font-weight: 800; font-size: 15px; border-bottom: none; color: #1e3a8a; }
    .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 11px; color: #475569; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" style="max-height:56px;margin-bottom:8px;" />` : ''}
      <h1>${escapeHtml(p?.forme_juridique ? `${p.forme_juridique} ` : '')}${escapeHtml(p?.nom || 'Entreprise')}</h1>
      <div class="muted">
        ${p?.activite ? `${escapeHtml(p.activite)}<br/>` : ''}
        ${p?.adresse ? `${escapeHtml(p.adresse)}` : ''}${p?.ville ? ` — ${escapeHtml(p.ville)}` : ''}${p?.code_postal ? ` (${escapeHtml(p.code_postal)})` : ''}<br/>
        ${p?.telephone ? `Tél: ${escapeHtml(p.telephone)}` : ''}${p?.email ? ` · Email: ${escapeHtml(p.email)}` : ''}<br/>
        ${[
          p?.nif ? `NIF: ${escapeHtml(p.nif)}` : '',
          p?.nis ? `NIS: ${escapeHtml(p.nis)}` : '',
          rc ? `RC: ${escapeHtml(rc)}` : '',
          p?.art_imp ? `AI: ${escapeHtml(p.art_imp)}` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
        ${p?.banque || p?.rib ? `<br/>${p?.banque ? `Banque: ${escapeHtml(p.banque)} ` : ''}${p?.rib ? `RIB: ${escapeHtml(p.rib)}` : ''}` : ''}
      </div>
    </div>
    <div class="doc-box">
      <div class="doc-title">FACTURE PROFORMA / DEVIS</div>
      <div style="font-size:15px;font-weight:700;margin:6px 0;">N° ${escapeHtml(dv.numero)}</div>
      <div class="muted">
        Date : <strong>${escapeHtml(dv.date_devis)}</strong><br/>
        Validité : <strong>${escapeHtml(dv.date_validite || '15 jours')}</strong><br/>
        Statut : <strong>${escapeHtml(dv.statut)}</strong>
        ${dv.vendeur_nom ? `<br/>Commercial : ${escapeHtml(dv.vendeur_nom)}` : ''}
      </div>
    </div>
  </div>

  <div class="client-box">
    <div style="font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:4px;">Client destinataire</div>
    <div style="font-size:14px;font-weight:700;">${escapeHtml(dv.client_nom)} ${dv.client_code ? `(${escapeHtml(dv.client_code)})` : ''}</div>
    <div class="muted">
      ${dv.client_adresse ? `${escapeHtml(dv.client_adresse)}<br/>` : ''}
      ${dv.client_tel ? `Tél: ${escapeHtml(dv.client_tel)}` : ''}${dv.client_email ? ` · ${escapeHtml(dv.client_email)}` : ''}
      ${[dv.client_nif ? `NIF: ${escapeHtml(dv.client_nif)}` : '', dv.client_nis ? `NIS: ${escapeHtml(dv.client_nis)}` : '', dv.client_nrc ? `RC: ${escapeHtml(dv.client_nrc)}` : ''].filter(Boolean).join(' · ')}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:36px;text-align:center;">#</th>
        <th>Désignation</th>
        <th style="text-align:right;">Qté</th>
        <th style="text-align:right;">P.U (${escapeHtml(devise)})</th>
        <th style="text-align:right;">Remise</th>
        <th style="text-align:center;">TVA</th>
        <th style="text-align:right;">Total TTC</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Total HT</span><span>${dv.total_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${escapeHtml(devise)}</span></div>
    <div class="totals-row"><span>Total TVA</span><span>${dv.tva_total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${escapeHtml(devise)}</span></div>
    ${(dv.remise_montant ?? dv.remise ?? 0) > 0 ? `<div class="totals-row"><span>Remise globale${dv.remise_motif ? ` (${escapeHtml(dv.remise_motif)})` : ''}</span><span>- ${(dv.remise_montant ?? dv.remise ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${escapeHtml(devise)}</span></div>` : ''}
    <div class="totals-row ttc"><span>NET À PAYER TTC</span><span>${dv.total_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${escapeHtml(devise)}</span></div>
  </div>

  ${dv.observations ? `<div style="margin-top:14px;font-size:12px;"><strong>Observations :</strong> ${escapeHtml(dv.observations)}</div>` : ''}

  <div class="footer">
    ${escapeHtml(p?.pied_page || 'Offre valable sous réserve de disponibilité du stock.')}
  </div>
</body>
</html>`;
  };

  const filtered = devisList.filter((d) => {
    const matchStatut = statutFilter === 'Tous' || d.statut === statutFilter;
    const q = search.trim().toLowerCase();
    const matchQ =
      !q ||
      d.numero.toLowerCase().includes(q) ||
      d.client_nom.toLowerCase().includes(q) ||
      (d.bon_vente_numero || '').toLowerCase().includes(q);
    return matchStatut && matchQ;
  });

  const totalDevis = devisList.length;
  const totalMontant = devisList.reduce((acc, d) => acc + d.total_ttc, 0);
  const enAttente = devisList.filter(
    (d) =>
      d.statut === 'Brouillon' ||
      d.statut === 'Envoyé' ||
      d.statut === 'Accepté'
  );
  const convertis = devisList.filter((d) => d.statut === 'Converti');
  const modalTotals = computeModalTotals();

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h2 className="page-title">📝 Devis & Factures Proforma</h2>
          <p className="page-subtitle">
            Profil d’impression actif :{' '}
            <strong>{profilDoc?.nom || 'Profil par défaut'}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-muted"
            onClick={() => {
              const csv = [
                'Numero;Date;Validite;Client;Statut;HT;TVA;Remise;TTC;Bon_Vente',
                ...filtered.map(
                  (d) =>
                    `${d.numero};${d.date_devis};${d.date_validite || ''};"${d.client_nom.replace(/"/g, '""')}";${d.statut};${d.total_ht};${d.tva_total};${d.remise_montant ?? d.remise ?? 0};${d.total_ttc};${d.bon_vente_numero || ''}`
                ),
              ].join('\n');
              downloadTextFile(
                csv,
                'devis_proforma.csv',
                'text/csv;charset=utf-8'
              );
            }}
          >
            📥 Exporter CSV
          </button>
          <button className="btn" onClick={openNewDevis}>
            + Nouveau Devis
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`alert-box no-print ${
            banner.type === 'success' ? 'alert-success' : 'alert-error'
          }`}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span>{banner.text}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {banner.type === 'success' &&
              banner.text.includes('Bon de Vente') &&
              onNavigate && (
                <button
                  className="btn btn-muted"
                  onClick={() => onNavigate('bons_vente')}
                >
                  🏷️ Voir les Bons de Vente
                </button>
              )}
            <button className="btn btn-muted" onClick={() => setBanner(null)}>
              ✕
            </button>
          </div>
        </div>
      )}

      {error && <div className="alert-box alert-error no-print">{error}</div>}

      <div className="kpi-grid no-print">
        <div className="card">
          <div className="kpi-label">Total Devis</div>
          <div className="kpi-value">{totalDevis}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {fmtDA(totalMontant)}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">En cours / Acceptés</div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>
            {enAttente.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {fmtDA(enAttente.reduce((a, d) => a + d.total_ttc, 0))}
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">Convertis en Bon de Vente</div>
          <div className="kpi-value" style={{ color: 'var(--green)' }}>
            {convertis.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {totalDevis > 0
              ? `Taux : ${Math.round((convertis.length / totalDevis) * 100)}%`
              : '0%'}
          </div>
        </div>
      </div>

      <div className="toolbar no-print">
        <input
          className="input"
          style={{ minWidth: 260, flex: 1 }}
          placeholder="🔍 Rechercher N° devis, client, N° bon de vente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(
            ['Tous', 'Brouillon', 'Envoyé', 'Accepté', 'Refusé', 'Converti'] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              className={`btn ${statutFilter === st ? '' : 'btn-muted'}`}
              onClick={() => setStatutFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap no-print">
        {loading ? (
          <div
            style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}
          >
            Chargement des devis...
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Date / Validité</th>
                <th>Client</th>
                <th>Lignes</th>
                <th>HT</th>
                <th>TVA</th>
                <th>Remise</th>
                <th>Total TTC</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      textAlign: 'center',
                      padding: 24,
                      color: 'var(--muted)',
                    }}
                  >
                    Aucun devis trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((dv) => {
                  const isConverti =
                    dv.statut === 'Converti' || dv.bon_vente_id != null;
                  const isExpired =
                    !isConverti &&
                    dv.statut !== 'Refusé' &&
                    !!dv.date_validite &&
                    dv.date_validite < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={dv.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{dv.numero}</div>
                        {dv.bon_vente_numero && (
                          <div style={{ fontSize: 11, color: 'var(--green)' }}>
                            → {dv.bon_vente_numero}
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{dv.date_devis}</div>
                        {dv.date_validite && (
                          <div
                            style={{
                              fontSize: 11,
                              color: isExpired ? 'var(--red)' : 'var(--muted)',
                            }}
                          >
                            Val. {dv.date_validite}
                            {isExpired ? ' (Expiré)' : ''}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{dv.client_nom}</div>
                        {dv.vendeur_nom && (
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            Vendeur : {dv.vendeur_nom}
                          </div>
                        )}
                      </td>
                      <td>{dv.lignes?.length || 0} art.</td>
                      <td>{fmtDA(dv.total_ht)}</td>
                      <td>{fmtDA(dv.tva_total)}</td>
                      <td>{fmtDA(dv.remise_montant ?? dv.remise ?? 0)}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDA(dv.total_ttc)}</td>
                      <td>
                        {isConverti ? (
                          <span className={`badge ${STATUT_BADGE_CLASS.Converti}`}>
                            Converti
                          </span>
                        ) : (
                          <select
                            className="select"
                            value={dv.statut}
                            onChange={(e) =>
                              handleQuickStatut(dv, e.target.value as StatutDevis)
                            }
                            style={{ padding: '4px 8px', fontSize: 11 }}
                          >
                            <option value="Brouillon">Brouillon</option>
                            <option value="Envoyé">Envoyé</option>
                            <option value="Accepté">Accepté</option>
                            <option value="Refusé">Refusé</option>
                          </select>
                        )}
                      </td>
                      <td>
                        <div
                          style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}
                        >
                          <button
                            className="btn btn-muted"
                            style={{ padding: '5px 9px', fontSize: 11 }}
                            title="Aperçu Proforma / PDF"
                            onClick={() => setPreviewDevis(dv)}
                          >
                            🖨 PDF
                          </button>
                          {!isConverti && (
                            <>
                              <button
                                className="btn btn-muted"
                                style={{ padding: '5px 9px', fontSize: 11 }}
                                title="Modifier le devis"
                                onClick={() => openEditDevis(dv)}
                              >
                                ✏
                              </button>
                              {dv.statut !== 'Refusé' && (
                                <button
                                  className="btn btn-green"
                                  style={{ padding: '5px 9px', fontSize: 11 }}
                                  title="Convertir en Bon de Vente"
                                  onClick={() => openConvertModal(dv)}
                                >
                                  🔄 Convertir en Bon de Vente
                                </button>
                              )}
                              {confirmDeleteId === dv.id ? (
                                <>
                                  <button
                                    className="btn btn-red"
                                    style={{ padding: '5px 9px', fontSize: 11 }}
                                    onClick={() => handleDeleteDevis(dv.id)}
                                  >
                                    Confirmer
                                  </button>
                                  <button
                                    className="btn btn-muted"
                                    style={{ padding: '5px 9px', fontSize: 11 }}
                                    onClick={() => setConfirmDeleteId(null)}
                                  >
                                    Non
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="btn btn-red"
                                  style={{ padding: '5px 9px', fontSize: 11 }}
                                  title="Supprimer"
                                  onClick={() => setConfirmDeleteId(dv.id)}
                                >
                                  🗑
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── MODAL CRÉATION / ÉDITION DEVIS ── */}
      {modalOpen && (
        <div className="modal-backdrop no-print">
          <div className="modal-panel" style={{ maxWidth: 880 }}>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>
              {editingId
                ? 'Modifier le Devis'
                : 'Nouveau Devis / Facture Proforma'}
            </h3>
            <form onSubmit={handleSaveDevis}>
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="form-field">
                  <label>Client *</label>
                  <select
                    className="select"
                    value={formClientId}
                    onChange={(e) => {
                      const nextCid = Number(e.target.value);
                      setFormClientId(nextCid);
                      setFormLignes((prev) =>
                        prev.map((ln) => {
                          const pr = produits.find(
                            (p) => p.id === ln.produit_id
                          );
                          return pr
                            ? {
                                ...ln,
                                prix_unitaire: prixParNiveau(
                                  pr,
                                  ln.niveau_prix || 'client',
                                  nextCid
                                ),
                              }
                            : ln;
                        })
                      );
                    }}
                  >
                    <option value={0}>-- Choisir un client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom} ({c.code}) —{' '}
                        {(c.niveau_prix || 'detail').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Commercial / Vendeur (optionnel)</label>
                  <select
                    className="select"
                    value={formVendeurId}
                    onChange={(e) => setFormVendeurId(e.target.value)}
                  >
                    <option value="">-- Aucun / Bureau --</option>
                    {vendeurs.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nom} ({v.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className="form-grid"
                style={{
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  marginBottom: 14,
                }}
              >
                <div className="form-field">
                  <label>Date Devis</label>
                  <input
                    className="input"
                    type="date"
                    value={formDateDevis}
                    onChange={(e) => setFormDateDevis(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Date Validité</label>
                  <input
                    className="input"
                    type="date"
                    value={formDateValidite}
                    onChange={(e) => setFormDateValidite(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Statut</label>
                  <select
                    className="select"
                    value={formStatut}
                    onChange={(e) =>
                      setFormStatut(e.target.value as StatutDevis)
                    }
                  >
                    <option value="Brouillon">Brouillon</option>
                    <option value="Envoyé">Envoyé</option>
                    <option value="Accepté">Accepté</option>
                    <option value="Refusé">Refusé</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <strong style={{ fontSize: 13 }}>Lignes du Devis</strong>
                  <button
                    type="button"
                    className="btn btn-muted"
                    style={{ padding: '5px 10px', fontSize: 11 }}
                    onClick={() => {
                      const pr = produits[0];
                      if (!pr) return;
                      setFormLignes([
                        ...formLignes,
                        {
                          produit_id: pr.id,
                          quantite: 1,
                          prix_unitaire: prixPourClientEtProduit(
                            formClientId,
                            pr
                          ),
                          remise: 0,
                          niveau_prix: 'client',
                        },
                      ]);
                    }}
                  >
                    + Ajouter ligne
                  </button>
                </div>

                {formLignes.map((l, idx) => {
                  const lineTotal = Math.max(
                    0,
                    l.quantite * l.prix_unitaire - (l.remise || 0)
                  );
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          '2.2fr 1.1fr 0.8fr 1fr 0.8fr 1fr auto',
                        gap: 6,
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <select
                        className="select"
                        value={l.produit_id}
                        onChange={(e) => {
                          const pid = Number(e.target.value);
                          const pr = produits.find((p) => p.id === pid);
                          const copy = [...formLignes];
                          copy[idx] = {
                            ...copy[idx],
                            produit_id: pid,
                            prix_unitaire: pr
                              ? prixParNiveau(
                                  pr,
                                  copy[idx].niveau_prix || 'client',
                                  formClientId
                                )
                              : 0,
                          };
                          setFormLignes(copy);
                        }}
                      >
                        {produits.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.designation} (Stock: {p.stock_actuel})
                          </option>
                        ))}
                      </select>

                      <select
                        className="select"
                        value={l.niveau_prix || 'client'}
                        onChange={(e) => {
                          const niv = e.target.value;
                          const pr = produits.find(
                            (p) => p.id === l.produit_id
                          );
                          const copy = [...formLignes];
                          copy[idx] = {
                            ...copy[idx],
                            niveau_prix: niv,
                            prix_unitaire: pr
                              ? prixParNiveau(pr, niv, formClientId)
                              : copy[idx].prix_unitaire,
                          };
                          setFormLignes(copy);
                        }}
                      >
                        <option value="client">Tarif Client</option>
                        <option value="detail">Détail</option>
                        <option value="gros">Gros</option>
                        <option value="super_gros">Super Gros</option>
                        <option value="special">Spécial</option>
                      </select>

                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Qté"
                        value={l.quantite}
                        onChange={(e) => {
                          const copy = [...formLignes];
                          copy[idx].quantite = Number(e.target.value);
                          setFormLignes(copy);
                        }}
                      />

                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="P.U."
                        value={l.prix_unitaire}
                        onChange={(e) => {
                          const copy = [...formLignes];
                          copy[idx].prix_unitaire = Number(e.target.value);
                          setFormLignes(copy);
                        }}
                      />

                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Remise"
                        value={l.remise}
                        onChange={(e) => {
                          const copy = [...formLignes];
                          copy[idx].remise = Number(e.target.value);
                          setFormLignes(copy);
                        }}
                      />

                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 12,
                          textAlign: 'right',
                        }}
                      >
                        {fmtDA(lineTotal)}
                      </div>

                      <button
                        type="button"
                        className="btn btn-red"
                        style={{ padding: '5px 8px', fontSize: 11 }}
                        onClick={() =>
                          setFormLignes(formLignes.filter((_, i) => i !== idx))
                        }
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="form-field">
                  <label>Remise Globale</label>
                  <select
                    className="select"
                    value={formRemiseType}
                    onChange={(e) =>
                      setFormRemiseType(
                        e.target.value as 'aucune' | 'pourcentage' | 'montant'
                      )
                    }
                  >
                    <option value="aucune">Aucune remise</option>
                    <option value="pourcentage">Pourcentage (%)</option>
                    <option value="montant">Montant fixe (DA)</option>
                  </select>
                </div>
                {formRemiseType !== 'aucune' && (
                  <div className="form-field">
                    <label>
                      Valeur ({formRemiseType === 'pourcentage' ? '%' : 'DA'})
                    </label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formRemiseValeur}
                      onChange={(e) => setFormRemiseValeur(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {formRemiseType !== 'aucune' && (
                <div className="form-field" style={{ marginBottom: 12 }}>
                  <label>Motif remise</label>
                  <input
                    className="input"
                    value={formRemiseMotif}
                    onChange={(e) => setFormRemiseMotif(e.target.value)}
                    placeholder="Remise commerciale..."
                  />
                </div>
              )}

              <div className="form-field" style={{ marginBottom: 14 }}>
                <label>Observations / Conditions</label>
                <textarea
                  className="input"
                  rows={2}
                  value={formObservations}
                  onChange={(e) => setFormObservations(e.target.value)}
                  placeholder="Délai de livraison, conditions de règlement..."
                />
              </div>

              <div
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                <span>
                  Brut TTC : <strong>{fmtDA(modalTotals.brutTTC)}</strong>
                </span>
                <span>
                  Remise : <strong>- {fmtDA(modalTotals.remiseMontant)}</strong>
                </span>
                <span>
                  Total HT : <strong>{fmtDA(modalTotals.totalHT)}</strong>
                </span>
                <span>
                  TVA : <strong>{fmtDA(modalTotals.totalTVA)}</strong>
                </span>
                <span style={{ color: 'var(--accent)', fontSize: 15 }}>
                  Net TTC : <strong>{fmtDA(modalTotals.totalTTC)}</strong>
                </span>
              </div>

              <div
                style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
              >
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setModalOpen(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving
                    ? 'Enregistrement...'
                    : editingId
                    ? 'Enregistrer les modifications'
                    : 'Créer le Devis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONVERSION EN 1 CLIC ── */}
      {convertTarget && (
        <div className="modal-backdrop no-print">
          <div className="modal-panel" style={{ maxWidth: 520 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>
              🔄 Convertir en Bon de Vente Validé
            </h3>
            <p
              style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}
            >
              Le devis <strong>{convertTarget.numero}</strong> pour{' '}
              <strong>{convertTarget.client_nom}</strong> (
              <strong>{fmtDA(convertTarget.total_ttc)}</strong>) va être
              transformé en Bon de Vente validé :
            </p>
            <ul
              style={{
                fontSize: 12,
                color: 'var(--muted)',
                paddingLeft: 18,
                marginBottom: 14,
                lineHeight: 1.6,
              }}
            >
              <li>
                Déduction immédiate du stock pour les{' '}
                {convertTarget.lignes.length} lignes
              </li>
              <li>Création des mouvements de stock (VENTE)</li>
              <li>Mise à jour du solde client (hors client comptoir)</li>
              <li>
                Verrouillage du devis en statut « Converti » (non reconvertible)
              </li>
            </ul>
            <form onSubmit={handleConvertDevis}>
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="form-field">
                  <label>Date du Bon de Vente</label>
                  <input
                    className="input"
                    type="date"
                    value={convertDateBon}
                    onChange={(e) => setConvertDateBon(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Mode de règlement</label>
                  <select
                    className="select"
                    value={convertMode}
                    onChange={(e) => setConvertMode(e.target.value)}
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Virement">Virement</option>
                    <option value="À terme">À terme</option>
                  </select>
                </div>
              </div>
              <div className="form-field" style={{ marginBottom: 12 }}>
                <label>
                  Acompte / Montant versé à la conversion (max{' '}
                  {fmtDA(convertTarget.total_ttc)})
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  max={convertTarget.total_ttc}
                  value={convertVerse}
                  onChange={(e) => setConvertVerse(e.target.value)}
                />
              </div>
              {(() => {
                const cl = clients.find((c) => c.id === convertTarget.client_id);
                const plafond = Number(cl?.plafond_credit || 0);
                if (!cl || cl.code === 'CLT-COMPTOIR' || plafond <= 0) return null;
                const reste = Math.max(
                  0,
                  Number(
                    (
                      convertTarget.total_ttc -
                      Math.min(convertTarget.total_ttc, Math.max(0, Number(convertVerse || 0)))
                    ).toFixed(2)
                  )
                );
                const soldeProjete = Number((Number(cl.solde || 0) + reste).toFixed(2));
                if (soldeProjete <= plafond) return null;
                const bloquant = Boolean(cl.bloquer_si_depasse) && reste > 0;
                return (
                  <div className={`alert-box ${bloquant ? 'alert-error' : 'alert-warn'}`}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {bloquant
                        ? '🚫 Plafond de crédit dépassé (conversion bloquée)'
                        : '⚠️ Plafond de crédit dépassé'}
                    </div>
                    <div style={{ fontSize: 12 }}>
                      Solde projeté : <strong>{fmtDA(soldeProjete)}</strong> &gt; Plafond :{' '}
                      <strong>{fmtDA(plafond)}</strong>
                    </div>
                    {bloquant && userRole === 'admin' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, cursor: 'pointer', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={convertForcerPlafond}
                          onChange={(e) => setConvertForcerPlafond(e.target.checked)}
                        />
                        🔓 Forcer la conversion malgré le dépassement (Admin)
                      </label>
                    )}
                  </div>
                );
              })()}
              <div
                style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
              >
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setConvertTarget(null)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-green"
                  disabled={converting}
                >
                  {converting
                    ? 'Conversion en cours...'
                    : 'Confirmer la conversion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL APERÇU PROFORMA & IMPRESSION PDF/HTML ── */}
      {previewDevis && (
        <div className="modal-backdrop devis-print-backdrop">
          <div
            className="modal-panel devis-print-modal"
            style={{ maxWidth: 880 }}
          >
            <div
              className="no-print"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <strong style={{ fontSize: 15 }}>
                Aperçu Facture Proforma — {previewDevis.numero}
              </strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() =>
                    downloadTextFile(
                      buildProformaHtml(previewDevis),
                      `${previewDevis.numero}_Proforma.html`,
                      'text/html;charset=utf-8'
                    )
                  }
                >
                  📄 Télécharger HTML
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => window.print()}
                >
                  🖨 Imprimer / Enregistrer PDF
                </button>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setPreviewDevis(null)}
                >
                  Fermer
                </button>
              </div>
            </div>

            <div className="devis-print-sheet">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 20,
                  borderBottom: '2px solid #1e293b',
                  paddingBottom: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  {safeImageSrc(profilDoc?.logo_data) && (
                    <img
                      src={safeImageSrc(profilDoc?.logo_data)!}
                      alt="Logo"
                      style={{ maxHeight: 54, marginBottom: 6 }}
                    />
                  )}
                  <h2
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: 19,
                      color: '#0f172a',
                    }}
                  >
                    {profilDoc?.forme_juridique
                      ? `${profilDoc.forme_juridique} `
                      : ''}
                    {profilDoc?.nom || 'Entreprise'}
                  </h2>
                  <div
                    style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}
                  >
                    {profilDoc?.activite && <div>{profilDoc.activite}</div>}
                    {(profilDoc?.adresse || profilDoc?.ville) && (
                      <div>
                        {profilDoc?.adresse}
                        {profilDoc?.ville ? ` — ${profilDoc.ville}` : ''}
                        {profilDoc?.code_postal
                          ? ` (${profilDoc.code_postal})`
                          : ''}
                      </div>
                    )}
                    {(profilDoc?.telephone || profilDoc?.email) && (
                      <div>
                        {profilDoc?.telephone
                          ? `Tél: ${profilDoc.telephone}`
                          : ''}
                        {profilDoc?.email ? ` · Email: ${profilDoc.email}` : ''}
                      </div>
                    )}
                    <div>
                      {[
                        profilDoc?.nif ? `NIF: ${profilDoc.nif}` : '',
                        profilDoc?.nis ? `NIS: ${profilDoc.nis}` : '',
                        profilDoc?.registre_commerce || profilDoc?.nrc
                          ? `RC: ${profilDoc.registre_commerce || profilDoc.nrc}`
                          : '',
                        profilDoc?.art_imp ? `AI: ${profilDoc.art_imp}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {(profilDoc?.banque || profilDoc?.rib) && (
                      <div>
                        {profilDoc?.banque
                          ? `Banque: ${profilDoc.banque} `
                          : ''}
                        {profilDoc?.rib ? `RIB: ${profilDoc.rib}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 220 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#1d4ed8',
                    }}
                  >
                    FACTURE PROFORMA / DEVIS
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      margin: '6px 0',
                      color: '#0f172a',
                    }}
                  >
                    N° {previewDevis.numero}
                  </div>
                  <div
                    style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}
                  >
                    <div>
                      Date : <strong>{previewDevis.date_devis}</strong>
                    </div>
                    <div>
                      Validité :{' '}
                      <strong>
                        {previewDevis.date_validite || '15 jours'}
                      </strong>
                    </div>
                    <div>
                      Statut : <strong>{previewDevis.statut}</strong>
                    </div>
                    {previewDevis.vendeur_nom && (
                      <div>Commercial : {previewDevis.vendeur_nom}</div>
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '10px 14px',
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    color: '#64748b',
                    fontWeight: 700,
                    marginBottom: 3,
                  }}
                >
                  Client destinataire
                </div>
                <div
                  style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}
                >
                  {previewDevis.client_nom}{' '}
                  {previewDevis.client_code
                    ? `(${previewDevis.client_code})`
                    : ''}
                </div>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  {previewDevis.client_adresse && (
                    <span>{previewDevis.client_adresse} · </span>
                  )}
                  {previewDevis.client_tel && (
                    <span>Tél: {previewDevis.client_tel} </span>
                  )}
                  {previewDevis.client_nif && (
                    <span>· NIF: {previewDevis.client_nif}</span>
                  )}
                </div>
              </div>

              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: 14,
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ background: '#1e293b', color: '#ffffff' }}>
                    <th
                      style={{
                        padding: '7px 8px',
                        textAlign: 'center',
                        background: '#1e293b',
                        color: '#ffffff',
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        padding: '7px 8px',
                        background: '#1e293b',
                        color: '#ffffff',
                      }}
                    >
                      Désignation
                    </th>
                    <th
                      style={{
                        padding: '7px 8px',
                        textAlign: 'right',
                        background: '#1e293b',
                        color: '#ffffff',
                      }}
                    >
                      Qté
                    </th>
                    <th
                      style={{
                        padding: '7px 8px',
                        textAlign: 'right',
                        background: '#1e293b',
                        color: '#ffffff',
                      }}
                    >
                      P.U
                    </th>
                    <th
                      style={{
                        padding: '7px 8px',
                        textAlign: 'right',
                        background: '#1e293b',
                        color: '#ffffff',
                      }}
                    >
                      Remise
                    </th>
                    <th
                      style={{
                        padding: '7px 8px',
                        textAlign: 'center',
                        background: '#1e293b',
                        color: '#ffffff',
                      }}
                    >
                      TVA
                    </th>
                    <th
                      style={{
                        padding: '7px 8px',
                        textAlign: 'right',
                        background: '#1e293b',
                        color: '#ffffff',
                      }}
                    >
                      Total TTC
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(previewDevis.lignes || []).map((l, idx) => (
                    <tr
                      key={l.id}
                      style={{ borderBottom: '1px solid #e2e8f0' }}
                    >
                      <td
                        style={{
                          padding: '7px 8px',
                          textAlign: 'center',
                          color: '#111827',
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td style={{ padding: '7px 8px', color: '#111827' }}>
                        {l.designation}
                      </td>
                      <td
                        style={{
                          padding: '7px 8px',
                          textAlign: 'right',
                          color: '#111827',
                        }}
                      >
                        {l.quantite}
                      </td>
                      <td
                        style={{
                          padding: '7px 8px',
                          textAlign: 'right',
                          color: '#111827',
                        }}
                      >
                        {fmtDA(l.prix_unitaire)}
                      </td>
                      <td
                        style={{
                          padding: '7px 8px',
                          textAlign: 'right',
                          color: '#111827',
                        }}
                      >
                        {fmtDA(l.remise || 0)}
                      </td>
                      <td
                        style={{
                          padding: '7px 8px',
                          textAlign: 'center',
                          color: '#111827',
                        }}
                      >
                        {l.tva_taux}%
                      </td>
                      <td
                        style={{
                          padding: '7px 8px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#111827',
                        }}
                      >
                        {fmtDA(l.total_ttc)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div
                style={{
                  width: 300,
                  marginLeft: 'auto',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  overflow: 'hidden',
                  fontSize: 13,
                  color: '#111827',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <span>Total HT</span>
                  <span>{fmtDA(previewDevis.total_ht)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <span>Total TVA</span>
                  <span>{fmtDA(previewDevis.tva_total)}</span>
                </div>
                {(previewDevis.remise_montant ?? previewDevis.remise ?? 0) >
                  0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <span>Remise globale</span>
                    <span>
                      -{' '}
                      {fmtDA(
                        previewDevis.remise_montant ?? previewDevis.remise ?? 0
                      )}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#eff6ff',
                    color: '#1e3a8a',
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  <span>NET À PAYER TTC</span>
                  <span>{fmtDA(previewDevis.total_ttc)}</span>
                </div>
              </div>

              {previewDevis.observations && (
                <div style={{ marginTop: 12, fontSize: 12, color: '#334155' }}>
                  <strong>Observations :</strong> {previewDevis.observations}
                </div>
              )}

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 10,
                  borderTop: '1px solid #cbd5e1',
                  textAlign: 'center',
                  fontSize: 11,
                  color: '#64748b',
                }}
              >
                {profilDoc?.pied_page ||
                  'Offre valable sous réserve de disponibilité du stock.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
