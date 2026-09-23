import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chariowProductKeyFor, getChariowProductId, getChariowSale, type ChariowSale } from "./chariow.server";
import { relayitCurrencyValue, relayitStatus } from "./relayit.server";
import { findSasPaySession, getSasPaySession, getSasPayPayment, sasPaySessionTransactionId, sasPayAmount, sasPayCurrency, sasPayExternalId, sasPayStatus, type SasPayTransaction, type SasPaySession } from "./saspay.server";
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
  provider: string;
  trans_id: string | null;
  external_id: string;
  provider_sale_id: string | null;
  pack_id: string;
  credits: number;
  amount_xaf: number;
  status: string;
  credited_at: string | null;
  promo_campaign_id?: string | null;
  customer_email?: string | null;
};

type SubscriptionRecord = {
  id: string;
  user_id: string;
  provider: string;
  trans_id: string | null;
  external_id: string;
  provider_sale_id: string | null;
  plan_id: string;
  amount_xaf: number;
  status: string;
  customer_email?: string | null;
};

export async function settlePaymentOrSubscription(
  transId: string,
  expectedUserId?: string,
): Promise<PaymentOutcome> {
  const direct = await findByTransactionId(transId, expectedUserId);
  if (direct) {
    if (direct.record.provider === "chariow") {
      const sale = await getChariowSale(transId);
      return settleChariowRecord(direct, sale);
    }
    if (direct.record.provider === "saspay") {
      return reconcileSasPayCheckout(direct);
    }
    if (direct.record.provider === "relayit") {
      return reconcileRelayitCheckout(direct);
    }
    // Fapshi is no longer an active provider. Keep old records readable, but
    // never make a new external request to the disabled integration.
    return { status: "DISABLED", credited: false };
  }

  // Chariow can answer before the non-blocking reconciliation update finishes.
  // Resolve the reservation by its provider sale id before considering the
  // checkout incomplete, so the browser can verify immediately after return.
  const chariowRecord = await findByProviderSaleId(transId);
  if (chariowRecord?.record.provider === "chariow") {
    const sale = await getChariowSale(transId);
    return settleChariowRecord(chariowRecord, sale);
  }

  const relayitRecord = await findByRelayitProviderId(transId);
  if (relayitRecord) {
    if (expectedUserId && relayitRecord.record.user_id !== expectedUserId) return { status: "UNKNOWN", credited: false };
    return reconcileRelayitCheckout(relayitRecord);
  }

  const sasPayRecord = await findBySasPayProviderId(transId);
  if (sasPayRecord) {
    if (expectedUserId && sasPayRecord.record.user_id !== expectedUserId) return { status: "UNKNOWN", credited: false };
    return reconcileSasPayCheckout(sasPayRecord);
  }

  return { status: "UNKNOWN", credited: false };
}

type PaymentLookup =
  { kind: "subscription"; record: SubscriptionRecord } | { kind: "payment"; record: PaymentRecord };

async function findByTransactionId(
  transId: string,
  expectedUserId?: string,
): Promise<PaymentLookup | null> {
  const subQuery = supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, provider, trans_id, external_id, provider_sale_id, plan_id, amount_xaf, status")
    .eq("trans_id", transId);
  if (expectedUserId) subQuery.eq("user_id", expectedUserId);
  const { data: sub, error: subError } = await subQuery.maybeSingle();
  if (subError) throw new Error("Impossible de lire la souscription.");
  if (sub) return { kind: "subscription", record: sub as SubscriptionRecord };

  const paymentQuery = supabaseAdmin
    .from("payments")
    .select("id, user_id, provider, trans_id, external_id, provider_sale_id, pack_id, credits, amount_xaf, status, credited_at, promo_campaign_id")
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
    .select("id, user_id, provider, trans_id, external_id, provider_sale_id, plan_id, amount_xaf, status")
    .eq("external_id", externalId);
  if (expectedUserId) subQuery.eq("user_id", expectedUserId);
  const { data: sub, error: subError } = await subQuery.maybeSingle();
  if (subError) throw new Error("Impossible de lire la souscription.");
  if (sub) return { kind: "subscription", record: sub as SubscriptionRecord };

  const paymentQuery = supabaseAdmin
    .from("payments")
    .select("id, user_id, provider, trans_id, external_id, provider_sale_id, pack_id, credits, amount_xaf, status, credited_at, promo_campaign_id")
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
  if (record.record.provider === "saspay") return reconcileSasPayCheckout(record);
  if (record.record.provider === "relayit") return reconcileRelayitCheckout(record);
  if (!record.record.trans_id) return { status: record.record.status, credited: false };
  if (record.record.provider === "chariow") {
    const sale = await getChariowSale(record.record.trans_id);
    return settleChariowRecord(record, sale);
  }
  return settlePaymentOrSubscription(record.record.trans_id, expectedUserId);
}

