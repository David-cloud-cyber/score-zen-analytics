import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { paymentStatus, type FapshiTransaction } from "./fapshi.server";
import { findPremiumPlan } from "./pricing";

export type PaymentOutcome = {
  status: string;
  credited: boolean;
  credits?: number;
  balance?: number;
};

type PaymentRecord = {
  id: string;
  user_id: string;
  trans_id: string | null;
  external_id: string;
  credits: number;
  amount_xaf: number;
  status: string;
  credited_at: string | null;
};

type SubscriptionRecord = {
  id: string;
  user_id: string;
  trans_id: string | null;
  external_id: string;
  plan_id: string;
  amount_xaf: number;
  status: string;
};

export async function settlePaymentOrSubscription(
  transId: string,
  expectedUserId?: string,
): Promise<PaymentOutcome> {
  const direct = await findByTransactionId(transId, expectedUserId);
  if (direct) {
    const tx = await paymentStatus(transId);
    if (!matchesReservation(direct.record, tx)) return { status: "UNKNOWN", credited: false };
    return direct.kind === "subscription"
      ? settleSubscriptionRecord(direct.record, tx)
      : settlePackPaymentRecord(direct.record, tx);
  }

  // Fapshi can answer before the non-blocking reconciliation update finishes.
  // Resolve the reservation by externalId and attach the provider id once.
  const tx = await paymentStatus(transId);
  if (!tx.externalId) return { status: "UNKNOWN", credited: false };

  const fallback = await findByExternalId(tx.externalId, expectedUserId);
  if (!fallback) return { status: "UNKNOWN", credited: false };
  if (!matchesReservation(fallback.record, tx)) return { status: "UNKNOWN", credited: false };

  if (!fallback.record.trans_id) {
    const table = fallback.kind === "subscription" ? "subscriptions" : "payments";
    const { error } = await supabaseAdmin
      .from(table)
      .update({ trans_id: transId })
      .eq("id", fallback.record.id)
      .is("trans_id", null);
    if (error) throw new Error("Impossible de rattacher le paiement.");
  }

  return fallback.kind === "subscription"
    ? settleSubscriptionRecord(fallback.record, tx)
    : settlePackPaymentRecord(fallback.record, tx);
}

type PaymentLookup =
  { kind: "subscription"; record: SubscriptionRecord } | { kind: "payment"; record: PaymentRecord };

function matchesReservation(record: PaymentRecord | SubscriptionRecord, tx: FapshiTransaction) {
  const externalMatches = !tx.externalId || tx.externalId === record.external_id;
  const normalizedProviderUser = tx.userId?.replace(/-/g, "");
  const normalizedRecordUser = record.user_id.replace(/-/g, "");
  const userMatches = !normalizedProviderUser || normalizedProviderUser === normalizedRecordUser;
  return externalMatches && userMatches;
}

async function findByTransactionId(
  transId: string,
  expectedUserId?: string,
): Promise<PaymentLookup | null> {
  const subQuery = supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, trans_id, external_id, plan_id, amount_xaf, status")
    .eq("trans_id", transId);
  if (expectedUserId) subQuery.eq("user_id", expectedUserId);
  const { data: sub, error: subError } = await subQuery.maybeSingle();
  if (subError) throw new Error("Impossible de lire la souscription.");
  if (sub) return { kind: "subscription", record: sub as SubscriptionRecord };

  const paymentQuery = supabaseAdmin
    .from("payments")
    .select("id, user_id, trans_id, external_id, credits, amount_xaf, status, credited_at")
    .eq("trans_id", transId);
  if (expectedUserId) paymentQuery.eq("user_id", expectedUserId);
  const { data: payment, error: paymentError } = await paymentQuery.maybeSingle();
  if (paymentError) throw new Error("Impossible de lire le paiement.");
  if (payment) return { kind: "payment", record: payment as PaymentRecord };
  return null;
}

