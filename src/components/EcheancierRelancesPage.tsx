import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, fmtDA } from '../api.ts';

export interface EcheancierItem {
  uid: string;
  doc_type: 'facture' | 'bon_vente';
  doc_id: number;
  numero: string;
  bon_numero: string | null;
  facture_numero: string | null;
  date_emission: string;
  date_echeance: string;
  echeance_source: 'facture' | 'bon' | 'defaut_30j';
  jours_retard: number;
  jours_restants: number;
  niveau_retard: 'en_retard' | 'proche' | 'a_venir';
  total_ttc: number;
  montant_verse: number;
  reste_payer: number;
  statut: string;
  client_id: number;
  client_code: string;
  client_nom: string;
  client_tel: string;
  client_email: string;
  vendeur_id: number | null;
  vendeur_nom: string | null;
  nb_relances: number;
  derniere_relance: {
    date_action: string;
    utilisateur: string;
    details: string | null;
  } | null;
}

interface EcheancierResponse {
  items: EcheancierItem[];
  kpis: {
    total_creances: number;
    montant_en_retard: number;
    nb_clients_en_retard: number;
    montant_proche_7j: number;
    nb_documents: number;
    nb_en_retard: number;
    nb_proche_7j: number;
    nb_a_venir: number;
  };
  kpis_globaux: {
    total_creances: number;
    montant_en_retard: number;
    nb_clients_en_retard: number;
    montant_proche_7j: number;
    nb_documents: number;
    nb_en_retard: number;
    nb_proche_7j: number;
    nb_a_venir: number;
  };
  referentiels: {
    clients: { id: number; code: string; nom: string; tel: string; email: string }[];
    vendeurs: { id: number; code: string; nom: string }[];
    profil_nom: string;
    profil_tel: string;
    profil_email: string;
  };
}

function buildRelanceTemplate(
  item: EcheancierItem,
  canal: 'whatsapp' | 'email',
  societeNom: string,
  societeTel: string
): { objet: string; message: string } {
  const docLabel = item.doc_type === 'facture' ? 'la facture' : 'le bon de vente';
  const docRef =
    item.doc_type === 'facture' && item.bon_numero
      ? `${item.numero} (Bon ${item.bon_numero})`
      : item.numero;
  const retardPart =
    item.jours_retard > 0
      ? `échue depuis le ${item.date_echeance} (${item.jours_retard} jour(s) de retard)`
      : `à échéance le ${item.date_echeance}`;

  const objet =
    item.jours_retard > 0
      ? `Relance de règlement — ${item.numero} (${item.jours_retard} j de retard)`
      : `Rappel d'échéance — ${item.numero} (${item.date_echeance})`;

  if (canal === 'whatsapp') {
    const msg = [
      `Bonjour *${item.client_nom}*,`,
      ``,
      `Sauf erreur ou règlement intervenu entre-temps, nous nous permettons de vous rappeler que ${docLabel} *${docRef}* d'un montant total de ${fmtDA(
        item.total_ttc
      )} est ${retardPart}.`,
      ``,
      `💰 *Reste à payer : ${fmtDA(item.reste_payer)}*`,
      ``,
      `Merci de bien vouloir procéder au règlement dans les meilleurs délais ou de nous confirmer la date prévue de paiement.`,
      ``,
      `Cordialement,`,
      `*${societeNom}*${societeTel ? ` — ${societeTel}` : ''}`,
    ].join('\n');
    return { objet, message: msg };
  }

  const msg = [
    `Madame, Monsieur (${item.client_nom}),`,
    ``,
    `Sauf erreur ou omission de notre part, et sauf règlement intervenu depuis l'édition de ce relevé, nous constatons que ${docLabel} ${docRef}, émise le ${item.date_emission} et ${retardPart}, demeure à ce jour partiellement ou totalement impayée.`,
    ``,
    `Récapitulatif :`,
    `- Document : ${docRef}`,
    `- Montant TTC : ${fmtDA(item.total_ttc)}`,
    `- Déjà réglé : ${fmtDA(item.montant_verse)}`,
    `- Reste à payer : ${fmtDA(item.reste_payer)}`,
    ``,
    `Nous vous remercions par avance de bien vouloir régulariser cette situation dans les plus brefs délais, ou de nous transmettre votre justificatif de règlement en réponse à ce message.`,
    ``,
    `Restant à votre disposition pour tout renseignement complémentaire,`,
    ``,
    `Service Comptabilité & Recouvrement`,
    `${societeNom}${societeTel ? `\nTél : ${societeTel}` : ''}`,
  ].join('\n');

  return { objet, message: msg };
}

