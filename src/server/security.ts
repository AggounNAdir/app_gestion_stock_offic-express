import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  ACCESS_TOKEN_EXPIRE_MINUTES,
  SECRET_KEY,
} from './config.ts';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

export function verifyPassword(
  password: string,
  passwordHash?: string | null
): boolean {
  if (!passwordHash) {
    try {
      bcrypt.compareSync(password, DUMMY_HASH);
    } catch {
      // ignore
    }
    return false;
  }
  try {
    return bcrypt.compareSync(password, passwordHash);
  } catch {
    return false;
  }
}

export function empreinteMotDePasse(passwordHash?: string | null): string {
  return crypto
    .createHash('sha256')
    .update(passwordHash || '')
    .digest('hex')
    .slice(0, 16);
}

export function nouveauSelSession(): string {
  return crypto.randomBytes(16).toString('hex');
}

export interface ClientTokenPayload {
  sub: string;
  code: string;
  type: 'client_portal';
  pw: string;
}

export interface VendeurTokenPayload {
  sub: string;
  code: string;
  type: 'vendeur_portal';
  sv: string;
}

export interface AdminTokenPayload {
  sub: string;
  username: string;
  type: 'admin_user';
  pw: string;
}

export function createAccessToken(
  clientId: number,
  codeClient: string,
  empreinteMdp = ''
): string {
  return jwt.sign(
    {
      sub: String(clientId),
      code: codeClient,
      type: 'client_portal',
      pw: empreinteMdp,
    },
    SECRET_KEY,
    { expiresIn: ACCESS_TOKEN_EXPIRE_MINUTES * 60 }
  );
}

export function decodeAccessToken(token: string): ClientTokenPayload | null {
  try {
    const payload = jwt.verify(token, SECRET_KEY) as ClientTokenPayload;
    return payload.type === 'client_portal' ? payload : null;
  } catch {
    return null;
  }
}

export function createVendeurToken(
  vendeurId: number,
  codeVendeur: string,
  sessionSalt: string
): string {
  return jwt.sign(
    {
      sub: String(vendeurId),
      code: codeVendeur,
      type: 'vendeur_portal',
      sv: sessionSalt,
    },
    SECRET_KEY,
    { expiresIn: ACCESS_TOKEN_EXPIRE_MINUTES * 60 }
  );
}

export function decodeVendeurToken(token: string): VendeurTokenPayload | null {
  try {
    const payload = jwt.verify(token, SECRET_KEY) as VendeurTokenPayload;
    return payload.type === 'vendeur_portal' ? payload : null;
  } catch {
    return null;
  }
}

export function createAdminToken(
  userId: number,
  username: string,
  empreinteMdp: string
): string {
  return jwt.sign(
    {
      sub: String(userId),
      username,
      type: 'admin_user',
      pw: empreinteMdp,
    },
    SECRET_KEY,
    { expiresIn: ACCESS_TOKEN_EXPIRE_MINUTES * 60 }
  );
}

export function decodeAdminToken(token: string): AdminTokenPayload | null {
  try {
    const payload = jwt.verify(token, SECRET_KEY) as AdminTokenPayload;
    return payload.type === 'admin_user' ? payload : null;
  } catch {
    return null;
  }
}

// Rate limiter en mémoire (portage api/rate_limit.py)
const MAX_ESSAIS = 8;
export const MAX_ESSAIS_IP = 30;
const FENETRE_MS = 15 * 60 * 1000;
const attempts = new Map<string, number[]>();

function purge(cle: string): number[] {
  const cutoff = Date.now() - FENETRE_MS;
  const recent = (attempts.get(cle) || []).filter((t) => t > cutoff);
  if (recent.length > 0) attempts.set(cle, recent);
  else attempts.delete(cle);
  return recent;
}

export function verifierTentatives(cle: string, limite = MAX_ESSAIS): boolean {
  return purge(cle).length < limite;
}

export function enregistrerEchec(cle: string): void {
  const recent = purge(cle);
  recent.push(Date.now());
  attempts.set(cle, recent);
}

export function effacerEchecs(cle: string): void {
  attempts.delete(cle);
}
