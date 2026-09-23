import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getRuntimeEnv } from "./config.server";

const relayitCheckoutDetailsSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  currency: z.enum(["XAF", "XOF"]),
  network: z.string().trim().min(2).max(40),
  phone: z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/),
}).optional();

const packCheckoutInput = z.object({
  packId: z.string().min(1).max(40),
  checkoutRequestId: z.string().uuid(),
  relayit: relayitCheckoutDetailsSchema,
});

const subCheckoutInput = z.object({
  planId: z.enum(["premium_monthly", "premium_yearly"]),
  checkoutRequestId: z.string().uuid(),
  relayit: relayitCheckoutDetailsSchema,
});

function appOrigin() {
  const value = getRuntimeEnv("PUBLIC_APP_URL") ?? "https://www.livefoot.fun";
  const url = new URL(value);
  if (url.protocol !== "https:" || !["www.livefoot.fun", "livefoot.fun"].includes(url.hostname)) {
    throw new Error("Invalid payment configuration.");
  }
  return url.origin;
}

function createExternalId(prefix: "sub" | "pk") {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function preferredPaymentProvider(): "relayit" | "saspay" {
  return getRuntimeEnv("PAYMENT_PROVIDER")?.trim().toLowerCase() === "relayit" ? "relayit" : "saspay";
}

export const getActivePaymentProvider = createServerFn({ method: "GET" }).handler(() => ({
  provider: preferredPaymentProvider(),
}));

export const getRelayitCheckoutOptions = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ countryCode: z.string().regex(/^[A-Z]{2}$/).optional() }).parse(input))
  .handler(async ({ data }) => {
    const { getRelayitPaymentCountries, getRelayitPaymentNetworks } = await import("./relayit.server");
    if (data.countryCode) return { countries: [], networks: await getRelayitPaymentNetworks(data.countryCode) };
    return { countries: await getRelayitPaymentCountries(), networks: [] };
  });

function duplicateCheckoutMessage() {
  return new Error("Ce paiement est déjà en préparation. Réessayez dans quelques instants.");
}

function publicPaymentError() {
  return new Error("La page de paiement n'a pas pu être ouverte. Réessayez dans quelques instants.");
}

function assertPreferredProviderDetails(details: z.infer<typeof relayitCheckoutDetailsSchema>) {
  if (preferredPaymentProvider() === "relayit" && !details) {
    throw new Error("Indiquez votre pays, votre réseau et votre numéro Mobile Money pour continuer avec Relayit.");
  }
}

function customerDetails(claims: unknown) {
  const record = claims && typeof claims === "object" ? (claims as Record<string, unknown>) : {};
  const metadata = record.user_metadata && typeof record.user_metadata === "object"
    ? (record.user_metadata as Record<string, unknown>)
    : {};
  const email = typeof record.email === "string" ? record.email.trim() : "";
  const rawName = typeof metadata.name === "string" ? metadata.name : typeof metadata.full_name === "string" ? metadata.full_name : "LiveFoot IA";
  const parts = rawName.trim().split(/\s+/).filter(Boolean);
  return {
    email,
    firstName: (parts[0] ?? "LiveFoot").slice(0, 50),
    lastName: (parts.slice(1).join(" ") || "IA").slice(0, 50),
    phone: normalizePhone(typeof record.phone === "string" ? record.phone : typeof metadata.phone === "string" ? metadata.phone : undefined),
  };
}

function normalizePhone(value: string | undefined) {
  const normalized = value?.replace(/[\s()-]/g, "");
  return normalized && /^\+?[0-9]{8,15}$/.test(normalized)
    ? { number: normalized, countryCode: "CM" }
    : undefined;
}