/**
 * Reconcile a SasPay event received from the signed webhook. The external id
 * is preferred because the webhook can arrive before the checkout response is
 * persisted; the provider transaction id is adopted only on that reservation.
 */
export async function settleSasPayTransaction(transaction: SasPayTransaction): Promise<PaymentOutcome> {
  const verified = await getSasPayPayment(transaction.id);
  if (verified.id !== transaction.id) throw new Error("Transaction incohérente.");
  const session = await findSasPaySession({ transactionId: verified.id });
  const externalId = session ? sasPayExternalId(session) : sasPayExternalId(verified);
  const record = (externalId ? await findByExternalId(externalId) : null)
    ?? await findBySasPayProviderId(transaction.id);
  if (!record || record.record.provider !== "saspay") return { status: "UNKNOWN", credited: false };

  return reconcileSasPayCheckout(record, session ?? undefined);
}

async function reconcileSasPayCheckout(lookup: PaymentLookup, knownSession?: SasPaySession): Promise<PaymentOutcome> {
  if (lookup.record.status === "ACTIVE" || lookup.record.status === "SUCCESSFUL") return { status: "SUCCESSFUL", credited: false };
  const storedId = lookup.record.provider_sale_id ?? lookup.record.trans_id;
  const session = knownSession ?? (storedId ? await getSasPaySession(storedId) : null)
    ?? await findSasPaySession({ externalId: lookup.record.external_id });
  if (!session) return { status: "PENDING", credited: false };
  if (sasPayExternalId(session) !== lookup.record.external_id) throw new Error("Session de paiement incohérente.");
  const transactionId = sasPaySessionTransactionId(session);
  const table = lookup.kind === "subscription" ? "subscriptions" : "payments";
  const { error } = await supabaseAdmin.from(table).update({ provider_sale_id: session.id, ...(transactionId ? { trans_id: transactionId } : {}) })
    .eq("id", lookup.record.id).eq("provider", "saspay");
  if (error) throw new Error("Impossible de rattacher le paiement.");
  if (!transactionId) return { status: ["EXPIRED", "CANCELLED"].includes(sasPayStatus(session)) ? sasPayStatus(session) : "PENDING", credited: false };
  const verified = await getSasPayPayment(transactionId);
  if (verified.id !== transactionId) throw new Error("Transaction incohérente.");
  // SasPay can convert an XAF checkout to XOF for a West African payer.
  // Use the original price only when BOTH linked provider records confirm payment.
  if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "SETTLED"].includes(sasPayStatus(verified))) {
    if (sasPayStatus(session) !== "PAID") return { status: "PENDING", credited: false };
    if (sasPayCurrency(session) !== "XAF" || !["XAF", "XOF"].includes(sasPayCurrency(verified) ?? "") ||
      (sasPayAmount(verified) ?? 0) < (sasPayAmount(session) ?? Infinity)) return { status: "UNDERPAID", credited: false };
    return settleSasPayRecord(lookup, { ...verified, currency: "XAF", requested_amount: sasPayAmount(session) });
  }
  return settleSasPayRecord(lookup, verified);
}

