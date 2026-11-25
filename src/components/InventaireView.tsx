import React, { useState } from 'react';
import { ClipboardCheck, Plus, CheckCircle, Printer, AlertTriangle } from 'lucide-react';
import { StoreData, Inventaire, InventaireLigne } from '../types';

interface InventaireViewProps {
  data: StoreData;
  onRefresh: () => void;
}

export const InventaireView: React.FC<InventaireViewProps> = ({ data, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [lignesInventaire, setLignesInventaire] = useState<InventaireLigne[]>([]);
  const [observations, setObservations] = useState('');

  const initInventaireLignes = () => {
    const lignes = data.produits.map(p => ({
      produit_id: p.id,
      produit_nom: p.nom,
      stock_theorique: p.stock_actuel,
      stock_compte: p.stock_actuel,
      ecart: 0,
      valeur_ecart: 0
    }));
    setLignesInventaire(lignes);
    setShowModal(true);
  };

  const handleCompteChange = (idx: number, val: number) => {
    const lignes = [...lignesInventaire];
    const ligne = lignes[idx];
    ligne.stock_compte = val;
    ligne.ecart = val - ligne.stock_theorique;
    const prod = data.produits.find(p => p.id === ligne.produit_id);
    ligne.valeur_ecart = ligne.ecart * (prod ? prod.prix_achat : 100);
    setLignesInventaire(lignes);
  };

  const handleCreerInventaire = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      depot_id: 'dep-1',
      observations,
      utilisateur: 'Admin Principal',
      lignes: lignesInventaire
    };

    try {
      const res = await fetch('/api/bureau/inventaires', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowModal(false);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const validerInventaire = async (id: string) => {
    if (!confirm("Valider cet inventaire va régulariser automatiquement les stocks réels et générer les mouvements correspondants. Confirmer ?")) return;
    try {
      const res = await fetch(`/api/bureau/inventaires/${id}/valider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        alert('Inventaire validé et stocks mis à jour avec succès !');
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
          <h2 className="text-2xl font-black text-slate-900">Inventaire Physique & Régularisation</h2>
          <p className="text-sm text-slate-500 mt-1">Saisie des comptages physiques par dépôt, calcul des écarts et régularisation stock automatique.</p>
        </div>
        <button
          onClick={initInventaireLignes}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Session d'Inventaire</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="p-4">N° Inventaire</th>
                <th className="p-4">Date</th>
                <th className="p-4">Dépôt</th>
                <th className="p-4">Utilisateur</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.inventaires.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">Aucune session d'inventaire enregistrée.</td>
                </tr>
              ) : (
                data.inventaires.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-all">
                    <td className="p-4 font-bold text-slate-900">{inv.numero}</td>
                    <td className="p-4 text-slate-600">{new Date(inv.date_inventaire).toLocaleDateString('fr-FR')}</td>
                    <td className="p-4 text-slate-600">Dépôt Central Alger</td>
                    <td className="p-4 text-slate-600">{inv.utilisateur}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        inv.statut === 'Validé' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {inv.statut}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {inv.statut === 'En cours' && (
                        <button
                          onClick={() => validerInventaire(inv.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-xs"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Valider l'Inventaire
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Inventaire */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-900">Saisie des Quantités Comptées (Inventaire)</h3>
            <form onSubmit={handleCreerInventaire} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Observations</label>
                <input
                  type="text"
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  placeholder="Ex: Inventaire annuel général"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold text-slate-600 sticky top-0">
                    <tr>
                      <th className="p-3">Article</th>
                      <th className="p-3">Stock Théorique</th>
                      <th className="p-3">Stock Compté Réel</th>
                      <th className="p-3">Écart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lignesInventaire.map((l, idx) => (
                      <tr key={l.produit_id}>
                        <td className="p-3 font-semibold text-slate-800">{l.produit_nom}</td>
                        <td className="p-3 font-bold text-slate-600">{l.stock_theorique}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={l.stock_compte}
                            onChange={e => handleCompteChange(idx, Number(e.target.value))}
                            className="w-24 p-1.5 border border-slate-300 rounded-lg font-bold bg-white text-center"
                          />
                        </td>
                        <td className={`p-3 font-black ${l.ecart < 0 ? 'text-red-600' : l.ecart > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                          {l.ecart > 0 ? `+${l.ecart}` : l.ecart}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  Enregistrer la Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
