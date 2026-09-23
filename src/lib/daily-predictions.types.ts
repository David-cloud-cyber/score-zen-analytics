export type DailyPredictionStatus = "pending" | "won" | "lost" | "unresolvable";
export type DailyPredictionsAccess = "visitor" | "free" | "premium";

export type DailyPredictionItem = {
  id: string;
  fixtureId: number;
  date: string;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  leagueId: number;
  leagueName: string;
  leagueLogo: string | null;
  marketKey: "1X2" | "double_chance";
  marketLabel: string;
  pick: string | null;
  probability: number | null;
  confidence: number | null;
  risk: "bas" | "moyen" | "eleve" | null;
  rationale: string | null;
  factors: string[];
  status: DailyPredictionStatus;
  finalScore: string | null;
  settledAt: string | null;
  sourceFetchedAt: string;
  locked: boolean;
};

export type DailyPredictionsPayload = {
  date: string;
  isPremium: boolean;
  access: DailyPredictionsAccess;
  freeLimit: number;
  availableCount: number;
  items: DailyPredictionItem[];
  generatedAt: string | null;
  state: "ready" | "limited" | "empty";
};

export type PublicPredictionHistoryPayload = {
  items: DailyPredictionItem[];
  summary: {
    total: number;
    settled: number;
    won: number;
    lost: number;
    pending: number;
    hitRate: number | null;
  };
};
