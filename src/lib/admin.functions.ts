import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BOOKMAKERS } from "@/data/bookmakers";
import { SEO_COUNTRIES } from "@/data/country-seo";
import {
  getApiFootballCacheState,
  getApiFootballQuotaState,
  todayISO,
} from "@/lib/apifootball.server";
import { getConfig, getRuntimeEnv } from "@/lib/config.server";
import { isActionablePrediction, scoreMatchProbabilities } from "./prediction-evaluation";

type AdminRole = "admin" | "owner";
const reasonSchema = z.string().trim().min(8).max(500);
const pageSchema = z.object({
  page: z.number().int().min(1).max(1000).default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
  search: z.string().trim().max(120).default(""),
});
const adminPaymentQuerySchema = pageSchema.extend({
  status: z.enum(["all", "PENDING", "SUCCESSFUL", "FAILED", "EXPIRED", "UNDERPAID"]).default("all"),
});

async function adminRole(userId: string, client: any): Promise<AdminRole> {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "owner"]);
  if (error) throw new Error("ADMIN_ROLE_LOOKUP_FAILED");
  if ((data ?? []).some((item: { role: string }) => item.role === "owner")) return "owner";
  if ((data ?? []).some((item: { role: string }) => item.role === "admin")) return "admin";
  throw new Error("ADMIN_FORBIDDEN");
}

async function requireAdmin(context: any): Promise<AdminRole> {
  return adminRole(context.userId, context.supabase);
}

async function audit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  reason: string | null,
  beforeState: unknown,
  afterState: unknown,
  metadata: unknown = {},
) {
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
  metrics: {
    users: number;
    activeUsers: number;
    newUsers: number;
    premium: number;
    analyses: number;
    payments: number;
    revenueXaf: number;
    community: number;
  };
  health: {
    apiFootball: {
      configured: boolean;
      quota: Awaited<ReturnType<typeof getApiFootballQuotaState>>;
      cache: { available: boolean; stale: boolean; storedAt: number | null };
    };
    ai: boolean;
    saspay: boolean;
    relayit: boolean;
    cloudflare: boolean;
  };
  pending: { payments: number; criticalActions: number; suspendedUsers: number };
  generatedAt: string;
};

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    await requireAdmin(context);
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const [
      users,
      activeUsers,
      newUsers,
      premium,
      analyses,
      payments,
      pendingPayments,
      suspendedUsers,
      community,
    ] = await Promise.all([
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
    const { data: revenueRows } = await supabaseAdmin
      .from("payments")
      .select("amount_xaf")
      .eq("status", "SUCCESSFUL")
      .limit(5000);
    const revenueXaf = (revenueRows ?? []).reduce(
      (total, row) => total + (Number(row.amount_xaf) || 0),
      0,
    );
    const [quota, cache, ai, saspay, relayit, relayitWebhook] = await Promise.all([
      getApiFootballQuotaState(),
      getApiFootballCacheState("/fixtures", { date: todayISO() }),
      getConfig("OPENROUTER_API_KEY"),
      getConfig("SASPAY_API_KEY"),
      getConfig("RELAYIT_API_KEY"),
      getConfig("RELAYIT_WEBHOOK_SECRET"),
    ]);
    const { count: criticalActions } = await supabaseAdmin
      .from("admin_action_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    return {
      metrics: { users, activeUsers, newUsers, premium, analyses, payments, revenueXaf, community },
      health: {
        apiFootball: {
          configured: Boolean(await getConfig("APIFOOTBALL_KEY")),
          quota,
          cache: {
            available: Boolean(cache),
            stale: cache?.stale ?? false,
            storedAt: cache?.storedAt ?? null,
          },
        },
        ai: Boolean(ai),
        saspay: Boolean(saspay),
        relayit: Boolean(relayit && relayitWebhook),
        cloudflare: Boolean(getRuntimeEnv("PUBLIC_APP_URL")),
      },
      pending: { payments: pendingPayments, criticalActions: criticalActions ?? 0, suspendedUsers },
      generatedAt: new Date().toISOString(),
    };
  });

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  plan: string;
  credits: number;
  accountStatus: string;
  roles: string[];
  createdAt: string;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  lastSeenAt: string | null;
  lastRoute: string | null;
  lastDeviceFamily: "mobile" | "tablet" | "desktop" | null;
  lastActivityAt: string | null;
  premiumUntil: string | null;
  countryCode: string | null;
  countryName: string | null;
  countrySource: "browser" | "account" | "unknown";
};

export type AdminAudience = {
  totals: {
    users: number;
    active24h: number;
    online: number;
    premium: number;
    unknownCountry: number;
  };
  countries: Array<{ code: string | null; name: string; users: number; online: number }>;
  devices: Array<{ device: "mobile" | "tablet" | "desktop"; users: number; online: number }>;
  routes: Array<{ route: string; online: number }>;
  activity24h: { analyses: number; payments: number; communityMessages: number };
  generatedAt: string;
};

const ADMIN_COUNTRY_NAMES: Record<string, string> = {
  CM: "Cameroun",
  CI: "Côte d’Ivoire",
  SN: "Sénégal",
  FR: "France",
  BE: "Belgique",
  CH: "Suisse",
  CA: "Canada",
  US: "États-Unis",
  GB: "Royaume-Uni",
  NG: "Nigeria",
  GA: "Gabon",
  CD: "RDC",
  BJ: "Bénin",
  TG: "Togo",
  ML: "Mali",
  BF: "Burkina Faso",
};

function validCountryCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value.toUpperCase())
    ? value.toUpperCase()
    : null;
}

function countryInfo(user: any, presence: any) {
  const browserCode = validCountryCode(presence?.country_code);
  const accountCode = validCountryCode(
    user?.user_metadata?.country_code ?? user?.user_metadata?.country,
  );
  const code = browserCode ?? accountCode;
  return {
    code,
    name: code ? (ADMIN_COUNTRY_NAMES[code] ?? code) : "Non renseigné",
    source: browserCode ? "browser" : accountCode ? "account" : "unknown",
  } as const;
}

/**
 * Keeps the admin panel deploy-safe while the additive presence migration is
 * being applied. Older production rows remain readable without the optional
 * audience columns; once the migration is live, the enriched projection is
 * used automatically.
 */
async function readPresenceRows(userIds?: string[]) {
  const db = supabaseAdmin as any;
  const applyFilter = (query: any) => (userIds?.length ? query.in("user_id", userIds) : query);
  const enriched = await applyFilter(
    db.from("user_presence").select("user_id, last_seen_at, route, device_family, country_code"),
  );
  if (!enriched.error) return { data: enriched.data ?? [], error: null };
  const fallback = await applyFilter(
    db.from("user_presence").select("user_id, last_seen_at, route, device_family"),
  );
  return { data: fallback.data ?? [], error: fallback.error ?? null };
}

function latestTimestamp(...values: Array<string | null | undefined>) {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
  );
}

