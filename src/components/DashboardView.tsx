import React from 'react';
import {
  TrendingUp, Wallet, Users, Package, AlertTriangle,
  ShoppingCart, ArrowUpRight, DollarSign, Clock, ShieldCheck
} from 'lucide-react';
import { StoreData } from '../types';

interface DashboardViewProps {
  data: StoreData;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ data }) => {
  const totalCA = data.ventes.reduce((acc, v) => acc + v.total_ttc, 0);
  const totalCreances = data.clients.reduce((acc, c) => acc + c.solde, 0);
  const totalDepenses = data.depenses.reduce((acc, d) => acc + d.montant, 0);
  
  // Marge brute estimée
  const margeBrute = data.ventes.reduce((acc, v) => {
    return acc + v.lignes.reduce((lAcc, l) => {
      const prod = data.produits.find(p => p.id === l.produit_id);
      const achat = prod ? prod.prix_achat : (l.prix_unitaire * 0.7);
      return lAcc + (l.prix_unitaire - achat) * l.quantite;
    }, 0);
  }, 0);

  const beneficeNetReel = margeBrute - totalDepenses;

  const stockAlerteCount = data.produits.filter(p => p.stock_actuel <= p.stock_alerte).length;
  const devisEnCours = data.devis.filter(d => d.statut === 'Envoyé' || d.statut === 'Brouillon').length;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Tableau de Bord & Pilotage ERP</h2>
          <p className="text-indigo-200 text-sm mt-1">Vue d'ensemble de l'activité commerciale, stock, caisse et rentabilité nette.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15 text-xs">
            <span className="block text-indigo-200">Dépôt Actif</span>
            <span className="font-bold text-white">Dépôt Central Alger (Principal)</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Chiffre d'Affaires</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCA.toLocaleString()} <span className="text-sm font-bold text-slate-500">DA</span></h3>
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 mt-2">
              <TrendingUp className="w-3.5 h-3.5" /> +12.4% ce mois
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bénéfice Net Réel</span>
            <h3 className={`text-2xl font-black mt-1 ${beneficeNetReel >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {beneficeNetReel.toLocaleString()} <span className="text-sm font-bold text-slate-500">DA</span>
            </h3>
            <span className="text-xs font-medium text-slate-500 mt-2 block">
              Marge - Dépenses ({totalDepenses.toLocaleString()} DA)
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Créances Clients</span>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{totalCreances.toLocaleString()} <span className="text-sm font-bold text-slate-500">DA</span></h3>
            <span className="text-xs font-medium text-amber-700 mt-2 block">
              Encours global crédit
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Alertes Stock & Devis</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stockAlerteCount} <span className="text-sm text-slate-400">ruptures</span></h3>
            <span className="text-xs font-medium text-indigo-600 mt-2 block">
              {devisEnCours} devis en attente
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid sections: Recent sales & Low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-slate-800">Dernières Ventes Validées</h3>
            <span className="text-xs text-indigo-600 font-semibold">{data.ventes.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                  <th className="pb-3">N° Vente</th>
                  <th className="pb-3">Client</th>
                  <th className="pb-3">Vendeur</th>
                  <th className="pb-3">Total TTC</th>
                  <th className="pb-3">Reste</th>
                  <th className="pb-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.ventes.slice(0, 5).map(v => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="py-3 font-semibold text-slate-800">{v.numero}</td>
                    <td className="py-3 text-slate-600">{v.client_nom}</td>
                    <td className="py-3 text-slate-600">{v.vendeur_nom}</td>
                    <td className="py-3 font-bold text-slate-900">{v.total_ttc.toLocaleString()} DA</td>
                    <td className="py-3 font-semibold text-amber-600">{v.reste_payer.toLocaleString()} DA</td>
                    <td className="py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                        {v.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Alertes Stock Faible
          </h3>
          <div className="space-y-3">
            {data.produits.filter(p => p.stock_actuel <= p.stock_alerte).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Aucun produit en rupture ou stock bas.</p>
            ) : (
              data.produits.filter(p => p.stock_actuel <= p.stock_alerte).map(p => (
                <div key={p.id} className="p-3 bg-red-50/60 border border-red-100 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">{p.nom}</h4>
                    <span className="text-xs text-red-600 font-medium">Stock actuel: {p.stock_actuel} {p.unite} (Alerte: {p.stock_alerte})</span>
                  </div>
                  <span className="bg-red-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold">Rupture</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
