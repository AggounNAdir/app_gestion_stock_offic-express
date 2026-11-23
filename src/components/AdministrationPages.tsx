import React, { useEffect, useState } from 'react';
import { apiFetch, THEMES } from '../api.ts';
import type { ThemeKey } from '../api.ts';

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════
// UTILISATEURS & RBAC (Création, Édition, Activer/Désactiver, Reset MDP)
// ══════════════════════════════════════════════════════════════
export function UtilisateursPage({ token }: { token: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    nom_complet: '',
    password: '',
    role: 'vendeur',
  });

  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    nom_complet: '',
    role: 'vendeur',
    actif: 1,
  });

  const [resetUser, setResetUser] = useState<any>(null);
  const [resetPwd, setResetPwd] = useState('');

  const load = async () => {
    setError(null);
    try {
      setUsers(await apiFetch('/api/bureau/utilisateurs', { token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement utilisateurs');
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/bureau/utilisateurs', {
        method: 'POST',
        token,
        body: JSON.stringify(userForm),
      });
      setUserForm({ username: '', nom_complet: '', password: '', role: 'vendeur' });
      setMessage('Compte utilisateur créé.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur création compte');
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setError(null);
    try {
      await apiFetch(`/api/bureau/utilisateurs/${editUser.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify(editForm),
      });
      setEditUser(null);
      setMessage('Utilisateur modifié.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur modification');
    }
  };

  const toggleActif = async (u: any) => {
    setError(null);
    try {
      await apiFetch(`/api/bureau/utilisateurs/${u.id}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ actif: u.actif ? 0 : 1 }),
      });
      setMessage(u.actif ? `Compte ${u.username} désactivé.` : `Compte ${u.username} réactivé.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur changement statut');
    }
  };

  const submitResetPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    setError(null);
    try {
      await apiFetch(`/api/bureau/utilisateurs/${resetUser.id}/reset-password`, {
        method: 'POST',
        token,
        body: JSON.stringify({ password: resetPwd }),
      });
      setResetUser(null);
      setResetPwd('');
      setMessage(`Mot de passe réinitialisé pour ${resetUser.username}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réinitialisation mot de passe');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">🔐 Utilisateurs &amp; Droits RBAC</h2>
          <p className="page-subtitle">Gestion des accès, rôles, activation et mots de passe</p>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}
      {message && <div className="alert-box alert-success">{message}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 10px' }}>+ Créer un Compte Utilisateur</h4>
        <form onSubmit={submitCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="Identifiant"
            value={userForm.username}
            onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
            required
          />
          <input
            className="input"
            placeholder="Nom complet"
            value={userForm.nom_complet}
            onChange={(e) => setUserForm({ ...userForm, nom_complet: e.target.value })}
            required
          />
          <input
            type="password"
            className="input"
            placeholder="Mot de passe (min 6)"
            value={userForm.password}
            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            required
          />
          <select
            className="select"
            value={userForm.role}
            onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
          >
            <option value="admin">Administrateur</option>
            <option value="gestionnaire">Gestionnaire</option>
            <option value="vendeur">Vendeur</option>
            <option value="caissier">Caissier</option>
            <option value="lecture_seule">Lecture seule</option>
          </select>
          <button className="btn btn-green" type="submit">
            + Créer
          </button>
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Identifiant</th>
              <th>Nom complet</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Dernière connexion</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ opacity: u.actif ? 1 : 0.6 }}>
                <td style={{ fontWeight: 600 }}>{u.username}</td>
                <td>{u.nom_complet}</td>
                <td>
                  <span className="badge badge-blue">{u.role_libelle}</span>
                </td>
                <td>
                  <span className={`badge ${u.actif ? 'badge-green' : 'badge-red'}`}>
                    {u.actif ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
                <td>{u.derniere_connexion || '—'}</td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                  <button
                    className="btn btn-muted"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={() => {
                      setEditUser(u);
                      setEditForm({
                        nom_complet: u.nom_complet,
                        role: u.role,
                        actif: u.actif,
                      });
                    }}
                  >
                    ✏ Modifier
                  </button>
                  <button
                    className="btn btn-orange"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={() => {
                      setResetUser(u);
                      setResetPwd('');
                    }}
                  >
                    🔑 Reset MDP
                  </button>
                  {u.username !== 'admin' && (
                    <button
                      className={`btn ${u.actif ? 'btn-red' : 'btn-green'}`}
                      style={{ padding: '4px 8px', fontSize: 11 }}
                      onClick={() => toggleActif(u)}
                    >
                      {u.actif ? '⏻ Désactiver' : '▶ Activer'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 420 }}>
            <h3 style={{ marginTop: 0 }}>✏ Modifier — {editUser.username}</h3>
            <form onSubmit={submitEdit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-field">
                <label>Nom complet</label>
                <input
                  className="input"
                  value={editForm.nom_complet}
                  onChange={(e) => setEditForm({ ...editForm, nom_complet: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label>Rôle RBAC</label>
                <select
                  className="select"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="admin">Administrateur</option>
                  <option value="gestionnaire">Gestionnaire</option>
                  <option value="vendeur">Vendeur</option>
                  <option value="caissier">Caissier</option>
                  <option value="lecture_seule">Lecture seule</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-muted" onClick={() => setEditUser(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-green">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetUser && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 400 }}>
            <h3 style={{ marginTop: 0 }}>🔑 Réinitialiser Mot de Passe — {resetUser.username}</h3>
            <form onSubmit={submitResetPwd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-field">
                <label>Nouveau mot de passe (min 6 caractères)</label>
                <input
                  type="password"
                  className="input"
                  minLength={6}
                  value={resetPwd}
                  onChange={(e) => setResetPwd(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-muted" onClick={() => setResetUser(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-orange">
                  Réinitialiser
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// JOURNAL D'AUDIT (Filtres, Pagination, Export CSV)
// ══════════════════════════════════════════════════════════════
export function JournalAuditPage({ token }: { token: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('Toutes');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<any[]>('/api/bureau/journal-audit', { token })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur journal audit'));
  }, [token]);

  const actions = Array.from(new Set(rows.map((r) => r.action)));
  const filtered = rows
    .filter((a) => actionFilter === 'Toutes' || a.action === actionFilter)
    .filter(
      (a) =>
        !search ||
        (a.utilisateur || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.action || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.details || '').toLowerCase().includes(search.toLowerCase())
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportCsv = () => {
    const header = ['Horodatage', 'Utilisateur', 'Action', 'Cible', 'Détails', 'Résultat'].join(';');
    const lines = filtered.map((a) =>
      [
        a.date_action,
        a.utilisateur,
        a.action,
        a.cible_type ? `${a.cible_type}#${a.cible_id || ''}` : '',
        `"${(a.details || '').replace(/"/g, '""')}"`,
        a.reussite ? 'Succès' : 'Échec',
      ].join(';')
    );
    downloadCsv([header, ...lines].join('\n'), `journal_audit_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">🗂️ Journal d'Audit (Lecture seule)</h2>
          <p className="page-subtitle">Traçabilité complète des actions critiques et connexions</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-muted" onClick={exportCsv}>
            📄 Export CSV
          </button>
          <button className="btn btn-muted" onClick={() => window.print()}>
            🖨 Imprimer
          </button>
        </div>
      </div>

      {error && <div className="alert-box alert-error">{error}</div>}

      <div className="toolbar">
        <input
          className="input"
          style={{ width: 250 }}
          placeholder="Rechercher utilisateur, action, détails..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="select"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="Toutes">Toutes les actions</option>
          {actions.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>
        <span style={{ color: 'var(--muted)' }}>
          {filtered.length} entrée(s) — Page {currentPage}/{totalPages}
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Horodatage</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>Détails</th>
              <th>Résultat</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((a) => (
              <tr key={a.id}>
                <td>{a.date_action}</td>
                <td style={{ fontWeight: 600 }}>{a.utilisateur}</td>
                <td>
                  <span className="badge badge-blue">{a.action}</span>
                </td>
                <td>{a.details || '—'}</td>
                <td>
                  <span className={`badge ${a.reussite ? 'badge-green' : 'badge-red'}`}>
                    {a.reussite ? 'Succès' : 'Échec'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 12, alignItems: 'center' }}>
          <button
            className="btn btn-muted"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ◀ Précédent
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            Page {currentPage} sur {totalPages}
          </span>
          <button
            className="btn btn-muted"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Suivant ▶
          </button>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// SECTION PROFILS : ASSOCIATION DOCUMENTS + THÈMES + MAINTENANCE RESET
// ══════════════════════════════════════════════════════════════
interface BackupFileItem {
  filename: string;
  size_bytes: number;
  created_at: string;
  created_by: string;
  stats?: {
    produits: number;
    clients: number;
    fournisseurs: number;
    bons_vente: number;
    bons_achat: number;
    factures: number;
    utilisateurs: number;
  } | null;
}

export function ProfilDocsAndSystemSection({
  token,
  profils,
  themeKey,
  onChangeTheme,
  onMessage,
  onError,
  onReload,
}: {
  token: string;
  profils: any[];
  themeKey?: ThemeKey;
  onChangeTheme?: (k: ThemeKey) => void;
  onMessage: (m: string) => void;
  onError: (e: string) => void;
  onReload: () => void;
}) {
  const [docConfig, setDocConfig] = useState({
    facture: 1,
    bon_livraison: 1,
    devis: 1,
    situation: 1,
  });
  const [showResetModal, setShowResetModal] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');

  // État Sauvegarde & Restauration
  const [backups, setBackups] = useState<BackupFileItem[]>([]);
  const [pgActive, setPgActive] = useState<boolean | null>(null);
  const [backupForbidden, setBackupForbidden] = useState(false);
  const [backupLabel, setBackupLabel] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);

  const [restoreTarget, setRestoreTarget] = useState<{
    sourceLabel: string;
    filename?: string;
    backup?: any;
    stats?: BackupFileItem['stats'];
    created_at?: string;
  } | null>(null);
  const [restorePwd, setRestorePwd] = useState('');
  const [restoring, setRestoring] = useState(false);

  const loadBackups = async () => {
    try {
      const res = await apiFetch<{
        postgres_actif: boolean;
        sauvegardes: BackupFileItem[];
      }>('/api/bureau/systeme/sauvegardes', { token });
      setPgActive(Boolean(res.postgres_actif));
      setBackups(Array.isArray(res.sauvegardes) ? res.sauvegardes : []);
      setBackupForbidden(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('administrateur') || msg.toLowerCase().includes('refusé')) {
        setBackupForbidden(true);
      }
    }
  };

  useEffect(() => {
    apiFetch<any>('/api/bureau/profils-documents', { token })
      .then((res) => {
        if (res) setDocConfig(res);
      })
      .catch(() => {});
    loadBackups();
  }, [token]);

  const saveDocConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/bureau/profils-documents', {
        method: 'PUT',
        token,
        body: JSON.stringify(docConfig),
      });
      onMessage('Association Profil → Document enregistrée.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erreur sauvegarde profils-documents');
    }
  };

  const confirmResetBase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/bureau/systeme/reinitialiser', {
        method: 'POST',
        token,
        body: JSON.stringify({ password: adminPwd }),
      });
      setShowResetModal(false);
      setAdminPwd('');
      onMessage('Base opérationnelle réinitialisée à zéro (référentiels et comptes conservés).');
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erreur réinitialisation système');
    }
  };

  const handleCreateServerBackup = async () => {
    setBackupBusy(true);
    try {
      const res = await apiFetch<{ filename: string; size_bytes: number }>(
        '/api/bureau/systeme/sauvegardes/creer',
        {
          method: 'POST',
          token,
          body: JSON.stringify({ label: backupLabel }),
        }
      );
      setBackupLabel('');
      onMessage(`Sauvegarde créée sur le serveur : ${res.filename} (${Math.max(1, Math.round(res.size_bytes / 1024))} Ko).`);
      await loadBackups();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erreur création sauvegarde');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleDownloadBackup = async (filename?: string) => {
    setBackupBusy(true);
    try {
      const url = filename
        ? `/api/bureau/systeme/sauvegardes/telecharger?file=${encodeURIComponent(filename)}`
        : '/api/bureau/systeme/sauvegardes/telecharger';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        let detail = 'Erreur téléchargement sauvegarde';
        try {
          detail = JSON.parse(txt).detail || detail;
        } catch {
          // ignore
        }
        throw new Error(detail);
      }
      const blob = await res.blob();
      const dlName =
        filename || `sauvegarde_gestion_stock_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = dlName;
      a.click();
      URL.revokeObjectURL(objectUrl);
      onMessage(`Copie téléchargée : ${dlName}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erreur téléchargement sauvegarde');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    setBackupBusy(true);
    try {
      await apiFetch(`/api/bureau/systeme/sauvegardes/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        token,
      });
      setConfirmDeleteFile(null);
      onMessage(`Sauvegarde supprimée : ${filename}`);
      await loadBackups();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erreur suppression sauvegarde');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleFileSelectForRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || parsed.format !== 'gestion-stock-backup' || !parsed.data) {
        onError('Fichier invalide : ce fichier ne provient pas d’une sauvegarde Gestion de Stock.');
        return;
      }
      setRestorePwd('');
      setRestoreTarget({
        sourceLabel: file.name,
        backup: parsed,
        stats: parsed.stats || null,
        created_at: parsed.created_at,
      });
    } catch {
      onError('Impossible de lire ce fichier JSON de sauvegarde.');
    }
  };

  const confirmRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const body = restoreTarget.filename
        ? { password: restorePwd, filename: restoreTarget.filename }
        : { password: restorePwd, backup: restoreTarget.backup };
      const res = await apiFetch<{ ok: boolean; safety_backup: string }>(
        '/api/bureau/systeme/restaurer',
        {
          method: 'POST',
          token,
          body: JSON.stringify(body),
        }
      );
      setRestoreTarget(null);
      setRestorePwd('');
      onMessage(
        `Base restaurée avec succès ! Une copie de sécurité préalable a été enregistrée (${res.safety_backup}).`
      );
      await loadBackups();
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erreur lors de la restauration');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
      {/* Association Profil -> Document */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>📄 Association Profil Entreprise → Type de Document</h3>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: -6 }}>
          Choisissez quel profil société est imprimé par défaut selon la nature du document.
        </p>
        <form onSubmit={saveDocConfig} className="form-grid">
          {(
            [
              ['facture', '🧾 Factures'],
              ['bon_livraison', '🏷️ Bons de Livraison / Vente'],
              ['devis', '📝 Devis / Proforma'],
              ['situation', '📊 Relevés de Situation'],
            ] as const
          ).map(([field, label]) => (
            <div key={field} className="form-field">
              <label>{label}</label>
              <select
                className="select"
                value={docConfig[field]}
                onChange={(e) => setDocConfig({ ...docConfig, [field]: Number(e.target.value) })}
              >
                {profils.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.nom} ({pr.code})
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-green">
              ✓ Enregistrer les associations
            </button>
          </div>
        </form>
      </div>

      {/* Apparence & Thèmes */}
      {onChangeTheme && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>🎨 Apparence — Thème de l'Application</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            {(Object.keys(THEMES) as ThemeKey[]).map((k) => {
              const t = THEMES[k];
              const isAct = themeKey === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onChangeTheme(k)}
                  className="card"
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderColor: isAct ? 'var(--accent)' : 'var(--border)',
                    borderWidth: isAct ? 2 : 1,
                    background: t.CARD,
                    color: t.TEXT,
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    {t.emoji} {t.name} {isAct ? '✓' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: t.BG, border: '1px solid #888' }} />
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: t.ACCENT }} />
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: t.GREEN }} />
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: t.ORANGE }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sauvegarde & Restauration de la Base */}
      <div className="card" style={{ borderColor: 'var(--accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ margin: 0 }}>💾 Sauvegarde & Restauration des Données</h3>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: '4px 0 0' }}>
              Exportez une copie complète (produits, clients, factures, bons, stock, utilisateurs, profils) sur votre PC ou dans le dossier serveur <code>backups/</code>.
              {pgActive !== null && (
                <span style={{ marginLeft: 8 }}>
                  Base active : <strong>{pgActive ? 'PostgreSQL' : 'Mémoire locale'}</strong>
                </span>
              )}
            </p>
          </div>
        </div>

        {backupForbidden ? (
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12, marginBottom: 0 }}>
            Section réservée aux comptes Administrateur.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-accent"
                disabled={backupBusy}
                onClick={() => handleDownloadBackup()}
              >
                ⬇️ Télécharger une copie (.json)
              </button>

              <label className="btn btn-muted" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                ♻️ Restaurer depuis un fichier (.json)
                <input
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={handleFileSelectForRestore}
                />
              </label>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <input
                type="text"
                className="input"
                style={{ maxWidth: 260 }}
                placeholder="Libellé optionnel (ex: fin_mois)"
                value={backupLabel}
                onChange={(e) => setBackupLabel(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-green"
                disabled={backupBusy}
                onClick={handleCreateServerBackup}
              >
                💾 Enregistrer copie sur serveur (backups/)
              </button>
            </div>

            {backups.length > 0 ? (
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fichier</th>
                      <th>Date</th>
                      <th>Auteur</th>
                      <th>Contenu</th>
                      <th>Taille</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b) => (
                      <tr key={b.filename}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.filename}</td>
                        <td>{new Date(b.created_at).toLocaleString('fr-FR')}</td>
                        <td>{b.created_by}</td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {b.stats
                            ? `${b.stats.produits} prod · ${b.stats.clients} clt · ${b.stats.bons_vente} BV · ${b.stats.factures} fac`
                            : '—'}
                        </td>
                        <td>{Math.max(1, Math.round(b.size_bytes / 1024))} Ko</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-muted"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => handleDownloadBackup(b.filename)}
                            >
                              ⬇️
                            </button>
                            <button
                              type="button"
                              className="btn btn-accent"
                              style={{ padding: '4px 8px', fontSize: 12 }}
                              onClick={() => {
                                setRestorePwd('');
                                setRestoreTarget({
                                  sourceLabel: b.filename,
                                  filename: b.filename,
                                  stats: b.stats,
                                  created_at: b.created_at,
                                });
                              }}
                            >
                              ♻️ Restaurer
                            </button>
                            {confirmDeleteFile === b.filename ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-red"
                                  style={{ padding: '4px 8px', fontSize: 12 }}
                                  disabled={backupBusy}
                                  onClick={() => handleDeleteBackup(b.filename)}
                                >
                                  Confirmer
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-muted"
                                  style={{ padding: '4px 8px', fontSize: 12 }}
                                  onClick={() => setConfirmDeleteFile(null)}
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-muted"
                                style={{ padding: '4px 8px', fontSize: 12 }}
                                onClick={() => setConfirmDeleteFile(b.filename)}
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                Aucune sauvegarde enregistrée dans le dossier <code>backups/</code> pour le moment.
              </p>
            )}
          </>
        )}
      </div>

      {/* Maintenance Système */}
      <div className="card" style={{ borderColor: 'var(--red)' }}>
        <h3 style={{ marginTop: 0, color: 'var(--red)' }}>⚠️ Maintenance Système</h3>
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>
          Remet à zéro les documents opérationnels (bons de vente, bons d'achat, factures, retours, versements, chargements et mouvements) tout en conservant les produits, tiers, profils et utilisateurs.
        </p>
        <button type="button" className="btn btn-red" onClick={() => setShowResetModal(true)}>
          💣 Réinitialiser la Base à Zéro
        </button>
      </div>

      {restoreTarget && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 460 }}>
            <h3 style={{ marginTop: 0 }}>♻️ Confirmer la Restauration</h3>
            <p style={{ fontSize: 13 }}>
              Source : <strong>{restoreTarget.sourceLabel}</strong>
              {restoreTarget.created_at && (
                <>
                  <br />
                  Date de création : {new Date(restoreTarget.created_at).toLocaleString('fr-FR')}
                </>
              )}
              {restoreTarget.stats && (
                <>
                  <br />
                  Contenu : {restoreTarget.stats.produits} produits, {restoreTarget.stats.clients} clients,{' '}
                  {restoreTarget.stats.bons_vente} bons de vente, {restoreTarget.stats.factures} factures
                </>
              )}
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              Les données actuelles seront remplacées par cette copie. Une sauvegarde automatique de sécurité sera créée avant la restauration.
            </p>
            <form onSubmit={confirmRestore} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="password"
                className="input"
                placeholder="Mot de passe administrateur"
                value={restorePwd}
                onChange={(e) => setRestorePwd(e.target.value)}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-muted"
                  disabled={restoring}
                  onClick={() => setRestoreTarget(null)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-accent" disabled={restoring}>
                  {restoring ? 'Restauration...' : 'Confirmer la Restauration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="modal-backdrop">
          <div className="modal-panel" style={{ maxWidth: 420 }}>
            <h3 style={{ marginTop: 0, color: 'var(--red)' }}>💣 Confirmation Réinitialisation</h3>
            <p style={{ fontSize: 13 }}>
              Cette opération supprime irréversiblement toutes les transactions de l'exercice courant. Saisissez votre mot de passe administrateur pour confirmer.
            </p>
            <form onSubmit={confirmResetBase} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="password"
                className="input"
                placeholder="Mot de passe administrateur"
                value={adminPwd}
                onChange={(e) => setAdminPwd(e.target.value)}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-muted" onClick={() => setShowResetModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-red">
                  Confirmer Réinitialisation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
