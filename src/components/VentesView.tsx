import React, { useState } from 'react';
import { ShoppingCart, Plus, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { StoreData, Vente, LigneVente } from '../types';

interface VentesViewProps {
  data: StoreData;
  onRefresh: () => void;
}

export const VentesView: React.FC<VentesViewProps> = ({ data, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [clientId, setClientId] = useState(data.clients[1]?.id || data.clients[0]?.id || '');
  const [vendeurId, setVendeurId] = useState(data.vendeurs[0]?.id || '');
  const [lignesPanier, setLignesPanier] = useState<LigneVente[]>([]);
  const [currentProduitId, setCurrentProduitId] = useState(data.produits[0]?.id || '');
  const [qte, setQte] = useState(1);
  const [montantVerse, setMontantVerse] = useState(0);
  const [modePaiement, setModePaiement] = useState<'Espèces' | 'Chèque' | 'Crédit' | 'Virement'>('Crédit');
  const [forcerCredit, setForcerCredit] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const ajouterLigne = () => {
    const prod = data.produits.find(p => p.id === currentProduitId);
    if (!prod) return;
    const existing = lignesPanier.find(l => l.produit_id === prod.id);
    if (existing) {
      existing.quantite += qte;
      existing.total_ligne = existing.quantite * existing.prix_unitaire;
      setLignesPanier([...lignesPanier]);
    } else {
      setLignesPanier([
        ...lignesPanier,
        {
          produit_id: prod.id,
          produit_nom: prod.nom,
          quantite: qte,
          prix_unitaire: prod.prix_vente,
          remise_pct: 0,
          total_ligne: qte * prod.prix_vente
        }
      ]);
    }
  };

  const totalTTC = lignesPanier.reduce((acc, l) => acc + l.total_ligne, 0);
  const restePayer = Math.max(0, totalTTC - montantVerse);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lignesPanier.length === 0) return alert('Panier vide');
    const client = data.clients.find(c => c.id === clientId);
    const vendeur = data.vendeurs.find(v => v.id === vendeurId);

    const payload = {
      client_id: clientId,
      client_nom: client ? client.nom : 'Client',
      vendeur_id: vendeurId,
      vendeur_nom: vendeur ? vendeur.nom : 'Vendeur',
      depot_id: 'dep-1',
      lignes: lignesPanier,
      total_ht: totalTTC,
      tva_total: 0,
      remise_globale: 0,
      total_ttc: totalTTC,
      montant_verse: montantVerse,
      reste_payer: restePayer,
      statut: 'Validé',
      mode_paiement: modePaiement,
      observations: forcerCredit ? 'FORCE_CREDIT' : ''
    };

    try {
      const res = await fetch('/api/bureau/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMessage(json.error);
      } else {
        setShowModal(false);
        setLignesPanier([]);
        setErrorMessage('');
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Bons de Vente & Facturation</h2>
          <p className="text-sm text-slate-500 mt-1">Validation des ventes avec contrôle rigoureux du plafond de crédit client.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Saisir un Bon de Vente</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="p-4">N° Vente</th>
                <th className="p-4">Date</th>
                <th className="p-4">Client</th>
                <th className="p-4">Vendeur</th>
                <th className="p-4">Total TTC</th>
                <th className="p-4">Versé</th>
                <th className="p-4">Reste Crédit</th>
                <th className="p-4">Paiement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.ventes.map(v => (
                <tr key={v.id} className="hover:bg-slate-50 transition-all">
                  <td className="p-4 font-bold text-slate-900">{v.numero}</td>
                  <td className="p-4 text-slate-600">{new Date(v.date_vente).toLocaleDateString('fr-FR')}</td>
                  <td className="p-4 font-semibold text-slate-800">{v.client_nom}</td>
                  <td className="p-4 text-slate-600">{v.vendeur_nom}</td>
                  <td className="p-4 font-black text-indigo-600">{v.total_ttc.toLocaleString()} DA</td>
                  <td className="p-4 font-semibold text-emerald-600">{v.montant_verse.toLocaleString()} DA</td>
                  <td className="p-4 font-bold text-amber-600">{v.reste_payer.toLocaleString()} DA</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {v.mode_paiement}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Saisie Vente */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-900">Saisir un Bon de Vente</h3>
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <p className="font-bold">Blocage Plafond de Crédit :</p>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Client</label>
                  <select
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  >
                    {data.clients.map(c => (
                      <option key={c.id} value={c.id}>{c.nom} (Solde: {c.solde} DA, Plafond: {c.plafond_credit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Commercial / Vendeur</label>
                  <select
                    value={vendeurId}
                    onChange={e => setVendeurId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  >
                    {data.vendeurs.map(v => (
                      <option key={v.id} value={v.id}>{v.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add items */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs uppercase text-slate-500">Ajouter des articles</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <select
                      value={currentProduitId}
                      onChange={e => setCurrentProduitId(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl text-sm bg-white"
                    >
                      {data.produits.map(p => (
                        <option key={p.id} value={p.id}>{p.nom} (Stock: {p.stock_actuel} | {p.prix_vente} DA)</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      min={1}
                      value={qte}
                      onChange={e => setQte(Number(e.target.value))}
                      className="w-20 p-2 border border-slate-200 rounded-xl text-sm bg-white text-center font-bold"
                    />
                    <button
                      type="button"
                      onClick={ajouterLigne}
                      className="flex-1 bg-indigo-600 text-white rounded-xl font-bold text-sm px-3 hover:bg-indigo-700"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>

              {/* Lignes table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold text-slate-600">
                    <tr>
                      <th className="p-3">Article</th>
                      <th className="p-3">Qte</th>
                      <th className="p-3">P.U DA</th>
                      <th className="p-3">Total DA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lignesPanier.map((l, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-semibold">{l.produit_nom}</td>
                        <td className="p-3">{l.quantite}</td>
                        <td className="p-3">{l.prix_unitaire}</td>
                        <td className="p-3 font-bold">{l.total_ligne}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Montant Versé (DA)</label>
                  <input
                    type="number"
                    value={montantVerse}
                    onChange={e => setMontantVerse(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Mode de Paiement</label>
                  <select
                    value={modePaiement}
                    onChange={e => setModePaiement(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Crédit">Crédit (Solde client)</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Virement">Virement</option>
                  </select>
                </div>
              </div>

              {errorMessage && (
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="forcer"
                    checked={forcerCredit}
                    onChange={e => setForcerCredit(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <label htmlFor="forcer" className="text-xs font-bold text-red-700">
                    Forcer la validation (Autorisation Administrateur outrepassant le plafond)
                  </label>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t">
                <div>
                  <span className="block text-xs text-slate-500">Total TTC: <strong className="text-slate-900">{totalTTC.toLocaleString()} DA</strong></span>
                  <span className="block text-xs text-amber-600 font-bold">Reste à crédit: {restePayer.toLocaleString()} DA</span>
                </div>
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md"
                  >
                    Valider la Vente
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
