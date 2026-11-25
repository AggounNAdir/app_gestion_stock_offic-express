import React, { useState, useEffect } from 'react';
import { Settings, Shield, Download, Save, RefreshCw, Database } from 'lucide-react';
import { StoreData } from '../types';

interface ParametresViewProps {
  data: StoreData;
  onRefresh: () => void;
}

export const ParametresView: React.FC<ParametresViewProps> = ({ data, onRefresh }) => {
  const [backups, setBackups] = useState<any[]>([]);
  const [backupConfig, setBackupConfig] = useState(data.backup_config);
  const [profilDevis, setProfilDevis] = useState(data.profils_entreprise.devis);
  const [licenseKey, setLicenseKey] = useState(data.license.cle);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      const res = await fetch('/api/bureau/backups');
      const json = await res.json();
      setBackups(json);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreerBackup = async () => {
    try {
      await fetch('/api/bureau/backups/creer', { method: 'POST' });
      fetchBackups();
      alert('Sauvegarde manuelle créée avec succès !');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const saveBackupConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/bureau/config/backup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupConfig)
      });
      alert('Configuration des sauvegardes enregistrée !');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const saveProfil = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/bureau/config/profils', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devis: profilDevis, facture: profilDevis, ticket: profilDevis })
      });
      alert('Profil entreprise mis à jour !');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const activateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/bureau/config/license', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cle: licenseKey,
          client_nom: 'SARL CLIENT OFFICIEL ACTIF',
          date_expiration: '2028-12-31'
        })
      });
      if (res.ok) {
        alert('Licence activée avec succès !');
        onRefresh();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-2xl font-black text-slate-900">Paramètres, Sauvegardes & Licence</h2>
        <p className="text-sm text-slate-500 mt-1">Configuration générale de l'ERP, profils d'impression et gestion des clés de licence.</p>
      </div>

      {/* Licence Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600" /> Gestion de Licence Logiciel (Client)
        </h3>
        <form onSubmit={activateLicense} className="flex gap-4">
          <input
            type="text"
            value={licenseKey}
            onChange={e => setLicenseKey(e.target.value)}
            placeholder="Clé d'activation (ex: GSKEY-...)"
            className="flex-1 p-2.5 border border-slate-200 rounded-xl font-mono text-sm"
            required
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md"
          >
            Activer la Licence
          </button>
        </form>
        <div className="text-xs text-slate-500">
          Statut: <strong className={data.license.est_valide ? 'text-emerald-600' : 'text-red-600'}>
            {data.license.est_valide ? `Valide (${data.license.jours_restants} jours restants)` : 'Expirée ou Invalide'}
          </strong>
        </div>
      </div>

      {/* Company Profile Edit */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-lg text-slate-800">Profil Entreprise (Entête Devis, Factures & Tickets)</h3>
        <form onSubmit={saveProfil} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Raison Sociale / Entête</label>
              <input
                type="text"
                value={profilDevis.entete_nom}
                onChange={e => setProfilDevis({ ...profilDevis, entete_nom: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Slogan</label>
              <input
                type="text"
                value={profilDevis.slogan}
                onChange={e => setProfilDevis({ ...profilDevis, slogan: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">RC (Registre Commerce)</label>
              <input
                type="text"
                value={profilDevis.rc}
                onChange={e => setProfilDevis({ ...profilDevis, rc: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">NIF</label>
              <input
                type="text"
                value={profilDevis.nif}
                onChange={e => setProfilDevis({ ...profilDevis, nif: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Téléphone</label>
              <input
                type="text"
                value={profilDevis.telephone}
                onChange={e => setProfilDevis({ ...profilDevis, telephone: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Adresse</label>
            <input
              type="text"
              value={profilDevis.adresse}
              onChange={e => setProfilDevis({ ...profilDevis, adresse: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md"
            >
              Enregistrer le Profil
            </button>
          </div>
        </form>
      </div>

      {/* Sauvegardes */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" /> Sauvegardes & Rétention Automatique
          </h3>
          <button
            onClick={handleCreerBackup}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Créer Sauvegarde Manuelle</span>
          </button>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 font-bold text-slate-600">
              <tr>
                <th className="p-3">Nom du Fichier</th>
                <th className="p-3">Date</th>
                <th className="p-3">Taille</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.map(b => (
                <tr key={b.name} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-800">{b.name}</td>
                  <td className="p-3 text-slate-600">{new Date(b.time).toLocaleString('fr-FR')}</td>
                  <td className="p-3 text-slate-600">{(b.size / 1024).toFixed(1)} Ko</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
