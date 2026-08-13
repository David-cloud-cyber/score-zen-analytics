import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isPremiumActive } from "@/lib/premium-status";
import { apiFootball } from "@/lib/apifootball.server";

export type PredictionHistoryStatus = "pending" | "won" | "lost" | "unresolvable";
export type PredictionHistoryMarket = "1X2" | "double_chance" | "btts" | "total_goals" | "unsupported";

export type PredictionHistoryMarketRow = {
  label: string;
  pick: string;
  confidence: number | null;
  risk: "bas" | "moyen" | "eleve" | null;
  rationale: string;
};

export type PredictionHistoryItem = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  matchId: string | null;
  createdAt: string;
  market: PredictionHistoryMarket;
  marketLabel: string;
  pick: string;
  confidence: number | null;
  odd: number | null;
  probabilities: { home: number | null; draw: number | null; away: number | null };
  probableScore: string | null;
  markets: PredictionHistoryMarketRow[];
  status: PredictionHistoryStatus;
  outcome: string | null;
  finalScore: string | null;
  settledAt: string | null;
};

export type PredictionHistorySummary = {
  total: number;
  settled: number;
  won: number;
  lost: number;
  pending: number;
  unresolvable: number;
  hitRate: number | null;
  theoreticalRoi: number | null;
};

export type PredictionHistoryData = {
  isPremium: boolean;
  items: PredictionHistoryItem[];
  summary: PredictionHistorySummary;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  filters: { status: string; market: string; team: string; period: string };
  warning: string | null;
};

export type RawAnalysisRow = {
  id: string;
  home_team: string;
  away_team: string;
  match_id: string | null;
  result: Json;
  created_at: string;
  prediction_market?: string | null;
  prediction_pick?: string | null;
  prediction_confidence?: number | null;
  prediction_odd?: number | null;
  settlement_status?: PredictionHistoryStatus | null;
  settlement_outcome?: string | null;
  final_score?: string | null;
  settled_at?: string | null;
};

type FixtureForSettlement = {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
};

type SupabaseDbClient = SupabaseClient<Database>;

const historyInput = z.object({
  page: z.number().int().min(1).max(1000).default(1),
  pageSize: z.number().int().min(5).max(50).default(20),
  status: z.enum(["all", "pending", "won", "lost", "unresolvable"]).default("all"),
  market: z.enum(["all", "1X2", "double_chance", "btts", "total_goals", "unsupported"]).default("all"),
  team: z.string().trim().max(80).default(""),
  period: z.enum(["all", "7d", "30d", "90d"]).default("all"),
});

function asRecord(value: Json | undefined): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Json>) : {};
}

function asArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: Json | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: Json | undefined): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeMarket(label: string): PredictionHistoryMarket {
  const value = normalizeText(label);
  if (value.includes("double")) return "double_chance";
  if (value.includes("deux") || value.includes("btts") || value.includes("marquent")) return "btts";
  if (value.includes("total") || value.includes("but")) return "total_goals";
  if (value.includes("issue") || value.includes("1x2") || value.includes("match")) return "1X2";
  return "unsupported";
}

function readMarkets(result: Json): PredictionHistoryMarketRow[] {
  return asArray(asRecord(result).markets).map((value) => {
    const item = asRecord(value);
    const confidence = asNumber(item.confidence);
    const risk = asText(item.risk);
    return {
      label: asText(item.label) ?? "Marché",
      pick: asText(item.pick) ?? "Projection indisponible",
      confidence,
      risk: risk === "bas" || risk === "moyen" || risk === "eleve" ? risk : null,
      rationale: asText(item.rationale) ?? "Aucune explication enregistrée.",
    };
  });
}

function primaryMarket(result: Json) {
  const first = readMarkets(result)[0];
  return {
    market: normalizeMarket(first?.label ?? ""),
    marketLabel: first?.label ?? "Issue du match",
    pick: first?.pick ?? "Projection indisponible",
    confidence: first?.confidence ?? null,
    odd: first ? asNumber(asRecord(first as unknown as Json).odd) : null,
  };
}

function probabilities(result: Json) {
  const values = asRecord(asRecord(result).probabilities);
  return { home: asNumber(values.home), draw: asNumber(values.draw), away: asNumber(values.away) };
}

function inferOutcome(goals: { home: number; away: number }) {
  return goals.home > goals.away ? "home" : goals.home < goals.away ? "away" : "draw";
}