async function startPreferredCheckout(params: {
  amount: number;
  claims: unknown;
  userId: string;
  externalId: string;
  message: string;
  relayit?: z.infer<typeof relayitCheckoutDetailsSchema>;
}) {
  let customer = customerDetails(params.claims);
  if (!customer.email) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.admin.getUserById(params.userId);
    const fallbackEmail = data.user?.email?.trim() ?? "";
    if (fallbackEmail) customer = { ...customer, email: fallbackEmail };
  }
  if (!customer.email) throw publicPaymentError();

  try {
    const provider = preferredPaymentProvider();
    if (provider === "relayit") {
      const { initiateRelayitCheckout } = await import("./relayit.server");
      const checkout = await initiateRelayitCheckout({
        amountXaf: params.amount,
        email: customer.email,
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        phone: params.relayit?.phone ?? customer.phone?.number,
        country: params.relayit?.country ?? "CM",
        currency: params.relayit?.currency ?? "XAF",
        network: params.relayit?.network ?? "",
        externalId: params.externalId,
        description: params.message,
        returnUrl: `${appOrigin()}/profil?payment=${encodeURIComponent(params.externalId)}`,
      });
      return {
        provider,
        mode: "hosted" as const,
        link: checkout.checkoutUrl,
        transId: checkout.id,
        customerEmail: customer.email,
      };
    }

    const { initiateSasPayCheckout } = await import("./saspay.server");
    const checkout = await initiateSasPayCheckout({
      amountXaf: params.amount,
      email: customer.email,
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      phone: customer.phone?.number,
      externalId: params.externalId,
      description: params.message,
      returnUrl: `${appOrigin()}/profil?payment=${encodeURIComponent(params.externalId)}`,
    });
    return {
      provider,
      mode: "hosted" as const,
      link: checkout.checkoutUrl,
      transId: checkout.id,
      customerEmail: customer.email,
    };
  } catch (error) {
    console.error(`${preferredPaymentProvider()} checkout failed`, error instanceof Error ? error.message : "unknown");
    throw publicPaymentError();
  }
}

/** Crée une session de paiement SasPay pour l'Abonnement Premium. */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => subCheckoutInput.parse(data))
  .handler(async ({ data, context }) => {
    const { findPremiumPlan } = await import("./pricing");
    const plan = findPremiumPlan(data.planId);
    if (!plan) throw new Error("Plan d'abonnement inconnu.");
    assertPreferredProviderDetails(data.relayit);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("subscriptions")
      .select("id, trans_id, provider_sale_id, external_id, checkout_link, checkout_mode, status, provider")
      .eq("user_id", context.userId)
      .eq("checkout_request_id", data.checkoutRequestId)
      .maybeSingle();
    if (existingError) throw new Error("Impossible de préparer le paiement.");
    if (existing) {
      const providerTransactionId = existing.trans_id ?? existing.provider_sale_id;
      if (existing.checkout_link || providerTransactionId) {
        return {
          link: existing.checkout_link,
          transId: providerTransactionId,
          externalId: existing.external_id,
          provider: existing.provider,
          mode: existing.checkout_mode ?? "hosted",
          status: existing.status,
          amountXaf: plan.priceXaf,
          planId: plan.id,
        };
      }
      throw duplicateCheckoutMessage();
    }

    const externalId = createExternalId("sub");
    const customer = customerDetails(context.claims);

    // Reserve the checkout before calling SasPay. This prevents a double click,
    // while the nullable provider id is reconciled by the webhook/verification.
    const { error: reservationError } = await supabaseAdmin.from("subscriptions").insert({
      user_id: context.userId,
      provider: preferredPaymentProvider(),
      trans_id: null,
      external_id: externalId,
      checkout_request_id: data.checkoutRequestId,
      checkout_link: null,
      checkout_mode: "hosted",
      plan_id: plan.id,
      amount_xaf: plan.priceXaf,
      customer_email: customer.email || null,
      status: "PENDING",
    });
    if (reservationError) {
      if (reservationError.code === "23505") throw duplicateCheckoutMessage();
      throw new Error("Impossible de préparer le paiement.");
    }

    try {
      const res = await startPreferredCheckout({
        amount: plan.priceXaf,
        claims: context.claims,
        userId: context.userId,
        externalId,
        message: `Abonnement ${plan.name} Livefoot IA`,
        relayit: data.relayit,
      });

      // Persist the checkout before redirecting. Unawaited work can be cancelled
      // by the Worker, leaving a paid checkout with no local identifier.
      const { error: attachError } = await supabaseAdmin
            .from("subscriptions")
            .update({ provider_sale_id: res.transId, checkout_link: res.link, checkout_mode: res.mode, customer_email: res.customerEmail })
            .eq("user_id", context.userId)
            .eq("external_id", externalId);
      if (attachError) throw new Error("Impossible de finaliser la préparation du paiement.");

      return { link: res.link, transId: res.transId, externalId, provider: res.provider, mode: res.mode, status: "PENDING", amountXaf: plan.priceXaf, planId: plan.id };
    } catch (error) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "FAILED" })
        .eq("user_id", context.userId)
        .eq("checkout_request_id", data.checkoutRequestId);
      throw error;
    }
  });

