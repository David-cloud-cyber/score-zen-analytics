import { rankMatches, selectTrendingMatch } from "./match-ranking";
import type { FixturesPayload, RemoteMatchSummary } from "./football-types";

export const LIVE_SNAPSHOT_KEY = "lf:shared:v2:fixtures:live";
export const LIVE_COORDINATOR_NAME = "global";
export const LIVE_REFRESH_MS = 10_000;
export const LIVE_CAUTION_REFRESH_MS = 15_000;
export const LIVE_DEGRADED_REFRESH_MS = 30_000;
export const QUIET_REFRESH_MS = 60_000;
export const DAY_REFRESH_MS = 60_000;
export const SNAPSHOT_STALE_MS = 15 * 60_000;
export const DAY_STALE_MS = 30 * 60_000;

export type SharedFixtureMode = "live" | "day";

export type SharedSnapshotEnvelope = {
  snapshot: FixturesPayload;
  storedAt: number;
  freshUntil: number;
  staleUntil: number;
  mode: SharedFixtureMode;
  requestKey: string;
};

export type ApiFixtureRecord = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue?: { name: string | null; city: string | null } | null;
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round?: string;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner?: boolean | null };
    away: { id: number; name: string; logo: string; winner?: boolean | null };
  };
  goals: { home: number | null; away: number | null };
};

export type FootballKv = {
  get: (key: string, options?: { type?: "text" | "json"; cacheTtl?: number }) => Promise<unknown>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
};

export function todayUtcIso(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export function daySnapshotKey(date: string): string {
  return `lf:shared:v1:fixtures:day:${date}`;
}

function mapStatus(short: string): RemoteMatchSummary["status"] {
  if (short === "HT") return "ht";
  if (["1H", "2H", "ET", "P", "BT", "LIVE", "INT"].includes(short)) return "live";
  if (["FT", "AET", "PEN", "AWD", "WO"].includes(short)) return "finished";
  return "upcoming";
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Aujourd'hui";
  if (sameDay(date, tomorrow)) return "Demain";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function shortName(name: string): string {
  if (name.length <= 12) return name;
  return name
    .replace(/\s+(FC|CF|SC|AC|AS|FK|BK|SK|1899|1907|1900|Football Club|Calcio)$/i, "")
    .slice(0, 14);
}

function toSummary(fixture: ApiFixtureRecord): RemoteMatchSummary {
  const venue = fixture.fixture.venue;
  return {
    id: fixture.fixture.id,
    status: mapStatus(fixture.fixture.status.short),
    statusShort: fixture.fixture.status.short,
    minute: fixture.fixture.status.elapsed ?? null,
    kickoff: fixture.fixture.date,
    timeLabel: timeLabel(fixture.fixture.date),
    dayLabel: dayLabel(fixture.fixture.date),
    home: {
      id: fixture.teams.home.id,
      name: fixture.teams.home.name,
      short: shortName(fixture.teams.home.name),
      logo: fixture.teams.home.logo,
    },
    away: {
      id: fixture.teams.away.id,
      name: fixture.teams.away.name,
      short: shortName(fixture.teams.away.name),
      logo: fixture.teams.away.logo,
    },
    homeScore: fixture.goals.home,
    awayScore: fixture.goals.away,
    league: {
      id: fixture.league.id,
      name: fixture.league.name,
      country: fixture.league.country,
      logo: fixture.league.logo,
      flag: fixture.league.flag,
      season: fixture.league.season,
      round: fixture.league.round,
    },
    venue: venue?.name ? `${venue.name}${venue.city ? `, ${venue.city}` : ""}` : null,
  };
}

export function buildSharedPayload(
  raw: ApiFixtureRecord[],
  mode: SharedFixtureMode,
  storedAt = Date.now(),
): FixturesPayload {
  const summaries = raw.map(toSummary);
  const trending = selectTrendingMatch(summaries);
  const matches = rankMatches(summaries).map((match) => ({
    ...match,
    isTrending: match.id === trending?.id,
  }));
  return {
    matches,
    source: mode === "live" ? "live" : "api",
    state: "fresh",
    fetchedAt: new Date(storedAt).toISOString(),
    cacheId: `${mode}:${storedAt}`,
  };
}

export function isSnapshotEnvelope(value: unknown): value is SharedSnapshotEnvelope {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SharedSnapshotEnvelope>;
  return Boolean(
    item.snapshot &&
    typeof item.storedAt === "number" &&
    typeof item.freshUntil === "number" &&
    typeof item.staleUntil === "number" &&
    (item.mode === "live" || item.mode === "day") &&
    typeof item.requestKey === "string",
  );
}

export function snapshotWithState(
  envelope: SharedSnapshotEnvelope,
  state: FixturesPayload["state"],
  errorCode?: FixturesPayload["errorCode"],
  retryAfterMs?: number,
): FixturesPayload {
  return {
    ...envelope.snapshot,
    state,
    errorCode,
    retryAfterMs,
    fetchedAt: new Date(envelope.storedAt).toISOString(),
    cacheId: envelope.requestKey,
  };
}
