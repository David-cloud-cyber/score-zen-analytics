import { DurableObject } from "cloudflare:workers";
import {
  DAY_REFRESH_MS,
  DAY_STALE_MS,
  DAILY_QUOTA_CAUTION_RATIO,
  DAILY_QUOTA_RESERVE_RATIO,
  LIVE_CAUTION_REFRESH_MS,
  LIVE_COORDINATOR_NAME,
  LIVE_DEGRADED_REFRESH_MS,
  LIVE_REFRESH_MS,
  MIN_DAILY_QUOTA_RESERVE,
  QUOTA_RESERVE_PROBE_MS,
  QUIET_REFRESH_MS,
  SNAPSHOT_STALE_MS,
  buildSharedPayload,
  daySnapshotKey,
  isSnapshotEnvelope,
  snapshotWithState,
  todayUtcIso,
  type ApiFixtureRecord,
  type FootballKv,
  type SharedFixtureMode,
  type SharedSnapshotEnvelope,
} from "./live-football.shared";
import {
  dailyQuotaReserve as calculateDailyQuotaReserve,
  quotaPacedRefreshMs,
  readQuotaHeader,
  reserveProbeDelay,
} from "./football-quota";
import type { FixturesPayload } from "./football-types";

type CoordinatorEnv = {
  APIFOOTBALL_KEY?: string;
  FOOTBALL_CACHE?: FootballKv;
};

type RefreshResult = {
  snapshot: FixturesPayload;
  nextDelayMs: number;
};

type QuotaSnapshot = {
  updatedAt: number;
  blockedUntil: number;
  dayLimit?: number;
  dayRemaining?: number;
  minuteLimit?: number;
  minuteRemaining?: number;
};

type UpstreamEnvelope = {
  data: unknown;
  storedAt: number;
  freshUntil: number;
  staleUntil: number;
};

type UpstreamResult = {
  data: unknown;
  storedAt: number;
  stale: boolean;
};

const LIVE_KEY = "lf:shared:v2:fixtures:live";
const LIVE_STORAGE_KEY = "live-snapshot-envelope:v2";
// Previous quota parsing could persist a false zero for a missing header.
const QUOTA_KEY = "lf:shared:v3:coordinator:quota";
const QUOTA_STORAGE_KEY = "quota-snapshot:v4";
const LAST_HTTP_ACCESS_KEY = "lf:shared:v2:coordinator:last-http-access";
const UPSTREAM_PREFIX = "lf:shared:v2:upstream:";
const ACTIVE_HTTP_WINDOW_MS = 65_000;
const UPSTREAM_TIMEOUT_MS = 5_000;
const UPSTREAM_RATE_LIMIT_COOLDOWN_MS = 60_000;
const LOW_MINUTE_QUOTA_THRESHOLD = 10;
const CRITICAL_MINUTE_QUOTA_THRESHOLD = 2;

function dailyQuotaReserve(dayLimit?: number): number {
  return calculateDailyQuotaReserve(
    dayLimit,
    DAILY_QUOTA_RESERVE_RATIO,
    MIN_DAILY_QUOTA_RESERVE,
  );
}

const ALLOWED_UPSTREAM_PATHS = new Set([
  "/fixtures",
  "/fixtures/events",
  "/fixtures/statistics",
  "/fixtures/lineups",
  "/fixtures/headtohead",
  "/odds",
  "/odds/live",
  "/predictions",
  "/injuries",
  "/standings",
  "/players/topscorers",
  "/teams",
  "/countries",
  "/leagues",
]);

function jsonResponse(payload: FixturesPayload, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, max-age=5, stale-while-revalidate=30",
      "x-livefoot-source": payload.source,
      "x-livefoot-state": payload.state,
      ...(payload.fetchedAt ? { "x-livefoot-updated-at": payload.fetchedAt } : {}),
    },
  });
}

function jsonDataResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

function errorCodeFromStatus(status: number): FixturesPayload["errorCode"] {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  return "network";
}

export class LiveFootballCoordinator extends DurableObject<CoordinatorEnv> {
  private readonly refreshes = new Map<string, Promise<RefreshResult>>();
  private readonly upstreamRefreshes = new Map<string, Promise<UpstreamResult>>();
  private readonly subscriptions = new Map<WebSocket, Set<number>>();
  private reserveProbeActive = false;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const isWebSocket = request.headers.get("upgrade")?.toLowerCase() === "websocket";