async function findByExternalId(
  externalId: string,
  expectedUserId?: string,
): Promise<PaymentLookup | null> {
  const subQuery = supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, trans_id, external_id, plan_id, amount_xaf, status")
    .eq("external_id", externalId);
  if (expectedUserId) subQuery.eq("user_id", expectedUserId);
  const { data: sub, error: subError } = await subQuery.maybeSingle();
  if (subError) throw new Error("Impossible de lire la souscription.");
  if (sub) return { kind: "subscription", record: sub as SubscriptionRecord };

  const paymentQuery = supabaseAdmin
    .from("payments")
    .select("id, user_id, trans_id, external_id, credits, amount_xaf, status, credited_at")
    .eq("external_id", externalId);
  if (expectedUserId) paymentQuery.eq("user_id", expectedUserId);
  const { data: payment, error: paymentError } = await paymentQuery.maybeSingle();
  if (paymentError) throw new Error("Impossible de lire le paiement.");
  if (payment) return { kind: "payment", record: payment as PaymentRecord };
  return null;
}

export async function settlePayment(transId: string): Promise<PaymentOutcome> {
  return settlePaymentOrSubscription(transId);
}

export async function settleByExternalId(
  externalId: string,
  expectedUserId: string,
): Promise<PaymentOutcome> {
  const record = await findByExternalId(externalId, expectedUserId);
  if (!record) return { status: "UNKNOWN", credited: false };
  if (!record.record.trans_id) return { status: record.record.status, credited: false };
  return settlePaymentOrSubscription(record.record.trans_id, expectedUserId);
}

async function settleSubscriptionRecord(
  sub: SubscriptionRecord,
  tx: FapshiTransaction,
): Promise<PaymentOutcome> {
  if (tx.status !== "SUCCESSFUL") {
    if (sub.status !== tx.status) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({ status: tx.status })
        .eq("id", sub.id);
      if (error) throw new Error("Impossible de mettre à jour la souscription.");
    }
    return { status: tx.status, credited: false };
  }

  if (Number(tx.amount) < sub.amount_xaf) {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "UNDERPAID" })
      .eq("id", sub.id);
    if (error) throw new Error("Impossible de signaler le paiement sous-payé.");
    return { status: "UNDERPAID", credited: false };
  }

  if (sub.status === "ACTIVE") return { status: "SUCCESSFUL", credited: false, credits: 100 };

  const plan = findPremiumPlan(sub.plan_id);
  if (!plan) throw new Error("Plan d'abonnement introuvable.");

  const now = new Date();
  const periodEnd = new Date(now);
  if (plan.interval === "year") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { data, error } = await supabaseAdmin.rpc("activate_subscription", {
    p_subscription_id: sub.id,
    p_user_id: sub.user_id,
    p_period_start: now.toISOString(),
    p_period_end: periodEnd.toISOString(),
    p_plan_id: plan.name,
  });
  if (error) {
    console.error("Subscription settlement failed:", error.message);
    throw new Error("Impossible d'activer l'abonnement.");
  }
  const row = data?.[0];
  return {
    status: "SUCCESSFUL",
    credited: Boolean(row?.activated),
    credits: 100,
    balance: row?.new_balance ?? 100,
  };
}

async function settlePackPaymentRecord(
  payment: PaymentRecord,
  tx: FapshiTransaction,
): Promise<PaymentOutcome> {
  if (tx.status !== "SUCCESSFUL") {
    if (payment.status !== tx.status) {
      const { error } = await supabaseAdmin
        .from("payments")
        .update({ status: tx.status })
        .eq("id", payment.id);
      if (error) throw new Error("Impossible de mettre à jour le paiement.");
    }
    return { status: tx.status, credited: false };
  }

  if (Number(tx.amount) < payment.amount_xaf) {
    const { error } = await supabaseAdmin
      .from("payments")
      .update({ status: "UNDERPAID" })
      .eq("id", payment.id);
    if (error) throw new Error("Impossible de signaler le paiement sous-payé.");
    return { status: "UNDERPAID", credited: false };
  }

  const { data, error } = await supabaseAdmin.rpc("credit_payment", {
    p_payment_id: payment.id,
    p_user_id: payment.user_id,
    p_credits: payment.credits,
  });
  if (error) {
    console.error("Payment settlement failed:", error.message);
    throw new Error("Impossible de créditer le paiement.");
  }
  const row = data?.[0];
  return {
    status: "SUCCESSFUL",
    credited: Boolean(row?.credited),
    credits: payment.credits,
    balance: row?.new_balance,
  };
}