function normalizePhoneForWa(tel: string): string {
  const digits = (tel || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('0') && digits.length === 10) {
    return `213${digits.slice(1)}`;
  }
  return digits.replace(/\D/g, '');
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function EcheancierRelancesPanel({
  token,
  userRole,
  standaloneTitle = false,
}: {
  token: string;
  userRole?: string;
  standaloneTitle?: boolean;
}) {
  const [data, setData] = useState<EcheancierResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Filtres
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<number>(0);
  const [vendeurFilter, setVendeurFilter] = useState<number>(0);
  const [niveauFilter, setNiveauFilter] = useState<string>('tous');

  // Modale relance
  const [relanceTarget, setRelanceTarget] = useState<EcheancierItem | null>(null);
  const [relanceCanal, setRelanceCanal] = useState<'whatsapp' | 'email'>('whatsapp');
  const [relanceDest, setRelanceDest] = useState('');
  const [relanceObjet, setRelanceObjet] = useState('');
  const [relanceMsg, setRelanceMsg] = useState('');
  const [relanceStatus, setRelanceStatus] = useState<string | null>(null);
  const [relanceBusy, setRelanceBusy] = useState(false);

  // Édition rapide d'échéance
  const [editEchItem, setEditEchItem] = useState<EcheancierItem | null>(null);
  const [editEchDate, setEditEchDate] = useState('');

  const isReadOnly = userRole === 'lecture_seule';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<EcheancierResponse>('/api/bureau/echeancier', {
        token,
      });
      setData(res);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erreur lors du chargement de l'échéancier"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const filteredItems = useMemo(() => {
    const items = data?.items || [];
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (clientFilter && i.client_id !== clientFilter) return false;
      if (vendeurFilter && i.vendeur_id !== vendeurFilter) return false;
      if (niveauFilter !== 'tous' && i.niveau_retard !== niveauFilter) return false;
      if (
        q &&
        !i.numero.toLowerCase().includes(q) &&
        !(i.bon_numero || '').toLowerCase().includes(q) &&
        !i.client_nom.toLowerCase().includes(q) &&
        !i.client_code.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data, search, clientFilter, vendeurFilter, niveauFilter]);

  const kpis = useMemo(() => {
    const enRetard = filteredItems.filter((i) => i.niveau_retard === 'en_retard');
    const proches = filteredItems.filter((i) => i.niveau_retard === 'proche');
    return {
      total_creances: filteredItems.reduce((acc, i) => acc + i.reste_payer, 0),
      montant_en_retard: enRetard.reduce((acc, i) => acc + i.reste_payer, 0),
      nb_clients_en_retard: new Set(enRetard.map((i) => i.client_id)).size,
      montant_proche_7j: proches.reduce((acc, i) => acc + i.reste_payer, 0),
      nb_en_retard: enRetard.length,
      nb_proche_7j: proches.length,
    };
  }, [filteredItems]);

  const openRelanceModal = (
    item: EcheancierItem,
    canal: 'whatsapp' | 'email' = 'whatsapp'
  ) => {
    const societe = data?.referentiels.profil_nom || 'Notre Société';
    const societeTel = data?.referentiels.profil_tel || '';
    const tpl = buildRelanceTemplate(item, canal, societe, societeTel);
    setRelanceTarget(item);
    setRelanceCanal(canal);
    setRelanceDest(canal === 'whatsapp' ? item.client_tel : item.client_email);
    setRelanceObjet(tpl.objet);
    setRelanceMsg(tpl.message);
    setRelanceStatus(null);
  };

  const switchCanal = (canal: 'whatsapp' | 'email') => {
    if (!relanceTarget) return;
    const societe = data?.referentiels.profil_nom || 'Notre Société';
    const societeTel = data?.referentiels.profil_tel || '';
    const tpl = buildRelanceTemplate(relanceTarget, canal, societe, societeTel);
    setRelanceCanal(canal);
    setRelanceDest(
      canal === 'whatsapp' ? relanceTarget.client_tel : relanceTarget.client_email
    );
    setRelanceObjet(tpl.objet);
    setRelanceMsg(tpl.message);
    setRelanceStatus(null);
  };

  const recordRelanceAudit = async (canal: 'whatsapp' | 'email' | 'copie') => {
    if (!relanceTarget) return;
    await apiFetch('/api/bureau/echeancier/relance', {
      method: 'POST',
      token,
      body: JSON.stringify({
        doc_type: relanceTarget.doc_type,
        doc_id: relanceTarget.doc_id,
        canal,
        destinataire: relanceDest,
        objet: relanceCanal === 'email' ? relanceObjet : undefined,
        message: relanceMsg,
      }),
    });
  };

  const handleCopyAndAudit = async () => {
    if (!relanceTarget || !relanceMsg.trim()) return;
    setRelanceBusy(true);
    setRelanceStatus(null);
    try {
      const payloadText =
        relanceCanal === 'email'
          ? `À : ${relanceDest || '(email client)'}\nObjet : ${relanceObjet}\n\n${relanceMsg}`
          : relanceMsg;
      const copied = await copyToClipboard(payloadText);
      if (!isReadOnly) {
        await recordRelanceAudit(relanceCanal);
        await load();
      }
      setRelanceStatus(
        copied
          ? isReadOnly
            ? '✓ Message copié dans le presse-papiers.'
            : `✓ Message ${
                relanceCanal === 'whatsapp' ? 'WhatsApp' : 'Email'
              } copié et relance enregistrée dans le journal d'audit.`
          : '✓ Relance enregistrée dans le journal d’audit (sélectionnez le texte ci-dessus pour copier).'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur enregistrement relance');
    } finally {
      setRelanceBusy(false);
    }
  };

  const handleCopyWaLink = async () => {
    if (!relanceTarget || !relanceMsg.trim()) return;
    setRelanceBusy(true);
    setRelanceStatus(null);
    try {
      const phone = normalizePhoneForWa(relanceDest);
      const url = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(relanceMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(relanceMsg)}`;
      const copied = await copyToClipboard(url);
      if (!isReadOnly) {
        await recordRelanceAudit('whatsapp');
        await load();
      }
      setRelanceStatus(
        copied
          ? '✓ Lien WhatsApp prêt-à-envoyer copié et relance enregistrée dans le journal d’audit.'
          : '✓ Relance WhatsApp enregistrée dans le journal d’audit.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lien WhatsApp');
    } finally {
      setRelanceBusy(false);
    }
  };

  const handleAuditOnly = async () => {
    if (!relanceTarget || !relanceMsg.trim()) return;
    setRelanceBusy(true);
    setRelanceStatus(null);
    try {
      await recordRelanceAudit(relanceCanal);
      await load();
      setRelanceStatus(
        `✓ Relance ${
          relanceCanal === 'whatsapp' ? 'WhatsApp' : 'Email'
        } enregistrée dans le journal d'audit.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur enregistrement relance');
    } finally {
      setRelanceBusy(false);
    }
  };

  const saveEcheance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEchItem) return;
    setError(null);
    try {
      await apiFetch(
        `/api/bureau/echeancier/${editEchItem.doc_type}/${editEchItem.doc_id}/echeance`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({ date_echeance: editEchDate }),
        }
      );
      setMessage(`Échéance de ${editEchItem.numero} mise à jour au ${editEchDate}.`);
      setEditEchItem(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur mise à jour échéance');
    }
  };

  const exportCsv = () => {
    const header = [
      'Type',
      'Numéro',
      'Bon associé',
      'Client',
      'Vendeur',
      'Émission',
      'Échéance',
      'Jours retard',
      'Niveau',
      'Total TTC',
      'Versé',
      'Reste à payer',
      'Nb relances',
    ].join(';');
    const rows = filteredItems.map((i) =>
      [
        i.doc_type === 'facture' ? 'Facture' : 'Bon de Vente',
        i.numero,
        i.bon_numero || '',
        `"${i.client_nom.replace(/"/g, '""')}"`,
        `"${(i.vendeur_nom || '').replace(/"/g, '""')}"`,
        i.date_emission,
        i.date_echeance,
        i.jours_retard,
        i.niveau_retard === 'en_retard'
          ? 'En retard'
          : i.niveau_retard === 'proche'
          ? 'Échéance proche (<=7j)'
          : 'À venir',
        i.total_ttc,
        i.montant_verse,
        i.reste_payer,
        i.nb_relances,
      ].join(';')
    );
    const blob = new Blob([[header, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `echeancier_relances_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {standaloneTitle && (
        <div className="page-header">
          <div>
            <h2 className="page-title">📅 Échéancier &amp; Relances Clients</h2>
            <p className="page-subtitle">
              Suivi des factures et bons de vente non soldés, retards et relances WhatsApp / Email
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-muted" onClick={exportCsv}>
              📊 Export CSV
            </button>
            <button className="btn btn-muted" onClick={load}>
              🔄 Actualiser
            </button>
          </div>
        </div>
      )}

      {error && <div className="alert-box alert-error">{error}</div>}
      {message && <div className="alert-box alert-success">{message}</div>}

      {/* KPIs Échéancier */}
      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="kpi-label">Total Créances Ouvertes</div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>
            {fmtDA(kpis.total_creances)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            {filteredItems.length} document(s) non soldé(s)
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">Montant en Retard</div>
          <div className="kpi-value" style={{ color: 'var(--red)' }}>
            {fmtDA(kpis.montant_en_retard)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            {kpis.nb_en_retard} document(s) échu(s)
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">Clients en Retard</div>
          <div className="kpi-value" style={{ color: 'var(--orange)' }}>
            {kpis.nb_clients_en_retard}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Compte(s) à relancer
          </div>
        </div>

        <div className="card">
          <div className="kpi-label">Échéance Proche (≤ 7 j)</div>
          <div className="kpi-value" style={{ color: 'var(--orange)' }}>
            {fmtDA(kpis.montant_proche_7j)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            {kpis.nb_proche_7j} document(s) sous 7 jours
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="toolbar">
        <input
          className="input"
          style={{ width: 220 }}
          placeholder="Rechercher N° facture, bon, client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="select"
          value={clientFilter}
          onChange={(e) => setClientFilter(Number(e.target.value))}
        >
          <option value={0}>Tous les clients</option>
          {(data?.referentiels.clients || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom} ({c.code})
            </option>
          ))}
        </select>

        <select
          className="select"
          value={vendeurFilter}
          onChange={(e) => setVendeurFilter(Number(e.target.value))}
        >
          <option value={0}>Tous les vendeurs</option>
          {(data?.referentiels.vendeurs || []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.nom}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={niveauFilter}
          onChange={(e) => setNiveauFilter(e.target.value)}
        >
          <option value="tous">Tous les niveaux ({data?.items.length || 0})</option>
          <option value="en_retard">
            🔴 En retard ({data?.kpis_globaux.nb_en_retard || 0})
          </option>
          <option value="proche">
            🟠 Échéance proche ≤ 7 j ({data?.kpis_globaux.nb_proche_7j || 0})
          </option>
          <option value="a_venir">
            🟢 À venir ({data?.kpis_globaux.nb_a_venir || 0})
          </option>
        </select>

        {!standaloneTitle && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            <button className="btn btn-muted" onClick={exportCsv}>
              📊 Export CSV
            </button>
            <button className="btn btn-muted" onClick={load}>
              🔄 Actualiser
            </button>
          </div>
        )}
      </div>

      {loading && <div className="page-subtitle">Chargement de l'échéancier...</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Client</th>
              <th>Vendeur</th>
              <th>Émission</th>
              <th>Échéance</th>
              <th>Niveau / Retard</th>
              <th>Total TTC</th>
              <th>Reste à payer</th>
              <th>Relances</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const isOverdue = item.niveau_retard === 'en_retard';
              const isSoon = item.niveau_retard === 'proche';
              return (
                <tr key={item.uid}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        className={`badge ${
                          item.doc_type === 'facture' ? 'badge-blue' : 'badge-orange'
                        }`}
                      >
                        {item.doc_type === 'facture' ? 'Facture' : 'Bon Vente'}
                      </span>
                      <strong>{item.numero}</strong>
                    </div>
                    {item.doc_type === 'facture' && item.bon_numero && (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Sur {item.bon_numero}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.client_nom}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {item.client_code}
                      {item.client_tel ? ` · ${item.client_tel}` : ''}
                    </div>
                  </td>
                  <td>{item.vendeur_nom || '—'}</td>
                  <td>{item.date_emission}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600 }}>{item.date_echeance}</span>
                      {!isReadOnly && (
                        <button
                          type="button"
                          className="btn btn-muted"
                          style={{ padding: '2px 6px', fontSize: 11 }}
                          title="Modifier la date d'échéance"
                          onClick={() => {
                            setEditEchItem(item);
                            setEditEchDate(item.date_echeance);
                          }}
                        >
                          ✏
                        </button>
                      )}
                    </div>
                    {item.echeance_source === 'defaut_30j' && (
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                        Défaut +30j
                      </div>
                    )}
                  </td>
                  <td>
                    {isOverdue ? (
                      <span className="badge badge-red">
                        En retard ({item.jours_retard} j)
                      </span>
                    ) : isSoon ? (
                      <span className="badge badge-orange">
                        {item.jours_restants === 0
                          ? "Échéance aujourd'hui"
                          : `Sous ${item.jours_restants} j`}
                      </span>
                    ) : (
                      <span className="badge badge-green">
                        À venir ({item.jours_restants} j)
                      </span>
                    )}
                  </td>
                  <td>
                    <div>{fmtDA(item.total_ttc)}</div>
                    {item.montant_verse > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--green)' }}>
                        Versé : {fmtDA(item.montant_verse)}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      fontWeight: 700,
                      color: isOverdue ? 'var(--red)' : 'var(--orange)',
                    }}
                  >
                    {fmtDA(item.reste_payer)}
                  </td>
                  <td>
                    {item.nb_relances > 0 ? (
                      <div>
                        <span className="badge badge-blue">
                          {item.nb_relances} relance(s)
                        </span>
                        {item.derniere_relance && (
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                            {item.derniere_relance.date_action.slice(0, 10)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Aucune</span>
                    )}
                  </td>
                  <td>
                    {isOverdue ? (
                      <button
                        type="button"
                        className="btn btn-red"
                        style={{ padding: '5px 9px', fontSize: 11 }}
                        onClick={() => openRelanceModal(item, 'whatsapp')}
                      >
                        📩 Préparer relance
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-muted"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => openRelanceModal(item, 'whatsapp')}
                      >
                        💬 Relance
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  Aucune créance non soldée correspondant aux filtres sélectionnés.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modale Préparer Relance (WhatsApp / Email sans quitter l'app) */}
      {relanceTarget && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 620 }}>
            <h3 style={{ marginTop: 0 }}>
              📩 Préparer relance — {relanceTarget.numero}
            </h3>
            <div
              className={`alert-box ${
                relanceTarget.jours_retard > 0 ? 'alert-error' : 'alert-warn'
              }`}
              style={{ marginBottom: 12 }}
            >
              <div>
                <strong>{relanceTarget.client_nom}</strong> ({relanceTarget.client_code}) —{' '}
                Reste à payer : <strong>{fmtDA(relanceTarget.reste_payer)}</strong>
              </div>
              <div style={{ fontSize: 12, marginTop: 2 }}>
                Échéance : <strong>{relanceTarget.date_echeance}</strong>
                {relanceTarget.jours_retard > 0
                  ? ` · Retard de ${relanceTarget.jours_retard} jour(s)`
                  : ` · Échéance dans ${relanceTarget.jours_restants} jour(s)`}
              </div>
            </div>

            <div className="tabs" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={`tab-btn ${relanceCanal === 'whatsapp' ? 'active' : ''}`}
                onClick={() => switchCanal('whatsapp')}
              >
                💬 WhatsApp
              </button>
              <button
                type="button"
                className={`tab-btn ${relanceCanal === 'email' ? 'active' : ''}`}
                onClick={() => switchCanal('email')}
              >
                ✉️ Email
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-field">
                <label>
                  {relanceCanal === 'whatsapp'
                    ? 'Numéro WhatsApp / Téléphone du client'
                    : 'Adresse Email du client'}
                </label>
                <input
                  className="input"
                  placeholder={
                    relanceCanal === 'whatsapp'
                      ? 'Ex : 0555 88 99 00'
                      : 'Ex : client@entreprise.dz'
                  }
                  value={relanceDest}
                  onChange={(e) => setRelanceDest(e.target.value)}
                />
              </div>

              {relanceCanal === 'email' && (
                <div className="form-field">
                  <label>Objet de l&apos;email</label>
                  <input
                    className="input"
                    value={relanceObjet}
                    onChange={(e) => setRelanceObjet(e.target.value)}
                  />
                </div>
              )}

              <div className="form-field">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <label>Message prêt à copier / envoyer</label>
                  <button
                    type="button"
                    className="btn btn-muted"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => switchCanal(relanceCanal)}
                  >
                    ↺ Régénérer modèle
                  </button>
                </div>
                <textarea
                  className="input"
                  rows={relanceCanal === 'whatsapp' ? 9 : 11}
                  style={{ fontFamily: 'inherit', lineHeight: 1.45 }}
                  value={relanceMsg}
                  onChange={(e) => setRelanceMsg(e.target.value)}
                />
              </div>

              {relanceStatus && (
                <div className="alert-box alert-success" style={{ marginBottom: 0 }}>
                  {relanceStatus}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setRelanceTarget(null)}
                >
                  Fermer
                </button>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {relanceCanal === 'whatsapp' && (
                    <button
                      type="button"
                      className="btn btn-muted"
                      disabled={relanceBusy || !relanceMsg.trim()}
                      onClick={handleCopyWaLink}
                    >
                      🔗 Copier lien WhatsApp
                    </button>
                  )}
                  {!isReadOnly && (
                    <button
                      type="button"
                      className="btn"
                      disabled={relanceBusy || !relanceMsg.trim()}
                      onClick={handleAuditOnly}
                    >
                      📝 Journaliser seule
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-green"
                    disabled={relanceBusy || !relanceMsg.trim()}
                    onClick={handleCopyAndAudit}
                  >
                    📋 Copier &amp; Enregistrer relance
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale Modification rapide Échéance */}
      {editEchItem && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 400 }}>
            <h3 style={{ marginTop: 0 }}>
              📅 Modifier l&apos;échéance — {editEchItem.numero}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              Client : <strong>{editEchItem.client_nom}</strong> · Reste :{' '}
              <strong>{fmtDA(editEchItem.reste_payer)}</strong>
            </p>
            <form onSubmit={saveEcheance} style={{ display: 'grid', gap: 10 }}>
              <div className="form-field">
                <label>Date d&apos;échéance</label>
                <input
                  type="date"
                  className="input"
                  value={editEchDate}
                  onChange={(e) => setEditEchDate(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setEditEchItem(null)}
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
    </>
  );
}
