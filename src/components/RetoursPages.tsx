import React, { useEffect, useState } from 'react';
import { apiFetch, fmtDA } from '../api.ts';

export function RetoursPage({ token }: { token: string }) {
  const [retourType, setRetourType] = useState<'vente' | 'achat'>('vente');
  const [rows, setRows] = useState<any[]>([]);
  const [tiersList, setTiersList] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [confirmDelId, setConfirmDelId] = useState<number | null>(null);

  const [form, setForm] = useState({
    tiers_id: 0,
    date_retour: new Date().toISOString().slice(0, 10),
    motif: 'Produit endommagé',
    observations: '',
  });
  const [lignes, setLignes] = useState<
    { produit_id: number; quantite: number; prix_unitaire: number }[]
  >([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [retRows, tiers, prods] = await Promise.all([
        apiFetch<any[]>(`/api/bureau/retours?type=${retourType}`, { token }),
        apiFetch<any[]>(
          retourType === 'vente' ? '/api/bureau/clients' : '/api/bureau/fournisseurs',
          { token }
        ),
        apiFetch<any[]>('/api/bureau/produits', { token }),
      ]);
      setRows(retRows);
      setTiersList(tiers);
      setProduits(prods);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMessage(null);
    setConfirmDelId(null);
    load();
  }, [retourType, token]);

  const openCreate = () => {
    const firstTiers = tiersList[0]?.id || 0;
    const firstProd = produits[0];
    setForm({
      tiers_id: firstTiers,
      date_retour: new Date().toISOString().slice(0, 10),
      motif: 'Produit endommagé',
      observations: '',
    });
    setLignes(
      firstProd
        ? [
            {
              produit_id: firstProd.id,
              quantite: 1,
              prix_unitaire:
                retourType === 'vente' ? firstProd.prix_vente : firstProd.prix_achat,
            },
          ]
        : []
    );
    setShowCreate(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/bureau/retours', {
        method: 'POST',
        token,
        body: JSON.stringify({
          type: retourType,
          ...form,
          lignes,
        }),
      });
      setShowCreate(false);
      setMessage('Retour enregistré (stock et solde mis à jour).');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur enregistrement');
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    try {
      await apiFetch(`/api/bureau/retours/${retourType}/${editItem.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          date_retour: editItem.date_retour,
          motif: editItem.motif,
          observations: editItem.observations,
        }),
      });
      setEditItem(null);
      setMessage('Retour modifié.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur modification');
    }
  };

  const supprimerRetour = async (id: number) => {
    try {
      await apiFetch(`/api/bureau/retours/${retourType}/${id}`, {
        method: 'DELETE',
        token,
      });
      setConfirmDelId(null);
      setMessage('Retour supprimé (stock et solde restaurés).');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur suppression');
    }
  };

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.numero.toLowerCase().includes(search.toLowerCase()) ||
      (r.tiers_nom || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.motif || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">
            ↩️ {retourType === 'vente' ? 'Retours Clients' : 'Retours Fournisseurs'}
          </h2>
          <p className="page-subtitle">
            Gestion des avoirs, réintégrations stock et déductions sur solde tiers.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-green" onClick={openCreate}>
            + Nouveau Retour
          </button>
          <button className="btn btn-muted" onClick={() => window.print()}>
            🖨 Imprimer
          </button>
          <button className="btn btn-muted" onClick={load}>
            🔄 Actualiser
          </button>
        </div>
      </div>

      <div className="tabs" style={{ maxWidth: 420 }}>
        <button
          type="button"
          className={`tab-btn ${retourType === 'vente' ? 'active' : ''}`}
          onClick={() => setRetourType('vente')}
        >
          👤 Retour Client
        </button>
        <button
          type="button"
          className={`tab-btn ${retourType === 'achat' ? 'active' : ''}`}
          onClick={() => setRetourType('achat')}
        >
          🏭 Retour Fournisseur
        </button>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}
      {message && <div className="alert-box alert-success">{message}</div>}

      <div className="toolbar">
        <input
          className="input"
          style={{ minWidth: 260 }}
          placeholder="Rechercher numéro, tiers, motif..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {loading && <span style={{ color: 'var(--muted)' }}>Chargement...</span>}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Date</th>
              <th>{retourType === 'vente' ? 'Client' : 'Fournisseur'}</th>
              <th>Motif</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.numero}</strong>
                </td>
                <td>{r.date_retour}</td>
                <td>{r.tiers_nom}</td>
                <td>{r.motif || '—'}</td>
                <td style={{ fontWeight: 700 }}>{fmtDA(r.total)}</td>
                <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-muted"
                    style={{ padding: '4px 8px' }}
                    onClick={() => setDetailItem(r)}
                  >
                    👁 Détail
                  </button>
                  <button
                    className="btn btn-muted"
                    style={{ padding: '4px 8px' }}
                    onClick={() => setEditItem({ ...r })}
                  >
                    ✏ Modifier
                  </button>
                  {confirmDelId === r.id ? (
                    <>
                      <button
                        className="btn btn-red"
                        style={{ padding: '4px 8px' }}
                        onClick={() => supprimerRetour(r.id)}
                      >
                        Confirmer
                      </button>
                      <button
                        className="btn btn-muted"
                        style={{ padding: '4px 8px' }}
                        onClick={() => setConfirmDelId(null)}
                      >
                        Non
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-red"
                      style={{ padding: '4px 8px' }}
                      onClick={() => setConfirmDelId(r.id)}
                    >
                      🗑 Supprimer
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  Aucun retour enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 680 }}>
            <h3 style={{ marginTop: 0 }}>
              ↩️ Nouveau Retour {retourType === 'vente' ? 'Client' : 'Fournisseur'}
            </h3>
            <form
              onSubmit={submitCreate}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <div className="form-grid">
                <div className="form-field">
                  <label>{retourType === 'vente' ? 'Client' : 'Fournisseur'}</label>
                  <select
                    className="select"
                    value={form.tiers_id}
                    onChange={(e) =>
                      setForm({ ...form, tiers_id: Number(e.target.value) })
                    }
                  >
                    {tiersList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nom} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Date du retour</label>
                  <input
                    type="date"
                    className="input"
                    value={form.date_retour}
                    onChange={(e) =>
                      setForm({ ...form, date_retour: e.target.value })
                    }
                  />
                </div>
                <div className="form-field">
                  <label>Motif</label>
                  <input
                    className="input"
                    value={form.motif}
                    onChange={(e) => setForm({ ...form, motif: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Observations</label>
                  <input
                    className="input"
                    value={form.observations}
                    onChange={(e) =>
                      setForm({ ...form, observations: e.target.value })
                    }
                  />
                </div>
              </div>

              {lignes.map((l, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="select"
                    style={{ flex: 2 }}
                    value={l.produit_id}
                    onChange={(e) => {
                      const pid = Number(e.target.value);
                      const pr = produits.find((p) => p.id === pid);
                      const copy = [...lignes];
                      copy[idx] = {
                        ...copy[idx],
                        produit_id: pid,
                        prix_unitaire: pr
                          ? retourType === 'vente'
                            ? pr.prix_vente
                            : pr.prix_achat
                          : 0,
                      };
                      setLignes(copy);
                    }}
                  >
                    {produits.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.designation} (Stock: {p.stock_actuel})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    style={{ width: 90 }}
                    value={l.quantite}
                    onChange={(e) => {
                      const copy = [...lignes];
                      copy[idx].quantite = Number(e.target.value);
                      setLignes(copy);
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    style={{ width: 100 }}
                    value={l.prix_unitaire}
                    onChange={(e) => {
                      const copy = [...lignes];
                      copy[idx].prix_unitaire = Number(e.target.value);
                      setLignes(copy);
                    }}
                  />
                  {lignes.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-red"
                      style={{ padding: '4px 8px' }}
                      onClick={() =>
                        setLignes(lignes.filter((_, i) => i !== idx))
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
                  produits[0] &&
                  setLignes([
                    ...lignes,
                    {
                      produit_id: produits[0].id,
                      quantite: 1,
                      prix_unitaire:
                        retourType === 'vente'
                          ? produits[0].prix_vente
                          : produits[0].prix_achat,
                    },
                  ])
                }
              >
                + Ajouter Ligne
              </button>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setShowCreate(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-green">
                  Valider le Retour
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editItem && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 460 }}>
            <h3 style={{ marginTop: 0 }}>✏ Modifier — {editItem.numero}</h3>
            <form
              onSubmit={submitEdit}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div className="form-field">
                <label>Date</label>
                <input
                  type="date"
                  className="input"
                  value={editItem.date_retour}
                  onChange={(e) =>
                    setEditItem({ ...editItem, date_retour: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label>Motif</label>
                <input
                  className="input"
                  value={editItem.motif || ''}
                  onChange={(e) =>
                    setEditItem({ ...editItem, motif: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label>Observations</label>
                <input
                  className="input"
                  value={editItem.observations || ''}
                  onChange={(e) =>
                    setEditItem({ ...editItem, observations: e.target.value })
                  }
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setEditItem(null)}
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

      {detailItem && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3 style={{ marginTop: 0 }}>👁 Détail Retour — {detailItem.numero}</h3>
            <p style={{ color: 'var(--muted)' }}>
              Date : {detailItem.date_retour} | Tiers : {detailItem.tiers_nom} |
              Motif : {detailItem.motif || '—'}
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
                  {(detailItem.lignes || []).map((l: any, i: number) => (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Total Avoir : {fmtDA(detailItem.total)}</strong>
              <button className="btn" onClick={() => setDetailItem(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const MOTIFS_RETOUR_VENDEUR: Record<string, string> = {
  INVENDU: 'Invendu',
  CASSE: 'Cassé / abîmé',
  PERIME: 'Périmé / date courte',
  ERREUR_CHARGEMENT: 'Erreur de chargement',
  RETOUR_CLIENT: 'Repris chez un client',
  AUTRE: 'Autre',
};

export function RetoursVendeursPage({ token }: { token: string }) {
  const [data, setData] = useState<{ valeur_depot_achat: number; retours: any[] }>({
    valeur_depot_achat: 0,
    retours: [],
  });
  const [vendeurs, setVendeurs] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [statutFilter, setStatutFilter] = useState('Tous');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [detailRv, setDetailRv] = useState<any>(null);
  const [confirmDecision, setConfirmDecision] = useState<'VENDABLE' | 'CASSE' | 'FOURNISSEUR'>('VENDABLE');
  const [confirmImputation, setConfirmImputation] = useState<'ENTREPRISE' | 'VENDEUR'>('ENTREPRISE');
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState({
    vendeur_id: 1,
    produit_id: 1,
    quantite_colis: '2',
    motif: 'INVENDU',
    observations: '',
  });

  const load = async () => {
    setError(null);
    try {
      const [res, vends, prods] = await Promise.all([
        apiFetch<{ valeur_depot_achat: number; retours: any[] }>(
          '/api/bureau/retours-vendeurs',
          { token }
        ),
        apiFetch<any[]>('/api/bureau/vendeurs', { token }),
        apiFetch<any[]>('/api/bureau/produits', { token }),
      ]);
      setData(res);
      setVendeurs(vends);
      setProduits(prods);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const confirmerRetour = async (id: number) => {
    try {
      await apiFetch(`/api/bureau/retours-vendeurs/${id}/confirmer`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          decision: confirmDecision,
          imputation: confirmImputation,
        }),
      });
      setDetailRv(null);
      setMessage('Retour vendeur confirmé (stock & camion mis à jour).');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur confirmation');
    }
  };

  const rejeterRetour = async (id: number) => {
    try {
      await apiFetch(`/api/bureau/retours-vendeurs/${id}/rejeter`, {
        method: 'POST',
        token,
      });
      setDetailRv(null);
      setMessage('Demande de retour rejetée.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur rejet');
    }
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/bureau/retours-vendeurs', {
        method: 'POST',
        token,
        body: JSON.stringify({
          vendeur_id: newForm.vendeur_id,
          motif: newForm.motif,
          observations: newForm.observations,
          lignes: [
            {
              produit_id: newForm.produit_id,
              quantite_colis: Number(newForm.quantite_colis || 1),
            },
          ],
        }),
      });
      setShowCreate(false);
      setMessage('Demande de retour vendeur enregistrée.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création');
    }
  };

  const rows = data.retours.filter(
    (r) => statutFilter === 'Tous' || r.statut === statutFilter
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">↩️ Retours Vendeurs (Camion → Dépôt)</h2>
          <p className="page-subtitle">
            Situation du dépôt (au prix d&apos;achat) :{' '}
            <strong>{fmtDA(data.valeur_depot_achat)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-green"
            onClick={() => {
              setNewForm({
                vendeur_id: vendeurs[0]?.id || 1,
                produit_id: produits[0]?.id || 1,
                quantite_colis: '2',
                motif: 'INVENDU',
                observations: '',
              });
              setShowCreate(true);
            }}
          >
            + Demande Retour Vendeur
          </button>
          <button className="btn btn-muted" onClick={load}>
            🔄 Actualiser
          </button>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}
      {message && <div className="alert-box alert-success">{message}</div>}

      <div className="toolbar">
        <select
          className="select"
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
        >
          <option value="Tous">Statut : Tous</option>
          <option value="En attente">En attente</option>
          <option value="Confirmé">Confirmé</option>
          <option value="Rejeté">Rejeté</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Date</th>
              <th>Vendeur</th>
              <th>Motif</th>
              <th>Décision / Imputation</th>
              <th>Valeur</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.numero}</strong>
                </td>
                <td>{r.date_retour}</td>
                <td>{r.vendeur_nom}</td>
                <td>{MOTIFS_RETOUR_VENDEUR[r.motif] || r.motif}</td>
                <td>
                  {r.decision} ({r.imputation})
                </td>
                <td>{fmtDA(r.valeur_totale)}</td>
                <td>
                  <span
                    className={`badge ${
                      r.statut === 'Confirmé'
                        ? 'badge-green'
                        : r.statut === 'Rejeté'
                        ? 'badge-red'
                        : 'badge-orange'
                    }`}
                  >
                    {r.statut}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-muted"
                    style={{ padding: '4px 8px' }}
                    onClick={() => {
                      setConfirmDecision(r.decision || 'VENDABLE');
                      setConfirmImputation(r.imputation || 'ENTREPRISE');
                      setDetailRv(r);
                    }}
                  >
                    👁 Détail
                  </button>
                  {r.statut === 'En attente' && (
                    <>
                      <button
                        className="btn btn-green"
                        style={{ padding: '4px 8px' }}
                        onClick={() => {
                          setConfirmDecision(r.decision || 'VENDABLE');
                          setConfirmImputation(r.imputation || 'ENTREPRISE');
                          setDetailRv(r);
                        }}
                      >
                        ✅ Traiter
                      </button>
                      <button
                        className="btn btn-red"
                        style={{ padding: '4px 8px' }}
                        onClick={() => rejeterRetour(r.id)}
                      >
                        ❌ Rejeter
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  Aucune demande de retour vendeur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detailRv && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3 style={{ marginTop: 0 }}>
              👁 Retour Vendeur — {detailRv.numero} ({detailRv.vendeur_nom})
            </h3>
            <p style={{ color: 'var(--muted)' }}>
              Date : {detailRv.date_retour} | Motif :{' '}
              {MOTIFS_RETOUR_VENDEUR[detailRv.motif] || detailRv.motif} | Obs :{' '}
              {detailRv.observations || '—'}
            </p>
            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Colis</th>
                    <th>Pièces</th>
                    <th>P.U. Achat</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailRv.lignes || []).map((l: any, i: number) => (
                    <tr key={i}>
                      <td>{l.designation}</td>
                      <td>{l.quantite_colis}</td>
                      <td>{l.quantite_pieces}</td>
                      <td>{fmtDA(l.prix_unitaire)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detailRv.statut === 'En attente' && (
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="form-field">
                  <label>Décision de réception</label>
                  <select
                    className="select"
                    value={confirmDecision}
                    onChange={(e) =>
                      setConfirmDecision(e.target.value as any)
                    }
                  >
                    <option value="VENDABLE">Remis en stock vendable</option>
                    <option value="CASSE">Casse (stock retours)</option>
                    <option value="FOURNISSEUR">À retourner au fournisseur</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Imputation de la perte éventuelle</label>
                  <select
                    className="select"
                    value={confirmImputation}
                    onChange={(e) =>
                      setConfirmImputation(e.target.value as any)
                    }
                  >
                    <option value="ENTREPRISE">Perte de l&apos;entreprise</option>
                    <option value="VENDEUR">Imputée au vendeur</option>
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-muted" onClick={() => setDetailRv(null)}>
                Fermer
              </button>
              {detailRv.statut === 'En attente' && (
                <>
                  <button
                    className="btn btn-red"
                    onClick={() => rejeterRetour(detailRv.id)}
                  >
                    ❌ Rejeter
                  </button>
                  <button
                    className="btn btn-green"
                    onClick={() => confirmerRetour(detailRv.id)}
                  >
                    ✅ Confirmer le retour
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>+ Demande Retour Vendeur</h3>
            <form
              onSubmit={submitCreate}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div className="form-field">
                <label>Vendeur</label>
                <select
                  className="select"
                  value={newForm.vendeur_id}
                  onChange={(e) =>
                    setNewForm({ ...newForm, vendeur_id: Number(e.target.value) })
                  }
                >
                  {vendeurs.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nom} ({v.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Produit</label>
                <select
                  className="select"
                  value={newForm.produit_id}
                  onChange={(e) =>
                    setNewForm({ ...newForm, produit_id: Number(e.target.value) })
                  }
                >
                  {produits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.designation}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label>Qté (Colis)</label>
                  <input
                    type="number"
                    className="input"
                    value={newForm.quantite_colis}
                    onChange={(e) =>
                      setNewForm({ ...newForm, quantite_colis: e.target.value })
                    }
                  />
                </div>
                <div className="form-field">
                  <label>Motif</label>
                  <select
                    className="select"
                    value={newForm.motif}
                    onChange={(e) =>
                      setNewForm({ ...newForm, motif: e.target.value })
                    }
                  >
                    {Object.entries(MOTIFS_RETOUR_VENDEUR).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label>Observations</label>
                <input
                  className="input"
                  value={newForm.observations}
                  onChange={(e) =>
                    setNewForm({ ...newForm, observations: e.target.value })
                  }
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setShowCreate(false)}
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
