import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const presenceInput = z.object({
  route: z.string().trim().min(1).max(120),
  deviceFamily: z.enum(["mobile", "tablet", "desktop"]),
});

const ONLINE_WINDOW_MS = 90_000;

export type AdminOnlineUser = {
  id: string;
  displayName: string;
  plan: string;
  lastSeenAt: string;
  route: string;
  deviceFamily: "mobile" | "tablet" | "desktop";
};

export const recordUserPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => presenceInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.from("user_presence").upsert(
      {
        user_id: context.userId,
        last_seen_at: new Date().toISOString(),
        route: data.route.split("?")[0].slice(0, 120) || "/",
        device_family: data.deviceFamily,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error("PRESENCE_UPDATE_FAILED");
    return { ok: true };
  });

export const getAdminOnlineUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRows, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "owner"]);
    if (roleError || !roleRows?.length) throw new Error("ADMIN_FORBIDDEN");

    const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
    const { data: presenceRows, error: presenceError } = await supabaseAdmin
      .from("user_presence")
      .select("user_id, last_seen_at, route, device_family")
      .gt("last_seen_at", cutoff)
      .order("last_seen_at", { ascending: false })
      .limit(500);
    if (presenceError) throw new Error("PRESENCE_READ_FAILED");

    const ids = (presenceRows ?? []).map((row) => row.user_id);
    if (!ids.length) return { count: 0, users: [], generatedAt: new Date().toISOString() };

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, plan, account_status")
      .in("id", ids)
      .eq("account_status", "active");
    if (profileError) throw new Error("PRESENCE_PROFILES_READ_FAILED");

    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const users: AdminOnlineUser[] = (presenceRows ?? [])
      .map((presence) => {
        const profile = profileMap.get(presence.user_id);
        if (!profile) return null;
        return {
          id: presence.user_id,
          displayName: profile.display_name?.trim() || "Utilisateur",
          plan: profile.plan,
          lastSeenAt: presence.last_seen_at,
          route: presence.route,
          deviceFamily: presence.device_family as AdminOnlineUser["deviceFamily"],
        };
      })
      .filter((user): user is AdminOnlineUser => Boolean(user));

    return { count: users.length, users, generatedAt: new Date().toISOString() };
  });
