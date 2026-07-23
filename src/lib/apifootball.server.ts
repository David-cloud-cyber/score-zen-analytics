// Server-only client for API-Football (v3.football.api-sports.io).
// Never import from client-reachable modules at module scope.

const BASE = "https://v3.football.api-sports.io";

export async function apiFootball<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) throw new Error("APIFOOTBALL_KEY missing on server.");
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": key },
    // API-Football recommends caching aggressively; short client cache is fine.
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API-Football ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    errors?: unknown;
    response?: T;
  };
  const errs = json.errors;
  if (errs && ((Array.isArray(errs) && errs.length) || (typeof errs === "object" && Object.keys(errs as object).length))) {
    throw new Error(`API-Football payload error: ${JSON.stringify(errs).slice(0, 200)}`);
  }
  return (json.response ?? ([] as unknown as T));
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
