// Server-only client for API-Football (v3.football.api-sports.io).
// Handles rate limiting, transient errors, and keeps a last-good response
// per URL so callers can fall back to recent data when the API misbehaves.

const BASE = "https://v3.football.api-sports.io";

export class ApiFootballError extends Error {
  status: number;
  code: "rate_limit" | "unauthorized" | "server" | "network" | "payload";
  constructor(code: ApiFootballError["code"], status: number, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const STALE_MAX_MS = 15 * 60_000; // serve stale up to 15 min on failure

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function apiFootball<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) throw new ApiFootballError("unauthorized", 401, "APIFOOTBALL_KEY missing on server.");
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const cacheKey = url.toString();

  let lastErr: ApiFootballError | null = null;
  // Small retry ladder: 2 retries with backoff for 429/5xx/network.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(cacheKey, { headers: { "x-apisports-key": key } });
      if (res.status === 429) {
        lastErr = new ApiFootballError("rate_limit", 429, "API-Football rate limit atteint.");
      } else if (res.status === 401 || res.status === 403) {
        throw new ApiFootballError("unauthorized", res.status, "Clé API-Football invalide ou expirée.");
      } else if (!res.ok) {
        lastErr = new ApiFootballError("server", res.status, `API-Football ${res.status}`);
      } else {
        const json = (await res.json()) as { errors?: unknown; response?: T };
        const errs = json.errors;
        const hasErr =
          errs && ((Array.isArray(errs) && errs.length > 0) ||
            (typeof errs === "object" && Object.keys(errs as object).length > 0));
        if (hasErr) {
          const msg = JSON.stringify(errs).slice(0, 200);
          if (/rate|limit|requests/i.test(msg)) {
            lastErr = new ApiFootballError("rate_limit", 429, "API-Football: quota atteint.");
          } else {
            throw new ApiFootballError("payload", 200, `API-Football: ${msg}`);
          }
        } else {
          const data = (json.response ?? ([] as unknown)) as T;
          cache.set(cacheKey, { at: Date.now(), data });
          return data;
        }
      }
    } catch (e) {
      if (e instanceof ApiFootballError) {
        if (e.code === "unauthorized" || e.code === "payload") throw e;
        lastErr = e;
      } else {
        lastErr = new ApiFootballError("network", 0, "Réseau indisponible.");
      }
    }
    // backoff before retrying transient failures
    await sleep(300 * (attempt + 1));
  }

  // Fallback to recent cached data if available
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < STALE_MAX_MS) {
    return cached.data as T;
  }
  throw lastErr ?? new ApiFootballError("server", 500, "API-Football indisponible.");
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
