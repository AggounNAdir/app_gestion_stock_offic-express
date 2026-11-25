import React, { useState } from 'react';
import { Wallet, Plus, CreditCard, DollarSign, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { StoreData, Depense, Cheque } from '../types';

interface FinancesViewProps {
  data: StoreData;
  onRefresh: () => void;
}

export const FinancesView: React.FC<FinancesViewProps> = ({ data, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'depenses' | 'cheques'>('depenses');
  const [showDepenseModal, setShowDepenseModal] = useState(false);
  const [showChequeModal, setShowChequeModal] = useState(false);

  const [depenseForm, setDepenseForm] = useState<Partial<Depense>>({
    categorie: 'Carburant',
    libelle: '',
    montant: 5000,
    mode_paiement: 'Espèces',
    cree_par: 'Admin'
  });

  const [chequeForm, setChequeForm] = useState<Partial<Cheque>>({
    type: 'Client',
    numero_cheque: 'CHQ-',
    banque: 'BNA',
    date_emission: new Date().toISOString().slice(0, 10),
    date_echeance: new Date(Date.now() + 30*24*3600*1000).toISOString().slice(0, 10),
    tiers_id: data.clients[0]?.id || '',
    tiers_nom: data.clients[0]?.nom || 'Client',
    montant: 20000,
    statut: 'En attente'
  });

  const handleDepenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/bureau/depenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(depenseForm)
      });
      if (res.ok) {
        setShowDepenseModal(false);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChequeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/bureau/cheques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chequeForm)
      });
      if (res.ok) {
        setShowChequeModal(false);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateChequeStatut = async (id: string, statut: string) => {
    try {
      await fetch(`/api/bureau/cheques/${id}/statut`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut })
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const totalDepenses = data.depenses.reduce((acc, d) => acc + d.montant, 0);
  const totalChequesEnAttente = data.cheques.filter(c => c.statut === 'En attente').reduce((acc, c) => acc + c.montant, 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Caisse, Dépenses & Portefeuille Chèques</h2>
          <p className="text-sm text-slate-500 mt-1">Suivi des charges d'exploitation, calcul du bénéfice net et gestion des chèques reçus/émis.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveTab('depenses')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'depenses' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Journal Dépenses
          </button>
          <button
            onClick={() => setActiveTab('cheques')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'cheques' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Portefeuille Chèques
          </button>
        </div>
      </div>

      {activeTab === 'depenses' ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase">Total Charges / Dépenses</span>
              <h3 className="text-xl font-black text-red-600">{totalDepenses.toLocaleString()} DA</h3>
            </div>
            <button
              onClick={() => setShowDepenseModal(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Saisir une Dépense</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                    <th className="p-4">N° Dépense</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Catégorie</th>
                    <th className="p-4">Libellé</th>
                    <th className="p-4">Montant</th>
                    <th className="p-4">Paiement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.depenses.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-900">{d.numero}</td>
                      <td className="p-4 text-slate-600">{new Date(d.date_depense).toLocaleDateString('fr-FR')}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700">
                          {d.categorie}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-800">{d.libelle}</td>
                      <td className="p-4 font-black text-red-600">{d.montant.toLocaleString()} DA</td>
                      <td className="p-4 text-slate-600">{d.mode_paiement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase">Total Chèques en Attente</span>
              <h3 className="text-xl font-black text-amber-600">{totalChequesEnAttente.toLocaleString()} DA</h3>
            </div>
            <button
              onClick={() => setShowChequeModal(true)}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Enregistrer un Chèque</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                    <th className="p-4">N° Chèque & Banque</th>
                    <th className="p-4">Type & Tiers</th>
                    <th className="p-4">Échéance</th>
                    <th className="p-4">Montant</th>
                    <th className="p-4">Statut</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.cheques.map(ch => (
                    <tr key={ch.id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <span className="font-bold text-slate-900 block">{ch.numero_cheque}</span>
                        <span className="text-xs text-slate-400">{ch.banque}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-800 block">{ch.tiers_nom}</span>
                        <span className="text-xs text-indigo-600 font-medium">{ch.type}</span>
                      </td>
                      <td className="p-4 text-slate-600">{ch.date_echeance}</td>
                      <td className="p-4 font-black text-slate-900">{ch.montant.toLocaleString()} DA</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          ch.statut === 'Encaissé' ? 'bg-emerald-50 text-emerald-700' :
                          ch.statut === 'Rejeté' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {ch.statut}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {ch.statut === 'En attente' && (
                          <>
                            <button
                              onClick={() => updateChequeStatut(ch.id, 'Encaissé')}
                              className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                            >
                              Encaisser
                            </button>
                            <button
                              onClick={() => updateChequeStatut(ch.id, 'Rejeté')}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold"
                            >
                              Rejeter (Impayé)
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Depense */}
      {showDepenseModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-slate-900">Saisir une Dépense / Charge</h3>
            <form onSubmit={handleDepenseSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Catégorie</label>
                  <select
                    value={depenseForm.categorie}
                    onChange={e => setDepenseForm({ ...depenseForm, categorie: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Carburant">Carburant</option>
                    <option value="Loyer">Loyer</option>
                    <option value="Salaires">Salaires</option>
                    <option value="Entretien Camion">Entretien Camion</option>
                    <option value="Électricité/Eau">Électricité/Eau</option>
                    <option value="Fournitures">Fournitures</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Montant (DA)</label>
                  <input
                    type="number"
                    value={depenseForm.montant}
                    onChange={e => setDepenseForm({ ...depenseForm, montant: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Libellé / Description</label>
                <input
                  type="text"
                  value={depenseForm.libelle}
                  onChange={e => setDepenseForm({ ...depenseForm, libelle: e.target.value })}
                  placeholder="Ex: Achat carburant tournée"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowDepenseModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cheque */}
      {showChequeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-slate-900">Enregistrer un Chèque</h3>
            <form onSubmit={handleChequeSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">N° Chèque</label>
                  <input
                    type="text"
                    value={chequeForm.numero_cheque}
                    onChange={e => setChequeForm({ ...chequeForm, numero_cheque: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Banque</label>
                  <input
                    type="text"
                    value={chequeForm.banque}
                    onChange={e => setChequeForm({ ...chequeForm, banque: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Montant (DA)</label>
                  <input
                    type="number"
                    value={chequeForm.montant}
                    onChange={e => setChequeForm({ ...chequeForm, montant: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Date d'Échéance</label>
                  <input
                    type="date"
                    value={chequeForm.date_echeance}
                    onChange={e => setChequeForm({ ...chequeForm, date_echeance: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowChequeModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
