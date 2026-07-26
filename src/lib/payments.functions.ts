import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const checkoutInput = z.object({
  packId: z.string().min(1).max(40),
  origin: z.string().url().optional(),
});

/** Crée un lien de paiement Fapshi (FCFA) pour un pack de crédits. */
export const createTopupCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => checkoutInput.parse(data))
  .handler(async ({ data, context }) => {
    const { findPack } = await import("./pricing");
    const pack = findPack(data.packId);
    if (!pack) throw new Error("Pack de crédits inconnu.");

    const { initiatePay } = await import("./fapshi.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const externalId = `lf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    const res = await initiatePay({
      amount: pack.priceXaf,
      email: context.claims?.email as string | undefined,
      userId: context.userId.replace(/-/g, ""),
      externalId,
      redirectUrl: data.origin ? `${data.origin.replace(/\/+$/, "")}/profil` : undefined,
      message: `Recharge ${pack.credits} crédits LiveFoot AI`,
    });

    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      provider: "fapshi",
      trans_id: res.transId,
      external_id: externalId,
      pack_id: pack.id,
      credits: pack.credits,
      amount_xaf: pack.priceXaf,
      status: "PENDING",
      link: res.link,
    });
    if (error) throw new Error("Impossible d'enregistrer le paiement.");

    return { link: res.link, transId: res.transId, amountXaf: pack.priceXaf, credits: pack.credits };
  });

/** Vérifie manuellement un paiement (retour depuis Fapshi) et crédite si payé. */
export const verifyTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ transId: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: own } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("trans_id", data.transId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!own) throw new Error("Paiement introuvable.");

    const { settlePayment } = await import("./payments.server");
    return await settlePayment(data.transId);
  });

/** Historique des recharges de l'utilisateur. */
export const getMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("payments")
      .select("id, trans_id, pack_id, credits, amount_xaf, status, link, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    return data ?? [];
  });
