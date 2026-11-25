import React, { useState } from 'react';
import { Package, Plus, Upload, Search, AlertCircle, Calendar } from 'lucide-react';
import { StoreData, Produit } from '../types';

interface ProduitsViewProps {
  data: StoreData;
  onRefresh: () => void;
}

export const ProduitsView: React.FC<ProduitsViewProps> = ({ data, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const [form, setForm] = useState<Partial<Produit>>({
    code: 'PRD-' + Math.floor(100 + Math.random() * 900),
    code_barre: '613' + Math.floor(1000000000 + Math.random() * 900000000),
    nom: '',
    categorie: 'Alimentaire',
    prix_achat: 100,
    prix_vente: 150,
    stock_actuel: 100,
    stock_alerte: 20,
    unite: 'Pièce'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/bureau/produits', {
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
        const res = await fetch('/api/bureau/produits/importer', {
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

  const filteredProduits = data.produits.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    (p.code_barre && p.code_barre.includes(search))
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Gestion des Produits & Lots (DLC)</h2>
          <p className="text-sm text-slate-500 mt-1">Catalogue articles, prix de gros/détail, lots et import massif Excel/CSV.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Importer Excel/CSV</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Produit</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="relative w-96">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrer par nom, code ou code-barres..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <span className="text-sm font-semibold text-slate-500">{filteredProduits.length} produits affichés</span>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="p-4">Code / Barres</th>
                <th className="p-4">Désignation</th>
                <th className="p-4">Catégorie</th>
                <th className="p-4">P. Achat</th>
                <th className="p-4">P. Vente</th>
                <th className="p-4">Stock Actuel</th>
                <th className="p-4">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProduits.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-all">
                  <td className="p-4">
                    <span className="font-bold text-slate-900 block">{p.code}</span>
                    <span className="text-xs text-slate-400 font-mono">{p.code_barre || 'N/A'}</span>
                  </td>
                  <td className="p-4 font-bold text-slate-800">{p.nom}</td>
                  <td className="p-4 text-slate-600">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {p.categorie}
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-slate-600">{p.prix_achat.toLocaleString()} DA</td>
                  <td className="p-4 font-bold text-indigo-600">{p.prix_vente.toLocaleString()} DA</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      p.stock_actuel <= p.stock_alerte ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {p.stock_actuel} {p.unite}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-semibold text-emerald-600">Actif</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nouveau Produit */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-900">Ajouter un Nouveau Produit</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Code Article</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Code Barre</label>
                  <input
                    type="text"
                    value={form.code_barre}
                    onChange={e => setForm({ ...form, code_barre: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Désignation du Produit</label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={e => setForm({ ...form, nom: e.target.value })}
                  placeholder="Ex: Huile de Tournesol 5L"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Prix d'Achat (DA)</label>
                  <input
                    type="number"
                    value={form.prix_achat}
                    onChange={e => setForm({ ...form, prix_achat: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Prix de Vente (DA)</label>
                  <input
                    type="number"
                    value={form.prix_vente}
                    onChange={e => setForm({ ...form, prix_vente: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Stock Initial</label>
                  <input
                    type="number"
                    value={form.stock_actuel}
                    onChange={e => setForm({ ...form, stock_actuel: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Stock Alerte</label>
                  <input
                    type="number"
                    value={form.stock_alerte}
                    onChange={e => setForm({ ...form, stock_alerte: Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white shadow-md shadow-indigo-600/20"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import Excel / CSV */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-slate-900">Import Massif Produits (Excel / CSV)</h3>
            <p className="text-xs text-slate-500">Sélectionnez un fichier `.xlsx` ou `.csv` contenant les colonnes : `code`, `nom`, `prix_achat`, `prix_vente`, `stock`, `code_barre`.</p>
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
                  <p>Ajoutés: {importResult.imported} | Mis à jour: {importResult.updated} | Erreurs: {importResult.errors}</p>
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowImportModal(false); setImportResult(null); }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-bold text-white"
                >
                  Lancer l'Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
