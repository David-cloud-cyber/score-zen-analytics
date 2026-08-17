import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { apiFootball, todayISO } from "@/lib/apifootball.server";
import type { Database, Json } from "@/integrations/supabase/types";
import { isPremiumActive } from "@/lib/premium-status";
import {
  buildSummary,
  settlePredictionRows,
  toItem,
  type PredictionHistoryItem,
  type PredictionHistorySummary,
  type RawAnalysisRow,
} from "@/lib/prediction-history.functions";

type FavoriteKind = Database["public"]["Enums"]["favorite_kind"];

export type HubFavorite = {
  id: string;
  kind: FavoriteKind;
  refId: string;
  label: string | null;
  notify: boolean;
};

export type HubAlert = {
  id: string;
  kind: "value" | "start" | "match" | "system";
  title: string;
  message: string;
  time: string;
  read: boolean;
  fixtureId?: string;
};

export type RadarOpportunity = {
  fixtureId: string;
  kickoff: string;
  league: string;
  home: { name: string; logo: string };
  away: { name: string; logo: string };
  pick: string;
  market: string;
  probability: number;
  impliedProbability: number | null;
  odd: number | null;
  edge: number | null;
  confidence: number;
  risk: "bas" | "moyen" | "eleve";
  reason: string;
  factors: string[];
};

export type HubScorecard = {
  totalAnalyses: number;
  settledAnalyses: number;
  hitRate: number | null;
  theoreticalRoi: number | null;
  favoriteMarket: string | null;
  favoriteTeam: string | null;
};

export type PremiumHubData = {
  isPremium: boolean;
  profile: { credits: number; plan: "free" | "premium"; premiumUntil: string | null };
  radar: RadarOpportunity[];
  alerts: HubAlert[];
  favorites: HubFavorite[];
  scorecard: HubScorecard;
  recentPredictions: PredictionHistoryItem[];
  historySummary: PredictionHistorySummary;
  fetchedAt: string;
  warning: string | null;
};

type Fixture = {
  fixture: { id: number; date: string; status: { short: string } };
  league: { name: string };
  teams: {
    home: { name: string; logo: string };
    away: { name: string; logo: string };
  };
};

type Prediction = {
  predictions?: {
    percent?: { home?: string; draw?: string; away?: string };
    advice?: string | null;
  };
};

type OddsResponse = {
  bookmakers?: Array<{
    bets?: Array<{
      name: string;
      values?: Array<{ value: string; odd: string }>;
    }>;
  }>;
};

type Selection = "home" | "draw" | "away";

const radarCache = new Map<string, { at: number; data: RadarOpportunity[] }>();
const RADAR_CACHE_TTL = 90_000;

function asRecord(value: Json | undefined): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Json>) : {};
}

