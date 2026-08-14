import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const packCheckoutInput = z.object({
  packId: z.string().min(1).max(40),
  checkoutRequestId: z.string().uuid(),
});

const subCheckoutInput = z.object({
  planId: z.enum(["premium_monthly", "premium_yearly"]),
  checkoutRequestId: z.string().uuid(),
});

function appOrigin() {
  const value = process.env.PUBLIC_APP_URL ?? "https://www.livefoot.fun";
  const url = new URL(value);
  if (url.protocol !== "https:" || !["www.livefoot.fun", "livefoot.fun"].includes(url.hostname)) {
    throw new Error("Invalid payment configuration.");
  }
  return url.origin;
}

function createExternalId(prefix: "sub" | "pk") {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function duplicateCheckoutMessage() {
  return new Error("Ce paiement est déjà en préparation. Réessayez dans quelques instants.");
}

/** Crée un lien de souscription Fapshi pour l'Abonnement Premium. */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => subCheckoutInput.parse(data))
  .handler(async ({ data, context }) => {
    const { findPremiumPlan } = await import("./pricing");
    const plan = findPremiumPlan(data.planId);
    if (!plan) throw new Error("Plan d'abonnement inconnu.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("subscriptions")
      .select("id, trans_id, checkout_link, status")
      .eq("user_id", context.userId)
      .eq("checkout_request_id", data.checkoutRequestId)
      .maybeSingle();
    if (existingError) throw new Error("Impossible de préparer le paiement.");
    if (existing) {
      if (existing.checkout_link) {
        return {
          link: existing.checkout_link,
          transId: existing.trans_id,
          amountXaf: plan.priceXaf,
          planId: plan.id,
        };
      }
      throw duplicateCheckoutMessage();
    }

    const externalId = createExternalId("sub");

    // Reserve the checkout before calling Fapshi. This prevents a double click,
    // while the nullable provider id is reconciled by the webhook/verification.
    const { error: reservationError } = await supabaseAdmin.from("subscriptions").insert({
      user_id: context.userId,
      provider: "fapshi",
      trans_id: null,
      external_id: externalId,
      checkout_request_id: data.checkoutRequestId,
      checkout_link: null,
      plan_id: plan.id,
      amount_xaf: plan.priceXaf,
      status: "PENDING",
    });
    if (reservationError) {
      if (reservationError.code === "23505") throw duplicateCheckoutMessage();
      throw new Error("Impossible de préparer le paiement.");
    }

    const { initiatePay } = await import("./fapshi.server");

    try {
      const res = await initiatePay({
        amount: plan.priceXaf,
        email: context.claims?.email as string | undefined,
        userId: context.userId.replace(/-/g, ""),
        externalId,
        redirectUrl: `${appOrigin()}/profil`,
        message: `Abonnement ${plan.name} Livefoot IA`,
      });

      // Do not hold the browser on a second database write. The webhook and
      // manual verification attach trans_id/external_id idempotently later.
      void supabaseAdmin
        .from("subscriptions")
        .update({ trans_id: res.transId, checkout_link: res.link })
        .eq("user_id", context.userId)
        .eq("external_id", externalId)
        .then(() => undefined)
        .catch((error) => console.error("Subscription checkout reconciliation failed:", error));

      return { link: res.link, transId: res.transId, amountXaf: plan.priceXaf, planId: plan.id };
    } catch (error) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "FAILED" })
        .eq("user_id", context.userId)
        .eq("checkout_request_id", data.checkoutRequestId);
      throw error;
    }
  });

/** Crée un lien de paiement Fapshi (FCFA) pour un pack de crédits (Réservé aux membres Premium). */
export const createTopupCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => packCheckoutInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Vérification du plan : Seuls les membres Premium peuvent acheter des packs
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan, premium_until")
      .eq("id", context.userId)
      .maybeSingle();

    const isPremium =
      profile?.plan === "premium" &&
      (!profile.premium_until || new Date(profile.premium_until) > new Date());

    if (!isPremium) {
      throw new Error(
        "Les packs de crédits sont réservés aux membres Premium. Passez Premium d'abord !",
      );
    }

    const { findPack } = await import("./pricing");
    const pack = findPack(data.packId);
    if (!pack) throw new Error("Pack de crédits inconnu.");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("payments")
      .select("id, trans_id, link, checkout_link, status")
      .eq("user_id", context.userId)
      .eq("checkout_request_id", data.checkoutRequestId)
      .maybeSingle();
    if (existingError) throw new Error("Impossible de préparer le paiement.");
    if (existing) {
      const existingLink = existing.checkout_link ?? existing.link;
      if (existingLink) {
        return {
          link: existingLink,
          transId: existing.trans_id,
          amountXaf: pack.priceXaf,
          credits: pack.credits,
        };
      }
      throw duplicateCheckoutMessage();
    }

    const { initiatePay } = await import("./fapshi.server");

    const externalId = createExternalId("pk");

    const { error: reservationError } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      provider: "fapshi",
      trans_id: null,
      external_id: externalId,
      checkout_request_id: data.checkoutRequestId,
      checkout_link: null,
      pack_id: pack.id,
      credits: pack.credits,
      amount_xaf: pack.priceXaf,
      status: "PENDING",
      link: null,
    });
    if (reservationError) {
      if (reservationError.code === "23505") throw duplicateCheckoutMessage();
      throw new Error("Impossible de préparer le paiement.");
    }

    try {
      const res = await initiatePay({
        amount: pack.priceXaf,
        email: context.claims?.email as string | undefined,
        userId: context.userId.replace(/-/g, ""),
        externalId,
        redirectUrl: `${appOrigin()}/profil`,
        message: `Recharge ${pack.credits} crédits Livefoot IA`,
      });

      void supabaseAdmin
        .from("payments")
        .update({ trans_id: res.transId, link: res.link, checkout_link: res.link })
        .eq("user_id", context.userId)
        .eq("checkout_request_id", data.checkoutRequestId)
        .then(() => undefined)
        .catch((error) => console.error("Payment checkout reconciliation failed:", error));

      return {
        link: res.link,
        transId: res.transId,
        amountXaf: pack.priceXaf,
        credits: pack.credits,
      };
    } catch (error) {
      await supabaseAdmin
        .from("payments")
        .update({ status: "FAILED" })
        .eq("user_id", context.userId)
        .eq("checkout_request_id", data.checkoutRequestId);
      throw error;
    }
  });

/** Vérifie manuellement un paiement ou souscription (retour depuis Fapshi) et crédite si payé. */
export const verifyTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ transId: z.string().trim().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { settlePaymentOrSubscription } = await import("./payments.server");
    return await settlePaymentOrSubscription(data.transId, context.userId);
  });

/** Historique des recharges et souscriptions de l'utilisateur. */
export const getMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [paymentsRes, subsRes] = await Promise.all([
      context.supabase
        .from("payments")
        .select("id, trans_id, pack_id, credits, amount_xaf, status, link, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(10),
      context.supabase
        .from("subscriptions")
        .select("id, trans_id, plan_id, amount_xaf, status, current_period_end, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return {
      payments: paymentsRes.data ?? [],
      subscriptions: subsRes.data ?? [],
    };
  });