async function listAdminAuthUsers(data: z.infer<typeof pageSchema>) {
  const search = data.search.toLowerCase();
  const perPage = search ? 100 : data.pageSize;
  const users: any[] = [];
  let page = search ? 1 : data.page;
  let hasMore = false;

  do {
    const { data: authData, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("ADMIN_USERS_UNAVAILABLE");
    const pageUsers = authData.users;
    users.push(...pageUsers);
    hasMore = pageUsers.length === perPage;
    if (!search || !hasMore || page >= 20) break;
    page += 1;
  } while (hasMore);

  const filtered = search
    ? users.filter((user) =>
        `${user.email ?? ""} ${user.user_metadata?.display_name ?? ""} ${user.id}`
          .toLowerCase()
          .includes(search),
      )
    : users;
  const start = search ? (data.page - 1) * data.pageSize : 0;
  const visible = search ? filtered.slice(start, start + data.pageSize) : filtered;
  return {
    users: visible,
    hasMore: search ? start + data.pageSize < filtered.length || hasMore : hasMore,
  };
}

async function listAllAdminAuthUsers() {
  const users: any[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("ADMIN_USERS_UNAVAILABLE");
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function buildAdminUsers(authUsers: any[]): Promise<AdminUser[]> {
  const ids = authUsers.map((user) => user.id);
  const [
    { data: profiles, error: profilesError },
    { data: roles, error: rolesError },
    presenceResult,
  ] = await Promise.all([
    ids.length
      ? supabaseAdmin
          .from("profiles")
          .select(
            "id, display_name, plan, credits, account_status, created_at, updated_at, premium_until",
          )
          .in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length ? readPresenceRows(ids) : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesError || rolesError || presenceResult.error)
    throw new Error("ADMIN_USERS_UNAVAILABLE");
  const roleMap = new Map<string, string[]>();
  for (const role of roles ?? [])
    roleMap.set(role.user_id, [...(roleMap.get(role.user_id) ?? []), role.role]);
  const presenceMap = new Map<string, any>(
    (presenceResult.data ?? []).map((item: any) => [item.user_id, item]),
  );
  return authUsers.map((user) => {
    const profile = (profiles ?? []).find((item: any) => item.id === user.id);
    const seen = presenceMap.get(user.id);
    const location = countryInfo(user, seen);
    const createdAt = profile?.created_at ?? user.created_at;
    return {
      id: user.id,
      email: user.email ?? null,
      displayName: profile?.display_name ?? user.user_metadata?.display_name ?? null,
      plan: profile?.plan ?? "free",
      credits: Number(profile?.credits ?? 0),
      accountStatus: profile?.account_status ?? "active",
      roles: roleMap.get(user.id) ?? ["user"],
      createdAt,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      lastSeenAt: seen?.last_seen_at ?? null,
      lastRoute: seen?.route ?? null,
      lastDeviceFamily: seen?.device_family ?? null,
      lastActivityAt: latestTimestamp(
        user.last_sign_in_at,
        seen?.last_seen_at,
        profile?.updated_at,
      ),
      premiumUntil: profile?.premium_until ?? null,
      countryCode: location.code,
      countryName: location.name,
      countrySource: location.source,
    } satisfies AdminUser;
  });
}

export const getAdminAudience = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAudience> => {
    await requireAdmin(context);
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const onlineCutoff = new Date(now - 90_000).toISOString();
    const db = supabaseAdmin as any;
    const [authUsers, profilesResult, presenceResult, analyses, payments, communityMessages] =
      await Promise.all([
        listAllAdminAuthUsers(),
        db.from("profiles").select("id, plan, account_status, created_at, premium_until"),
        readPresenceRows(),
        count("ai_analyses", [["created_at", "gte", dayAgo]]),
        count("payments", [
          ["created_at", "gte", dayAgo],
          ["status", "eq", "SUCCESSFUL"],
        ]),
        count("community_messages", [["created_at", "gte", dayAgo]]),
      ]);
    if (profilesResult.error || presenceResult.error) throw new Error("ADMIN_AUDIENCE_UNAVAILABLE");

    const profiles = profilesResult.data ?? [];
    const presence = presenceResult.data ?? [];
    const profileMap = new Map<string, any>(
      profiles.map((profile: any) => [String(profile.id), profile]),
    );
    const presenceMap = new Map<string, any>(
      presence.map((row: any) => [String(row.user_id), row]),
    );
    const countries = new Map<
      string,
      { code: string | null; name: string; users: number; online: number }
    >();
    const devices = new Map<"mobile" | "tablet" | "desktop", { users: number; online: number }>();
    const routes = new Map<string, number>();
    let active24h = 0;
    let online = 0;
    let premium = 0;
    let visibleUsers = 0;

    for (const user of authUsers) {
      const id = String(user.id);
      const profile = profileMap.get(id);
      if (!profile || profile.account_status === "suspended") continue;
      visibleUsers += 1;
      const seen = presenceMap.get(id);
      const location = countryInfo(user, seen);
      const isOnline = Boolean(seen?.last_seen_at && seen.last_seen_at > onlineCutoff);
      const latestActivity = latestTimestamp(user.last_sign_in_at, seen?.last_seen_at);
      const countryKey = location.code ?? "unknown";
      const country = countries.get(countryKey) ?? {
        code: location.code,
        name: location.name,
        users: 0,
        online: 0,
      };
      country.users += 1;
      if (isOnline) country.online += 1;
      countries.set(countryKey, country);
      if (latestActivity && latestActivity >= dayAgo) active24h += 1;
      if (isOnline) {
        online += 1;
        const device = seen?.device_family as "mobile" | "tablet" | "desktop" | undefined;
        if (device && ["mobile", "tablet", "desktop"].includes(device)) {
          const item = devices.get(device) ?? { users: 0, online: 0 };
          item.online += 1;
          devices.set(device, item);
        }
        const route =
          typeof seen?.route === "string" && seen.route.startsWith("/") ? seen.route : "/";
        routes.set(route, (routes.get(route) ?? 0) + 1);
      }
      if (
        profile.plan === "premium" ||
        (profile.premium_until && profile.premium_until > new Date().toISOString())
      )
        premium += 1;
    }

    for (const row of presence) {
      const device = row.device_family as "mobile" | "tablet" | "desktop";
      if (!["mobile", "tablet", "desktop"].includes(device)) continue;
      const item = devices.get(device) ?? { users: 0, online: 0 };
      item.users += 1;
      devices.set(device, item);
    }

    return {
      totals: {
        users: visibleUsers,
        active24h,
        online,
        premium,
        unknownCountry: countries.get("unknown")?.users ?? 0,
      },
      countries: [...countries.values()].sort((a, b) => b.users - a.users).slice(0, 12),
      devices: (["mobile", "tablet", "desktop"] as const).map((device) => ({
        device,
        ...(devices.get(device) ?? { users: 0, online: 0 }),
      })),
      routes: [...routes.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([route, count]) => ({ route, online: count })),
      activity24h: { analyses, payments, communityMessages },
      generatedAt: new Date().toISOString(),
    };
  });

export const getAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => pageSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const authData = await listAdminAuthUsers(data);
    const users = await buildAdminUsers(authData.users);
    return { users, page: data.page, pageSize: data.pageSize, hasMore: authData.hasMore };
  });

export type AdminPayingUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  plan: string;
  credits: number;
  premiumUntil: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  lastRoute: string | null;
  analyses: number;
  settled: number;
  won: number;
  lost: number;
  hitRate: number | null;
  aiEnriched: number;
  averageDataQuality: number | null;
  lastAnalysisAt: string | null;
  countryCode: string | null;
  countryName: string | null;
};

