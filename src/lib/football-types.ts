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

export type ApiEvent = {
  minute: number;
  side: "home" | "away";
  type: "goal" | "yellow" | "red" | "sub" | "var";
  player: string;
  detail?: string;
};

export type ApiStatsPair = { home: number; away: number };

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

export type RemoteMatchDetail = RemoteMatchSummary & {
  events: ApiEvent[];
  stats: ApiStats;
  lineups: { home: ApiLineup | null; away: ApiLineup | null };
  h2h: ApiH2H[];
};