async function settleSasPayRecord(lookup: PaymentLookup, transaction: SasPayTransaction): Promise<PaymentOutcome> {
  const status = sasPayStatus(transaction);
  const successful = ["SUCCESS", "SUCCESSFUL", "COMPLETED", "SETTLED"].includes(status);
  const failed = ["FAILED", "CANCELLED", "CANCELED", "EXPIRED", "REJECTED"].includes(status);
  const table = lookup.kind === "subscription" ? "subscriptions" : "payments";

  // A late retry must never downgrade a transaction that was already settled.
  if (!successful && (lookup.record.status === "ACTIVE" || lookup.record.status === "SUCCESSFUL" || (lookup.kind === "payment" && lookup.record.credited_at))) {
    return { status: lookup.kind === "subscription" ? "SUCCESSFUL" : "SUCCESSFUL", credited: false, credits: lookup.kind === "subscription" ? 100 : lookup.record.credits };
  }

  if (!successful) {
    const nextStatus = failed ? status : "PENDING";
    if (lookup.record.status !== nextStatus) {
      const { error } = await supabaseAdmin.from(table).update({ status: nextStatus }).eq("id", lookup.record.id);
      if (error) throw new Error("Impossible de mettre à jour le paiement.");
    }
    return { status: nextStatus, credited: false };
  }

  const currency = sasPayCurrency(transaction);
  if (currency !== "XAF") {
    const { error } = await supabaseAdmin.from(table).update({ status: "UNDERPAID" }).eq("id", lookup.record.id);
    if (error) throw new Error("Impossible de signaler le paiement.");
    return { status: "UNDERPAID", credited: false };
  }

  const amount = sasPayAmount(transaction);
  if (amount === null || !Number.isFinite(amount) || amount < lookup.record.amount_xaf) {
    const { error } = await supabaseAdmin.from(table).update({ status: "UNDERPAID" }).eq("id", lookup.record.id);
    if (error) throw new Error("Impossible de signaler le paiement sous-payé.");
    return { status: "UNDERPAID", credited: false };
  }

  if (lookup.kind === "subscription") {
    if (lookup.record.status === "ACTIVE") return { status: "SUCCESSFUL", credited: false, credits: 100 };
    const plan = findPremiumPlan(lookup.record.plan_id);
    if (!plan) throw new Error("Plan d'abonnement introuvable.");
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.interval === "year") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);
    const { data, error } = await supabaseAdmin.rpc("activate_subscription", {
      p_subscription_id: lookup.record.id,
      p_user_id: lookup.record.user_id,
      p_period_start: now.toISOString(),
      p_period_end: periodEnd.toISOString(),
      p_plan_id: plan.name,
    });
    if (error) throw new Error("Impossible d'activer l'abonnement.");
    const row = data?.[0];
    return { status: "SUCCESSFUL", credited: Boolean(row?.activated), credits: 100, balance: row?.new_balance ?? 100 };
  }

  const { data, error } = await supabaseAdmin.rpc("credit_payment", {
    p_payment_id: lookup.record.id,
    p_user_id: lookup.record.user_id,
    p_credits: lookup.record.credits,
  });
  if (error) throw new Error("Impossible de créditer le paiement.");
  const row = data?.[0];
  return { status: "SUCCESSFUL", credited: Boolean(row?.credited), credits: lookup.record.credits, balance: row?.new_balance };
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function relayitPayloadRecords(payload: Record<string, unknown>) {
  const records: Record<string, unknown>[] = [payload];
  const queue: unknown[] = [payload.data, payload.payment, payload.transaction, payload.session, payload.result];
  while (queue.length > 0) {
    const record = objectRecord(queue.shift());
    if (!record || records.includes(record)) continue;
    records.push(record);
    queue.push(record.data, record.payment, record.transaction, record.session, record.result, record.metadata, record.custom_metadata);
  }
  return records;
}

function relayitString(payload: Record<string, unknown>, keys: string[]) {
  for (const record of relayitPayloadRecords(payload)) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

function relayitNumber(payload: Record<string, unknown>, keys: string[]) {
  for (const record of relayitPayloadRecords(payload)) {
    for (const key of keys) {
      const value = record[key];
      if (value === null || value === undefined || value === "") continue;
      const number = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(number)) return number;
    }
  }
  return null;
}

