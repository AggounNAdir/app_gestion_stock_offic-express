import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="btn btn-primary"
        style={{
          width: compact ? '100%' : undefined,
          justifyContent: 'center',
          fontSize: 12,
        }}
        title="Installer en fenêtre bureau sans barre de recherche"
      >
        🖥️ Installer sur le Bureau
      </button>

      {showGuide && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              padding: 20,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>
              {isIOS
                ? 'Installer sur iPhone / iPad'
                : 'Ouvrir comme logiciel Bureau (sans navigateur)'}
            </h3>
            {isIOS ? (
              <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                1. Touchez le bouton <strong>Partager</strong> dans Safari.
                <br />
                2. Touchez <strong>Sur l’écran d’accueil</strong>.
              </p>
            ) : (
              <div style={{ color: 'var(--text)', lineHeight: 1.6, fontSize: 12 }}>
                <p style={{ marginTop: 0 }}>
                  <strong>Via Chrome / Edge :</strong>
                </p>
                <p>
                  1. Cliquez sur le menu <strong>⋮</strong> (en haut à droite du
                  navigateur).
                  <br />
                  2. Choisissez <strong>Applications</strong> (ou{' '}
                  <strong>Caster, enregistrer et partager</strong>) →{' '}
                  <strong>Installer Gestion de Stock</strong> (ou{' '}
                  <em>Créer un raccourci</em> avec{' '}
                  <strong>« Ouvrir dans une fenêtre »</strong> coché).
                </p>
                <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
                  Une icône apparaît alors sur votre Bureau Windows et ouvre
                  l’application sans barre d’adresse ni onglets.
                </p>
              </div>
            )}
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowGuide(false)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 14,
        left: 14,
        zIndex: 9998,
        background: '#f59e0b',
        color: '#ffffff',
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
      }}
    >
      Hors ligne — reconnexion au serveur en attente
    </div>
  );
};
