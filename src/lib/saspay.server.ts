import { getConfig, getRuntimeEnv } from "./config.server";
import { getAllowedCheckoutUrl } from "./checkout-url.server";

const SASPAY_API_BASE = "https://api.saspay.me/api/v1";
const SASPAY_CURRENCY = "XAF";
const WEBHOOK_TOLERANCE_SECONDS = 300;

export type SasPayTransaction = {
  id: string;
  reference?: string | null;
  status?: string | null;
  amount?: string | number | null;
  requested_amount?: string | number | null;
  debited_amount?: string | number | null;
  charged?: string | number | null;
  net_amount?: string | number | null;
  currency?: string | null;
  external_reference?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SasPayCheckoutResult = {
  id: string;
  checkoutUrl: string;
  status: string;
  amountXaf: number | null;
};

function clean(value: unknown, max = 255) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function numeric(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

export type SasPaySession = SasPayTransaction & {
  transaction?: string | { id: string } | null;
  checkout_url?: string;
};

export function sasPaySessionTransactionId(session: SasPaySession) {
  return typeof session.transaction === "string" ? session.transaction : session.transaction?.id;
}

export async function findSasPaySession(match: { externalId?: string; transactionId?: string }) {
  // Recovery for historical checkouts whose asynchronous persistence was lost.
  // Never attach by email or amount: only provider-owned metadata/transaction id.
  for (let page = 1; page <= 10; page++) {
    const data = await sasPayRequest<{ results: SasPaySession[]; next?: string | null }>(`/checkout-sessions/?page=${page}&page_size=100`);
    const session = data.results?.find((item) =>
      (match.externalId && sasPayExternalId(item) === match.externalId) ||
      (match.transactionId && sasPaySessionTransactionId(item) === match.transactionId));
    if (session) return session;
    if (!data.next) return null;
  }
  throw new Error("La vérification du paiement doit être reprise.");
}

export async function getSasPaySession(id: string) {
  try {
    return await sasPayRequest<SasPaySession>(`/checkout-sessions/${encodeURIComponent(id)}/`);
  } catch (error) {
    if (error instanceof SasPayHttpError && error.status === 404) return null;
    throw error;
  }
}

class SasPayHttpError extends Error {
  constructor(public status: number) { super("Le paiement n'est pas disponible pour le moment."); }
}

function getSasPayCurrency() {
  const configured = getRuntimeEnv("SASPAY_CURRENCY")?.trim().toUpperCase();
  return configured === "XOF" || configured === "XAF" ? configured : SASPAY_CURRENCY;
}

export async function getSasPayApiKey() {
  return getConfig("SASPAY_API_KEY");
}

export async function isSasPayConfigured() {
  return Boolean(await getSasPayApiKey());
}

function payloadFromBody<T>(body: unknown): T | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.data && typeof record.data === "object") return record.data as T;
  return record as T;
}

async function sasPayRequest<T>(path: string, init: RequestInit = {}) {
  const apiKey = await getSasPayApiKey();
  if (!apiKey) throw new Error("SasPay n'est pas encore configuré.");

  const response = await fetch(`${SASPAY_API_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(10000),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  const data = payloadFromBody<T>(body);
  if (!response.ok || !data) {
    const message = body && typeof body === "object" && typeof (body as Record<string, unknown>).message === "string"
      ? String((body as Record<string, unknown>).message).slice(0, 180)
      : undefined;
    console.error("SasPay request failed", { path, status: response.status, message });
    throw new SasPayHttpError(response.status);
  }
  return data;
}

export async function initiateSasPayCheckout(params: {
  amountXaf: number;
  email: string;
  customerName: string;
  phone?: string;
  externalId: string;
  description: string;
  returnUrl: string;
}) {
  const data = await sasPayRequest<{
    id?: string;
    payment_id?: string;
    checkout_url?: string | null;
    checkoutUrl?: string | null;
    status?: string | null;
    amount?: string | number | null;
  }>("/checkout-sessions/", {
    method: "POST",
    body: JSON.stringify({
      amount: params.amountXaf.toFixed(2),
      currency: getSasPayCurrency(),
      description: params.description.slice(0, 180),
      country: "CM",
      customer_email: params.email,
      customer_name: params.customerName.slice(0, 120),
      ...(params.phone ? { customer_phone: params.phone.slice(0, 24) } : {}),
      return_url: params.returnUrl,
      metadata: {
        external_id: params.externalId,
        source: "livefoot",
      },
    }),
  });

  const id = clean(data.id, 120);
  const checkoutUrl = getAllowedCheckoutUrl(clean(data.checkout_url ?? data.checkoutUrl, 2048), ["saspay.me"]);
  if (!id || !checkoutUrl) throw new Error("La page de paiement n'a pas pu être ouverte.");
  return {
    id,
    checkoutUrl,
    status: clean(data.status, 40) ?? "PENDING",
    amountXaf: numeric(data.amount),
  } satisfies SasPayCheckoutResult;
}

export async function getSasPayPayment(paymentId: string) {
  return sasPayRequest<SasPayTransaction>(`/payments/${encodeURIComponent(paymentId)}/verify/`);
}

export async function getSasPayWebhookSecret() {
  return getConfig("SASPAY_WEBHOOK_SECRET");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

export async function verifySasPayWebhookSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
) {
  const secret = await getSasPayWebhookSecret();
  if (!secret || !signature || !timestamp || !/^\d{1,15}$/.test(timestamp)) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > WEBHOOK_TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  ).catch(() => null);
  if (!key) return false;
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = Array.from(new Uint8Array(signed)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const received = signature.trim().replace(/^sha256=/i, "").toLowerCase();
  return constantTimeEqual(received, expected);
}

export function sasPayExternalId(transaction: SasPayTransaction) {
  const values = [
    transaction.external_reference,
    transaction.metadata?.external_id,
    transaction.metadata?.externalId,
  ];
  return values.find((value): value is string => typeof value === "string" && /^(sub|pk|promo)_[A-Za-z0-9]+$/.test(value)) ?? null;
}

export function sasPayStatus(transaction: SasPayTransaction) {
  return clean(transaction.status, 40)?.toUpperCase() ?? "PENDING";
}

export function sasPayAmount(transaction: SasPayTransaction) {
  return numeric(transaction.requested_amount ?? transaction.amount ?? transaction.debited_amount ?? transaction.charged);
}

export function sasPayCurrency(transaction: SasPayTransaction) {
  return clean(transaction.currency, 8)?.toUpperCase() ?? null;
}