function relayitMetadataValue(payload: Record<string, unknown>, keys: string[]) {
  for (const record of relayitPayloadRecords(payload)) {
    for (const containerKey of ["metadata", "custom_metadata"]) {
      const metadata = objectRecord(record[containerKey]);
      if (!metadata) continue;
      for (const key of keys) {
        const value = metadata[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    }
  }
  return null;
}

function relayitExternalId(payload: Record<string, unknown>) {
  const value = relayitMetadataValue(payload, ["external_id", "externalId", "order_ref", "order_reference", "reference"])
    ?? relayitString(payload, ["external_id", "externalId", "order_ref", "order_reference"]);
  return value && /^(sub|pk|promo)_[A-Za-z0-9]+$/.test(value) ? value : null;
}

function relayitProviderId(payload: Record<string, unknown>) {
  const specific = relayitString(payload, ["transaction_id", "transactionId", "payment_id", "paymentId", "session_id", "sessionId"]);
  if (specific) return specific;
  // A webhook envelope may also have its own `id`; only use a nested payment
  // id as the fallback so the delivery id is never stored as a transaction.
  for (const record of relayitPayloadRecords(payload).slice(1)) {
    if (typeof record.id === "string" && record.id.trim()) return record.id.trim();
  }
  return null;
}

function relayitEventStatus(payload: Record<string, unknown>, eventHeader?: string | null) {
  return relayitStatus(relayitString(payload, ["status", "event", "type"]) ?? eventHeader);
}

function relayitSuccessful(status: string) {
  return ["paid", "succeeded", "successful", "completed", "settled", "approved", "success", "payment.success", "payment.succeeded"].includes(status);
}

function relayitFailed(status: string) {
  return ["failed", "cancelled", "canceled", "expired", "rejected", "declined", "payment.failed", "payment.cancelled", "payment.expired"].includes(status);
}

/**
 * Applies a Relayit webhook only after its provider identity, amount and
 * currency have been checked. The final credit/activation remains delegated
 * to the same idempotent database RPCs as the other payment providers.
 */
export async function settleRelayitEvent(payload: Record<string, unknown>, eventHeader?: string | null): Promise<PaymentOutcome> {
  const externalId = relayitExternalId(payload);
  const providerId = relayitProviderId(payload);
  const record = (externalId ? await findByExternalId(externalId) : null)
    ?? (providerId ? await findByRelayitProviderId(providerId) : null);
  if (!record || record.record.provider !== "relayit") return { status: "UNKNOWN", credited: false };

  const table = record.kind === "subscription" ? "subscriptions" : "payments";
  const knownProviderIds = [record.record.provider_sale_id, record.record.trans_id].filter((value): value is string => Boolean(value));
  if (providerId && knownProviderIds.some((knownId) => knownId !== providerId)) return { status: "UNKNOWN", credited: false };
  if (providerId && (record.record.provider_sale_id !== providerId || record.record.trans_id !== providerId)) {
    const { error } = await supabaseAdmin.from(table).update({ provider_sale_id: providerId, trans_id: providerId }).eq("id", record.record.id).eq("provider", "relayit");
    if (error) throw new Error("Impossible de rattacher le paiement Relayit.");
  }

  const status = relayitEventStatus(payload, eventHeader);
  const alreadySettled = record.record.status === "ACTIVE" || record.record.status === "SUCCESSFUL"
    || (record.kind === "payment" && Boolean(record.record.credited_at));
  if (alreadySettled && !relayitSuccessful(status)) {
    return { status: "SUCCESSFUL", credited: false, credits: record.kind === "subscription" ? 100 : record.record.credits };
  }
  if (relayitFailed(status)) {
    const normalizedStatus = status.includes("cancel") ? "CANCELLED" : status.includes("expir") ? "EXPIRED" : "FAILED";
    if (record.record.status !== normalizedStatus) {
      const { error } = await supabaseAdmin.from(table).update({ status: normalizedStatus }).eq("id", record.record.id).eq("provider", "relayit");
      if (error) throw new Error("Impossible de mettre à jour le paiement Relayit.");
    }
    return { status: normalizedStatus, credited: false };
  }
  if (!relayitSuccessful(status)) return reconcileRelayitCheckout(record);

  const amount = relayitNumber(payload, ["amount", "amount_xaf", "amountXaf", "paid_amount", "value"]);
  if (amount === null) return { status: "PENDING", credited: false };
  if (amount < record.record.amount_xaf) {
    const { error } = await supabaseAdmin.from(table).update({ status: "UNDERPAID" }).eq("id", record.record.id).eq("provider", "relayit");
    if (error) throw new Error("Impossible de signaler le paiement sous-payé.");
    return { status: "UNDERPAID", credited: false };
  }

  const currency = relayitCurrencyValue(relayitString(payload, ["currency", "currency_code", "currencyCode"]));
  if (currency && !["XAF", "XOF"].includes(currency)) {
    const { error } = await supabaseAdmin.from(table).update({ status: "UNDERPAID" }).eq("id", record.record.id).eq("provider", "relayit");
    if (error) throw new Error("Impossible de signaler la devise du paiement.");
    return { status: "UNDERPAID", credited: false };
  }

  return settleRelayitRecord(record);
}

function reconcileRelayitCheckout(lookup: PaymentLookup): PaymentOutcome {
  if (lookup.record.status === "ACTIVE" || lookup.record.status === "SUCCESSFUL") {
    return { status: "SUCCESSFUL", credited: false, credits: lookup.kind === "subscription" ? 100 : lookup.record.credits };
  }
  return { status: lookup.record.status || "PENDING", credited: false };
}

async function settleRelayitRecord(lookup: PaymentLookup): Promise<PaymentOutcome> {
  if (lookup.kind === "subscription") {
    if (lookup.record.status === "ACTIVE") return { status: "SUCCESSFUL", credited: false, credits: 100 };
    const plan = findPremiumPlan(lookup.record.plan_id);
    if (!plan) throw new Error("Plan d'abonnement introuvable.");
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.interval === "year") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);
    const { data, error } = await supabaseAdmin.rpc("activate_subscription", {
      p_subscription_id: lookup.record.id,
      p_user_id: lookup.record.user_id,
      p_period_start: now.toISOString(),
      p_period_end: periodEnd.toISOString(),
      p_plan_id: plan.name,
    });
    if (error) throw new Error("Impossible d'activer l'abonnement Relayit.");
    const row = data?.[0];
    return { status: "SUCCESSFUL", credited: Boolean(row?.activated), credits: 100, balance: row?.new_balance ?? 100 };
  }

  if (lookup.record.promo_campaign_id) {
    const { data, error } = await supabaseAdmin.rpc("credit_promotional_payment", {
      p_payment_id: lookup.record.id,
      p_user_id: lookup.record.user_id,
      p_credits: lookup.record.credits,
    });
    if (error) throw new Error("Impossible d’activer l’offre promotionnelle Relayit.");
    const row = data?.[0];
    return { status: "SUCCESSFUL", credited: Boolean(row?.credited), credits: lookup.record.credits, balance: row?.new_balance };
  }

  const { data, error } = await supabaseAdmin.rpc("credit_payment", {
    p_payment_id: lookup.record.id,
    p_user_id: lookup.record.user_id,
    p_credits: lookup.record.credits,
  });
  if (error) throw new Error("Impossible de créditer le paiement Relayit.");
  const row = data?.[0];
  return { status: "SUCCESSFUL", credited: Boolean(row?.credited), credits: lookup.record.credits, balance: row?.new_balance };
}

