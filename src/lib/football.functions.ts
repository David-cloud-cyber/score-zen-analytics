import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  apiFootball,
  ApiFootballError,
  getApiFootballCacheEnvelope,
  getApiFootballCacheState,
  todayISO,
} from "./apifootball.server";
import { FEATURED_COMPETITIONS } from "@/data/competitions";
import { getRuntimeBinding, type DurableObjectNamespaceBinding } from "./config.server";
import { LIVE_COORDINATOR_NAME, type SharedFixtureMode } from "./live-football.shared";
import { rankMatches, selectTrendingMatch, type MatchRankingSignal } from "./match-ranking";
import type {
  ApiEvent,
  ApiH2H,
  ApiLineup,
  ApiStats,
  ApiStatus,
  RemoteMatchDetail,
  RemoteMatchSummary,
  FixturesPayload,
} from "./football-types";

// ---------- helpers ----------

function mapStatus(short: string): ApiStatus {
  if (short === "HT") return "ht";
  if (["1H", "2H", "ET", "P", "BT", "LIVE", "INT"].includes(short)) return "live";
  if (["FT", "AET", "PEN", "AWD", "WO"].includes(short)) return "finished";
  return "upcoming";
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, today)) return "Aujourd'hui";
  if (same(d, tomorrow)) return "Demain";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function shortName(name: string): string {
  if (!name) return "";
  if (name.length <= 12) return name;
  return name
    .replace(/\s+(FC|CF|SC|AC|AS|FK|BK|SK|1899|1907|1900|Football Club|Calcio)$/i, "")
    .slice(0, 14);
}

type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue: { name: string | null; city: string | null };
    referee?: string | null;
    timezone?: string;
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

type ApiOddsResponse = {
  update?: string;
  bookmakers?: Array<{
    bets?: Array<{
      name: string;
      values?: Array<{ value: string; odd: string }>;
    }>;
  }>;
};

type ApiPredictionResponse = {
  predictions?: {
    winner?: { id?: number | null; name?: string | null; comment?: string | null } | null;
    percent?: { home?: string; draw?: string; away?: string };
    advice?: string | null;
    under_over?: string | null;
  };
};

type ApiInjuryResponse = {
  player: { id: number; name: string; photo: string; type: string; reason: string };
  team: { id: number; name: string };
};

function parsePercent(value?: string): number | null {
  if (!value) return null;
  const number = Number(value.replace("%", "").trim());
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function averageSelectionOdds(data: ApiOddsResponse | undefined, selection: string) {
  const values: number[] = [];
  for (const bookmaker of data?.bookmakers ?? []) {
    const bet = bookmaker.bets?.find((item) => item.name.toLowerCase() === "match winner");
    for (const value of bet?.values ?? []) {
      if (value.value.toLowerCase() !== selection) continue;
      const odd = Number(value.odd);
      if (Number.isFinite(odd) && odd > 1) values.push(odd);
    }
  }
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function toSummary(f: ApiFixture): RemoteMatchSummary {
  return {
    id: f.fixture.id,
    status: mapStatus(f.fixture.status.short),
    statusShort: f.fixture.status.short,
    minute: f.fixture.status.elapsed ?? null,
    kickoff: f.fixture.date,
    timeLabel: timeLabel(f.fixture.date),
    dayLabel: dayLabel(f.fixture.date),
    home: {
      id: f.teams.home.id,
      name: f.teams.home.name,
      short: shortName(f.teams.home.name),
      logo: f.teams.home.logo,
    },
    away: {
      id: f.teams.away.id,
      name: f.teams.away.name,
      short: shortName(f.teams.away.name),
      logo: f.teams.away.logo,
    },
    homeScore: f.goals.home,
    awayScore: f.goals.away,
    league: {
      id: f.league.id,
      name: f.league.name,
      country: f.league.country,
      logo: f.league.logo,
      flag: f.league.flag,
      season: f.league.season,
      round: f.league.round,
    },
    venue: f.fixture.venue.name
      ? `${f.fixture.venue.name}${f.fixture.venue.city ? ", " + f.fixture.venue.city : ""}`
      : null,
  };
}

/**
 * Les votes sont lus en une seule requête pour toute la journée. Les compteurs
 * restent un signal interne de tri et ne sont jamais renvoyés dans le résumé
 * public du match.
 */
async function readCommunityRankingSignals(
  fixtureIds: number[],
): Promise<ReadonlyMap<string, MatchRankingSignal>> {
  if (fixtureIds.length === 0) return new Map();

  const cacheKey = [...fixtureIds].sort((a, b) => a - b).join(",");
  const cached = communityRankingCache.get(cacheKey);
  if (cached && Date.now() - cached.at < COMMUNITY_RANKING_CACHE_TTL_MS) {
    return cached.signals;
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("community_predictions")
      .select("fixture_id")
      .in("fixture_id", fixtureIds)
      .limit(10_000);

    if (error) throw error;

    const signals = new Map<string, MatchRankingSignal>();
    for (const row of data ?? []) {
      const key = String(row.fixture_id);
      const current = signals.get(key) ?? {};
      signals.set(key, { ...current, communityVotes: (current.communityVotes ?? 0) + 1 });
    }
    communityRankingCache.set(cacheKey, { at: Date.now(), signals });
    return signals;
  } catch (error) {
    // La liste des matchs doit continuer à fonctionner si Supabase est
    // momentanément indisponible ou si la table n'est pas encore déployée.
    console.warn(
      "Community ranking signals unavailable:",
      error instanceof Error ? error.message : error,
    );
    return new Map();
  }
}

const COMMUNITY_RANKING_CACHE_TTL_MS = 30_000;
const communityRankingCache = new Map<
  string,
  { at: number; signals: ReadonlyMap<string, MatchRankingSignal> }
>();

function buildRankingSignals(fixtures: ApiFixture[]): ReadonlyMap<string, MatchRankingSignal> {
  const signals = new Map<string, MatchRankingSignal>();
  for (const fixture of fixtures) {
    const dataRichness = [
      fixture.fixture.venue.name,
      fixture.fixture.venue.city,
      fixture.league.logo,
      fixture.league.flag,
      fixture.league.round,
      fixture.teams.home.logo,
      fixture.teams.away.logo,
    ].filter(Boolean).length;
    signals.set(String(fixture.fixture.id), { dataRichness });
  }
  return signals;
}

async function rankApiFixtures(fixtures: ApiFixture[]): Promise<RemoteMatchSummary[]> {
  const summaries = fixtures.map(toSummary);
  const baseSignals = buildRankingSignals(fixtures);
  const communitySignals = await readCommunityRankingSignals(
    fixtures.map((fixture) => fixture.fixture.id),
  );
  const signals = new Map<string, MatchRankingSignal>(baseSignals);
  for (const [fixtureId, communitySignal] of communitySignals) {
    signals.set(fixtureId, { ...signals.get(fixtureId), ...communitySignal });
  }
  const trending = selectTrendingMatch(summaries, signals);
  return rankMatches(summaries, { signals }).map((match) => ({
    ...match,
    isTrending: match.id === trending?.id,
  }));
}

// ---------- server functions ----------

export async function readSharedFixtureSnapshot(
  mode: SharedFixtureMode,
  date: string,
): Promise<FixturesPayload | null> {
  const coordinator = getRuntimeBinding<DurableObjectNamespaceBinding>("LIVE_FOOTBALL_COORDINATOR");
  if (!coordinator) return null;

  try {
    const path = mode === "live" ? "/api/fixtures/live" : "/api/fixtures/today";
    const url = new URL(`https://livefoot.internal${path}`);
    if (mode === "day") url.searchParams.set("date", date);
    const response = await coordinator
      .getByName(LIVE_COORDINATOR_NAME)
      .fetch(new Request(url, { method: "GET" }));
    if (!response.ok) return null;
    const payload = (await response.json()) as FixturesPayload;
    if (!Array.isArray(payload.matches) || typeof payload.state !== "string") return null;
    return payload;
  } catch (error) {
    console.warn(
      "Shared fixture coordinator unavailable:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export const getFixtures = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        date: z.string().optional(),
        live: z.boolean().optional(),
      })
      .default({})
      .parse(input),
  )
  .handler(async ({ data }): Promise<FixturesPayload> => {
    const isLiveRequest = Boolean(data.live);
    const requestedDate = data.date ?? todayISO();
    const shared = await readSharedFixtureSnapshot(isLiveRequest ? "live" : "day", requestedDate);
    // An empty `unavailable` snapshot is not a result: it only means the
    // coordinator could not reach the provider. Continue through the normal
    // cache/API fallback so a transient coordinator or quota failure cannot
    // hide a real fixture list. A fresh empty snapshot remains authoritative
    // (the provider explicitly returned no fixtures for that request).
    if (
      shared &&
      (shared.matches.length > 0 || shared.state === "fresh")
    )
      return shared;

    const params = isLiveRequest ? { live: "all" as const } : { date: requestedDate };
    const path = "/fixtures";

    const errorCode = (error: unknown): FixturesPayload["errorCode"] => {
      if (error instanceof ApiFootballError) return error.code;
      return "network";
    };

    const fromCache = async (error?: unknown): Promise<FixturesPayload> => {
      const cached = await getApiFootballCacheEnvelope(path, params);
      if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
        return {
          matches: await rankApiFixtures(cached.data as ApiFixture[]),
          source: "cache",
          state: "stale",
          fetchedAt: new Date(cached.storedAt).toISOString(),
          cacheId: cached.cacheId,
          errorCode: error ? errorCode(error) : "empty",
          retryAfterMs: error instanceof ApiFootballError ? error.retryAfterMs : undefined,
        };
      }
      return {
        matches: [],
        source: isLiveRequest ? "live" : "api",
        state: "unavailable",
        fetchedAt: null,
        cacheId: null,
        errorCode: error ? errorCode(error) : "empty",
        retryAfterMs: error instanceof ApiFootballError ? error.retryAfterMs : undefined,
      };
    };

    try {
      const raw = await apiFootball<ApiFixture[]>(path, params);

      // La réponse datée de l'API-Football est la source de vérité : elle
      // contient déjà la compétition, son pays, son logo et la saison pour
      // chaque rencontre. Ne tronque jamais cette réponse : sinon une journée
      // chargée peut supprimer des matchs de Premier League, Liga, Ligue 1,
      // Bundesliga, Serie A, coupes ou compétitions africaines. Le classement
      // interne s'applique ensuite sans perdre la couverture API.
      const list = raw ?? [];

      const cache = await getApiFootballCacheEnvelope(path, params);
      if (list.length === 0) {
        return fromCache();
      }
      return {
        matches: await rankApiFixtures(list),
        source: cache?.stale ? "cache" : isLiveRequest ? "live" : "api",
        state: cache?.stale ? "stale" : "fresh",
        fetchedAt: cache ? new Date(cache.storedAt).toISOString() : null,
        cacheId: cache?.cacheId ?? null,
      };
    } catch (err) {
      console.warn("API Football error:", err instanceof Error ? err.message : err);
      return fromCache(err);
    }
  });

type StatItem = { type: string; value: number | string | null };

const EMPTY_STATS: ApiStats = {
  possession: { home: null, away: null },
  shots: { home: null, away: null },
  shotsOnTarget: { home: null, away: null },
  xg: { home: null, away: null },
  corners: { home: null, away: null },
  fouls: { home: null, away: null },
  yellow: { home: null, away: null },
  red: { home: null, away: null },
  passAccuracy: { home: null, away: null },
  offsides: { home: null, away: null },
};

function summaryDetailDefaults(meta: RemoteMatchDetail["meta"]): RemoteMatchDetail {
  return {
    id: 0,
    status: "upcoming",
    statusShort: "NS",
    minute: null,
    kickoff: new Date().toISOString(),
    timeLabel: "--:--",
    dayLabel: "Aujourd'hui",
    home: { id: 0, name: "", short: "", logo: "" },
    away: { id: 0, name: "", short: "", logo: "" },
    homeScore: null,
    awayScore: null,
    league: { id: 0, name: "", country: "", logo: "", flag: null, season: 0 },
    venue: null,
    meta,
    events: [],
    stats: EMPTY_STATS,
    lineups: { home: null, away: null },
    h2h: [],
    odds: null,
    prediction: null,
    injuries: { home: [], away: [] },
  };
}

function detailFromSummary(
  summary: RemoteMatchSummary,
  meta: RemoteMatchDetail["meta"],
): RemoteMatchDetail {
  return { ...summaryDetailDefaults(meta), ...summary };
}

function parseNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const cleaned = v.toString().replace("%", "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function mapStats(homeStats: StatItem[] = [], awayStats: StatItem[] = []): ApiStats {
  const pick = (arr: StatItem[], type: string) =>
    parseNumber(arr.find((s) => s.type?.toLowerCase() === type.toLowerCase())?.value);
  return {
    possession: {
      home: pick(homeStats, "Ball Possession"),
      away: pick(awayStats, "Ball Possession"),
    },
    shots: { home: pick(homeStats, "Total Shots"), away: pick(awayStats, "Total Shots") },
    shotsOnTarget: {
      home: pick(homeStats, "Shots on Goal"),
      away: pick(awayStats, "Shots on Goal"),
    },
    xg: { home: pick(homeStats, "expected_goals"), away: pick(awayStats, "expected_goals") },
    corners: { home: pick(homeStats, "Corner Kicks"), away: pick(awayStats, "Corner Kicks") },
    fouls: { home: pick(homeStats, "Fouls"), away: pick(awayStats, "Fouls") },
    yellow: { home: pick(homeStats, "Yellow Cards"), away: pick(awayStats, "Yellow Cards") },
    red: { home: pick(homeStats, "Red Cards"), away: pick(awayStats, "Red Cards") },
    passAccuracy: { home: pick(homeStats, "Passes %"), away: pick(awayStats, "Passes %") },
    offsides: { home: pick(homeStats, "Offsides"), away: pick(awayStats, "Offsides") },
  };
}

function settledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string,
  unavailableSections: string[],
): T {
  if (result.status === "fulfilled") return result.value;
  unavailableSections.push(label);
  return fallback;
}

