import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BOOKMAKERS } from "@/data/bookmakers";

export type VipTier = "starter" | "pro";
export type VipApplicationStatus = "submitted" | "under_review" | "needs_info" | "approved" | "rejected" | "expired";

const tierRules: Record<VipTier, { minimum: number; months: number }> = {
  starter: { minimum: 10_000, months: 3 },
  pro: { minimum: 25_000, months: 6 },
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

function clean(value: string, max: number) {
  return value.replace(/[<>]/g, "").replace(/[\u0000-\u001F]/g, " ").trim().slice(0, max);
}

function partnerFor(slug: string, code: string) {
  const partner = BOOKMAKERS.find((item) => item.slug === slug);
  if (!partner || partner.code.toLowerCase() !== code.trim().toLowerCase()) throw new Error("Ce partenaire ou ce code n'est pas disponible.");
  return partner;
}

const applicationInput = z.object({
  tier: z.enum(["starter", "pro"]),
  partnerSlug: z.string().trim().min(1).max(80),
  promoCode: z.string().trim().min(2).max(32),
  bookmakerAccountId: z.string().trim().min(2).max(120),
  fullName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(160),
  depositAmountXaf: z.number().int().positive().max(10_000_000),
  depositDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  depositReference: z.string().trim().min(3).max(120),
  proofNote: z.string().trim().max(500).optional().default(""),
  regularBettorConfirmed: z.boolean().refine(Boolean, "Confirmez votre activité régulière."),
  responsibleGamingConfirmed: z.boolean().refine(Boolean, "Confirmez les règles de jeu responsable."),
});

export const getMyVipApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = await db();
    const { data, error } = await client.from("vip_applications").select("id, tier, partner_slug, promo_code, bookmaker_account_id, full_name, contact_email, deposit_amount_xaf, deposit_date, deposit_reference, proof_note, status, review_reason, reviewed_at, created_at, updated_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error("Impossible de charger votre demande VIP.");
    return data ?? null;
  });

export const submitVipApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => applicationInput.parse(input))
  .handler(async ({ data, context }) => {
    const rule = tierRules[data.tier];
    if (data.depositAmountXaf < rule.minimum) throw new Error(`Le dépôt minimum pour cette offre est de ${rule.minimum.toLocaleString("fr-FR")} FCFA.`);
    partnerFor(data.partnerSlug, data.promoCode);
    const client = await db();
    const { data: existingGrant } = await client.from("vip_grants").select("id").eq("user_id", context.userId).maybeSingle();
    if (existingGrant) throw new Error("Votre compte a déjà bénéficié d'un accès VIP.");
    const { data: existing } = await client.from("vip_applications").select("id, status").eq("user_id", context.userId).in("status", ["submitted", "under_review", "needs_info", "approved"]).maybeSingle();
    if (existing) throw new Error("Une demande VIP est déjà en cours ou a déjà été validée.");
    const { data: row, error } = await client.from("vip_applications").insert({
      user_id: context.userId,
      tier: data.tier,
      partner_slug: data.partnerSlug,
      promo_code: data.promoCode.toUpperCase(),
      bookmaker_account_id: clean(data.bookmakerAccountId, 120),
      full_name: clean(data.fullName, 120),
      contact_email: data.contactEmail.toLowerCase(),
      deposit_amount_xaf: data.depositAmountXaf,
      deposit_date: data.depositDate,
      deposit_reference: clean(data.depositReference, 120),
      proof_note: data.proofNote ? clean(data.proofNote, 500) : null,
      regular_bettor_confirmed: data.regularBettorConfirmed,
      responsible_gaming_confirmed: data.responsibleGamingConfirmed,
      status: "submitted",
    }).select("id, tier, partner_slug, promo_code, status, created_at").single();
    if (error || !row) throw new Error("Votre demande n'a pas pu être envoyée.");
    return row;
  });