export async function settleChariowSale(sale: ChariowSale): Promise<PaymentOutcome> {
  const externalId = extractChariowExternalId(sale);
  const record = (externalId ? await findByExternalId(externalId) : null)
    ?? await findByProviderSaleId(sale.id)
    ?? await findPendingChariowByCustomer(sale);
  if (!record) return { status: "UNKNOWN", credited: false };
  // The webhook can arrive before the non-blocking checkout reconciliation.
  // Adopt only a still-pending reservation created for this exact external id.
  if (record.record.provider !== "chariow") {
    if (record.record.status !== "PENDING" || record.record.trans_id) return { status: "UNKNOWN", credited: false };
  }

  const table = record.kind === "subscription" ? "subscriptions" : "payments";
  const { error } = await supabaseAdmin
    .from(table)
    .update({ provider: "chariow", trans_id: sale.id, provider_sale_id: sale.id })
    .eq("id", record.record.id);
  if (error) throw new Error("Impossible de rattacher la vente.");

  return settleChariowRecord(record, sale);
}

async function findPendingChariowByCustomer(sale: ChariowSale): Promise<PaymentLookup | null> {
  const email = (sale.customer?.email ?? sale.buyer?.email)?.trim().toLowerCase();
  const saleProductId = sale.product?.id?.trim();
  const saleAmount = Number(sale.amount?.value);
  if (!email || (!saleProductId && !Number.isFinite(saleAmount))) return null;

  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const [subResult, paymentResult] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, provider, trans_id, external_id, provider_sale_id, plan_id, amount_xaf, status, customer_email")
      .eq("provider", "chariow")
      .eq("status", "PENDING")
      .eq("customer_email", email)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("payments")
      .select("id, user_id, provider, trans_id, external_id, provider_sale_id, pack_id, credits, amount_xaf, status, credited_at, customer_email")
      .eq("provider", "chariow")
      .eq("status", "PENDING")
      .eq("customer_email", email)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (subResult.error) throw new Error("Impossible de lire la souscription.");
  if (paymentResult.error) throw new Error("Impossible de lire le paiement.");

  for (const row of (subResult.data ?? []) as SubscriptionRecord[]) {
    if (await chariowProductMatches("subscription", row.plan_id, saleProductId, saleAmount, row.amount_xaf)) {
      return { kind: "subscription", record: row };
    }
  }
  for (const row of (paymentResult.data ?? []) as PaymentRecord[]) {
    if (await chariowProductMatches("payment", row.pack_id, saleProductId, saleAmount, row.amount_xaf)) {
      return { kind: "payment", record: row };
    }
  }
  return null;
}