export const getFixtureDetail = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const id = data.id;

    try {
      const fixtureArr = await apiFootball<ApiFixture[]>("/fixtures", { id });
      const f = fixtureArr[0];
      if (!f) throw new Error("Match introuvable.");
      const primaryCacheState = await getApiFootballCacheState("/fixtures", { id });

      const unavailableSections: string[] = [];
      const [eventsResult, statsResult, lineupsResult] = await Promise.allSettled([
        apiFootball<
          Array<{
            time: { elapsed: number };
            team: { id: number };
            player: { name: string };
            assist: { name: string | null };
            type: string;
            detail: string;
          }>
        >("/fixtures/events", { fixture: id }),
        apiFootball<Array<{ team: { id: number }; statistics: StatItem[] }>>(
          "/fixtures/statistics",
          { fixture: id },
        ),
        apiFootball<
          Array<{
            team: { id: number; name: string; colors: { player: { primary: string } } | null };
            formation: string;
            coach: { name: string };
            startXI: Array<{ player: { name: string; number: number; pos: string } }>;
            substitutes?: Array<{ player: { name: string; number: number; pos: string } }>;
          }>
        >("/fixtures/lineups", { fixture: id }),
      ]);

      const eventsArr = settledValue(eventsResult, [], "événements", unavailableSections);
      const statsArr = settledValue(statsResult, [], "statistiques", unavailableSections);
      const lineupsArr = settledValue(lineupsResult, [], "compositions", unavailableSections);

      const homeId = f.teams.home.id;
      const awayId = f.teams.away.id;

      const [h2hResult, oddsResult, predictionResult, injuriesResult] = await Promise.allSettled([
        apiFootball<ApiFixture[]>("/fixtures/headtohead", {
          h2h: `${homeId}-${awayId}`,
          last: 5,
        }),
        apiFootball<ApiOddsResponse[]>("/odds", { fixture: id, bet: 1 }),
        apiFootball<ApiPredictionResponse[]>("/predictions", { fixture: id }),
        apiFootball<ApiInjuryResponse[]>("/injuries", { fixture: id }),
      ]);

      const h2hArr = settledValue(h2hResult, [], "confrontations", unavailableSections);
      const oddsArr = settledValue(oddsResult, [], "cotes", unavailableSections);
      const predictionArr = settledValue(predictionResult, [], "prédictions", unavailableSections);
      const injuriesArr = settledValue(injuriesResult, [], "absences", unavailableSections);

      const homeStatsRaw = statsArr.find((s) => s.team.id === homeId)?.statistics ?? [];
      const awayStatsRaw = statsArr.find((s) => s.team.id === awayId)?.statistics ?? [];
      const stats = mapStats(homeStatsRaw, awayStatsRaw);

      const homeLineupRaw = lineupsArr.find((l) => l.team.id === homeId);
      const awayLineupRaw = lineupsArr.find((l) => l.team.id === awayId);

      const homeLineup: ApiLineup | null = homeLineupRaw
        ? {
            formation: homeLineupRaw.formation,
            coach: homeLineupRaw.coach.name,
            color: homeLineupRaw.team.colors?.player?.primary
              ? `#${homeLineupRaw.team.colors.player.primary}`
              : "#10b981",
            players: homeLineupRaw.startXI.map((p) => ({
              name: p.player.name,
              number: p.player.number,
              position: p.player.pos,
            })),
            substitutes: (homeLineupRaw.substitutes ?? []).map((p) => ({
              name: p.player.name,
              number: p.player.number,
              position: p.player.pos,
            })),
          }
        : null;

      const awayLineup: ApiLineup | null = awayLineupRaw
        ? {
            formation: awayLineupRaw.formation,
            coach: awayLineupRaw.coach.name,
            color: awayLineupRaw.team.colors?.player?.primary
              ? `#${awayLineupRaw.team.colors.player.primary}`
              : "#3b82f6",
            players: awayLineupRaw.startXI.map((p) => ({
              name: p.player.name,
              number: p.player.number,
              position: p.player.pos,
            })),
            substitutes: (awayLineupRaw.substitutes ?? []).map((p) => ({
              name: p.player.name,
              number: p.player.number,
              position: p.player.pos,
            })),
          }
        : null;

      const events: ApiEvent[] = eventsArr.map((e, idx) => ({
        minute: e.time.elapsed,
        side: e.team.id === homeId ? ("home" as const) : ("away" as const),
        player: e.player.name,
        type: (e.type.toLowerCase().includes("goal")
          ? "goal"
          : e.detail.toLowerCase().includes("yellow")
            ? "yellow"
            : e.detail.toLowerCase().includes("red")
              ? "red"
              : e.type.toLowerCase().includes("var") || e.detail.toLowerCase().includes("var")
                ? "var"
                : "sub") as ApiEvent["type"],
        detail: e.detail,
      }));

      const h2h: ApiH2H[] = h2hArr.map((h) => ({
        id: h.fixture.id,
        date: dayLabel(h.fixture.date),
        home: h.teams.home.name,
        away: h.teams.away.name,
        score: `${h.goals.home ?? 0} - ${h.goals.away ?? 0}`,
        competition: h.league.name,
      }));

      const oddsData = oddsArr[0];
      const odds = oddsData
        ? {
            home: averageSelectionOdds(oddsData, "home"),
            draw: averageSelectionOdds(oddsData, "draw"),
            away: averageSelectionOdds(oddsData, "away"),
            bookmakers: oddsData.bookmakers?.length ?? 0,
            updatedAt: oddsData.update ?? null,
          }
        : null;

      const predictionData = predictionArr[0]?.predictions;
      const prediction = predictionData
        ? {
            home: parsePercent(predictionData.percent?.home),
            draw: parsePercent(predictionData.percent?.draw),
            away: parsePercent(predictionData.percent?.away),
            winner:
              predictionData.winner?.id === homeId
                ? ("home" as const)
                : predictionData.winner?.id === awayId
                  ? ("away" as const)
                  : null,
            winnerName: predictionData.winner?.name ?? null,
            advice: predictionData.advice ?? null,
            underOver: predictionData.under_over ?? null,
          }
        : null;
      const injuries = {
        home: injuriesArr
          .filter((item) => item.team.id === homeId)
          .filter(
            (item, index, rows) =>
              rows.findIndex((candidate) => candidate.player.id === item.player.id) === index,
          )
          .map((item) => ({
            playerId: item.player.id,
            name: item.player.name,
            photo: item.player.photo,
            reason: item.player.reason,
            type: item.player.type,
            teamId: item.team.id,
          })),
        away: injuriesArr
          .filter((item) => item.team.id === awayId)
          .filter(
            (item, index, rows) =>
              rows.findIndex((candidate) => candidate.player.id === item.player.id) === index,
          )
          .map((item) => ({
            playerId: item.player.id,
            name: item.player.name,
            photo: item.player.photo,
            reason: item.player.reason,
            type: item.player.type,
            teamId: item.team.id,
          })),
      };

      return {
        ...toSummary(f),
        meta: {
          fetchedAt: new Date(primaryCacheState?.storedAt ?? Date.now()).toISOString(),
          stale: primaryCacheState?.stale ?? false,
          unavailableSections: [...new Set(unavailableSections)],
        },
        stats,
        events,
        lineups: { home: homeLineup, away: awayLineup },
        h2h,
        odds,
        prediction,
        injuries,
      };
    } catch (err) {
      console.warn(
        "API Football getFixtureDetail error:",
        err instanceof Error ? err.message : err,
      );
      throw err;
    }
  });

