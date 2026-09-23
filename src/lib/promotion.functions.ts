import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRuntimeEnv } from "@/lib/config.server";
import { getSasPayApiKey, initiateSasPayCheckout } from "@/lib/saspay.server";

const CAMPAIGN_SLUG = "decouverte-500-xaf";

export type PromoCampaign = {
  id: string;
  slug: string;
  name: string;
  priceXaf: number;
  credits: number;
  durationDays: number;
  welcomeCredits: number;
  notificationsPerDay: number;
  active: boolean;
  startsAt: string;
};

export type PromoOffer = {
  campaign: PromoCampaign | null;
  state: {
    status: "eligible" | "pending" | "purchased" | "expired" | "paused";
    eligibleFrom: string;
    expiresAt: string;
    purchasedAt: string | null;
  } | null;
};

function mapCampaign(row: any): PromoCampaign {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceXaf: Number(row.price_xaf),
    credits: Number(row.credits),
    durationDays: Number(row.duration_days),
    welcomeCredits: Number(row.welcome_credits),
    notificationsPerDay: Number(row.notifications_per_day),
    active: Boolean(row.active),
    startsAt: row.starts_at,
  };
}

function preferredPaymentProvider(): "relayit" | "saspay" {
  return getRuntimeEnv("PAYMENT_PROVIDER")?.trim().toLowerCase() === "relayit" ? "relayit" : "saspay";
}

async function isPreferredProviderConfigured() {
  if (preferredPaymentProvider() === "relayit") {
    const { isRelayitConfigured } = await import("@/lib/relayit.server");
    return isRelayitConfigured();
  }
  return Boolean(await getSasPayApiKey());
}

async function loadActiveCampaign() {
  // Do not show an offer until the active payment provider is configured. This
  // keeps the public CTA honest while the checkout is being migrated.
  if (!await isPreferredProviderConfigured()) return null;
  const { data, error } = await (supabaseAdmin as any)
    .from("promo_campaigns")
    .select("id, slug, name, price_xaf, credits, duration_days, welcome_credits, notifications_per_day, active, starts_at")
    .eq("slug", CAMPAIGN_SLUG)
    .eq("active", true)
    .is("stopped_at", null)
    .maybeSingle();
  if (error) return null;
  return data ? mapCampaign(data) : null;
}

export const getPublicPromoOffer = createServerFn({ method: "GET" }).handler(async (): Promise<PromoOffer> => {
  try {
    return { campaign: await loadActiveCampaign(), state: null };
  } catch {
    return { campaign: null, state: null };
  }
});

export const getPromoOffer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PromoOffer> => {
    const campaign = await loadActiveCampaign();
    if (!campaign) return { campaign: null, state: null };

    let { data: state } = await (supabaseAdmin as any)
      .from("promo_user_states")
      .select("status, eligible_from, expires_at, purchased_at")
      .eq("campaign_id", campaign.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!state) {
      const starts = new Date();
      const expires = new Date(starts.getTime() + campaign.durationDays * 86_400_000);
      const { data: created } = await (supabaseAdmin as any)
        .from("promo_user_states")
        .insert({ campaign_id: campaign.id, user_id: context.userId, eligible_from: starts.toISOString(), expires_at: expires.toISOString() })
        .select("status, eligible_from, expires_at, purchased_at")
        .single();
      state = created;
    }

    if (state && state.status === "eligible" && new Date(state.expires_at).getTime() <= Date.now()) {
      await (supabaseAdmin as any).from("promo_user_states").update({ status: "expired" }).eq("campaign_id", campaign.id).eq("user_id", context.userId);
      state = { ...state, status: "expired" };
    }

    return {
      campaign,
      state: state
        ? {
            status: state.status,
            eligibleFrom: state.eligible_from,
            expiresAt: state.expires_at,
            purchasedAt: state.purchased_at,
          }
        : null,
    };
  });

const checkoutInput = z.object({
  checkoutRequestId: z.string().uuid(),
});

function appOrigin() {
  const value = getRuntimeEnv("PUBLIC_APP_URL") ?? "https://www.livefoot.fun";
  const url = new URL(value);
  const productionHost = url.hostname === "www.livefoot.fun" || url.hostname === "livefoot.fun";
  const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((!productionHost || url.protocol !== "https:") && (!localHost || !["http:", "https:"].includes(url.protocol))) {
    throw new Error("Invalid payment configuration.");
  }
  return url.origin;
}

