import React, { useEffect, useState } from 'react';
import { apiFetch, fmtDA } from '../api.ts';

export function VendeursPage({ token }: { token: string }) {
  const [vendeurs, setVendeurs] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fiche, setFiche] = useState<any>(null);
  const [ficheTab, setFicheTab] = useState<
    'camion' | 'chargements' | 'dechargements' | 'versements'
  >('camion');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showVendeurModal, setShowVendeurModal] = useState(false);
  const [editingVendeur, setEditingVendeur] = useState<any>(null);
  const [vForm, setVForm] = useState({ code: '', nom: '', tel: '', password: '' });

  const [showVersModal, setShowVersModal] = useState(false);
  const [versForm, setVersForm] = useState({
    montant: '',
    mode: 'Espèces',
    reference: '',
    observations: '',
  });

  const [showDechargeModal, setShowDechargeModal] = useState(false);
  const [dechargeLignes, setDechargeLignes] = useState<
    { produit_id: number; designation: string; theorique_pieces: number; reel_pieces: number }[]
  >([]);
  const [dechargeObs, setDechargeObs] = useState('');

  const load = async () => {
    setError(null);
    try {
      const list = await apiFetch<any[]>('/api/bureau/vendeurs', { token });
      setVendeurs(list);
      const target = selectedId || list[0]?.id || null;
      if (target) {
        setSelectedId(target);
        setFiche(await apiFetch(`/api/bureau/vendeurs/${target}/fiche`, { token }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const selectVendeur = async (id: number) => {
    setSelectedId(id);
    try {
      setFiche(await apiFetch(`/api/bureau/vendeurs/${id}/fiche`, { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur fiche vendeur');
    }
  };

  const submitVendeur = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVendeur) {
        await apiFetch(`/api/bureau/vendeurs/${editingVendeur.id}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(vForm),
        });
        setMessage('Vendeur mis à jour.');
      } else {
        await apiFetch('/api/bureau/vendeurs', {
          method: 'POST',
          token,
          body: JSON.stringify(vForm),
        });
        setMessage('Vendeur créé.');
      }
      setShowVendeurModal(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur vendeur');
    }
  };

  const toggleActif = async (v: any) => {
    try {
      await apiFetch(`/api/bureau/vendeurs/${v.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ actif: v.actif ? 0 : 1 }),
      });
      setMessage(v.actif ? 'Vendeur désactivé.' : 'Vendeur réactivé.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const submitVersementVendeur = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      await apiFetch('/api/bureau/versements-unifies', {
        method: 'POST',
        token,
        body: JSON.stringify({
          type: 'vendeur',
          tiers_id: selectedId,
          montant: Number(versForm.montant),
          mode: versForm.mode,
          reference: versForm.reference,
          observations: versForm.observations,
        }),
      });
      setShowVersModal(false);
      setMessage('Versement vendeur enregistré.');
      await selectVendeur(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur versement');
    }
  };

  const annulerVersementVendeur = async (id: number) => {
    try {
      await apiFetch(`/api/bureau/versements-vendeurs/${id}/annuler`, {
        method: 'POST',
        token,
      });
      setMessage('Versement vendeur annulé.');
      if (selectedId) await selectVendeur(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const openDecharge = () => {
    const items = (fiche?.stock_camion || []).filter((s: any) => s.quantite_pieces > 0);
    setDechargeLignes(
      items.map((s: any) => ({
        produit_id: s.produit_id,
        designation: s.designation,
        theorique_pieces: s.quantite_pieces,
        reel_pieces: s.quantite_pieces,
      }))
    );
    setDechargeObs('');
    setShowDechargeModal(true);
  };

  const submitDecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      await apiFetch('/api/bureau/dechargements', {
        method: 'POST',
        token,
        body: JSON.stringify({
          vendeur_id: selectedId,
          observations: dechargeObs,
          lignes: dechargeLignes,
        }),
      });
      setShowDechargeModal(false);
      setMessage('Demande de déchargement créée (en attente de validation).');
      await selectVendeur(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur déchargement');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">👔 Vendeurs &amp; Fiche Tournée</h2>
          <p className="page-subtitle">
            Gestion des vendeurs, accès portail, stock camion, déchargements et versements recette.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-green"
            onClick={() => {
              setEditingVendeur(null);
              setVForm({ code: '', nom: '', tel: '', password: '' });
              setShowVendeurModal(true);
            }}
          >
            🆕 Nouveau Vendeur
          </button>
          <button className="btn btn-muted" onClick={() => window.print()}>
            🖨 Imprimer la situation
          </button>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}
      {message && <div className="alert-box alert-success">{message}</div>}

      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Téléphone</th>
              <th>CA Réalisé</th>
              <th>Nb Ventes</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendeurs.map((v) => (
              <tr
                key={v.id}
                style={{
                  background:
                    selectedId === v.id ? 'rgba(59, 130, 246, 0.14)' : undefined,
                }}
              >
                <td>
                  <strong>{v.code}</strong>
                </td>
                <td>{v.nom}</td>
                <td>{v.tel || '—'}</td>
                <td style={{ fontWeight: 700 }}>{fmtDA(v.ca_total)}</td>
                <td>{v.nb_ventes}</td>
                <td>
                  <span
                    className={`badge ${v.actif ? 'badge-green' : 'badge-red'}`}
                  >
                    {v.actif ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    style={{ padding: '4px 9px' }}
                    onClick={() => selectVendeur(v.id)}
                  >
                    📊 Fiche
                  </button>
                  <button
                    className="btn btn-muted"
                    style={{ padding: '4px 9px' }}
                    onClick={() => {
                      setEditingVendeur(v);
                      setVForm({
                        code: v.code,
                        nom: v.nom,
                        tel: v.tel || '',
                        password: '',
                      });
                      setShowVendeurModal(true);
                    }}
                  >
                    ✏ Modifier / 🔑 MDP
                  </button>
                  <button
                    className="btn btn-orange"
                    style={{ padding: '4px 9px' }}
                    onClick={() => toggleActif(v)}
                  >
                    {v.actif ? '🔒 Désactiver' : '▶ Activer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fiche && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>
              📋 Dossier Vendeur — {fiche.vendeur.nom} ({fiche.vendeur.code})
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-orange" onClick={openDecharge}>
                ↩️ Décharger le camion
              </button>
              <button
                className="btn btn-green"
                onClick={() => {
                  setVersForm({
                    montant: '',
                    mode: 'Espèces',
                    reference: '',
                    observations: '',
                  });
                  setShowVersModal(true);
                }}
              >
                ➕ Nouveau versement vendeur
              </button>
            </div>
          </div>

          <div className="kpi-grid" style={{ marginBottom: 14 }}>
            <div className="card">
              <div className="kpi-label">CA Tournée</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>
                {fmtDA(fiche.kpis.ca_total)}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">Recette Versée</div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>
                {fmtDA(fiche.kpis.total_verse_vendeur)}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">Stock Camion Valorisé</div>
              <div className="kpi-value" style={{ color: 'var(--orange)' }}>
                {fmtDA(fiche.kpis.valeur_camion)}
              </div>
            </div>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={`tab-btn ${ficheTab === 'camion' ? 'active' : ''}`}
              onClick={() => setFicheTab('camion')}
            >
              🚚 Stock Camion ({fiche.stock_camion.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${ficheTab === 'chargements' ? 'active' : ''}`}
              onClick={() => setFicheTab('chargements')}
            >
              📦 Chargements ({fiche.chargements.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${ficheTab === 'dechargements' ? 'active' : ''}`}
              onClick={() => setFicheTab('dechargements')}
            >
              ↩️ Déchargements ({fiche.dechargements.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${ficheTab === 'versements' ? 'active' : ''}`}
              onClick={() => setFicheTab('versements')}
            >
              💳 Versements ({fiche.versements.length})
            </button>
          </div>

          {ficheTab === 'camion' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Produit</th>
                    <th>Colis</th>
                    <th>Pièces</th>
                    <th>Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  {fiche.stock_camion.map((s: any) => (
                    <tr key={s.id}>
                      <td>{s.code}</td>
                      <td>{s.designation}</td>
                      <td>{s.quantite_colis}</td>
                      <td style={{ fontWeight: 700 }}>{s.quantite_pieces}</td>
                      <td>{fmtDA(s.valeur)}</td>
                    </tr>
                  ))}
                  {fiche.stock_camion.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        Camion vide.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {ficheTab === 'chargements' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Date</th>
                    <th>Colis</th>
                    <th>Pièces</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {fiche.chargements.map((c: any) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.numero}</strong>
                      </td>
                      <td>{c.date_chargement}</td>
                      <td>{c.total_colis}</td>
                      <td>{c.total_pieces}</td>
                      <td>
                        <span
                          className={`badge ${
                            c.statut === 'Annulé' ? 'badge-red' : 'badge-green'
                          }`}
                        >
                          {c.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ficheTab === 'dechargements' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Date</th>
                    <th>Articles</th>
                    <th>Statut</th>
                    <th>Observations</th>
                  </tr>
                </thead>
                <tbody>
                  {fiche.dechargements.map((d: any) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.numero}</strong>
                      </td>
                      <td>{d.date_dechargement}</td>
                      <td>{d.lignes.length} ligne(s)</td>
                      <td>
                        <span
                          className={`badge ${
                            d.statut === 'Validé'
                              ? 'badge-green'
                              : d.statut === 'Rejeté'
                              ? 'badge-red'
                              : 'badge-orange'
                          }`}
                        >
                          {d.statut}
                        </span>
                      </td>
                      <td>{d.observations || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ficheTab === 'versements' && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Date</th>
                    <th>Mode</th>
                    <th>Montant</th>
                    <th>Référence</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {fiche.versements.map((vv: any) => (
                    <tr key={vv.id}>
                      <td>
                        <strong>{vv.numero}</strong>
                      </td>
                      <td>{vv.date_vers}</td>
                      <td>{vv.mode}</td>
                      <td style={{ fontWeight: 700, color: 'var(--green)' }}>
                        {fmtDA(vv.montant)}
                      </td>
                      <td>{vv.reference || '—'}</td>
                      <td>
                        <span
                          className={`badge ${
                            vv.statut === 'Annulé' ? 'badge-red' : 'badge-green'
                          }`}
                        >
                          {vv.statut}
                        </span>
                      </td>
                      <td>
                        {vv.statut !== 'Annulé' && (
                          <button
                            className="btn btn-red"
                            style={{ padding: '4px 8px' }}
                            onClick={() => annulerVersementVendeur(vv.id)}
                          >
                            ⛔ Annuler
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showVendeurModal && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 460 }}>
            <h3 style={{ marginTop: 0 }}>
              {editingVendeur
                ? `✏ Modifier Vendeur — ${editingVendeur.code}`
                : '🆕 Nouveau Vendeur'}
            </h3>
            <form
              onSubmit={submitVendeur}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {!editingVendeur && (
                <div className="form-field">
                  <label>Code (auto si vide)</label>
                  <input
                    className="input"
                    value={vForm.code}
                    onChange={(e) => setVForm({ ...vForm, code: e.target.value })}
                  />
                </div>
              )}
              <div className="form-field">
                <label>Nom complet *</label>
                <input
                  className="input"
                  value={vForm.nom}
                  onChange={(e) => setVForm({ ...vForm, nom: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label>Téléphone</label>
                <input
                  className="input"
                  value={vForm.tel}
                  onChange={(e) => setVForm({ ...vForm, tel: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>
                  {editingVendeur
                    ? '🔑 Nouveau mot de passe portail (laisser vide pour conserver)'
                    : '🔑 Mot de passe portail (défaut: vendeur123)'}
                </label>
                <input
                  type="password"
                  className="input"
                  value={vForm.password}
                  onChange={(e) =>
                    setVForm({ ...vForm, password: e.target.value })
                  }
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setShowVendeurModal(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-green">
                  💾 Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showVersModal && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 440 }}>
            <h3 style={{ marginTop: 0 }}>➕ Nouveau Versement Vendeur</h3>
            <form
              onSubmit={submitVersementVendeur}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div className="form-field">
                <label>Montant (DA) *</label>
                <input
                  type="number"
                  className="input"
                  value={versForm.montant}
                  onChange={(e) =>
                    setVersForm({ ...versForm, montant: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-field">
                <label>Mode de règlement</label>
                <select
                  className="select"
                  value={versForm.mode}
                  onChange={(e) =>
                    setVersForm({ ...versForm, mode: e.target.value })
                  }
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Virement">Virement</option>
                </select>
              </div>
              <div className="form-field">
                <label>Référence</label>
                <input
                  className="input"
                  value={versForm.reference}
                  onChange={(e) =>
                    setVersForm({ ...versForm, reference: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label>Observations</label>
                <input
                  className="input"
                  value={versForm.observations}
                  onChange={(e) =>
                    setVersForm({ ...versForm, observations: e.target.value })
                  }
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setShowVersModal(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-green">
                  ✅ Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDechargeModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3 style={{ marginTop: 0 }}>
              ↩️ Décharger le camion — {fiche?.vendeur?.nom}
            </h3>
            <form
              onSubmit={submitDecharge}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {dechargeLignes.length === 0 ? (
                <div style={{ color: 'var(--muted)' }}>
                  Aucun stock restant dans le camion.
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Théorique (pcs)</th>
                        <th>Réel compté (pcs)</th>
                        <th>Écart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dechargeLignes.map((l, idx) => (
                        <tr key={l.produit_id}>
                          <td>{l.designation}</td>
                          <td>{l.theorique_pieces}</td>
                          <td>
                            <input
                              type="number"
                              className="input"
                              style={{ width: 90 }}
                              value={l.reel_pieces}
                              onChange={(e) => {
                                const copy = [...dechargeLignes];
                                copy[idx].reel_pieces = Number(e.target.value);
                                setDechargeLignes(copy);
                              }}
                            />
                          </td>
                          <td
                            style={{
                              fontWeight: 700,
                              color:
                                l.reel_pieces - l.theorique_pieces < 0
                                  ? 'var(--red)'
                                  : 'var(--green)',
                            }}
                          >
                            {l.reel_pieces - l.theorique_pieces}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="form-field">
                <label>Observations fin de tournée</label>
                <input
                  className="input"
                  value={dechargeObs}
                  onChange={(e) => setDechargeObs(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  onClick={() => setShowDechargeModal(false)}
                >
                  Annuler
                </button>
                {dechargeLignes.length > 0 && (
                  <button type="submit" className="btn btn-green">
                    ✅ Créer Bon de Déchargement
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function ChargementsPage({ token }: { token: string }) {
  const [chgs, setChgs] = useState<any[]>([]);
  const [decharges, setDecharges] = useState<any[]>([]);
  const [vends, setVends] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [vendeurId, setVendeurId] = useState(1);
  const [obs, setObs] = useState('');
  const [lignes, setLignes] = useState<{ produit_id: number; quantite_colis: number }[]>([
    { produit_id: 1, quantite_colis: 5 },
  ]);
  const [detailChg, setDetailChg] = useState<any>(null);
  const [detailDec, setDetailDec] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [c, d, v, p] = await Promise.all([
        apiFetch<any[]>('/api/bureau/chargements', { token }),
        apiFetch<any[]>('/api/bureau/dechargements', { token }),
        apiFetch<any[]>('/api/bureau/vendeurs', { token }),
        apiFetch<any[]>('/api/bureau/produits', { token }),
      ]);
      setChgs(c);
      setDecharges(d);
      setVends(v);
      setProds(p);
      if (v[0] && !vendeurId) setVendeurId(v[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const submitChargement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/bureau/chargements', {
        method: 'POST',
        token,
        body: JSON.stringify({
          vendeur_id: vendeurId,
          observations: obs,
          lignes,
        }),
      });
      setMessage('Bon de chargement validé et camion chargé.');
      setObs('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    }
  };

  const annulerChg = async (id: number) => {
    try {
      await apiFetch(`/api/bureau/chargements/${id}/annuler`, {
        method: 'POST',
        token,
      });
      setMessage('Chargement annulé (stock dépôt et camion rétablis).');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const supprimerChg = async (id: number) => {
    try {
      await apiFetch(`/api/bureau/chargements/${id}`, {
        method: 'DELETE',
        token,
      });
      setMessage('Bon de chargement supprimé.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const traiterDecharge = async (id: number, action: 'valider' | 'rejeter') => {
    try {
      await apiFetch(`/api/bureau/dechargements/${id}/${action}`, {
        method: 'POST',
        token,
      });
      setDetailDec(null);
      setMessage(
        action === 'valider'
          ? 'Déchargement validé (marchandise réintégrée au dépôt).'
          : 'Déchargement rejeté.'
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur traitement');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">🚚 Bons de Chargement &amp; Déchargements</h2>
          <p className="page-subtitle">
            Transferts dépôt vers camion vendeur et contrôle des écarts de fin de tournée.
          </p>
        </div>
        <button className="btn btn-muted" onClick={load}>
          🔄 Actualiser
        </button>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}
      {message && <div className="alert-box alert-success">{message}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 10px' }}>
          Nouveau chargement — Dépôt vers camion
        </h4>
        <form
          onSubmit={submitChargement}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="select"
              value={vendeurId}
              onChange={(e) => setVendeurId(Number(e.target.value))}
            >
              {vends.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nom} ({v.code})
                </option>
              ))}
            </select>
            <input
              className="input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="Observations tournée..."
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>

          {lignes.map((l, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="select"
                style={{ flex: 2 }}
                value={l.produit_id}
                onChange={(e) => {
                  const copy = [...lignes];
                  copy[idx].produit_id = Number(e.target.value);
                  setLignes(copy);
                }}
              >
                {prods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.designation} (Dépôt: {p.stock_actuel} pcs | x{p.facteur_conversion})
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="input"
                style={{ width: 95 }}
                placeholder="Colis"
                value={l.quantite_colis}
                onChange={(e) => {
                  const copy = [...lignes];
                  copy[idx].quantite_colis = Number(e.target.value);
                  setLignes(copy);
                }}
              />
              {lignes.length > 1 && (
                <button
                  type="button"
                  className="btn btn-red"
                  style={{ padding: '4px 8px' }}
                  onClick={() => setLignes(lignes.filter((_, i) => i !== idx))}
                >
                  Retirer
                </button>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-muted"
              onClick={() =>
                prods[0] &&
                setLignes([
                  ...lignes,
                  { produit_id: prods[0].id, quantite_colis: 1 },
                ])
              }
            >
              + Ajouter une ligne
            </button>
            <button type="submit" className="btn btn-green">
              ✅ Valider le bon et charger le camion
            </button>
          </div>
        </form>
      </div>

      <h3 style={{ margin: '12px 0 8px' }}>Suivi des bons de chargement</h3>
      <div className="table-wrap" style={{ marginBottom: 20 }}>
        <table>
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Date</th>
              <th>Vendeur</th>
              <th>Colis</th>
              <th>Pièces</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {chgs.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.numero}</strong>
                </td>
                <td>{c.date_chargement}</td>
                <td>{c.vendeur_nom}</td>
                <td>{c.total_colis}</td>
                <td>{c.total_pieces}</td>
                <td>
                  <span
                    className={`badge ${
                      c.statut === 'Annulé' ? 'badge-red' : 'badge-green'
                    }`}
                  >
                    {c.statut}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-muted"
                    style={{ padding: '4px 8px' }}
                    onClick={() => setDetailChg(c)}
                  >
                    👁 Détail / Imprimer
                  </button>
                  {c.statut !== 'Annulé' && (
                    <button
                      className="btn btn-orange"
                      style={{ padding: '4px 8px' }}
                      onClick={() => annulerChg(c.id)}
                    >
                      ⛔ Annuler
                    </button>
                  )}
                  <button
                    className="btn btn-red"
                    style={{ padding: '4px 8px' }}
                    onClick={() => supprimerChg(c.id)}
                  >
                    🗑 Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: '12px 0 8px' }}>
        Déchargements de fin de tournée — contrôle des écarts
      </h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Date</th>
              <th>Vendeur</th>
              <th>Écart Global (pcs)</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {decharges.map((d) => {
              const ecartTotal = (d.lignes || []).reduce(
                (a: number, l: any) => a + Number(l.ecart_pieces || 0),
                0
              );
              return (
                <tr key={d.id}>
                  <td>
                    <strong>{d.numero}</strong>
                  </td>
                  <td>{d.date_dechargement}</td>
                  <td>{d.vendeur_nom}</td>
                  <td
                    style={{
                      fontWeight: 700,
                      color: ecartTotal < 0 ? 'var(--red)' : 'var(--green)',
                    }}
                  >
                    {ecartTotal}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        d.statut === 'Validé'
                          ? 'badge-green'
                          : d.statut === 'Rejeté'
                          ? 'badge-red'
                          : 'badge-orange'
                      }`}
                    >
                      {d.statut}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-muted"
                      style={{ padding: '4px 8px' }}
                      onClick={() => setDetailDec(d)}
                    >
                      👁 Détail
                    </button>
                    {d.statut === 'En attente' && (
                      <>
                        <button
                          className="btn btn-green"
                          style={{ padding: '4px 8px' }}
                          onClick={() => traiterDecharge(d.id, 'valider')}
                        >
                          ✅ Valider
                        </button>
                        <button
                          className="btn btn-red"
                          style={{ padding: '4px 8px' }}
                          onClick={() => traiterDecharge(d.id, 'rejeter')}
                        >
                          ❌ Rejeter
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {decharges.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  Aucun déchargement enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detailChg && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ marginTop: 0 }}>👁 Chargement — {detailChg.numero}</h3>
              <button className="btn btn-muted" onClick={() => window.print()}>
                🖨 Imprimer
              </button>
            </div>
            <p style={{ color: 'var(--muted)' }}>
              Vendeur : {detailChg.vendeur_nom} | Date : {detailChg.date_chargement}
            </p>
            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Colis</th>
                    <th>Pièces</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailChg.lignes || []).map((l: any, i: number) => (
                    <tr key={i}>
                      <td>{l.designation}</td>
                      <td>{l.quantite_colis}</td>
                      <td>{l.quantite_pieces}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setDetailChg(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {detailDec && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3 style={{ marginTop: 0 }}>
              👁 Déchargement — {detailDec.numero} ({detailDec.vendeur_nom})
            </h3>
            <div className="table-wrap" style={{ marginBottom: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Théorique</th>
                    <th>Réel</th>
                    <th>Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailDec.lignes || []).map((l: any, i: number) => (
                    <tr key={i}>
                      <td>{l.designation}</td>
                      <td>{l.theorique_pieces}</td>
                      <td>{l.reel_pieces}</td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: l.ecart_pieces < 0 ? 'var(--red)' : 'var(--green)',
                        }}
                      >
                        {l.ecart_pieces}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-muted" onClick={() => setDetailDec(null)}>
                Fermer
              </button>
              {detailDec.statut === 'En attente' && (
                <>
                  <button
                    className="btn btn-red"
                    onClick={() => traiterDecharge(detailDec.id, 'rejeter')}
                  >
                    ❌ Rejeter
                  </button>
                  <button
                    className="btn btn-green"
                    onClick={() => traiterDecharge(detailDec.id, 'valider')}
                  >
                    ✅ Valider le déchargement
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