/**
 * Fast first paint for the match page. It deliberately fetches only the
 * primary fixture record; secondary sections are loaded after the score is
 * visible through getFixtureSections.
 */
export async function loadFixtureSummary(id: number): Promise<RemoteMatchDetail> {
  const [liveSnapshot, daySnapshot] = await Promise.all([
    readSharedFixtureSnapshot("live", todayISO()),
    readSharedFixtureSnapshot("day", todayISO()),
  ]);
  for (const snapshot of [liveSnapshot, daySnapshot]) {
    const match = snapshot?.matches.find((item) => item.id === id);
    if (match && snapshot) {
      return detailFromSummary(match, {
        fetchedAt: snapshot.fetchedAt ?? new Date().toISOString(),
        stale: snapshot.state === "stale",
        state: snapshot.state,
        source: snapshot.source,
        retryAfterMs: snapshot.retryAfterMs,
        unavailableSections: [
          "événements",
          "statistiques",
          "compositions",
          "confrontations",
          "cotes",
          "prédictions",
          "absences",
        ],
      });
    }
  }

  let fixture: ApiFixture | undefined;
  let primaryError: unknown;
  try {
    fixture = (await apiFootball<ApiFixture[]>("/fixtures", { id }))[0];
  } catch (error) {
    primaryError = error;
  }

  // A card can be opened close to a UTC day change. Check the genuine
  // adjacent-day shared snapshots before declaring the provider has no match.
  if (!fixture) {
    const today = new Date(`${todayISO()}T00:00:00.000Z`);
    const dateAtOffset = (offset: number) => {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    const adjacent = await Promise.all([
      readSharedFixtureSnapshot("day", dateAtOffset(-1)),
      readSharedFixtureSnapshot("day", dateAtOffset(1)),
    ]);
    for (const snapshot of adjacent) {
      const match = snapshot?.matches.find((item) => item.id === id);
      if (match && snapshot) {
        return detailFromSummary(match, {
          fetchedAt: snapshot.fetchedAt ?? new Date().toISOString(),
          stale: snapshot.state === "stale",
          state: snapshot.state,
          source: snapshot.source,
          retryAfterMs: snapshot.retryAfterMs,
          unavailableSections: [
            "événements",
            "statistiques",
            "compositions",
            "confrontations",
            "cotes",
            "prédictions",
            "absences",
          ],
        });
      }
    }
    throw primaryError ?? new Error("Match introuvable.");
  }
  const cacheState = await getApiFootballCacheState("/fixtures", { id });
  const summary = toSummary(fixture);
  const defaults = summaryDetailDefaults({
    fetchedAt: new Date(cacheState?.storedAt ?? Date.now()).toISOString(),
    stale: cacheState?.stale ?? false,
    unavailableSections: [
      "événements",
      "statistiques",
      "compositions",
      "confrontations",
      "cotes",
      "prédictions",
      "absences",
    ],
  });
  return { ...defaults, ...summary };
}

export const getFixtureSummary = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }): Promise<RemoteMatchDetail> => {
    return loadFixtureSummary(data.id);
  });

/**
 * Secondary sections are intentionally independent from the fast summary.
 * The existing resilient detail loader keeps Promise.allSettled and stale
 * cache behavior, while the browser can render the primary score first.
 */
export const getFixtureSections = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }): Promise<RemoteMatchDetail> => {
    const summary = await loadFixtureSummary(data.id);
    const homeId = summary.home.id;
    const awayId = summary.away.id;
    const unavailableSections: string[] = [];
    const loadedSections = new Set<string>();

    type EventPayload = {
      time: { elapsed: number };
      team: { id: number };
      player: { name: string };
      type: string;
      detail: string;
    };
    type StatsPayload = Array<{ team: { id: number }; statistics: StatItem[] }>;
    type LineupPayload = Array<{
      team: { id: number; name: string; colors: { player: { primary: string } } | null };
      formation: string;
      coach: { name: string };
      startXI: Array<{ player: { name: string; number: number; pos: string } }>;
      substitutes?: Array<{ player: { name: string; number: number; pos: string } }>;
    }>;

    const [
      eventsResult,
      statsResult,
      lineupsResult,
      h2hResult,
      oddsResult,
      predictionResult,
      injuriesResult,
    ] = await Promise.allSettled([
      apiFootball<EventPayload[]>("/fixtures/events", { fixture: data.id }),
      apiFootball<StatsPayload>("/fixtures/statistics", { fixture: data.id }),
      apiFootball<LineupPayload>("/fixtures/lineups", { fixture: data.id }),
      apiFootball<ApiFixture[]>("/fixtures/headtohead", {
        h2h: `${homeId}-${awayId}`,
        last: 5,
      }),
      apiFootball<ApiOddsResponse[]>("/odds", { fixture: data.id, bet: 1 }),
      apiFootball<ApiPredictionResponse[]>("/predictions", { fixture: data.id }),
      apiFootball<ApiInjuryResponse[]>("/injuries", { fixture: data.id }),
    ]);

    const eventsArr = settledValue(eventsResult, [], "événements", unavailableSections);
    if (eventsResult.status === "fulfilled") loadedSections.add("événements");
    const statsArr = settledValue(statsResult, [], "statistiques", unavailableSections);
    if (statsResult.status === "fulfilled") loadedSections.add("statistiques");
    const lineupsArr = settledValue(lineupsResult, [], "compositions", unavailableSections);
    if (lineupsResult.status === "fulfilled") loadedSections.add("compositions");
    const h2hArr = settledValue(h2hResult, [], "confrontations", unavailableSections);
    if (h2hResult.status === "fulfilled") loadedSections.add("confrontations");
    const oddsArr = settledValue(oddsResult, [], "cotes", unavailableSections);
    if (oddsResult.status === "fulfilled") loadedSections.add("cotes");
    const predictionArr = settledValue(predictionResult, [], "prédictions", unavailableSections);
    if (predictionResult.status === "fulfilled") loadedSections.add("prédictions");
    const injuriesArr = settledValue(injuriesResult, [], "absences", unavailableSections);
    if (injuriesResult.status === "fulfilled") loadedSections.add("absences");

    const events: ApiEvent[] = eventsArr.map((event) => ({
      minute: event.time.elapsed,
      side: event.team.id === homeId ? "home" : "away",
      player: event.player.name,
      type: (event.type.toLowerCase().includes("goal")
        ? "goal"
        : event.detail.toLowerCase().includes("yellow")
          ? "yellow"
          : event.detail.toLowerCase().includes("red")
            ? "red"
            : event.type.toLowerCase().includes("var") || event.detail.toLowerCase().includes("var")
              ? "var"
              : "sub") as ApiEvent["type"],
      detail: event.detail,
    }));

    const homeStatsRaw = statsArr.find((item) => item.team.id === homeId)?.statistics ?? [];
    const awayStatsRaw = statsArr.find((item) => item.team.id === awayId)?.statistics ?? [];
    const stats = mapStats(homeStatsRaw, awayStatsRaw);
    const makeLineup = (teamId: number, fallbackColor: string): ApiLineup | null => {
      const lineup = lineupsArr.find((item) => item.team.id === teamId);
      if (!lineup) return null;
      return {
        formation: lineup.formation,
        coach: lineup.coach.name,
        color: lineup.team.colors?.player?.primary
          ? `#${lineup.team.colors.player.primary}`
          : fallbackColor,
        players: lineup.startXI.map((player) => ({
          name: player.player.name,
          number: player.player.number,
          position: player.player.pos,
        })),
        substitutes: (lineup.substitutes ?? []).map((player) => ({
          name: player.player.name,
          number: player.player.number,
          position: player.player.pos,
        })),
      };
    };
    const h2h: ApiH2H[] = h2hArr.map((item) => ({
      id: item.fixture.id,
      date: dayLabel(item.fixture.date),
      home: item.teams.home.name,
      away: item.teams.away.name,
      score: `${item.goals.home ?? 0} - ${item.goals.away ?? 0}`,
      competition: item.league.name,
    }));
    const oddsData = oddsArr[0];
    const odds = oddsData
      ? {
          home: averageSelectionOdds(oddsData, "home"),
          draw: averageSelectionOdds(oddsData, "draw"),
          away: averageSelectionOdds(oddsData, "away"),
          bookmakers: oddsData.bookmakers?.length ?? 0,
          updatedAt: oddsData.update ?? null,
        }
      : null;
    const predictionData = predictionArr[0]?.predictions;
    const prediction = predictionData
      ? {
          home: parsePercent(predictionData.percent?.home),
          draw: parsePercent(predictionData.percent?.draw),
          away: parsePercent(predictionData.percent?.away),
          winner:
            predictionData.winner?.id === homeId
              ? ("home" as const)
              : predictionData.winner?.id === awayId
                ? ("away" as const)
                : null,
          winnerName: predictionData.winner?.name ?? null,
          advice: predictionData.advice ?? null,
          underOver: predictionData.under_over ?? null,
        }
      : null;
    const injuries = {
      home: injuriesArr
        .filter((item) => item.team.id === homeId)
        .filter(
          (item, index, rows) =>
            rows.findIndex((candidate) => candidate.player.id === item.player.id) === index,
        )
        .map((item) => ({
          playerId: item.player.id,
          name: item.player.name,
          photo: item.player.photo,
          reason: item.player.reason,
          type: item.player.type,
          teamId: item.team.id,
        })),
      away: injuriesArr
        .filter((item) => item.team.id === awayId)
        .filter(
          (item, index, rows) =>
            rows.findIndex((candidate) => candidate.player.id === item.player.id) === index,
        )
        .map((item) => ({
          playerId: item.player.id,
          name: item.player.name,
          photo: item.player.photo,
          reason: item.player.reason,
          type: item.player.type,
          teamId: item.team.id,
        })),
    };

    const inheritedUnavailable = summary.meta.unavailableSections.filter(
      (section) => !loadedSections.has(section),
    );
    const meta = {
      ...summary.meta,
      unavailableSections: [...new Set([...inheritedUnavailable, ...unavailableSections])],
    };
    return {
      ...summaryDetailDefaults(meta),
      ...summary,
      meta,
      events,
      stats,
      lineups: { home: makeLineup(homeId, "#10b981"), away: makeLineup(awayId, "#3b82f6") },
      h2h,
      odds,
      prediction,
      injuries,
    };
  });

