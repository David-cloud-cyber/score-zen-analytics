import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BOOKMAKERS } from "@/data/bookmakers";
import { SEO_COUNTRIES } from "@/data/country-seo";
import { getApiFootballCacheState, getApiFootballQuotaState, todayISO } from "@/lib/apifootball.server";
import { getConfig, getRuntimeEnv } from "@/lib/config.server";

type AdminRole = "admin" | "owner";
const reasonSchema = z.string().trim().min(8).max(500);
const pageSchema = z.object({ page: z.number().int().min(1).max(1000).default(1), pageSize: z.number().int().min(10).max(100).default(25), search: z.string().trim().max(120).default("") });

async function adminRole(userId: string, client: any): Promise<AdminRole> {
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "owner"]);
  if (error) throw new Error("ADMIN_ROLE_LOOKUP_FAILED");
  if ((data ?? []).some((item: { role: string }) => item.role === "owner")) return "owner";
  if ((data ?? []).some((item: { role: string }) => item.role === "admin")) return "admin";
  throw new Error("ADMIN_FORBIDDEN");
}

async function requireAdmin(context: any): Promise<AdminRole> {
  return adminRole(context.userId, context.supabase);
}

async function audit(actorId: string, action: string, targetType: string, targetId: string | null, reason: string | null, beforeState: unknown, afterState: unknown, metadata: unknown = {}) {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    reason,
    before_state: (beforeState ?? null) as any,
    after_state: (afterState ?? null) as any,
    metadata: (metadata ?? {}) as any,
  });
  if (error) throw new Error("ADMIN_AUDIT_FAILED");
}

async function count(table: string, filters: Array<[string, string, unknown]> = []) {
  let query = (supabaseAdmin as any).from(table).select("id", { count: "exact", head: true });
  for (const [column, operator, value] of filters) query = (query as any)[operator](column, value);
  const result = await query;
  return result.count ?? 0;
}

export type AdminOverview = {
  metrics: { users: number; activeUsers: number; newUsers: number; premium: number; analyses: number; payments: number; revenueXaf: number; community: number };
  health: { apiFootball: { configured: boolean; quota: Awaited<ReturnType<typeof getApiFootballQuotaState>>; cache: { available: boolean; stale: boolean; storedAt: number | null } }; ai: boolean; fapshi: boolean; cloudflare: boolean };
  pending: { payments: number; criticalActions: number; suspendedUsers: number };
  generatedAt: string;
};

export const getAdminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<AdminOverview> => {
  await requireAdmin(context);
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const [users, activeUsers, newUsers, premium, analyses, payments, pendingPayments, suspendedUsers, community] = await Promise.all([
    count("profiles"),
    count("profiles", [["account_status", "eq", "active"]]),
    count("profiles", [["created_at", "gte", dayAgo]]),
    count("profiles", [["plan", "eq", "premium"]]),
    count("ai_analyses"),
    count("payments"),
    count("payments", [["status", "eq", "PENDING"]]),
    count("profiles", [["account_status", "eq", "suspended"]]),
    count("community_messages"),
  ]);
  const { data: revenueRows } = await supabaseAdmin.from("payments").select("amount_xaf").eq("status", "SUCCESSFUL").limit(5000);
  const revenueXaf = (revenueRows ?? []).reduce((total, row) => total + (Number(row.amount_xaf) || 0), 0);
  const [quota, cache, ai, fapshi] = await Promise.all([
    getApiFootballQuotaState(),
    getApiFootballCacheState("/fixtures", { date: todayISO() }),
    getConfig("OPENROUTER_API_KEY"),
    getConfig("FAPSHI_API_KEY"),
  ]);
  const { count: criticalActions } = await supabaseAdmin.from("admin_action_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
  return {
    metrics: { users, activeUsers, newUsers, premium, analyses, payments, revenueXaf, community },
    health: {
      apiFootball: { configured: Boolean(await getConfig("APIFOOTBALL_KEY")), quota, cache: { available: Boolean(cache), stale: cache?.stale ?? false, storedAt: cache?.storedAt ?? null } },
      ai: Boolean(ai), fapshi: Boolean(fapshi), cloudflare: Boolean(getRuntimeEnv("PUBLIC_APP_URL")),
    },
    pending: { payments: pendingPayments, criticalActions: criticalActions ?? 0, suspendedUsers },
    generatedAt: new Date().toISOString(),
  };
});