function asNumber(value: Json | undefined): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function parsePercent(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace("%", "").trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

function normalize(values: Record<Selection, number>): Record<Selection, number> {
  const total = values.home + values.draw + values.away;
  if (!total) return { home: 33, draw: 34, away: 33 };
  return {
    home: Math.round((values.home / total) * 100),
    draw: Math.round((values.draw / total) * 100),
    away: 100 - Math.round((values.home / total) * 100) - Math.round((values.draw / total) * 100),
  };
}

function parseAverageOdds(data: OddsResponse | undefined): Record<Selection, number | null> {
  const values: Record<Selection, number[]> = { home: [], draw: [], away: [] };
  for (const bookmaker of data?.bookmakers ?? []) {
    const winner = bookmaker.bets?.find((bet) => /match winner/i.test(bet.name));
    for (const item of winner?.values ?? []) {
      const value = item.value.toLowerCase();
      const selection = value === "home" ? "home" : value === "draw" ? "draw" : value === "away" ? "away" : null;
      const odd = Number(item.odd);
      if (selection && Number.isFinite(odd) && odd > 1) values[selection].push(odd);
    }
  }
  return {
    home: values.home.length ? values.home.reduce((a, b) => a + b, 0) / values.home.length : null,
    draw: values.draw.length ? values.draw.reduce((a, b) => a + b, 0) / values.draw.length : null,
    away: values.away.length ? values.away.reduce((a, b) => a + b, 0) / values.away.length : null,
  };
}

function selectionLabel(selection: Selection, fixture: Fixture): string {
  if (selection === "home") return fixture.teams.home.name;
  if (selection === "away") return fixture.teams.away.name;
  return "Match nul";
}

function riskFor(edge: number | null, confidence: number): RadarOpportunity["risk"] {
  if (edge !== null && edge >= 5 && confidence >= 65) return "bas";
  if (edge !== null && edge >= 2 && confidence >= 55) return "moyen";
  return "eleve";
}

async function getRadar(): Promise<{ radar: RadarOpportunity[]; warning: string | null }> {
  const key = todayISO();
  const cached = radarCache.get(key);
  if (cached && Date.now() - cached.at < RADAR_CACHE_TTL) return { radar: cached.data, warning: null };

  try {
    const fixtures = await apiFootball<Fixture[]>("/fixtures", { date: key });
    const upcoming = fixtures
      .filter((fixture) => !["FT", "AET", "PEN", "AWD", "WO"].includes(fixture.fixture.status.short))
      .sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())
      .slice(0, 6);

    const radar = (await Promise.all(
      upcoming.map(async (fixture): Promise<RadarOpportunity | null> => {
        const [predictionResponse, oddsResponse] = await Promise.all([
          apiFootball<Prediction[]>("/predictions", { fixture: fixture.fixture.id }).catch(() => []),
          apiFootball<OddsResponse[]>("/odds", { fixture: fixture.fixture.id, bet: 1 }).catch(() => []),
        ]);
        const percent = predictionResponse[0]?.predictions?.percent;
        const modelValues = {
          home: parsePercent(percent?.home),
          draw: parsePercent(percent?.draw),
          away: parsePercent(percent?.away),
        };
        if (modelValues.home === null || modelValues.draw === null || modelValues.away === null) return null;

        const probabilities = normalize({ home: modelValues.home, draw: modelValues.draw, away: modelValues.away });
        const odds = parseAverageOdds(oddsResponse[0]);
        const selection = (Object.entries(probabilities) as [Selection, number][]).sort((a, b) => b[1] - a[1])[0][0];
        const odd = odds[selection];
        const impliedProbability = odd ? Math.round((1 / odd) * 100) : null;
        const edge = impliedProbability === null ? null : probabilities[selection] - impliedProbability;
        const confidence = Math.min(85, Math.max(45, Math.round(probabilities[selection] * 0.72 + 20)));
        const pick = selectionLabel(selection, fixture);
        const advice = predictionResponse[0]?.predictions?.advice;

        return {
          fixtureId: String(fixture.fixture.id),
          kickoff: fixture.fixture.date,
          league: fixture.league.name,
          home: fixture.teams.home,
          away: fixture.teams.away,
          pick,
          market: "1X2",
          probability: probabilities[selection],
          impliedProbability,
          odd: odd ? Number(odd.toFixed(2)) : null,
          edge,
          confidence,
          risk: riskFor(edge, confidence),
          reason:
            advice ||
            (edge === null
              ? `Projection ${probabilities[selection]}% sur ${pick}. Cote indisponible pour calculer l'écart.`
              : `Projection ${probabilities[selection]}% contre ${impliedProbability}% implicites, soit ${edge >= 0 ? "+" : ""}${edge} points.`),
          factors: [
            `Probabilité Livefoot : ${probabilities[selection]}%`,
            odd ? `Cote moyenne : ${odd.toFixed(2)}` : "Cote non disponible",
            impliedProbability === null ? "Écart statistique à confirmer" : `Écart statistique : ${edge! >= 0 ? "+" : ""}${edge} pts`,
          ],
        };
      }),
    )).filter((item): item is RadarOpportunity => Boolean(item));

    radar.sort((a, b) => (b.edge ?? -100) - (a.edge ?? -100));
    radarCache.set(key, { at: Date.now(), data: radar });
    return { radar, warning: radar.length ? null : "Les projections ou les cotes ne sont pas disponibles pour les matchs du jour." };
  } catch (error) {
    console.warn("Premium radar unavailable:", error instanceof Error ? error.message : error);
    return { radar: [], warning: "Le radar est momentanément indisponible. Les matchs restent accessibles depuis Analyse." };
  }
}

function buildScorecard(
  rows: Array<{ home_team: string; away_team: string; result: Json }>,
  summary: PredictionHistorySummary,
): HubScorecard {
  const marketCount = new Map<string, number>();
  const teamCount = new Map<string, number>();
  for (const row of rows) {
    const record = asRecord(row.result);
    const firstMarket = Array.isArray(record.markets) ? asRecord(record.markets[0]) : {};
    const market = typeof firstMarket.label === "string" ? firstMarket.label : "1X2";
    marketCount.set(market, (marketCount.get(market) ?? 0) + 1);
    teamCount.set(row.home_team, (teamCount.get(row.home_team) ?? 0) + 1);
    teamCount.set(row.away_team, (teamCount.get(row.away_team) ?? 0) + 1);
  }
  const top = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    totalAnalyses: rows.length,
    settledAnalyses: summary.settled,
    hitRate: summary.hitRate,
    theoreticalRoi: summary.theoreticalRoi,
    favoriteMarket: top(marketCount),
    favoriteTeam: top(teamCount),
  };
}