async function chariowProductMatches(
  kind: "subscription" | "payment",
  id: string,
  saleProductId: string | undefined,
  saleAmount: number,
  expectedAmount: number,
) {
  if (Number.isFinite(saleAmount) && saleAmount < expectedAmount) return false;
  const expectedProductId = await getChariowProductId(chariowProductKeyFor(kind, id));
  return !saleProductId || !expectedProductId || saleProductId === expectedProductId;
}

function extractChariowExternalId(sale: ChariowSale) {
  const metadata = sale.custom_metadata ?? sale.metadata;
  const value = metadata?.external_id ?? metadata?.order_ref;
  return typeof value === "string" && /^(sub|pk|promo)_[A-Za-z0-9]+$/.test(value) ? value : null;
}

async function findByProviderSaleId(saleId: string): Promise<PaymentLookup | null> {
  const subQuery = supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, provider, trans_id, external_id, provider_sale_id, plan_id, amount_xaf, status")
    .eq("provider", "chariow")
    .eq("provider_sale_id", saleId);
  const { data: sub, error: subError } = await subQuery.maybeSingle();
  if (subError) throw new Error("Impossible de lire la souscription.");
  if (sub) return { kind: "subscription", record: sub as SubscriptionRecord };

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, provider, trans_id, external_id, provider_sale_id, pack_id, credits, amount_xaf, status, credited_at, promo_campaign_id")
    .eq("provider", "chariow")
    .eq("provider_sale_id", saleId)
    .maybeSingle();
  if (paymentError) throw new Error("Impossible de lire le paiement.");
  return payment ? { kind: "payment", record: payment as PaymentRecord } : null;
}

async function findBySasPayProviderId(transactionId: string): Promise<PaymentLookup | null> {
  const subQuery = supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, provider, trans_id, external_id, provider_sale_id, plan_id, amount_xaf, status, customer_email")
    .eq("provider", "saspay")
    .eq("provider_sale_id", transactionId);
  const { data: sub, error: subError } = await subQuery.maybeSingle();
  if (subError) throw new Error("Impossible de lire la souscription.");
  if (sub) return { kind: "subscription", record: sub as SubscriptionRecord };

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, provider, trans_id, external_id, provider_sale_id, pack_id, credits, amount_xaf, status, credited_at, customer_email")
    .eq("provider", "saspay")
    .eq("provider_sale_id", transactionId)
    .maybeSingle();
  if (paymentError) throw new Error("Impossible de lire le paiement.");
  return payment ? { kind: "payment", record: payment as PaymentRecord } : null;
}

