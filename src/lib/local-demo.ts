import type { Session, User } from "@supabase/supabase-js";
import type { AnalysisResult } from "@/lib/analyses.functions";
import type {
  ApiH2H,
  ApiLineup,
  ApiStats,
  RemoteMatchDetail,
  RemoteMatchSummary,
} from "@/lib/football-types";

const DEMO_STORAGE_KEY = "livefoot-local-demo";
const LOGOS = {
  arsenal: "https://media.api-sports.io/football/teams/42.png",
  chelsea: "https://media.api-sports.io/football/teams/49.png",
  madrid: "https://media.api-sports.io/football/teams/541.png",
  atletico: "https://media.api-sports.io/football/teams/530.png",
  bayern: "https://media.api-sports.io/football/teams/157.png",
  dortmund: "https://media.api-sports.io/football/teams/165.png",
  psg: "https://media.api-sports.io/football/teams/85.png",
  lyon: "https://media.api-sports.io/football/teams/80.png",
};

export function isLocalDemoSearch(searchString: string): boolean {
  return import.meta.env.DEV && new URLSearchParams(searchString).get("demo") === "1";
}

/** Demo mode is intentionally browser-only and development-only. */
export function isLocalDemo(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") === "0") {
    clearLocalDemo();
    return false;
  }
  if (params.get("demo") === "1") {
    window.localStorage.setItem(DEMO_STORAGE_KEY, "1");
    return true;
  }
  return window.localStorage.getItem(DEMO_STORAGE_KEY) === "1";
}

export function clearLocalDemo(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(DEMO_STORAGE_KEY);
}

export const DEMO_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "demo@livefoot.local",
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Dodo Bien" },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as unknown as User;

export const DEMO_SESSION = {
  access_token: "local-demo-token",
  token_type: "bearer",
  expires_in: 60 * 60 * 24,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  refresh_token: "local-demo-refresh-token",
  user: DEMO_USER,
} as unknown as Session;