export type AdminUser = { id: string; email: string | null; displayName: string | null; plan: string; credits: number; accountStatus: string; roles: string[]; createdAt: string; premiumUntil: string | null };

export const getAdminUsers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((data) => pageSchema.parse(data)).handler(async ({ data, context }) => {
  await requireAdmin(context);
  const { data: authData, error } = await supabaseAdmin.auth.admin.listUsers({ page: data.page, perPage: data.pageSize });
  if (error) throw new Error("ADMIN_USERS_UNAVAILABLE");
  const ids = authData.users.map((user) => user.id);
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    ids.length ? supabaseAdmin.from("profiles").select("id, display_name, plan, credits, account_status, created_at, premium_until").in("id", ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
  ]);
  const roleMap = new Map<string, string[]>();
  for (const role of roles ?? []) roleMap.set(role.user_id, [...(roleMap.get(role.user_id) ?? []), role.role]);
  const search = data.search.toLowerCase();
  const users: AdminUser[] = authData.users.map((user) => {
    const profile = (profiles ?? []).find((item) => item.id === user.id);
    return { id: user.id, email: user.email ?? null, displayName: profile?.display_name ?? null, plan: profile?.plan ?? "free", credits: profile?.credits ?? 0, accountStatus: profile?.account_status ?? "active", roles: roleMap.get(user.id) ?? ["user"], createdAt: profile?.created_at ?? user.created_at, premiumUntil: profile?.premium_until ?? null };
  }).filter((user) => !search || `${user.email ?? ""} ${user.displayName ?? ""} ${user.id}`.toLowerCase().includes(search));
  return { users, page: data.page, pageSize: data.pageSize, hasMore: authData.users.length === data.pageSize };
});

const userActionSchema = z.object({ userId: z.string().uuid(), reason: reasonSchema });
export const suspendAdminUser = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => userActionSchema.parse(data)).handler(async ({ data, context }) => {
  const role = await requireAdmin(context);
  if (data.userId === context.userId) throw new Error("ADMIN_CANNOT_SUSPEND_SELF");
  const { data: target } = await supabaseAdmin.from("profiles").select("id, account_status, plan, credits").eq("id", data.userId).maybeSingle();
  if (!target) throw new Error("USER_NOT_FOUND");
  const { data: targetRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId).in("role", ["owner", "admin"]).limit(1).maybeSingle();
  if (targetRole && role !== "owner") throw new Error("OWNER_ACTION_REQUIRED");
  const { error } = await supabaseAdmin.from("profiles").update({ account_status: "suspended", suspended_at: new Date().toISOString(), suspended_by: context.userId, suspension_reason: data.reason }).eq("id", data.userId);
  if (error) throw new Error("USER_SUSPEND_FAILED");
  await audit(context.userId, "user.suspend", "user", data.userId, data.reason, target, { ...target, account_status: "suspended" });
  return { ok: true };
});

export const restoreAdminUser = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => userActionSchema.parse(data)).handler(async ({ data, context }) => {
  await requireAdmin(context);
  const { data: target } = await supabaseAdmin.from("profiles").select("id, account_status, plan, credits").eq("id", data.userId).maybeSingle();
  if (!target) throw new Error("USER_NOT_FOUND");
  const { error } = await supabaseAdmin.from("profiles").update({ account_status: "active", suspended_at: null, suspended_by: null, suspension_reason: null }).eq("id", data.userId);
  if (error) throw new Error("USER_RESTORE_FAILED");
  await audit(context.userId, "user.restore", "user", data.userId, data.reason, target, { ...target, account_status: "active" });
  return { ok: true };
});