function buildAlerts(radar: RadarOpportunity[], favorites: HubFavorite[]): HubAlert[] {
  const followed = new Set(favorites.filter((item) => item.notify).map((item) => item.refId.toLowerCase()));
  const alerts: HubAlert[] = [];
  for (const opportunity of radar) {
    const followedMatch = followed.has(opportunity.home.name.toLowerCase()) || followed.has(opportunity.away.name.toLowerCase());
    if (followedMatch) {
      alerts.push({
        id: `start-${opportunity.fixtureId}`,
        kind: "start",
        title: "Match suivi aujourd'hui",
        message: `${opportunity.home.name} – ${opportunity.away.name} · projection ${opportunity.probability}% sur ${opportunity.pick}.`,
        time: opportunity.kickoff,
        read: false,
        fixtureId: opportunity.fixtureId,
      });
    }
    if ((opportunity.edge ?? 0) >= 5) {
      alerts.push({
        id: `value-${opportunity.fixtureId}`,
        kind: "value",
        title: "Écart statistique détecté",
        message: `${opportunity.pick} présente un écart de +${opportunity.edge} points par rapport à la probabilité implicite.`,
        time: opportunity.kickoff,
        read: false,
        fixtureId: opportunity.fixtureId,
      });
    }
  }
  return alerts.slice(0, 8);
}

export const getPremiumDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PremiumHubData> => {
    try {
      const { ensureVipMonthlyCredits } = await import("@/lib/vip.functions");
      await ensureVipMonthlyCredits(context.userId);
    } catch {
      // A credit-cycle refresh must never prevent the Premium dashboard from opening.
    }
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("credits, plan, premium_until")
      .eq("id", context.userId)
      .maybeSingle();
    const safeProfile = profile ?? { credits: 0, plan: "free" as const, premium_until: null };
    const isPremium = isPremiumActive({ plan: safeProfile.plan, premium_until: safeProfile.premium_until });

    const { data: favoriteRows } = await context.supabase
      .from("favorites")
      .select("id, kind, ref_id, label, notify")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(isPremium ? 100 : 3);
    const favorites: HubFavorite[] = (favoriteRows ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      refId: row.ref_id,
      label: row.label,
      notify: row.notify,
    }));

    if (!isPremium) {
      return {
        isPremium,
        profile: { credits: safeProfile.credits, plan: safeProfile.plan, premiumUntil: safeProfile.premium_until },
        radar: [],
        alerts: [],
        favorites,
        scorecard: { totalAnalyses: 0, settledAnalyses: 0, hitRate: null, theoreticalRoi: null, favoriteMarket: null, favoriteTeam: null },
        recentPredictions: [],
        historySummary: buildSummary([]),
        fetchedAt: new Date().toISOString(),
        warning: null,
      };
    }

    const { data: analysisRows } = await context.supabase
      .from("ai_analyses")
      .select("id, home_team, away_team, match_id, result, created_at, prediction_market, prediction_pick, prediction_confidence, prediction_odd, settlement_status, settlement_outcome, final_score, settled_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = (analysisRows ?? []) as RawAnalysisRow[];
    const settlementUpdates = await settlePredictionRows(rows);
    const historyItems = rows.map((row) => toItem(row, settlementUpdates.get(row.id)));
    const historySummary = buildSummary(historyItems);
    const radarResult = await getRadar();

    return {
      isPremium,
      profile: { credits: safeProfile.credits, plan: safeProfile.plan, premiumUntil: safeProfile.premium_until },
      radar: radarResult.radar,
      alerts: buildAlerts(radarResult.radar, favorites),
      favorites,
      scorecard: buildScorecard(rows, historySummary),
      recentPredictions: historyItems.slice(0, 5),
      historySummary,
      fetchedAt: new Date().toISOString(),
      warning: radarResult.warning,
    };
  });

export const togglePremiumFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        kind: z.enum(["team", "competition", "match"]),
        refId: z.string().min(1).max(120),
        label: z.string().min(1).max(120),
        notify: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("favorites")
      .select("id")
      .eq("user_id", context.userId)
      .eq("kind", data.kind)
      .eq("ref_id", data.refId)
      .maybeSingle();
    if (existing) {
      await context.supabase.from("favorites").delete().eq("id", existing.id).eq("user_id", context.userId);
      return { active: false };
    }

    const { data: profile } = await context.supabase.from("profiles").select("plan, premium_until").eq("id", context.userId).maybeSingle();
    const { count } = await context.supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", context.userId);
    if (!isPremiumActive(profile) && (count ?? 0) >= 3) {
      throw new Error("Les comptes gratuits sont limités à 3 favoris. Passez Premium pour débloquer le suivi illimité.");
    }
    const { error } = await context.supabase.from("favorites").insert({
      user_id: context.userId,
      kind: data.kind,
      ref_id: data.refId,
      label: data.label,
      notify: data.notify,
    });
    if (error) throw new Error("Impossible d'enregistrer ce favori.");
    return { active: true };
  });

export const setPremiumFavoriteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ favoriteId: z.string().uuid(), notify: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("favorites")
      .update({ notify: data.notify })
      .eq("id", data.favoriteId)
      .eq("user_id", context.userId);
    if (error) throw new Error("Impossible de modifier cette alerte.");
    return { ok: true };
  });

export const getMyPremiumFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HubFavorite[]> => {
    const { data } = await context.supabase
      .from("favorites")
      .select("id, kind, ref_id, label, notify")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((row) => ({ id: row.id, kind: row.kind, refId: row.ref_id, label: row.label, notify: row.notify }));
  });
