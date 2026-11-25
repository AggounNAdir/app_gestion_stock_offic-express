import React, { useState } from 'react';
import { FileText, Plus, ArrowRight, Printer, CheckCircle, Search } from 'lucide-react';
import { StoreData, Devis, LigneVente } from '../types';

interface DevisViewProps {
  data: StoreData;
  onRefresh: () => void;
}

export const DevisView: React.FC<DevisViewProps> = ({ data, onRefresh }) => {
  const [filterStatut, setFilterStatut] = useState<string>('Tous');
  const [showModal, setShowModal] = useState(false);
  const [selectedDevisForPrint, setSelectedDevisForPrint] = useState<Devis | null>(null);

  const [clientId, setClientId] = useState(data.clients[0]?.id || '');
  const [vendeurId, setVendeurId] = useState(data.vendeurs[0]?.id || '');
  const [lignesPanier, setLignesPanier] = useState<LigneVente[]>([]);
  const [currentProduitId, setCurrentProduitId] = useState(data.produits[0]?.id || '');
  const [qte, setQte] = useState(1);
  const [observations, setObservations] = useState('');

  const ajouterLigne = () => {
    const prod = data.produits.find(p => p.id === currentProduitId);
    if (!prod) return;
    const existing = lignesPanier.find(l => l.produit_id === prod.id);
    if (existing) {
      existing.quantite += qte;
      existing.total_ligne = existing.quantite * existing.prix_unitaire;
      setLignesPanier([...lignesPanier]);
    } else {
      setLignesPanier([
        ...lignesPanier,
        {
          produit_id: prod.id,
          produit_nom: prod.nom,
          quantite: qte,
          prix_unitaire: prod.prix_vente,
          remise_pct: 0,
          total_ligne: qte * prod.prix_vente
        }
      ]);
    }
  };

  const totalHT = lignesPanier.reduce((acc, l) => acc + l.total_ligne, 0);
  const totalTTC = totalHT; // 0% TVA or standard

  const handleCreerDevis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lignesPanier.length === 0) return alert('Ajoutez au moins un article');
    const client = data.clients.find(c => c.id === clientId);
    const vendeur = data.vendeurs.find(v => v.id === vendeurId);

    const payload = {
      client_id: clientId,
      client_nom: client ? client.nom : 'Client Divers',
      vendeur_id: vendeurId,
      vendeur_nom: vendeur ? vendeur.nom : 'Commercial',
      date_validite: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      lignes: lignesPanier,
      total_ht: totalHT,
      tva_total: 0,
      remise: 0,
      total_ttc: totalTTC,
      observations
    };

    try {
      const res = await fetch('/api/bureau/devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowModal(false);
        setLignesPanier([]);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConvertir = async (devisId: string) => {
    if (!confirm('Voulez-vous convertir ce devis en Bon de Vente validé ? (Déduction de stock et mise à jour client immédiates)')) return;
    try {
      const res = await fetch(`/api/bureau/devis/${devisId}/convertir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Erreur lors de la conversion');
      } else {
        alert('Devis converti avec succès en Bon de Vente ' + json.vente.numero);
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredDevis = data.devis.filter(d => filterStatut === 'Tous' || d.statut === filterStatut);
  const profile = data.profils_entreprise.devis;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Devis & Factures Proforma</h2>
          <p className="text-sm text-slate-500 mt-1">Création de devis clients avec conversion instantanée en 1 clic en Bon de Vente.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Devis</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center space-x-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
        {['Tous', 'Brouillon', 'Envoyé', 'Accepté', 'Converti'].map(st => (
          <button
            key={st}
            onClick={() => setFilterStatut(st)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filterStatut === st ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="p-4">N° Devis</th>
                <th className="p-4">Date</th>
                <th className="p-4">Client</th>
                <th className="p-4">Commercial</th>
                <th className="p-4">Total TTC</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDevis.map(dev => (
                <tr key={dev.id} className="hover:bg-slate-50 transition-all">
                  <td className="p-4 font-bold text-slate-900">{dev.numero}</td>
                  <td className="p-4 text-slate-600">{new Date(dev.date_devis).toLocaleDateString('fr-FR')}</td>
                  <td className="p-4 font-semibold text-slate-800">{dev.client_nom}</td>
                  <td className="p-4 text-slate-600">{dev.vendeur_nom}</td>
                  <td className="p-4 font-black text-indigo-600">{dev.total_ttc.toLocaleString()} DA</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      dev.statut === 'Converti' ? 'bg-emerald-50 text-emerald-700' :
                      dev.statut === 'Envoyé' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {dev.statut}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => setSelectedDevisForPrint(dev)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all inline-flex items-center gap-1 text-xs font-bold"
                      title="Imprimer Devis"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {dev.statut !== 'Converti' && (
                      <button
                        onClick={() => handleConvertir(dev.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-1"
                      >
                        <ArrowRight className="w-3.5 h-3.5" /> Convertir en Vente
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Création Devis */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-900">Établir un Devis / Proforma</h3>
            <form onSubmit={handleCreerDevis} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Client</label>
                  <select
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  >
                    {data.clients.map(c => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Commercial / Vendeur</label>
                  <select
                    value={vendeurId}
                    onChange={e => setVendeurId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                  >
                    {data.vendeurs.map(v => (
                      <option key={v.id} value={v.id}>{v.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add item */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-xs uppercase text-slate-500">Ajouter des articles</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <select
                      value={currentProduitId}
                      onChange={e => setCurrentProduitId(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl text-sm bg-white"
                    >
                      {data.produits.map(p => (
                        <option key={p.id} value={p.id}>{p.nom} ({p.prix_vente} DA)</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      min={1}
                      value={qte}
                      onChange={e => setQte(Number(e.target.value))}
                      className="w-20 p-2 border border-slate-200 rounded-xl text-sm bg-white text-center font-bold"
                    />
                    <button
                      type="button"
                      onClick={ajouterLigne}
                      className="flex-1 bg-indigo-600 text-white rounded-xl font-bold text-sm px-3 hover:bg-indigo-700"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>

              {/* Lignes table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold text-slate-600">
                    <tr>
                      <th className="p-3">Article</th>
                      <th className="p-3">Qte</th>
                      <th className="p-3">P.U DA</th>
                      <th className="p-3">Total DA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lignesPanier.map((l, idx) => (
                      <tr key={idx}>
                        <td className="p-3 font-semibold">{l.produit_nom}</td>
                        <td className="p-3">{l.quantite}</td>
                        <td className="p-3">{l.prix_unitaire}</td>
                        <td className="p-3 font-bold">{l.total_ligne}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-bold text-slate-700">Total TTC: {totalTTC.toLocaleString()} DA</span>
                <div className="space-x-2">
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
                    Enregistrer Devis
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Modal for Devis */}
      {selectedDevisForPrint && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h3 className="font-black text-xl text-slate-900">{profile.entete_nom}</h3>
                <p className="text-xs text-slate-500">{profile.slogan}</p>
                <p className="text-xs text-slate-500">{profile.adresse} - Tél: {profile.telephone}</p>
              </div>
              <div className="text-right">
                <h4 className="font-black text-lg text-indigo-600">DEVIS PROFORMA</h4>
                <span className="text-sm font-bold text-slate-800">{selectedDevisForPrint.numero}</span>
                <p className="text-xs text-slate-500">Date: {new Date(selectedDevisForPrint.date_devis).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl text-xs space-y-1">
              <p><strong className="text-slate-700">Client:</strong> {selectedDevisForPrint.client_nom}</p>
              <p><strong className="text-slate-700">Commercial:</strong> {selectedDevisForPrint.vendeur_nom}</p>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-600 font-bold">
                  <th className="py-2">Désignation</th>
                  <th className="py-2 text-center">Quantité</th>
                  <th className="py-2 text-right">P.U DA</th>
                  <th className="py-2 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedDevisForPrint.lignes.map((l, i) => (
                  <tr key={i}>
                    <td className="py-2 font-semibold text-slate-800">{l.produit_nom}</td>
                    <td className="py-2 text-center">{l.quantite}</td>
                    <td className="py-2 text-right">{l.prix_unitaire.toLocaleString()}</td>
                    <td className="py-2 text-right font-bold">{l.total_ligne.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end pt-2 border-t">
              <div className="w-48 space-y-1 text-xs">
                <div className="flex justify-between font-black text-sm text-indigo-600">
                  <span>Total TTC:</span>
                  <span>{selectedDevisForPrint.total_ttc.toLocaleString()} DA</span>
                </div>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-4 border-t">
              <p>{profile.pied_de_page}</p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setSelectedDevisForPrint(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Imprimer PDF / Papier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