    // Internal-only observability. The public Worker never forwards these paths.
    if (url.pathname === "/internal/quota") {
      return jsonDataResponse(await this.readQuotaState());
    }
    if (url.pathname === "/internal/cache-state") {
      const mode = url.searchParams.get("mode") === "live" ? "live" : "day";
      const date = url.searchParams.get("date") ?? todayUtcIso();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonDataResponse(null, 400);
      const envelope = await this.readEnvelope(mode === "live" ? LIVE_KEY : daySnapshotKey(date));
      return jsonDataResponse(envelope ? {
        stale: envelope.freshUntil <= Date.now(),
        storedAt: envelope.storedAt,
      } : null);
    }

    if (url.pathname === "/api/live-stream") {
      if (!isWebSocket) return new Response("Expected WebSocket", { status: 426 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const fixtureId = Number(url.searchParams.get("fixtureId"));
      this.subscriptions.set(
        server,
        Number.isInteger(fixtureId) && fixtureId > 0 ? new Set([fixtureId]) : new Set(),
      );
      this.ctx.waitUntil(
        this.getSnapshot("live", todayUtcIso()).then(async ({ snapshot }) => {
          if (server.readyState === WebSocket.OPEN) server.send(JSON.stringify(snapshot));
          if (Number.isInteger(fixtureId) && fixtureId > 0) {
            await this.sendFixtureUpdate(server, fixtureId, snapshot);
          }
          await this.scheduleNext(snapshot);
        }),
      );
      return new Response(null, {
        status: 101,
        webSocket: client,
      } as ResponseInit & { webSocket: WebSocket });
    }

    if (url.pathname === "/api/upstream") {
      return this.handleUpstreamRequest(url);
    }

    // Persistent fallback for small server-side editorial datasets. KV is
    // intentionally reserved for shared football caches; its daily write
    // quota must never make the public predictions page empty.
    if (url.pathname === "/api/daily-predictions") {
      const date = url.searchParams.get("date") ?? "";
      const kind = url.searchParams.get("kind") ?? "rows";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) && date !== "global") {
        return jsonDataResponse({ error: "invalid_date" }, 400);
      }
      if (!["rows", "attempt", "settlement"].includes(kind)) {
        return jsonDataResponse({ error: "invalid_kind" }, 400);
      }
      const key = `daily-predictions:v2:${kind}:${date}`;
      if (request.method === "GET") {
        return jsonDataResponse((await this.ctx.storage.get(key)) ?? null);
      }
      if (request.method === "PUT") {
        try {
          const body = (await request.json()) as unknown;
          if (kind === "rows" && (!Array.isArray(body) || body.length > 12)) {
            return jsonDataResponse({ error: "invalid_rows" }, 400);
          }
          await this.ctx.storage.put(key, body);
          return jsonDataResponse({ ok: true });
        } catch {
          return jsonDataResponse({ error: "invalid_payload" }, 400);
        }
      }
      return jsonDataResponse({ error: "method_not_allowed" }, 405);
    }

    if (url.pathname === "/api/fixtures/live") {
      await this.markHttpAccess();
      const result = await this.getSnapshot("live", todayUtcIso());
      await this.scheduleNext(result.snapshot);
      return jsonResponse(result.snapshot);
    }

    if (url.pathname === "/api/fixtures/today") {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") ?? "")
        ? (url.searchParams.get("date") as string)
        : todayUtcIso();
      const result = await this.getSnapshot("day", date);
      return jsonResponse(result.snapshot);
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    const lastHttpAccess = (await this.ctx.storage.get<number>(LAST_HTTP_ACCESS_KEY)) ?? 0;
    const hasActiveHttpClients = Date.now() - lastHttpAccess <= ACTIVE_HTTP_WINDOW_MS;
    if (sockets.length === 0 && !hasActiveHttpClients) return;

    const result = await this.getSnapshot("live", todayUtcIso(), true);
    this.broadcast(result.snapshot);
    await this.broadcastFixtureUpdates(result.snapshot);
    await this.scheduleNext(result.snapshot, result.nextDelayMs);
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string" || socket.readyState !== WebSocket.OPEN) return;
    if (message === "ping") {
      socket.send("pong");
      return;
    }
    try {
      const payload = JSON.parse(message) as { type?: string; fixtureId?: number };
      if (
        payload.type !== "subscribe" ||
        !Number.isInteger(payload.fixtureId) ||
        (payload.fixtureId ?? 0) <= 0
      )
        return;
      const subscriptions = this.subscriptions.get(socket) ?? new Set<number>();
      subscriptions.add(payload.fixtureId as number);
      this.subscriptions.set(socket, subscriptions);
      const result = await this.getSnapshot("live", todayUtcIso());
      await this.sendFixtureUpdate(socket, payload.fixtureId as number, result.snapshot);
      await this.scheduleNext(result.snapshot);
    } catch {
      // Les messages invalides sont ignorés sans fermer le flux des autres utilisateurs.
    }
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    this.subscriptions.delete(socket);
    try {
      socket.close(code, reason);
    } catch {
      // Cloudflare may have already closed the socket.
    }
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    this.subscriptions.delete(socket);
    try {
      socket.close(1011, "Live stream error");
    } catch {
      // The runtime already handles the failed connection.
    }
  }

