import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Génère un code de parrainage aléatoire 8 caractères (sans ambigus 0/O/1/I). */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Retourne le code de parrainage de l'utilisateur connecté.
 * En crée un si la colonne est encore nulle (sécurité post-migration).
 */
export const getMyReferralCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("id", context.userId)
      .maybeSingle();

    if (profile?.referral_code) return { code: profile.referral_code };

    // Génération de secours si le trigger n'a pas encore tourné
    let code = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      code = generateCode();
      const { data: created, error } = await supabaseAdmin
        .from("profiles")
        .update({ referral_code: code })
        .eq("id", context.userId)
        .is("referral_code", null)
        .select("referral_code")
        .maybeSingle();
      if (!error && created?.referral_code) return { code: created.referral_code };
    }

    // Deux onglets peuvent demander un code simultanément : on relit toujours
    // le code réellement enregistré plutôt que de renvoyer une valeur locale.
    const { data: latest } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("id", context.userId)
      .maybeSingle();
    if (!latest?.referral_code) throw new Error("Lien d'invitation indisponible.");
    return { code: latest.referral_code };
  });

/**
 * Enregistre un code de parrainage après inscription. La validation, le crédit
 * et les paliers Premium ne sont déclenchés qu'après confirmation du compte.
 * Idempotent : renvoie { ok: false, reason } si un autre code est déjà associé.
 */
export const applyReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ referralCode: z.string().min(6).max(12) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
    };
    const { data: attributed, error: attributeError } = await client.rpc("record_referral_attribution", {
      p_referred_id: context.userId,
      p_referral_code: data.referralCode,
    });
    if (attributeError) throw new Error("Invitation indisponible.");

    const result = Array.isArray(attributed) ? attributed[0] : attributed;
    if (!result || typeof result !== "object" || !(result as { ok?: boolean }).ok) {
      return { ok: false, reason: ((result as { reason?: string } | null)?.reason ?? "invalid_code") as "already_referred" | "invalid_code" | "self_referral" };
    }

    const { data: qualification } = await client.rpc("qualify_referral_for_user", {
      p_referred_id: context.userId,
    });
    const qualified = Array.isArray(qualification) ? qualification[0] : qualification;
    return {
      ok: true,
      qualified: Boolean((qualified as { qualified?: boolean } | null)?.qualified),
      rewardsGranted: Number((qualified as { rewards_granted?: number } | null)?.rewards_granted ?? 0),
    };
  });

/** Déclenché au retour d'une confirmation email ou connexion OAuth. */
export const qualifyMyReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
    };
    const { data, error } = await client.rpc("qualify_referral_for_user", { p_referred_id: context.userId });
    if (error) throw new Error("Validation de l'invitation indisponible.");
    const result = Array.isArray(data) ? data[0] : data;
    return {
      qualified: Boolean((result as { qualified?: boolean } | null)?.qualified),
      reason: (result as { reason?: string } | null)?.reason ?? "no_referral",
      rewardsGranted: Number((result as { rewards_granted?: number } | null)?.rewards_granted ?? 0),
    };
  });

/**
 * Statistiques de parrainage de l'utilisateur connecté.
 */
export const getMyReferralStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", context.userId);

    return { referralCount: count ?? 0 };
  });

/**
 * Données privées du tableau de parrainage.
 * Aucun e-mail ni identifiant interne n'est renvoyé au navigateur.
 */