const requestSchema = z.object({ actionType: z.enum(["premium_grant", "vip_grant", "credits_adjust", "role_change", "refund_request", "account_anonymize"]), targetType: z.enum(["user", "payment", "subscription", "vip_application"]), targetId: z.string().min(1).max(120), reason: reasonSchema, payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}), operationId: z.string().uuid().optional() });
export const requestAdminCriticalAction = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => requestSchema.parse(data)).handler(async ({ data, context }) => {
  const role = await requireAdmin(context);
  if (role !== "admin") throw new Error("CRITICAL_ACTION_MUST_BE_REQUESTED_BY_ADMIN");
  const operationId = data.operationId ?? crypto.randomUUID();
  const { data: existing } = await supabaseAdmin.from("admin_action_requests").select("id, status").eq("id", operationId).maybeSingle();
  if (existing) return existing;
  const { data: request, error } = await supabaseAdmin.from("admin_action_requests").insert({ id: operationId, action_type: data.actionType, target_type: data.targetType, target_id: data.targetId, requested_by: context.userId, reason: data.reason, payload: data.payload, status: "pending" }).select("id, status, created_at").single();
  if (error) throw new Error("CRITICAL_ACTION_REQUEST_FAILED");
  await audit(context.userId, "admin.action.request", data.targetType, data.targetId, data.reason, null, request, { actionType: data.actionType, operationId });
  return request;
});

