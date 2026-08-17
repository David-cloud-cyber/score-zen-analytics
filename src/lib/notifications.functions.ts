import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserNotification = {
  id: string;
  type: "community_reply" | "support_reply" | "vip_status" | "system";
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export const getUserNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserNotification[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).from("user_notifications").select("id, type, title, message, link, read_at, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(40);
    if (error) throw new Error("Impossible de charger les notifications.");
    return (data ?? []) as UserNotification[];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ notificationId: z.string().uuid().optional(), all: z.boolean().default(false) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = (supabaseAdmin as any).from("user_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", context.userId).is("read_at", null);
    if (!data.all && data.notificationId) query = query.eq("id", data.notificationId);
    const { error } = await query;
    if (error) throw new Error("Impossible de mettre à jour les notifications.");
    return { ok: true };
  });
