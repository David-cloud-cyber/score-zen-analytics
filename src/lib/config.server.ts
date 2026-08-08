/**
 * Runtime config fetcher — reads from env vars first (Cloudflare Worker secrets),
 * then falls back to the private Supabase `app_config` table using the
 * service-role key (server-side only; the table is not readable by anon/authenticated).
 */

type RuntimeEnv = Record<string, string | undefined>;

function cloudflareEnv(): RuntimeEnv | undefined {
  return (globalThis as typeof globalThis & { __env__?: RuntimeEnv }).__env__;
}

export function getRuntimeEnv(name: string): string | undefined {
  return cloudflareEnv()?.[name] ?? (typeof process !== "undefined" ? process.env?.[name] : undefined);
}

const configCache = new Map<string, string>();

export async function getConfig(name: string): Promise<string | undefined> {
  // 1. Env var — fastest path (Cloudflare Worker secrets inject these at runtime)
  const envVal = getRuntimeEnv(name);
  if (envVal) return envVal;

  // 2. In-memory cache
  if (configCache.has(name)) return configCache.get(name);

  // 3. Private app_config table — service-role only
  const supabaseUrl = getRuntimeEnv("SUPABASE_URL") || "https://oirdlreedxhldmwadwom.supabase.co";
  const supabaseKey = getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseKey) return undefined;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/app_config?key=eq.${encodeURIComponent(name)}&select=value&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
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