export const approveAdminCriticalAction = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ requestId: z.string().uuid(), reason: reasonSchema }).parse(data)).handler(async ({ data, context }) => {
  const role = await requireAdmin(context);
  if (role !== "owner") throw new Error("OWNER_APPROVAL_REQUIRED");
  const { data: request } = await supabaseAdmin.from("admin_action_requests").select("*").eq("id", data.requestId).eq("status", "pending").maybeSingle();
  if (!request) throw new Error("CRITICAL_ACTION_NOT_FOUND");
  if (request.requested_by === context.userId) throw new Error("SELF_APPROVAL_FORBIDDEN");
  const payload = (request.payload ?? {}) as Record<string, unknown>;
  let result: { approved: boolean; amount?: number; balanceAfter?: number; providerActionRequired?: boolean; role?: string; anonymized?: boolean } = { approved: true };
  if (request.action_type === "premium_grant") {
    const until = typeof payload.premiumUntil === "string" ? payload.premiumUntil : null;
    if (!until || !request.target_id) throw new Error("PREMIUM_DATE_REQUIRED");
    const { error } = await supabaseAdmin.from("profiles").update({ plan: "premium", premium_until: until }).eq("id", request.target_id);
    if (error) throw new Error("PREMIUM_GRANT_FAILED");
  } else if (request.action_type === "vip_grant") {
    if (!request.target_id) throw new Error("VIP_APPLICATION_REQUIRED");
    const { data: application } = await (supabaseAdmin as any).from("vip_applications").select("id, user_id, tier, status").eq("id", request.target_id).maybeSingle();
    if (!application || !["submitted", "under_review", "needs_info"].includes(application.status)) throw new Error("VIP_APPLICATION_NOT_ELIGIBLE");
    const { data: existingGrant } = await (supabaseAdmin as any).from("vip_grants").select("id").eq("user_id", application.user_id).maybeSingle();
    if (existingGrant) throw new Error("VIP_ALREADY_GRANTED");
    const months = application.tier === "pro" ? 6 : 3;
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setMonth(endsAt.getMonth() + months);
    const { data: grant, error: grantError } = await (supabaseAdmin as any).from("vip_grants").insert({ application_id: application.id, user_id: application.user_id, tier: application.tier, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), monthly_credits: 100, created_by: context.userId }).select("id, starts_at, ends_at").single();
    if (grantError || !grant) throw new Error("VIP_GRANT_FAILED");
    const { data: currentProfile } = await (supabaseAdmin as any).from("profiles").select("premium_until").eq("id", application.user_id).maybeSingle();
    const currentPremiumUntil = currentProfile?.premium_until ? new Date(currentProfile.premium_until).getTime() : 0;
    const effectivePremiumUntil = currentPremiumUntil > endsAt.getTime() ? new Date(currentPremiumUntil).toISOString() : endsAt.toISOString();
    const { error: profileError } = await (supabaseAdmin as any).from("profiles").update({ plan: "premium", premium_until: effectivePremiumUntil, premium_source: "vip", vip_tier: application.tier }).eq("id", application.user_id);
    if (profileError) throw new Error("VIP_PROFILE_UPDATE_FAILED");
    await (supabaseAdmin as any).from("vip_applications").update({ status: "approved", reviewer_id: context.userId, reviewed_at: new Date().toISOString(), review_reason: request.reason }).eq("id", application.id);
    await (supabaseAdmin as any).rpc("ensure_vip_monthly_credits", { p_user_id: application.user_id });
    await (supabaseAdmin as any).from("user_notifications").insert({ user_id: application.user_id, type: "vip_status", title: "Accès Premium gratuit activé", message: `Votre accès VIP ${application.tier === "pro" ? "Pro" : "Starter"} est actif pendant ${months} mois.`, link: "/premium/tableau-de-bord", entity_id: application.id });
    result = { ...result, vipGrantId: grant.id, premiumUntil: grant.ends_at } as typeof result & { vipGrantId: string; premiumUntil: string };
  } else if (request.action_type === "credits_adjust") {
    const amount = typeof payload.amount === "number" ? Math.trunc(payload.amount) : 0;
    if (!amount || !request.target_id) throw new Error("CREDIT_AMOUNT_REQUIRED");
    const { data: profile } = await supabaseAdmin.from("profiles").select("credits").eq("id", request.target_id).maybeSingle();
    if (!profile || profile.credits + amount < 0) throw new Error("INVALID_CREDIT_BALANCE");
    const { error } = await supabaseAdmin.from("profiles").update({ credits: profile.credits + amount }).eq("id", request.target_id);
    if (error) throw new Error("CREDIT_ADJUST_FAILED");
    await supabaseAdmin.from("credits_ledger").insert({ user_id: request.target_id, kind: amount > 0 ? "bonus" : "refund", amount, balance_after: profile.credits + amount, label: `Ajustement admin: ${request.reason}`, meta: { requestId: request.id } });
    result = { ...result, amount, balanceAfter: profile.credits + amount };
  } else if (request.action_type === "refund_request") {
    if (!request.target_id) throw new Error("PAYMENT_REQUIRED");
    const { error } = await supabaseAdmin.from("payments").update({ status: "REFUND_REQUESTED" }).eq("id", request.target_id);
    if (error) throw new Error("REFUND_REQUEST_FAILED");
    result = { ...result, providerActionRequired: true };
  } else if (request.action_type === "role_change") {
    const nextRole = payload.role === "owner" || payload.role === "admin" || payload.role === "user" ? payload.role : null;
    if (!nextRole || !request.target_id) throw new Error("ROLE_REQUIRED");
    const { data: currentRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", request.target_id);
    if (nextRole !== "owner" && (currentRoles ?? []).some((item) => item.role === "owner")) {
      const { count: ownerCount } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "owner");
      if ((ownerCount ?? 0) <= 1) throw new Error("LAST_OWNER_PROTECTED");
    }
    const { error: clearError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", request.target_id).in("role", ["admin", "owner"]);
    if (clearError) throw new Error("ROLE_CHANGE_FAILED");
    if (nextRole !== "user") {
      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: request.target_id, role: nextRole });
      if (roleError) throw new Error("ROLE_CHANGE_FAILED");
    }
    result = { ...result, role: nextRole };
  } else if (request.action_type === "account_anonymize") {
    if (!request.target_id) throw new Error("USER_REQUIRED");
    const { error } = await supabaseAdmin.from("profiles").update({ display_name: "Utilisateur anonymisé", avatar_url: null, referral_code: null }).eq("id", request.target_id);
    if (error) throw new Error("ANONYMIZATION_FAILED");
    result = { ...result, anonymized: true };
  } else {
    throw new Error("ACTION_NOT_SUPPORTED");
  }
  await supabaseAdmin.from("admin_action_requests").update({ status: "executed", approved_by: context.userId, approved_at: new Date().toISOString(), executed_at: new Date().toISOString(), result }).eq("id", request.id);
  await audit(context.userId, "admin.action.approve", request.target_type, request.target_id, data.reason, request, result, { requestId: request.id });
  return { ok: true, result };
});

export const getAdminPayments = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((data) => pageSchema.parse(data)).handler(async ({ data, context }) => {
  await requireAdmin(context);
  const { data: rows, error } = await supabaseAdmin.from("payments").select("id, user_id, provider, external_id, pack_id, credits, amount_xaf, status, trans_id, credited_at, created_at, updated_at").order("created_at", { ascending: false }).range((data.page - 1) * data.pageSize, data.page * data.pageSize - 1);
  if (error) throw new Error("ADMIN_PAYMENTS_UNAVAILABLE");
  return { payments: rows ?? [], hasMore: (rows ?? []).length === data.pageSize };
});

