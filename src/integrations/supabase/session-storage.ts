/**
 * Stockage de session hybride : localStorage (principal) + cookie httpJS (backup).
 *
 * Pourquoi un cookie en plus ?
 * - localStorage est vidé par certains navigateurs en mode strict ou après 7 jours sans visite.
 * - Un cookie avec max-age=7j persiste même si localStorage est vide, et est envoyé
 *   automatiquement à chaque requête — ce qui permet de détecter la session côté SSR à terme.
 * - Si localStorage est disponible, on lui donne la priorité (pas de limite de taille).
 *
 * Le cookie stocke seulement les tokens (access + refresh + expiry) — pas le user object —
 * pour rester sous la limite de 4 Ko par cookie.
 */

const COOKIE_NAME = 'lf_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

interface TokenSnapshot {
  at: string;  // access_token
  rt: string;  // refresh_token
  exp: number; // expires_at (epoch seconds)
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

function readCookie(): TokenSnapshot | null {
  if (typeof document === 'undefined') return null;
  try {
    const entry = document.cookie.split('; ').find(c => c.startsWith(COOKIE_NAME + '='));
    if (!entry) return null;
    return JSON.parse(decodeURIComponent(entry.slice(COOKIE_NAME.length + 1)));
  } catch {
    return null;
  }
}

export function writeCookie(snap: TokenSnapshot) {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent(JSON.stringify(snap));
  document.cookie =
    `${COOKIE_NAME}=${value};max-age=${COOKIE_MAX_AGE};path=/;SameSite=Lax`;
}

export function clearCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=;max-age=0;path=/`;
}

export function readCookieSnapshot(): TokenSnapshot | null {
  return readCookie();
}

// ─── Hybrid Storage (implements Web Storage API) ─────────────────────────────
// Utilisé comme `storage` dans le client Supabase :
//   - getItem / setItem / removeItem → localStorage
//   - setItem / removeItem interceptent aussi les clés de session pour
//     mettre à jour le cookie en parallèle.

const SESSION_KEY_PREFIX = 'sb-'; // Supabase stocke sous "sb-{ref}-auth-token"

function extractTokenSnapshot(raw: string): TokenSnapshot | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.access_token && parsed?.refresh_token) {
      return {
        at: parsed.access_token,
        rt: parsed.refresh_token,
        exp: parsed.expires_at ?? 0,
      };
    }
  } catch {}
  return null;
}

export const hybridStorage: Storage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch {}

    // Synchronise le cookie si c'est une clé de session Supabase
    if (key.startsWith(SESSION_KEY_PREFIX)) {
      const snap = extractTokenSnapshot(value);
      if (snap) writeCookie(snap);
    }
  },

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {}

    if (key.startsWith(SESSION_KEY_PREFIX)) {
      clearCookie();
    }
  },

  get length(): number {
    if (typeof window === 'undefined') return 0;
    try { return localStorage.length; } catch { return 0; }
  },

  key(index: number): string | null {
    if (typeof window === 'undefined') return null;
    try { return localStorage.key(index); } catch { return null; }
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    try { localStorage.clear(); } catch {}
    clearCookie();
  },
};