function isoAt(offsetDays: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function dayLabel(offsetDays: number): string {
  if (offsetDays === 0) return "Aujourd'hui";
  if (offsetDays === 1) return "Demain";
  return new Date(isoAt(offsetDays, 12)).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function team(id: number, name: string, logo: string) {
  return { id, name, short: name.replace(/ FC$/, ""), logo };
}

function league(id: number, name: string, country: string, logo = LOGOS.arsenal) {
  return { id, name, country, logo, flag: null, season: new Date().getFullYear() };
}

export const DEMO_FIXTURES: RemoteMatchSummary[] = [
  {
    id: 910001,
    status: "live",
    statusShort: "2H",
    minute: 67,
    kickoff: isoAt(0, 19, 30),
    timeLabel: "19:30",
    dayLabel: dayLabel(0),
    home: team(42, "Arsenal", LOGOS.arsenal),
    away: team(49, "Chelsea", LOGOS.chelsea),
    homeScore: 2,
    awayScore: 1,
    league: league(39, "Premier League", "Angleterre"),
    venue: "Emirates Stadium, London",
  },
  {
    id: 910002,
    status: "upcoming",
    statusShort: "NS",
    minute: null,
    kickoff: isoAt(0, 21, 0),
    timeLabel: "21:00",
    dayLabel: dayLabel(0),
    home: team(541, "Real Madrid", LOGOS.madrid),
    away: team(530, "Atlético Madrid", LOGOS.atletico),
    homeScore: null,
    awayScore: null,
    league: league(140, "LaLiga", "Espagne", LOGOS.madrid),
    venue: "Santiago Bernabéu, Madrid",
  },
  {
    id: 910003,
    status: "upcoming",
    statusShort: "NS",
    minute: null,
    kickoff: isoAt(0, 20, 45),
    timeLabel: "20:45",
    dayLabel: dayLabel(0),
    home: team(157, "Bayern Munich", LOGOS.bayern),
    away: team(165, "Borussia Dortmund", LOGOS.dortmund),
    homeScore: null,
    awayScore: null,
    league: league(78, "Bundesliga", "Allemagne", LOGOS.bayern),
    venue: "Allianz Arena, Munich",
  },
  {
    id: 910004,
    status: "finished",
    statusShort: "FT",
    minute: null,
    kickoff: isoAt(0, 17, 0),
    timeLabel: "17:00",
    dayLabel: dayLabel(0),
    home: team(85, "Paris Saint-Germain", LOGOS.psg),
    away: team(80, "Olympique Lyonnais", LOGOS.lyon),
    homeScore: 3,
    awayScore: 0,
    league: league(61, "Ligue 1", "France", LOGOS.psg),
    venue: "Parc des Princes, Paris",
  },
];

const DEMO_STATS: ApiStats = {
  possession: { home: 58, away: 42 },
  shots: { home: 13, away: 8 },
  shotsOnTarget: { home: 6, away: 3 },
  xg: { home: 1.86, away: 0.92 },
  corners: { home: 6, away: 3 },
  fouls: { home: 8, away: 11 },
  yellow: { home: 1, away: 2 },
  red: { home: 0, away: 0 },
  passAccuracy: { home: 89, away: 83 },
  offsides: { home: 1, away: 2 },
};

const DEMO_LINEUP: ApiLineup = {
  formation: "4-3-3",
  coach: "Mikel Arteta",
  color: "#10b981",
  players: [
    { number: 22, name: "David Raya", position: "G" },
    { number: 4, name: "William Saliba", position: "D" },
    { number: 2, name: "William Gallas", position: "D" },
    { number: 8, name: "Martin Ødegaard", position: "M" },
    { number: 7, name: "Bukayo Saka", position: "A" },
  ],
};

const DEMO_H2H: ApiH2H[] = [
  {
    id: 8001,
    date: "12 avr.",
    competition: "Premier League",
    home: "Arsenal",
    away: "Chelsea",
    score: "2 - 1",
  },
  {
    id: 8002,
    date: "30 nov.",
    competition: "Premier League",
    home: "Chelsea",
    away: "Arsenal",
    score: "1 - 1",
  },
  {
    id: 8003,
    date: "23 avr.",
    competition: "Premier League",
    home: "Arsenal",
    away: "Chelsea",
    score: "3 - 1",
  },
];

export const DEMO_MATCH_DETAIL: RemoteMatchDetail = {
  ...DEMO_FIXTURES[0],
  meta: { fetchedAt: new Date().toISOString(), stale: false, unavailableSections: [], source: "api", state: "fresh" },
  events: [
    { minute: 18, side: "home", type: "goal", player: "Bukayo Saka", detail: "But" },
    { minute: 41, side: "away", type: "yellow", player: "M. Caicedo", detail: "Carton jaune" },
    { minute: 54, side: "home", type: "goal", player: "Kai Havertz", detail: "But" },
  ],
  stats: DEMO_STATS,
  lineups: { home: DEMO_LINEUP, away: { ...DEMO_LINEUP, coach: "Enzo Maresca", color: "#3b82f6" } },
  h2h: DEMO_H2H,
  odds: { home: 1.72, draw: 3.8, away: 4.6, bookmakers: 8, updatedAt: "2026-08-09T17:00:00Z" },
  prediction: {
    home: 58,
    draw: 23,
    away: 19,
    winner: "home",
    winnerName: "Arsenal",
    advice: "Arsenal ou nul",
    underOver: "Plus de 1,5 buts",
  },
  injuries: { home: [], away: [] },
};

export const DEMO_ANALYSIS: AnalysisResult = {
  probabilities: { home: 58, draw: 23, away: 19 },
  probableScore: "2 - 1",
  markets: [
    {
      label: "Résultat",
      pick: "Arsenal ou nul (1X)",
      confidence: 82,
      risk: "bas",
      rationale: "Arsenal conserve un avantage à domicile et une meilleure dynamique récente.",
    },
    {
      label: "Buts",
      pick: "Plus de 1,5 buts",
      confidence: 78,
      risk: "bas",
      rationale: "Les deux équipes produisent régulièrement des occasions franches.",
    },
    {
      label: "Équipe",
      pick: "Arsenal marque",
      confidence: 81,
      risk: "bas",
      rationale: "Le volume offensif à l'Emirates reste supérieur à la moyenne de la ligue.",
    },
    {
      label: "Mi-temps",
      pick: "Arsenal ou nul à la pause",
      confidence: 71,
      risk: "moyen",
      rationale:
        "Le pressing initial des Gunners crée davantage de situations dans le premier acte.",
    },
  ],
  aiText:
    "Arsenal arrive avec une dynamique plus régulière et un avantage structurel à domicile. Chelsea conserve des arguments en transition, mais le scénario central reste favorable aux Gunners dans un match ouvert.",
  keyFactors: [
    "Forme récente favorable à Arsenal",
    "Avantage domicile et possession attendue",
    "Historique H2H légèrement favorable",
    "Risque principal : transitions rapides de Chelsea",
  ],
};

export const DEMO_PROFILE = {
  credits: 86,
  plan: "premium" as const,
  display_name: "Dodo Bien",
  avatar_url: null,
  premium_until: "2027-08-09T23:59:59.000Z",
};

export const DEMO_HISTORY = [
  {
    id: "demo-1",
    kind: "analysis",
    amount: -3,
    balance_after: 86,
    label: "Analyse Arsenal — Chelsea",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    kind: "bonus",
    amount: 5,
    balance_after: 89,
    label: "Bonus parrainage",
    created_at: isoAt(-1, 11),
  },
  {
    id: "demo-3",
    kind: "credit",
    amount: 100,
    balance_after: 84,
    label: "Crédits Premium mensuels",
    created_at: isoAt(-4, 9),
  },
];

export const DEMO_REFERRAL = {
  code: "LIVE2026",
  referralLink: "http://localhost:5002/auth?ref=LIVE2026&demo=1",
  referralCount: 7,
  creditsEarned: 35,
  referrals: [
    { displayName: "Alex M.", joinedAt: isoAt(-2, 14) },
    { displayName: "Sarah K.", joinedAt: isoAt(-6, 10) },
  ],
};

export const DEMO_PAYMENTS = {
  payments: [
    {
      id: "payment-demo",
      trans_id: "demo_tx_2026",
      pack_id: "pack_100",
      credits: 100,
      amount_xaf: 5000,
      status: "SUCCESSFUL",
      link: null,
      created_at: isoAt(-4, 9),
    },
  ],
  subscriptions: [
    {
      id: "subscription-demo",
      trans_id: "demo_sub_2026",
      plan_id: "premium_yearly",
      amount_xaf: 25000,
      status: "SUCCESSFUL",
      current_period_end: "2027-08-09T23:59:59.000Z",
      created_at: isoAt(-4, 9),
    },
  ],
};

export const DEMO_FAVORITES = [
  { id: "fav-1", kind: "team" as const, refId: "Arsenal", label: "Arsenal", notify: true },
  { id: "fav-2", kind: "team" as const, refId: "Real Madrid", label: "Real Madrid", notify: true },
  {
    id: "fav-3",
    kind: "team" as const,
    refId: "Paris Saint-Germain",
    label: "Paris Saint-Germain",
    notify: false,
  },
];

export const DEMO_COMMUNITY_POLLS = [
  {
    id: 1,
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    homeLogo: LOGOS.arsenal,
    awayLogo: LOGOS.chelsea,
    league: "Premier League",
    votes: { home: 68, draw: 19, away: 13 },
  },
  {
    id: 2,
    homeTeam: "Real Madrid",
    awayTeam: "Atlético",
    homeLogo: LOGOS.madrid,
    awayLogo: LOGOS.atletico,
    league: "LaLiga",
    votes: { home: 61, draw: 24, away: 15 },
  },
  {
    id: 3,
    homeTeam: "Bayern",
    awayTeam: "Dortmund",
    homeLogo: LOGOS.bayern,
    awayLogo: LOGOS.dortmund,
    league: "Bundesliga",
    votes: { home: 55, draw: 21, away: 24 },
  },
];

export const DEMO_LEADERBOARD = [
  { rank: 1, name: "Momo Foot", points: 842, winRate: "78 %", badge: "Expert" },
  { rank: 2, name: "Lina Stats", points: 796, winRate: "74 %", badge: "Analyste" },
  { rank: 3, name: "Dodo Bien", points: 731, winRate: "68 %", badge: "Premium" },
];
