import React, { useState } from 'react';
import { Clock, AlertTriangle, Send, MessageSquare, CheckCircle, Search } from 'lucide-react';
import { StoreData, Vente } from '../types';

interface EcheancierViewProps {
  data: StoreData;
  onRefresh: () => void;
}

export const EcheancierView: React.FC<EcheancierViewProps> = ({ data, onRefresh }) => {
  const [selectedVenteForReminder, setSelectedVenteForReminder] = useState<Vente | null>(null);

  // Filter ventes with reste_payer > 0
  const ventesImpayees = data.ventes.filter(v => v.reste_payer > 0);

  const totalCreances = ventesImpayees.reduce((acc, v) => acc + v.reste_payer, 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Échéancier & Relances Factures Impayées</h2>
          <p className="text-sm text-slate-500 mt-1">Suivi des créances, jours de retard et générateur de relances professionnelles WhatsApp / Email.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-amber-900">
            <span className="text-xs font-semibold block text-amber-700">Total Créances Impayées</span>
            <span className="text-lg font-black">{totalCreances.toLocaleString()} DA</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="p-4">N° Vente</th>
                <th className="p-4">Date Vente</th>
                <th className="p-4">Client</th>
                <th className="p-4">Total TTC</th>
                <th className="p-4">Reste à Payer</th>
                <th className="p-4">Retard Estimé</th>
                <th className="p-4 text-right">Action Relance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ventesImpayees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">Aucune facture impayée. Tout est soldé !</td>
                </tr>
              ) : (
                ventesImpayees.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-all">
                    <td className="p-4 font-bold text-slate-900">{v.numero}</td>
                    <td className="p-4 text-slate-600">{new Date(v.date_vente).toLocaleDateString('fr-FR')}</td>
                    <td className="p-4 font-semibold text-slate-800">{v.client_nom}</td>
                    <td className="p-4 font-bold text-slate-900">{v.total_ttc.toLocaleString()} DA</td>
                    <td className="p-4 font-black text-amber-600">{v.reste_payer.toLocaleString()} DA</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
                        15 jours (En retard)
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedVenteForReminder(v)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 shadow-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Préparer Relance
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reminder Modal */}
      {selectedVenteForReminder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-slate-900">Message de Relance Professionnel</h3>
            <p className="text-xs text-slate-500">Prêt à copier/coller pour WhatsApp ou Email sans quitter l'application.</p>
            
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 font-mono space-y-2">
              <p>Bonjour cher client <strong>{selectedVenteForReminder.client_nom}</strong>,</p>
              <p>Sauf erreur de notre part, nous constatons un solde impayé de <strong>{selectedVenteForReminder.reste_payer.toLocaleString()} DA</strong> concernant notre bon de vente <strong>{selectedVenteForReminder.numero}</strong>.</p>
              <p>Merci de bien vouloir procéder au règlement par virement ou chèque dans les plus brefs délais.</p>
              <p>Cordialement,<br/>Service Comptabilité - GestionStock Pro</p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setSelectedVenteForReminder(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Bonjour ${selectedVenteForReminder.client_nom}, relance pour la facture ${selectedVenteForReminder.numero} d'un montant de ${selectedVenteForReminder.reste_payer} DA.`);
                  alert('Message copié dans le presse-papier !');
                  setSelectedVenteForReminder(null);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm inline-flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> Copier & Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
