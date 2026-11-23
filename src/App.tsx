import React, { useEffect, useState } from 'react';
import { applyTheme, THEMES } from './api.ts';
import type { ThemeKey } from './api.ts';
import { LoginView } from './components/LoginView.tsx';
import type { SessionState } from './components/LoginView.tsx';
import { BureauPageContent } from './components/BureauPages.tsx';
import { PortalClientView } from './components/PortalClientView.tsx';
import { VendeurTourneeView } from './components/VendeurTourneeView.tsx';
import { OfflineIndicator, PWAInstallButton } from './components/PWAComponents.tsx';

const NAV_GROUPS: {
  section: string;
  items: { icon: string; label: string; key: string; roles?: string[] }[];
}[] = [
  {
    section: 'Accueil',
    items: [{ icon: '🏠', label: 'Tableau de Bord', key: 'dashboard' }],
  },
  {
    section: 'Référentiels et partenaires',
    items: [
      { icon: '📦', label: 'Produits', key: 'produits', roles: ['admin', 'gestionnaire', 'vendeur', 'lecture_seule'] },
      { icon: '💲', label: 'Grille des Prix', key: 'grille_prix', roles: ['admin', 'gestionnaire', 'vendeur', 'lecture_seule'] },
      { icon: '👥', label: 'Clients', key: 'clients', roles: ['admin', 'gestionnaire', 'vendeur', 'lecture_seule'] },
      { icon: '🎯', label: 'Prospects Vendeurs', key: 'prospects_vendeurs', roles: ['admin', 'gestionnaire', 'lecture_seule'] },
      { icon: '🏭', label: 'Fournisseurs', key: 'fournisseurs', roles: ['admin', 'gestionnaire', 'vendeur', 'lecture_seule'] },
    ],
  },
  {
    section: 'Stock et tournée',
    items: [
      { icon: '📋', label: 'Mouvements Stock', key: 'mouvements_stock', roles: ['admin', 'gestionnaire', 'lecture_seule'] },
      { icon: '👔', label: 'Vendeurs', key: 'vendeurs', roles: ['admin', 'gestionnaire', 'lecture_seule'] },
      { icon: '🚚', label: 'Bons de chargement', key: 'chargements', roles: ['admin', 'gestionnaire', 'lecture_seule'] },
      { icon: '↩️', label: 'Retours vendeurs', key: 'retours_vendeur', roles: ['admin', 'gestionnaire', 'lecture_seule'] },
    ],
  },
  {
    section: 'Achats',
    items: [
      { icon: '🛒', label: "Bons d'Achat", key: 'bons_achat', roles: ['admin', 'gestionnaire', 'lecture_seule'] },
    ],
  },
  {
    section: 'Ventes et portail client',
    items: [
      { icon: '🖥️', label: 'Caisse Rapide (POS)', key: 'pos_caisse' },
      { icon: '📝', label: 'Devis / Proforma', key: 'devis' },
      { icon: '🏷️', label: 'Bons de Vente', key: 'bons_vente' },
      { icon: '🧾', label: 'Factures', key: 'factures' },
      { icon: '📩', label: 'Commandes Portail', key: 'cmd_portail' },
      { icon: '🌐', label: 'Suivi Portail Client', key: 'portail_suivi', roles: ['admin', 'gestionnaire', 'lecture_seule'] },
    ],
  },
  {
    section: 'Finances et suivi des comptes',
    items: [
      { icon: '💳', label: 'Versements', key: 'versements' },
      { icon: '📊', label: 'Situations', key: 'situations' },
      { icon: '📅', label: 'Échéancier & Relances', key: 'echeancier' },
    ],
  },
  {
    section: 'Retours clients et achats',
    items: [
      { icon: '↩️', label: 'Retours', key: 'retours', roles: ['admin', 'gestionnaire', 'vendeur', 'lecture_seule'] },
    ],
  },
  {
    section: 'Analyse',
    items: [
      { icon: '📊', label: 'Statistiques', key: 'statistiques', roles: ['admin', 'gestionnaire', 'vendeur', 'lecture_seule'] },
    ],
  },
  {
    section: 'Administration',
    items: [
      { icon: '🏢', label: 'Profils Entreprise', key: 'profils', roles: ['admin', 'gestionnaire', 'lecture_seule'] },
      { icon: '🔐', label: 'Utilisateurs', key: 'utilisateurs', roles: ['admin'] },
      { icon: '🗂️', label: "Journal d'audit", key: 'journal_audit', roles: ['admin'] },
    ],
  },
];

export default function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Accueil: true,
    'Référentiels et partenaires': true,
    'Ventes et portail client': true,
  });
  const [themeKey, setThemeKey] = useState<ThemeKey>(() => {
    const saved = localStorage.getItem('gs_theme') as ThemeKey | null;
    return saved && saved in THEMES ? saved : 'clair';
  });

  useEffect(() => {
    applyTheme(themeKey);
    localStorage.setItem('gs_theme', themeKey);
  }, [themeKey]);

  if (!session) {
    return (
      <>
        <LoginView onLogin={setSession} />
        <OfflineIndicator />
      </>
    );
  }

  if (session.kind === 'client') {
    return (
      <>
        <PortalClientView
          token={session.token}
          onLogout={() => setSession(null)}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (session.kind === 'vendeur') {
    return (
      <>
        <VendeurTourneeView
          token={session.token}
          vendeur={session.vendeur}
          onLogout={() => setSession(null)}
        />
        <OfflineIndicator />
      </>
    );
  }

  const toggleGroup = (section: string) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>📦 GESTION STOCK</span>
          <select
            className="select"
            style={{ padding: '3px 6px', fontSize: 11 }}
            value={themeKey}
            onChange={(e) => setThemeKey(e.target.value as ThemeKey)}
            title="Changer le thème"
          >
            {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
              <option key={k} value={k}>
                {THEMES[k].emoji} {THEMES[k].name}
              </option>
            ))}
          </select>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.roles || item.roles.includes(session.role)
            );
            if (visibleItems.length === 0) return null;
            const isOpen = !!expanded[group.section];
            return (
              <div key={group.section} style={{ marginBottom: 4 }}>
                <button
                  type="button"
                  className="nav-section-btn"
                  onClick={() => toggleGroup(group.section)}
                >
                  <span>{isOpen ? '▾' : '▸'}</span>
                  <span>{group.section}</span>
                </button>
                {isOpen &&
                  visibleItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`nav-item-btn ${
                        activePage === item.key ? 'active' : ''
                      }`}
                      onClick={() => setActivePage(item.key)}
                    >
                      <span>
                        {item.icon} {item.label}
                      </span>
                    </button>
                  ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontWeight: 700 }}>👤 {session.nom_complet}</div>
          <div style={{ color: 'var(--muted)', marginBottom: 8 }}>
            Rôle : {session.role}
          </div>
          <div style={{ marginBottom: 8 }}>
            <PWAInstallButton compact />
          </div>
          <button
            type="button"
            className="btn btn-red"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setSession(null)}
          >
            🚪 Déconnexion
          </button>
        </div>
      </aside>

      <main className="main-area">
        <BureauPageContent
          pageKey={activePage}
          token={session.token}
          userRole={session.role}
          onNavigate={setActivePage}
          themeKey={themeKey}
          onChangeTheme={setThemeKey}
        />
      </main>
      <OfflineIndicator />
    </div>
  );
}