export const createPromoCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => checkoutInput.parse(input))
  .handler(async ({ data, context }) => {
    const campaign = await loadActiveCampaign();
    if (!campaign) throw new Error("Cette offre n'est plus disponible.");

    const { data: state, error: stateError } = await (supabaseAdmin as any)
      .from("promo_user_states")
      .select("id, status, expires_at, purchase_payment_id")
      .eq("campaign_id", campaign.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (stateError || !state) throw new Error("Cette offre n'est pas encore disponible pour votre compte.");
    if (state.status === "purchased") throw new Error("Cette offre a déjà été utilisée sur votre compte.");
    if (new Date(state.expires_at).getTime() <= Date.now()) {
      await (supabaseAdmin as any).from("promo_user_states").update({ status: "expired" }).eq("id", state.id);
      throw new Error("La période de cette offre est terminée.");
    }

    const { data: existingRequest } = await (supabaseAdmin as any)
      .from("payments")
      .select("id, trans_id, provider_sale_id, external_id, link, checkout_link, checkout_mode, status")
      .eq("user_id", context.userId)
      .eq("checkout_request_id", data.checkoutRequestId)
      .maybeSingle();
    if (existingRequest) {
      const link = existingRequest.checkout_link ?? existingRequest.link;
      const providerTransactionId = existingRequest.trans_id ?? existingRequest.provider_sale_id;
      if (link || providerTransactionId) return { link, transId: providerTransactionId, externalId: existingRequest.external_id, status: existingRequest.status, amountXaf: campaign.priceXaf, credits: campaign.credits };
      throw new Error("Ce paiement est déjà en préparation. Réessayez dans quelques instants.");
    }

    if (state.status === "pending" && state.purchase_payment_id) {
      const { data: pending } = await (supabaseAdmin as any).from("payments").select("trans_id, provider_sale_id, external_id, link, checkout_link, status").eq("id", state.purchase_payment_id).maybeSingle();
      const pendingLink = pending?.checkout_link ?? pending?.link;
      const pendingTransactionId = pending?.trans_id ?? pending?.provider_sale_id;
      if (pending && (pendingLink || pendingTransactionId)) return { link: pendingLink, transId: pendingTransactionId, externalId: pending.external_id, status: pending.status, amountXaf: campaign.priceXaf, credits: campaign.credits };
    }

    const externalId = `promo_${crypto.randomUUID().replaceAll("-", "")}`;
    const { data: payment, error: paymentError } = await (supabaseAdmin as any)
      .from("payments")
      .insert({
        user_id: context.userId,
        provider: preferredPaymentProvider(),
        trans_id: null,
        external_id: externalId,
        checkout_request_id: data.checkoutRequestId,
        checkout_link: null,
        checkout_mode: "hosted",
        pack_id: "promo_discovery",
        credits: campaign.credits,
        amount_xaf: campaign.priceXaf,
        status: "PENDING",
        link: null,
        promo_campaign_id: campaign.id,
        promo_user_state_id: state.id,
      })
      .select("id")
      .single();
    if (paymentError || !payment) throw new Error("Impossible de préparer le paiement.");

    await (supabaseAdmin as any).from("promo_user_states").update({ status: "pending", purchase_payment_id: payment.id }).eq("id", state.id);

    try {
      const email = typeof context.claims?.email === "string" ? context.claims.email.trim() : "";
      if (!email) throw new Error("missing_email");
      const name = typeof context.claims?.user_metadata === "object" && context.claims.user_metadata
        ? String((context.claims.user_metadata as Record<string, unknown>).full_name ?? (context.claims.user_metadata as Record<string, unknown>).name ?? "LiveFoot IA")
        : "LiveFoot IA";
      const result = preferredPaymentProvider() === "relayit"
        ? await (async () => {
            const { initiateRelayitCheckout } = await import("@/lib/relayit.server");
            return initiateRelayitCheckout({
              amountXaf: campaign.priceXaf,
              email,
              customerName: name,
              externalId,
              description: `Offre découverte ${campaign.credits} crédits Livefoot IA`,
              returnUrl: `${appOrigin()}/profil?payment=${encodeURIComponent(externalId)}`,
            });
          })()
        : await initiateSasPayCheckout({
            amountXaf: campaign.priceXaf,
            email,
            customerName: name,
            externalId,
            description: `Offre découverte ${campaign.credits} crédits Livefoot IA`,
            returnUrl: `${appOrigin()}/profil?payment=${encodeURIComponent(externalId)}`,
          });
      const { error: attachError } = await (supabaseAdmin as any).from("payments").update({ provider_sale_id: result.id, link: result.checkoutUrl, checkout_link: result.checkoutUrl }).eq("id", payment.id);
      if (attachError) throw new Error("Impossible de finaliser la préparation du paiement.");
      return { link: result.checkoutUrl, transId: result.id, externalId, status: "PENDING", amountXaf: campaign.priceXaf, credits: campaign.credits };
    } catch {
      await (supabaseAdmin as any).from("payments").update({ status: "FAILED" }).eq("id", payment.id);
      await (supabaseAdmin as any).from("promo_user_states").update({ status: "eligible", purchase_payment_id: null }).eq("id", state.id);
      throw new Error("La page de paiement n'a pas pu être ouverte. Réessayez dans quelques instants.");
    }
  });

const pushSubscriptionInput = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(16).max(256),
  auth: z.string().min(8).max(256),
  contentEncoding: z.enum(["aes128gcm", "aesgcm"]).default("aes128gcm"),
  deviceFamily: z.enum(["mobile", "tablet", "desktop"]).default("mobile"),
});

export const getPushConfig = createServerFn({ method: "GET" }).handler(async () => ({
  publicKey: getRuntimeEnv("WEB_PUSH_VAPID_PUBLIC_KEY") ?? null,
}));

export const registerPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => pushSubscriptionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (supabaseAdmin as any).from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        content_encoding: data.contentEncoding,
        device_family: data.deviceFamily,
        active: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) throw new Error("Impossible d'activer les notifications.");
    return { ok: true };
  });

export const unregisterPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ endpoint: z.string().url().max(2048) }).parse(input))
  .handler(async ({ data, context }) => {
    await (supabaseAdmin as any).from("push_subscriptions").update({ active: false }).eq("user_id", context.userId).eq("endpoint", data.endpoint);
    return { ok: true };
  });
