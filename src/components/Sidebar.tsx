import React from 'react';
import {
  LayoutDashboard, Package, Users, FileText, ShoppingCart,
  Store, Clock, ClipboardCheck, Building2, Wallet,
  Target, MapPin, Settings, Bell, ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  unreadCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, unreadCount }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Tableau de Bord', icon: LayoutDashboard },
    { id: 'produits', label: 'Produits & Lots DLC', icon: Package },
    { id: 'clients', label: 'Clients & Plafond Crédit', icon: Users },
    { id: 'devis', label: 'Devis & Proforma', icon: FileText },
    { id: 'ventes', label: 'Bons de Vente', icon: ShoppingCart },
    { id: 'pos', label: 'Caisse POS (80mm)', icon: Store },
    { id: 'echeancier', label: 'Échéancier & Relances', icon: Clock },
    { id: 'inventaires', label: 'Inventaire Physique', icon: ClipboardCheck },
    { id: 'depots', label: 'Multi-Dépôts & Transferts', icon: Building2 },
    { id: 'finances', label: 'Caisse, Dépenses & Chèques', icon: Wallet },
    { id: 'objectifs', label: 'Objectifs & Commissions', icon: Target },
    { id: 'carte', label: 'Carte GPS Tournées', icon: MapPin },
    { id: 'parametres', label: 'Paramètres & Licence', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col h-screen sticky top-0 shadow-xl">
      <div className="p-4 border-b border-slate-800 flex items-center space-x-3">
        <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-600/30">
          <Store className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight text-white">GestionStock Pro</h1>
          <span className="text-xs text-indigo-400 font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> ERP Commercial v2.6
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 custom-scrollbar">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>Système Actif (Algérie)</span>
        </div>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white px-2 py-0.5 rounded-full font-bold text-[10px]">
            {unreadCount}
          </span>
        )}
      </div>
    </aside>
  );
};
