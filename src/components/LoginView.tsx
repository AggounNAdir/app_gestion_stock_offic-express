import React, { useState } from 'react';
import { apiFetch } from '../api.ts';
import { PWAInstallButton } from './PWAComponents.tsx';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchTab = (next: 'admin' | 'client' | 'vendeur') => {
    setTab(next);
    setError(null);
    if (next === 'admin') {
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
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
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
              onClick={() => {
                setTab('admin');
                setIdent('admin');
                setPassword('admin123');
              }}
            >
              Admin (admin)
            </button>
            <button
              type="button"
              className="btn btn-muted"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => {
                setTab('admin');
                setIdent('gestionnaire');
                setPassword('gest123');
              }}
            >
              Gestionnaire
            </button>
            <button
              type="button"
              className="btn btn-muted"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => {
                setTab('admin');
                setIdent('caissier');
                setPassword('caisse123');
              }}
            >
              Caissier
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