  private async markHttpAccess() {
    await this.ctx.storage.put(LAST_HTTP_ACCESS_KEY, Date.now());
  }

  private async sendFixtureUpdate(socket: WebSocket, fixtureId: number, snapshot: FixturesPayload) {
    if (socket.readyState !== WebSocket.OPEN) return;
    const match = snapshot.matches.find((item) => item.id === fixtureId);
    if (!match || (match.status !== "live" && match.status !== "ht")) return;
    socket.send(
      JSON.stringify({
        type: "fixture_update",
        fixtureId,
        summary: match,
        fetchedAt: snapshot.fetchedAt,
      }),
    );
  }

  private async broadcastFixtureUpdates(snapshot: FixturesPayload) {
    for (const [socket, fixtureIds] of this.subscriptions) {
      for (const fixtureId of fixtureIds) {
        try {
          await this.sendFixtureUpdate(socket, fixtureId, snapshot);
        } catch {
          this.subscriptions.delete(socket);
        }
      }
    }
  }

  private async handleUpstreamRequest(url: URL): Promise<Response> {
    const path = url.searchParams.get("path");
    if (!path || !ALLOWED_UPSTREAM_PATHS.has(path)) {
      return new Response("Not found", { status: 404 });
    }
    const params: Record<string, string> = {};
    for (const [key, value] of url.searchParams) {
      if (key !== "path") params[key] = value;
    }
    try {
      const result = await this.getUpstream(path, params);
      return new Response(
        JSON.stringify({
          response: result.data,
          meta: { storedAt: result.storedAt, stale: result.stale },
        }),
        {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "private, max-age=0, no-store",
            "x-livefoot-updated-at": new Date(result.storedAt).toISOString(),
            "x-livefoot-state": result.stale ? "stale" : "fresh",
          },
        },
      );
    } catch (error) {
      const status = error instanceof CoordinatorUpstreamError ? error.status : 503;
      return new Response(JSON.stringify({ errors: { message: "upstream_unavailable" } }), {
        status: status >= 400 && status < 600 ? status : 503,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }
  }

  private async scheduleNext(snapshot: FixturesPayload, preferredDelay?: number) {
    const sockets = this.ctx.getWebSockets();
    const lastHttpAccess = (await this.ctx.storage.get<number>(LAST_HTTP_ACCESS_KEY)) ?? 0;
    const active = sockets.length > 0 || Date.now() - lastHttpAccess <= ACTIVE_HTTP_WINDOW_MS;
    if (!active) return;
    const hasLiveMatch = snapshot.matches.some(
      (match) => match.status === "live" || match.status === "ht",
    );
    const delay =
      preferredDelay ?? (hasLiveMatch ? await this.liveRefreshDelay() : QUIET_REFRESH_MS);
    await this.ctx.storage.setAlarm(Date.now() + Math.max(5_000, delay));
  }

  private async liveRefreshDelay(): Promise<number> {
    const quota = await this.readQuotaState();
    const now = Date.now();
    const pacedDelay = quotaPacedRefreshMs(LIVE_REFRESH_MS, quota.dayLimit);
    if (quota.blockedUntil > now)
      return Math.max(pacedDelay, LIVE_DEGRADED_REFRESH_MS, quota.blockedUntil - now);
    if (
      quota.dayRemaining !== undefined &&
      quota.dayLimit !== undefined &&
      quota.dayRemaining <= dailyQuotaReserve(quota.dayLimit)
    )
      return Math.max(pacedDelay, reserveProbeDelay(
        now,
        quota.updatedAt,
        quota.dayRemaining,
        QUOTA_RESERVE_PROBE_MS,
      ));
    if (
      quota.minuteRemaining !== undefined &&
      quota.minuteRemaining <= CRITICAL_MINUTE_QUOTA_THRESHOLD
    ) {
      return Math.max(pacedDelay, LIVE_DEGRADED_REFRESH_MS);
    }
    if (
      (quota.dayRemaining !== undefined &&
        quota.dayLimit !== undefined &&
        quota.dayRemaining <= Math.max(10, quota.dayLimit * DAILY_QUOTA_CAUTION_RATIO)) ||
      (quota.minuteRemaining !== undefined && quota.minuteRemaining <= LOW_MINUTE_QUOTA_THRESHOLD)
    )
      return Math.max(pacedDelay, LIVE_CAUTION_REFRESH_MS);
    return pacedDelay;
  }

  private broadcast(snapshot: FixturesPayload) {
    const message = JSON.stringify(snapshot);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      try {
        socket.send(message);
      } catch {
        try {
          socket.close(1011, "Live stream unavailable");
        } catch {
          // Ignore an already-closed socket.
        }
      }
    }
  }