export type FixtureContextTeam = {
  id: number;
  name: string;
  logo: string;
  standing: {
    rank: number;
    points: number;
    played: number;
    goalDifference: number;
    form: string;
  } | null;
  recent: Array<{
    id: number;
    date: string;
    opponent: string;
    result: "W" | "D" | "L" | "?";
    score: string;
  }>;
  coach: { id: number; name: string; photo: string | null } | null;
  sidelined: Array<{ id: number; name: string; photo: string; reason: string | null }>;
  topScorers: Array<{ id: number; name: string; photo: string; goals: number; assists: number }>;
  statistics: TeamStatisticsRow | null;
};

export type FixtureExtendedContext = {
  home: FixtureContextTeam;
  away: FixtureContextTeam;
  fetchedAt: string;
};

type ApiTeamStatisticsPayload = {
  league: { id: number; name: string; season: number };
  team: { id: number; name: string; logo: string };
  form?: string;
  fixtures?: {
    played?: TeamStatSplit;
    wins?: TeamStatSplit;
    draws?: TeamStatSplit;
    loses?: TeamStatSplit;
  };
  goals?: {
    for?: { average?: TeamStatAverage };
    against?: { average?: TeamStatAverage };
  };
  clean_sheet?: Record<string, number | null>;
  failed_to_score?: Record<string, number | null>;
  lineups?: Array<{ formation: string; played: number | null }>;
};

type TeamStatSplit = { home?: number | null; away?: number | null; total?: number | null };
type TeamStatAverage = {
  home?: string | number | null;
  away?: string | number | null;
  total?: string | number | null;
};

function mapTeamStatistics(item?: ApiTeamStatisticsPayload | null): TeamStatisticsRow | null {
  return item
    ? {
        league: item.league,
        team: item.team,
        form: item.form ?? "",
        played: item.fixtures?.played ?? {},
        wins: item.fixtures?.wins ?? {},
        draws: item.fixtures?.draws ?? {},
        loses: item.fixtures?.loses ?? {},
        goalsForAverage: item.goals?.for?.average ?? {},
        goalsAgainstAverage: item.goals?.against?.average ?? {},
        cleanSheets: item.clean_sheet ?? {},
        failedToScore: item.failed_to_score ?? {},
        lineups: item.lineups ?? [],
      }
    : null;
}

/**
 * Competition and squad context is intentionally lazy. It covers the Pro
 * catalogue data that is useful to a match without making every visitor pay
 * the cost of ten additional upstream calls on initial render.
 */
export const getFixtureExtendedContext = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }): Promise<FixtureExtendedContext> => {
    const summary = await loadFixtureSummary(data.id);
    const { id: league, season } = summary.league;
    const teamIds = [summary.home.id, summary.away.id] as const;

    type StandingPayload = Array<{
      league: {
        standings: Array<
          Array<{
            rank: number;
            team: { id: number };
            points: number;
            goalsDiff: number;
            form?: string;
            all: { played: number };
          }>
        >;
      };
    }>;
    type CoachPayload = Array<{ id: number; name: string; photo?: string | null }>;
    type SidelinedPayload = Array<{
      player: { id: number; name: string; photo: string };
      team: { id: number };
      type: string | null;
    }>;
    type ScorerPayload = Array<{
      player: { id: number; name: string; photo: string };
      statistics: Array<{
        team: { id: number };
        goals: { total: number | null; assists: number | null };
      }>;
    }>;

    const [
      standingsResult,
      homeFormResult,
      awayFormResult,
      homeCoachResult,
      awayCoachResult,
      homeOutResult,
      awayOutResult,
      scorersResult,
      homeStatsResult,
      awayStatsResult,
    ] = await Promise.allSettled([
      apiFootball<StandingPayload>("/standings", { league, season }),
      apiFootball<ApiFixture[]>("/fixtures", { team: teamIds[0], last: 5 }),
      apiFootball<ApiFixture[]>("/fixtures", { team: teamIds[1], last: 5 }),
      apiFootball<CoachPayload>("/coachs", { team: teamIds[0] }),
      apiFootball<CoachPayload>("/coachs", { team: teamIds[1] }),
      apiFootball<SidelinedPayload>("/sidelined", { team: teamIds[0] }),
      apiFootball<SidelinedPayload>("/sidelined", { team: teamIds[1] }),
      apiFootball<ScorerPayload>("/players/topscorers", { league, season }),
      apiFootball<ApiTeamStatisticsPayload>("/teams/statistics", {
        team: teamIds[0],
        league,
        season,
      }),
      apiFootball<ApiTeamStatisticsPayload>("/teams/statistics", {
        team: teamIds[1],
        league,
        season,
      }),
    ]);

    const standings = standingsResult.status === "fulfilled" ? standingsResult.value : [];
    const table = standings[0]?.league.standings.flat() ?? [];
    const scorers = scorersResult.status === "fulfilled" ? scorersResult.value : [];
    const forms = [homeFormResult, awayFormResult] as const;
    const coaches = [homeCoachResult, awayCoachResult] as const;
    const sidelined = [homeOutResult, awayOutResult] as const;
    const teamStatistics = [homeStatsResult, awayStatsResult] as const;

    const buildTeam = (index: 0 | 1): FixtureContextTeam => {
      const ref = index === 0 ? summary.home : summary.away;
      const form = forms[index].status === "fulfilled" ? forms[index].value : [];
      const coachRows = coaches[index].status === "fulfilled" ? coaches[index].value : [];
      const outRows = sidelined[index].status === "fulfilled" ? sidelined[index].value : [];
      const standing = table.find((row) => row.team.id === ref.id);
      return {
        id: ref.id,
        name: ref.name,
        logo: ref.logo,
        standing: standing
          ? {
              rank: standing.rank,
              points: standing.points,
              played: standing.all.played,
              goalDifference: standing.goalsDiff,
              form: standing.form ?? "",
            }
          : null,
        recent: form.map((fixture) => {
          const home = fixture.teams.home.id === ref.id;
          const goalsFor = home ? fixture.goals.home : fixture.goals.away;
          const goalsAgainst = home ? fixture.goals.away : fixture.goals.home;
          const result =
            goalsFor === null || goalsAgainst === null
              ? "?"
              : goalsFor > goalsAgainst
                ? "W"
                : goalsFor === goalsAgainst
                  ? "D"
                  : "L";
          return {
            id: fixture.fixture.id,
            date: dayLabel(fixture.fixture.date),
            opponent: home ? fixture.teams.away.name : fixture.teams.home.name,
            result,
            score: `${goalsFor ?? "—"}-${goalsAgainst ?? "—"}`,
          };
        }),
        coach: coachRows[0]
          ? { id: coachRows[0].id, name: coachRows[0].name, photo: coachRows[0].photo ?? null }
          : null,
        sidelined: outRows.slice(0, 8).map((row) => ({
          id: row.player.id,
          name: row.player.name,
          photo: row.player.photo,
          reason: row.type,
        })),
        topScorers: scorers
          .flatMap((row) =>
            row.statistics
              .filter((stats) => stats.team.id === ref.id)
              .map((stats) => ({
                id: row.player.id,
                name: row.player.name,
                photo: row.player.photo,
                goals: stats.goals.total ?? 0,
                assists: stats.goals.assists ?? 0,
              })),
          )
          .sort((a, b) => b.goals - a.goals)
          .slice(0, 3),
        statistics:
          teamStatistics[index].status === "fulfilled"
            ? mapTeamStatistics(teamStatistics[index].value)
            : null,
      };
    };

    return { home: buildTeam(0), away: buildTeam(1), fetchedAt: new Date().toISOString() };
  });

export type StandingRow = {
  rank: number;
  teamId: number;
  team: string;
  logo: string;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  gd: number;
  points: number;
  form: string;
};

export type FixtureOddsMarket = {
  name: string;
  selections: Array<{ label: string; odd: number }>;
};

export type FixtureMatchCenter = {
  round: string | null;
  roundFixtures: RemoteMatchSummary[];
  standings: StandingRow[];
  oddsMarkets: FixtureOddsMarket[];
  liveOddsMarkets: FixtureOddsMarket[];
  oddsUpdatedAt: string | null;
  info: {
    referee: string | null;
    venue: string | null;
    city: string | null;
    timezone: string | null;
  };
  unavailableSections: string[];
  fetchedAt: string;
};

function normalizeMarketName(name: string) {
  const value = name.trim().toLowerCase();
  if (value === "match winner") return "Résultat du match";
  if (value === "double chance") return "Double chance";
  if (value.includes("goals over/under") || value === "goals over under") return "Plus/Moins 2,5";
  if (value.includes("both teams") && value.includes("score")) return "Les deux équipes marquent";
  return name.trim();
}

function normalizeSelectionLabel(market: string, label: string) {
  const value = label.trim().toLowerCase();
  if (market === "Résultat du match") {
    if (value === "home") return "1";
    if (value === "draw") return "N";
    if (value === "away") return "2";
  }
  if (market === "Double chance") {
    if (value === "home/draw") return "1N";
    if (value === "home/away") return "12";
    if (value === "draw/away") return "N2";
  }
  if (market === "Plus/Moins 2,5") {
    if (value === "over 2.5") return "+2,5";
    if (value === "under 2.5") return "-2,5";
  }
  if (market === "Les deux équipes marquent") {
    if (value === "yes") return "Oui";
    if (value === "no") return "Non";
  }
  return label.trim();
}

type OddsMarketRow = {
  bookmakers?: Array<{
    bets?: Array<{
      name: string;
      values?: Array<{ value: string; odd: string }>;
    }>;
  }>;
};

function extractOddsMarkets(rows: OddsMarketRow[]): FixtureOddsMarket[] {
  const aggregates = new Map<string, Map<string, number[]>>();
  for (const row of rows) {
    for (const bookmaker of row.bookmakers ?? []) {
      for (const bet of bookmaker.bets ?? []) {
        const market = normalizeMarketName(bet.name);
        if (!market) continue;
        const selections = aggregates.get(market) ?? new Map<string, number[]>();
        for (const value of bet.values ?? []) {
          const odd = Number(value.odd);
          if (!Number.isFinite(odd) || odd <= 1) continue;
          const label = normalizeSelectionLabel(market, value.value);
          selections.set(label, [...(selections.get(label) ?? []), odd]);
        }
        aggregates.set(market, selections);
      }
    }
  }
  return [...aggregates.entries()]
    .map(([name, selections]) => ({
      name,
      selections: [...selections.entries()].map(([label, values]) => ({
        label,
        odd: values.reduce((sum, value) => sum + value, 0) / values.length,
      })),
    }))
    .filter((market) => market.selections.length > 0)
    .slice(0, 24);
}

