import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { isPremiumActive } from "./premium-status";
import type {
  DailyPredictionItem,
  DailyPredictionsAccess,
  DailyPredictionsPayload,
  PublicPredictionHistoryPayload,
} from "./daily-predictions.types";

const FREE_DAILY_LIMIT = 3;

async function optionalDailyPredictionsAccess(
  accessToken?: string,
): Promise<DailyPredictionsAccess> {
  try {
    const request = getRequest();
    const token =
      accessToken ?? request?.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token || token.split(".").length !== 3) return "visitor";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (!data.user) return "visitor";
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, premium_until")
      .eq("id", data.user.id)
      .maybeSingle();
    return isPremiumActive(profile ?? null) ? "premium" : "free";
  } catch {
    return "visitor";
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
    confidence: locked ? null : Number(row.confidence),
    risk: locked ? null : row.risk === "bas" || row.risk === "eleve" ? row.risk : "moyen",
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

// This is a POST server function even though it only reads data: authenticated
// browser calls carry the short lived access token in the request body, never
// in a GET URL, cache key, or analytics event.
export const getDailyPredictions = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({ accessToken: z.string().min(20).optional() })
      .optional()
      .parse,
  )
  .handler(
  async ({ data }): Promise<DailyPredictionsPayload> => {
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
    const [rows, access] = await Promise.all([
      readDailyRows().catch(() => []),
      optionalDailyPredictionsAccess(data?.accessToken),
    ]);
    const visibleRows = access === "premium" ? rows : rows.slice(0, FREE_DAILY_LIMIT);
    const items = visibleRows.map((row) => toItem(row, access === "visitor"));
    return {
      date: dateInDouala(),
      isPremium: access === "premium",
      access,
      freeLimit: FREE_DAILY_LIMIT,
      availableCount: rows.length,
      items,
      generatedAt: rows[0]?.source_fetched_at ?? null,
      state: items.length
        ? access === "premium" || access === "free"
          ? "ready"
          : "limited"
        : "empty",
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
