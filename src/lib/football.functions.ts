import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { apiFootball, todayISO } from "./apifootball.server";
import type {
  ApiEvent,
  ApiH2H,
  ApiLineup,
  ApiStats,
  ApiStatus,
  RemoteMatchDetail,
  RemoteMatchSummary,
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
  return name.replace(/\s+(FC|CF|SC|AC|AS|FK|BK|SK|1899|1907|1900|Football Club|Calcio)$/i, "").slice(0, 14);
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
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
};

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
    venue: f.fixture.venue.name ? `${f.fixture.venue.name}${f.fixture.venue.city ? ", " + f.fixture.venue.city : ""}` : null,
  };
}

// Major leagues we surface by default when the "today" call is quiet.
const PRIORITY_LEAGUES = [61 /*L1*/, 39 /*PL*/, 140 /*Liga*/, 135 /*SerieA*/, 78 /*Bundesliga*/, 2 /*UCL*/, 3 /*UEL*/];

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
  .handler(async ({ data }) => {
    // Prefer today's date; if `live` is true, request only live fixtures.
    const params: Record<string, string> = {};
    if (data.live) params.live = "all";
    else params.date = data.date ?? todayISO();

    const raw = await apiFootball<ApiFixture[]>("/fixtures", params);
    // Filter to priority leagues if the raw response is huge (>60), otherwise keep all.
    const list =
      raw.length > 60 ? raw.filter((f) => PRIORITY_LEAGUES.includes(f.league.id)) : raw;
    return list.map(toSummary);
  });

type StatItem = { type: string; value: number | string | null };

function parseNumber(v: number | string | null): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const cleaned = v.toString().replace("%", "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function mapStats(homeStats: StatItem[] = [], awayStats: StatItem[] = []): ApiStats {
  const pick = (arr: StatItem[], type: string) =>
    parseNumber(arr.find((s) => s.type?.toLowerCase() === type.toLowerCase())?.value ?? 0);
  return {
    possession: { home: pick(homeStats, "Ball Possession"), away: pick(awayStats, "Ball Possession") },
    shots: { home: pick(homeStats, "Total Shots"), away: pick(awayStats, "Total Shots") },
    shotsOnTarget: { home: pick(homeStats, "Shots on Goal"), away: pick(awayStats, "Shots on Goal") },
    xg: { home: pick(homeStats, "expected_goals"), away: pick(awayStats, "expected_goals") },
    corners: { home: pick(homeStats, "Corner Kicks"), away: pick(awayStats, "Corner Kicks") },
    fouls: { home: pick(homeStats, "Fouls"), away: pick(awayStats, "Fouls") },
    yellow: { home: pick(homeStats, "Yellow Cards"), away: pick(awayStats, "Yellow Cards") },
    red: { home: pick(homeStats, "Red Cards"), away: pick(awayStats, "Red Cards") },
    passAccuracy: { home: pick(homeStats, "Passes %"), away: pick(awayStats, "Passes %") },
    offsides: { home: pick(homeStats, "Offsides"), away: pick(awayStats, "Offsides") },
  };
}

export const getFixtureDetail = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const id = data.id;

    const [fixtureArr, eventsArr, statsArr, lineupsArr] = await Promise.all([
      apiFootball<ApiFixture[]>("/fixtures", { id }),
      apiFootball<Array<{
        time: { elapsed: number };
        team: { id: number };
        player: { name: string };
        assist: { name: string | null };
        type: string;
        detail: string;
      }>>("/fixtures/events", { fixture: id }).catch(() => []),
      apiFootball<Array<{ team: { id: number }; statistics: StatItem[] }>>(
        "/fixtures/statistics",
        { fixture: id },
      ).catch(() => []),
      apiFootball<Array<{
        team: { id: number; name: string; colors: { player: { primary: string } } | null };
        formation: string;
        coach: { name: string };
        startXI: Array<{ player: { name: string; number: number; pos: string } }>;
      }>>("/fixtures/lineups", { fixture: id }).catch(() => []),
    ]);

    if (!fixtureArr.length) throw new Error("Fixture introuvable");
    const f = fixtureArr[0];
    const summary = toSummary(f);

    // Events
    const events: ApiEvent[] = eventsArr.map((e) => {
      const isHome = e.team.id === f.teams.home.id;
      const type: ApiEvent["type"] =
        e.type === "Goal"
          ? "goal"
          : e.type === "Card"
            ? e.detail === "Red Card"
              ? "red"
              : "yellow"
            : e.type === "subst"
              ? "sub"
              : "var";
      return {
        minute: e.time.elapsed,
        side: isHome ? "home" : "away",
        type,
        player: e.player?.name ?? "—",
        detail: e.assist?.name ? `Passe : ${e.assist.name}` : e.detail,
      };
    });

    // Stats
    const homeStats = statsArr.find((s) => s.team.id === f.teams.home.id)?.statistics ?? [];
    const awayStats = statsArr.find((s) => s.team.id === f.teams.away.id)?.statistics ?? [];
    const stats = mapStats(homeStats, awayStats);

    // Lineups
    const buildLineup = (teamId: number, fallbackColor: string): ApiLineup | null => {
      const l = lineupsArr.find((x) => x.team.id === teamId);
      if (!l) return null;
      return {
        formation: l.formation ?? "—",
        coach: l.coach?.name ?? "—",
        color: l.team.colors?.player?.primary ? `#${l.team.colors.player.primary}` : fallbackColor,
        players: l.startXI.map((p) => ({
          number: p.player.number,
          name: p.player.name,
          position: p.player.pos,
        })),
      };
    };
    const lineups = {
      home: buildLineup(f.teams.home.id, "#10b981"),
      away: buildLineup(f.teams.away.id, "#3b82f6"),
    };

    // H2H (last 5)
    const h2hRaw = await apiFootball<ApiFixture[]>("/fixtures/headtohead", {
      h2h: `${f.teams.home.id}-${f.teams.away.id}`,
      last: 5,
    }).catch(() => [] as ApiFixture[]);
    const h2h: ApiH2H[] = h2hRaw.map((h) => ({
      id: h.fixture.id,
      date: new Date(h.fixture.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
      competition: h.league.name,
      home: h.teams.home.name,
      away: h.teams.away.name,
      score: `${h.goals.home ?? 0}-${h.goals.away ?? 0}`,
    }));

    const detail: RemoteMatchDetail = {
      ...summary,
      events: events.sort((a, b) => a.minute - b.minute),
      stats,
      lineups,
      h2h,
    };
    return detail;
  });

export const searchTeams = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ q: z.string().min(2).max(60) }).parse(input))
  .handler(async ({ data }) => {
    const raw = await apiFootball<Array<{
      team: { id: number; name: string; country: string; logo: string };
    }>>("/teams", { search: data.q });
    return raw.slice(0, 8).map((r) => ({
      id: r.team.id,
      name: r.team.name,
      country: r.team.country,
      logo: r.team.logo,
    }));
  });