export const getFixtureMatchCenter = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }): Promise<FixtureMatchCenter> => {
    const summary = await loadFixtureSummary(data.id);
    const unavailableSections: string[] = [];
    const fixtureResult = await Promise.allSettled([
      apiFootball<ApiFixture[]>("/fixtures", { id: data.id }),
    ]);
    const fixture = fixtureResult[0].status === "fulfilled" ? fixtureResult[0].value[0] : undefined;
    const leagueId = fixture?.league.id ?? summary.league.id;
    const season = fixture?.league.season ?? summary.league.season;
    const round = fixture?.league.round ?? summary.league.round;
    const kickoff = fixture?.fixture.date ?? summary.kickoff;
    const roundParams = round
      ? { league: leagueId, season, round }
      : {
          league: leagueId,
          season,
          date: kickoff.slice(0, 10),
        };
    const [roundResult, standingsResult, oddsResult, liveOddsResult] = await Promise.allSettled([
      apiFootball<ApiFixture[]>("/fixtures", roundParams),
      apiFootball<
        Array<{
          league: {
            standings: Array<
              Array<{
                rank: number;
                team: { id: number; name: string; logo: string };
                points: number;
                goalsDiff: number;
                form?: string;
                all: {
                  played: number;
                  win: number;
                  draw: number;
                  lose: number;
                  goals: { for: number; against: number };
                };
              }>
            >;
          };
        }>
      >("/standings", { league: leagueId, season }),
      apiFootball<ApiOddsResponse[]>("/odds", { fixture: data.id }),
      summary.status === "live" || summary.status === "ht"
        ? apiFootball<LiveOddsRow[]>("/odds/live", { fixture: data.id })
        : Promise.resolve([] as LiveOddsRow[]),
    ]);

    if (roundResult.status === "rejected") unavailableSections.push("journée");
    if (standingsResult.status === "rejected") unavailableSections.push("classement");
    if (oddsResult.status === "rejected") unavailableSections.push("cotes");
    if (liveOddsResult.status === "rejected") unavailableSections.push("cotes_live");

    const standingRows =
      standingsResult.status === "fulfilled"
        ? (standingsResult.value[0]?.league.standings[0] ?? [])
        : [];
    let roundFixtures =
      roundResult.status === "fulfilled" ? await rankApiFixtures(roundResult.value) : [];
    if (roundFixtures.length === 0) {
      const daySnapshot = await readSharedFixtureSnapshot("day", kickoff.slice(0, 10));
      roundFixtures =
        daySnapshot?.matches.filter(
          (item) =>
            item.league.id === leagueId &&
            (!round || !item.league.round || item.league.round === round),
        ) ?? [];
    }
    if (!roundFixtures.some((item) => item.id === summary.id)) {
      roundFixtures = [summary, ...roundFixtures];
    }
    return {
      round: round ?? null,
      roundFixtures,
      standings: standingRows.map((row) => ({
        rank: row.rank,
        teamId: row.team.id,
        team: row.team.name,
        logo: row.team.logo,
        played: row.all.played,
        win: row.all.win,
        draw: row.all.draw,
        lose: row.all.lose,
        goalsFor: row.all.goals.for,
        goalsAgainst: row.all.goals.against,
        gd: row.goalsDiff,
        points: row.points,
        form: row.form ?? "",
      })),
      oddsMarkets: oddsResult.status === "fulfilled" ? extractOddsMarkets(oddsResult.value) : [],
      liveOddsMarkets:
        liveOddsResult.status === "fulfilled" ? extractOddsMarkets(liveOddsResult.value) : [],
      oddsUpdatedAt:
        liveOddsResult.status === "fulfilled" && liveOddsResult.value[0]?.update
          ? liveOddsResult.value[0].update
          : oddsResult.status === "fulfilled"
            ? (oddsResult.value[0]?.update ?? null)
            : null,
      info: {
        referee: fixture?.fixture.referee ?? null,
        venue: fixture?.fixture.venue.name ?? summary.venue,
        city: fixture?.fixture.venue.city ?? null,
        timezone: fixture?.fixture.timezone ?? null,
      },
      unavailableSections,
      fetchedAt: new Date().toISOString(),
    };
  });

export const getStandings = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        league: z.number().int().positive(),
        season: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const season = data.season ?? currentSeasonYear();
    try {
      const raw = await apiFootball<
        Array<{
          league: {
            standings: Array<
              Array<{
                rank: number;
                team: { id: number; name: string; logo: string };
                points: number;
                goalsDiff: number;
                form: string;
                all: {
                  played: number;
                  win: number;
                  draw: number;
                  lose: number;
                  goals: { for: number; against: number };
                };
              }>
            >;
          };
        }>
      >("/standings", { league: data.league, season });

      const table = raw[0]?.league?.standings[0] ?? [];
      return table.map<StandingRow>((row) => ({
        rank: row.rank,
        teamId: row.team.id,
        team: row.team.name,
        logo: row.team.logo,
        played: row.all.played,
        win: row.all.win,
        draw: row.all.draw,
        lose: row.all.lose,
        goalsFor: row.all.goals.for,
        goalsAgainst: row.all.goals.against,
        gd: row.goalsDiff,
        points: row.points,
        form: row.form ?? "",
      }));
    } catch {
      return [];
    }
  });

export type TopScorer = {
  rank: number;
  playerId: number;
  name: string;
  photo: string;
  teamId: number;
  team: string;
  teamLogo: string;
  goals: number;
  assists: number;
  appearances: number;
};

export const getTopScorers = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        league: z.number().int().positive(),
        season: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const season = data.season ?? currentSeasonYear();
    try {
      const raw = await apiFootball<
        Array<{
          player: { id: number; name: string; photo: string };
          statistics: Array<{
            team: { id: number; name: string; logo: string };
            games: { appearences: number };
            goals: { total: number | null; assists: number | null };
          }>;
        }>
      >("/players/topscorers", { league: data.league, season });

      return raw.slice(0, 20).map<TopScorer>((p, i) => {
        const s = p.statistics[0];
        return {
          rank: i + 1,
          playerId: p.player.id,
          name: p.player.name,
          photo: p.player.photo,
          teamId: s?.team.id ?? 0,
          team: s?.team.name ?? "—",
          teamLogo: s?.team.logo ?? "",
          goals: s?.goals.total ?? 0,
          assists: s?.goals.assists ?? 0,
          appearances: s?.games.appearences ?? 0,
        };
      });
    } catch {
      return [];
    }
  });

export type InjuryRow = {
  playerId: number;
  name: string;
  photo: string;
  teamId: number;
  team: string;
  reason: string;
  type: string;
  fixtureId: number | null;
};

export const getInjuries = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        team: z.number().int().positive().optional(),
        league: z.number().int().positive().optional(),
        fixture: z.number().int().positive().optional(),
        season: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const params: Record<string, string | number> = {};
    if (data.fixture) params.fixture = data.fixture;
    else if (data.team) {
      params.team = data.team;
      params.season = data.season ?? currentSeasonYear();
    } else if (data.league) {
      params.league = data.league;
      params.season = data.season ?? currentSeasonYear();
    }

    try {
      const raw = await apiFootball<
        Array<{
          player: { id: number; name: string; photo: string; type: string; reason: string };
          team: { id: number; name: string };
          fixture: { id: number | null };
        }>
      >("/injuries", params).catch(() => []);

      return raw.slice(0, 40).map<InjuryRow>((r) => ({
        playerId: r.player.id,
        name: r.player.name,
        photo: r.player.photo,
        teamId: r.team.id,
        team: r.team.name,
        reason: r.player.reason,
        type: r.player.type,
        fixtureId: r.fixture.id,
      }));
    } catch {
      return [];
    }
  });

export type CountryRow = { name: string; code: string | null; flag: string | null };

export const getCountries = createServerFn({ method: "GET" }).handler(
  async (): Promise<CountryRow[]> => {
    try {
      return await apiFootball<CountryRow[]>("/countries");
    } catch {
      return [];
    }
  },
);

export type LeagueRow = {
  id: number;
  name: string;
  type: string;
  logo: string;
  country: string;
  countryCode: string | null;
  seasons: Array<{ year: number; start: string; end: string; current: boolean }>;
};

export const getLeagues = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        country: z.string().max(80).optional(),
        current: z.boolean().optional(),
        search: z.string().min(2).max(80).optional(),
        season: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<LeagueRow[]> => {
    try {
      const { current, ...filters } = data;
      const raw = await apiFootball<
        Array<{
          league: { id: number; name: string; type: string; logo: string };
          country: { name: string; code: string | null };
          seasons: Array<{ year: number; start: string; end: string; current: boolean }>;
        }>
      >("/leagues", { ...filters, current: current ? "true" : undefined });
      return raw.map((item) => ({
        id: item.league.id,
        name: item.league.name,
        type: item.league.type,
        logo: item.league.logo,
        country: item.country.name,
        countryCode: item.country.code,
        seasons: item.seasons,
      }));
    } catch {
      return [];
    }
  });

export type TeamRow = {
  id: number;
  name: string;
  code: string | null;
  country: string;
  founded: number | null;
  logo: string;
  venue: { name: string | null; city: string | null; capacity: number | null } | null;
};

async function teamsFromSharedFixtures(
  options: { search?: string; league?: number; season?: number } = {},
): Promise<TeamRow[]> {
  const [liveSnapshot, daySnapshot] = await Promise.all([
    readSharedFixtureSnapshot("live", todayISO()),
    readSharedFixtureSnapshot("day", todayISO()),
  ]);
  const byId = new Map<number, TeamRow>();
  const normalizedSearch = options.search?.trim().toLocaleLowerCase("fr-FR");
  for (const match of [...(liveSnapshot?.matches ?? []), ...(daySnapshot?.matches ?? [])]) {
    if (options.league && match.league.id !== options.league) continue;
    if (options.season && match.league.season !== options.season) continue;
    for (const team of [match.home, match.away]) {
      if (
        normalizedSearch &&
        !team.name.toLocaleLowerCase("fr-FR").includes(normalizedSearch)
      )
        continue;
      if (byId.has(team.id)) continue;
      byId.set(team.id, {
        id: team.id,
        name: team.name,
        code: null,
        country: match.league.country,
        founded: null,
        logo: team.logo,
        venue: null,
      });
    }
  }
  return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

export const getTeams = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        id: z.number().int().positive().optional(),
        search: z.string().min(2).max(80).optional(),
        league: z.number().int().optional(),
        season: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<TeamRow[]> => {
    try {
      const request =
        data.league && !data.id && !data.search && data.season === undefined
          ? { ...data, season: currentSeasonYear() }
          : data;
      const raw = await apiFootball<
        Array<{
          team: {
            id: number;
            name: string;
            code: string | null;
            country: string;
            founded: number | null;
            logo: string;
          };
          venue?: { name: string | null; city: string | null; capacity: number | null } | null;
        }>
      >("/teams", request);
      const teams = raw.map((item) => ({ ...item.team, venue: item.venue ?? null }));
      if (teams.length > 0) return teams;
      return teamsFromSharedFixtures(data);
    } catch {
      return teamsFromSharedFixtures(data);
    }
  });

