import React, { useEffect, useState } from 'react';
import { apiFetch, fmtDA } from '../api.ts';

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════
// VERSEMENTS UNIFIÉS (Clients, Fournisseurs, Prospects, Vendeurs)
// ══════════════════════════════════════════════════════════════
export function VersementsPage({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<'tous' | 'client' | 'fournisseur' | 'prospect' | 'vendeur'>('tous');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    type: 'client' as 'client' | 'fournisseur' | 'prospect' | 'vendeur',
    tiers_id: 0,
    date_vers: new Date().toISOString().slice(0, 10),
    montant: '',
    mode: 'Espèces',
    reference: '',
    observations: '',
  });

  const [detailItem, setDetailItem] = useState<any>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    date_vers: '',
    montant: '',
    mode: 'Espèces',
    reference: '',
    observations: '',
  });
  const [confirmDelKey, setConfirmDelKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch('/api/bureau/versements-unifies', { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement versements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const referentiels = data?.referentiels || {
    clients: [],
    fournisseurs: [],
    prospects: [],
    vendeurs: [],
  };

  const tiersOptions =
    form.type === 'client'
      ? referentiels.clients
      : form.type === 'fournisseur'
        ? referentiels.fournisseurs
        : form.type === 'prospect'
          ? referentiels.prospects
          : referentiels.vendeurs;

  const selectedTiers = tiersOptions.find((t: any) => t.id === form.tiers_id);
  const montantNum = Number(form.montant || 0);
  const soldeApres =
    selectedTiers && typeof selectedTiers.solde === 'number'
      ? Math.max(0, Number((selectedTiers.solde - montantNum).toFixed(2)))
      : null;

  const unifiedRows = data
    ? [
        ...(data.clients || []).map((v: any) => ({ ...v, _kind: 'client', _label: 'Client', _badge: 'badge-green' })),
        ...(data.fournisseurs || []).map((v: any) => ({ ...v, _kind: 'fournisseur', _label: 'Fournisseur', _badge: 'badge-orange' })),
        ...(data.prospects || []).map((v: any) => ({ ...v, _kind: 'prospect', _label: 'Prospect', _badge: 'badge-blue' })),
        ...(data.vendeurs || []).map((v: any) => ({ ...v, _kind: 'vendeur', _label: 'Vendeur', _badge: 'badge-blue' })),
      ]
        .filter((v) => tab === 'tous' || v._kind === tab)
        .filter(
          (v) =>
            !search ||
            (v.numero || '').toLowerCase().includes(search.toLowerCase()) ||
            (v.tiers_nom || '').toLowerCase().includes(search.toLowerCase()) ||
            (v.reference || '').toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => (b.date_vers || '').localeCompare(a.date_vers || '') || b.id - a.id)
    : [];

  const totalFiltre = unifiedRows
    .filter((r) => r.statut !== 'Annulé')
    .reduce((acc, r) => acc + Number(r.montant || 0), 0);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/api/bureau/versements-unifies', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...form,
          montant: Number(form.montant),
        }),
      });
      setForm({ ...form, montant: '', reference: '', observations: '' });
      setMessage('Versement enregistré avec succès.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur enregistrement versement');
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setError(null);
    try {
      await apiFetch(`/api/bureau/versements-unifies/${editItem._kind}/${editItem.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          date_vers: editForm.date_vers,
          montant: Number(editForm.montant),
          mode: editForm.mode,
          reference: editForm.reference,
          observations: editForm.observations,
        }),
      });
      setEditItem(null);
      setMessage('Versement mis à jour.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur modification');
    }
  };

  const exportCsv = () => {
    const header = ['Numéro', 'Date', 'Type', 'Tiers', 'Mode', 'Montant', 'Référence', 'Statut'].join(';');
    const lines = unifiedRows.map((v) =>
      [
        v.numero,
        v.date_vers,
        v._label,
        `"${(v.tiers_nom || '').replace(/"/g, '""')}"`,
        v.mode,
        v.montant,
        v.reference || '',
        v.statut || 'Validé',
      ].join(';')
    );
    downloadFile([header, ...lines].join('\n'), `versements_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">💳 Versements Unifiés</h2>
          <p className="page-subtitle">
            Clients, Fournisseurs, Prospects &amp; Versements Recettes Vendeurs
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-muted" onClick={exportCsv}>
            📄 Export CSV
          </button>
          <button className="btn btn-muted" onClick={() => window.print()}>
            🖨 Imprimer
          </button>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}
      {message && <div className="alert-box alert-success">{message}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 10px' }}>+ Enregistrer un Versement</h4>
        <form onSubmit={submitCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="select"
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as any, tiers_id: 0 })
            }
          >
            <option value="client">Client</option>
            <option value="fournisseur">Fournisseur</option>
            <option value="prospect">Prospect</option>
            <option value="vendeur">Vendeur (Recette tournée)</option>
          </select>

          <select
            className="select"
            value={form.tiers_id}
            onChange={(e) => setForm({ ...form, tiers_id: Number(e.target.value) })}
            required
          >
            <option value={0}>Sélectionner {form.type}...</option>
            {tiersOptions.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.nom} ({t.code})
                {typeof t.solde === 'number' ? ` — Solde: ${fmtDA(t.solde)}` : ''}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="input"
            value={form.date_vers}
            onChange={(e) => setForm({ ...form, date_vers: e.target.value })}
          />

          <input
            type="number"
            step="0.01"
            min="0.01"
            className="input"
            style={{ width: 130 }}
            placeholder="Montant (DA)"
            value={form.montant}
            onChange={(e) => setForm({ ...form, montant: e.target.value })}
            required
          />

          <select
            className="select"
            value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value })}
          >
            <option value="Espèces">Espèces</option>
            <option value="Chèque">Chèque</option>
            <option value="Virement">Virement</option>
            <option value="Carte">Carte / TPE</option>
          </select>

          <input
            className="input"
            style={{ width: 140 }}
            placeholder="Référence"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
          />

          <input
            className="input"
            style={{ width: 170 }}
            placeholder="Observations"
            value={form.observations}
            onChange={(e) => setForm({ ...form, observations: e.target.value })}
          />

          <button className="btn btn-green" type="submit">
            ✓ Valider Versement
          </button>
        </form>

        {selectedTiers && typeof selectedTiers.solde === 'number' && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 16 }}>
            <span>
              Solde actuel : <strong style={{ color: 'var(--orange)' }}>{fmtDA(selectedTiers.solde)}</strong>
            </span>
            {montantNum > 0 && soldeApres !== null && (
              <span>
                Nouveau solde calculé :{' '}
                <strong style={{ color: 'var(--green)' }}>{fmtDA(soldeApres)}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="tabs">
        {(
          [
            ['tous', 'Tous'],
            ['client', 'Clients'],
            ['fournisseur', 'Fournisseurs'],
            ['prospect', 'Prospects'],
            ['vendeur', 'Vendeurs'],
          ] as const
        ).map(([k, lbl]) => (
          <button
            key={k}
            className={`tab-btn ${tab === k ? 'active' : ''}`}
            onClick={() => setTab(k)}
          >
            {lbl}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input
          className="input"
          style={{ width: 260 }}
          placeholder="Rechercher N°, tiers, référence..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span style={{ color: 'var(--muted)' }}>
          {unifiedRows.length} versement(s) — Total actif :{' '}
          <strong style={{ color: 'var(--green)' }}>{fmtDA(totalFiltre)}</strong>
        </span>
      </div>

      {loading && <div className="page-subtitle">Chargement...</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Date</th>
              <th>Type</th>
              <th>Tiers / Vendeur</th>
              <th>Mode</th>
              <th>Montant</th>
              <th>Référence</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {unifiedRows.map((v) => {
              const delKey = `${v._kind}-${v.id}`;
              return (
                <tr key={delKey} style={{ opacity: v.statut === 'Annulé' ? 0.55 : 1 }}>
                  <td style={{ fontWeight: 600 }}>{v.numero}</td>
                  <td>{v.date_vers}</td>
                  <td>
                    <span className={`badge ${v._badge}`}>{v._label}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{v.tiers_nom}</td>
                  <td>{v.mode}</td>
                  <td style={{ fontWeight: 700, color: 'var(--green)' }}>{fmtDA(v.montant)}</td>
                  <td>{v.reference || '—'}</td>
                  <td>
                    <span className={`badge ${v.statut === 'Annulé' ? 'badge-red' : 'badge-green'}`}>
                      {v.statut || 'Validé'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                    <button
                      className="btn btn-muted"
                      style={{ padding: '4px 7px', fontSize: 11 }}
                      onClick={() => setDetailItem(v)}
                      title="Détail / Reçu"
                    >
                      👁
                    </button>
                    {v.statut !== 'Annulé' && (
                      <button
                        className="btn"
                        style={{ padding: '4px 7px', fontSize: 11 }}
                        onClick={() => {
                          setEditItem(v);
                          setEditForm({
                            date_vers: v.date_vers || '',
                            montant: String(v.montant || ''),
                            mode: v.mode || 'Espèces',
                            reference: v.reference || '',
                            observations: v.observations || '',
                          });
                        }}
                        title="Modifier"
                      >
                        ✏
                      </button>
                    )}
                    {v._kind === 'vendeur' && v.statut !== 'Annulé' && (
                      <button
                        className="btn btn-orange"
                        style={{ padding: '4px 7px', fontSize: 11 }}
                        onClick={async () => {
                          await apiFetch(`/api/bureau/versements-vendeurs/${v.id}/annuler`, {
                            method: 'POST',
                            token,
                          });
                          setMessage(`Versement ${v.numero} annulé.`);
                          load();
                        }}
                        title="Annuler versement vendeur"
                      >
                        Annuler
                      </button>
                    )}
                    {confirmDelKey === delKey ? (
                      <>
                        <button
                          className="btn btn-red"
                          style={{ padding: '4px 7px', fontSize: 11 }}
                          onClick={async () => {
                            await apiFetch(`/api/bureau/versements-unifies/${v._kind}/${v.id}`, {
                              method: 'DELETE',
                              token,
                            });
                            setConfirmDelKey(null);
                            setMessage(`Versement ${v.numero} supprimé.`);
                            load();
                          }}
                        >
                          Confirmer
                        </button>
                        <button
                          className="btn btn-muted"
                          style={{ padding: '4px 7px', fontSize: 11 }}
                          onClick={() => setConfirmDelKey(null)}
                        >
                          Non
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-red"
                        style={{ padding: '4px 7px', fontSize: 11 }}
                        onClick={() => setConfirmDelKey(delKey)}
                        title="Supprimer"
                      >
                        🗑
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {unifiedRows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  Aucun versement trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Détail Reçu Versement */}
      {detailItem && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ marginTop: 0 }}>🧾 Reçu de Versement — {detailItem.numero}</h3>
              <button className="btn btn-muted" onClick={() => window.print()}>
                🖨 Imprimer
              </button>
            </div>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <div>Date : <strong>{detailItem.date_vers}</strong></div>
              <div>Catégorie : <strong>{detailItem._label}</strong></div>
              <div>Tiers : <strong>{detailItem.tiers_nom}</strong></div>
              <div>Mode de règlement : <strong>{detailItem.mode}</strong></div>
              <div>Montant encaissé : <strong style={{ color: 'var(--green)', fontSize: 16 }}>{fmtDA(detailItem.montant)}</strong></div>
              <div>Référence : {detailItem.reference || '—'}</div>
              <div>Observations : {detailItem.observations || '—'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn" onClick={() => setDetailItem(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edition Versement */}
      {editItem && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>✏ Modifier Versement — {editItem.numero}</h3>
            <form onSubmit={submitEdit} className="form-grid">
              <div className="form-field">
                <label>Date</label>
                <input
                  type="date"
                  className="input"
                  value={editForm.date_vers}
                  onChange={(e) => setEditForm({ ...editForm, date_vers: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label>Montant (DA)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input"
                  value={editForm.montant}
                  onChange={(e) => setEditForm({ ...editForm, montant: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label>Mode</label>
                <select
                  className="select"
                  value={editForm.mode}
                  onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })}
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Virement">Virement</option>
                  <option value="Carte">Carte / TPE</option>
                </select>
              </div>
              <div className="form-field">
                <label>Référence</label>
                <input
                  className="input"
                  value={editForm.reference}
                  onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                />
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label>Observations</label>
                <input
                  className="input"
                  value={editForm.observations}
                  onChange={(e) => setEditForm({ ...editForm, observations: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-muted" onClick={() => setEditItem(null)}>
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

// ══════════════════════════════════════════════════════════════
// SITUATIONS DÉTAILLÉES DES COMPTES
// ══════════════════════════════════════════════════════════════
export function SituationsPage({
  token,
  initialType,
  initialTiersId,
}: {
  token: string;
  initialType: 'client' | 'fournisseur';
  initialTiersId: number;
}) {
  const [sitType, setSitType] = useState<'client' | 'fournisseur'>(initialType);
  const [sitTiersId, setSitTiersId] = useState<number>(initialTiersId);
  const [clients, setClients] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [subTab, setSubTab] = useState<'synthese' | 'transactions' | 'versements'>('synthese');
  const [ledger, setLedger] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [obsModal, setObsModal] = useState<any>(null);
  const [obsText, setObsText] = useState('');

  const loadLedger = async (kind: 'client' | 'fournisseur', id: number, d = du, a = au) => {
    if (!id) return;
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (d) qs.set('du', d);
      if (a) qs.set('au', a);
      const url = `/api/bureau/situations-detaillees/${kind}/${id}${qs.toString() ? `?${qs.toString()}` : ''}`;
      setLedger(await apiFetch(url, { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur situation');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [cls, fourns] = await Promise.all([
          apiFetch<any[]>('/api/bureau/clients', { token }),
          apiFetch<any[]>('/api/bureau/fournisseurs', { token }),
        ]);
        setClients(cls);
        setFournisseurs(fourns);
        const defId =
          initialTiersId ||
          (initialType === 'client'
            ? cls.find((c) => c.code !== 'CLT-COMPTOIR')?.id || cls[0]?.id || 0
            : fourns[0]?.id || 0);
        setSitType(initialType);
        setSitTiersId(defId);
        if (defId) await loadLedger(initialType, defId, '', '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur chargement tiers');
      }
    })();
  }, [token, initialType, initialTiersId]);

  const exportCsv = () => {
    if (!ledger) return;
    const header = ['Date', 'Document', 'Libellé', 'Observation', 'Débit', 'Crédit', 'Solde Cumulé'].join(';');
    const lines = (ledger.lignes || []).map((l: any) =>
      [
        l.date,
        l.numero,
        `"${(l.libelle || '').replace(/"/g, '""')}"`,
        `"${(l.observation || '').replace(/"/g, '""')}"`,
        l.debit,
        l.credit,
        l.solde,
      ].join(';')
    );
    downloadFile(
      [header, ...lines].join('\n'),
      `situation_${ledger.tiers_code || sitTiersId}_${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;'
    );
  };

  const exportHtml = () => {
    if (!ledger) return;
    const rowsHtml = (ledger.lignes || [])
      .map(
        (l: any) =>
          `<tr><td>${l.date}</td><td>${l.numero}</td><td>${l.libelle}</td><td>${l.observation || ''}</td><td style="text-align:right">${l.debit > 0 ? l.debit.toFixed(2) : ''}</td><td style="text-align:right">${l.credit > 0 ? l.credit.toFixed(2) : ''}</td><td style="text-align:right;font-weight:bold">${Number(l.solde).toFixed(2)}</td></tr>`
      )
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Situation ${ledger.tiers_nom}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px}th{background:#f1f5f9}</style></head><body><h2>Relevé de Situation — ${ledger.tiers_nom} (${ledger.tiers_code})</h2><p>Période : ${du || 'Début'} au ${au || "Aujourd'hui"} | Report : ${Number(ledger.solde_report).toFixed(2)} DA | Débit : ${Number(ledger.total_debit).toFixed(2)} DA | Crédit : ${Number(ledger.total_credit).toFixed(2)} DA | Solde Final : <strong>${Number(ledger.solde_final).toFixed(2)} DA</strong></p><table><thead><tr><th>Date</th><th>Document</th><th>Libellé</th><th>Observation</th><th>Débit</th><th>Crédit</th><th>Solde</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;
    downloadFile(html, `situation_${ledger.tiers_code || sitTiersId}.html`, 'text/html;charset=utf-8;');
  };

  const saveObs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsModal) return;
    await apiFetch('/api/bureau/situations/observation', {
      method: 'PUT',
      token,
      body: JSON.stringify({
        kind: sitType,
        doc_type: obsModal.type,
        doc_id: obsModal.id,
        observation: obsText,
      }),
    });
    setObsModal(null);
    setMessage('Observation mise à jour.');
    await loadLedger(sitType, sitTiersId);
  };

  const rowsToShow =
    subTab === 'versements' ? ledger?.versements || [] : ledger?.lignes || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">📊 Situations Détaillées des Comptes</h2>
          <p className="page-subtitle">Relevé chronologique, solde de report, filtre dates et exports</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-muted" onClick={exportCsv}>
            📥 Export CSV
          </button>
          <button className="btn btn-muted" onClick={exportHtml}>
            📄 Export HTML
          </button>
          <button className="btn btn-muted" onClick={() => window.print()}>
            🖨 Imprimer Relevé
          </button>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}
      {message && <div className="alert-box alert-success">{message}</div>}

      <div className="toolbar">
        <select
          className="select"
          value={sitType}
          onChange={(e) => {
            const nextType = e.target.value as 'client' | 'fournisseur';
            setSitType(nextType);
            const list = nextType === 'client' ? clients : fournisseurs;
            const nextId = list[0]?.id || 0;
            setSitTiersId(nextId);
            if (nextId) loadLedger(nextType, nextId);
          }}
        >
          <option value="client">Client</option>
          <option value="fournisseur">Fournisseur</option>
        </select>

        <select
          className="select"
          value={sitTiersId}
          onChange={(e) => {
            const nextId = Number(e.target.value);
            setSitTiersId(nextId);
            if (nextId) loadLedger(sitType, nextId);
          }}
        >
          {(sitType === 'client' ? clients : fournisseurs).map((t) => (
            <option key={t.id} value={t.id}>
              {t.nom} ({t.code}) — Solde: {fmtDA(t.solde)}
            </option>
          ))}
        </select>

        <label style={{ fontSize: 12, color: 'var(--muted)' }}>Du :</label>
        <input
          type="date"
          className="input"
          value={du}
          onChange={(e) => setDu(e.target.value)}
        />
        <label style={{ fontSize: 12, color: 'var(--muted)' }}>Au :</label>
        <input
          type="date"
          className="input"
          value={au}
          onChange={(e) => setAu(e.target.value)}
        />
        <button className="btn" onClick={() => loadLedger(sitType, sitTiersId, du, au)}>
          🔍 Appliquer
        </button>
        <button
          className="btn btn-muted"
          onClick={() => {
            setDu('');
            setAu('');
            loadLedger(sitType, sitTiersId, '', '');
          }}
        >
          ↺ Réinitialiser
        </button>
      </div>

      {ledger && (
        <>
          <div className="kpi-grid">
            <div className="card">
              <div className="kpi-label">Report Début Période</div>
              <div className="kpi-value" style={{ color: 'var(--muted)' }}>
                {fmtDA(ledger.solde_report)}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">Total Débit</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>
                {fmtDA(ledger.total_debit)}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">Total Crédit</div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>
                {fmtDA(ledger.total_credit)}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">Solde Final Période</div>
              <div className="kpi-value" style={{ color: 'var(--orange)' }}>
                {fmtDA(ledger.solde_final)}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">Solde Global Compte</div>
              <div className="kpi-value" style={{ color: 'var(--red)' }}>
                {fmtDA(ledger.solde_global)}
              </div>
            </div>
          </div>

          <div className="tabs">
            <button
              className={`tab-btn ${subTab === 'synthese' ? 'active' : ''}`}
              onClick={() => setSubTab('synthese')}
            >
              📋 Synthèse
            </button>
            <button
              className={`tab-btn ${subTab === 'transactions' ? 'active' : ''}`}
              onClick={() => setSubTab('transactions')}
            >
              📑 Historique transactions ({(ledger.lignes || []).length})
            </button>
            <button
              className={`tab-btn ${subTab === 'versements' ? 'active' : ''}`}
              onClick={() => setSubTab('versements')}
            >
              💳 Versements ({(ledger.versements || []).length})
            </button>
          </div>

          {subTab === 'synthese' ? (
            <div className="card" style={{ marginBottom: 14 }}>
              <h4 style={{ marginTop: 0 }}>
                Fiche Synthèse — {ledger.tiers_nom} ({ledger.tiers_code})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, fontSize: 13 }}>
                <div>Nombre total d'opérations : <strong>{(ledger.lignes || []).length}</strong></div>
                <div>Nombre de versements : <strong>{(ledger.versements || []).length}</strong></div>
                <div>Période affichée : <strong>{du || 'Début'} → {au || "Aujourd'hui"}</strong></div>
                <div>Solde net restant : <strong style={{ color: 'var(--orange)' }}>{fmtDA(ledger.solde_global)}</strong></div>
              </div>
            </div>
          ) : null}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Document</th>
                  <th>Libellé</th>
                  <th>Observation</th>
                  <th>Débit</th>
                  <th>Crédit</th>
                  <th>Solde Cumulé</th>
                  <th>Obs.</th>
                </tr>
              </thead>
              <tbody>
                {rowsToShow.map((l: any, idx: number) => (
                  <tr key={`${l.type}-${l.id}-${idx}`}>
                    <td>{l.date}</td>
                    <td style={{ fontWeight: 600 }}>{l.numero}</td>
                    <td>{l.libelle}</td>
                    <td style={{ color: 'var(--muted)' }}>{l.observation || '—'}</td>
                    <td>{l.debit > 0 ? fmtDA(l.debit) : '—'}</td>
                    <td style={{ color: 'var(--green)' }}>{l.credit > 0 ? fmtDA(l.credit) : '—'}</td>
                    <td style={{ fontWeight: 700 }}>{fmtDA(l.solde)}</td>
                    <td>
                      <button
                        className="btn btn-muted"
                        style={{ padding: '3px 7px', fontSize: 11 }}
                        title="Modifier l'observation"
                        onClick={() => {
                          setObsModal(l);
                          setObsText(l.observation || '');
                        }}
                      >
                        ✏
                      </button>
                    </td>
                  </tr>
                ))}
                {rowsToShow.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      Aucune opération sur cette période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {obsModal && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 420 }}>
            <h3 style={{ marginTop: 0 }}>✏ Observation — {obsModal.numero}</h3>
            <form onSubmit={saveObs} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                className="input"
                rows={3}
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                placeholder="Note ou commentaire interne..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-muted" onClick={() => setObsModal(null)}>
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

// ══════════════════════════════════════════════════════════════
// MOUVEMENTS DE STOCK + AJUSTEMENT + CONTRÔLE DE COHÉRENCE
// ══════════════════════════════════════════════════════════════
export function MouvementsStockPage({
  token,
  mvtProdFilter,
  onClearProdFilter,
}: {
  token: string;
  mvtProdFilter: number | null;
  onClearProdFilter: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState('Tous');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detailMvt, setDetailMvt] = useState<any>(null);

  // Ajustement stock modal
  const [showAjustModal, setShowAjustModal] = useState(false);
  const [ajustProdId, setAjustProdId] = useState<number>(0);
  const [ajustVal, setAjustVal] = useState('');
  const [ajustMotif, setAjustMotif] = useState('Inventaire physique');

  // Cohérence stock modal
  const [showCoherenceModal, setShowCoherenceModal] = useState(false);
  const [ecarts, setEcarts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadingCoh, setLoadingCoh] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const url = mvtProdFilter
        ? `/api/bureau/mouvements-stock?produit_id=${mvtProdFilter}`
        : '/api/bureau/mouvements-stock';
      const [mvts, prods] = await Promise.all([
        apiFetch<any[]>(url, { token }),
        apiFetch<any[]>('/api/bureau/produits', { token }),
      ]);
      setRows(mvts);
      setProduits(prods);
      if (!ajustProdId && prods[0]) {
        setAjustProdId(prods[0].id);
        setAjustVal(String(prods[0].stock_actuel));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement mouvements');
    }
  };

  useEffect(() => {
    setPage(1);
    load();
  }, [token, mvtProdFilter]);

  const typesDisponibles = Array.from(new Set(rows.map((r) => r.type_mouvement)));

  const filtered = rows
    .filter((m) => typeFilter === 'Tous' || m.type_mouvement === typeFilter)
    .filter(
      (m) =>
        !search ||
        (m.produit_designation || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.produit_code || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.document_numero || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.tiers_nom || '').toLowerCase().includes(search.toLowerCase())
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openCoherence = async () => {
    setShowCoherenceModal(true);
    setLoadingCoh(true);
    try {
      const res = await apiFetch<any[]>('/api/bureau/mouvements-stock/coherence', { token });
      setEcarts(res);
      setSelectedIds(res.map((r) => r.produit_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur contrôle cohérence');
    } finally {
      setLoadingCoh(false);
    }
  };

  const regulariser = async (ids?: number[]) => {
    try {
      const res = await apiFetch<{ regularises: number }>('/api/bureau/mouvements-stock/regulariser', {
        method: 'POST',
        token,
        body: JSON.stringify({ produit_ids: ids || [] }),
      });
      setMessage(`${res.regularises} produit(s) régularisé(s) dans le journal de stock.`);
      setShowCoherenceModal(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur régularisation');
    }
  };

  const submitAjustement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/bureau/produits/${ajustProdId}/ajuster-stock`, {
        method: 'POST',
        token,
        body: JSON.stringify({ nouveau_stock: Number(ajustVal), motif: ajustMotif }),
      });
      setShowAjustModal(false);
      setMessage('Ajustement de stock enregistré.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur ajustement');
    }
  };

  const exportCsv = () => {
    const header = ['Horodatage', 'Code', 'Produit', 'Type', 'Quantité', 'Avant', 'Après', 'Document', 'Tiers', 'Utilisateur'].join(';');
    const lines = filtered.map((m) =>
      [
        m.date_mouvement,
        m.produit_code,
        `"${(m.produit_designation || '').replace(/"/g, '""')}"`,
        m.type_mouvement,
        m.quantite,
        m.stock_avant,
        m.stock_apres,
        m.document_numero || '',
        m.tiers_nom || '',
        m.utilisateur,
      ].join(';')
    );
    downloadFile([header, ...lines].join('\n'), `mouvements_stock_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">📋 Journal des Mouvements de Stock</h2>
          <p className="page-subtitle">Traçabilité complète, ajustements manuels et contrôle de cohérence</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {mvtProdFilter && (
            <button className="btn btn-muted" onClick={onClearProdFilter}>
              ✕ Tous les produits
            </button>
          )}
          <button
            className="btn btn-orange"
            onClick={() => {
              const p = produits.find((x) => x.id === ajustProdId) || produits[0];
              if (p) {
                setAjustProdId(p.id);
                setAjustVal(String(p.stock_actuel));
              }
              setShowAjustModal(true);
            }}
          >
            ➕ Ajustement de stock
          </button>
          <button className="btn" onClick={openCoherence}>
            🩺 Contrôle de cohérence
          </button>
          <button className="btn btn-muted" onClick={exportCsv}>
            📄 Export CSV
          </button>
          <button className="btn btn-muted" onClick={() => window.print()}>
            🖨 Imprimer
          </button>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}
      {message && <div className="alert-box alert-success">{message}</div>}

      <div className="toolbar">
        <input
          className="input"
          style={{ width: 250 }}
          placeholder="Rechercher produit, document, tiers..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="Tous">Tous les types</option>
          {typesDisponibles.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span style={{ color: 'var(--muted)' }}>
          {filtered.length} mouvement(s) — Page {currentPage}/{totalPages}
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Horodatage</th>
              <th>Produit</th>
              <th>Type</th>
              <th>Quantité</th>
              <th>Avant</th>
              <th>Après</th>
              <th>Document</th>
              <th>Tiers</th>
              <th>Utilisateur</th>
              <th>Détail</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((m) => (
              <tr key={m.id}>
                <td>{m.date_mouvement}</td>
                <td style={{ fontWeight: 600 }}>{m.produit_designation}</td>
                <td>
                  <span className="badge badge-blue">{m.type_mouvement}</span>
                </td>
                <td style={{ fontWeight: 700, color: m.quantite >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {m.quantite >= 0 ? `+${m.quantite}` : m.quantite}
                </td>
                <td>{m.stock_avant}</td>
                <td>{m.stock_apres}</td>
                <td>{m.document_numero || '—'}</td>
                <td>{m.tiers_nom || '—'}</td>
                <td>{m.utilisateur}</td>
                <td>
                  <button
                    className="btn btn-muted"
                    style={{ padding: '3px 7px', fontSize: 11 }}
                    onClick={() => setDetailMvt(m)}
                  >
                    👁
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 12, alignItems: 'center' }}>
          <button
            className="btn btn-muted"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ◀ Précédent
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Page {currentPage} sur {totalPages}
          </span>
          <button
            className="btn btn-muted"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Suivant ▶
          </button>
        </div>
      )}

      {/* Modal Détail Mouvement */}
      {detailMvt && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 460 }}>
            <h3 style={{ marginTop: 0 }}>👁 Détail Mouvement #{detailMvt.id}</h3>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <div>Produit : <strong>{detailMvt.produit_designation} ({detailMvt.produit_code})</strong></div>
              <div>Date : {detailMvt.date_mouvement}</div>
              <div>Type : <span className="badge badge-blue">{detailMvt.type_mouvement}</span></div>
              <div>Variation : <strong>{detailMvt.quantite >= 0 ? `+${detailMvt.quantite}` : detailMvt.quantite} pcs</strong></div>
              <div>Stock Avant → Après : <strong>{detailMvt.stock_avant} → {detailMvt.stock_apres} pcs</strong></div>
              <div>Coût unitaire : {fmtDA(detailMvt.cout_unitaire)}</div>
              <div>Document : {detailMvt.document_numero || '—'} ({detailMvt.document_type || '—'})</div>
              <div>Tiers : {detailMvt.tiers_nom || '—'}</div>
              <div>Motif : {detailMvt.motif || '—'}</div>
              <div>Opérateur : {detailMvt.utilisateur}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn" onClick={() => setDetailMvt(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustement de Stock */}
      {showAjustModal && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 460 }}>
            <h3 style={{ marginTop: 0 }}>⚙ Nouvel Ajustement de Stock</h3>
            <form onSubmit={submitAjustement} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-field">
                <label>Produit</label>
                <select
                  className="select"
                  value={ajustProdId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setAjustProdId(id);
                    const pr = produits.find((x) => x.id === id);
                    if (pr) setAjustVal(String(pr.stock_actuel));
                  }}
                >
                  {produits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.designation} (Actuel: {p.stock_actuel} pcs)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Nouveau Stock Réel (pièces)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={ajustVal}
                  onChange={(e) => setAjustVal(e.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label>Motif</label>
                <input
                  className="input"
                  value={ajustMotif}
                  onChange={(e) => setAjustMotif(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-muted" onClick={() => setShowAjustModal(false)}>
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

      {/* Modal Contrôle de Cohérence Stock */}
      {showCoherenceModal && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 680 }}>
            <h3 style={{ marginTop: 0 }}>🩺 Contrôle de Cohérence Stock / Journal</h3>
            {loadingCoh ? (
              <p>Analyse en cours...</p>
            ) : ecarts.length === 0 ? (
              <div className="alert-box alert-success">
                ✅ Aucun écart détecté — Tous les stocks produits correspondent exactement au cumul du journal des mouvements !
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--orange)', fontSize: 13 }}>
                  ⚠️ {ecarts.length} écart(s) détecté(s) entre le stock actuel fiche produit et la somme des mouvements :
                </p>
                <div className="table-wrap" style={{ marginBottom: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Sel.</th>
                        <th>Code</th>
                        <th>Produit</th>
                        <th>Stock Fiche</th>
                        <th>Cumul Journal</th>
                        <th>Écart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ecarts.map((ec) => (
                        <tr key={ec.produit_id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(ec.produit_id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds([...selectedIds, ec.produit_id]);
                                } else {
                                  setSelectedIds(selectedIds.filter((id) => id !== ec.produit_id));
                                }
                              }}
                            />
                          </td>
                          <td>{ec.code}</td>
                          <td>{ec.designation}</td>
                          <td>{ec.stock_produit}</td>
                          <td>{ec.stock_journal}</td>
                          <td style={{ fontWeight: 700, color: 'var(--red)' }}>
                            {ec.ecart > 0 ? `+${ec.ecart}` : ec.ecart}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-muted" onClick={() => setShowCoherenceModal(false)}>
                Fermer
              </button>
              {ecarts.length > 0 && (
                <>
                  <button
                    className="btn btn-orange"
                    disabled={selectedIds.length === 0}
                    onClick={() => regulariser(selectedIds)}
                  >
                    ⚡ Régulariser la sélection ({selectedIds.length})
                  </button>
                  <button className="btn btn-green" onClick={() => regulariser([])}>
                    ⚡ Tout régulariser
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
