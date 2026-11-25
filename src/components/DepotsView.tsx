import React, { useState } from 'react';
import { Building2, Plus, ArrowRightLeft } from 'lucide-react';
import { StoreData, TransfertDepot } from '../types';

interface DepotsViewProps {
  data: StoreData;
  onRefresh: () => void;
}

export const DepotsView: React.FC<DepotsViewProps> = ({ data, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [sourceId, setSourceId] = useState(data.depots[0]?.id || '');
  const [destId, setDestId] = useState(data.depots[1]?.id || '');
  const [produitId, setProduitId] = useState(data.produits[0]?.id || '');
  const [quantite, setQuantite] = useState(10);
  const [observations, setObservations] = useState('');

  const handleTransfert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceId === destId) return alert('Le dépôt source et destination doivent être différents.');
    const prod = data.produits.find(p => p.id === produitId);

    const payload = {
      depot_source_id: sourceId,
      depot_dest_id: destId,
      lignes: [{ produit_id: produitId, quantite }],
      utilisateur: 'Admin Principal',
      observations
    };

    try {
      const res = await fetch('/api/bureau/transferts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowModal(false);
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Multi-Dépôts & Transferts Inter-Dépôts</h2>
          <p className="text-sm text-slate-500 mt-1">Gestion des entrepôts régionaux et transferts de stock sécurisés.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Nouveau Transfert</span>
        </button>
      </div>

      {/* Depots list */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {data.depots.map(dep => (
          <div key={dep.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">{dep.code}</span>
              {dep.est_principal && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Principal</span>}
            </div>
            <h3 className="font-black text-lg text-slate-900">{dep.nom}</h3>
            <p className="text-xs text-slate-500">{dep.adresse}</p>
          </div>
        ))}
      </div>

      {/* Transferts history */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-800">Historique des Transferts Inter-Dépôts</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="p-4">N° Transfert</th>
                <th className="p-4">Date</th>
                <th className="p-4">De</th>
                <th className="p-4">Vers</th>
                <th className="p-4">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.transferts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">Aucun transfert effectué.</td>
                </tr>
              ) : (
                data.transferts.map(tr => (
                  <tr key={tr.id} className="hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-900">{tr.numero}</td>
                    <td className="p-4 text-slate-600">{new Date(tr.date_transfert).toLocaleDateString('fr-FR')}</td>
                    <td className="p-4 text-slate-600">{data.depots.find(d => d.id === tr.depot_source_id)?.nom}</td>
                    <td className="p-4 text-slate-600">{data.depots.find(d => d.id === tr.depot_dest_id)?.nom}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                        {tr.statut}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Transfert */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-slate-900">Effectuer un Transfert Inter-Dépôts</h3>
            <form onSubmit={handleTransfert} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Dépôt Source</label>
                  <select
                    value={sourceId}
                    onChange={e => setSourceId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  >
                    {data.depots.map(d => (
                      <option key={d.id} value={d.id}>{d.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Dépôt Destination</label>
                  <select
                    value={destId}
                    onChange={e => setDestId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  >
                    {data.depots.map(d => (
                      <option key={d.id} value={d.id}>{d.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Article</label>
                <select
                  value={produitId}
                  onChange={e => setProduitId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                >
                  {data.produits.map(p => (
                    <option key={p.id} value={p.id}>{p.nom} (Stock: {p.stock_actuel})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Quantité à Transférer</label>
                <input
                  type="number"
                  min={1}
                  value={quantite}
                  onChange={e => setQuantite(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
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
                  Valider le Transfert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