async function requireVipAdmin(context: any): Promise<"admin" | "owner"> {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "owner"]);
  if (error) throw new Error("ADMIN_ROLE_LOOKUP_FAILED");
  if ((data ?? []).some((item: any) => item.role === "owner")) return "owner";
  if ((data ?? []).some((item: any) => item.role === "admin")) return "admin";
  throw new Error("ADMIN_FORBIDDEN");
}

const adminListInput = z.object({ page: z.number().int().min(1).max(100).default(1), pageSize: z.number().int().min(10).max(100).default(25), status: z.string().optional().default("all") });

export const getAdminVipApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => adminListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await requireVipAdmin(context);
    const client = await db();
    let query = client.from("vip_applications").select("*").order("created_at", { ascending: false }).range((data.page - 1) * data.pageSize, data.page * data.pageSize - 1);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error("Impossible de charger les demandes VIP.");
    return { applications: rows ?? [], hasMore: (rows ?? []).length === data.pageSize };
  });

const reviewInput = z.object({ applicationId: z.string().uuid(), status: z.enum(["under_review", "needs_info", "rejected"]), reason: z.string().trim().min(8).max(500) });

export const reviewVipApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reviewInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireVipAdmin(context);
    const client = await db();
    const { data: application } = await client.from("vip_applications").select("id, status, user_id").eq("id", data.applicationId).maybeSingle();
    if (!application) throw new Error("Demande VIP introuvable.");
    if (["approved", "expired"].includes(application.status)) throw new Error("Cette demande ne peut plus être modifiée.");
    const { error } = await client.from("vip_applications").update({ status: data.status, reviewer_id: context.userId, review_reason: clean(data.reason, 500), reviewed_at: new Date().toISOString() }).eq("id", data.applicationId);
    if (error) throw new Error("La demande VIP n'a pas pu être mise à jour.");
    await client.from("user_notifications").insert({ user_id: application.user_id, type: "vip_status", title: data.status === "needs_info" ? "Informations nécessaires" : "Demande VIP mise à jour", message: data.status === "rejected" ? "Votre demande VIP n'a pas été acceptée." : data.reason, link: "/vip", entity_id: data.applicationId });
    return { ok: true };
  });

export const requestVipGrantApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ applicationId: z.string().uuid(), reason: z.string().trim().min(8).max(500), operationId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const role = await requireVipAdmin(context);
    if (role !== "admin") throw new Error("Une demande VIP doit être soumise par un administrateur puis validée par un propriétaire distinct.");
    const client = await db();
    const { data: application } = await client.from("vip_applications").select("id, status, tier, user_id").eq("id", data.applicationId).maybeSingle();
    if (!application || !["submitted", "under_review", "needs_info"].includes(application.status)) throw new Error("Cette demande n'est pas prête pour validation.");
    const operationId = data.operationId ?? crypto.randomUUID();
    const { data: existing } = await client.from("admin_action_requests").select("id, status").eq("id", operationId).maybeSingle();
    if (existing) return existing;
    const { data: request, error } = await client.from("admin_action_requests").insert({ id: operationId, action_type: "vip_grant", target_type: "vip_application", target_id: data.applicationId, requested_by: context.userId, reason: data.reason, payload: { tier: application.tier, userId: application.user_id }, status: "pending" }).select("id, status, created_at").single();
    if (error || !request) throw new Error("La validation VIP n'a pas pu être préparée.");
    await client.from("vip_applications").update({ status: "under_review", reviewer_id: context.userId }).eq("id", data.applicationId);
    await client.from("admin_audit_log").insert({ actor_id: context.userId, action: "vip.grant.request", target_type: "vip_application", target_id: data.applicationId, reason: data.reason, after_state: request, metadata: { operationId } });
    return request;
  });

export async function ensureVipMonthlyCredits(userId: string) {
  const client = await db();
  await client.rpc("ensure_vip_monthly_credits", { p_user_id: userId });
}

export { tierRules };
