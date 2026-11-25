export type ThemeKey = 'sombre' | 'clair' | 'bleu_nuit' | 'emeraude';

export const THEMES: Record<
  ThemeKey,
  {
    name: string;
    emoji: string;
    BG: string;
    CARD: string;
    TEXT: string;
    MUTED: string;
    ACCENT: string;
    GREEN: string;
    RED: string;
    ORANGE: string;
    BORDER: string;
    SIDEBAR: string;
    INPUT: string;
  }
> = {
  sombre: {
    name: 'Sombre',
    emoji: '🌙',
    BG: '#1e2736',
    CARD: '#253146',
    TEXT: '#e2e8f0',
    MUTED: '#94a3b8',
    ACCENT: '#3b82f6',
    GREEN: '#22c55e',
    RED: '#ef4444',
    ORANGE: '#f97316',
    BORDER: '#334155',
    SIDEBAR: '#16202e',
    INPUT: '#2d3f57',
  },
  clair: {
    name: 'Clair',
    emoji: '☀️',
    BG: '#f1f5f9',
    CARD: '#ffffff',
    TEXT: '#0f172a',
    MUTED: '#475569',
    ACCENT: '#0984e3',
    GREEN: '#00b894',
    RED: '#d63031',
    ORANGE: '#e17055',
    BORDER: '#cbd5e1',
    SIDEBAR: '#e2e8f0',
    INPUT: '#ffffff',
  },
  bleu_nuit: {
    name: 'Bleu Nuit',
    emoji: '🌃',
    BG: '#0f172a',
    CARD: '#1e293b',
    TEXT: '#f1f5f9',
    MUTED: '#94a3b8',
    ACCENT: '#38bdf8',
    GREEN: '#34d399',
    RED: '#fb7185',
    ORANGE: '#fbbf24',
    BORDER: '#334155',
    SIDEBAR: '#0b1120',
    INPUT: '#1e293b',
  },
  emeraude: {
    name: 'Émeraude',
    emoji: '🌿',
    BG: '#ecfdf5',
    CARD: '#ffffff',
    TEXT: '#064e3b',
    MUTED: '#4b5563',
    ACCENT: '#059669',
    GREEN: '#10b981',
    RED: '#dc2626',
    ORANGE: '#d97706',
    BORDER: '#a7f3d0',
    SIDEBAR: '#d1fae5',
    INPUT: '#ffffff',
  },
};

export function applyTheme(key: ThemeKey): void {
  const t = THEMES[key] || THEMES.sombre;
  const r = document.documentElement.style;
  r.setProperty('--bg', t.BG);
  r.setProperty('--card', t.CARD);
  r.setProperty('--text', t.TEXT);
  r.setProperty('--muted', t.MUTED);
  r.setProperty('--accent', t.ACCENT);
  r.setProperty('--green', t.GREEN);
  r.setProperty('--red', t.RED);
  r.setProperty('--orange', t.ORANGE);
  r.setProperty('--border', t.BORDER);
  r.setProperty('--sidebar', t.SIDEBAR);
  r.setProperty('--input', t.INPUT);
  localStorage.setItem('gs_theme', key);
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const errObj = data as { detail?: string; error?: string };
    throw new Error(errObj.detail || errObj.error || `Erreur HTTP ${res.status}`);
  }
  return data as T;
}

export function fmtDA(val: number | undefined | null): string {
  return `${Number(val || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} DA`;
}
