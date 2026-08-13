// Server-only client for API-Football (v3.football.api-sports.io).
//
// The client deliberately keeps the API key server-side and uses two cache
// layers: a fast per-isolate cache and a shared Cloudflare KV cache. This
// prevents duplicate requests across SSR, hydration and Worker instances.

import { getConfig, getRuntimeBinding, type RuntimeBinding } from "./config.server";

const BASE = "https://v3.football.api-sports.io";
const CACHE_PREFIX = "lf:football:v1:";
const QUOTA_STATE_KEY = `${CACHE_PREFIX}quota-state`;
const DEFAULT_STALE_MAX_MS = 15 * 60_000;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 2;
const MAX_CONCURRENT_UPSTREAM = 4;

type QuotaKind = "minute" | "daily";

export class ApiFootballError extends Error {
  status: number;
  code: "rate_limit" | "unauthorized" | "server" | "network" | "payload";
  quotaKind?: QuotaKind;
  retryAfterMs?: number;

  constructor(
    code: ApiFootballError["code"],
    status: number,
    message: string,
    options: { quotaKind?: QuotaKind; retryAfterMs?: number } = {},
  ) {
    super(message);
    this.name = "ApiFootballError";
    this.status = status;
    this.code = code;
    this.quotaKind = options.quotaKind;
    this.retryAfterMs = options.retryAfterMs;
  }
}

type CacheEnvelope = {
  data: unknown;
  storedAt: number;
  freshUntil: number;
  staleUntil: number;
};

type FootballCache = RuntimeBinding;

type QuotaState = {
  updatedAt: number;
  blockedUntil: number;
  kind?: QuotaKind;
  dayLimit?: number;
  dayRemaining?: number;
  minuteLimit?: number;
  minuteRemaining?: number;
};

export type ApiFootballQuotaState = Omit<QuotaState, "updatedAt"> & { updatedAt: number };

const memoryCache = new Map<string, CacheEnvelope>();
const inflight = new Map<string, Promise<unknown>>();
let activeUpstreamRequests = 0;
const upstreamWaiters: Array<() => void> = [];
let quotaState: QuotaState = { updatedAt: 0, blockedUntil: 0 };
let quotaStateReadAt = 0;

function cacheProfile(path: string, params: Record<string, string | number | undefined>) {
  if (params.live === "all") return { freshMs: 30_000, staleMs: 15 * 60_000 };
  if (path === "/fixtures/events" || path === "/fixtures/statistics" || path === "/fixtures/lineups") {
    return { freshMs: 45_000, staleMs: 15 * 60_000 };
  }
  if (path === "/odds/live") return { freshMs: 30_000, staleMs: 10 * 60_000 };
  if (path === "/odds") return { freshMs: 90_000, staleMs: 10 * 60_000 };
  if (path === "/predictions") return { freshMs: 5 * 60_000, staleMs: 30 * 60_000 };
  if (path === "/standings" || path === "/players/topscorers") {
    return { freshMs: 10 * 60_000, staleMs: 60 * 60_000 };
  }
  if (path === "/teams" || path === "/countries" || path === "/leagues") {
    return { freshMs: 60 * 60_000, staleMs: 24 * 60 * 60_000 };
  }
  return { freshMs: 60_000, staleMs: DEFAULT_STALE_MAX_MS };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withUpstreamSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeUpstreamRequests >= MAX_CONCURRENT_UPSTREAM) {
    await new Promise<void>((resolve) => upstreamWaiters.push(resolve));
  }

  activeUpstreamRequests += 1;
  try {
    return await task();
  } finally {
    activeUpstreamRequests -= 1;
    upstreamWaiters.shift()?.();
  }
}

function parseHeaderNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function quotaKindFromMessage(message: string): QuotaKind {
  return /day|daily|quota|allocated|subscription/i.test(message) ? "daily" : "minute";
}

