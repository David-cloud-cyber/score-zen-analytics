export type MatchStatus = "live" | "upcoming" | "finished" | "ht";
export type FormResult = "V" | "N" | "D";

export type MatchEvent = {
  minute: number;
  side: "home" | "away";
  type: "goal" | "yellow" | "red" | "sub" | "var";
  player: string;
  detail?: string;
};

export type MatchStats = {
  possession: [number, number];
  shots: [number, number];
  shotsOnTarget: [number, number];
  xg: [number, number];
  corners: [number, number];
  fouls: [number, number];
  yellow: [number, number];
  red: [number, number];
  passes: [number, number];
  passAccuracy: [number, number];
  offsides: [number, number];
};

export type Match = {
  id: string;
  competitionId: string;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  minute?: number;
  kickoff: string; // HH:MM
  date: string; // display
  venue: string;
  referee: string;
  events: MatchEvent[];
  stats: MatchStats;
  homeForm: FormResult[];
  awayForm: FormResult[];
};

const empty: MatchStats = {
  possession: [50, 50], shots: [0, 0], shotsOnTarget: [0, 0], xg: [0, 0],
  corners: [0, 0], fouls: [0, 0], yellow: [0, 0], red: [0, 0],
  passes: [0, 0], passAccuracy: [0, 0], offsides: [0, 0],
};