export const getMyReferralDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const client = supabaseAdmin as unknown as {
      from: (table: string) => any;
    };
    const [{ data: profile }, { data: attributions }, { data: rewards }] = await Promise.all([
      supabaseAdmin.from("profiles").select("referral_code").eq("id", context.userId).maybeSingle(),
      client.from("referral_attributions").select("referred_id, status, created_at, qualified_at").eq("referrer_id", context.userId).order("created_at", { ascending: false }),
      client.from("referral_milestone_rewards").select("milestone, starts_at, ends_at").eq("referrer_id", context.userId).order("milestone", { ascending: false }),
    ]);

    const code = profile?.referral_code ?? null;
    const referralRows = attributions ?? [];
    const referrals = referralRows.map((item: { status: string; created_at: string; qualified_at: string | null }) => ({
      status: item.status,
      joinedAt: item.qualified_at ?? item.created_at,
    }));
    const qualifiedCount = referrals.filter((item: { status: string }) => item.status === "qualified").length;
    const pendingCount = referrals.filter((item: { status: string }) => item.status === "pending").length;
    const nextMilestone = (Math.floor(qualifiedCount / 25) + 1) * 25;

    return {
      code,
      referralLink: code ? `https://www.livefoot.fun/auth?ref=${code}` : null,
      referralCount: qualifiedCount,
      qualifiedCount,
      pendingCount,
      creditsEarned: qualifiedCount * 5,
      nextMilestone,
      remainingToNext: nextMilestone - qualifiedCount,
      milestonesEarned: (rewards ?? []).length,
      activeProUntil: (rewards ?? []).find((reward: { ends_at: string }) => new Date(reward.ends_at).getTime() > Date.now())?.ends_at ?? null,
      referrals,
    };
  });

export type AffiliateDashboardData = {
  code: string | null;
  referralLink: string | null;
  activeReferrals: number;
  commissionRateBps: number;
  nextThreshold: number;
  protectedUntil: string | null;
  pendingXaf: number;
  availableXaf: number;
  reservedXaf: number;
  paidXaf: number;
  totalXaf: number;
  minimumPayoutXaf: number;
  qualifiedReferrals: number;
  pendingReferrals: number;
  payoutProfile: { operator: "mtn" | "orange"; maskedNumber: string; acceptedAt: string } | null;
  recentCommissions: Array<{
    id: string;
    grossAmountXaf: number;
    amountXaf: number;
    rateBps: number;
    status: "pending" | "available" | "reserved" | "paid" | "reversed";
    availableAt: string;
    createdAt: string;
  }>;
  payouts: Array<{
    id: string;
    amountXaf: number;
    status: "requested" | "approved" | "paid" | "rejected" | "cancelled";
    requestedAt: string;
    reviewedAt: string | null;
    payoutReference: string | null;
  }>;
};

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function maskMobileNumber(value: string) {
  const normalized = value.trim();
  if (normalized.length <= 4) return "••••";
  const prefix = normalized.startsWith("+") ? normalized.slice(0, Math.min(4, normalized.length - 4)) : "";
  return `${prefix}••••${normalized.slice(-4)}`;
}

/**
 * Tableau privé Ambassadeurs. Les filleuls sont agrégés : aucune donnée
 * personnelle d'un tiers ne sort du serveur.
 */