/** Vue privée et agrégée des clients disposant actuellement de droits payants. */
export const getAdminPayingUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => pageSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ users: AdminPayingUser[]; hasMore: boolean }> => {
    await requireAdmin(context);
    const now = new Date().toISOString();
    const from = (data.page - 1) * data.pageSize;
    const db = supabaseAdmin as any;
    const { data: profiles, error } = await db
      .from("profiles")
      .select("id, display_name, plan, credits, premium_until, created_at, updated_at")
      .or(`plan.eq.premium,premium_until.gt.${now}`)
      .order("premium_until", { ascending: false, nullsFirst: false })
      .range(from, from + data.pageSize);
    if (error) throw new Error("ADMIN_PAYING_USERS_UNAVAILABLE");

    const visibleProfiles = (profiles ?? []).slice(0, data.pageSize);
    const ids = visibleProfiles.map((profile: any) => String(profile.id));
    if (!ids.length) return { users: [], hasMore: false };
    const [{ data: analyses }, presenceResult, authUsers] = await Promise.all([
      db
        .from("ai_analyses")
        .select(
          "id, user_id, match_id, prediction_market, prediction_pick, settlement_status, ai_status, data_quality_score, created_at",
        )
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(5000),
      readPresenceRows(ids),
      Promise.all(
        ids.map(async (id: string) => {
          const { data: authData } = await supabaseAdmin.auth.admin.getUserById(id);
          return authData?.user ?? null;
        }),
      ),
    ]);
    const presence = presenceResult.data;
    const presenceByUser = new Map<string, any>(
      (presence ?? []).map((row: any) => [String(row.user_id), row]),
    );
    const authByUser = new Map(
      authUsers.filter(Boolean).map((user: any) => [String(user.id), user]),
    );

    const users = visibleProfiles.map((profile: any) => {
      const rows = (analyses ?? []).filter((row: any) => row.user_id === profile.id);
      const distinct = new Map<string, any>();
      for (const row of rows) {
        if (!isActionablePrediction(row.prediction_pick)) continue;
        const key = JSON.stringify([
          row.match_id || row.id,
          row.prediction_market,
          row.prediction_pick,
        ]);
        if (!distinct.has(key)) distinct.set(key, row);
      }
      const settledRows = [...distinct.values()].filter(
        (row: any) => row.settlement_status === "won" || row.settlement_status === "lost",
      );
      const won = settledRows.filter((row: any) => row.settlement_status === "won").length;
      const qualityRows = rows.filter((row: any) =>
        Number.isFinite(Number(row.data_quality_score)),
      );
      const seen = presenceByUser.get(String(profile.id));
      const auth = authByUser.get(String(profile.id));
      const location = countryInfo(auth, seen);
      return {
        id: String(profile.id),
        email: auth?.email ?? null,
        displayName: profile.display_name ?? auth?.user_metadata?.display_name ?? null,
        plan: profile.plan ?? "premium",
        credits: Number(profile.credits ?? 0),
        premiumUntil: profile.premium_until ?? null,
        createdAt: profile.created_at,
        lastActivityAt: latestTimestamp(
          seen?.last_seen_at,
          auth?.last_sign_in_at,
          profile.updated_at,
        ),
        lastRoute: seen?.route ?? null,
        analyses: rows.length,
        settled: settledRows.length,
        won,
        lost: settledRows.length - won,
        hitRate: settledRows.length ? Math.round((won / settledRows.length) * 1000) / 10 : null,
        aiEnriched: rows.filter(
          (row: any) => row.ai_status === "ai_enriched" || row.ai_status === "ai_fallback",
        ).length,
        averageDataQuality: qualityRows.length
          ? Math.round(
              (qualityRows.reduce(
                (sum: number, row: any) => sum + Number(row.data_quality_score),
                0,
              ) /
                qualityRows.length) *
                10,
            ) / 10
          : null,
        lastAnalysisAt: rows[0]?.created_at ?? null,
        countryCode: location.code,
        countryName: location.name,
      } satisfies AdminPayingUser;
    });
    const search = data.search.toLowerCase();
    return {
      users: search
        ? users.filter((user: AdminPayingUser) =>
            `${user.email ?? ""} ${user.displayName ?? ""}`.toLowerCase().includes(search),
          )
        : users,
      hasMore: (profiles ?? []).length > data.pageSize,
    };
  });

export type AdminUserActivity = {
  id: string;
  at: string;
  kind:
    | "account"
    | "analysis"
    | "payment"
    | "subscription"
    | "credits"
    | "community"
    | "favorite"
    | "support"
    | "vip"
    | "notification"
    | "admin"
    | "presence";
  label: string;
  detail: string | null;
};

export type AdminUserDetails = {
  user: AdminUser & { emailVerified: boolean };
  counts: {
    analyses: number;
    payments: number;
    subscriptions: number;
    creditMovements: number;
    communityMessages: number;
    communityVotes: number;
    favorites: number;
    supportTickets: number;
    notifications: number;
  };
  activity: AdminUserActivity[];
  hasMoreActivity: boolean;
  generatedAt: string;
};

async function optionalAdminRows(query: any): Promise<any[]> {
  try {
    const { data, error } = await query;
    return error ? [] : (data ?? []);
  } catch {
    return [];
  }
}

function formatAmount(amount: unknown) {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? `${value.toLocaleString("fr-FR")} FCFA` : null;
}

