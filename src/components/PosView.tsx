import React, { useState, useRef } from 'react';
import { Store, Barcode, Printer, Trash2, Plus, Minus, CheckCircle } from 'lucide-react';
import { StoreData, LigneVente, Vente } from '../types';

interface PosViewProps {
  data: StoreData;
  onRefresh: () => void;
}

export const PosView: React.FC<PosViewProps> = ({ data, onRefresh }) => {
  const [panier, setPanier] = useState<LigneVente[]>([]);
  const [search, setSearch] = useState('');
  const [montantRecu, setMontantRecu] = useState(0);
  const [derniereVente, setDerniereVente] = useState<Vente | null>(null);

  const ajouterProduit = (prod: any) => {
    const existing = panier.find(l => l.produit_id === prod.id);
    if (existing) {
      existing.quantite += 1;
      existing.total_ligne = existing.quantite * existing.prix_unitaire;
      setPanier([...panier]);
    } else {
      setPanier([
        ...panier,
        {
          produit_id: prod.id,
          produit_nom: prod.nom,
          quantite: 1,
          prix_unitaire: prod.prix_vente,
          remise_pct: 0,
          total_ligne: prod.prix_vente
        }
      ]);
    }
  };

  const totalTTC = panier.reduce((acc, l) => acc + l.total_ligne, 0);
  const renduMonnaie = Math.max(0, montantRecu - totalTTC);

  const validerCaisse = async () => {
    if (panier.length === 0) return alert('Panier vide');
    const comptoirClient = data.clients.find(c => c.id === 'cli-comptoir') || data.clients[0];

    const payload = {
      client_id: comptoirClient.id,
      client_nom: comptoirClient.nom,
      vendeur_id: data.vendeurs[0]?.id || 'vend-1',
      vendeur_nom: 'Caisse Centrale',
      depot_id: 'dep-1',
      lignes: panier,
      total_ht: totalTTC,
      tva_total: 0,
      remise_globale: 0,
      total_ttc: totalTTC,
      montant_verse: montantRecu || totalTTC,
      reste_payer: 0,
      statut: 'Comptoir',
      mode_paiement: 'Espèces',
      observations: 'Vente Caisse POS Rapide'
    };

    try {
      const res = await fetch('/api/bureau/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const v = await res.json();
      if (res.ok) {
        setDerniereVente(v);
        setPanier([]);
        setMontantRecu(0);
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredProduits = data.produits.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    (p.code_barre && p.code_barre.includes(search)) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  const ticketProfile = data.profils_entreprise.ticket;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-7rem)] animate-in fade-in">
      {/* Catalogue & Search */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">Caisse Comptoir Rapide (POS)</h2>
            <p className="text-xs text-slate-500">Saisie ultra-rapide par clic ou code-barres / Entrée clavier.</p>
          </div>
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Scanner code-barres ou rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 content-start pr-1">
          {filteredProduits.map(p => (
            <button
              key={p.id}
              onClick={() => ajouterProduit(p)}
              className="p-4 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-2xl text-left transition-all flex flex-col justify-between group shadow-xs"
            >
              <div>
                <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{p.code}</span>
                <h4 className="font-bold text-sm text-slate-800 mt-2 line-clamp-2 group-hover:text-indigo-900">{p.nom}</h4>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-black text-slate-900 text-sm">{p.prix_vente} DA</span>
                <span className="text-xs text-slate-500 font-medium">{p.stock_actuel} {p.unite}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Panier & Ticket summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col h-full">
        <div className="flex items-center justify-between border-b pb-3 mb-3">
          <h3 className="font-bold text-lg text-slate-800">Panier Courant</h3>
          <button
            onClick={() => setPanier([])}
            className="text-red-500 hover:text-red-700 text-xs font-bold inline-flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Vider
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
          {panier.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-xs">Le panier est vide. Cliquez sur un article.</div>
          ) : (
            panier.map((l, idx) => (
              <div key={idx} className="pt-2 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-800">{l.produit_nom}</p>
                  <p className="text-slate-500">{l.quantite} x {l.prix_unitaire} DA</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-black text-slate-900">{l.total_ligne} DA</span>
                  <button
                    onClick={() => {
                      panier.splice(idx, 1);
                      setPanier([...panier]);
                    }}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t pt-4 space-y-3 mt-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Total à Payer:</span>
            <span className="font-black text-xl text-indigo-600">{totalTTC.toLocaleString()} DA</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Montant Reçu (Espèces):</label>
            <input
              type="number"
              value={montantRecu || ''}
              onChange={e => setMontantRecu(Number(e.target.value))}
              placeholder="0 DA"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-emerald-700"
            />
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl flex items-center justify-between text-emerald-900">
            <span className="text-xs font-bold">Rendu Monnaie:</span>
            <span className="font-black text-lg">{renduMonnaie.toLocaleString()} DA</span>
          </div>

          <button
            onClick={validerCaisse}
            disabled={panier.length === 0}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" /> Encaisser & Imprimer Ticket 80mm
          </button>
        </div>
      </div>

      {/* Hidden 80mm Thermal Receipt Print Template */}
      {derniereVente && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 print:w-[80mm] print:shadow-none">
            <div className="text-center space-y-1 border-b pb-3">
              <h4 className="font-black text-base">{ticketProfile.entete_nom}</h4>
              <p className="text-[10px] text-slate-500">{ticketProfile.adresse}</p>
              <p className="text-[10px] text-slate-500">Tél: {ticketProfile.telephone}</p>
              <span className="font-bold text-xs block pt-1">{derniereVente.numero}</span>
            </div>

            <div className="space-y-1 text-xs">
              <p>Date: {new Date(derniereVente.date_vente).toLocaleString('fr-FR')}</p>
              <p>Client: {derniereVente.client_nom}</p>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px]">
                  <th className="py-1">Article</th>
                  <th className="py-1 text-center">Qt</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {derniereVente.lignes.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1">{l.produit_nom}</td>
                    <td className="py-1 text-center">{l.quantite}</td>
                    <td className="py-1 text-right font-bold">{l.total_ligne}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t pt-2 space-y-1 text-xs font-bold">
              <div className="flex justify-between">
                <span>TOTAL TTC:</span>
                <span>{derniereVente.total_ttc} DA</span>
              </div>
              <div className="flex justify-between">
                <span>VERSÉ:</span>
                <span>{derniereVente.montant_verse} DA</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>RENDU:</span>
                <span>{derniereVente.montant_verse - derniereVente.total_ttc} DA</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-3 border-t">
              <p>{ticketProfile.pied_de_page}</p>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setDerniereVente(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs inline-flex items-center justify-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimer Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