function retryAfterMs(response: Response, kind: QuotaKind): number {
  const value = response.headers.get("retry-after");
  const seconds = value ? Number(value) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10 * 60_000);
  return kind === "daily" ? 10 * 60_000 : 15_000;
}

function isCacheEnvelope(value: unknown): value is CacheEnvelope {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CacheEnvelope>;
  return (
    typeof item.storedAt === "number" &&
    typeof item.freshUntil === "number" &&
    typeof item.staleUntil === "number" &&
    "data" in item
  );
}

function cacheBinding(): FootballCache | undefined {
  return getRuntimeBinding<FootballCache>("FOOTBALL_CACHE");
}

async function hashedCacheKey(url: string): Promise<string> {
  const parsed = new URL(url);
  const ordered = [...parsed.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const canonical = `${parsed.origin}${parsed.pathname}?${new URLSearchParams(ordered).toString()}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const bytes = new Uint8Array(digest);
  const hash = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${CACHE_PREFIX}${hash}`;
}

async function readSharedCache(key: string, freshMs: number): Promise<CacheEnvelope | undefined> {
  const binding = cacheBinding();
  if (!binding) return undefined;
  try {
    const value = await binding.get(key, {
      type: "json",
      cacheTtl: Math.max(30, Math.ceil(freshMs / 1000)),
    });
    return isCacheEnvelope(value) ? value : undefined;
  } catch (error) {
    console.warn("Football KV read unavailable:", error instanceof Error ? error.message : error);
    return undefined;
  }
}

async function writeSharedCache(key: string, envelope: CacheEnvelope, staleMs: number) {
  const binding = cacheBinding();
  if (!binding) return;
  try {
    // KV expiration has a minimum of 60 seconds. The envelope still controls
    // freshness precisely inside the application.
    await binding.put(key, JSON.stringify(envelope), {
      expirationTtl: Math.max(60, Math.ceil(staleMs / 1000) + 60),
    });
  } catch (error) {
    console.warn("Football KV write unavailable:", error instanceof Error ? error.message : error);
  }
}

function newerCache(a: CacheEnvelope | undefined, b: CacheEnvelope | undefined) {
  if (!a) return b;
  if (!b) return a;
  return b.storedAt > a.storedAt ? b : a;
}

export async function getApiFootballCacheEnvelope(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<{ data: unknown; storedAt: number; stale: boolean; cacheId: string } | null> {
  const url = new URL(`${BASE}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  }
  const cacheId = await hashedCacheKey(url.toString());
  const now = Date.now();
  const memory = memoryCache.get(cacheId);
  if (memory && memory.staleUntil > now) {
    return { data: memory.data, storedAt: memory.storedAt, stale: memory.freshUntil <= now, cacheId };
  }
  const profile = cacheProfile(path, params);
  const shared = await readSharedCache(cacheId, profile.freshMs);
  if (!shared || shared.staleUntil <= now) return null;
  memoryCache.set(cacheId, shared);
  return { data: shared.data, storedAt: shared.storedAt, stale: shared.freshUntil <= now, cacheId };
}

async function readQuotaState(): Promise<QuotaState> {
  const now = Date.now();
  if (now - quotaStateReadAt < 30_000) return quotaState;
  quotaStateReadAt = now;
  const binding = cacheBinding();
  if (!binding) return quotaState;
  try {
    const value = await binding.get(QUOTA_STATE_KEY, { type: "json", cacheTtl: 30 });
    if (value && typeof value === "object") {
      quotaState = { ...quotaState, ...(value as QuotaState) };
    }
  } catch {
    // A cache outage must never prevent API-Football from being called.
  }
  return quotaState;
}

async function persistQuotaState(next: QuotaState) {
  quotaState = next;
  quotaStateReadAt = Date.now();
  const binding = cacheBinding();
  if (!binding) return;
  try {
    await binding.put(QUOTA_STATE_KEY, JSON.stringify(next), { expirationTtl: 15 * 60 });
  } catch {
    // Quota telemetry is best-effort and must not break a user request.
  }
}

async function recordQuotaHeaders(response: Response) {
  const dayLimit = parseHeaderNumber(response.headers.get("x-ratelimit-requests-limit"));
  const dayRemaining = parseHeaderNumber(response.headers.get("x-ratelimit-requests-remaining"));
  const minuteLimit = parseHeaderNumber(response.headers.get("x-ratelimit-limit"));
  const minuteRemaining = parseHeaderNumber(response.headers.get("x-ratelimit-remaining"));
  if (
    dayLimit === undefined &&
    dayRemaining === undefined &&
    minuteLimit === undefined &&
    minuteRemaining === undefined
  ) {
    return;
  }

  const now = Date.now();
  const blockedUntil =
    dayRemaining === 0
      ? now + 10 * 60_000
      : minuteRemaining !== undefined && minuteRemaining <= 0
        ? now + 15_000
        : quotaState.blockedUntil;
  const next = {
    ...quotaState,
    updatedAt: now,
    blockedUntil,
    dayLimit,
    dayRemaining,
    minuteLimit,
    minuteRemaining,
  };
  quotaState = next;

  // Persist only critical/low quota states; normal responses stay cheap.
  const dayLow = dayRemaining !== undefined && dayLimit !== undefined && dayRemaining <= Math.max(10, dayLimit * 0.1);
  const minuteLow = minuteRemaining !== undefined && minuteRemaining <= 2;
  if (blockedUntil > now || dayLow || minuteLow) await persistQuotaState(next);
}

function makeRateLimitError(response: Response, message: string): ApiFootballError {
  const kind = quotaKindFromMessage(message);
  return new ApiFootballError("rate_limit", 429, message, {
    quotaKind: kind,
    retryAfterMs: retryAfterMs(response, kind),
  });
}

async function requestRemoteUnqueued<T>(url: string, key: string): Promise<T> {
  let lastError: ApiFootballError | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { "x-apisports-key": key },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (response.status === 429) {
        const error = makeRateLimitError(response, "API-Football: limite de requêtes atteinte.");
        await persistQuotaState({
          ...quotaState,
          updatedAt: Date.now(),
          blockedUntil: Date.now() + (error.retryAfterMs ?? 15_000),
          kind: error.quotaKind,
        });
        throw error;
      }
      if (response.status === 401 || response.status === 403) {
        throw new ApiFootballError("unauthorized", response.status, "Clé API-Football invalide ou expirée.");
      }
      if (!response.ok) {
        lastError = new ApiFootballError("server", response.status, `API-Football ${response.status}`);
        if (attempt + 1 < MAX_ATTEMPTS) {
          await sleep(250 * (attempt + 1));
          continue;
        }
        throw lastError;
      }

      await recordQuotaHeaders(response);
      const json = (await response.json()) as { errors?: unknown; response?: T };
      const errors = json.errors;
      const hasErrors =
        errors &&
        ((Array.isArray(errors) && errors.length > 0) ||
          (typeof errors === "object" && Object.keys(errors as object).length > 0));
      if (hasErrors) {
        const message = JSON.stringify(errors).slice(0, 240);
        if (/rate|limit|quota|requests/i.test(message)) {
          const error = makeRateLimitError(response, `API-Football: ${message}`);
          await persistQuotaState({
            ...quotaState,
            updatedAt: Date.now(),
            blockedUntil: Date.now() + (error.retryAfterMs ?? 15_000),
            kind: error.quotaKind,
          });
          throw error;
        }
        throw new ApiFootballError("payload", 200, `API-Football: ${message}`);
      }
      return (json.response ?? []) as T;
    } catch (error) {
      if (error instanceof ApiFootballError) {
        if (error.code === "rate_limit" || error.code === "unauthorized" || error.code === "payload") {
          throw error;
        }
        lastError = error;
      } else {
        lastError = new ApiFootballError("network", 0, "Réseau indisponible.");
      }
      if (attempt + 1 < MAX_ATTEMPTS) await sleep(250 * (attempt + 1));
    }
  }

  throw lastError ?? new ApiFootballError("server", 500, "API-Football indisponible.");
}

async function requestRemote<T>(url: string, key: string): Promise<T> {
  return withUpstreamSlot(() => requestRemoteUnqueued<T>(url, key));
}

async function fetchWithCache<T>(
  url: string,
  path: string,
  params: Record<string, string | number | undefined>,
  cacheKey: string,
): Promise<T> {
  const profile = cacheProfile(path, params);
  const now = Date.now();
  const memory = memoryCache.get(cacheKey);
  let stale = memory && memory.staleUntil > now ? memory : undefined;

  const shared = await readSharedCache(cacheKey, profile.freshMs);
  if (shared) {
    memoryCache.set(cacheKey, shared);
    if (shared.freshUntil > now) return shared.data as T;
    stale = newerCache(stale, shared);
  }

  const state = await readQuotaState();
  if (state.blockedUntil > now) {
    if (stale && stale.staleUntil > now) return stale.data as T;
    throw new ApiFootballError(
      "rate_limit",
      429,
      "Données API-Football temporairement limitées. Réessayez dans quelques instants.",
      { quotaKind: state.kind, retryAfterMs: state.blockedUntil - now },
    );
  }

  try {
    const key = await getConfig("APIFOOTBALL_KEY");
    if (!key) {
      throw new ApiFootballError(
        "unauthorized",
        401,
        "APIFOOTBALL_KEY missing — add it to Cloudflare Worker secrets or Supabase app_config.",
      );
    }
    const data = await requestRemote<T>(url, key);
    // An empty upstream response must never erase the last real fixture list.
    // If a previous response exists, keep serving it as stale data.
    if (Array.isArray(data) && data.length === 0 && stale && stale.staleUntil > Date.now()) {
      return stale.data as T;
    }
    const storedAt = Date.now();
    const envelope: CacheEnvelope = {
      data,
      storedAt,
      freshUntil: storedAt + profile.freshMs,
      staleUntil: storedAt + profile.staleMs,
    };
    memoryCache.set(cacheKey, envelope);
    await writeSharedCache(cacheKey, envelope, profile.staleMs);
    return data;
  } catch (error) {
    const normalized =
      error instanceof ApiFootballError
        ? error
        : new ApiFootballError("network", 0, "Réseau indisponible.");
    const recoverable = ["rate_limit", "network", "server"].includes(normalized.code);
    if (recoverable && stale && stale.staleUntil > Date.now()) return stale.data as T;
    throw normalized;
  }
}

export async function apiFootball<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  }
  const urlString = url.toString();
  const cacheKey = await hashedCacheKey(urlString);
  const now = Date.now();
  const memory = memoryCache.get(cacheKey);
  if (memory && memory.freshUntil > now) return memory.data as T;

  const existing = inflight.get(cacheKey);
  if (existing) return existing as Promise<T>;

  const promise = fetchWithCache<T>(urlString, path, params, cacheKey);
  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    if (inflight.get(cacheKey) === promise) inflight.delete(cacheKey);
  }
}

export async function getApiFootballCacheState(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<{ stale: boolean; storedAt: number } | null> {
  const url = new URL(`${BASE}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, String(value));
  }
  const key = await hashedCacheKey(url.toString());
  const memory = memoryCache.get(key);
  if (memory) {
    return { stale: memory.freshUntil <= Date.now(), storedAt: memory.storedAt };
  }
  const profile = cacheProfile(path, params);
  const shared = await readSharedCache(key, profile.freshMs);
  if (!shared) return null;
  memoryCache.set(key, shared);
  return { stale: shared.freshUntil <= Date.now(), storedAt: shared.storedAt };
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getApiFootballQuotaState(): Promise<ApiFootballQuotaState> {
  return { ...(await readQuotaState()) };
}
