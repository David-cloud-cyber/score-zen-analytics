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
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ referral_code: code })
        .eq("id", context.userId)
        .is("referral_code", null);
      if (!error) break;
    }
    return { code };
  });

/**
 * Applique un code de parrainage juste après inscription.
 * - Crédite +5 au parrain
 * - Marque le filleul comme parrainé (referred_by)
 * Idempotent : renvoie { ok: false, reason } si déjà utilisé.
 */
export const applyReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ referralCode: z.string().min(6).max(12) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Vérifier si le filleul a déjà un parrain
    const { data: myProfile } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .eq("id", context.userId)
      .maybeSingle();

    if (!myProfile) throw new Error("Profil introuvable.");
    if ((myProfile as { referred_by?: string | null }).referred_by) {
      return { ok: false, reason: "already_referred" as const };
    }

    // Trouver le parrain par son code
    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id, credits")
      .eq("referral_code", data.referralCode.toUpperCase())
      .maybeSingle();

    if (!referrer) return { ok: false, reason: "invalid_code" as const };
    if (referrer.id === context.userId) return { ok: false, reason: "self_referral" as const };

    // Créditer +5 au parrain
    const referrerNewBalance = referrer.credits + 5;
    await supabaseAdmin
      .from("profiles")
      .update({ credits: referrerNewBalance })
      .eq("id", referrer.id);

    await supabaseAdmin.from("credits_ledger").insert({
      user_id: referrer.id,
      kind: "bonus" as const,
      amount: 5,
      balance_after: referrerNewBalance,
      label: "Parrainage — nouvel ami inscrit 🎉",
    });

    // Marquer le filleul comme parrainé
    await supabaseAdmin
      .from("profiles")
      .update({ referred_by: referrer.id })
      .eq("id", context.userId);

    return { ok: true };
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

    const [{ data: profile }, { data: referredProfiles }, { data: rewards }] = await Promise.all([
      supabaseAdmin.from("profiles").select("referral_code").eq("id", context.userId).maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("display_name, created_at")
        .eq("referred_by", context.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("credits_ledger")
        .select("amount")
        .eq("user_id", context.userId)
        .eq("kind", "bonus")
        .ilike("label", "Parrainage%"),
    ]);

    const code = profile?.referral_code ?? null;
    const referrals = (referredProfiles ?? []).map((item) => ({
      displayName: item.display_name?.trim() || "Nouveau membre",
      joinedAt: item.created_at,
    }));

    return {
      code,
      referralLink: code ? `https://www.livefoot.fun/auth?ref=${code}` : null,
      referralCount: referrals.length,
      creditsEarned: (rewards ?? []).reduce((sum, reward) => sum + Math.max(0, reward.amount), 0),
      referrals,
    };
  });