function classifySelection(item: PredictionHistoryItem):
  | "home"
  | "away"
  | "draw"
  | "home_or_draw"
  | "away_or_draw"
  | "btts_yes"
  | "btts_no"
  | { total: number; over: boolean }
  | null {
  const pick = normalizeText(item.pick);
  const home = normalizeText(item.homeTeam);
  const away = normalizeText(item.awayTeam);
  if (item.market === "1X2") {
    if (pick.includes(home) || pick.includes("domicile")) return "home";
    if (pick.includes(away) || pick.includes("exterieur")) return "away";
    if (pick.includes("nul") || pick.includes("draw")) return "draw";
    const values = item.probabilities;
    if (values.home !== null && values.away !== null && values.draw !== null) {
      if (values.home >= values.away && values.home >= values.draw) return "home";
      if (values.away >= values.home && values.away >= values.draw) return "away";
      return "draw";
    }
    return null;
  }
  if (item.market === "double_chance") {
    if (pick.includes(home) || pick.includes("domicile")) return "home_or_draw";
    if (pick.includes(away) || pick.includes("exterieur")) return "away_or_draw";
    return null;
  }
  if (item.market === "btts") return pick.includes("oui") || pick.includes("yes") ? "btts_yes" : pick.includes("non") || pick.includes("no") ? "btts_no" : null;
  if (item.market === "total_goals") {
    const threshold = pick.match(/(\d+(?:[.,]\d+)?)/)?.[1];
    if (!threshold) return null;
    return { total: Number(threshold.replace(",", ".")), over: pick.includes("plus") || pick.includes("over") };
  }
  return null;
}

function settleSelection(item: PredictionHistoryItem, goals: { home: number; away: number }) {
  const selection = classifySelection(item);
  if (!selection) return null;
  const outcome = inferOutcome(goals);
  const total = goals.home + goals.away;
  const btts = goals.home > 0 && goals.away > 0;
  const hit = typeof selection === "string"
    ? selection === outcome || (selection === "home_or_draw" && outcome !== "away") || (selection === "away_or_draw" && outcome !== "home") || (selection === "btts_yes" && btts) || (selection === "btts_no" && !btts)
    : selection.over ? total > selection.total : total < selection.total;
  return { status: hit ? "won" as const : "lost" as const, outcome, hit, score: `${goals.home}-${goals.away}` };
}

function settlementFromResult(result: Json) {
  const settlement = asRecord(asRecord(result)._settlement);
  const status = asText(settlement.status);
  if (status === "unresolvable") {
    return {
      status,
      outcome: asText(settlement.outcome),
      finalScore: asText(settlement.score),
      settledAt: asText(settlement.settledAt),
    } as const;
  }
  if (typeof settlement.hit !== "boolean") return null;
  return {
    status: settlement.hit ? "won" as const : "lost" as const,
    outcome: asText(settlement.outcome),
    finalScore: asText(settlement.score),
    settledAt: asText(settlement.settledAt),
  };
}

function toItem(row: RawAnalysisRow, settlement?: Partial<PredictionHistoryItem>): PredictionHistoryItem {
  const result = row.result;
  const primary = primaryMarket(result);
  const probabilitiesValue = probabilities(result);
  const existing = settlementFromResult(result);
  return {
    id: row.id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    matchId: row.match_id,
    createdAt: row.created_at,
    market: row.prediction_market ? normalizeMarket(row.prediction_market) : primary.market,
    marketLabel: row.prediction_market ?? primary.marketLabel,
    pick: row.prediction_pick ?? primary.pick,
    confidence: row.prediction_confidence ?? primary.confidence,
    odd: row.prediction_odd ?? primary.odd,
    probabilities: probabilitiesValue,
    probableScore: asText(asRecord(result).probableScore),
    markets: readMarkets(result),
    status: row.settlement_status && row.settlement_status !== "pending" ? row.settlement_status : existing?.status ?? "pending",
    outcome: row.settlement_outcome ?? existing?.outcome ?? null,
    finalScore: row.final_score ?? existing?.finalScore ?? null,
    settledAt: row.settled_at ?? existing?.settledAt ?? null,
    ...settlement,
  };
}

function isUnresolvableStatus(status: string) {
  return ["CANC", "PST", "ABD", "AWD", "WO"].includes(status);
}

