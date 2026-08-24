import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { isPremiumActive } from "./premium-status";
import type {
  DailyPredictionItem,
  DailyPredictionsPayload,
  PublicPredictionHistoryPayload,
} from "./daily-predictions.types";

const FREE_DAILY_LIMIT = 2;

async function optionalPremiumStatus() {
  try {
    const request = getRequest();
    const token = request?.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token || token.split(".").length !== 3) return false;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (!data.user) return false;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, premium_until")
      .eq("id", data.user.id)
      .maybeSingle();
    return isPremiumActive(profile ?? null);
  } catch {
    return false;
  }
}

function toItem(row: any, locked: boolean): DailyPredictionItem {
  return {
    id: String(row.id),
    fixtureId: Number(row.fixture_id),
    date: String(row.prediction_date),
    kickoff: String(row.kickoff),
    homeTeam: String(row.home_team),
    awayTeam: String(row.away_team),
    homeLogo: row.home_logo ? String(row.home_logo) : null,
    awayLogo: row.away_logo ? String(row.away_logo) : null,
    leagueId: Number(row.league_id),
    leagueName: String(row.league_name),
    leagueLogo: row.league_logo ? String(row.league_logo) : null,
    marketKey: row.market_key === "double_chance" ? "double_chance" : "1X2",
    marketLabel: String(row.market_label),
    pick: locked ? null : String(row.pick),
    probability: locked ? null : Number(row.probability),
    confidence: Number(row.confidence),
    risk: row.risk === "bas" || row.risk === "eleve" ? row.risk : "moyen",
    rationale: locked ? null : String(row.rationale),
    factors: locked ? [] : Array.isArray(row.factors) ? row.factors.map(String).slice(0, 4) : [],
    status:
      row.status === "won" || row.status === "lost" || row.status === "unresolvable"
        ? row.status
        : "pending",
    finalScore: row.final_score ? String(row.final_score) : null,
    settledAt: row.settled_at ? String(row.settled_at) : null,
    sourceFetchedAt: String(row.source_fetched_at),
    locked,
  };
}

export const getDailyPredictions = createServerFn({ method: "GET" }).handler(
  async (): Promise<DailyPredictionsPayload> => {
    const { ensureDailyPredictionsDeduped, readDailyRows, dateInDouala } =
      await import("./daily-predictions.server");
    try {
      await ensureDailyPredictionsDeduped();
    } catch (error) {
      console.warn(
        "Daily predictions refresh unavailable:",
        error instanceof Error ? error.message : error,
      );
    }
    const [rows, isPremium] = await Promise.all([
      readDailyRows().catch(() => []),
      optionalPremiumStatus(),
    ]);
    const items = rows.map((row, index) => toItem(row, !isPremium && index >= FREE_DAILY_LIMIT));
    return {
      date: dateInDouala(),
      isPremium,
      freeLimit: FREE_DAILY_LIMIT,
      items,
      generatedAt: rows[0]?.source_fetched_at ?? null,
      state: items.length ? (items.some((item) => item.locked) ? "limited" : "ready") : "empty",
    };
  },
);

export const getPublicPredictionHistory = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPredictionHistoryPayload> => {
    const { ensureDailyPredictionsDeduped, readPublicHistoryRows } =
      await import("./daily-predictions.server");
    await ensureDailyPredictionsDeduped().catch(() => undefined);
    const rows = (await readPublicHistoryRows().catch(() => [])).filter(
      (row) => row.status !== "pending",
    );
    const items = rows.map((row) => toItem(row, false));
    const won = items.filter((item) => item.status === "won").length;
    const lost = items.filter((item) => item.status === "lost").length;
    const settled = won + lost;
    return {
      items,
      summary: {
        total: items.length,
        settled,
        won,
        lost,
        pending: 0,
        hitRate: settled ? Math.round((won / settled) * 100) : null,
      },
    };
  },
);
