import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const installSignal = z.object({
  signal: z.enum(["appinstalled", "standalone"]),
  deviceFamily: z.enum(["mobile", "tablet", "desktop"]).default("mobile"),
});

export const claimPwaInstallBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => installSignal.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (supabaseAdmin as any).rpc("grant_pwa_install_bonus", {
      p_user_id: context.userId,
    });
    if (error) throw new Error("INSTALL_BONUS_UNAVAILABLE");

    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      granted: Boolean(row?.granted),
      creditsAwarded: Number(row?.credits_awarded ?? 0),
      newBalance: Number(row?.new_balance ?? 0),
      signal: data.signal,
    };
  });