/** Crée une session de paiement SasPay (FCFA) pour un pack de crédits (Réservé aux membres Premium). */
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
    assertPreferredProviderDetails(data.relayit);

    const { findPack } = await import("./pricing");
    const pack = findPack(data.packId);
    if (!pack) throw new Error("Pack de crédits inconnu.");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("payments")
      .select("id, trans_id, provider_sale_id, external_id, link, checkout_link, checkout_mode, status, provider")
      .eq("user_id", context.userId)
      .eq("checkout_request_id", data.checkoutRequestId)
      .maybeSingle();
    if (existingError) throw new Error("Impossible de préparer le paiement.");
    if (existing) {
      const existingLink = existing.checkout_link ?? existing.link;
      const providerTransactionId = existing.trans_id ?? existing.provider_sale_id;
      if (existingLink || providerTransactionId) {
        return {
          link: existingLink,
          transId: providerTransactionId,
          externalId: existing.external_id,
          provider: existing.provider,
          mode: existing.checkout_mode ?? "hosted",
          status: existing.status,
          amountXaf: pack.priceXaf,
          credits: pack.credits,
        };
      }
      throw duplicateCheckoutMessage();
    }

    const externalId = createExternalId("pk");
    const customer = customerDetails(context.claims);

    const { error: reservationError } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      provider: preferredPaymentProvider(),
      trans_id: null,
      external_id: externalId,
      checkout_request_id: data.checkoutRequestId,
      checkout_link: null,
      checkout_mode: "hosted",
      pack_id: pack.id,
      credits: pack.credits,
      amount_xaf: pack.priceXaf,
      customer_email: customer.email || null,
      status: "PENDING",
      link: null,
    });
    if (reservationError) {
      if (reservationError.code === "23505") throw duplicateCheckoutMessage();
      throw new Error("Impossible de préparer le paiement.");
    }

    try {
      const res = await startPreferredCheckout({
        amount: pack.priceXaf,
        claims: context.claims,
        userId: context.userId,
        externalId,
        message: `Recharge ${pack.credits} crédits Livefoot IA`,
        relayit: data.relayit,
      });

      const { error: attachError } = await supabaseAdmin
            .from("payments")
            .update({ provider_sale_id: res.transId, link: res.link, checkout_link: res.link, checkout_mode: res.mode, customer_email: res.customerEmail })
            .eq("user_id", context.userId)
            .eq("checkout_request_id", data.checkoutRequestId);
      if (attachError) throw new Error("Impossible de finaliser la préparation du paiement.");

      return {
        link: res.link,
        transId: res.transId,
        externalId,
        provider: res.provider,
        mode: res.mode,
        status: "PENDING",
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

/** Vérifie manuellement un paiement ou souscription après le retour du fournisseur. */
export const verifyTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ transId: z.string().trim().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { settlePaymentOrSubscription } = await import("./payments.server");
    return await settlePaymentOrSubscription(data.transId, context.userId);
  });

export const verifyCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      externalId: z.string().trim().regex(/^(sub|pk|promo)_[A-Za-z0-9]+$/).max(120),
      transId: z.string().trim().min(1).max(120).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { settleByExternalId } = await import("./payments.server");
    return settleByExternalId(data.externalId, context.userId);
  });

/** Historique des recharges et souscriptions de l'utilisateur. */
export const getMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [paymentsRes, subsRes] = await Promise.all([
      context.supabase
        .from("payments")
        .select("id, trans_id, provider_sale_id, pack_id, credits, amount_xaf, status, link, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(10),
      context.supabase
        .from("subscriptions")
        .select("id, trans_id, provider_sale_id, plan_id, amount_xaf, status, current_period_end, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return {
      payments: (paymentsRes.data ?? []).map(({ provider_sale_id: _providerSaleId, ...row }) => ({ ...row, trans_id: row.trans_id ?? _providerSaleId })),
      subscriptions: (subsRes.data ?? []).map(({ provider_sale_id: _providerSaleId, ...row }) => ({ ...row, trans_id: row.trans_id ?? _providerSaleId })),
    };
  });
