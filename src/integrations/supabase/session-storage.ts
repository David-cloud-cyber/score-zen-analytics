/**
 * Stockage de session côté navigateur uniquement.
 *
 * Les tokens Supabase restent dans le stockage prévu par le SDK. Aucun access
 * ou refresh token n'est copié dans un cookie lisible par JavaScript ou envoyé
 * automatiquement à chaque requête. L'authentification serveur utilise le
 * Bearer token transmis par le client Supabase.
 */
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

  },

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {}

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
  },
};

/** Supprime le cookie legacy créé par les anciennes versions. */
export function clearLegacyAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'lf_auth=;max-age=0;path=/;SameSite=Lax';
}
