import { DurableObject } from "cloudflare:workers";
import {
  DAY_REFRESH_MS,
  DAY_STALE_MS,
  LIVE_CAUTION_REFRESH_MS,
  LIVE_COORDINATOR_NAME,
  LIVE_DEGRADED_REFRESH_MS,
  LIVE_REFRESH_MS,
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
const QUOTA_KEY = "lf:shared:v2:coordinator:quota";
const LAST_HTTP_ACCESS_KEY = "lf:shared:v2:coordinator:last-http-access";
const UPSTREAM_PREFIX = "lf:shared:v2:upstream:";
const ACTIVE_HTTP_WINDOW_MS = 65_000;
const UPSTREAM_TIMEOUT_MS = 5_000;
const LOW_DAILY_QUOTA_THRESHOLD = 0.1;
const LOW_DAILY_QUOTA_THRESHOLD_CRITICAL = 0.05;
const LOW_MINUTE_QUOTA_THRESHOLD = 10;
const CRITICAL_MINUTE_QUOTA_THRESHOLD = 2;

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

function errorCodeFromStatus(status: number): FixturesPayload["errorCode"] {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  return "network";
}

function headerNumber(response: Response, names: string[]): number | undefined {
  for (const name of names) {
    const value = Number(response.headers.get(name));
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

export class LiveFootballCoordinator extends DurableObject<CoordinatorEnv> {
  private readonly refreshes = new Map<string, Promise<RefreshResult>>();
  private readonly upstreamRefreshes = new Map<string, Promise<UpstreamResult>>();
  private readonly subscriptions = new Map<WebSocket, Set<number>>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const isWebSocket = request.headers.get("upgrade")?.toLowerCase() === "websocket";

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
    if (quota.blockedUntil > now)
      return Math.max(LIVE_DEGRADED_REFRESH_MS, quota.blockedUntil - now);
    if (
      quota.dayRemaining !== undefined &&
      quota.dayLimit !== undefined &&
      quota.dayRemaining <= Math.max(10, quota.dayLimit * LOW_DAILY_QUOTA_THRESHOLD_CRITICAL)
    )
      return LIVE_DEGRADED_REFRESH_MS;
    if (
      quota.minuteRemaining !== undefined &&
      quota.minuteRemaining <= CRITICAL_MINUTE_QUOTA_THRESHOLD
    ) {
      return LIVE_DEGRADED_REFRESH_MS;
    }
    if (
      (quota.dayRemaining !== undefined &&
        quota.dayLimit !== undefined &&
        quota.dayRemaining <= Math.max(10, quota.dayLimit * LOW_DAILY_QUOTA_THRESHOLD)) ||
      (quota.minuteRemaining !== undefined && quota.minuteRemaining <= LOW_MINUTE_QUOTA_THRESHOLD)
    )
      return LIVE_CAUTION_REFRESH_MS;
    return LIVE_REFRESH_MS;
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
    // Durable Object storage is the authoritative L1 for live snapshots. KV
    // edge reads have a minimum cache TTL and can otherwise hide a fresh score
    // for longer than the live refresh cadence.
    if (key === LIVE_KEY) {
      const local = await this.ctx.storage.get<unknown>(LIVE_STORAGE_KEY);
      if (isSnapshotEnvelope(local)) return local;
    }
    // Cloudflare KV requires cacheTtl >= 30 seconds. The snapshot freshness
    // itself remains adaptive; this only controls the edge read cache.
    const value = await this.env.FOOTBALL_CACHE?.get(key, { type: "json", cacheTtl: 30 });
    return isSnapshotEnvelope(value) ? value : null;
  }

  private async writeEnvelope(key: string, envelope: SharedSnapshotEnvelope) {
    if (key === LIVE_KEY) {
      await this.ctx.storage.put(LIVE_STORAGE_KEY, envelope);
    }
    await this.env.FOOTBALL_CACHE?.put(key, JSON.stringify(envelope), {
      expirationTtl: Math.max(60, Math.ceil((envelope.staleUntil - envelope.storedAt) / 1000) + 60),
    });
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

  private async readQuotaState(): Promise<QuotaSnapshot> {
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
    await this.env.FOOTBALL_CACHE?.put(QUOTA_KEY, JSON.stringify(state), {
      expirationTtl: Math.max(
        60,
        Math.ceil(Math.max(0, state.blockedUntil - Date.now()) / 1000) + 60,
      ),
    });
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
    await this.env.FOOTBALL_CACHE?.put(key, JSON.stringify(envelope), {
      expirationTtl: Math.max(60, Math.ceil((envelope.staleUntil - envelope.storedAt) / 1000) + 60),
    });
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
    if (envelope && envelope.freshUntil > now) {
      return { data: envelope.data, storedAt: envelope.storedAt, stale: false };
    }

    const quota = await this.readQuotaState();
    if (quota.blockedUntil > now) {
      if (envelope && envelope.staleUntil > now)
        return { data: envelope.data, storedAt: envelope.storedAt, stale: true };
      throw new CoordinatorUpstreamError(429, "provider_quota_blocked", quota.blockedUntil - now);
    }

    try {
      const data = await this.fetchUpstream(path, params);
      const storedAt = Date.now();
      await this.writeUpstreamEnvelope(key, {
        data,
        storedAt,
        freshUntil: storedAt + profile.freshMs,
        staleUntil: storedAt + profile.staleMs,
      });
      return { data, storedAt, stale: false };
    } catch (error) {
      if (envelope && envelope.staleUntil > Date.now()) {
        return { data: envelope.data, storedAt: envelope.storedAt, stale: true };
      }
      throw error;
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
    if (!forceRefresh && envelope && envelope.freshUntil > now) {
      return {
        snapshot: snapshotWithState(envelope, "fresh"),
        nextDelayMs: mode === "live" ? await this.liveRefreshDelay() : DAY_REFRESH_MS,
      };
    }

    const quota = await this.readQuotaState();
    if (quota.blockedUntil > now) {
      if (envelope && envelope.staleUntil > now) {
        return {
          snapshot: snapshotWithState(envelope, "stale", "rate_limit", quota.blockedUntil - now),
          nextDelayMs: Math.max(LIVE_DEGRADED_REFRESH_MS, quota.blockedUntil - now),
        };
      }
      if (mode === "live") {
        const fallback = await this.liveFallbackFromDay(
          date,
          "rate_limit",
          quota.blockedUntil - now,
        );
        if (fallback) {
          return {
            snapshot: fallback,
            nextDelayMs: Math.max(LIVE_DEGRADED_REFRESH_MS, quota.blockedUntil - now),
          };
        }
      }
      return {
        snapshot: {
          matches: [],
          source: mode === "live" ? "live" : "api",
          state: "unavailable",
          fetchedAt: null,
          cacheId: key,
          errorCode: "rate_limit",
          retryAfterMs: quota.blockedUntil - now,
        },
        nextDelayMs: Math.max(LIVE_DEGRADED_REFRESH_MS, quota.blockedUntil - now),
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
          nextDelayMs: DAY_REFRESH_MS,
        };
      }
      const storedAt = Date.now();
      const snapshot = buildSharedPayload(raw, mode, storedAt);
      const next: SharedSnapshotEnvelope = {
        snapshot,
        storedAt,
        freshUntil: storedAt + (mode === "live" ? LIVE_REFRESH_MS : DAY_REFRESH_MS),
        staleUntil: storedAt + (mode === "live" ? SNAPSHOT_STALE_MS : DAY_STALE_MS),
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
          mode === "live" && hasLiveMatch ? await this.liveRefreshDelay() : QUIET_REFRESH_MS,
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
      const retryHeader = Number(response.headers.get("retry-after"));
      const retryAfterMs = Number.isFinite(retryHeader)
        ? Math.min(retryHeader * 1000, 10 * 60_000)
        : undefined;
      const dailyLimit = headerNumber(response, [
        "x-ratelimit-requests-limit",
        "x-ratelimit-day-limit",
      ]);
      const dailyRemaining = headerNumber(response, [
        "x-ratelimit-requests-remaining",
        "x-ratelimit-day-remaining",
      ]);
      const minuteLimit = headerNumber(response, ["x-ratelimit-limit", "x-ratelimit-minute-limit"]);
      const minuteRemaining = headerNumber(response, [
        "x-ratelimit-remaining",
        "x-ratelimit-minute-remaining",
      ]);
      const now = Date.now();
      const currentQuota = await this.readQuotaState();
      const criticalDaily =
        dailyRemaining === 0 ||
        (dailyRemaining !== undefined &&
          dailyLimit !== undefined &&
          dailyRemaining <= Math.max(10, dailyLimit * LOW_DAILY_QUOTA_THRESHOLD_CRITICAL));
      const lowDaily =
        dailyRemaining !== undefined &&
        dailyLimit !== undefined &&
        dailyRemaining <= Math.max(10, dailyLimit * LOW_DAILY_QUOTA_THRESHOLD);
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
      await this.setQuotaState({
        updatedAt: now,
        blockedUntil,
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