  private async readEnvelope(key: string): Promise<SharedSnapshotEnvelope | null> {
    // The global coordinator is the authoritative cache. Persist both live
    // and dated snapshots in Durable Object storage so a KV write limit never
    // deletes the last verified score or a recently opened fixture.
    const storageKey =
      key === LIVE_KEY ? LIVE_STORAGE_KEY : `day-snapshot-envelope:v3:${encodeURIComponent(key)}`;
    const local = await this.ctx.storage.get<unknown>(storageKey);
    if (isSnapshotEnvelope(local)) return local;

    // Read legacy KV data only as a migration fallback. New writes stay in
    // the Durable Object to keep the quota available for unrelated features.
    const value = await this.env.FOOTBALL_CACHE?.get(key, { type: "json", cacheTtl: 30 });
    return isSnapshotEnvelope(value) ? value : null;
  }

  private async writeEnvelope(key: string, envelope: SharedSnapshotEnvelope) {
    const storageKey =
      key === LIVE_KEY ? LIVE_STORAGE_KEY : `day-snapshot-envelope:v3:${encodeURIComponent(key)}`;
    await this.ctx.storage.put(storageKey, envelope);
  }

  private async liveFallbackFromDay(
    date: string,
    errorCode?: FixturesPayload["errorCode"],
    retryAfterMs?: number,
  ): Promise<FixturesPayload | null> {
    const dayEnvelope = await this.readEnvelope(daySnapshotKey(date));
    if (!dayEnvelope || dayEnvelope.staleUntil <= Date.now()) return null;
    const matches = dayEnvelope.snapshot.matches.filter(
      (match) => match.status === "live" || match.status === "ht",
    );
    if (matches.length === 0) return null;
    return {
      ...dayEnvelope.snapshot,
      matches,
      source: "cache",
      state: "stale",
      fetchedAt: new Date(dayEnvelope.storedAt).toISOString(),
      cacheId: LIVE_KEY,
      errorCode,
      retryAfterMs,
    };
  }

  private async cachedUpstreamSnapshot(
    mode: SharedFixtureMode,
    date: string,
    errorCode?: FixturesPayload["errorCode"],
    retryAfterMs?: number,
  ): Promise<FixturesPayload | null> {
    const params: Record<string, string> = mode === "live" ? { live: "all" } : { date };
    try {
      const upstream = await this.getUpstream("/fixtures", params);
      if (!Array.isArray(upstream.data) || upstream.data.length === 0) return null;
      const snapshot = buildSharedPayload(
        upstream.data as ApiFixtureRecord[],
        mode,
        upstream.storedAt,
      );
      return {
        ...snapshot,
        source: "cache",
        state: "stale",
        fetchedAt: new Date(upstream.storedAt).toISOString(),
        cacheId: mode === "live" ? LIVE_KEY : daySnapshotKey(date),
        errorCode,
        retryAfterMs,
      };
    } catch {
      return null;
    }
  }

