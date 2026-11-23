import React, { useEffect, useState } from 'react';
import { apiFetch, fmtDA } from '../api.ts';

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function StatistiquesPage({ token }: { token: string }) {
  const [tab, setTab] = useState<'global' | 'ventes' | 'achats' | 'analyse'>('global');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [produits, setProduits] = useState<any[]>([]);
  const [selectedProdIds, setSelectedProdIds] = useState<number[]>([]);
  const [tauxPartenaire, setTauxPartenaire] = useState('50');
  const [analyseResult, setAnalyseResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async (d = du, a = au) => {
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (d) qs.set('du', d);
      if (a) qs.set('au', a);
      const qStr = qs.toString() ? `?${qs.toString()}` : '';
      const [ov, det, prods] = await Promise.all([
        apiFetch('/api/bureau/statistiques', { token }),
        apiFetch(`/api/bureau/statistiques-detaillees${qStr}`, { token }),
        apiFetch<any[]>('/api/bureau/produits', { token }),
      ]);
      setOverview(ov);
      setDetail(det);
      setProduits(prods);
      if (selectedProdIds.length === 0 && prods.length > 0) {
        setSelectedProdIds(prods.map((p) => p.id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur statistiques');
    }
  };

  useEffect(() => {
    loadAll();
  }, [token]);

  const lancerAnalyse = async () => {
    setError(null);
    try {
      const res = await apiFetch('/api/bureau/analyse-produits', {
        method: 'POST',
        token,
        body: JSON.stringify({
          produit_ids: selectedProdIds,
          du,
          au,
          taux_partenaire: Number(tauxPartenaire || 50),
        }),
      });
      setAnalyseResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur analyse');
    }
  };

  const exportCsv = (rows: any[], headers: string[], filename: string) => {
    const csv = [
      headers.join(';'),
      ...rows.map((r) => headers.map((h) => r[h] ?? '').join(';')),
    ].join('\n');
    downloadBlob('\ufeff' + csv, filename, 'text/csv;charset=utf-8;');
  };

  const exportHtml = (title: string, rowsHtml: string, filename: string) => {
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Segoe UI,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f1f5f9}</style></head><body><h2>${title}</h2>${rowsHtml}</body></html>`;
    downloadBlob(html, filename, 'text/html;charset=utf-8;');
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">📊 Statistiques &amp; Analyse Commerciale</h2>
          <p className="page-subtitle">
            Synthèse globale, suivi commercial vendeurs, ventes/achats détaillés et analyse produits partenaire.
          </p>
        </div>
        <button className="btn btn-muted" onClick={() => window.print()}>
          🖨 Imprimer
        </button>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab-btn ${tab === 'global' ? 'active' : ''}`}
          onClick={() => setTab('global')}
        >
          📈 Synthèse &amp; Suivi Commercial
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === 'ventes' ? 'active' : ''}`}
          onClick={() => setTab('ventes')}
        >
          🏷️ Statistiques Ventes
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === 'achats' ? 'active' : ''}`}
          onClick={() => setTab('achats')}
        >
          🛒 Statistiques Achats
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === 'analyse' ? 'active' : ''}`}
          onClick={() => setTab('analyse')}
        >
          🔬 Analyse Produits &amp; Partenaire
        </button>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}

      <div className="toolbar">
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>📅 Du :</span>
        <input
          type="date"
          className="input"
          value={du}
          onChange={(e) => setDu(e.target.value)}
        />
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>Au :</span>
        <input
          type="date"
          className="input"
          value={au}
          onChange={(e) => setAu(e.target.value)}
        />
        <button className="btn" onClick={() => loadAll(du, au)}>
          📊 Appliquer
        </button>
        <button
          className="btn btn-muted"
          onClick={() => {
            setDu('');
            setAu('');
            loadAll('', '');
          }}
        >
          🔄 Réinitialiser
        </button>
      </div>

      {tab === 'global' && overview && detail && (
        <>
          <div className="kpi-grid">
            <div className="card">
              <div className="kpi-label">CA Total Ventes</div>
              <div className="kpi-value" style={{ color: 'var(--green)' }}>
                {fmtDA(overview.ca_total)}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">Total Achats</div>
              <div className="kpi-value" style={{ color: 'var(--orange)' }}>
                {fmtDA(overview.achats_total)}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">Valeur Stock (PMP)</div>
              <div className="kpi-value" style={{ color: 'var(--accent)' }}>
                {fmtDA(overview.valeur_stock)}
              </div>
            </div>
          </div>

          <h3 style={{ margin: '12px 0 8px' }}>👔 Suivi Commercial par Vendeur</h3>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Vendeur</th>
                  <th>Nbr Ventes</th>
                  <th>Chiffre d&apos;Affaires</th>
                  <th>Espèces Encaissées</th>
                  <th>Crédit Restant</th>
                </tr>
              </thead>
              <tbody>
                {detail.suivi_commercial.map((s: any) => (
                  <tr key={s.vendeur_id}>
                    <td>{s.code}</td>
                    <td>
                      <strong>{s.nom}</strong>
                    </td>
                    <td>{s.nb_ventes}</td>
                    <td style={{ fontWeight: 700 }}>{fmtDA(s.ca_total)}</td>
                    <td style={{ color: 'var(--green)' }}>{fmtDA(s.especes_encaissees)}</td>
                    <td style={{ color: 'var(--orange)' }}>{fmtDA(s.credit_restant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ margin: '12px 0 8px' }}>🏆 Top Produits Vendus</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Produit</th>
                  <th>Qté Vendue</th>
                  <th>CA Généré</th>
                </tr>
              </thead>
              <tbody>
                {overview.top_produits.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.code}</td>
                    <td>{p.designation}</td>
                    <td>{p.qte_vendue}</td>
                    <td style={{ fontWeight: 700 }}>{fmtDA(p.ca)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'ventes' && detail && (
        <>
          <div className="toolbar">
            <button
              className="btn btn-muted"
              onClick={() =>
                exportCsv(
                  detail.ventes_par_client,
                  ['code', 'nom', 'nb_bons', 'ca_total', 'verse', 'reste'],
                  'stats_ventes.csv'
                )
              }
            >
              📥 Exporter CSV
            </button>
            <button
              className="btn btn-muted"
              onClick={() =>
                exportHtml(
                  'Statistiques Ventes par Client',
                  `<table><tr><th>Code</th><th>Client</th><th>Bons</th><th>CA</th><th>Versé</th><th>Reste</th></tr>${detail.ventes_par_client
                    .map(
                      (v: any) =>
                        `<tr><td>${v.code}</td><td>${v.nom}</td><td>${v.nb_bons}</td><td>${fmtDA(v.ca_total)}</td><td>${fmtDA(v.verse)}</td><td>${fmtDA(v.reste)}</td></tr>`
                    )
                    .join('')}</table>`,
                  'stats_ventes.html'
                )
              }
            >
              📄 Exporter HTML
            </button>
          </div>
          <div className="card" style={{ marginBottom: 14 }}>
            Total Ventes sur la période : <strong>{fmtDA(detail.ventes_total)}</strong> ({detail.nb_ventes} bons)
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Client</th>
                  <th>Nb Bons</th>
                  <th>CA Total</th>
                  <th>Versé</th>
                  <th>Reste</th>
                </tr>
              </thead>
              <tbody>
                {detail.ventes_par_client.map((v: any) => (
                  <tr key={v.client_id}>
                    <td>{v.code}</td>
                    <td>
                      <strong>{v.nom}</strong>
                    </td>
                    <td>{v.nb_bons}</td>
                    <td style={{ fontWeight: 700 }}>{fmtDA(v.ca_total)}</td>
                    <td style={{ color: 'var(--green)' }}>{fmtDA(v.verse)}</td>
                    <td style={{ color: 'var(--orange)' }}>{fmtDA(v.reste)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'achats' && detail && (
        <>
          <div className="toolbar">
            <button
              className="btn btn-muted"
              onClick={() =>
                exportCsv(
                  detail.achats_par_fournisseur,
                  ['code', 'nom', 'nb_bons', 'total_achats'],
                  'stats_achats.csv'
                )
              }
            >
              📥 Exporter CSV
            </button>
            <button
              className="btn btn-muted"
              onClick={() =>
                exportHtml(
                  'Statistiques Achats par Fournisseur',
                  `<table><tr><th>Code</th><th>Fournisseur</th><th>Bons</th><th>Total Achats</th></tr>${detail.achats_par_fournisseur
                    .map(
                      (a: any) =>
                        `<tr><td>${a.code}</td><td>${a.nom}</td><td>${a.nb_bons}</td><td>${fmtDA(a.total_achats)}</td></tr>`
                    )
                    .join('')}</table>`,
                  'stats_achats.html'
                )
              }
            >
              📄 Exporter HTML
            </button>
          </div>
          <div className="card" style={{ marginBottom: 14 }}>
            Total Achats sur la période : <strong>{fmtDA(detail.achats_total)}</strong> ({detail.nb_achats} bons)
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Fournisseur</th>
                  <th>Nb Bons</th>
                  <th>Total Achats</th>
                </tr>
              </thead>
              <tbody>
                {detail.achats_par_fournisseur.map((a: any) => (
                  <tr key={a.fournisseur_id}>
                    <td>{a.code}</td>
                    <td>
                      <strong>{a.nom}</strong>
                    </td>
                    <td>{a.nb_bons}</td>
                    <td style={{ fontWeight: 700 }}>{fmtDA(a.total_achats)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'analyse' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
              <strong>1. Sélectionner les produits à analyser ({selectedProdIds.length}/{produits.length})</strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  style={{ padding: '4px 9px' }}
                  onClick={() => setSelectedProdIds(produits.map((p) => p.id))}
                >
                  🔄 Tout sélectionner
                </button>
                <button
                  type="button"
                  className="btn btn-muted"
                  style={{ padding: '4px 9px' }}
                  onClick={() => setSelectedProdIds([])}
                >
                  🔄 Tout désélectionner
                </button>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Part Partenaire (%) :
                  <input
                    type="number"
                    className="input"
                    style={{ width: 70 }}
                    value={tauxPartenaire}
                    onChange={(e) => setTauxPartenaire(e.target.value)}
                  />
                </label>
                <button type="button" className="btn btn-green" onClick={lancerAnalyse}>
                  ✅ ANALYSER
                </button>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 6,
                maxHeight: 170,
                overflowY: 'auto',
              }}
            >
              {produits.map((p) => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={selectedProdIds.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProdIds([...selectedProdIds, p.id]);
                      } else {
                        setSelectedProdIds(selectedProdIds.filter((id) => id !== p.id));
                      }
                    }}
                  />
                  {p.designation}
                </label>
              ))}
            </div>
          </div>

          {analyseResult && (
            <>
              <div className="toolbar">
                <button
                  className="btn btn-muted"
                  onClick={() =>
                    exportCsv(
                      analyseResult.lignes,
                      [
                        'code',
                        'designation',
                        'stock_actuel',
                        'valeur_stock',
                        'qte_achetee',
                        'cout_achats',
                        'qte_vendue',
                        'ca_ventes',
                        'benefice_estime',
                        'part_partenaire',
                      ],
                      'analyse_produits.csv'
                    )
                  }
                >
                  📄 Exporter Rapport CSV
                </button>
              </div>

              <div className="kpi-grid" style={{ marginBottom: 14 }}>
                <div className="card">
                  <div className="kpi-label">CA Ventes Sélection</div>
                  <div className="kpi-value" style={{ color: 'var(--accent)' }}>
                    {fmtDA(analyseResult.totaux.ca_ventes)}
                  </div>
                </div>
                <div className="card">
                  <div className="kpi-label">Bénéfice Estimé</div>
                  <div className="kpi-value" style={{ color: 'var(--green)' }}>
                    {fmtDA(analyseResult.totaux.benefice_estime)}
                  </div>
                </div>
                <div className="card">
                  <div className="kpi-label">
                    Calcul Partenaire ({analyseResult.totaux.taux_partenaire}%)
                  </div>
                  <div className="kpi-value" style={{ color: 'var(--orange)' }}>
                    {fmtDA(analyseResult.totaux.part_partenaire)}
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Stock</th>
                      <th>Val. Stock</th>
                      <th>Qté Achetée</th>
                      <th>Qté Vendue</th>
                      <th>CA Ventes</th>
                      <th>Bénéfice</th>
                      <th>Part Partenaire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyseResult.lignes.map((l: any) => (
                      <tr key={l.produit_id}>
                        <td>
                          <strong>{l.designation}</strong>
                        </td>
                        <td>{l.stock_actuel}</td>
                        <td>{fmtDA(l.valeur_stock)}</td>
                        <td>{l.qte_achetee}</td>
                        <td>{l.qte_vendue}</td>
                        <td>{fmtDA(l.ca_ventes)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--green)' }}>
                          {fmtDA(l.benefice_estime)}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--orange)' }}>
                          {fmtDA(l.part_partenaire)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
