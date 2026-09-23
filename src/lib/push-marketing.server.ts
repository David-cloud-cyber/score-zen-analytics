import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRuntimeEnv } from "@/lib/config.server";

const db = supabaseAdmin as any;

const PAYMENT_ANNOUNCEMENT_ID = "payment-provider-saspay-20260902";
const PAYMENT_ANNOUNCEMENT_CAMPAIGN = "paiements-saspay-20260902";

/**
 * Delivers the provider migration notice once to every existing account.
 * Internal notifications are available to every account; browser push is
 * only sent to subscriptions that the user explicitly authorized.
 */
async function ensurePaymentProviderAnnouncement() {
  try {
    const [{ data: profiles }, { data: existing }] = await Promise.all([
      db.from("profiles").select("id").limit(10_000),
      db.from("user_notifications").select("user_id").eq("entity_id", PAYMENT_ANNOUNCEMENT_ID).limit(10_000),
    ]);
    const existingUsers = new Set((existing ?? []).map((row: { user_id: string }) => row.user_id));
    const rows = (profiles ?? [])
      .filter((profile: { id: string }) => !existingUsers.has(profile.id))
      .map((profile: { id: string }) => ({
        user_id: profile.id,
        type: "system",
        title: "Paiements SasPay disponibles",
        message: "Les paiements Premium et les recharges sont maintenant disponibles via SasPay.",
        link: "/premium",
        entity_id: PAYMENT_ANNOUNCEMENT_ID,
      }));
    if (rows.length) await db.from("user_notifications").insert(rows);

    const { data: campaign } = await db
      .from("marketing_push_campaigns")
      .select("id")
      .eq("name", PAYMENT_ANNOUNCEMENT_CAMPAIGN)
      .limit(1)
      .maybeSingle();

    if (!campaign) {
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60_000);
      await db.from("marketing_push_campaigns").insert({
        name: PAYMENT_ANNOUNCEMENT_CAMPAIGN,
        title: "Paiements SasPay disponibles",
        message: "Premium et recharges sont disponibles. Ouvrez LiveFoot pour continuer.",
        link: "/premium",
        audience: "all",
        status: "active",
        daily_limit: 1,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      });
    }
  } catch (error) {
    // A missing optional notification table must never block payment jobs.
    console.error("Payment announcement setup failed", error instanceof Error ? error.message : "unknown");
  }
}

export async function dispatchMarketingPushCampaigns() {
  await ensurePaymentProviderAnnouncement();
  const publicKey = getRuntimeEnv("WEB_PUSH_VAPID_PUBLIC_KEY");
  const privateKey = getRuntimeEnv("WEB_PUSH_VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return { sent: 0, skipped: "not_configured" };
  const { default: webpush } = await import("web-push");
  webpush.setVapidDetails("https://www.livefoot.fun", publicKey, privateKey);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const { data: campaigns } = await db.from("marketing_push_campaigns").select("*").eq("status", "active").lte("starts_at", now.toISOString()).gt("ends_at", now.toISOString()).limit(5);
  let sent = 0;
  for (const campaign of campaigns ?? []) {
    const { data: subscriptions } = await db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").eq("active", true).limit(300);
    for (const subscription of subscriptions ?? []) {
      if (campaign.audience !== "all") {
        const { data: profile } = await db.from("profiles").select("plan").eq("id", subscription.user_id).maybeSingle();
        if ((campaign.audience === "premium") !== (profile?.plan === "premium")) continue;
      }
      const { data: delivery } = await db.from("marketing_push_deliveries").insert({ campaign_id: campaign.id, user_id: subscription.user_id, subscription_id: subscription.id, delivery_day: day }).select("id,click_token").maybeSingle();
      if (!delivery) continue;
      const clickUrl = `/api/push-click?token=${delivery.click_token}&to=${encodeURIComponent(campaign.link)}`;
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: campaign.title, body: campaign.message, url: clickUrl, tag: `livefoot-${campaign.id}` }), { TTL: 3600, urgency: "normal" });
        await db.from("marketing_push_deliveries").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", delivery.id);
        sent += 1;
      } catch (error: any) {
        const statusCode = Number(error?.statusCode ?? 0);
        await db.from("marketing_push_deliveries").update({ status: "failed", error_code: statusCode ? String(statusCode) : "send_failed" }).eq("id", delivery.id);
        if (statusCode === 404 || statusCode === 410) await db.from("push_subscriptions").update({ active: false }).eq("id", subscription.id);
      }
    }
    await db.from("marketing_push_campaigns").update({ last_dispatched_at: new Date().toISOString() }).eq("id", campaign.id);
  }
  return { sent };
}