  private async readQuotaState(): Promise<QuotaSnapshot> {
    const local = await this.ctx.storage.get<unknown>(QUOTA_STORAGE_KEY);
    if (local && typeof local === "object") {
      const state = local as Partial<QuotaSnapshot>;
      return {
        updatedAt: typeof state.updatedAt === "number" ? state.updatedAt : 0,
        blockedUntil: typeof state.blockedUntil === "number" ? state.blockedUntil : 0,
        dayLimit: state.dayLimit,
        dayRemaining: state.dayRemaining,
        minuteLimit: state.minuteLimit,
        minuteRemaining: state.minuteRemaining,
      };
    }
    const value = await this.env.FOOTBALL_CACHE?.get(QUOTA_KEY, { type: "json", cacheTtl: 30 });
    if (!value || typeof value !== "object") return { updatedAt: 0, blockedUntil: 0 };
    const state = value as Partial<QuotaSnapshot>;
    return {
      updatedAt: typeof state.updatedAt === "number" ? state.updatedAt : 0,
      blockedUntil: typeof state.blockedUntil === "number" ? state.blockedUntil : 0,
      dayLimit: state.dayLimit,
      dayRemaining: state.dayRemaining,
      minuteLimit: state.minuteLimit,
      minuteRemaining: state.minuteRemaining,
    };
  }

  private async setQuotaState(state: QuotaSnapshot) {
    await this.ctx.storage.put(QUOTA_STORAGE_KEY, state);
  }

  private upstreamProfile(path: string, params: Record<string, string>) {
    if (path === "/fixtures" && params.live === "all")
      return { freshMs: LIVE_REFRESH_MS, staleMs: SNAPSHOT_STALE_MS };
    if (path === "/fixtures/events" || path === "/fixtures/statistics") {
      return { freshMs: LIVE_REFRESH_MS, staleMs: SNAPSHOT_STALE_MS };
    }
    if (path === "/odds/live") return { freshMs: LIVE_CAUTION_REFRESH_MS, staleMs: 10 * 60_000 };
    if (path === "/odds") return { freshMs: 30_000, staleMs: 10 * 60_000 };
    if (path === "/predictions") return { freshMs: 5 * 60_000, staleMs: 30 * 60_000 };
    if (path === "/fixtures/lineups" || path === "/injuries") {
      return { freshMs: 60_000, staleMs: 15 * 60_000 };
    }
    if (path === "/fixtures/headtohead")
      return { freshMs: 6 * 60 * 60_000, staleMs: 24 * 60 * 60_000 };
    return { freshMs: 60_000, staleMs: 60 * 60_000 };
  }

  private upstreamKey(path: string, params: Record<string, string>) {
    const query = Object.entries(params)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
    return `${UPSTREAM_PREFIX}${path.replace(/\//g, "_")}${query ? `?${query}` : ""}`;
  }

  private async readUpstreamEnvelope(key: string): Promise<UpstreamEnvelope | null> {
    const local = await this.ctx.storage.get<unknown>(
      `upstream-envelope:v3:${encodeURIComponent(key)}`,
    );
    if (local && typeof local === "object") {
      const envelope = local as Partial<UpstreamEnvelope>;
      if (
        typeof envelope.storedAt === "number" &&
        typeof envelope.freshUntil === "number" &&
        typeof envelope.staleUntil === "number" &&
        "data" in envelope
      ) {
        return envelope as UpstreamEnvelope;
      }
    }
    const value = await this.env.FOOTBALL_CACHE?.get(key, { type: "json", cacheTtl: 30 });
    if (!value || typeof value !== "object") return null;
    const envelope = value as Partial<UpstreamEnvelope>;
    return typeof envelope.storedAt === "number" &&
      typeof envelope.freshUntil === "number" &&
      typeof envelope.staleUntil === "number" &&
      "data" in envelope
      ? (envelope as UpstreamEnvelope)
      : null;
  }

  private async writeUpstreamEnvelope(key: string, envelope: UpstreamEnvelope) {
    await this.ctx.storage.put(`upstream-envelope:v3:${encodeURIComponent(key)}`, envelope);
  }

  private async getUpstream(path: string, params: Record<string, string>): Promise<UpstreamResult> {
    const key = this.upstreamKey(path, params);
    const existing = this.upstreamRefreshes.get(key);
    if (existing) return existing;
    const promise = this.loadUpstream(key, path, params);
    this.upstreamRefreshes.set(key, promise);
    try {
      return await promise;
    } finally {
      if (this.upstreamRefreshes.get(key) === promise) this.upstreamRefreshes.delete(key);
    }
  }

