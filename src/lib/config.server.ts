/**
 * Runtime config fetcher — reads from env vars first (Cloudflare Worker secrets),
 * then falls back to the Supabase `app_config` table (accessible with anon key).
 * This keeps all secrets out of Replit and the codebase.
 */

const SUPABASE_URL =
  (typeof process !== "undefined" && process.env?.SUPABASE_URL) ||
  "https://oirdlreedxhldmwadwom.supabase.co";

const SUPABASE_KEY =
  (typeof process !== "undefined" && process.env?.SUPABASE_PUBLISHABLE_KEY) ||
  "sb_publishable_yxv1dFxXbVRB4V58m1833w_MW11Uigv";

const configCache = new Map<string, string>();

export async function getConfig(name: string): Promise<string | undefined> {
  // 1. Env var — fastest path (Cloudflare Worker secrets inject these at runtime)
  const envVal = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (envVal) return envVal;

  // 2. In-memory cache
  if (configCache.has(name)) return configCache.get(name);

  // 3. Supabase app_config table (readable with anon key)
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