export type PlayerRow = {
  id: number;
  name: string;
  firstname: string | null;
  lastname: string | null;
  age: number | null;
  nationality: string | null;
  photo: string;
  team: { id: number; name: string; logo: string } | null;
  position: string | null;
  appearances: number | null;
  goals: number | null;
  assists: number | null;
};

export const getPlayers = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        search: z.string().min(2).max(80).optional(),
        team: z.number().int().optional(),
        league: z.number().int().optional(),
        season: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<PlayerRow[]> => {
    try {
      const request =
        data.league && !data.search && data.season === undefined
          ? { ...data, season: currentSeasonYear() }
          : data;
      const raw = await apiFootball<
        Array<{
          player: {
            id: number;
            name: string;
            firstname: string | null;
            lastname: string | null;
            age: number | null;
            nationality: string | null;
            photo: string;
          };
          statistics?: Array<{
            team: { id: number; name: string; logo: string };
            games: { position: string | null; appearences: number | null };
            goals: { total: number | null; assists: number | null };
          }>;
        }>
      >("/players", request);
      return raw.map((item) => {
        const stats = item.statistics?.[0];
        return {
          ...item.player,
          team: stats?.team ?? null,
          position: stats?.games.position ?? null,
          appearances: stats?.games.appearences ?? null,
          goals: stats?.goals.total ?? null,
          assists: stats?.goals.assists ?? null,
        };
      });
    } catch {
      return [];
    }
  });

export type TransferRow = {
  playerId: number;
  player: string;
  update: string;
  date: string | null;
  type: string | null;
  teams: {
    in: { id: number; name: string; logo: string } | null;
    out: { id: number; name: string; logo: string } | null;
  };
};

export const getTransfers = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        player: z.number().int().positive().optional(),
        team: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<TransferRow[]> => {
    try {
      const raw = await apiFootball<
        Array<{
          player: { id: number; name: string };
          update: string;
          transfers: Array<{
            date: string | null;
            type: string | null;
            teams: { in: TransferRow["teams"]["in"]; out: TransferRow["teams"]["out"] };
          }>;
        }>
      >("/transfers", data);
      return raw.flatMap((item) =>
        item.transfers.map((transfer) => ({
          playerId: item.player.id,
          player: item.player.name,
          update: item.update,
          ...transfer,
          teams: transfer.teams,
        })),
      );
    } catch {
      return [];
    }
  });

export type TrophyRow = {
  league: string;
  country: string;
  season: string;
  place: string;
  wins: number | null;
};

export const getTrophies = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        team: z.number().int().positive().optional(),
        player: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<TrophyRow[]> => {
    try {
      const raw = await apiFootball<TrophyRow[]>("/trophies", data);
      return raw;
    } catch {
      return [];
    }
  });

export type CoachRow = {
  id: number;
  name: string;
  firstname: string | null;
  lastname: string | null;
  age: number | null;
  nationality: string | null;
  photo: string;
  team: { id: number; name: string; logo: string } | null;
  career: Array<{
    team: { id: number; name: string; logo: string };
    start: string | null;
    end: string | null;
  }>;
};

export const getCoaches = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        team: z.number().int().positive().optional(),
        id: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CoachRow[]> => {
    try {
      const raw = await apiFootball<
        Array<{
          id: number;
          name: string;
          firstname: string | null;
          lastname: string | null;
          age: number | null;
          nationality: string | null;
          photo: string;
          team?: { id: number; name: string; logo: string } | null;
          career?: CoachRow["career"];
        }>
      >("/coachs", data);
      return raw.map((coach) => ({
        ...coach,
        team: coach.team ?? null,
        career: coach.career ?? [],
      }));
    } catch {
      return [];
    }
  });

export const getSeasons = createServerFn({ method: "GET" }).handler(async (): Promise<number[]> => {
  try {
    return await apiFootball<number[]>("/leagues/seasons");
  } catch {
    return [];
  }
});

export type LiveOddsRow = {
  fixtureId: number;
  update: string | null;
  bookmakers: Array<{
    id: number;
    name: string;
    bets: Array<{ id: number; name: string; values: Array<{ value: string; odd: string }> }>;
  }>;
};

export const getLiveOdds = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ fixture: z.number().int().positive().optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<LiveOddsRow[]> => {
    try {
      const raw = await apiFootball<
        Array<{
          fixture: { id: number };
          update?: string;
          bookmakers?: LiveOddsRow["bookmakers"];
        }>
      >("/odds/live", data);
      return raw.map((row) => ({
        fixtureId: row.fixture.id,
        update: row.update ?? null,
        bookmakers: row.bookmakers ?? [],
      }));
    } catch {
      return [];
    }
  });

export type TeamStatisticsRow = {
  league: { id: number; name: string; season: number };
  team: { id: number; name: string; logo: string };
  form: string;
  played: TeamStatSplit;
  wins: TeamStatSplit;
  draws: TeamStatSplit;
  loses: TeamStatSplit;
  goalsForAverage: TeamStatAverage;
  goalsAgainstAverage: TeamStatAverage;
  cleanSheets: Record<string, number | null>;
  failedToScore: Record<string, number | null>;
  lineups: Array<{ formation: string; played: number | null }>;
};

export const getTeamStatistics = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        team: z.number().int().positive(),
        league: z.number().int().positive(),
        season: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<TeamStatisticsRow | null> => {
    try {
      const raw = await apiFootball<ApiTeamStatisticsPayload>("/teams/statistics", data);
      return mapTeamStatistics(raw);
    } catch {
      return null;
    }
  });

export type SidelinedRow = {
  playerId: number;
  player: string;
  photo: string;
  teamId: number;
  team: string;
  type: string | null;
  start: string | null;
  end: string | null;
};

export const getSidelined = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        player: z.number().int().positive().optional(),
        team: z.number().int().positive().optional(),
        league: z.number().int().positive().optional(),
        season: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<SidelinedRow[]> => {
    try {
      const raw = await apiFootball<
        Array<{
          player: { id: number; name: string; photo: string };
          team: { id: number; name: string };
          type: string | null;
          start: string | null;
          end: string | null;
        }>
      >("/sidelined", data);
      return raw.map((item) => ({
        playerId: item.player.id,
        player: item.player.name,
        photo: item.player.photo,
        teamId: item.team.id,
        team: item.team.name,
        type: item.type,
        start: item.start,
        end: item.end,
      }));
    } catch {
      return [];
    }
  });

export type TeamFormMatch = {
  id: number;
  date: string;
  opponent: string;
  home: boolean;
  goalsFor: number | null;
  goalsAgainst: number | null;
  result: "W" | "D" | "L" | "?";
  competition: string;
};

export const getTeamForm = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        team: z.number().int().positive(),
        last: z.number().int().min(1).max(20).default(5),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const raw = await apiFootball<ApiFixture[]>("/fixtures", {
        team: data.team,
        last: data.last,
      });

      return raw.map<TeamFormMatch>((f) => {
        const isHome = f.teams.home.id === data.team;
        const gf = isHome ? f.goals.home : f.goals.away;
        const ga = isHome ? f.goals.away : f.goals.home;
        let result: "W" | "D" | "L" | "?" = "?";
        if (gf !== null && ga !== null) {
          if (gf > ga) result = "W";
          else if (gf === ga) result = "D";
          else result = "L";
        }
        return {
          id: f.fixture.id,
          date: new Date(f.fixture.date).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
          }),
          opponent: isHome ? f.teams.away.name : f.teams.home.name,
          home: isHome,
          goalsFor: gf,
          goalsAgainst: ga,
          result,
          competition: f.league.name,
        };
      });
    } catch {
      return [];
    }
  });

export type TeamOverview = {
  team: TeamRow | null;
  league: { id: number; name: string; logo: string; country: string; season: number } | null;
  recent: TeamFormMatch[];
  upcoming: TeamFormMatch[];
  squad: PlayerRow[];
  coaches: CoachRow[];
  transfers: TransferRow[];
  trophies: TrophyRow[];
  sidelined: SidelinedRow[];
  injuries: InjuryRow[];
  statistics: TeamStatisticsRow | null;
  fetchedAt: string;
};

function mapTeamFormFixtures(fixtures: ApiFixture[], teamId: number): TeamFormMatch[] {
  return fixtures.map((fixture) => {
    const home = fixture.teams.home.id === teamId;
    const goalsFor = home ? fixture.goals.home : fixture.goals.away;
    const goalsAgainst = home ? fixture.goals.away : fixture.goals.home;
    const result: TeamFormMatch["result"] =
      goalsFor === null || goalsAgainst === null
        ? "?"
        : goalsFor > goalsAgainst
          ? "W"
          : goalsFor === goalsAgainst
            ? "D"
            : "L";
    return {
      id: fixture.fixture.id,
      date: new Date(fixture.fixture.date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      opponent: home ? fixture.teams.away.name : fixture.teams.home.name,
      home,
      goalsFor,
      goalsAgainst,
      result,
      competition: fixture.league.name,
    };
  });
}

type ApiTeamEnvelope = {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string;
    founded: number | null;
    logo: string;
  };
  venue?: { name: string | null; city: string | null; capacity: number | null } | null;
};

function mapTeamRow(item: ApiTeamEnvelope | undefined): TeamRow | null {
  return item ? { ...item.team, venue: item.venue ?? null } : null;
}

function mapPlayerRow(item: {
  player: {
    id: number;
    name: string;
    firstname: string | null;
    lastname: string | null;
    age: number | null;
    nationality: string | null;
    photo: string;
  };
  statistics?: Array<{
    team: { id: number; name: string; logo: string };
    games: { position: string | null; appearences: number | null };
    goals: { total: number | null; assists: number | null };
  }>;
}): PlayerRow {
  const statistics = item.statistics?.[0];
  return {
    ...item.player,
    team: statistics?.team ?? null,
    position: statistics?.games.position ?? null,
    appearances: statistics?.games.appearences ?? null,
    goals: statistics?.goals.total ?? null,
    assists: statistics?.goals.assists ?? null,
  };
}