  private async loadUpstream(
    key: string,
    path: string,
    params: Record<string, string>,
  ): Promise<UpstreamResult> {
    const profile = this.upstreamProfile(path, params);
    const now = Date.now();
    const envelope = await this.readUpstreamEnvelope(key);
    const quota = await this.readQuotaState();
    const freshMs = quotaPacedRefreshMs(profile.freshMs, quota.dayLimit);
    if (envelope && Math.max(envelope.freshUntil, envelope.storedAt + freshMs) > now) {
      return { data: envelope.data, storedAt: envelope.storedAt, stale: false };
    }

    if (quota.blockedUntil > now) {
      if (envelope && envelope.staleUntil > now)
        return { data: envelope.data, storedAt: envelope.storedAt, stale: true };
      throw new CoordinatorUpstreamError(429, "provider_quota_blocked", quota.blockedUntil - now);
    }

    // Once the provider reports the safety reserve, do not spend the last
    // requests on secondary sections or repeated page refreshes. Serve the
    // last real snapshot when possible and wait for the next daily reset.
    const reserve = dailyQuotaReserve(quota.dayLimit);
    const inReserve = reserve > 0 && quota.dayRemaining !== undefined && quota.dayRemaining <= reserve;
    const probeDue = inReserve && reserveProbeDelay(
      now,
      quota.updatedAt,
      quota.dayRemaining!,
      QUOTA_RESERVE_PROBE_MS,
    ) === 0;
    if (inReserve && (!probeDue || this.reserveProbeActive)) {
      if (envelope && envelope.staleUntil > now)
        return { data: envelope.data, storedAt: envelope.storedAt, stale: true };
      throw new CoordinatorUpstreamError(
        429,
        "provider_daily_reserve",
        Math.max(LIVE_DEGRADED_REFRESH_MS, 60_000),
      );
    }

    if (probeDue) this.reserveProbeActive = true;
    try {
      const data = await this.fetchUpstream(path, params);
      const storedAt = Date.now();
      await this.writeUpstreamEnvelope(key, {
        data,
        storedAt,
        freshUntil: storedAt + freshMs,
        staleUntil: storedAt + Math.max(profile.staleMs, freshMs * 2),
      });
      return { data, storedAt, stale: false };
    } catch (error) {
      if (error instanceof CoordinatorUpstreamError && error.status === 429) {
        const quota = await this.readQuotaState();
        await this.setQuotaState({
          ...quota,
          updatedAt: Date.now(),
          blockedUntil: Date.now() + (error.retryAfterMs ?? UPSTREAM_RATE_LIMIT_COOLDOWN_MS),
        });
      }
      if (envelope && envelope.staleUntil > Date.now()) {
        return { data: envelope.data, storedAt: envelope.storedAt, stale: true };
      }
      throw error;
    } finally {
      if (probeDue) this.reserveProbeActive = false;
    }
  }

  private async getSnapshot(
    mode: SharedFixtureMode,
    date: string,
    forceRefresh = false,
  ): Promise<RefreshResult> {
    const key = mode === "live" ? LIVE_KEY : daySnapshotKey(date);
    const existing = this.refreshes.get(key);
    if (existing) return existing;

    const promise = this.loadSnapshot(key, mode, date, forceRefresh);
    this.refreshes.set(key, promise);
    try {
      return await promise;
    } finally {
      if (this.refreshes.get(key) === promise) this.refreshes.delete(key);
    }
  }