export const getAdminAnalyses = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((data) => pageSchema.parse(data)).handler(async ({ data, context }) => {
  await requireAdmin(context);
  const { data: rows, error } = await supabaseAdmin.from("ai_analyses").select("id, user_id, home_team, away_team, match_id, prediction_market, prediction_pick, prediction_confidence, settlement_status, final_score, created_at, settled_at, engine_version, ai_status, data_quality_score, ai_latency_ms").order("created_at", { ascending: false }).range((data.page - 1) * data.pageSize, data.page * data.pageSize - 1);
  if (error) throw new Error("ADMIN_ANALYSES_UNAVAILABLE");
  return { analyses: rows ?? [], hasMore: (rows ?? []).length === data.pageSize };
});

export type AdminPredictionQuality = {
  total: number;
  settled: number;
  won: number;
  lost: number;
  unresolvable: number;
  hitRate: number | null;
  brierScore: number | null;
  logLoss: number | null;
  aiEnriched: number;
  aiFallback: number;
  statisticalOnly: number;
  generatedAt: string;
};

function resultProbability(row: { result: unknown; settlement_outcome: string | null }) {
  const result = row.result && typeof row.result === "object" ? (row.result as Record<string, unknown>) : null;
  const probabilities = result?.probabilities && typeof result.probabilities === "object"
    ? (result.probabilities as Record<string, unknown>)
    : null;
  const outcome = row.settlement_outcome?.toLowerCase().trim();
  const outcomeKey = outcome === "home" || outcome === "domicile" || outcome === "1"
    ? "home"
    : outcome === "away" || outcome === "extérieur" || outcome === "2"
      ? "away"
      : outcome === "draw" || outcome === "nul" || outcome === "n"
        ? "draw"
        : null;
  const probability = outcomeKey ? Number(probabilities?.[outcomeKey]) / 100 : NaN;
  return { probability, outcomeKey };
}

export const getAdminPredictionQuality = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<AdminPredictionQuality> => {
  await requireAdmin(context);
  const { data: rows, error } = await supabaseAdmin
    .from("ai_analyses")
    .select("result, settlement_status, settlement_outcome, ai_status")
    .limit(10_000);
  if (error) throw new Error("ADMIN_PREDICTION_QUALITY_UNAVAILABLE");

  let won = 0;
  let lost = 0;
  let unresolvable = 0;
  let brierTotal = 0;
  let logLossTotal = 0;
  let scored = 0;
  let aiEnriched = 0;
  let aiFallback = 0;
  let statisticalOnly = 0;
  for (const row of rows ?? []) {
    if (row.settlement_status === "won") won += 1;
    if (row.settlement_status === "lost") lost += 1;
    if (row.settlement_status === "unresolvable") unresolvable += 1;
    if (row.ai_status === "ai_enriched") aiEnriched += 1;
    if (row.ai_status === "ai_fallback") aiFallback += 1;
    if (row.ai_status === "statistical_only") statisticalOnly += 1;
    if (row.settlement_status !== "won" && row.settlement_status !== "lost") continue;
    const { probability, outcomeKey } = resultProbability(row);
    if (!outcomeKey || !Number.isFinite(probability)) continue;
    const settledOutcomeIsWon = row.settlement_status === "won";
    const clipped = Math.max(0.001, Math.min(0.999, probability));
    brierTotal += (clipped - (settledOutcomeIsWon ? 1 : 0)) ** 2;
    logLossTotal += -(settledOutcomeIsWon ? Math.log(clipped) : Math.log(1 - clipped));
    scored += 1;
  }
  const settled = won + lost;
  return {
    total: rows?.length ?? 0,
    settled,
    won,
    lost,
    unresolvable,
    hitRate: settled ? Math.round((won / settled) * 1000) / 10 : null,
    brierScore: scored ? Math.round((brierTotal / scored) * 10_000) / 10_000 : null,
    logLoss: scored ? Math.round((logLossTotal / scored) * 10_000) / 10_000 : null,
    aiEnriched,
    aiFallback,
    statisticalOnly,
    generatedAt: new Date().toISOString(),
  };
});