type RawTransferPayload = {
  player: { id: number; name: string };
  update: string;
  transfers: Array<{
    date: string | null;
    type: string | null;
    teams: { in: TransferRow["teams"]["in"]; out: TransferRow["teams"]["out"] };
  }>;
};

function mapTransferRows(rows: RawTransferPayload[]): TransferRow[] {
  return rows.flatMap((row) =>
    row.transfers.map((transfer) => ({
      playerId: row.player.id,
      player: row.player.name,
      update: row.update,
      date: transfer.date,
      type: transfer.type,
      teams: transfer.teams,
    })),
  );
}

type RawSidelinedPayload = {
  player: { id: number; name: string; photo: string };
  team: { id: number; name: string };
  type: string | null;
  start: string | null;
  end: string | null;
};

function mapSidelinedRows(rows: RawSidelinedPayload[]): SidelinedRow[] {
  return rows.map((row) => ({
    playerId: row.player.id,
    player: row.player.name,
    photo: row.player.photo,
    teamId: row.team.id,
    team: row.team.name,
    type: row.type,
    start: row.start,
    end: row.end,
  }));
}

type RawInjuryPayload = {
  player: { id: number; name: string; photo: string; type: string; reason: string };
  team: { id: number; name: string };
  fixture: { id: number | null };
};

function mapInjuryRows(rows: RawInjuryPayload[]): InjuryRow[] {
  return rows.map((row) => ({
    playerId: row.player.id,
    name: row.player.name,
    photo: row.player.photo,
    teamId: row.team.id,
    team: row.team.name,
    reason: row.player.reason,
    type: row.player.type,
    fixtureId: row.fixture?.id ?? null,
  }));
}

export const getTeamOverview = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        team: z.number().int().positive(),
        league: z.number().int().positive().optional(),
        season: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<TeamOverview> => {
    const [teamResult, fixturesResult] = await Promise.allSettled([
      apiFootball<ApiTeamEnvelope[]>("/teams", { id: data.team }),
      apiFootball<ApiFixture[]>("/fixtures", { team: data.team, last: 1 }),
    ]);
    const team = teamResult.status === "fulfilled" ? mapTeamRow(teamResult.value[0]) : null;
    const seedFixture = fixturesResult.status === "fulfilled" ? fixturesResult.value[0] : undefined;
    const leagueId = data.league ?? seedFixture?.league.id;
    const season = data.season ?? seedFixture?.league.season ?? currentSeasonYear();
    const [
      recentResult,
      upcomingResult,
      squadResult,
      coachesResult,
      transfersResult,
      trophiesResult,
      sidelinedResult,
      injuriesResult,
      statisticsResult,
    ] = await Promise.allSettled([
      apiFootball<ApiFixture[]>("/fixtures", { team: data.team, last: 10 }),
      apiFootball<ApiFixture[]>("/fixtures", { team: data.team, next: 10 }),
      apiFootball<Array<Parameters<typeof mapPlayerRow>[0]>>("/players", {
        team: data.team,
        season,
      }),
      apiFootball<CoachRow[]>("/coachs", { team: data.team }),
      apiFootball<RawTransferPayload[]>("/transfers", { team: data.team }),
      apiFootball<TrophyRow[]>("/trophies", { team: data.team }),
      apiFootball<RawSidelinedPayload[]>("/sidelined", { team: data.team, season }),
      apiFootball<RawInjuryPayload[]>("/injuries", { team: data.team, season }),
      leagueId
        ? apiFootball<ApiTeamStatisticsPayload>("/teams/statistics", {
            team: data.team,
            league: leagueId,
            season,
          })
        : Promise.resolve(null),
    ]);
    const recentFixtures = recentResult.status === "fulfilled" ? recentResult.value : [];
    const upcomingFixtures = upcomingResult.status === "fulfilled" ? upcomingResult.value : [];
    const inferredLeague = seedFixture?.league;
    return {
      team,
      league:
        inferredLeague && leagueId
          ? {
              id: leagueId,
              name: inferredLeague.name,
              logo: inferredLeague.logo,
              country: inferredLeague.country,
              season,
            }
          : null,
      recent: mapTeamFormFixtures(recentFixtures, data.team),
      upcoming: mapTeamFormFixtures(upcomingFixtures, data.team),
      squad: squadResult.status === "fulfilled" ? squadResult.value.map(mapPlayerRow) : [],
      coaches: coachesResult.status === "fulfilled" ? coachesResult.value : [],
      transfers:
        transfersResult.status === "fulfilled" ? mapTransferRows(transfersResult.value) : [],
      trophies: trophiesResult.status === "fulfilled" ? trophiesResult.value : [],
      sidelined:
        sidelinedResult.status === "fulfilled" ? mapSidelinedRows(sidelinedResult.value) : [],
      injuries: injuriesResult.status === "fulfilled" ? mapInjuryRows(injuriesResult.value) : [],
      statistics:
        statisticsResult.status === "fulfilled" && statisticsResult.value
          ? mapTeamStatistics(statisticsResult.value)
          : null,
      fetchedAt: new Date().toISOString(),
    };
  });

export type PlayerSeasonStat = {
  team: { id: number; name: string; logo: string };
  league: { id: number; name: string; season: number };
  position: string | null;
  appearances: number | null;
  minutes: number | null;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  passes: number | null;
  yellow: number | null;
  red: number | null;
};

export type PlayerOverview = {
  player: PlayerRow | null;
  statistics: PlayerSeasonStat[];
  transfers: TransferRow[];
  trophies: TrophyRow[];
  injuries: InjuryRow[];
  fetchedAt: string;
};

export const getPlayerOverview = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ player: z.number().int().positive() }).parse(input))
  .handler(async ({ data }): Promise<PlayerOverview> => {
    type RawPlayer = {
      player: {
        id: number;
        name: string;
        firstname: string | null;
        lastname: string | null;
        age: number | null;
        nationality: string | null;
        photo: string;
      };
      statistics?: RawStat[];
    };
    type RawStat = {
      team: { id: number; name: string; logo: string };
      league: { id: number; name: string; season: number };
      games: {
        position: string | null;
        appearences: number | null;
        minutes: number | null;
        rating?: string | null;
      };
      goals: { total: number | null; assists: number | null };
      shots?: { total: number | null };
      passes?: { total: number | null };
      cards?: { yellow: number | null; red: number | null };
    };
    const [playerResult, transfersResult, trophiesResult, injuriesResult] =
      await Promise.allSettled([
        apiFootball<RawPlayer[]>("/players", { id: data.player }),
        apiFootball<RawTransferPayload[]>("/transfers", { player: data.player }),
        apiFootball<TrophyRow[]>("/trophies", { player: data.player }),
        apiFootball<RawInjuryPayload[]>("/injuries", { player: data.player }),
      ]);
    const raw = playerResult.status === "fulfilled" ? playerResult.value[0] : undefined;
    const stats = raw?.statistics ?? [];
    const player = raw ? mapPlayerRow({ player: raw.player, statistics: stats }) : null;
    return {
      player,
      statistics: stats.map((stat) => ({
        team: stat.team,
        league: stat.league,
        position: stat.games.position ?? null,
        appearances: stat.games.appearences ?? null,
        minutes: stat.games.minutes ?? null,
        rating: stat.games.rating ? Number(stat.games.rating) : null,
        goals: stat.goals.total ?? null,
        assists: stat.goals.assists ?? null,
        shots: stat.shots?.total ?? null,
        passes: stat.passes?.total ?? null,
        yellow: stat.cards?.yellow ?? null,
        red: stat.cards?.red ?? null,
      })),
      transfers:
        transfersResult.status === "fulfilled" ? mapTransferRows(transfersResult.value) : [],
      trophies: trophiesResult.status === "fulfilled" ? trophiesResult.value : [],
      injuries: injuriesResult.status === "fulfilled" ? mapInjuryRows(injuriesResult.value) : [],
      fetchedAt: new Date().toISOString(),
    };
  });

export type CoachOverview = { coach: CoachRow | null; fetchedAt: string };

export const getCoachOverview = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ coach: z.number().int().positive() }).parse(input))
  .handler(async ({ data }): Promise<CoachOverview> => {
    try {
      const coaches = await apiFootball<CoachRow[]>("/coachs", { id: data.coach });
      return { coach: coaches[0] ?? null, fetchedAt: new Date().toISOString() };
    } catch {
      return { coach: null, fetchedAt: new Date().toISOString() };
    }
  });

export type CompetitionOverview = {
  competition: {
    id: number;
    name: string;
    type: string;
    logo: string;
    country: string;
    countryCode: string | null;
    season: number;
    seasons: Array<{ year: number; start: string; end: string; current: boolean }>;
  } | null;
  live: RemoteMatchSummary[];
  upcoming: RemoteMatchSummary[];
  results: RemoteMatchSummary[];
  standings: StandingRow[];
  topScorers: TopScorer[];
  unavailableSections: Array<"competition" | "live" | "matches" | "standings" | "top_scorers">;
  fetchedAt: string;
};

type CompetitionLeagueResponse = {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; code: string | null };
  seasons: Array<{ year: number; start: string; end: string; current: boolean }>;
};

type CompetitionStandingResponse = {
  league: {
    standings: Array<
      Array<{
        rank: number;
        team: { id: number; name: string; logo: string };
        points: number;
        goalsDiff: number;
        form?: string;
        all: {
          played: number;
          win: number;
          draw: number;
          lose: number;
          goals: { for: number; against: number };
        };
      }>
    >;
  };
};

type CompetitionScorerResponse = {
  player: { id: number; name: string; photo: string };
  statistics: Array<{
    team: { id: number; name: string; logo: string };
    games: { appearences: number };
    goals: { total: number | null; assists: number | null };
  }>;
};

function toStandingRows(rows: CompetitionStandingResponse["league"]["standings"][number]) {
  return rows.map<StandingRow>((row) => ({
    rank: row.rank,
    teamId: row.team.id,
    team: row.team.name,
    logo: row.team.logo,
    played: row.all.played,
    win: row.all.win,
    draw: row.all.draw,
    lose: row.all.lose,
    goalsFor: row.all.goals.for,
    goalsAgainst: row.all.goals.against,
    gd: row.goalsDiff,
    points: row.points,
    form: row.form ?? "",
  }));
}

function toTopScorerRows(rows: CompetitionScorerResponse[]) {
  return rows.slice(0, 20).map<TopScorer>((player, index) => {
    const statistics = player.statistics[0];
    return {
      rank: index + 1,
      playerId: player.player.id,
      name: player.player.name,
      photo: player.player.photo,
      teamId: statistics?.team.id ?? 0,
      team: statistics?.team.name ?? "—",
      teamLogo: statistics?.team.logo ?? "",
      goals: statistics?.goals.total ?? 0,
      assists: statistics?.goals.assists ?? 0,
      appearances: statistics?.games.appearences ?? 0,
    };
  });
}