  private async loadSnapshot(
    key: string,
    mode: SharedFixtureMode,
    date: string,
    forceRefresh: boolean,
  ): Promise<RefreshResult> {
    const now = Date.now();
    const envelope = await this.readEnvelope(key);
    const quota = await this.readQuotaState();
    const baseRefreshMs = mode === "live" ? LIVE_REFRESH_MS : DAY_REFRESH_MS;
    const refreshMs = quotaPacedRefreshMs(baseRefreshMs, quota.dayLimit);
    if (
      envelope &&
      Math.max(envelope.freshUntil, envelope.storedAt + refreshMs) > now &&
      (!forceRefresh || refreshMs > baseRefreshMs)
    ) {
      return {
        snapshot: snapshotWithState(envelope, "fresh"),
        nextDelayMs: mode === "live" ? await this.liveRefreshDelay() : refreshMs,
      };
    }

    const inReserve =
      quota.dayRemaining !== undefined &&
      quota.dayLimit !== undefined &&
      quota.dayRemaining <= dailyQuotaReserve(quota.dayLimit);
    const reserveDelay = inReserve
      ? reserveProbeDelay(now, quota.updatedAt, quota.dayRemaining!, QUOTA_RESERVE_PROBE_MS)
      : 0;
    const pauseMs = Math.max(0, quota.blockedUntil - now, reserveDelay);
    if (pauseMs > 0) {
      if (envelope && envelope.staleUntil > now) {
        return {
          snapshot: snapshotWithState(envelope, "stale", "rate_limit", pauseMs),
          nextDelayMs: pauseMs,
        };
      }
      if (mode === "live") {
        const fallback = await this.liveFallbackFromDay(
          date,
          "rate_limit",
          pauseMs,
        );
        if (fallback) {
          return {
            snapshot: fallback,
            nextDelayMs: pauseMs,
          };
        }
      }
      const cached = await this.cachedUpstreamSnapshot(
        mode,
        date,
        "rate_limit",
        pauseMs,
      );
      if (cached) {
        return {
          snapshot: cached,
          nextDelayMs: pauseMs,
        };
      }
      return {
        snapshot: {
          matches: [],
          source: mode === "live" ? "live" : "api",
          state: "unavailable",
          fetchedAt: null,
          cacheId: key,
          errorCode: "rate_limit",
          retryAfterMs: pauseMs,
        },
        nextDelayMs: pauseMs,
      };
    }

    try {
      const raw = (await this.fetchUpstream(
        "/fixtures",
        mode === "live" ? { live: "all" } : { date },
      )) as ApiFixtureRecord[];
      if (raw.length === 0 && mode === "live") {
        const fallback = await this.liveFallbackFromDay(date, "empty");
        if (fallback) return { snapshot: fallback, nextDelayMs: QUIET_REFRESH_MS };
      }
      if (raw.length === 0 && mode === "day" && envelope && envelope.staleUntil > Date.now()) {
        return {
          snapshot: snapshotWithState(envelope, "stale", "empty"),
          nextDelayMs: refreshMs,
        };
      }
      const storedAt = Date.now();
      const snapshot = buildSharedPayload(raw, mode, storedAt);
      const next: SharedSnapshotEnvelope = {
        snapshot,
        storedAt,
        freshUntil: storedAt + refreshMs,
        staleUntil: storedAt + Math.max(
          mode === "live" ? SNAPSHOT_STALE_MS : DAY_STALE_MS,
          refreshMs * 2,
        ),
        mode,
        requestKey: key,
      };
      await this.writeEnvelope(key, next);
      const hasLiveMatch = snapshot.matches.some(
        (match) => match.status === "live" || match.status === "ht",
      );
      return {
        snapshot,
        nextDelayMs:
          mode === "live" && hasLiveMatch
            ? await this.liveRefreshDelay()
            : Math.max(QUIET_REFRESH_MS, refreshMs),
      };
    } catch (error) {
      const status = error instanceof CoordinatorUpstreamError ? error.status : 0;
      const retryAfterMs =
        error instanceof CoordinatorUpstreamError ? error.retryAfterMs : undefined;
      if (status === 429) {
        await this.setQuotaState({
          ...quota,
          updatedAt: Date.now(),
          blockedUntil: Date.now() + (retryAfterMs ?? LIVE_DEGRADED_REFRESH_MS),
        });
      }
      if (envelope && envelope.staleUntil > Date.now()) {
        return {
          snapshot: snapshotWithState(envelope, "stale", errorCodeFromStatus(status), retryAfterMs),
          nextDelayMs: Math.max(LIVE_DEGRADED_REFRESH_MS, retryAfterMs ?? QUIET_REFRESH_MS),
        };
      }
      if (mode === "live") {
        const fallback = await this.liveFallbackFromDay(
          date,
          errorCodeFromStatus(status),
          retryAfterMs,
        );
        if (fallback) {
          return {
            snapshot: fallback,
            nextDelayMs: Math.max(LIVE_DEGRADED_REFRESH_MS, retryAfterMs ?? QUIET_REFRESH_MS),
          };
        }
      }
      const cached = await this.cachedUpstreamSnapshot(
        mode,
        date,
        errorCodeFromStatus(status),
        retryAfterMs,
      );
      if (cached) {
        return {
          snapshot: cached,
          nextDelayMs: Math.max(LIVE_DEGRADED_REFRESH_MS, retryAfterMs ?? QUIET_REFRESH_MS),
        };
      }
      return {
        snapshot: {
          matches: [],
          source: mode === "live" ? "live" : "api",
          state: "unavailable",
          fetchedAt: null,
          cacheId: key,
          errorCode: errorCodeFromStatus(status),
          retryAfterMs,
        },
        nextDelayMs: Math.max(LIVE_DEGRADED_REFRESH_MS, retryAfterMs ?? QUIET_REFRESH_MS),
      };
    }
  }

