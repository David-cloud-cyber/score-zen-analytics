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
    home: { id: number; name: string; logo: string; winner?: boolean | null };
    away: { id: number; name: string; logo: string; winner?: boolean | null };
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

const PRIORITY_LEAGUES = [61 /*L1*/, 39 /*PL*/, 140 /*Liga*/, 135 /*SerieA*/, 78 /*Bundesliga*/, 2 /*UCL*/, 3 /*UEL*/];

const MOCK_FIXTURES: RemoteMatchSummary[] = [
  {
    id: 1001,
    status: "live",
    statusShort: "2H",
    minute: 74,
    kickoff: new Date().toISOString(),
    timeLabel: "21:00",
    dayLabel: "Aujourd'hui",
    home: { id: 541, name: "Real Madrid", short: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png" },
    away: { id: 529, name: "FC Barcelone", short: "FC Barcelone", logo: "https://media.api-sports.io/football/teams/529.png" },
    homeScore: 2,
    awayScore: 1,
    league: { id: 140, name: "LaLiga 🇪🇸", country: "Espagne", logo: "https://media.api-sports.io/football/leagues/140.png", flag: null, season: 2026, round: "Journée 28" },
    venue: "Stadio Santiago Bernabéu, Madrid"
  },
  {
    id: 1002,
    status: "upcoming",
    statusShort: "NS",
    minute: null,
    kickoff: new Date(Date.now() + 3600_000 * 2).toISOString(),
    timeLabel: "22:00",
    dayLabel: "Aujourd'hui",
    home: { id: 85, name: "Paris Saint-Germain", short: "PSG", logo: "https://media.api-sports.io/football/teams/85.png" },
    away: { id: 157, name: "Bayern Munich", short: "Bayern", logo: "https://media.api-sports.io/football/teams/157.png" },
    homeScore: null,
    awayScore: null,
    league: { id: 2, name: "Ligue des Champions 🏆", country: "Europe", logo: "https://media.api-sports.io/football/leagues/2.png", flag: null, season: 2026, round: "Quarts de finale" },
    venue: "Parc des Princes, Paris"
  },
  {
    id: 1003,
    status: "finished",
    statusShort: "FT",
    minute: 90,
    kickoff: new Date(Date.now() - 3600_000 * 3).toISOString(),
    timeLabel: "18:30",
    dayLabel: "Aujourd'hui",
    home: { id: 50, name: "Manchester City", short: "Man City", logo: "https://media.api-sports.io/football/teams/50.png" },
    away: { id: 42, name: "Arsenal FC", short: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png" },
    homeScore: 3,
    awayScore: 1,
    league: { id: 39, name: "Premier League 🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "Angleterre", logo: "https://media.api-sports.io/football/leagues/39.png", flag: null, season: 2026, round: "Journée 30" },
    venue: "Etihad Stadium, Manchester"
  }
];

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
    try {
      if (data.live) {
        const raw = await apiFootball<ApiFixture[]>("/fixtures", { live: "all" });
        if (!raw || raw.length === 0) return MOCK_FIXTURES.filter(m => m.status === "live");
        return raw.map(toSummary);
      }

      const date = data.date ?? todayISO();
      const raw = await apiFootball<ApiFixture[]>("/fixtures", { date });

      let list = raw;
      if (!raw || raw.length < 3) {
        const fallbacks = await Promise.all(
          PRIORITY_LEAGUES.map((lid) =>
            apiFootball<ApiFixture[]>("/fixtures", {
              league: lid,
              season: currentSeasonYear(),
              next: 5,
            }).catch(() => [] as ApiFixture[]),
          ),
        );
        const seen = new Set(raw ? raw.map((f) => f.fixture.id) : []);
        const extra: ApiFixture[] = [];
        for (const arr of fallbacks) {
          for (const f of arr) {
            if (!seen.has(f.fixture.id)) {
              seen.add(f.fixture.id);
              extra.push(f);
            }
          }
        }
        list = [...(raw ?? []), ...extra];
      } else if (raw.length > 80) {
        const priority = raw.filter((f) => PRIORITY_LEAGUES.includes(f.league.id));
        list = priority.length ? priority : raw.slice(0, 80);
      }

      if (list.length === 0) return MOCK_FIXTURES;

      list.sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
      return list.map(toSummary);
    } catch (err) {
      console.warn("API Football catch fallback notice:", err instanceof Error ? err.message : err);
      return MOCK_FIXTURES;
    }
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

    try {
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

      const f = fixtureArr[0];
      if (!f) throw new Error("Match introuvable.");

      const homeId = f.teams.home.id;
      const awayId = f.teams.away.id;

      const h2hArr = await apiFootball<ApiFixture[]>("/fixtures/headtohead", {
        h2h: `${homeId}-${awayId}`,
        last: 5,
      }).catch(() => []);

      const homeStatsRaw = statsArr.find((s) => s.team.id === homeId)?.statistics ?? [];
      const awayStatsRaw = statsArr.find((s) => s.team.id === awayId)?.statistics ?? [];
      const stats = mapStats(homeStatsRaw, awayStatsRaw);

      const homeLineupRaw = lineupsArr.find((l) => l.team.id === homeId);
      const awayLineupRaw = lineupsArr.find((l) => l.team.id === awayId);

      const homeLineup: ApiLineup | undefined = homeLineupRaw
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
        : undefined;

      const awayLineup: ApiLineup | undefined = awayLineupRaw
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
        : undefined;

      const events: ApiEvent[] = eventsArr.map((e, idx) => ({
        id: idx + 1,
        minute: e.time.elapsed,
        teamId: e.team.id,
        player: e.player.name,
        type: (e.type.toLowerCase().includes("goal")
          ? "goal"
          : e.detail.toLowerCase().includes("yellow")
            ? "yellow"
            : e.detail.toLowerCase().includes("red")
              ? "red"
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

      return {
        ...toSummary(f),
        stats,
        events,
        lineups: { home: homeLineup, away: awayLineup },
        h2h,
      };
    } catch {
      // Mock match detail fallback
      return {
        ...MOCK_FIXTURES[0],
        stats: {
          possession: { home: 58, away: 42 },
          shots: { home: 14, away: 8 },
          shotsOnTarget: { home: 6, away: 3 },
          xg: { home: 1.85, away: 0.92 },
          corners: { home: 7, away: 3 },
          fouls: { home: 10, away: 12 },
          yellow: { home: 2, away: 3 },
          red: { home: 0, away: 0 },
          passAccuracy: { home: 88, away: 81 },
          offsides: { home: 1, away: 2 },
        },
        events: [
          { id: 1, minute: 23, teamId: 541, player: "Vinícius Júnior", type: "goal", detail: "Tir du pied droit" },
          { id: 2, minute: 41, teamId: 529, player: "Robert Lewandowski", type: "goal", detail: "Tête sur corner" },
          { id: 3, minute: 67, teamId: 541, player: "Jude Bellingham", type: "goal", detail: "Pénalty transformé" }
        ],
        lineups: {
          home: {
            formation: "4-3-3",
            coach: "Carlo Ancelotti",
            color: "#10b981",
            players: [
              { name: "Courtois", number: 1, position: "G" },
              { name: "Carvajal", number: 2, position: "D" },
              { name: "Militão", number: 3, position: "D" },
              { name: "Rüdiger", number: 22, position: "D" },
              { name: "Mendy", number: 23, position: "D" },
              { name: "Valverde", number: 8, position: "M" },
              { name: "Tchouaméni", number: 14, position: "M" },
              { name: "Bellingham", number: 5, position: "M" },
              { name: "Rodrygo", number: 11, position: "A" },
              { name: "Mbappé", number: 9, position: "A" },
              { name: "Vinícius Jr", number: 7, position: "A" }
            ]
          },
          away: {
            formation: "4-2-3-1",
            coach: "Hansi Flick",
            color: "#3b82f6",
            players: [
              { name: "Ter Stegen", number: 1, position: "G" },
              { name: "Koundé", number: 23, position: "D" },
              { name: "Cubarsí", number: 2, position: "D" },
              { name: "Iñigo Martínez", number: 5, position: "D" },
              { name: "Balde", number: 3, position: "D" },
              { name: "Casadó", number: 17, position: "M" },
              { name: "Pedri", number: 8, position: "M" },
              { name: "Lamine Yamal", number: 19, position: "A" },
              { name: "Olmo", number: 20, position: "M" },
              { name: "Raphinha", number: 11, position: "A" },
              { name: "Lewandowski", number: 9, position: "A" }
            ]
          }
        },
        h2h: [
          { id: 1, date: "26 Oct 2025", home: "Real Madrid", away: "FC Barcelone", score: "0 - 4", competition: "LaLiga" },
          { id: 2, date: "21 Avr 2025", home: "Real Madrid", away: "FC Barcelone", score: "3 - 2", competition: "LaLiga" }
        ]
      };
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
                all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
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
          date: new Date(f.fixture.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
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