export const MATCHES: Match[] = [
  {
    id: "rma-fcb",
    competitionId: "liga",
    homeId: "rma", awayId: "fcb",
    homeScore: 2, awayScore: 1,
    status: "live", minute: 72,
    kickoff: "21:00", date: "Aujourd'hui",
    venue: "Santiago Bernabéu, Madrid",
    referee: "César Soto Grado",
    events: [
      { minute: 12, side: "home", type: "goal", player: "Vinícius Jr", detail: "Passe : Bellingham" },
      { minute: 28, side: "away", type: "yellow", player: "Pedri" },
      { minute: 34, side: "away", type: "goal", player: "Lewandowski", detail: "Passe : Yamal" },
      { minute: 55, side: "home", type: "goal", player: "Bellingham", detail: "Coup franc" },
      { minute: 63, side: "away", type: "yellow", player: "Araujo" },
      { minute: 68, side: "home", type: "sub", player: "Rodrygo → Endrick" },
    ],
    stats: {
      possession: [46, 54], shots: [14, 11], shotsOnTarget: [8, 5],
      xg: [2.14, 1.32], corners: [6, 4], fouls: [12, 14],
      yellow: [1, 3], red: [0, 0],
      passes: [412, 498], passAccuracy: [86, 89], offsides: [2, 3],
    },
    homeForm: ["V", "V", "N", "V", "V"],
    awayForm: ["D", "V", "N", "V", "D"],
  },
  {
    id: "psg-om",
    competitionId: "l1",
    homeId: "psg", awayId: "om",
    homeScore: 2, awayScore: 1,
    status: "live", minute: 72,
    kickoff: "20:45", date: "Aujourd'hui",
    venue: "Parc des Princes, Paris",
    referee: "Clément Turpin",
    events: [
      { minute: 8, side: "home", type: "goal", player: "Dembélé" },
      { minute: 25, side: "away", type: "goal", player: "Aubameyang" },
      { minute: 47, side: "home", type: "goal", player: "Barcola" },
      { minute: 60, side: "away", type: "yellow", player: "Rongier" },
    ],
    stats: {
      possession: [58, 42], shots: [12, 8], shotsOnTarget: [6, 3],
      xg: [1.82, 0.94], corners: [5, 3], fouls: [10, 13],
      yellow: [1, 2], red: [0, 0],
      passes: [521, 388], passAccuracy: [89, 82], offsides: [3, 1],
    },
    homeForm: ["V", "V", "V", "N", "V"],
    awayForm: ["N", "V", "D", "V", "N"],
  },
  {
    id: "mci-liv",
    competitionId: "pl",
    homeId: "mci", awayId: "liv",
    homeScore: 1, awayScore: 1,
    status: "live", minute: 55,
    kickoff: "17:30", date: "Aujourd'hui",
    venue: "Etihad Stadium, Manchester",
    referee: "Michael Oliver",
    events: [
      { minute: 22, side: "away", type: "goal", player: "Salah" },
      { minute: 44, side: "home", type: "goal", player: "Haaland" },
    ],
    stats: {
      possession: [62, 38], shots: [10, 6], shotsOnTarget: [4, 3],
      xg: [1.45, 0.88], corners: [7, 2], fouls: [8, 10],
      yellow: [1, 1], red: [0, 0],
      passes: [488, 302], passAccuracy: [91, 84], offsides: [1, 2],
    },
    homeForm: ["V", "N", "V", "V", "V"],
    awayForm: ["V", "V", "N", "V", "V"],
  },
  {
    id: "bay-bvb",
    competitionId: "bl",
    homeId: "bay", awayId: "bvb",
    homeScore: 3, awayScore: 0,
    status: "ht", minute: 45,
    kickoff: "18:30", date: "Aujourd'hui",
    venue: "Allianz Arena, Munich",
    referee: "Felix Zwayer",
    events: [
      { minute: 5, side: "home", type: "goal", player: "Kane" },
      { minute: 21, side: "home", type: "goal", player: "Musiala" },
      { minute: 40, side: "home", type: "goal", player: "Kane" },
    ],
    stats: empty,
    homeForm: ["V", "V", "V", "V", "V"],
    awayForm: ["D", "V", "N", "D", "V"],
  },
  {
    id: "juv-int",
    competitionId: "sa",
    homeId: "juv", awayId: "int",
    homeScore: 0, awayScore: 0,
    status: "upcoming",
    kickoff: "20:45", date: "Aujourd'hui",
    venue: "Allianz Stadium, Turin",
    referee: "Daniele Orsato",
    events: [],
    stats: empty,
    homeForm: ["V", "N", "V", "V", "N"],
    awayForm: ["V", "V", "V", "N", "V"],
  },
  {
    id: "srfc-rcl",
    competitionId: "l1",
    homeId: "sre", awayId: "rcl",
    homeScore: 0, awayScore: 0,
    status: "upcoming",
    kickoff: "19:00", date: "Aujourd'hui",
    venue: "Roazhon Park, Rennes",
    referee: "Benoît Bastien",
    events: [],
    stats: empty,
    homeForm: ["V", "D", "N", "V", "D"],
    awayForm: ["N", "V", "V", "D", "V"],
  },
  {
    id: "ars-che",
    competitionId: "pl",
    homeId: "ars", awayId: "che",
    homeScore: 0, awayScore: 0,
    status: "upcoming",
    kickoff: "21:00", date: "Aujourd'hui",
    venue: "Emirates Stadium, London",
    referee: "Anthony Taylor",
    events: [],
    stats: empty,
    homeForm: ["V", "V", "N", "V", "V"],
    awayForm: ["N", "D", "V", "V", "N"],
  },
  {
    id: "atm-por",
    competitionId: "ucl",
    homeId: "atm", awayId: "por",
    homeScore: 0, awayScore: 0,
    status: "upcoming",
    kickoff: "21:00", date: "Demain",
    venue: "Metropolitano, Madrid",
    referee: "Szymon Marciniak",
    events: [],
    stats: empty,
    homeForm: ["V", "V", "N", "D", "V"],
    awayForm: ["V", "N", "V", "V", "N"],
  },
  {
    id: "nap-mil",
    competitionId: "sa",
    homeId: "nap", awayId: "mil",
    homeScore: 2, awayScore: 2,
    status: "finished",
    kickoff: "20:45", date: "Hier",
    venue: "Diego Armando Maradona, Naples",
    referee: "Marco Guida",
    events: [
      { minute: 14, side: "home", type: "goal", player: "Kvaratskhelia" },
      { minute: 33, side: "away", type: "goal", player: "Leão" },
      { minute: 58, side: "home", type: "goal", player: "Osimhen" },
      { minute: 89, side: "away", type: "goal", player: "Giroud" },
    ],
    stats: {
      possession: [51, 49], shots: [15, 12], shotsOnTarget: [7, 6],
      xg: [1.98, 1.72], corners: [6, 5], fouls: [12, 11],
      yellow: [2, 2], red: [0, 0],
      passes: [452, 431], passAccuracy: [85, 84], offsides: [2, 3],
    },
    homeForm: ["N", "V", "V", "N", "V"],
    awayForm: ["V", "D", "N", "V", "V"],
  },
  {
    id: "lev-rbl",
    competitionId: "bl",
    homeId: "lev", awayId: "rbl",
    homeScore: 3, awayScore: 1,
    status: "finished",
    kickoff: "17:30", date: "Hier",
    venue: "BayArena, Leverkusen",
    referee: "Sascha Stegemann",
    events: [
      { minute: 10, side: "home", type: "goal", player: "Wirtz" },
      { minute: 44, side: "home", type: "goal", player: "Boniface" },
      { minute: 61, side: "away", type: "goal", player: "Openda" },
      { minute: 78, side: "home", type: "goal", player: "Grimaldo" },
    ],
    stats: empty,
    homeForm: ["V", "V", "V", "N", "V"],
    awayForm: ["V", "N", "D", "V", "N"],
  },
  {
    id: "mun-tot",
    competitionId: "pl",
    homeId: "mun", awayId: "tot",
    homeScore: 1, awayScore: 2,
    status: "finished",
    kickoff: "18:30", date: "Hier",
    venue: "Old Trafford, Manchester",
    referee: "Simon Hooper",
    events: [
      { minute: 18, side: "away", type: "goal", player: "Son" },
      { minute: 52, side: "home", type: "goal", player: "Rashford" },
      { minute: 82, side: "away", type: "goal", player: "Kulusevski" },
    ],
    stats: empty,
    homeForm: ["D", "V", "N", "D", "V"],
    awayForm: ["V", "V", "N", "V", "V"],
  },
  {
    id: "ol-losc",
    competitionId: "l1",
    homeId: "ol", awayId: "losc",
    homeScore: 1, awayScore: 1,
    status: "finished",
    kickoff: "20:45", date: "Hier",
    venue: "Groupama Stadium, Lyon",
    referee: "Willy Delajod",
    events: [
      { minute: 22, side: "home", type: "goal", player: "Lacazette" },
      { minute: 74, side: "away", type: "goal", player: "David" },
    ],
    stats: empty,
    homeForm: ["N", "V", "D", "V", "N"],
    awayForm: ["V", "N", "V", "D", "V"],
  },
];

export function matchById(id: string): Match | undefined {
  return MATCHES.find((m) => m.id === id);
}
