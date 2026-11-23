import React, { useEffect, useState } from 'react';
import { apiFetch, fmtDA } from '../api.ts';

export function VendeurTourneeView({
  token,
  vendeur,
  onLogout,
}: {
  token: string;
  vendeur: { id: number; code: string; nom: string; tel?: string };
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<'camion' | 'clients' | 'pointages'>('camion');
  const [camion, setCamion] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [pointages, setPointages] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newProspect, setNewProspect] = useState({ nom: '', tel: '', adresse: '' });
  const [versClientId, setVersClientId] = useState<number>(0);
  const [versMontant, setVersMontant] = useState('');

  const loadAll = async () => {
    try {
      const [c, cl, pr, pt] = await Promise.all([
        apiFetch<any[]>('/api/portal/tournee/stock-camion', { token }),
        apiFetch<any[]>('/api/portal/clients', { token }),
        apiFetch<any[]>('/api/portal/clients/prospects', { token }),
        apiFetch<any[]>('/api/portal/tournee/pointages', { token }),
      ]);
      setCamion(c);
      setClients(cl);
      setProspects(pr);
      setPointages(pt);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur chargement tournée');
    }
  };

  useEffect(() => {
    loadAll();
  }, [token]);

  const pointerClient = async (client: any) => {
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/api/portal/tournee/pointage-gps', {
        method: 'POST',
        token,
        body: JSON.stringify({
          client_id: client.id,
          latitude: client.latitude ?? 36.7538,
          longitude: client.longitude ?? 3.0588,
          observations: 'Visite terrain',
        }),
      });
      setMsg(`Pointage GPS enregistré pour ${client.nom}.`);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur pointage');
    }
  };

  const creerProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/api/portal/clients/prospect', {
        method: 'POST',
        token,
        body: JSON.stringify(newProspect),
      });
      setNewProspect({ nom: '', tel: '', adresse: '' });
      setMsg('Prospect créé avec succès.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur prospect');
    }
  };

  const encaisserVersement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch('/api/portal/versements', {
        method: 'POST',
        token,
        body: JSON.stringify({
          client_id: versClientId,
          montant: Number(versMontant),
          mode: 'Espèces',
        }),
      });
      setVersMontant('');
      setMsg('Versement encaissé.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur versement');
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>🚚 TOURNÉE VENDEUR</span>
        </div>
        <div className="sidebar-nav">
          <button
            className={`nav-item-btn ${tab === 'camion' ? 'active' : ''}`}
            onClick={() => setTab('camion')}
          >
            📦 Stock Camion
          </button>
          <button
            className={`nav-item-btn ${tab === 'clients' ? 'active' : ''}`}
            onClick={() => setTab('clients')}
          >
            👥 Clients &amp; Prospects
          </button>
          <button
            className={`nav-item-btn ${tab === 'pointages' ? 'active' : ''}`}
            onClick={() => setTab('pointages')}
          >
            📍 Pointages GPS ({pointages.length})
          </button>
        </div>
        <div className="sidebar-footer">
          <div style={{ fontWeight: 700 }}>{vendeur.nom}</div>
          <div style={{ color: 'var(--muted)', marginBottom: 10 }}>
            {vendeur.code}
          </div>
          <button className="btn btn-red" style={{ width: '100%' }} onClick={onLogout}>
            🚪 Déconnexion
          </button>
        </div>
      </aside>

      <main className="main-area">
        {err && <div className="alert-box alert-error">{err}</div>}
        {msg && <div className="alert-box alert-success">{msg}</div>}

        {tab === 'camion' && (
          <>
            <div className="page-header">
              <h2 className="page-title">📦 Stock Embarqué Camion</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Désignation</th>
                    <th>Colis Camion</th>
                    <th>Pièces Camion</th>
                    <th>Stock Dépôt</th>
                    <th>Prix Std</th>
                  </tr>
                </thead>
                <tbody>
                  {camion.map((s) => (
                    <tr key={s.produit_id}>
                      <td>{s.code}</td>
                      <td>{s.designation}</td>
                      <td style={{ fontWeight: 700 }}>{s.quantite_colis}</td>
                      <td>{s.quantite_pieces}</td>
                      <td>{s.stock_depot_pieces} pcs</td>
                      <td>{fmtDA(s.prix_unitaire)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'clients' && (
          <>
            <div className="page-header">
              <h2 className="page-title">👥 Clients &amp; Encaissements Terrain</h2>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 10px' }}>💳 Encaisser un versement client</h4>
              <form
                onSubmit={encaisserVersement}
                style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
              >
                <select
                  className="select"
                  value={versClientId}
                  onChange={(e) => setVersClientId(Number(e.target.value))}
                  required
                >
                  <option value={0}>Choisir un client...</option>
                  {clients
                    .filter((c) => c.solde > 0)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom} (Solde : {fmtDA(c.solde)})
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  className="input"
                  placeholder="Montant (DA)"
                  value={versMontant}
                  onChange={(e) => setVersMontant(e.target.value)}
                  required
                />
                <button className="btn btn-green" type="submit">
                  Encaisser Espèces
                </button>
              </form>
            </div>

            <div className="table-wrap" style={{ marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Client</th>
                    <th>Téléphone</th>
                    <th>Solde Dû</th>
                    <th>Plafond Crédit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => {
                    const plafond = Math.max(0, Number(c.plafond_credit || 0));
                    const solde = Number(c.solde || 0);
                    const taux = plafond > 0 ? Math.round((solde / plafond) * 100) : 0;
                    const depasse = plafond > 0 && solde > plafond;
                    const proche = plafond > 0 && !depasse && taux >= 80;
                    return (
                      <tr key={c.id}>
                        <td>{c.code}</td>
                        <td>{c.nom}</td>
                        <td>{c.tel || '—'}</td>
                        <td style={{ fontWeight: 700 }}>{fmtDA(solde)}</td>
                        <td>
                          {plafond > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12 }}>{fmtDA(plafond)}</span>
                                <span
                                  className={`badge ${
                                    depasse
                                      ? 'badge-red'
                                      : proche
                                      ? 'badge-orange'
                                      : 'badge-green'
                                  }`}
                                >
                                  {depasse ? `Dépassement (${taux}%)` : `${taux}%`}
                                </span>
                                {c.bloquer_si_depasse === 1 && (
                                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                    🔒
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: 12 }}>Illimité</span>
                          )}
                        </td>
                        <td>
                          <button className="btn" onClick={() => pointerClient(c)}>
                            📍 Pointer Visite
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 10px' }}>🎯 Nouveau Prospect Terrain</h4>
              <form
                onSubmit={creerProspect}
                style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
              >
                <input
                  className="input"
                  placeholder="Nom du prospect"
                  value={newProspect.nom}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, nom: e.target.value })
                  }
                  required
                />
                <input
                  className="input"
                  placeholder="Téléphone"
                  value={newProspect.tel}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, tel: e.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder="Adresse"
                  value={newProspect.adresse}
                  onChange={(e) =>
                    setNewProspect({ ...newProspect, adresse: e.target.value })
                  }
                />
                <button className="btn btn-green" type="submit">
                  + Ajouter Prospect
                </button>
              </form>
              <div style={{ marginTop: 12 }}>
                {prospects.map((p) => (
                  <div key={p.id} style={{ padding: '4px 0', fontSize: 12 }}>
                    • <strong>{p.code}</strong> — {p.nom} ({p.tel || 'sans tél'}) —{' '}
                    <span className="badge badge-blue">{p.statut}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'pointages' && (
          <>
            <div className="page-header">
              <h2 className="page-title">📍 Historique Pointages GPS</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date / Heure</th>
                    <th>Client</th>
                    <th>GPS (Lat, Lng)</th>
                    <th>Observations</th>
                  </tr>
                </thead>
                <tbody>
                  {pointages.map((pt) => (
                    <tr key={pt.id}>
                      <td>{pt.date_pointage}</td>
                      <td>{pt.nom_client || pt.code_client}</td>
                      <td>
                        {pt.latitude != null
                          ? `${pt.latitude.toFixed(4)}, ${pt.longitude.toFixed(4)}`
                          : '—'}
                      </td>
                      <td>{pt.observations || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
