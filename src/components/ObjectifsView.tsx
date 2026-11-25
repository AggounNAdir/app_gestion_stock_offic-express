import React from 'react';
import { Target, TrendingUp, Award } from 'lucide-react';
import { StoreData } from '../types';

interface ObjectifsViewProps {
  data: StoreData;
}

export const ObjectifsView: React.FC<ObjectifsViewProps> = ({ data }) => {
  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Objectifs & Commissions Vendeurs</h2>
          <p className="text-sm text-slate-500 mt-1">Suivi des objectifs mensuels de chiffre d'affaires, taux d'atteinte et calcul des primes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.vendeurs.map(v => {
          const obj = data.objectifs.find(o => o.vendeur_id === v.id) || {
            objectif_ca: 1500000,
            taux_commission_pct: 3.5,
            prime_fixe: 15000
          };
          
          // Calculate CA realisé by vendeur
          const caRealise = data.ventes
            .filter(vt => vt.vendeur_id === v.id)
            .reduce((acc, vt) => acc + vt.total_ttc, 0);

          const ratio = (caRealise / obj.objectif_ca) * 100;
          const commissionEstimee = (caRealise * obj.taux_commission_pct) / 100 + obj.prime_fixe;

          return (
            <div key={v.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-black text-lg text-slate-900">{v.nom}</h3>
                  <span className="text-xs text-indigo-600 font-medium">Zone: {v.zone}</span>
                </div>
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                  Mars 2026
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">CA Réalisé / Objectif</span>
                  <span className="text-slate-900">{caRealise.toLocaleString()} / {obj.objectif_ca.toLocaleString()} DA</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, ratio)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                  <span>Taux d'atteinte: {ratio.toFixed(1)}%</span>
                  <span>Commission: {obj.taux_commission_pct}%</span>
                </div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl flex items-center justify-between text-emerald-900">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-bold">Prime & Commission Estimée:</span>
                </div>
                <span className="font-black text-base">{commissionEstimee.toLocaleString()} DA</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
