import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  apiFootball,
  ApiFootballError,
  getApiFootballCacheEnvelope,
  getApiFootballCacheState,
  todayISO,
} from "./apifootball.server";
import {
  rankMatches,
  selectTrendingMatch,
  type MatchRankingSignal,
} from "./match-ranking";
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
    const params = isLiveRequest ? { live: "all" as const } : { date: data.date ?? todayISO() };
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
      .object({ country: z.string().max(80).optional(), season: z.number().int().optional() })
      .parse(input),
  )
  .handler(async ({ data }): Promise<LeagueRow[]> => {
    try {
      const raw = await apiFootball<
        Array<{
          league: { id: number; name: string; type: string; logo: string };
          country: { name: string; code: string | null };
          seasons: Array<{ year: number; start: string; end: string; current: boolean }>;
        }>
      >("/leagues", data);
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

export const getTeams = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        search: z.string().min(2).max(80).optional(),
        league: z.number().int().optional(),
        season: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<TeamRow[]> => {
    try {
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
      >("/teams", data);
      return raw.map((item) => ({ ...item.team, venue: item.venue ?? null }));
    } catch {
      return [];
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
      >("/players", data);
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
  fixtures: Record<string, Record<string, number | null>>;
  goals: Record<string, Record<string, number | string | null>>;
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
      const raw = await apiFootball<
        Array<{
          league: { id: number; name: string; season: number };
          team: { id: number; name: string; logo: string };
          form: string;
          fixtures: Record<string, Record<string, number | null>>;
          goals: Record<string, Record<string, number | string | null>>;
          clean_sheet: Record<string, number | null>;
          failed_to_score: Record<string, number | null>;
          lineups: Array<{ formation: string; played: number | null }>;
        }>
      >("/teams/statistics", data);
      const item = raw[0];
      return item
        ? {
            league: item.league,
            team: item.team,
            form: item.form ?? "",
            fixtures: item.fixtures ?? {},
            goals: item.goals ?? {},
            cleanSheets: item.clean_sheet ?? {},
            failedToScore: item.failed_to_score ?? {},
            lineups: item.lineups ?? [],
          }
        : null;
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

function currentSeasonYear(): number {
  const d = new Date();
  const m = d.getUTCMonth() + 1;
  return m >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}