export const getMyAffiliateDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AffiliateDashboardData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [summaryResult, profileResult, attributionResult, commissionResult, payoutResult] = await Promise.all([
      db.rpc("get_affiliate_dashboard", { p_partner_id: context.userId }),
      db
        .from("profiles")
        .select("referral_code")
        .eq("id", context.userId)
        .maybeSingle(),
      db
        .from("referral_attributions")
        .select("status")
        .eq("referrer_id", context.userId),
      db
        .from("affiliate_commissions")
        .select("id, gross_amount_xaf, amount_xaf, rate_bps, status, available_at, created_at")
        .eq("partner_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(40),
      db
        .from("affiliate_payout_requests")
        .select("id, amount_xaf, status, requested_at, reviewed_at, payout_reference")
        .eq("partner_id", context.userId)
        .order("requested_at", { ascending: false })
        .limit(20),
    ]);

    if (summaryResult.error) throw new Error("Programme Ambassadeurs momentanément indisponible.");
    const summary = Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data;
    const attributionRows = (attributionResult.data ?? []) as Array<{ status: string }>;
    const code = (profileResult.data as { referral_code?: string | null } | null)?.referral_code ?? null;

    const { data: payoutProfile } = await db
      .from("affiliate_payout_profiles")
      .select("mobile_operator, mobile_number, terms_accepted_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      code,
      referralLink: code ? `https://www.livefoot.fun/auth?ref=${code}` : null,
      activeReferrals: toNumber(summary?.active_referrals),
      commissionRateBps: toNumber(summary?.commission_rate_bps),
      nextThreshold: toNumber(summary?.next_threshold) || 1,
      protectedUntil: typeof summary?.protected_until === "string" ? summary.protected_until : null,
      pendingXaf: toNumber(summary?.pending_xaf),
      availableXaf: toNumber(summary?.available_xaf),
      reservedXaf: toNumber(summary?.reserved_xaf),
      paidXaf: toNumber(summary?.paid_xaf),
      totalXaf: toNumber(summary?.total_xaf),
      // Le seuil commercial ne peut jamais descendre sous 25 000 FCFA,
      // même si une ancienne ligne de configuration est incomplète.
      minimumPayoutXaf: Math.max(25_000, toNumber(summary?.minimum_payout_xaf)),
      qualifiedReferrals: attributionRows.filter((item) => item.status === "qualified").length,
      pendingReferrals: attributionRows.filter((item) => item.status === "pending").length,
      payoutProfile: payoutProfile
        ? {
            operator: payoutProfile.mobile_operator as "mtn" | "orange",
            maskedNumber: maskMobileNumber(payoutProfile.mobile_number),
            acceptedAt: payoutProfile.terms_accepted_at,
          }
        : null,
      recentCommissions: ((commissionResult.data ?? []) as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id),
        grossAmountXaf: toNumber(item.gross_amount_xaf),
        amountXaf: toNumber(item.amount_xaf),
        rateBps: toNumber(item.rate_bps),
        status: item.status as AffiliateDashboardData["recentCommissions"][number]["status"],
        availableAt: String(item.available_at),
        createdAt: String(item.created_at),
      })),
      payouts: ((payoutResult.data ?? []) as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id),
        amountXaf: toNumber(item.amount_xaf),
        status: item.status as AffiliateDashboardData["payouts"][number]["status"],
        requestedAt: String(item.requested_at),
        reviewedAt: typeof item.reviewed_at === "string" ? item.reviewed_at : null,
        payoutReference: typeof item.payout_reference === "string" ? item.payout_reference : null,
      })),
    };
  });

const payoutProfileSchema = z.object({
  operator: z.enum(["mtn", "orange"]),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "Saisissez un numéro Mobile Money valide."),
  acceptTerms: z.literal(true),
});

/** Enregistre le moyen de versement du compte connecté, côté serveur seulement. */
export const saveMyAffiliatePayoutProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => payoutProfileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("affiliate_payout_profiles")
      .upsert(
        {
          user_id: context.userId,
          payout_method: "mobile_money",
          mobile_operator: data.operator,
          mobile_number: data.mobileNumber.replace(/\s/g, ""),
          terms_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error("Impossible d’enregistrer votre moyen de versement.");
    return { ok: true };
  });

/** Réserve le solde disponible du compte connecté pour un versement manuel. */
export const requestMyAffiliatePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("request_affiliate_payout", {
      p_partner_id: context.userId,
    });
    if (error) {
      if (error.message?.includes("PROFILE_REQUIRED")) {
        throw new Error("Ajoutez d’abord votre numéro Mobile Money.");
      }
      if (error.message?.includes("MINIMUM_PAYOUT")) {
        throw new Error("Le solde minimum de retrait n’est pas encore atteint.");
      }
      throw new Error("La demande de versement est momentanément indisponible.");
    }
    const row = Array.isArray(data) ? data[0] : data;
    return { id: String(row?.request_id ?? ""), amountXaf: toNumber(row?.amount_xaf) };
  });