async function findByRelayitProviderId(transactionId: string): Promise<PaymentLookup | null> {
  const subQuery = supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, provider, trans_id, external_id, provider_sale_id, plan_id, amount_xaf, status")
    .eq("provider", "relayit")
    .eq("provider_sale_id", transactionId);
  const { data: sub, error: subError } = await subQuery.maybeSingle();
  if (subError) throw new Error("Impossible de lire la souscription Relayit.");
  if (sub) return { kind: "subscription", record: sub as SubscriptionRecord };

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, provider, trans_id, external_id, provider_sale_id, pack_id, credits, amount_xaf, status, credited_at, promo_campaign_id")
    .eq("provider", "relayit")
    .eq("provider_sale_id", transactionId)
    .maybeSingle();
  if (paymentError) throw new Error("Impossible de lire le paiement Relayit.");
  return payment ? { kind: "payment", record: payment as PaymentRecord } : null;
}

async function settleChariowRecord(lookup: PaymentLookup, sale: ChariowSale): Promise<PaymentOutcome> {
  const amount = Number(sale.amount?.value);
  const status = typeof sale.status === "string" ? sale.status.toLowerCase() : "awaiting_payment";
  const successful = status === "completed" || status === "settled" || status === "successful";
  const failed = status === "failed" || status === "abandoned" || status === "cancelled";

  if (!successful) {
    const nextStatus = failed ? status.toUpperCase() : "PENDING";
    const table = lookup.kind === "subscription" ? "subscriptions" : "payments";
    if (lookup.record.status !== nextStatus) {
      const { error } = await supabaseAdmin.from(table).update({ status: nextStatus }).eq("id", lookup.record.id);
      if (error) throw new Error("Impossible de mettre à jour le paiement.");
    }
    return { status: nextStatus, credited: false };
  }

  if (!Number.isFinite(amount) || amount < lookup.record.amount_xaf) {
    const table = lookup.kind === "subscription" ? "subscriptions" : "payments";
    const { error } = await supabaseAdmin.from(table).update({ status: "UNDERPAID" }).eq("id", lookup.record.id);
    if (error) throw new Error("Impossible de signaler le paiement sous-payé.");
    return { status: "UNDERPAID", credited: false };
  }

  const productId = await getChariowProductId(
    chariowProductKeyFor(lookup.kind, lookup.kind === "subscription" ? lookup.record.plan_id : lookup.record.pack_id),
  );
  if (productId && productId !== sale.product?.id) return { status: "UNKNOWN", credited: false };

  if (lookup.kind === "subscription") {
    if (lookup.record.status === "ACTIVE") return { status: "SUCCESSFUL", credited: false, credits: 100 };
    const plan = findPremiumPlan(lookup.record.plan_id);
    if (!plan) throw new Error("Plan d'abonnement introuvable.");
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.interval === "year") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);
    const { data, error } = await supabaseAdmin.rpc("activate_subscription", {
      p_subscription_id: lookup.record.id,
      p_user_id: lookup.record.user_id,
      p_period_start: now.toISOString(),
      p_period_end: periodEnd.toISOString(),
      p_plan_id: plan.name,
    });
    if (error) throw new Error("Impossible d'activer l'abonnement.");
    const row = data?.[0];
    return { status: "SUCCESSFUL", credited: Boolean(row?.activated), credits: 100, balance: row?.new_balance ?? 100 };
  }

  const { data, error } = await supabaseAdmin.rpc("credit_payment", {
    p_payment_id: lookup.record.id,
    p_user_id: lookup.record.user_id,
    p_credits: lookup.record.credits,
  });
  if (error) throw new Error("Impossible de créditer le paiement.");
  const row = data?.[0];
  return { status: "SUCCESSFUL", credited: Boolean(row?.credited), credits: lookup.record.credits, balance: row?.new_balance };
}
