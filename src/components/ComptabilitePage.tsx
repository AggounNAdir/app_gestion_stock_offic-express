import React, { useEffect, useState } from 'react';
import { apiFetch, fmtDA } from '../api.ts';

interface ComptabilitePageProps {
  token: string;
}

export function ComptabilitePage({ token }: ComptabilitePageProps) {
  const [activeTab, setActiveTab] = useState<'journaux' | 'balance' | 'resultat' | 'plan'>('journaux');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/bureau/store', { token });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <div style={{ padding: 24, textAlign: 'center' }}>Chargement de la comptabilité...</div>;
  }

  // Calculate totals for accounting
  const totalVentesTTC = (data.bons_vente || []).reduce((acc: number, b: any) => acc + Number(b.total_ttc || b.total || 0), 0);
  const totalAchatsTTC = (data.bons_achat || []).reduce((acc: number, a: any) => acc + Number(a.total || 0), 0);
  const totalDepenses = (data.depenses || []).reduce((acc: number, d: any) => acc + Number(d.montant || 0), 0);
  const totalEncaissements = (data.versements_clients || []).reduce((acc: number, v: any) => acc + Number(v.montant || 0), 0);

  const resultatNet = totalVentesTTC - totalAchatsTTC - totalDepenses;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📊 Comptabilité & États Financiers</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 0' }}>
            Journaux comptables, balance générale et compte de résultat de l'entreprise.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn ${activeTab === 'journaux' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('journaux')}
          >
            📖 Journaux
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'balance' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('balance')}
          >
            ⚖️ Balance Générale
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'resultat' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('resultat')}
          >
            📈 Compte de Résultat
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'plan' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('plan')}
          >
            🗂️ Plan Comptable
          </button>
        </div>
      </div>

      {activeTab === 'journaux' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Journal des Ventes</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>N° Pièce</th>
                    <th>Client</th>
                    <th style={{ textAlign: 'right' }}>Total HT</th>
                    <th style={{ textAlign: 'right' }}>TVA</th>
                    <th style={{ textAlign: 'right' }}>Total TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.bons_vente || []).map((b: any) => (
                    <tr key={b.id}>
                      <td>{b.date_bon}</td>
                      <td><strong>{b.numero}</strong></td>
                      <td>{b.client_nom || 'Client'}</td>
                      <td style={{ textAlign: 'right' }}>{fmtDA(b.total_ht || b.total * 0.84)}</td>
                      <td style={{ textAlign: 'right' }}>{fmtDA(b.tva_total || b.total * 0.16)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtDA(b.total_ttc || b.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Journal des Achats</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>N° Pièce</th>
                    <th>Fournisseur</th>
                    <th style={{ textAlign: 'right' }}>Montant Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.bons_achat || []).map((a: any) => (
                    <tr key={a.id}>
                      <td>{a.date_bon}</td>
                      <td><strong>{a.numero}</strong></td>
                      <td>Fournisseur #{a.fournisseur_id}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtDA(a.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'balance' && (
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Balance Générale des Comptes</h3>
          <table className="table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th>N° Compte</th>
                <th>Intitulé du Compte</th>
                <th style={{ textAlign: 'right' }}>Débit (DA)</th>
                <th style={{ textAlign: 'right' }}>Crédit (DA)</th>
                <th style={{ textAlign: 'right' }}>Solde (DA)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>411</strong></td>
                <td>Clients (Créances)</td>
                <td style={{ textAlign: 'right' }}>{fmtDA((data.clients || []).reduce((a: number, c: any) => a + Number(c.solde || 0), 0))}</td>
                <td style={{ textAlign: 'right' }}>{fmtDA(0)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtDA((data.clients || []).reduce((a: number, c: any) => a + Number(c.solde || 0), 0))}</td>
              </tr>
              <tr>
                <td><strong>401</strong></td>
                <td>Fournisseurs (Dettes)</td>
                <td style={{ textAlign: 'right' }}>{fmtDA(0)}</td>
                <td style={{ textAlign: 'right' }}>{fmtDA((data.fournisseurs || []).reduce((a: number, f: any) => a + Number(f.solde || 0), 0))}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>-{fmtDA((data.fournisseurs || []).reduce((a: number, f: any) => a + Number(f.solde || 0), 0))}</td>
              </tr>
              <tr>
                <td><strong>530</strong></td>
                <td>Caisse Espèces & Règlements</td>
                <td style={{ textAlign: 'right' }}>{fmtDA(totalEncaissements)}</td>
                <td style={{ textAlign: 'right' }}>{fmtDA(totalDepenses)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtDA(totalEncaissements - totalDepenses)}</td>
              </tr>
              <tr>
                <td><strong>701</strong></td>
                <td>Ventes de Marchandises</td>
                <td style={{ textAlign: 'right' }}>{fmtDA(0)}</td>
                <td style={{ textAlign: 'right' }}>{fmtDA(totalVentesTTC)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{fmtDA(totalVentesTTC)}</td>
              </tr>
              <tr>
                <td><strong>607</strong></td>
                <td>Achats de Marchandises</td>
                <td style={{ textAlign: 'right' }}>{fmtDA(totalAchatsTTC)}</td>
                <td style={{ textAlign: 'right' }}>{fmtDA(0)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtDA(totalAchatsTTC)}</td>
              </tr>
              <tr>
                <td><strong>650</strong></td>
                <td>Charges & Dépenses d'Exploitation</td>
                <td style={{ textAlign: 'right' }}>{fmtDA(totalDepenses)}</td>
                <td style={{ textAlign: 'right' }}>{fmtDA(0)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtDA(totalDepenses)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'resultat' && (
        <div className="card" style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, textAlign: 'center' }}>Compte de Résultat (Simplifié)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span>(+) Chiffre d'Affaires (Ventes T.T.C)</span>
              <strong style={{ color: 'var(--green)' }}>{fmtDA(totalVentesTTC)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span>(-) Achats Consommés (Bons d'Achat)</span>
              <strong style={{ color: 'var(--red)' }}>-{fmtDA(totalAchatsTTC)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span>(-) Charges & Dépenses d'Exploitation</span>
              <strong style={{ color: 'var(--red)' }}>-{fmtDA(totalDepenses)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-subtle)', borderRadius: 8, marginTop: 10, fontSize: 16 }}>
              <span><strong>= Résultat Net Comptable</strong></span>
              <strong style={{ color: resultatNet >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtDA(resultatNet)}</strong>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'plan' && (
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Plan Comptable Général</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <li style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 6 }}><strong>Classe 4 - Tiers :</strong> 411 (Clients), 401 (Fournisseurs)</li>
            <li style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 6 }}><strong>Classe 5 - Trésorerie :</strong> 530 (Caisse), 512 (Banque)</li>
            <li style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 6 }}><strong>Classe 6 - Charges :</strong> 607 (Achats marchandises), 650 (Dépenses / Carburant / Loyer)</li>
            <li style={{ padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 6 }}><strong>Classe 7 - Produits :</strong> 701 (Ventes de marchandises)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
