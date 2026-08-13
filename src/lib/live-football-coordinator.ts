import { DurableObject } from "cloudflare:workers";
import {
  DAY_REFRESH_MS,
  DAY_STALE_MS,
  LIVE_COORDINATOR_NAME,
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

const LIVE_KEY = "lf:shared:v1:fixtures:live";
const QUOTA_KEY = "lf:shared:v1:coordinator:quota";
const LAST_HTTP_ACCESS_KEY = "lf:shared:v1:coordinator:last-http-access";
const ACTIVE_HTTP_WINDOW_MS = 65_000;
const UPSTREAM_TIMEOUT_MS = 5_000;
const LOW_DAILY_QUOTA_THRESHOLD = 0.1;
const LOW_MINUTE_QUOTA_THRESHOLD = 2;

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

function requestParams(mode: SharedFixtureMode, date: string): string {
  return mode === "live" ? "live=all" : `date=${encodeURIComponent(date)}`;
}

export class LiveFootballCoordinator extends DurableObject<CoordinatorEnv> {
  private readonly refreshes = new Map<string, Promise<RefreshResult>>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const isWebSocket = request.headers.get("upgrade")?.toLowerCase() === "websocket";

    if (url.pathname === "/api/live-stream") {
      if (!isWebSocket) return new Response("Expected WebSocket", { status: 426 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      this.ctx.waitUntil(
        this.getSnapshot("live", todayUtcIso()).then(async ({ snapshot }) => {
          if (server.readyState === WebSocket.OPEN) server.send(JSON.stringify(snapshot));
          await this.scheduleNext(snapshot);
        }),
      );
      return new Response(null, {
        status: 101,
        webSocket: client,
      } as ResponseInit & { webSocket: WebSocket });
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
    await this.scheduleNext(result.snapshot, result.nextDelayMs);
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Clients only need the stream; accepting a ping keeps the connection alive
    // without triggering another provider request.
    if (typeof message === "string" && message === "ping" && socket.readyState === WebSocket.OPEN) {
      socket.send("pong");
    }
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    try {
      socket.close(code, reason);
    } catch {
      // Cloudflare may have already closed the socket.
    }
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    try {
      socket.close(1011, "Live stream error");
    } catch {
      // The runtime already handles the failed connection.
    }
  }

  private async markHttpAccess() {
    await this.ctx.storage.put(LAST_HTTP_ACCESS_KEY, Date.now());
  }

  private async scheduleNext(snapshot: FixturesPayload, preferredDelay?: number) {
    const sockets = this.ctx.getWebSockets();
    const lastHttpAccess = (await this.ctx.storage.get<number>(LAST_HTTP_ACCESS_KEY)) ?? 0;
    const active = sockets.length > 0 || Date.now() - lastHttpAccess <= ACTIVE_HTTP_WINDOW_MS;
    if (!active) return;
    const hasLiveMatch = snapshot.matches.some(
      (match) => match.status === "live" || match.status === "ht",
    );
    const delay = preferredDelay ?? (hasLiveMatch ? LIVE_REFRESH_MS : QUIET_REFRESH_MS);
    await this.ctx.storage.setAlarm(Date.now() + Math.max(5_000, delay));
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
    // Cloudflare KV requires cacheTtl >= 30 seconds. The snapshot freshness
    // itself remains 15 seconds; this only controls the edge read cache.
    const value = await this.env.FOOTBALL_CACHE?.get(key, { type: "json", cacheTtl: 30 });
    return isSnapshotEnvelope(value) ? value : null;
  }

  private async writeEnvelope(key: string, envelope: SharedSnapshotEnvelope) {
    await this.env.FOOTBALL_CACHE?.put(key, JSON.stringify(envelope), {
      expirationTtl: Math.max(60, Math.ceil((envelope.staleUntil - envelope.storedAt) / 1000) + 60),
    });
  }

  private async readQuotaBlockedUntil(): Promise<number> {
    const value = await this.env.FOOTBALL_CACHE?.get(QUOTA_KEY, { type: "json", cacheTtl: 30 });
    return value && typeof value === "object" && typeof (value as { blockedUntil?: unknown }).blockedUntil === "number"
      ? ((value as { blockedUntil: number }).blockedUntil)
      : 0;
  }

  private async setQuotaBlockedUntil(blockedUntil: number) {
    await this.env.FOOTBALL_CACHE?.put(QUOTA_KEY, JSON.stringify({ blockedUntil, updatedAt: Date.now() }), {
      expirationTtl: Math.max(60, Math.ceil((blockedUntil - Date.now()) / 1000) + 60),
    });
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
      return { snapshot: snapshotWithState(envelope, "fresh"), nextDelayMs: LIVE_REFRESH_MS };
    }

    const blockedUntil = await this.readQuotaBlockedUntil();
    if (blockedUntil > now) {
      if (envelope && envelope.staleUntil > now) {
        return {
          snapshot: snapshotWithState(envelope, "stale", "rate_limit", blockedUntil - now),
          nextDelayMs: Math.max(15_000, blockedUntil - now),
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
          retryAfterMs: blockedUntil - now,
        },
        nextDelayMs: Math.max(15_000, blockedUntil - now),
      };
    }

    try {
      const raw = await this.fetchUpstream(mode, date);
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
        nextDelayMs: mode === "live" && hasLiveMatch ? LIVE_REFRESH_MS : QUIET_REFRESH_MS,
      };
    } catch (error) {
      const status = error instanceof CoordinatorUpstreamError ? error.status : 0;
      const retryAfterMs = error instanceof CoordinatorUpstreamError ? error.retryAfterMs : undefined;
      if (status === 429) await this.setQuotaBlockedUntil(Date.now() + (retryAfterMs ?? 15_000));
      if (envelope && envelope.staleUntil > Date.now()) {
        return {
          snapshot: snapshotWithState(envelope, "stale", errorCodeFromStatus(status), retryAfterMs),
          nextDelayMs: Math.max(15_000, retryAfterMs ?? QUIET_REFRESH_MS),
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
        nextDelayMs: Math.max(15_000, retryAfterMs ?? QUIET_REFRESH_MS),
      };
    }
  }

  private async fetchUpstream(mode: SharedFixtureMode, date: string): Promise<ApiFixtureRecord[]> {
    const key = this.env.APIFOOTBALL_KEY;
    if (!key) throw new CoordinatorUpstreamError(401, "APIFOOTBALL_KEY missing");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const response = await fetch(
        `https://v3.football.api-sports.io/fixtures?${requestParams(mode, date)}`,
        { headers: { "x-apisports-key": key }, signal: controller.signal },
      );
      const retryHeader = Number(response.headers.get("retry-after"));
      const retryAfterMs = Number.isFinite(retryHeader) ? Math.min(retryHeader * 1000, 10 * 60_000) : undefined;
      const dailyLimit = headerNumber(response, [
        "x-ratelimit-requests-limit",
        "x-ratelimit-day-limit",
      ]);
      const dailyRemaining = headerNumber(response, [
        "x-ratelimit-requests-remaining",
        "x-ratelimit-day-remaining",
      ]);
      const minuteRemaining = headerNumber(response, [
        "x-ratelimit-remaining",
        "x-ratelimit-minute-remaining",
      ]);
      if (
        dailyRemaining === 0 ||
        (dailyRemaining !== undefined &&
          dailyLimit !== undefined &&
          dailyRemaining <= Math.max(10, dailyLimit * LOW_DAILY_QUOTA_THRESHOLD))
      ) {
        await this.setQuotaBlockedUntil(Date.now() + 60_000);
      } else if (minuteRemaining !== undefined && minuteRemaining <= LOW_MINUTE_QUOTA_THRESHOLD) {
        await this.setQuotaBlockedUntil(Date.now() + 15_000);
      }
      if (!response.ok) throw new CoordinatorUpstreamError(response.status, `API-Football ${response.status}`, retryAfterMs);
      const json = (await response.json()) as { errors?: unknown; response?: unknown };
      if (json.errors && typeof json.errors === "object" && Object.keys(json.errors as object).length > 0) {
        const message = JSON.stringify(json.errors);
        const status = /rate|limit|quota|requests/i.test(message) ? 429 : 502;
        throw new CoordinatorUpstreamError(status, message, retryAfterMs);
      }
      return Array.isArray(json.response) ? (json.response as ApiFixtureRecord[]) : [];
    } catch (error) {
      if (error instanceof CoordinatorUpstreamError) throw error;
      throw new CoordinatorUpstreamError(0, error instanceof Error ? error.message : "Network error");
    } finally {
      clearTimeout(timeout);
    }
  }
}

class CoordinatorUpstreamError extends Error {
  constructor(public readonly status: number, message: string, public readonly retryAfterMs?: number) {
    super(message);
    this.name = "CoordinatorUpstreamError";
  }
}

export { LIVE_COORDINATOR_NAME };