export const getAdminUserDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<AdminUserDetails> => {
    await requireAdmin(context);
    const db = supabaseAdmin as any;
    const [
      { data: authResult, error: authError },
      { data: profile, error: profileError },
      { data: roles },
      presenceResult,
    ] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(data.userId),
      supabaseAdmin
        .from("profiles")
        .select(
          "id, display_name, plan, credits, account_status, created_at, updated_at, premium_until",
        )
        .eq("id", data.userId)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
      readPresenceRows([data.userId]),
    ]);
    if (authError || !authResult?.user || profileError || !profile || presenceResult.error)
      throw new Error("USER_NOT_FOUND");
    const authUser = authResult.user;
    const presence = presenceResult.data[0] ?? null;
    const [
      analyses,
      payments,
      subscriptions,
      credits,
      messages,
      votes,
      favorites,
      tickets,
      supportMessages,
      vipApplications,
      vipGrants,
      notifications,
      adminActions,
    ] = await Promise.all([
      optionalAdminRows(
        db
          .from("ai_analyses")
          .select("id, home_team, away_team, match_id, ai_status, created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(80),
      ),
      optionalAdminRows(
        db
          .from("payments")
          .select("id, provider, pack_id, credits, amount_xaf, status, created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(80),
      ),
      optionalAdminRows(
        db
          .from("subscriptions")
          .select("id, provider, plan_id, amount_xaf, status, created_at, current_period_end")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(40),
      ),
      optionalAdminRows(
        db
          .from("credits_ledger")
          .select("id, kind, amount, balance_after, label, created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(120),
      ),
      optionalAdminRows(
        db
          .from("community_messages")
          .select("id, match_id, parent_id, created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(80),
      ),
      optionalAdminRows(
        db
          .from("community_predictions")
          .select("id, fixture_id, home_team, away_team, prediction, created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(80),
      ),
      optionalAdminRows(
        db
          .from("favorites")
          .select("id, kind, ref_id, label, created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(80),
      ),
      optionalAdminRows(
        db
          .from("support_tickets")
          .select("id, subject, category, status, created_at, updated_at")
          .eq("user_id", data.userId)
          .order("updated_at", { ascending: false })
          .limit(50),
      ),
      optionalAdminRows(
        db
          .from("support_messages")
          .select("id, ticket_id, author_role, created_at")
          .eq("author_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(80),
      ),
      optionalAdminRows(
        db
          .from("vip_applications")
          .select("id, tier, partner_slug, status, created_at, reviewed_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(20),
      ),
      optionalAdminRows(
        db
          .from("vip_grants")
          .select("id, tier, starts_at, ends_at, created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(20),
      ),
      optionalAdminRows(
        db
          .from("user_notifications")
          .select("id, type, title, read_at, created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(80),
      ),
      optionalAdminRows(
        db
          .from("admin_audit_log")
          .select("id, action, target_type, reason, created_at")
          .eq("target_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(80),
      ),
    ]);

    const activity: AdminUserActivity[] = [];
    const add = (item: AdminUserActivity) => {
      if (item.at) activity.push(item);
    };
    add({
      id: `account-created-${data.userId}`,
      at: profile.created_at,
      kind: "account",
      label: "Compte créé",
      detail: "Inscription au SaaS",
    });
    if (authUser.email_confirmed_at)
      add({
        id: `email-confirmed-${data.userId}`,
        at: authUser.email_confirmed_at,
        kind: "account",
        label: "Adresse email confirmée",
        detail: authUser.email ?? null,
      });
    if (authUser.last_sign_in_at)
      add({
        id: `last-sign-in-${data.userId}`,
        at: authUser.last_sign_in_at,
        kind: "account",
        label: "Dernière connexion",
        detail: null,
      });
    if (presence?.last_seen_at)
      add({
        id: `presence-${data.userId}`,
        at: presence.last_seen_at,
        kind: "presence",
        label: "Dernière présence",
        detail: [presence.route, presence.device_family].filter(Boolean).join(" · ") || null,
      });
    for (const row of analyses)
      add({
        id: `analysis-${row.id}`,
        at: row.created_at,
        kind: "analysis",
        label: "Analyse lancée",
        detail: [row.home_team, row.away_team].filter(Boolean).join(" — ") || "Match non précisé",
      });
    for (const row of payments)
      add({
        id: `payment-${row.id}`,
        at: row.created_at,
        kind: "payment",
        label: `Paiement ${String(row.status ?? "").toLowerCase() || "enregistré"}`,
        detail:
          [
            formatAmount(row.amount_xaf),
            row.credits ? `${row.credits} crédits` : null,
            row.provider,
          ]
            .filter(Boolean)
            .join(" · ") || null,
      });
    for (const row of subscriptions)
      add({
        id: `subscription-${row.id}`,
        at: row.created_at,
        kind: "subscription",
        label: `Abonnement ${String(row.status ?? "").toLowerCase() || "enregistré"}`,
        detail:
          [
            row.plan_id,
            formatAmount(row.amount_xaf),
            row.current_period_end
              ? `jusqu'au ${new Date(row.current_period_end).toLocaleDateString("fr-FR")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || null,
      });
    for (const row of credits)
      add({
        id: `credits-${row.id}`,
        at: row.created_at,
        kind: "credits",
        label: "Mouvement de crédits",
        detail: `${Number(row.amount) > 0 ? "+" : ""}${row.amount} · ${row.label || row.kind} · solde ${row.balance_after}`,
      });
    for (const row of messages)
      add({
        id: `message-${row.id}`,
        at: row.created_at,
        kind: "community",
        label: row.parent_id
          ? "Réponse publiée dans la Communauté"
          : "Message publié dans la Communauté",
        detail: row.match_id ? `Match ${row.match_id}` : null,
      });
    for (const row of votes)
      add({
        id: `vote-${row.id}`,
        at: row.created_at,
        kind: "community",
        label: "Vote communautaire",
        detail:
          [row.home_team, row.away_team, row.prediction].filter(Boolean).join(" · ") ||
          `Match ${row.fixture_id}`,
      });
    for (const row of favorites)
      add({
        id: `favorite-${row.id}`,
        at: row.created_at,
        kind: "favorite",
        label: "Favori ajouté",
        detail: [row.kind, row.label || row.ref_id].filter(Boolean).join(" · ") || null,
      });
    for (const row of tickets)
      add({
        id: `ticket-${row.id}`,
        at: row.updated_at ?? row.created_at,
        kind: "support",
        label: "Ticket support",
        detail: [row.subject, row.category, row.status].filter(Boolean).join(" · ") || null,
      });
    for (const row of supportMessages)
      add({
        id: `support-message-${row.id}`,
        at: row.created_at,
        kind: "support",
        label: "Message envoyé au support",
        detail: row.author_role === "user" ? "Utilisateur" : row.author_role,
      });
    for (const row of vipApplications)
      add({
        id: `vip-application-${row.id}`,
        at: row.created_at,
        kind: "vip",
        label: "Demande VIP",
        detail: [row.tier, row.partner_slug, row.status].filter(Boolean).join(" · ") || null,
      });
    for (const row of vipGrants)
      add({
        id: `vip-grant-${row.id}`,
        at: row.created_at,
        kind: "vip",
        label: "Accès VIP accordé",
        detail:
          [
            row.tier,
            row.starts_at && row.ends_at
              ? `${new Date(row.starts_at).toLocaleDateString("fr-FR")} → ${new Date(row.ends_at).toLocaleDateString("fr-FR")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || null,
      });
    for (const row of notifications)
      add({
        id: `notification-${row.id}`,
        at: row.created_at,
        kind: "notification",
        label: "Notification envoyée",
        detail: row.title || row.type || null,
      });
    for (const row of adminActions)
      add({
        id: `admin-${row.id}`,
        at: row.created_at,
        kind: "admin",
        label: `Action admin : ${row.action}`,
        detail: row.reason || row.target_type || null,
      });
    activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const user = {
      id: data.userId,
      email: authUser.email ?? null,
      displayName: profile.display_name ?? authUser.user_metadata?.display_name ?? null,
      plan: profile.plan ?? "free",
      credits: Number(profile.credits ?? 0),
      accountStatus: profile.account_status ?? "active",
      roles: (roles ?? []).map((row: any) => row.role),
      createdAt: profile.created_at,
      emailConfirmedAt: authUser.email_confirmed_at ?? null,
      lastSignInAt: authUser.last_sign_in_at ?? null,
      lastSeenAt: presence?.last_seen_at ?? null,
      lastRoute: presence?.route ?? null,
      lastDeviceFamily: presence?.device_family ?? null,
      lastActivityAt: latestTimestamp(
        authUser.last_sign_in_at,
        presence?.last_seen_at,
        profile.updated_at,
      ),
      premiumUntil: profile.premium_until ?? null,
      countryCode: countryInfo(authUser, presence).code,
      countryName: countryInfo(authUser, presence).name,
      countrySource: countryInfo(authUser, presence).source,
      emailVerified: Boolean(authUser.email_confirmed_at),
    } satisfies AdminUserDetails["user"];
    return {
      user,
      counts: {
        analyses: analyses.length,
        payments: payments.length,
        subscriptions: subscriptions.length,
        creditMovements: credits.length,
        communityMessages: messages.length,
        communityVotes: votes.length,
        favorites: favorites.length,
        supportTickets: tickets.length,
        notifications: notifications.length,
      },
      activity: activity.slice(0, 300),
      hasMoreActivity: activity.length > 300,
      generatedAt: new Date().toISOString(),
    };
  });

const userActionSchema = z.object({ userId: z.string().uuid(), reason: reasonSchema });
export const suspendAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => userActionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const role = await requireAdmin(context);
    if (data.userId === context.userId) throw new Error("ADMIN_CANNOT_SUSPEND_SELF");
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, account_status, plan, credits")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("USER_NOT_FOUND");
    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();
    if (targetRole && role !== "owner") throw new Error("OWNER_ACTION_REQUIRED");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        account_status: "suspended",
        suspended_at: new Date().toISOString(),
        suspended_by: context.userId,
        suspension_reason: data.reason,
      })
      .eq("id", data.userId);
    if (error) throw new Error("USER_SUSPEND_FAILED");
    await audit(context.userId, "user.suspend", "user", data.userId, data.reason, target, {
      ...target,
      account_status: "suspended",
    });
    return { ok: true };
  });

export const restoreAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => userActionSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, account_status, plan, credits")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target) throw new Error("USER_NOT_FOUND");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        account_status: "active",
        suspended_at: null,
        suspended_by: null,
        suspension_reason: null,
      })
      .eq("id", data.userId);
    if (error) throw new Error("USER_RESTORE_FAILED");
    await audit(context.userId, "user.restore", "user", data.userId, data.reason, target, {
      ...target,
      account_status: "active",
    });
    return { ok: true };
  });

const requestSchema = z.object({
  actionType: z.enum([
    "premium_grant",
    "vip_grant",
    "credits_adjust",
    "role_change",
    "refund_request",
    "account_anonymize",
  ]),
  targetType: z.enum(["user", "payment", "subscription", "vip_application"]),
  targetId: z.string().min(1).max(120),
  reason: reasonSchema,
  payload: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
  operationId: z.string().uuid().optional(),
});
export const requestAdminCriticalAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => requestSchema.parse(data))
  .handler(async ({ data, context }) => {
    const role = await requireAdmin(context);
    if (role !== "admin") throw new Error("CRITICAL_ACTION_MUST_BE_REQUESTED_BY_ADMIN");
    const operationId = data.operationId ?? crypto.randomUUID();
    const { data: existing } = await supabaseAdmin
      .from("admin_action_requests")
      .select("id, status")
      .eq("id", operationId)
      .maybeSingle();
    if (existing) return existing;
    const { data: request, error } = await supabaseAdmin
      .from("admin_action_requests")
      .insert({
        id: operationId,
        action_type: data.actionType,
        target_type: data.targetType,
        target_id: data.targetId,
        requested_by: context.userId,
        reason: data.reason,
        payload: data.payload,
        status: "pending",
      })
      .select("id, status, created_at")
      .single();
    if (error) throw new Error("CRITICAL_ACTION_REQUEST_FAILED");
    await audit(
      context.userId,
      "admin.action.request",
      data.targetType,
      data.targetId,
      data.reason,
      null,
      request,
      { actionType: data.actionType, operationId },
    );
    return request;
  });

export const approveAdminCriticalAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ requestId: z.string().uuid(), reason: reasonSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const role = await requireAdmin(context);
    if (role !== "owner") throw new Error("OWNER_APPROVAL_REQUIRED");
    const { data: request } = await supabaseAdmin
      .from("admin_action_requests")
      .select("*")
      .eq("id", data.requestId)
      .eq("status", "pending")
      .maybeSingle();
    if (!request) throw new Error("CRITICAL_ACTION_NOT_FOUND");
    if (request.requested_by === context.userId) throw new Error("SELF_APPROVAL_FORBIDDEN");
    const payload = (request.payload ?? {}) as Record<string, unknown>;
    let result: {
      approved: boolean;
      amount?: number;
      balanceAfter?: number;
      providerActionRequired?: boolean;
      role?: string;
      anonymized?: boolean;
    } = { approved: true };
    if (request.action_type === "premium_grant") {
      const until = typeof payload.premiumUntil === "string" ? payload.premiumUntil : null;
      if (!until || !request.target_id) throw new Error("PREMIUM_DATE_REQUIRED");
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ plan: "premium", premium_until: until })
        .eq("id", request.target_id);
      if (error) throw new Error("PREMIUM_GRANT_FAILED");
    } else if (request.action_type === "vip_grant") {
      if (!request.target_id) throw new Error("VIP_APPLICATION_REQUIRED");
      const { data: application } = await (supabaseAdmin as any)
        .from("vip_applications")
        .select("id, user_id, tier, status")
        .eq("id", request.target_id)
        .maybeSingle();
      if (!application || !["submitted", "under_review", "needs_info"].includes(application.status))
        throw new Error("VIP_APPLICATION_NOT_ELIGIBLE");
      const { data: existingGrant } = await (supabaseAdmin as any)
        .from("vip_grants")
        .select("id")
        .eq("user_id", application.user_id)
        .maybeSingle();
      if (existingGrant) throw new Error("VIP_ALREADY_GRANTED");
      const months = application.tier === "pro" ? 6 : 3;
      const startsAt = new Date();
      const endsAt = new Date(startsAt);
      endsAt.setMonth(endsAt.getMonth() + months);
      const { data: grant, error: grantError } = await (supabaseAdmin as any)
        .from("vip_grants")
        .insert({
          application_id: application.id,
          user_id: application.user_id,
          tier: application.tier,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          monthly_credits: 100,
          created_by: context.userId,
        })
        .select("id, starts_at, ends_at")
        .single();
      if (grantError || !grant) throw new Error("VIP_GRANT_FAILED");
      const { data: currentProfile } = await (supabaseAdmin as any)
        .from("profiles")
        .select("premium_until")
        .eq("id", application.user_id)
        .maybeSingle();
      const currentPremiumUntil = currentProfile?.premium_until
        ? new Date(currentProfile.premium_until).getTime()
        : 0;
      const effectivePremiumUntil =
        currentPremiumUntil > endsAt.getTime()
          ? new Date(currentPremiumUntil).toISOString()
          : endsAt.toISOString();
      const { error: profileError } = await (supabaseAdmin as any)
        .from("profiles")
        .update({
          plan: "premium",
          premium_until: effectivePremiumUntil,
          premium_source: "vip",
          vip_tier: application.tier,
        })
        .eq("id", application.user_id);
      if (profileError) throw new Error("VIP_PROFILE_UPDATE_FAILED");
      await (supabaseAdmin as any)
        .from("vip_applications")
        .update({
          status: "approved",
          reviewer_id: context.userId,
          reviewed_at: new Date().toISOString(),
          review_reason: request.reason,
        })
        .eq("id", application.id);
      await (supabaseAdmin as any).rpc("ensure_vip_monthly_credits", {
        p_user_id: application.user_id,
      });
      await (supabaseAdmin as any).from("user_notifications").insert({
        user_id: application.user_id,
        type: "vip_status",
        title: "Accès Premium gratuit activé",
        message: `Votre accès VIP ${application.tier === "pro" ? "Pro" : "Starter"} est actif pendant ${months} mois.`,
        link: "/premium/tableau-de-bord",
        entity_id: application.id,
      });
      result = { ...result, vipGrantId: grant.id, premiumUntil: grant.ends_at } as typeof result & {
        vipGrantId: string;
        premiumUntil: string;
      };
    } else if (request.action_type === "credits_adjust") {
      const amount = typeof payload.amount === "number" ? Math.trunc(payload.amount) : 0;
      if (!amount || !request.target_id) throw new Error("CREDIT_AMOUNT_REQUIRED");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("credits")
        .eq("id", request.target_id)
        .maybeSingle();
      if (!profile || profile.credits + amount < 0) throw new Error("INVALID_CREDIT_BALANCE");
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ credits: profile.credits + amount })
        .eq("id", request.target_id);
      if (error) throw new Error("CREDIT_ADJUST_FAILED");
      await supabaseAdmin.from("credits_ledger").insert({
        user_id: request.target_id,
        kind: amount > 0 ? "bonus" : "refund",
        amount,
        balance_after: profile.credits + amount,
        label: `Ajustement admin: ${request.reason}`,
        meta: { requestId: request.id },
      });
      result = { ...result, amount, balanceAfter: profile.credits + amount };
    } else if (request.action_type === "refund_request") {
      if (!request.target_id) throw new Error("PAYMENT_REQUIRED");
      const { error } = await supabaseAdmin
        .from("payments")
        .update({ status: "REFUND_REQUESTED" })
        .eq("id", request.target_id);
      if (error) throw new Error("REFUND_REQUEST_FAILED");
      result = { ...result, providerActionRequired: true };
    } else if (request.action_type === "role_change") {
      const nextRole =
        payload.role === "owner" || payload.role === "admin" || payload.role === "user"
          ? payload.role
          : null;
      if (!nextRole || !request.target_id) throw new Error("ROLE_REQUIRED");
      const { data: currentRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", request.target_id);
      if (nextRole !== "owner" && (currentRoles ?? []).some((item) => item.role === "owner")) {
        const { count: ownerCount } = await supabaseAdmin
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role", "owner");
        if ((ownerCount ?? 0) <= 1) throw new Error("LAST_OWNER_PROTECTED");
      }
      const { error: clearError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", request.target_id)
        .in("role", ["admin", "owner"]);
      if (clearError) throw new Error("ROLE_CHANGE_FAILED");
      if (nextRole !== "user") {
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: request.target_id, role: nextRole });
        if (roleError) throw new Error("ROLE_CHANGE_FAILED");
      }
      result = { ...result, role: nextRole };
    } else if (request.action_type === "account_anonymize") {
      if (!request.target_id) throw new Error("USER_REQUIRED");
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ display_name: "Utilisateur anonymisé", avatar_url: null, referral_code: null })
        .eq("id", request.target_id);
      if (error) throw new Error("ANONYMIZATION_FAILED");
      result = { ...result, anonymized: true };
    } else {
      throw new Error("ACTION_NOT_SUPPORTED");
    }
    await supabaseAdmin
      .from("admin_action_requests")
      .update({
        status: "executed",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        result,
      })
      .eq("id", request.id);
    await audit(
      context.userId,
      "admin.action.approve",
      request.target_type,
      request.target_id,
      data.reason,
      request,
      result,
      { requestId: request.id },
    );
    return { ok: true, result };
  });

