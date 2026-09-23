import { getAllowedCheckoutUrl } from "./checkout-url.server";
import { getConfig, getRuntimeEnv } from "./config.server";
import { verifyRelayitHmacSignature } from "./relayit-signature";

const RELAYIT_API_BASE = "https://api.relayit.fun/v1";
const RELAYIT_DEFAULT_CURRENCY = "XAF";

export type RelayitCheckoutResult = {
  id: string | null;
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

function relayitCurrency() {
  const configured = (getRuntimeEnv("RELAYIT_CURRENCY") ?? RELAYIT_DEFAULT_CURRENCY).trim().toUpperCase();
  return configured === "XOF" || configured === "XAF" ? configured : RELAYIT_DEFAULT_CURRENCY;
}

export async function getRelayitApiKey() {
  return getConfig("RELAYIT_API_KEY");
}

export async function getRelayitWebhookSecret() {
  return getConfig("RELAYIT_WEBHOOK_SECRET");
}

export async function isRelayitConfigured() {
  const [apiKey, webhookSecret] = await Promise.all([getRelayitApiKey(), getRelayitWebhookSecret()]);
  return Boolean(apiKey && webhookSecret);
}

function payloadFromBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  return record.data && typeof record.data === "object"
    ? record.data as Record<string, unknown>
    : record;
}

async function relayitRequest<T>(path: string, init: RequestInit = {}) {
  const apiKey = await getRelayitApiKey();
  if (!apiKey) throw new Error("Relayit n'est pas encore configuré.");

  const response = await fetch(`${RELAYIT_API_BASE}${path}`, {
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
  const data = payloadFromBody(body);
  if (!response.ok || !data) {
    const message = body && typeof body === "object" && typeof (body as Record<string, unknown>).message === "string"
      ? String((body as Record<string, unknown>).message).slice(0, 180)
      : undefined;
    console.error("Relayit request failed", { path, status: response.status, message });
    throw new Error("Le paiement n'est pas disponible pour le moment.");
  }
  return data as T;
}

export async function initiateRelayitCheckout(params: {
  amountXaf: number;
  email: string;
  customerName: string;
  externalId: string;
  description: string;
  returnUrl: string;
}) {
  // Relayit hosts the payment form, so the payer chooses/enters their payment
  // method there. Avoid blocking checkout on the optional catalog endpoints.
  const checkoutPayload = {
    amount: Math.round(params.amountXaf),
    currency: relayitCurrency(),
    customer_email: params.email,
    customer_name: params.customerName.slice(0, 120),
    description: params.description.slice(0, 180),
    return_url: params.returnUrl,
    metadata: {
      external_id: params.externalId,
      source: "livefoot",
    },
  };

  const data = await relayitRequest<Record<string, unknown>>("/checkout-sessions", {
    method: "POST",
    headers: {
      // Relayit guarantees that retrying this request does not create a second payment.
      "Idempotency-Key": params.externalId,
    },
    body: JSON.stringify(checkoutPayload),
  });

  const payment = data.payment && typeof data.payment === "object" ? data.payment as Record<string, unknown> : undefined;
  const checkoutUrl = getAllowedCheckoutUrl(
    clean(data.checkout_url ?? data.checkoutUrl ?? data.url ?? payment?.checkout_url ?? payment?.checkoutUrl, 2048),
    ["relayit.fun"],
  );
  const id = clean(data.id ?? data.session_id ?? data.payment_id ?? data.transaction_id ?? payment?.id, 120) ?? null;
  const status = clean(data.status ?? payment?.status, 40) ?? "PENDING";
  if (!checkoutUrl) throw new Error("La page de paiement n'a pas pu être ouverte.");

  return {
    id,
    checkoutUrl,
    status,
    amountXaf: numeric(data.amount ?? payment?.amount),
  } satisfies RelayitCheckoutResult;
}

/**
 * Relayit signs the exact timestamp + "." + raw request body with HMAC-SHA256.
 * Requiring the timestamp and enforcing its replay window prevents accepting
 * unsigned legacy payloads or replaying an old successful payment event.
 */
export async function verifyRelayitWebhookSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
) {
  const secret = await getRelayitWebhookSecret();
  if (!secret) return false;
  return verifyRelayitHmacSignature(rawBody, signature, timestamp, secret);
}

export function relayitCurrencyValue(value: unknown) {
  return clean(value, 8)?.toUpperCase() ?? null;
}

export function relayitStatus(value: unknown) {
  return clean(value, 40)?.toLowerCase() ?? "pending";
}
