import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

export const PORT = 3000;
export const ALGORITHM = 'HS256' as const;
export const ACCESS_TOKEN_EXPIRE_MINUTES = Number(
  process.env.API_TOKEN_EXPIRE_MINUTES || 60
);

function resolveSecretKey(): string {
  const envKey = (process.env.API_SECRET_KEY || '').trim();
  if (envKey) {
    if (envKey.length < 32) {
      console.warn(
        '[config] API_SECRET_KEY < 32 caractères — utilisation d’une clé dérivée pour le mode local.'
      );
      return crypto.createHash('sha256').update(envKey).digest('hex');
    }
    return envKey;
  }
  const envMode = (process.env.API_ENV || 'development').trim().toLowerCase();
  if (envMode !== 'development') {
    console.warn(
      '[config] API_SECRET_KEY manquante — génération d’une clé éphémère en mémoire.'
    );
  }
  return crypto.randomBytes(32).toString('hex');
}

export const SECRET_KEY = resolveSecretKey();

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

export const CORS_ORIGINS: string[] = (() => {
  const raw = (process.env.API_CORS_ORIGINS || '').trim();
  if (!raw) return DEFAULT_CORS_ORIGINS;
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    )
  );
})();

export const PRIX_MARGE_MIN_PCT = Number(process.env.PRIX_MARGE_MIN_PCT || 0);
export const PRIX_CONTROLE_COMMANDES: 'off' | 'warn' | 'enforce' = (() => {
  const m = (process.env.PRIX_CONTROLE_COMMANDES || 'enforce')
    .trim()
    .toLowerCase();
  if (m === 'off' || m === 'warn' || m === 'enforce') return m;
  return 'enforce';
})();
