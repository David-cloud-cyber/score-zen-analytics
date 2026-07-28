/**
 * Runtime config fetcher — reads from env vars first (Cloudflare Worker secrets),
 * then falls back to the private Supabase `app_config` table using the
 * service-role key (server-side only; the table is not readable by anon/authenticated).
 */

const SUPABASE_URL =
  (typeof process !== "undefined" && process.env?.SUPABASE_URL) ||
  "https://oirdlreedxhldmwadwom.supabase.co";

const SUPABASE_KEY =
  (typeof process !== "undefined" && process.env?.SUPABASE_SERVICE_ROLE_KEY) ||
  // Fallback hardcodé pour l'environnement Replit (sera retiré avant push GitHub)
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcmRscmVlZHhobGRtd2Fkd29tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTA2MjE4MSwiZXhwIjoyMTAwNjM4MTgxfQ.76icuXVIVelZNeS0UhYwuAJa5NYqHY_8O2oE_1vjtwc";

const configCache = new Map<string, string>();

export async function getConfig(name: string): Promise<string | undefined> {
  // 1. Env var — fastest path (Cloudflare Worker secrets inject these at runtime)
  const envVal = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (envVal) return envVal;

  // 2. In-memory cache
  if (configCache.has(name)) return configCache.get(name);

  // 3. Private app_config table — service-role only
  if (!SUPABASE_KEY) return undefined;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_config?key=eq.${encodeURIComponent(name)}&select=value&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      },
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<{ value: string }>;
      if (rows.length > 0) {
        configCache.set(name, rows[0].value);
        return rows[0].value;
      }
    }
  } catch {
    // silently fall through
  }

  return undefined;
}
