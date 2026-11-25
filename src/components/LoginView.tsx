import React, { useState } from 'react';
import { apiFetch } from '../api.ts';
import { PWAInstallButton } from './PWAComponents.tsx';
import { Eye, EyeOff } from 'lucide-react';

export type SessionState =
  | {
      kind: 'admin';
      token: string;
      username: string;
      nom_complet: string;
      role: string;
    }
  | {
      kind: 'client';
      token: string;
      code_client: string;
    }
  | {
      kind: 'vendeur';
      token: string;
      vendeur: { id: number; code: string; nom: string; tel?: string };
    };

export function LoginView({
  onLogin,
}: {
  onLogin: (session: SessionState) => void;
}) {
  const [tab, setTab] = useState<'admin' | 'client' | 'vendeur'>('admin');
  const [ident, setIdent] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedAdminRole, setSelectedAdminRole] = useState<'admin' | 'gestionnaire' | 'caissier' | 'comptable'>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchTab = (next: 'admin' | 'client' | 'vendeur') => {
    setTab(next);
    setError(null);
    if (next === 'admin') {
      setSelectedAdminRole('admin');
      setIdent('admin');
      setPassword('admin123');
    } else if (next === 'client') {
      setIdent('CLT-0001');
      setPassword('client123');
    } else {
      setIdent('VND-0001');
      setPassword('vendeur123');
    }
  };

  const handleAdminRoleChange = (role: 'admin' | 'gestionnaire' | 'caissier' | 'comptable') => {
    setSelectedAdminRole(role);
    if (role === 'admin') {
      setIdent('admin');
      setPassword('admin123');
    } else if (role === 'gestionnaire') {
      setIdent('gestionnaire');
      setPassword('gest123');
    } else if (role === 'caissier') {
      setIdent('caissier');
      setPassword('caisse123');
    } else if (role === 'comptable') {
      setIdent('comptable');
      setPassword('compta123');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (tab === 'admin') {
        const res = await apiFetch<{
          access_token: string;
          username: string;
          nom_complet: string;
          role: string;
        }>('/api/portal/auth/login-admin', {
          method: 'POST',
          body: JSON.stringify({ username: ident, password }),
        });
        onLogin({
          kind: 'admin',
          token: res.access_token,
          username: res.username,
          nom_complet: res.nom_complet,
          role: res.role,
        });
      } else if (tab === 'client') {
        const res = await apiFetch<{ access_token: string }>(
          '/api/portal/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ code_client: ident, password }),
          }
        );
        onLogin({
          kind: 'client',
          token: res.access_token,
          code_client: ident,
        });
      } else {
        const res = await apiFetch<{
          access_token: string;
          vendeur: { id: number; code: string; nom: string; tel?: string };
        }>('/api/portal/auth/login-vendeur', {
          method: 'POST',
          body: JSON.stringify({ code_vendeur: ident, password }),
        });
        onLogin({
          kind: 'vendeur',
          token: res.access_token,
          vendeur: res.vendeur,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>📦 Gestion de Stock</h1>
            <p className="page-subtitle">
              Application Bureau, Portail Client &amp; Tournée Vendeurs
            </p>
          </div>
          <PWAInstallButton />
        </div>

        <div className="tabs">
          <button
            type="button"
            className={`tab-btn ${tab === 'admin' ? 'active' : ''}`}
            onClick={() => switchTab('admin')}
          >
            🏢 Bureau / Admin
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'client' ? 'active' : ''}`}
            onClick={() => switchTab('client')}
          >
            🌐 Portail Client
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'vendeur' ? 'active' : ''}`}
            onClick={() => switchTab('vendeur')}
          >
            🚚 Tournée Vendeur
          </button>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'admin' && (
            <div className="form-field">
              <label>Sélection du Rôle / Profil Bureau</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                <button
                  type="button"
                  className={`btn ${selectedAdminRole === 'admin' ? 'btn-primary' : 'btn-muted'}`}
                  style={{ fontSize: 12, padding: '6px 10px', justifyContent: 'center' }}
                  onClick={() => handleAdminRoleChange('admin')}
                >
                  🏢 Administrateur
                </button>
                <button
                  type="button"
                  className={`btn ${selectedAdminRole === 'gestionnaire' ? 'btn-primary' : 'btn-muted'}`}
                  style={{ fontSize: 12, padding: '6px 10px', justifyContent: 'center' }}
                  onClick={() => handleAdminRoleChange('gestionnaire')}
                >
                  📋 Gestionnaire
                </button>
                <button
                  type="button"
                  className={`btn ${selectedAdminRole === 'caissier' ? 'btn-primary' : 'btn-muted'}`}
                  style={{ fontSize: 12, padding: '6px 10px', justifyContent: 'center' }}
                  onClick={() => handleAdminRoleChange('caissier')}
                >
                  🛒 Caissier(ère)
                </button>
                <button
                  type="button"
                  className={`btn ${selectedAdminRole === 'comptable' ? 'btn-primary' : 'btn-muted'}`}
                  style={{ fontSize: 12, padding: '6px 10px', justifyContent: 'center' }}
                  onClick={() => handleAdminRoleChange('comptable')}
                >
                  📊 Comptable
                </button>
              </div>
            </div>
          )}

          <div className="form-field">
            <label>
              {tab === 'admin'
                ? "Nom d'utilisateur"
                : tab === 'client'
                  ? 'Code Client'
                  : 'Code Vendeur'}
            </label>
            <input
              className="input"
              value={ident}
              onChange={(e) => setIdent(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label>Mot de passe</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4,
                }}
                title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn" disabled={loading} style={{ justifyContent: 'center', padding: '10px 14px' }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--muted)',
          }}
        >
          <div>Comptes de démonstration pré-remplis :</div>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              className="btn btn-muted"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => handleAdminRoleChange('admin')}
            >
              Admin
            </button>
            <button
              type="button"
              className="btn btn-muted"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => handleAdminRoleChange('gestionnaire')}
            >
              Gestionnaire
            </button>
            <button
              type="button"
              className="btn btn-muted"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => handleAdminRoleChange('caissier')}
            >
              Caissier
            </button>
            <button
              type="button"
              className="btn btn-muted"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => handleAdminRoleChange('comptable')}
            >
              Comptable
            </button>
            <button
              type="button"
              className="btn btn-muted"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => switchTab('client')}
            >
              Client (CLT-0001)
            </button>
            <button
              type="button"
              className="btn btn-muted"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => switchTab('vendeur')}
            >
              Vendeur (VND-0001)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