export const getAdminPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => adminPaymentQuerySchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    let paymentsQuery = supabaseAdmin
      .from("payments")
      .select(
        "id, user_id, provider, external_id, pack_id, credits, amount_xaf, status, trans_id, provider_sale_id, credited_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false });
    if (data.status !== "all") paymentsQuery = paymentsQuery.eq("status", data.status);
    if (data.search) {
      const search = data.search.replace(/[(),]/g, " ").trim();
      if (search)
        paymentsQuery = paymentsQuery.or(
          `id.ilike.%${search}%,external_id.ilike.%${search}%,pack_id.ilike.%${search}%,provider.ilike.%${search}%`,
        );
    }
    const { data: rows, error } = await paymentsQuery.range(
      (data.page - 1) * data.pageSize,
      data.page * data.pageSize - 1,
    );
    if (error) throw new Error("ADMIN_PAYMENTS_UNAVAILABLE");
    return {
      payments: (rows ?? []).map((row) => ({
        ...row,
        trans_id: row.trans_id ?? row.provider_sale_id,
      })),
      hasMore: (rows ?? []).length === data.pageSize,
    };
  });

export const getAdminAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => pageSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: rows, error } = await supabaseAdmin
      .from("ai_analyses")
      .select(
        "id, user_id, home_team, away_team, match_id, prediction_market, prediction_pick, prediction_confidence, settlement_status, final_score, created_at, settled_at, engine_version, ai_status, data_quality_score, ai_latency_ms",
      )
      .order("created_at", { ascending: false })
      .range((data.page - 1) * data.pageSize, data.page * data.pageSize - 1);
    if (error) throw new Error("ADMIN_ANALYSES_UNAVAILABLE");
    return {
      analyses: (rows ?? []).map((row) => ({
        ...row,
        settlement_status: isActionablePrediction(row.prediction_pick)
          ? row.settlement_status
          : "unresolvable",
      })),
      hasMore: (rows ?? []).length === data.pageSize,
    };
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
  aiSuccessRate: number | null;
  averageDataQuality: number | null;
  averageAiLatencyMs: number | null;
  byMarket: Array<{ market: string; settled: number; won: number; hitRate: number }>;
  byConfidence: Array<{ label: string; settled: number; won: number; hitRate: number }>;
  engineVersions: Array<{ version: string; total: number }>;
  generatedAt: string;
};

