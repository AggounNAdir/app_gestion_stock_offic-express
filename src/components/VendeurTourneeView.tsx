import React, { useEffect, useRef, useState } from 'react';
import { apiFetch, fmtDA } from '../api.ts';
import { Ticket80mmModal } from './PosCaissePage.tsx';

export function VendeurTourneeView({
  token,
  vendeur,
  onLogout,
}: {
  token: string;
  vendeur: { id: number; code: string; nom: string; tel?: string };
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<'camion' | 'clients' | 'ventes' | 'retours' | 'pointages' | 'situation'>('camion');
  const [camion, setCamion] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [ventesTerrain, setVentesTerrain] = useState<any[]>([]);
  const [retoursVendeur, setRetoursVendeur] = useState<any[]>([]);
  const [motifsRetour, setMotifsRetour] = useState<any[]>([]);
  const [pointages, setPointages] = useState<any[]>([]);
  const [caisseInfo, setCaisseInfo] = useState<any>(null);
  const [mesRemises, setMesRemises] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newProspect, setNewProspect] = useState({ nom: '', tel: '', adresse: '' });
  const [versClientId, setVersClientId] = useState<number>(0);
  const [versMontant, setVersMontant] = useState('');

  // Vente directe form state
  const [venteClientId, setVenteClientId] = useState<number>(0);
  const [venteMontantVerse, setVenteMontantVerse] = useState('');
  const [venteLignes, setVenteLignes] = useState<{ produit_id: number; quantite: number }[]>([]);
  const [selProdId, setSelProdId] = useState<number>(0);
  const [selQte, setSelQte] = useState(1);
  const [ticketBon, setTicketBon] = useState<any>(null);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Retours form state
  const [retourMotif, setRetourMotif] = useState('INVENDU');
  const [retourProdId, setRetourProdId] = useState<number>(0);
  const [retourColis, setRetourColis] = useState(1);
  const [retourLignes, setRetourLignes] = useState<{ produit_id: number; quantite_colis: number; motif: string }[]>([]);

  const loadAll = async () => {
    try {
      const [c, cl, pr, vt, rv, motifs, pt, caisse, remises] = await Promise.all([
        apiFetch<any[]>('/api/portal/tournee/stock-camion', { token }),
        apiFetch<any[]>('/api/portal/clients', { token }),
        apiFetch<any[]>('/api/portal/clients/prospects', { token }),
        apiFetch<any[]>('/api/portal/tournee/ventes', { token }),
        apiFetch<any[]>('/api/portal/tournee/retours-vendeur', { token }),
        apiFetch<any[]>('/api/portal/tournee/retours-vendeur/motifs', { token }),
        apiFetch<any[]>('/api/portal/tournee/pointages', { token }),
        apiFetch<any>('/api/portal/tournee/ma-caisse', { token }),
        apiFetch<any[]>('/api/portal/tournee/mes-remises', { token }),
      ]);
      setCamion(c);
      setClients(cl);
      setProspects(pr);
      setVentesTerrain(vt);
      setRetoursVendeur(rv);
      setMotifsRetour(motifs);
      setPointages(pt);
      setCaisseInfo(caisse);
      setMesRemises(remises);
      if (c.length > 0) {
        if (selProdId === 0) setSelProdId(c[0].produit_id);
        if (retourProdId === 0) setRetourProdId(c[0].produit_id);
      }
      if (cl.length > 0 && venteClientId === 0) setVenteClientId(cl[0].id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur chargement tournée');
    }
  };

  useEffect(() => {
    loadAll();
  }, [token]);

  // Canvas drawing handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, [tab]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

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

  const ajouterLigneVente = () => {
    if (!selProdId || selQte <= 0) return;
    setVenteLignes((prev) => {
      const existing = prev.find((l) => l.produit_id === selProdId);
      if (existing) {
        return prev.map((l) =>
          l.produit_id === selProdId ? { ...l, quantite: l.quantite + selQte } : l
        );
      }
      return [...prev, { produit_id: selProdId, quantite: selQte }];
    });
    setSelQte(1);
  };

  const soumettreVenteTerrain = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (venteLignes.length === 0) {
      setErr('Veuillez ajouter au moins un article à la vente.');
      return;
    }
    try {
      const res = await apiFetch<any>('/api/portal/tournee/vente-directe', {
        method: 'POST',
        token,
        body: JSON.stringify({
          client_id: venteClientId,
          lignes: venteLignes,
          montant_verse: Number(venteMontantVerse || 0),
        }),
      });
      setVenteLignes([]);
      setVenteMontantVerse('');
      clearSignature();
      setMsg(`Vente ${res.numero} enregistrée avec succès (${fmtDA(res.total_ttc)}).`);
      setTicketBon(res);
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur lors de la vente terrain');
    }
  };

  const soumettreRetourTerrain = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (retourLignes.length === 0) {
      setErr('Ajoutez au moins une ligne de retour.');
      return;
    }
    try {
      await apiFetch('/api/portal/tournee/retour-vendeur', {
        method: 'POST',
        token,
        body: JSON.stringify({ lignes: retourLignes, motif: retourMotif }),
      });
      setRetourLignes([]);
      setMsg('Demande de retour / casse enregistrée.');
      await loadAll();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur retour');
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
            className={`nav-item-btn ${tab === 'ventes' ? 'active' : ''}`}
            onClick={() => setTab('ventes')}
          >
            🛍️ Ventes Terrain ({ventesTerrain.length})
          </button>
          <button
            className={`nav-item-btn ${tab === 'retours' ? 'active' : ''}`}
            onClick={() => setTab('retours')}
          >
            ↩️ Retours &amp; Casse ({retoursVendeur.length})
          </button>
          <button
            className={`nav-item-btn ${tab === 'pointages' ? 'active' : ''}`}
            onClick={() => setTab('pointages')}
          >
            📍 Pointages GPS ({pointages.length})
          </button>
          <button
            className={`nav-item-btn ${tab === 'situation' ? 'active' : ''}`}
            onClick={() => setTab('situation')}
          >
            💰 Ma Caisse &amp; Situation Admin
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

        {tab === 'ventes' && (
          <>
            <div className="page-header">
              <h2 className="page-title">🛍️ Gestion &amp; Saisie des Ventes Terrain</h2>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px' }}>➕ Saisir une Vente Directe du Camion</h4>
              <form onSubmit={soumettreVenteTerrain} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Client</label>
                    <select
                      className="select"
                      style={{ width: '100%' }}
                      value={venteClientId}
                      onChange={(e) => setVenteClientId(Number(e.target.value))}
                      required
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: 200 }}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Montant Versé (DA)</label>
                    <input
                      type="number"
                      className="input"
                      style={{ width: '100%' }}
                      placeholder="0"
                      value={venteMontantVerse}
                      onChange={(e) => setVenteMontantVerse(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--bg-subtle)', padding: 12, borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Article du Camion</label>
                    <select
                      className="select"
                      style={{ width: '100%' }}
                      value={selProdId}
                      onChange={(e) => setSelProdId(Number(e.target.value))}
                    >
                      {camion.map((s) => (
                        <option key={s.produit_id} value={s.produit_id}>
                          {s.designation} (Dispo Camion : {s.quantite_colis} colis)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: 120 }}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Quantité (Colis)</label>
                    <input
                      type="number"
                      className="input"
                      style={{ width: '100%' }}
                      min={1}
                      value={selQte}
                      onChange={(e) => setSelQte(Number(e.target.value))}
                    />
                  </div>
                  <button type="button" className="btn btn-primary" onClick={ajouterLigneVente}>
                    + Ajouter au Panier
                  </button>
                </div>

                {venteLignes.length > 0 && (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Désignation</th>
                          <th style={{ textAlign: 'right' }}>Quantité (Colis)</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {venteLignes.map((l) => {
                          const prod = camion.find((s) => s.produit_id === l.produit_id);
                          return (
                            <tr key={l.produit_id}>
                              <td>{prod?.designation || `#${l.produit_id}`}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{l.quantite}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-red"
                                  style={{ padding: '2px 8px', fontSize: 11 }}
                                  onClick={() =>
                                    setVenteLignes(venteLignes.filter((x) => x.produit_id !== l.produit_id))
                                  }
                                >
                                  Retirer
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Signature Électronique / Tactile */}
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>
                    ✍️ Signature Électronique du Client (Tactile / Souris)
                  </label>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: '#fff', display: 'inline-block' }}>
                    <canvas
                      ref={canvasRef}
                      width={320}
                      height={120}
                      style={{ touchAction: 'none', cursor: 'crosshair', display: 'block' }}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <button type="button" className="btn btn-muted" style={{ fontSize: 11, padding: '2px 8px' }} onClick={clearSignature}>
                      Effacer la signature
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button type="submit" className="btn btn-green" disabled={venteLignes.length === 0}>
                    Valider et Enregistrer la Vente Terrain
                  </button>
                </div>
              </form>
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 12px' }}>📋 Historique de mes Ventes Terrain</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>N° Vente</th>
                      <th>Date</th>
                      <th>Client</th>
                      <th style={{ textAlign: 'right' }}>Total TTC</th>
                      <th style={{ textAlign: 'right' }}>Versé</th>
                      <th>Statut</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventesTerrain.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                          Aucune vente enregistrée sur le terrain.
                        </td>
                      </tr>
                    ) : (
                      ventesTerrain.map((v) => (
                        <tr key={v.id}>
                          <td><strong>{v.numero}</strong></td>
                          <td>{v.date_bon}</td>
                          <td>{v.client_nom}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtDA(v.total_ttc || v.total)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--green)' }}>{fmtDA(v.montant_verse)}</td>
                          <td>
                            <span className="badge badge-green">{v.statut}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              onClick={() => setTicketBon(v)}
                            >
                              🖨️ Ticket 80mm
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'retours' && (
          <>
            <div className="page-header">
              <h2 className="page-title">↩️ Gestion des Retours &amp; Casse sur le Terrain</h2>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px' }}>➕ Déclarer un Retour / Casse Camion</h4>
              <form onSubmit={soumettreRetourTerrain} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Motif</label>
                    <select
                      className="select"
                      style={{ width: '100%' }}
                      value={retourMotif}
                      onChange={(e) => setRetourMotif(e.target.value)}
                    >
                      {motifsRetour.map((m) => (
                        <option key={m.code} value={m.code}>
                          {m.libelle}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Article Camion</label>
                    <select
                      className="select"
                      style={{ width: '100%' }}
                      value={retourProdId}
                      onChange={(e) => setRetourProdId(Number(e.target.value))}
                    >
                      {camion.map((s) => (
                        <option key={s.produit_id} value={s.produit_id}>
                          {s.designation} (Colis dispo : {s.quantite_colis})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: 140 }}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Quantité (Colis)</label>
                    <input
                      type="number"
                      className="input"
                      style={{ width: '100%' }}
                      min={1}
                      value={retourColis}
                      onChange={(e) => setRetourColis(Number(e.target.value))}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        if (!retourProdId || retourColis <= 0) return;
                        setRetourLignes([
                          ...retourLignes,
                          { produit_id: retourProdId, quantite_colis: retourColis, motif: retourMotif },
                        ]);
                        setRetourColis(1);
                      }}
                    >
                      + Ajouter
                    </button>
                  </div>
                </div>

                {retourLignes.length > 0 && (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Article</th>
                          <th>Motif</th>
                          <th style={{ textAlign: 'right' }}>Colis</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {retourLignes.map((l, idx) => {
                          const prod = camion.find((s) => s.produit_id === l.produit_id);
                          return (
                            <tr key={idx}>
                              <td>{prod?.designation}</td>
                              <td>{l.motif}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{l.quantite_colis}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-red"
                                  style={{ padding: '2px 8px', fontSize: 11 }}
                                  onClick={() => setRetourLignes(retourLignes.filter((_, i) => i !== idx))}
                                >
                                  Retirer
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button type="submit" className="btn btn-green" disabled={retourLignes.length === 0}>
                    Soumettre le Demande de Retour
                  </button>
                </div>
              </form>
            </div>

            <div className="card">
              <h4 style={{ margin: '0 0 12px' }}>📋 Historique de mes Demandes de Retours</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>N° Retour</th>
                      <th>Date</th>
                      <th>Motif Global</th>
                      <th style={{ textAlign: 'right' }}>Valeur Estimee</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retoursVendeur.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                          Aucun retour enregistré.
                        </td>
                      </tr>
                    ) : (
                      retoursVendeur.map((r) => (
                        <tr key={r.id}>
                          <td><strong>{r.numero}</strong></td>
                          <td>{r.date_demande || r.date_retour}</td>
                          <td>{r.motif}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtDA(r.valeur_totale)}</td>
                          <td>
                            <span className="badge badge-orange">{r.statut}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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

        {tab === 'situation' && (
          <>
            <div className="page-header">
              <h2 className="page-title">💰 Ma Caisse &amp; Situation envers l'Administration</h2>
            </div>

            {caisseInfo && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div className="card" style={{ background: 'var(--bg-subtle)' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total Encaissé (Espèces)</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>
                    {fmtDA(caisseInfo.cumul_encaisse_especes || 0)}
                  </div>
                </div>
                <div className="card" style={{ background: 'var(--bg-subtle)' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Déjà Reversé à l'Admin</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue)', marginTop: 4 }}>
                    {fmtDA(caisseInfo.cumul_verse_admin || 0)}
                  </div>
                </div>
                <div className="card" style={{ background: 'var(--bg-subtle)' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Reste à Reverser (Net Caisse)</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange)', marginTop: 4 }}>
                    {fmtDA(caisseInfo.reste_a_verser || 0)}
                  </div>
                </div>
                <div className="card" style={{ background: 'var(--bg-subtle)' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Valeur Stock Camion</div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                    {fmtDA(caisseInfo.camion_valeur || 0)}
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <h4 style={{ margin: '0 0 12px' }}>📜 Historique des Reversements vers l'Administration</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>N° Pièce</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Montant</th>
                      <th>Mode</th>
                      <th>Statut</th>
                      <th>Observations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mesRemises.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                          Aucun reversement enregistré.
                        </td>
                      </tr>
                    ) : (
                      mesRemises.map((r) => (
                        <tr key={r.id}>
                          <td><strong>{r.numero}</strong></td>
                          <td>{r.date_vers}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtDA(r.montant)}</td>
                          <td>{r.mode}</td>
                          <td>
                            <span className="badge badge-green">{r.statut}</span>
                          </td>
                          <td>{r.observations || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Ticket 80mm Modal for Terrain Sales */}
      {ticketBon && (
        <Ticket80mmModal bon={ticketBon} onClose={() => setTicketBon(null)} />
      )}
    </div>
  );
}
