// Logique serveur de créditation et souscription après paiement Fapshi.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { paymentStatus } from "./fapshi.server";
import { findPremiumPlan } from "./pricing";

export type PaymentOutcome = {
  status: string;
  credited: boolean;
  credits?: number;
  balance?: number;
};

/**
 * Traite et valide un paiement Fapshi (Pack de crédits OU Abonnement Premium).
 * Idempotent et sécurisé.
 */
export async function settlePaymentOrSubscription(transId: string): Promise<PaymentOutcome> {
  const tx = await paymentStatus(transId);

  // 1. Chercher si c'est un abonnement
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, plan_id, amount_xaf, status, current_period_end, external_id")
    .eq("trans_id", transId)
    .maybeSingle();

  if (sub) {
    return await settleSubscriptionRecord(sub, tx);
  }

  // 2. Sinon, chercher dans payments (pack)
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, credits, amount_xaf, status, credited_at, external_id")
    .eq("trans_id", transId)
    .maybeSingle();

  if (payment) {
    return await settlePackPaymentRecord(payment, tx);
  }

  return { status: tx.status, credited: false };
}

export async function settlePayment(transId: string): Promise<PaymentOutcome> {
  return await settlePaymentOrSubscription(transId);
}

async function settleSubscriptionRecord(sub: any, tx: any): Promise<PaymentOutcome> {
  if (tx.status !== "SUCCESSFUL") {
    if (sub.status !== tx.status) {
      await supabaseAdmin.from("subscriptions").update({ status: tx.status }).eq("id", sub.id);
    }
    return { status: tx.status, credited: false };
  }

  if (Number(tx.amount) < sub.amount_xaf) {
    await supabaseAdmin.from("subscriptions").update({ status: "UNDERPAID" }).eq("id", sub.id);
    return { status: "UNDERPAID", credited: false };
  }

  if (sub.status === "ACTIVE") {
    return { status: "SUCCESSFUL", credited: false, credits: 100 };
  }

  const now = new Date();
  const plan = findPremiumPlan(sub.plan_id);
  const periodEnd = new Date(now);

  if (plan?.interval === "year") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // Idempotency lock on status update
  const { data: locked } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "ACTIVE",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
    .eq("id", sub.id)
    .neq("status", "ACTIVE")
    .select("id")
    .maybeSingle();

  if (!locked) return { status: "SUCCESSFUL", credited: false, credits: 100 };

  // Mettre le profil à jour : Plan Premium, date d'expiration et réinitialiser le solde à 100 crédits (non cumulable)
  await supabaseAdmin
    .from("profiles")
    .update({
      plan: "premium",
      premium_until: periodEnd.toISOString(),
      credits: 100,
    })
    .eq("id", sub.user_id);

  await supabaseAdmin.from("credits_ledger").insert({
    user_id: sub.user_id,
    kind: "subscription",
    amount: 100,
    balance_after: 100,
    label: `Abonnement ${plan?.name ?? "Premium"} (100 crédits)`,
  });

  return { status: "SUCCESSFUL", credited: true, credits: 100, balance: 100 };
}

async function settlePackPaymentRecord(payment: any, tx: any): Promise<PaymentOutcome> {
  if (tx.status !== "SUCCESSFUL") {
    if (payment.status !== tx.status) {
      await supabaseAdmin.from("payments").update({ status: tx.status }).eq("id", payment.id);
    }
    return { status: tx.status, credited: false };
  }

  if (Number(tx.amount) < payment.amount_xaf) {
    await supabaseAdmin.from("payments").update({ status: "UNDERPAID" }).eq("id", payment.id);
    return { status: "UNDERPAID", credited: false };
  }

  if (payment.credited_at) {
    return { status: "SUCCESSFUL", credited: false, credits: payment.credits };
  }

  const { data: locked } = await supabaseAdmin
    .from("payments")
    .update({ status: "SUCCESSFUL", credited_at: new Date().toISOString() })
    .eq("id", payment.id)
    .is("credited_at", null)
    .select("id")
    .maybeSingle();

  if (!locked) return { status: "SUCCESSFUL", credited: false, credits: payment.credits };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", payment.user_id)
    .maybeSingle();

  const newBalance = (profile?.credits ?? 0) + payment.credits;
  await supabaseAdmin.from("profiles").update({ credits: newBalance }).eq("id", payment.user_id);
  await supabaseAdmin.from("credits_ledger").insert({
    user_id: payment.user_id,
    kind: "topup",
    amount: payment.credits,
    balance_after: newBalance,
    label: `Recharge ${payment.credits} crédits (${payment.amount_xaf} FCFA)`,
  });

  return { status: "SUCCESSFUL", credited: true, credits: payment.credits, balance: newBalance };
}