export async function settlePredictionRows(rows: RawAnalysisRow[]): Promise<Map<string, Partial<PredictionHistoryItem>>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const updates = new Map<string, Partial<PredictionHistoryItem>>();
  const candidates = rows
    .filter((row) => (row.settlement_status === undefined || row.settlement_status === null || row.settlement_status === "pending") && !settlementFromResult(row.result) && row.match_id && /^\d+$/.test(row.match_id))
    .slice(0, 30);

  for (const row of candidates) {
    try {
      const fixture = (await apiFootball<FixtureForSettlement[]>("/fixtures", { id: row.match_id! }))[0];
      if (!fixture) continue;
      const status = fixture.fixture.status.short;
      if (!isUnresolvableStatus(status) && !["FT", "AET", "PEN"].includes(status)) continue;
      const existingItem = toItem(row);
      const goals = fixture.goals;
      const settlement = isUnresolvableStatus(status) || goals.home === null || goals.away === null
        ? { status: "unresolvable" as const, outcome: null, finalScore: null, settledAt: new Date().toISOString() }
        : settleSelection(existingItem, { home: goals.home, away: goals.away });
      if (!settlement) {
        const fallback = { status: "unresolvable" as const, outcome: null, finalScore: `${goals.home}-${goals.away}`, settledAt: new Date().toISOString() };
        updates.set(row.id, fallback);
        await supabaseAdmin.from("ai_analyses").update({ result: { ...asRecord(row.result), _settlement: { ...fallback, hit: null, status: "unresolvable", market: existingItem.market } } }).eq("id", row.id);
        continue;
      }
      const update = {
        ...settlement,
        finalScore: "finalScore" in settlement && settlement.finalScore
          ? settlement.finalScore
          : "score" in settlement
            ? settlement.score
            : `${goals.home}-${goals.away}`,
      };
      updates.set(row.id, update);
      await supabaseAdmin.from("ai_analyses").update({ result: { ...asRecord(row.result), _settlement: { ...update, hit: update.status === "won", market: existingItem.market, pick: existingItem.pick } } }).eq("id", row.id);
    } catch {
      // A provider timeout or quota response leaves the prediction pending.
    }
  }
  return updates;
}

export function buildSummary(items: PredictionHistoryItem[]): PredictionHistorySummary {
  const won = items.filter((item) => item.status === "won").length;
  const lost = items.filter((item) => item.status === "lost").length;
  const settled = won + lost;
  const roiValues = items
    .filter((item) => (item.status === "won" || item.status === "lost") && item.odd !== null)
    .map((item) => item.status === "won" ? item.odd! - 1 : -1);
  return {
    total: items.length,
    settled,
    won,
    lost,
    pending: items.filter((item) => item.status === "pending").length,
    unresolvable: items.filter((item) => item.status === "unresolvable").length,
    hitRate: settled ? Math.round((won / settled) * 100) : null,
    theoreticalRoi: roiValues.length ? Math.round((roiValues.reduce((a, b) => a + b, 0) / roiValues.length) * 100) / 100 : null,
  };
}

async function readRows(client: SupabaseDbClient, userId: string, limit: number): Promise<RawAnalysisRow[]> {
  const base = client
    .from("ai_analyses")
    .select("id, home_team, away_team, match_id, result, created_at, prediction_market, prediction_pick, prediction_confidence, prediction_odd, settlement_status, settlement_outcome, final_score, settled_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const { data } = await base;
  return (data ?? []) as RawAnalysisRow[];
}

export async function loadPredictionHistory(client: SupabaseDbClient, userId: string, input: z.infer<typeof historyInput>): Promise<PredictionHistoryData> {
  const { data: profile } = await client.from("profiles").select("plan, premium_until").eq("id", userId).maybeSingle();
  const isPremium = isPremiumActive({ plan: profile?.plan ?? "free", premium_until: profile?.premium_until ?? null });
  const rows = await readRows(client, userId, isPremium ? 1000 : 10);
  const settlementUpdates = await settlePredictionRows(rows);
  const allItems = rows.map((row) => toItem(row, settlementUpdates.get(row.id)));
  const cutoff = input.period === "all" ? 0 : Date.now() - Number(input.period.replace("d", "")) * 86_400_000;
  const teamFilter = normalizeText(input.team);
  const filtered = allItems.filter((item) => {
    if (input.status !== "all" && item.status !== input.status) return false;
    if (input.market !== "all" && item.market !== input.market) return false;
    if (teamFilter && !normalizeText(`${item.homeTeam} ${item.awayTeam}`).includes(teamFilter)) return false;
    if (cutoff && new Date(item.createdAt).getTime() < cutoff) return false;
    return true;
  });
  const offset = (input.page - 1) * input.pageSize;
  const items = filtered.slice(offset, offset + input.pageSize);
  return {
    isPremium,
    items,
    summary: buildSummary(filtered),
    page: input.page,
    pageSize: input.pageSize,
    total: filtered.length,
    hasMore: offset + input.pageSize < filtered.length,
    filters: input,
    warning: !isPremium && rows.length >= 10 ? "Les membres gratuits voient les 10 dernières analyses. Premium débloque l'historique complet." : null,
  };
}

export const getPredictionHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => historyInput.parse(data))
  .handler(async ({ data, context }) => loadPredictionHistory(context.supabase, context.userId, data));

export { historyInput, toItem };