export const getAdminPredictionQuality = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPredictionQuality> => {
    await requireAdmin(context);
    const { data: rows, error } = await supabaseAdmin
      .from("ai_analyses")
      .select(
        "id, match_id, result, prediction_pick, settlement_status, settlement_outcome, ai_status, prediction_market, prediction_confidence, data_quality_score, ai_latency_ms, engine_version",
      )
      .order("created_at", { ascending: true })
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
    let qualityTotal = 0;
    let qualityCount = 0;
    let latencyTotal = 0;
    let latencyCount = 0;
    const byMarket = new Map<string, { settled: number; won: number }>();
    const confidenceBuckets = [
      { label: "45–54 %", min: 45, max: 54, settled: 0, won: 0 },
      { label: "55–64 %", min: 55, max: 64, settled: 0, won: 0 },
      { label: "65–74 %", min: 65, max: 74, settled: 0, won: 0 },
      { label: "75 % et +", min: 75, max: 100, settled: 0, won: 0 },
    ];
    const engineVersions = new Map<string, number>();
    const evaluated = new Set<string>();
    for (const row of rows ?? []) {
      const actionable = isActionablePrediction(row.prediction_pick);
      if (!actionable || row.settlement_status === "unresolvable") unresolvable += 1;
      if (row.ai_status === "ai_enriched") aiEnriched += 1;
      if (row.ai_status === "ai_fallback") aiFallback += 1;
      if (row.ai_status === "statistical_only") statisticalOnly += 1;
      if (row.data_quality_score !== null && Number.isFinite(Number(row.data_quality_score))) {
        qualityTotal += Number(row.data_quality_score);
        qualityCount += 1;
      }
      if (Number.isFinite(Number(row.ai_latency_ms)) && Number(row.ai_latency_ms) > 0) {
        latencyTotal += Number(row.ai_latency_ms);
        latencyCount += 1;
      }
      const version = row.engine_version || "non renseignée";
      engineVersions.set(version, (engineVersions.get(version) ?? 0) + 1);
      if (!actionable || (row.settlement_status !== "won" && row.settlement_status !== "lost"))
        continue;
      const evaluationKey = JSON.stringify([
        row.match_id || row.id,
        row.prediction_market,
        row.prediction_pick,
      ]);
      if (evaluated.has(evaluationKey)) continue;
      evaluated.add(evaluationKey);
      if (row.settlement_status === "won") won += 1;
      if (row.settlement_status === "lost") lost += 1;
      const market = row.prediction_market || "Autre";
      const marketRow = byMarket.get(market) ?? { settled: 0, won: 0 };
      marketRow.settled += 1;
      if (row.settlement_status === "won") marketRow.won += 1;
      byMarket.set(market, marketRow);
      const confidence = Number(row.prediction_confidence);
      const bucket = confidenceBuckets.find(
        (item) => confidence >= item.min && confidence <= item.max,
      );
      if (bucket) {
        bucket.settled += 1;
        if (row.settlement_status === "won") bucket.won += 1;
      }
      const result =
        row.result && typeof row.result === "object" && !Array.isArray(row.result)
          ? row.result
          : null;
      const score = scoreMatchProbabilities(result?.probabilities, row.settlement_outcome);
      if (!score) continue;
      brierTotal += score.brier;
      logLossTotal += score.logLoss;
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
      aiSuccessRate: rows?.length ? Math.round((aiEnriched / rows.length) * 1000) / 10 : null,
      averageDataQuality: qualityCount ? Math.round((qualityTotal / qualityCount) * 10) / 10 : null,
      averageAiLatencyMs: latencyCount ? Math.round(latencyTotal / latencyCount) : null,
      byMarket: [...byMarket.entries()]
        .map(([market, value]) => ({
          market,
          ...value,
          hitRate: Math.round((value.won / value.settled) * 1000) / 10,
        }))
        .sort((a, b) => b.settled - a.settled),
      byConfidence: confidenceBuckets.map(({ label, settled: count, won: bucketWon }) => ({
        label,
        settled: count,
        won: bucketWon,
        hitRate: count ? Math.round((bucketWon / count) * 1000) / 10 : 0,
      })),
      engineVersions: [...engineVersions.entries()]
        .map(([version, total]) => ({ version, total }))
        .sort((a, b) => b.total - a.total),
      generatedAt: new Date().toISOString(),
    };
  });