export const getAdminApiHealth = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdmin(context);
  const [quota, cache, football, ai, fapshi] = await Promise.all([getApiFootballQuotaState(), getApiFootballCacheState("/fixtures", { date: todayISO() }), getConfig("APIFOOTBALL_KEY"), getConfig("OPENROUTER_API_KEY"), getConfig("FAPSHI_API_KEY")]);
  return { apiFootball: { configured: Boolean(football), quota, cache }, aiConfigured: Boolean(ai), fapshiConfigured: Boolean(fapshi), cloudflareConfigured: Boolean(getRuntimeEnv("PUBLIC_APP_URL")), checkedAt: new Date().toISOString() };
});

export const getAdminCommunity = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdmin(context);
  const [{ data: messages }, { data: predictions }] = await Promise.all([(supabaseAdmin as any).from("community_messages").select("id, user_id, user_name, message, match_id, created_at").order("created_at", { ascending: false }).limit(100), supabaseAdmin.from("community_predictions").select("id, user_id, user_name, fixture_id, home_team, away_team, prediction, created_at").order("created_at", { ascending: false }).limit(100)]);
  return { messages: messages ?? [], predictions: predictions ?? [] };
});

export const getAdminContent = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdmin(context);
  return { bookmakers: BOOKMAKERS.map((item) => ({ slug: item.slug, name: item.name, code: item.code, countries: item.countryPageSlugs ?? [], updatedAt: item.updatedAt })), countries: SEO_COUNTRIES.map((item) => ({ slug: item.slug, name: item.name })) };
});

export const getAdminAuditLog = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((data) => pageSchema.parse(data)).handler(async ({ data, context }) => {
  await requireAdmin(context);
  const { data: rows, error } = await supabaseAdmin.from("admin_audit_log").select("id, actor_id, action, target_type, target_id, reason, before_state, after_state, request_id, metadata, created_at").order("created_at", { ascending: false }).range((data.page - 1) * data.pageSize, data.page * data.pageSize - 1);
  if (error) throw new Error("ADMIN_AUDIT_UNAVAILABLE");
  return { entries: rows ?? [], hasMore: (rows ?? []).length === data.pageSize };
});

export const getAdminActionRequests = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdmin(context);
  const { data } = await supabaseAdmin.from("admin_action_requests").select("id, action_type, target_type, target_id, requested_by, reason, status, created_at, approved_by, approved_at, executed_at").order("created_at", { ascending: false }).limit(100);
  return data ?? [];
});

export const exportAdminData = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ dataset: z.enum(["users", "payments", "analyses", "audit"]), format: z.enum(["csv", "json"]).default("csv"), limit: z.number().int().min(1).max(2000).default(500) }).parse(data)).handler(async ({ data, context }) => {
  const role = await requireAdmin(context);
  if (data.dataset === "audit" && role !== "owner") throw new Error("OWNER_EXPORT_REQUIRED");
  let rows: any[] = [];
  if (data.dataset === "users") { const { data: items } = await supabaseAdmin.from("profiles").select("id, display_name, plan, credits, account_status, created_at, premium_until").limit(data.limit); rows = items ?? []; }
  if (data.dataset === "payments") { const { data: items } = await supabaseAdmin.from("payments").select("id, user_id, provider, pack_id, credits, amount_xaf, status, created_at").limit(data.limit); rows = items ?? []; }
  if (data.dataset === "analyses") { const { data: items } = await supabaseAdmin.from("ai_analyses").select("id, user_id, home_team, away_team, match_id, prediction_market, prediction_pick, settlement_status, final_score, created_at").limit(data.limit); rows = items ?? []; }
  if (data.dataset === "audit") { const { data: items } = await supabaseAdmin.from("admin_audit_log").select("id, actor_id, action, target_type, target_id, reason, request_id, created_at").limit(data.limit); rows = items ?? []; }
  await audit(context.userId, "admin.export", data.dataset, null, "Export administratif", null, { rows: rows.length }, { format: data.format, limit: data.limit });
  if (data.format === "json") return { filename: `livefoot-${data.dataset}.json`, mime: "application/json", content: JSON.stringify(rows) };
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? "")).join(","))].join("\n");
  return { filename: `livefoot-${data.dataset}.csv`, mime: "text/csv;charset=utf-8", content: csv };
});
