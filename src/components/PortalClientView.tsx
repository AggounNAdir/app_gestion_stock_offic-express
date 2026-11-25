import React, { useEffect, useState } from 'react';
import { apiFetch, fmtDA } from '../api.ts';

interface ClientProfile {
  id: number;
  code: string;
  nom: string;
  adresse?: string;
  tel?: string;
  email?: string;
  solde: number;
  plafond_credit?: number;
  bloquer_si_depasse?: number;
  niveau_prix?: string;
}

interface ProduitCat {
  id: number;
  code: string;
  designation: string;
  unite: string;
  facteur_conversion: number;
  prix_unitaire: number;
  stock_actuel: number;
  tva: number;
}

interface CommandeOut {
  id: number;
  numero: string;
  date_commande: string;
  statut: string;
  montant_total: number;
  observations?: string;
  lignes: {
    produit_id: number;
    designation: string;
    quantite: number;
    prix_unitaire: number;
    total: number;
  }[];
}

export function PortalClientView({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<
    'catalogue' | 'commandes' | 'factures' | 'situation'
  >('catalogue');
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [produits, setProduits] = useState<ProduitCat[]>([]);
  const [commandes, setCommandes] = useState<CommandeOut[]>([]);
  const [factures, setFactures] = useState<any[]>([]);
  const [situation, setSituation] = useState<any>(null);
  const [panier, setPanier] = useState<Record<number, number>>({});
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadAll = async () => {
    try {
      const [me, prods, cmds, facs, sit] = await Promise.all([
        apiFetch<ClientProfile>('/api/portal/clients/me', { token }),
        apiFetch<ProduitCat[]>('/api/portal/produits?limit=100', { token }),
        apiFetch<CommandeOut[]>('/api/portal/commandes', { token }),
        apiFetch<any[]>('/api/portal/factures', { token }),
        apiFetch<any>('/api/portal/clients/me/situation', { token }),
      ]);
      setProfile(me);
      setProduits(prods);
      setCommandes(cmds);
      setFactures(facs);
      setSituation(sit);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur chargement portail');
    }
  };

  useEffect(() => {
    loadAll();
  }, [token]);

  const setQty = (pid: number, q: number) => {
    setPanier((prev) => {
      const next = { ...prev };
      if (q <= 0) delete next[pid];
      else next[pid] = q;
      return next;
    });
  };

  const totalPanier = Object.entries(panier).reduce((acc, [pidStr, q]) => {
    const p = produits.find((x) => x.id === Number(pidStr));
    if (!p) return acc;
    return acc + q * (p.facteur_conversion || 1) * p.prix_unitaire;
  }, 0);

  const passerCommande = async () => {
    setErr(null);
    setMsg(null);
    const lignes = Object.entries(panier).map(([pidStr, quantite]) => ({
      produit_id: Number(pidStr),
      quantite,
    }));
    if (lignes.length === 0) return;
    try {
      const created = await apiFetch<CommandeOut & { credit_warning?: string | null }>(
        '/api/portal/commandes',
        {
          method: 'POST',
          token,
          body: JSON.stringify({ lignes, observations: obs }),
        }
      );
      setPanier({});
      setObs('');
      setMsg(
        `Commande ${created.numero} envoyée (${fmtDA(created.montant_total)}).${
          created.credit_warning ? ` ⚠️ ${created.credit_warning}` : ''
        }`
      );
      await loadAll();
      setSection('commandes');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur commande');
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>🌐 PORTAIL CLIENT</span>
        </div>
        <div className="sidebar-nav">
          <button
            className={`nav-item-btn ${section === 'catalogue' ? 'active' : ''}`}
            onClick={() => setSection('catalogue')}
          >
            📦 Catalogue &amp; Commande
          </button>
          <button
            className={`nav-item-btn ${section === 'commandes' ? 'active' : ''}`}
            onClick={() => setSection('commandes')}
          >
            📩 Mes Commandes ({commandes.length})
          </button>
          <button
            className={`nav-item-btn ${section === 'factures' ? 'active' : ''}`}
            onClick={() => setSection('factures')}
          >
            🧾 Mes Factures ({factures.length})
          </button>
          <button
            className={`nav-item-btn ${section === 'situation' ? 'active' : ''}`}
            onClick={() => setSection('situation')}
          >
            📊 Situation de Compte
          </button>
        </div>
        <div className="sidebar-footer">
          {profile && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{profile.nom}</div>
              <div style={{ color: 'var(--muted)' }}>
                {profile.code} • Tarif : {(profile.niveau_prix || 'detail').toUpperCase()}
              </div>
              <div style={{ marginTop: 4, color: 'var(--orange)', fontWeight: 700 }}>
                Solde : {fmtDA(profile.solde)}
              </div>
              {Number(profile.plafond_credit || 0) > 0 && (() => {
                const pct = Math.round(
                  (profile.solde / Number(profile.plafond_credit)) * 100
                );
                const over = profile.solde > Number(profile.plafond_credit);
                return (
                  <div style={{ marginTop: 4, fontSize: 11, color: over ? 'var(--red)' : 'var(--muted)' }}>
                    Plafond : {fmtDA(profile.plafond_credit)} ({pct}%)
                  </div>
                );
              })()}
            </div>
          )}
          <button className="btn btn-red" style={{ width: '100%' }} onClick={onLogout}>
            🚪 Déconnexion
          </button>
        </div>
      </aside>

      <main className="main-area">
        {err && <div className="alert-box alert-error">{err}</div>}
        {msg && <div className="alert-box alert-success">{msg}</div>}

        {section === 'catalogue' && (
          <>
            <div className="page-header">
              <div>
                <h2 className="page-title">📦 Catalogue Tarifs Personnalisés</h2>
                <p className="page-subtitle">
                  Les prix affichés incluent automatiquement votre niveau et vos prix spéciaux
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  placeholder="Rechercher produit..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {Object.keys(panier).length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <strong>Panier en cours :</strong>{' '}
                    {Object.keys(panier).length} produit(s) — Total estimé :{' '}
                    <strong style={{ color: 'var(--green)' }}>{fmtDA(totalPanier)}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="input"
                      placeholder="Observations livraison..."
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                    />
                    <button className="btn btn-green" onClick={passerCommande}>
                      ✔ Envoyer la commande
                    </button>
                  </div>
                </div>
                {profile &&
                  Number(profile.plafond_credit || 0) > 0 &&
                  profile.solde + totalPanier > Number(profile.plafond_credit) && (
                    <div
                      className={`alert-box ${
                        profile.bloquer_si_depasse ? 'alert-error' : 'alert-warn'
                      }`}
                      style={{ marginTop: 10, marginBottom: 0 }}
                    >
                      {profile.bloquer_si_depasse
                        ? '🚫 Plafond de crédit dépassé : '
                        : '⚠️ Avertissement plafond de crédit : '}
                      solde projeté{' '}
                      <strong>{fmtDA(profile.solde + totalPanier)}</strong> &gt; plafond{' '}
                      <strong>{fmtDA(profile.plafond_credit)}</strong>
                      {profile.bloquer_si_depasse
                        ? ' — commande bloquée jusqu’à régularisation.'
                        : '.'}
                    </div>
                  )}
              </div>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Désignation</th>
                    <th>Unité</th>
                    <th>Cond.</th>
                    <th>Prix Unitaire (Pièce)</th>
                    <th>Stock Dispo</th>
                    <th>Qté (Colis)</th>
                  </tr>
                </thead>
                <tbody>
                  {produits
                    .filter(
                      (p) =>
                        !search ||
                        p.designation.toLowerCase().includes(search.toLowerCase()) ||
                        p.code.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((p) => (
                      <tr key={p.id}>
                        <td>{p.code}</td>
                        <td>{p.designation}</td>
                        <td>{p.unite}</td>
                        <td>x{p.facteur_conversion}</td>
                        <td style={{ fontWeight: 700, color: 'var(--green)' }}>
                          {fmtDA(p.prix_unitaire)}
                        </td>
                        <td>{p.stock_actuel} pcs</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="input"
                            style={{ width: 80 }}
                            value={panier[p.id] || ''}
                            placeholder="0"
                            onChange={(e) => setQty(p.id, Number(e.target.value))}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {section === 'commandes' && (
          <>
            <div className="page-header">
              <h2 className="page-title">📩 Mes Commandes Portail</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Montant Total</th>
                    <th>Observations</th>
                  </tr>
                </thead>
                <tbody>
                  {commandes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.numero}</td>
                      <td>{c.date_commande}</td>
                      <td>
                        <span
                          className={`badge ${
                            c.statut === 'Validée'
                              ? 'badge-green'
                              : c.statut === 'Refusée'
                                ? 'badge-red'
                                : 'badge-orange'
                          }`}
                        >
                          {c.statut}
                        </span>
                      </td>
                      <td>{fmtDA(c.montant_total)}</td>
                      <td>{c.observations || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {section === 'factures' && (
          <>
            <div className="page-header">
              <h2 className="page-title">🧾 Mes Factures</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Date</th>
                    <th>HT</th>
                    <th>TVA</th>
                    <th>Total TTC</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {factures.map((f) => (
                    <tr key={f.id}>
                      <td>{f.numero}</td>
                      <td>{f.date_facture}</td>
                      <td>{fmtDA(f.total_ht)}</td>
                      <td>{f.tva}%</td>
                      <td style={{ fontWeight: 700 }}>{fmtDA(f.total_ttc)}</td>
                      <td>
                        <span className="badge badge-blue">{f.statut}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {section === 'situation' && situation && (
          <>
            <div className="page-header">
              <h2 className="page-title">📊 Relevé de Situation</h2>
              <div className="badge badge-orange" style={{ fontSize: 14, padding: '6px 12px' }}>
                Solde Final : {fmtDA(situation.solde_final)}
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Document</th>
                    <th>Libellé</th>
                    <th>Débit</th>
                    <th>Crédit</th>
                    <th>Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {situation.lignes.map((l: any, idx: number) => (
                    <tr key={idx}>
                      <td>{l.date}</td>
                      <td>{l.numero}</td>
                      <td>{l.libelle}</td>
                      <td>{l.debit > 0 ? fmtDA(l.debit) : '—'}</td>
                      <td>{l.credit > 0 ? fmtDA(l.credit) : '—'}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDA(l.solde)}</td>
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
