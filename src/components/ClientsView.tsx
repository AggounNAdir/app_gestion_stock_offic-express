import React, { useState } from 'react';
import { Users, Plus, Upload, Search, ShieldAlert, CreditCard } from 'lucide-react';
import { StoreData, Client } from '../types';

interface ClientsViewProps {
  data: StoreData;
  onRefresh: () => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({ data, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const [form, setForm] = useState<Partial<Client>>({
    code: 'CLI-' + Math.floor(100 + Math.random() * 900),
    nom: '',
    telephone: '0550000000',
    adresse: '',
    ville: 'Alger',
    plafond_credit: 150000,
    bloquer_si_depasse: 1,
    type_client: 'Gros'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/bureau/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setShowModal(false);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const res = await fetch('/api/bureau/clients/importer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data: base64 })
        });
        const result = await res.json();
        setImportResult(result);
        onRefresh();
      } catch (err: any) {
        alert(err.message);
      }
    };
    reader.readAsDataURL(importFile);
  };

  const filteredClients = data.clients.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.telephone.includes(search)
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Portefeuille Clients & Plafonds de Crédit</h2>
          <p className="text-sm text-slate-500 mt-1">Gestion des clients, encours, limites de crédit et blocage automatique.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Importer Clients</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Client</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="relative w-96">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher client (nom, code, téléphone)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <span className="text-sm font-semibold text-slate-500">{filteredClients.length} clients enregistrés</span>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="p-4">Code & Nom</th>
                <th className="p-4">Type</th>
                <th className="p-4">Téléphone / Ville</th>
                <th className="p-4">Solde / Encours</th>
                <th className="p-4">Plafond de Crédit</th>
                <th className="p-4">Utilisation du Crédit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map(c => {
                const ratio = c.plafond_credit > 0 ? (c.solde / c.plafond_credit) * 100 : 0;
                const isOver = c.plafond_credit > 0 && c.solde > c.plafond_credit;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-all">
                    <td className="p-4">
                      <span className="font-bold text-slate-900 block">{c.nom}</span>
                      <span className="text-xs text-slate-400 font-mono">{c.code}</span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                        {c.type_client}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="block font-semibold text-slate-700">{c.telephone}</span>
                      <span className="text-xs text-slate-400">{c.ville}</span>
                    </td>
                    <td className="p-4 font-black text-slate-900">
                      {c.solde.toLocaleString()} DA
                      {isOver && (
                        <span className="block text-[10px] text-red-600 font-bold flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> Dépassement plafond !
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-slate-600">
                      {c.plafond_credit === 0 ? 'Illimité' : `${c.plafond_credit.toLocaleString()} DA`}
                    </td>
                    <td className="p-4 w-48">
                      {c.plafond_credit > 0 ? (
                        <div>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className={ratio > 90 ? 'text-red-600' : 'text-slate-600'}>{ratio.toFixed(0)}%</span>
                            {c.bloquer_si_depasse === 1 && <span className="text-[10px] text-amber-600 font-semibold">Bloqué si dépasse</span>}
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${ratio > 100 ? 'bg-red-500' : ratio > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, ratio)}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Crédit illimité</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nouveau Client */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-slate-900">Ajouter un Client</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Code Client</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Type de Client</label>
                  <select
                    value={form.type_client}
                    onChange={e => setForm({ ...form, type_client: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="Gros">Gros</option>
                    <option value="Demi-Gros">Demi-Gros</option>
                    <option value="Détail">Détail</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Raison Sociale / Nom</label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={e => setForm({ ...form, nom: e.target.value })}
                  placeholder="Ex: Superette El-Badr"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={form.telephone}
                    onChange={e => setForm({ ...form, telephone: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Ville</label>
                  <input
                    type="text"
                    value={form.ville}
                    onChange={e => setForm({ ...form, ville: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Plafond de Crédit (DA)</label>
                  <input
                    type="number"
                    value={form.plafond_credit}
                    onChange={e => setForm({ ...form, plafond_credit: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Blocage si Dépassement</label>
                  <select
                    value={form.bloquer_si_depasse}
                    onChange={e => setForm({ ...form, bloquer_si_depasse: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value={1}>Oui (Bloquer vente)</option>
                    <option value={0}>Non (Avertir seulement)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white shadow-md"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import Clients */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-slate-900">Import Clients (Excel / CSV)</h3>
            <p className="text-xs text-slate-500">Colonnes requises: `code`, `nom`, `telephone`, `ville`, `plafond_credit`.</p>
            <form onSubmit={handleImportSubmit} className="space-y-4">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={e => setImportFile(e.target.files?.[0] || null)}
                className="w-full p-3 border border-dashed border-slate-300 rounded-xl text-sm bg-slate-50"
                required
              />
              {importResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  <p className="font-bold">Import réussi !</p>
                  <p>Ajoutés: {importResult.imported} | Mis à jour: {importResult.updated}</p>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setShowImportModal(false); setImportResult(null); }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  Fermer
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm">
                  Importer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