async function getCompetitionLiveMatches(leagueId: number): Promise<RemoteMatchSummary[]> {
  // A fixture can appear in the date snapshot before the dedicated live
  // snapshot is refreshed. Read both real shared snapshots so an ongoing
  // competition match is never hidden by a short scheduling gap.
  const [liveSnapshot, daySnapshot] = await Promise.all([
    readSharedFixtureSnapshot("live", todayISO()),
    readSharedFixtureSnapshot("day", todayISO()),
  ]);
  const snapshotMatches = mergeCompetitionMatches(
    liveSnapshot?.matches.filter(
      (match) => match.league.id === leagueId && match.status === "live",
    ) ?? [],
    daySnapshot?.matches.filter(
      (match) => match.league.id === leagueId && match.status === "live",
    ) ?? [],
  );
  if (snapshotMatches.length > 0) return snapshotMatches;

  const liveRows = await apiFootball<ApiFixture[]>("/fixtures", { live: "all" });
  return rankApiFixtures(liveRows.filter((fixture) => fixture.league.id === leagueId));
}

function mergeCompetitionMatches(...groups: RemoteMatchSummary[][]): RemoteMatchSummary[] {
  const byId = new Map<number, RemoteMatchSummary>();
  for (const group of groups) {
    for (const match of group) {
      const current = byId.get(match.id);
      // A live status is more recent than a fixture still marked as upcoming.
      if (!current || (current.status !== "live" && match.status === "live")) {
        byId.set(match.id, match);
      }
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
  );
}

type CompetitionSeasonSections = {
  season: number;
  upcoming: PromiseSettledResult<ApiFixture[]>;
  results: PromiseSettledResult<ApiFixture[]>;
  standings: PromiseSettledResult<CompetitionStandingResponse[]>;
  scorers: PromiseSettledResult<CompetitionScorerResponse[]>;
};

function uniqueCompetitionSeasons(values: Array<number | null | undefined>) {
  const seasons: number[] = [];
  for (const value of values) {
    if (!Number.isInteger(value) || (value ?? 0) < 1900 || seasons.includes(value as number)) {
      continue;
    }
    seasons.push(value as number);
  }
  return seasons;
}

function selectCompetitionSeasonCandidates(
  requestedSeason: number | undefined,
  league: CompetitionLeagueResponse | undefined,
  live: RemoteMatchSummary[],
) {
  if (requestedSeason) return [requestedSeason];
  const today = todayISO();
  const seasons = league?.seasons ?? [];
  const current = seasons.find((item) => item.current)?.year;
  const activeToday = seasons.find((item) => item.start <= today && item.end >= today)?.year;
  const latestStarted = [...seasons]
    .filter((item) => item.start <= today)
    .sort((a, b) => b.year - a.year)[0]?.year;
  const liveSeason = live.find((match) => match.league.season > 0)?.league.season;

  // An explicit season remains preferred, while fallbacks cover competitions
  // whose provider metadata has not marked the active season yet.
  return uniqueCompetitionSeasons([
    requestedSeason,
    liveSeason,
    current,
    activeToday,
    latestStarted,
    currentSeasonYear(),
    currentSeasonYear() - 1,
  ]).slice(0, 3);
}

async function loadCompetitionSeasonSections(
  league: number,
  season: number,
): Promise<CompetitionSeasonSections> {
  const [upcoming, results, standings, scorers] = await Promise.allSettled([
    apiFootball<ApiFixture[]>("/fixtures", { league, season, next: 20 }),
    apiFootball<ApiFixture[]>("/fixtures", { league, season, last: 20 }),
    apiFootball<CompetitionStandingResponse[]>("/standings", { league, season }),
    apiFootball<CompetitionScorerResponse[]>("/players/topscorers", { league, season }),
  ]);
  return { season, upcoming, results, standings, scorers };
}

function hasCompetitionSeasonData(sections: CompetitionSeasonSections) {
  return (
    (sections.upcoming.status === "fulfilled" && sections.upcoming.value.length > 0) ||
    (sections.results.status === "fulfilled" && sections.results.value.length > 0) ||
    (sections.standings.status === "fulfilled" &&
      (sections.standings.value[0]?.league.standings[0]?.length ?? 0) > 0) ||
    (sections.scorers.status === "fulfilled" && sections.scorers.value.length > 0)
  );
}

function competitionFromFixture(
  fixture: ApiFixture | undefined,
  season: number,
): CompetitionOverview["competition"] {
  if (!fixture) return null;
  return {
    id: fixture.league.id,
    name: fixture.league.name,
    type: "League",
    logo: fixture.league.logo,
    country: fixture.league.country,
    countryCode: null,
    season: fixture.league.season || season,
    seasons: [],
  };
}

/**
 * Vue publique d'une compétition. Chaque bloc est chargé séparément afin
 * qu'un classement indisponible ne masque jamais les matchs réellement reçus.
 */
export const getCompetitionOverview = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        league: z.number().int().positive(),
        season: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<CompetitionOverview> => {
    const fetchedAt = new Date().toISOString();
    const [leagueResult, liveResult, daySnapshotResult] = await Promise.allSettled([
      apiFootball<CompetitionLeagueResponse[]>("/leagues", { id: data.league }),
      getCompetitionLiveMatches(data.league),
      readSharedFixtureSnapshot("day", todayISO()),
    ]);
    const leagueRow = leagueResult.status === "fulfilled" ? leagueResult.value[0] : undefined;
    const liveFromSnapshot =
      liveResult.status === "fulfilled"
        ? liveResult.value.filter((match) => !data.season || match.league.season === data.season)
        : [];
    const todayCompetitionMatches =
      daySnapshotResult.status === "fulfilled"
        ? (daySnapshotResult.value?.matches.filter(
            (match) =>
              match.league.id === data.league &&
              (!data.season || match.league.season === data.season),
          ) ?? [])
        : [];
    const seasonCandidates = selectCompetitionSeasonCandidates(
      data.season,
      leagueRow,
      liveFromSnapshot,
    );
    const initialSeason = seasonCandidates[0] ?? currentSeasonYear();

    // Try a real adjacent season only when every official section is empty.
    // This prevents a delayed `current` flag from hiding an active competition.
    let sections = await loadCompetitionSeasonSections(data.league, initialSeason);
    for (const season of seasonCandidates.slice(1)) {
      if (hasCompetitionSeasonData(sections)) break;
      const alternative = await loadCompetitionSeasonSections(data.league, season);
      if (hasCompetitionSeasonData(alternative)) {
        sections = alternative;
        break;
      }
    }

    const season = sections.season;
    const {
      upcoming: upcomingResult,
      results: resultsResult,
      standings: standingsResult,
      scorers: scorersResult,
    } = sections;

    const unavailableSections: CompetitionOverview["unavailableSections"] = [];
    if (liveResult.status === "rejected") unavailableSections.push("live");
    if (upcomingResult.status === "rejected" || resultsResult.status === "rejected") {
      unavailableSections.push("matches");
    }
    if (standingsResult.status === "rejected") unavailableSections.push("standings");
    if (scorersResult.status === "rejected") unavailableSections.push("top_scorers");

    // Ranking enriches fixture cards but must never make the whole public
    // competition page fail when its optional community signal is unavailable.
    const rankedMatches = await Promise.allSettled([
      liveResult.status === "fulfilled" ? Promise.resolve(liveFromSnapshot) : Promise.resolve([]),
      upcomingResult.status === "fulfilled"
        ? rankApiFixtures(upcomingResult.value)
        : Promise.resolve([]),
      resultsResult.status === "fulfilled"
        ? rankApiFixtures(resultsResult.value)
        : Promise.resolve([]),
    ]);
    const live = mergeCompetitionMatches(
      rankedMatches[0].status === "fulfilled" ? rankedMatches[0].value : [],
      todayCompetitionMatches.filter((match) => match.status === "live"),
    );
    const upcoming = mergeCompetitionMatches(
      todayCompetitionMatches.filter((match) => match.status === "upcoming"),
      rankedMatches[1].status === "fulfilled" ? rankedMatches[1].value : [],
    );
    const results = mergeCompetitionMatches(
      todayCompetitionMatches.filter((match) => match.status === "finished"),
      rankedMatches[2].status === "fulfilled" ? rankedMatches[2].value : [],
    );

    if (
      (liveResult.status === "fulfilled" && rankedMatches[0].status === "rejected") ||
      (upcomingResult.status === "fulfilled" && rankedMatches[1].status === "rejected") ||
      (resultsResult.status === "fulfilled" && rankedMatches[2].status === "rejected")
    ) {
      unavailableSections.push("matches");
    }

    const liveCompetition = live[0]
      ? {
          id: live[0].league.id,
          name: live[0].league.name,
          type: "League",
          logo: live[0].league.logo,
          country: live[0].league.country,
          countryCode: null,
          season: live[0].league.season || season,
          seasons: [],
        }
      : null;
    const fixtureCompetition =
      competitionFromFixture(
        upcomingResult.status === "fulfilled" ? upcomingResult.value[0] : undefined,
        season,
      ) ??
      competitionFromFixture(
        resultsResult.status === "fulfilled" ? resultsResult.value[0] : undefined,
        season,
      );
    const featuredFallback = FEATURED_COMPETITIONS.find(
      (competition) => competition.id === data.league,
    );
    const competition = leagueRow
      ? {
          id: leagueRow.league.id,
          name: leagueRow.league.name,
          type: leagueRow.league.type,
          logo: leagueRow.league.logo,
          country: leagueRow.country.name,
          countryCode: leagueRow.country.code,
          season,
          seasons: leagueRow.seasons,
        }
      : (liveCompetition ??
        fixtureCompetition ??
        (featuredFallback
          ? {
              id: featuredFallback.id,
              name: featuredFallback.name,
              type: "League",
              logo: "",
              country: featuredFallback.country,
              countryCode: null,
              season,
              seasons: [],
            }
          : null));

    if (!competition) unavailableSections.push("competition");

    return {
      competition,
      live,
      upcoming,
      results,
      standings:
        standingsResult.status === "fulfilled"
          ? toStandingRows(standingsResult.value[0]?.league.standings[0] ?? [])
          : [],
      topScorers: scorersResult.status === "fulfilled" ? toTopScorerRows(scorersResult.value) : [],
      unavailableSections,
      fetchedAt,
    };
  });

export function currentSeasonYear(): number {
  const d = new Date();
  const m = d.getUTCMonth() + 1;
  return m >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}