  private async fetchUpstream(path: string, params: Record<string, string>): Promise<unknown> {
    const key = this.env.APIFOOTBALL_KEY;
    if (!key) throw new CoordinatorUpstreamError(401, "APIFOOTBALL_KEY missing");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const response = await fetch(
        `https://v3.football.api-sports.io${path}?${new URLSearchParams(params).toString()}`,
        { headers: { "x-apisports-key": key }, signal: controller.signal },
      );
      // `Number(null)` is 0. Treating a missing Retry-After header as zero
      // caused a 429 to reopen the circuit immediately and made every page
      // request the provider again, which could leave the match list empty.
      const retryHeaderValue = response.headers.get("retry-after");
      const retryHeader = retryHeaderValue ? Number(retryHeaderValue) : NaN;
      const retryAfterMs = Number.isFinite(retryHeader)
        ? Math.max(1_000, Math.min(retryHeader * 1000, 10 * 60_000))
        : undefined;
      const dailyLimit = readQuotaHeader(response.headers, [
        "x-ratelimit-requests-limit",
        "x-ratelimit-day-limit",
      ]);
      const dailyRemaining = readQuotaHeader(response.headers, [
        "x-ratelimit-requests-remaining",
        "x-ratelimit-day-remaining",
      ]);
      const minuteLimit = readQuotaHeader(response.headers, ["x-ratelimit-limit", "x-ratelimit-minute-limit"]);
      const minuteRemaining = readQuotaHeader(response.headers, [
        "x-ratelimit-remaining",
        "x-ratelimit-minute-remaining",
      ]);
      const now = Date.now();
      const currentQuota = await this.readQuotaState();
      const reserve = dailyQuotaReserve(dailyLimit);
      const criticalDaily =
        dailyRemaining === 0 ||
        (dailyRemaining !== undefined &&
          reserve > 0 &&
          dailyRemaining <= reserve);
      const lowDaily =
        dailyRemaining !== undefined &&
        dailyLimit !== undefined &&
        dailyRemaining <= Math.max(10, dailyLimit * DAILY_QUOTA_CAUTION_RATIO);
      const criticalMinute =
        minuteRemaining !== undefined && minuteRemaining <= CRITICAL_MINUTE_QUOTA_THRESHOLD;
      const lowMinute =
        minuteRemaining !== undefined && minuteRemaining <= LOW_MINUTE_QUOTA_THRESHOLD;
      const blockedUntil =
        criticalDaily || criticalMinute
          ? now + LIVE_DEGRADED_REFRESH_MS
          : currentQuota.blockedUntil > now && (lowDaily || lowMinute)
            ? currentQuota.blockedUntil
            : 0;
      const providerBlockedUntil =
        response.status === 429
          ? now + (retryAfterMs ?? UPSTREAM_RATE_LIMIT_COOLDOWN_MS)
          : blockedUntil;
      await this.setQuotaState({
        updatedAt: now,
        blockedUntil: providerBlockedUntil,
        dayLimit: dailyLimit ?? currentQuota.dayLimit,
        dayRemaining: dailyRemaining ?? currentQuota.dayRemaining,
        minuteLimit: minuteLimit ?? currentQuota.minuteLimit,
        minuteRemaining: minuteRemaining ?? currentQuota.minuteRemaining,
      });
      if (!response.ok)
        throw new CoordinatorUpstreamError(
          response.status,
          `API-Football ${response.status}`,
          retryAfterMs,
        );
      const json = (await response.json()) as { errors?: unknown; response?: unknown };
      if (
        json.errors &&
        typeof json.errors === "object" &&
        Object.keys(json.errors as object).length > 0
      ) {
        const message = JSON.stringify(json.errors);
        const status = /rate|limit|quota|requests/i.test(message) ? 429 : 502;
        throw new CoordinatorUpstreamError(status, message, retryAfterMs);
      }
      return json.response ?? [];
    } catch (error) {
      if (error instanceof CoordinatorUpstreamError) throw error;
      throw new CoordinatorUpstreamError(
        0,
        error instanceof Error ? error.message : "Network error",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

class CoordinatorUpstreamError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "CoordinatorUpstreamError";
  }
}

export { LIVE_COORDINATOR_NAME };