/** État éditorial des sélections quotidiennes, sans exposer les choix aux routes publiques. */
export const getAdminDailyPredictionsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { dateInDouala, readDailyRows } = await import("./daily-predictions.server");
    const rows = await readDailyRows().catch(() => []);
    const byLeague = new Map<string, number>();
    for (const row of rows) {
      const league = String(row.league_name ?? "Compétition non renseignée");
      byLeague.set(league, (byLeague.get(league) ?? 0) + 1);
    }
    return {
      date: dateInDouala(),
      published: rows.length,
      pending: rows.filter((row) => row.status === "pending").length,
      settled: rows.filter((row) => row.status === "won" || row.status === "lost").length,
      generatedAt: rows[0]?.source_fetched_at ?? null,
      leagues: [...byLeague.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    };
  });

export const getAdminApiHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { getRelayitCredentialStatus } = await import("./relayit.server");
    const [quota, cache, football, ai, saspay, relayit, relayitWebhook, relayitCredentialStatus] = await Promise.all([
      getApiFootballQuotaState(),
      getApiFootballCacheState("/fixtures", { date: todayISO() }),
      getConfig("APIFOOTBALL_KEY"),
      getConfig("OPENROUTER_API_KEY"),
      getConfig("SASPAY_API_KEY"),
      getConfig("RELAYIT_API_KEY"),
      getConfig("RELAYIT_WEBHOOK_SECRET"),
      getRelayitCredentialStatus(),
    ]);
    return {
      apiFootball: { configured: Boolean(football), quota, cache },
      aiConfigured: Boolean(ai),
      saspayConfigured: Boolean(saspay),
      relayitConfigured: Boolean(relayit && relayitWebhook),
      relayitCredentialStatus,
      paymentProvider: getRuntimeEnv("PAYMENT_PROVIDER")?.trim().toLowerCase() === "relayit" ? "relayit" : "saspay",
      cloudflareConfigured: Boolean(getRuntimeEnv("PUBLIC_APP_URL")),
      checkedAt: new Date().toISOString(),
    };
  });

export const getAdminCommunity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const [{ data: messages }, { data: predictions }] = await Promise.all([
      (supabaseAdmin as any)
        .from("community_messages")
        .select("id, user_id, user_name, message, match_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("community_predictions")
        .select("id, user_id, user_name, fixture_id, home_team, away_team, prediction, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    return { messages: messages ?? [], predictions: predictions ?? [] };
  });

export const getAdminContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    return {
      bookmakers: BOOKMAKERS.map((item) => ({
        slug: item.slug,
        name: item.name,
        code: item.code,
        countries: item.countryPageSlugs ?? [],
        updatedAt: item.updatedAt,
      })),
      countries: SEO_COUNTRIES.map((item) => ({ slug: item.slug, name: item.name })),
    };
  });

/** Synthèse privée du programme de parrainage, réservée aux admins. */
export const getAdminReferralOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const db = supabaseAdmin as any;
    const [pending, qualified, rewards, activePro, latest, attributions] = await Promise.all([
      count("referral_attributions", [["status", "eq", "pending"]]),
      count("referral_attributions", [["status", "eq", "qualified"]]),
      count("referral_milestone_rewards"),
      db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gt("referral_pro_until", new Date().toISOString()),
      db
        .from("referral_milestone_rewards")
        .select("referrer_id, milestone, qualified_referral_count, starts_at, ends_at")
        .order("created_at", { ascending: false })
        .limit(8),
      db
        .from("referral_attributions")
        .select("referrer_id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(3000),
    ]);
    const progress = new Map<string, { qualified: number; pending: number; latestAt: string }>();
    for (const item of attributions.data ?? []) {
      const current = progress.get(item.referrer_id) ?? {
        qualified: 0,
        pending: 0,
        latestAt: item.created_at,
      };
      if (item.status === "qualified") current.qualified += 1;
      if (item.status === "pending") current.pending += 1;
      if (item.created_at > current.latestAt) current.latestAt = item.created_at;
      progress.set(item.referrer_id, current);
    }
    const leaderIds = [...progress.entries()]
      .sort(
        ([, a], [, b]) =>
          b.qualified - a.qualified ||
          b.pending - a.pending ||
          b.latestAt.localeCompare(a.latestAt),
      )
      .slice(0, 12)
      .map(([id]) => id);
    const { data: leaderProfiles } = leaderIds.length
      ? await db
          .from("profiles")
          .select("id, display_name, plan, referral_pro_until")
          .in("id", leaderIds)
      : { data: [] };
    const profilesById = new Map<
      string,
      { display_name: string | null; referral_pro_until: string | null }
    >(
      (
        (leaderProfiles ?? []) as Array<{
          id: string;
          display_name: string | null;
          referral_pro_until: string | null;
        }>
      ).map((profile) => [profile.id, profile]),
    );
    return {
      pending,
      qualified,
      rewards,
      activePro: activePro.count ?? 0,
      latestRewards: latest.data ?? [],
      leaders: leaderIds.map((id) => {
        const profile = profilesById.get(id);
        const item = progress.get(id)!;
        return {
          displayName: profile?.display_name ?? "Utilisateur",
          qualified: item.qualified,
          pending: item.pending,
          nextMilestone: (Math.floor(item.qualified / 25) + 1) * 25,
          activeProUntil: profile?.referral_pro_until ?? null,
        };
      }),
    };
  });

const affiliateReviewSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["approved", "paid", "rejected"]),
  reference: z.string().trim().max(120).default(""),
  note: z.string().trim().max(500).default(""),
});

/** Vue financière privée du programme Ambassadeurs. */
export const getAdminAffiliateOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const db = supabaseAdmin as any;
    const [settingsResult, commissionsResult, payoutsResult, tiersResult] = await Promise.all([
      db.from("affiliate_program_settings").select("enabled, tier_25_min_active, tier_30_min_active, tier_35_min_active, tier_40_min_active, tier_25_rate_bps, tier_30_rate_bps, tier_35_rate_bps, tier_40_rate_bps, tier_grace_days, commission_hold_days, minimum_payout_xaf").eq("id", true).maybeSingle(),
      db.from("affiliate_commissions").select("id, partner_id, referred_id, subscription_id, gross_amount_xaf, rate_bps, amount_xaf, status, available_at, created_at, paid_at").order("created_at", { ascending: false }).limit(5000),
      db.from("affiliate_payout_requests").select("id, partner_id, amount_xaf, payout_method, mobile_operator, mobile_number, status, requested_at, reviewed_at, payout_reference, admin_note").order("requested_at", { ascending: false }).limit(100),
      db.from("affiliate_tier_states").select("partner_id, active_paid_referrals, rate_bps, protected_until, updated_at").order("active_paid_referrals", { ascending: false }).limit(50),
    ]);
    if (settingsResult.error) throw new Error("AFFILIATE_SETTINGS_UNAVAILABLE");
    if (commissionsResult.error) throw new Error("AFFILIATE_COMMISSIONS_UNAVAILABLE");
    if (payoutsResult.error) throw new Error("AFFILIATE_PAYOUTS_UNAVAILABLE");

    const commissions = commissionsResult.data ?? [];
    const payouts = payoutsResult.data ?? [];
    const partnerIds = [...new Set([
      ...commissions.map((item: { partner_id: string }) => item.partner_id),
      ...payouts.map((item: { partner_id: string }) => item.partner_id),
      ...(tiersResult.data ?? []).map((item: { partner_id: string }) => item.partner_id),
    ])];
    const { data: profiles } = partnerIds.length
      ? await db.from("profiles").select("id, display_name").in("id", partnerIds)
      : { data: [] };
    const names = new Map<string, string>((profiles ?? []).map((item: { id: string; display_name: string | null }) => [item.id, item.display_name ?? "Utilisateur"]));
    const sum = (status?: string) => commissions.filter((item: { status: string }) => !status || item.status === status).reduce((total: number, item: { amount_xaf: number }) => total + Number(item.amount_xaf || 0), 0);

    return {
      settings: settingsResult.data,
      totals: {
        commissions: commissions.length,
        pendingXaf: sum("pending"),
        availableXaf: sum("available"),
        reservedXaf: sum("reserved"),
        paidXaf: sum("paid"),
        payoutRequests: payouts.length,
        pendingPayouts: payouts.filter((item: { status: string }) => item.status === "requested" || item.status === "approved").length,
      },
      payouts: payouts.map((item: Record<string, unknown>) => ({
        ...item,
        partnerName: names.get(String(item.partner_id)) ?? "Utilisateur",
      })),
      leaders: (tiersResult.data ?? []).map((item: Record<string, unknown>) => ({
        ...item,
        partnerName: names.get(String(item.partner_id)) ?? "Utilisateur",
      })),
    };
  });

/** Décision admin idempotente sur une demande de retrait. */
export const reviewAdminAffiliatePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => affiliateReviewSchema.parse(data))
  .handler(async ({ data, context }) => {
    const role = await requireAdmin(context);
    const { data: result, error } = await (supabaseAdmin as any).rpc("review_affiliate_payout_request", {
      p_request_id: data.requestId,
      p_status: data.status,
      p_admin_id: context.userId,
      p_reference: data.reference || null,
      p_note: data.note || null,
    });
    if (error) throw new Error("AFFILIATE_PAYOUT_REVIEW_FAILED");
    await audit(context.userId, `affiliate_payout_${data.status}`, "affiliate_payout_request", data.requestId, data.note || null, null, result, { role });
    return { ok: true };
  });

export const getAdminAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => pageSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: rows, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select(
        "id, actor_id, action, target_type, target_id, reason, before_state, after_state, request_id, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .range((data.page - 1) * data.pageSize, data.page * data.pageSize - 1);
    if (error) throw new Error("ADMIN_AUDIT_UNAVAILABLE");
    return { entries: rows ?? [], hasMore: (rows ?? []).length === data.pageSize };
  });

export const getAdminIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => pageSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const {
      data: rows,
      error,
      count,
    } = await supabaseAdmin
      .from("app_error_events")
      .select(
        "id, incident_id, route, category, status_code, device_family, browser_family, deployment_version, duration_ms, cache_id, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range((data.page - 1) * data.pageSize, data.page * data.pageSize - 1);
    if (error) throw new Error("ADMIN_INCIDENTS_UNAVAILABLE");
    return {
      entries: rows ?? [],
      total: count ?? 0,
      hasMore: (rows ?? []).length === data.pageSize,
    };
  });

export const getAdminActionRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data } = await supabaseAdmin
      .from("admin_action_requests")
      .select(
        "id, action_type, target_type, target_id, requested_by, reason, status, created_at, approved_by, approved_at, executed_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const exportAdminData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        dataset: z.enum(["users", "payments", "analyses", "audit"]),
        format: z.enum(["csv", "json"]).default("csv"),
        limit: z.number().int().min(1).max(2000).default(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const role = await requireAdmin(context);
    if (data.dataset === "audit" && role !== "owner") throw new Error("OWNER_EXPORT_REQUIRED");
    let rows: any[] = [];
    if (data.dataset === "users") {
      const { data: items } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, plan, credits, account_status, created_at, premium_until")
        .limit(data.limit);
      rows = items ?? [];
    }
    if (data.dataset === "payments") {
      const { data: items } = await supabaseAdmin
        .from("payments")
        .select("id, user_id, provider, pack_id, credits, amount_xaf, status, created_at")
        .limit(data.limit);
      rows = items ?? [];
    }
    if (data.dataset === "analyses") {
      const { data: items } = await supabaseAdmin
        .from("ai_analyses")
        .select(
          "id, user_id, home_team, away_team, match_id, prediction_market, prediction_pick, settlement_status, final_score, created_at",
        )
        .limit(data.limit);
      rows = items ?? [];
    }
    if (data.dataset === "audit") {
      const { data: items } = await supabaseAdmin
        .from("admin_audit_log")
        .select("id, actor_id, action, target_type, target_id, reason, request_id, created_at")
        .limit(data.limit);
      rows = items ?? [];
    }
    await audit(
      context.userId,
      "admin.export",
      data.dataset,
      null,
      "Export administratif",
      null,
      { rows: rows.length },
      { format: data.format, limit: data.limit },
    );
    if (data.format === "json")
      return {
        filename: `livefoot-${data.dataset}.json`,
        mime: "application/json",
        content: JSON.stringify(rows),
      };
    const keys = rows.length ? Object.keys(rows[0]) : [];
    const csv = [
      keys.join(","),
      ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? "")).join(",")),
    ].join("\n");
    return {
      filename: `livefoot-${data.dataset}.csv`,
      mime: "text/csv;charset=utf-8",
      content: csv,
    };
  });
