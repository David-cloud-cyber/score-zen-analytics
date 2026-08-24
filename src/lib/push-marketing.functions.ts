import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRuntimeEnv } from "@/lib/config.server";

const db = supabaseAdmin as any;

async function requireAdmin(userId: string) {
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId).in("role", ["owner", "admin"]);
  if (!(data ?? []).length) throw new Error("Accès administrateur requis.");
}

function configurePush() {
  const publicKey = getRuntimeEnv("WEB_PUSH_VAPID_PUBLIC_KEY");
  const privateKey = getRuntimeEnv("WEB_PUSH_VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return null;
  return { publicKey };
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(16).max(256),
  auth: z.string().min(8).max(256),
  deviceFamily: z.enum(["mobile", "tablet", "desktop"]),
});

export const getWebPushState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const configured = configurePush();
    const { count, error } = await db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", context.userId).eq("active", true);
    return { publicKey: error ? null : configured?.publicKey ?? null, subscribed: Boolean(count) };
  });

export const saveWebPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => subscriptionSchema.parse(value))
  .handler(async ({ data, context }) => {
    const configured = configurePush();
    if (!configured) throw new Error("Les alertes seront bientôt disponibles.");
    const { error } = await db.from("push_subscriptions").upsert({
      user_id: context.userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      device_family: data.deviceFamily,
      active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,endpoint" });
    if (error) throw new Error("Impossible d’activer les alertes sur cet appareil.");
    return { ok: true };
  });

export const removeWebPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => z.object({ endpoint: z.string().url().max(2048) }).parse(value))
  .handler(async ({ data, context }) => {
    await db.from("push_subscriptions").update({ active: false, updated_at: new Date().toISOString() }).eq("user_id", context.userId).eq("endpoint", data.endpoint);
    return { ok: true };
  });

const campaignSchema = z.object({
  name: z.string().min(3).max(80),
  title: z.string().min(3).max(80),
  message: z.string().min(10).max(180),
  link: z.string().startsWith("/").max(200),
  audience: z.enum(["all", "free", "premium"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export const getAdminPushMarketing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const [{ data: campaigns }, { count: subscriptions }, { data: deliveries }] = await Promise.all([
      db.from("marketing_push_campaigns").select("*").order("created_at", { ascending: false }).limit(30),
      db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("active", true),
      db.from("marketing_push_deliveries").select("status").limit(10_000),
    ]);
    const values = deliveries ?? [];
    return {
      campaigns: campaigns ?? [],
      activeSubscriptions: subscriptions ?? 0,
      sent: values.filter((item: any) => item.status === "sent" || item.status === "clicked").length,
      clicked: values.filter((item: any) => item.status === "clicked").length,
    };
  });

export const createAdminPushCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => campaignSchema.parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    if (new Date(data.endsAt) <= new Date(data.startsAt)) throw new Error("La date de fin doit être postérieure au lancement.");
    const { data: row, error } = await db.from("marketing_push_campaigns").insert({
      name: data.name, title: data.title, message: data.message, link: data.link,
      audience: data.audience, starts_at: data.startsAt, ends_at: data.endsAt,
      status: "draft", daily_limit: 1, created_by: context.userId,
    }).select("id, status").single();
    if (error) throw new Error("La campagne n’a pas pu être créée.");
    return row;
  });

export const setAdminPushCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => z.object({ id: z.string().uuid(), status: z.enum(["active", "paused", "completed"]) }).parse(value))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await db.from("marketing_push_campaigns").update({ status: data.status, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error("Le statut n’a pas pu être modifié.");
    return { ok: true };
  });
