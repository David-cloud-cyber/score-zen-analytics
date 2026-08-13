// Shared types (browser-safe) for API-Football derived data.
export type ApiStatus = "live" | "upcoming" | "finished" | "ht";

export type ApiTeamRef = {
  id: number;
  name: string;
  short: string;
  logo: string;
};

export type ApiLeagueRef = {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string | null;
  season: number;
  round?: string;
};

export type RemoteMatchSummary = {
  id: number;
  /** Marque interne calculée côté serveur pour la carte Trending. */
  isTrending?: boolean;
  status: ApiStatus;
  statusShort: string;
  minute: number | null;
  kickoff: string; // ISO
  timeLabel: string; // HH:MM (local)
  dayLabel: string; // Aujourd'hui / Demain / DD/MM
  home: ApiTeamRef;
  away: ApiTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  league: ApiLeagueRef;
  venue: string | null;
};

export type FixturesPayload = {
  matches: RemoteMatchSummary[];
  source: "live" | "api" | "cache";
  state: "fresh" | "stale" | "unavailable";
  fetchedAt: string | null;
  cacheId: string | null;
  errorCode?: "rate_limit" | "network" | "server" | "unauthorized" | "payload" | "empty";
  retryAfterMs?: number;
};

export type ApiEvent = {
  minute: number;
  side: "home" | "away";
  type: "goal" | "yellow" | "red" | "sub" | "var";
  player: string;
  detail?: string;
};

export type ApiStatsPair = { home: number | null; away: number | null };

export type ApiStats = {
  possession: ApiStatsPair;
  shots: ApiStatsPair;
  shotsOnTarget: ApiStatsPair;
  xg: ApiStatsPair;
  corners: ApiStatsPair;
  fouls: ApiStatsPair;
  yellow: ApiStatsPair;
  red: ApiStatsPair;
  passAccuracy: ApiStatsPair;
  offsides: ApiStatsPair;
};

export type ApiLineupPlayer = {
  number: number;
  name: string;
  position: string;
};

export type ApiLineup = {
  formation: string;
  coach: string;
  color: string;
  players: ApiLineupPlayer[];
};

export type ApiH2H = {
  id: number;
  date: string;
  competition: string;
  home: string;
  away: string;
  score: string;
};

export type ApiOddsSnapshot = {
  home: number | null;
  draw: number | null;
  away: number | null;
  bookmakers: number;
  updatedAt: string | null;
};

export type ApiPredictionSnapshot = {
  home: number | null;
  draw: number | null;
  away: number | null;
  winner: "home" | "away" | null;
  winnerName: string | null;
  advice: string | null;
  underOver: string | null;
};

export type ApiInjury = {
  playerId: number;
  name: string;
  photo: string;
  reason: string;
  type: string;
  teamId: number;
};

export type RemoteMatchDetail = RemoteMatchSummary & {
  meta?: {
    fetchedAt: string;
    stale: boolean;
    unavailableSections: string[];
  };
  events: ApiEvent[];
  stats: ApiStats;
  lineups: { home: ApiLineup | null; away: ApiLineup | null };
  h2h: ApiH2H[];
  odds: ApiOddsSnapshot | null;
  prediction: ApiPredictionSnapshot | null;
  injuries: { home: ApiInjury[]; away: ApiInjury[] };
};
