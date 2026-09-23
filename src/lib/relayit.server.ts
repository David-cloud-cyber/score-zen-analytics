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

export type RelayitCredentialStatus = "valid" | "invalid" | "unavailable" | "missing";

let credentialCheck: { key: string; status: RelayitCredentialStatus; checkedAt: number } | null = null;

/** Read-only credential probe for the private admin health panel. Never exposes the key. */
export async function getRelayitCredentialStatus(): Promise<RelayitCredentialStatus> {
  const key = await getRelayitApiKey();
  if (!key) return "missing";
  if (credentialCheck?.key === key && Date.now() - credentialCheck.checkedAt < 60_000) {
    return credentialCheck.status;
  }
  let status: RelayitCredentialStatus = "unavailable";
  try {
    const response = await fetch(`${RELAYIT_API_BASE}/payment-links?limit=1`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) status = "valid";
    else if (response.status === 401 || response.status === 403) status = "invalid";
  } catch {
    // An unreachable provider is different from a rejected credential.
  }
  credentialCheck = { key, status, checkedAt: Date.now() };
  return status;
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

  let response: Response;
  try {
    response = await fetch(`${RELAYIT_API_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    console.error("Relayit request unavailable", {
      path,
      category: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network",
    });
    throw new Error("Le paiement n'est pas disponible pour le moment.");
  }
  const body = await response.json().catch(() => null);
  const data = payloadFromBody(body);
  if (!response.ok || !data) {
    const error = body && typeof body === "object" ? (body as Record<string, unknown>).error : null;
    const code = error && typeof error === "object" && typeof (error as Record<string, unknown>).code === "string"
      ? String((error as Record<string, unknown>).code).slice(0, 80)
      : undefined;
    console.error("Relayit request failed", { path, status: response.status, code });
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
  // A checkout-session requires country, network and Mobile Money phone before
  // creation. A one-use payment link lets Relayit collect those on its hosted
  // page, so the CTA can redirect without a local payment form.
  const paymentLinkPayload = {
    name: params.description.slice(0, 120),
    amount_type: "FIXED",
    amount: Math.round(params.amountXaf),
    currency: relayitCurrency(),
    description: params.description.slice(0, 180),
    return_url: params.returnUrl,
    usage_limit: 1,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    metadata: {
      external_id: params.externalId,
      source: "livefoot",
    },
  };

  const data = await relayitRequest<Record<string, unknown>>("/payment-links", {
    method: "POST",
    headers: {
      // Retrying the same request must return the original link.
      "Idempotency-Key": params.externalId,
    },
    body: JSON.stringify(paymentLinkPayload),
  });

  const link = data.link && typeof data.link === "object" ? data.link as Record<string, unknown> : undefined;
  const checkoutUrl = getAllowedCheckoutUrl(
    clean(link?.url ?? data.url ?? data.checkout_url, 2048),
    ["relayit.fun"],
  );
  if (!checkoutUrl) {
    console.error("Relayit payment link response missing allowed URL");
    throw new Error("La page de paiement n'a pas pu être ouverte.");
  }
  const returnedAmount = numeric(data.amount ?? link?.amount);
  if (returnedAmount !== null && returnedAmount !== Math.round(params.amountXaf)) {
    console.error("Relayit payment link amount mismatch");
    throw new Error("La page de paiement n'a pas pu être ouverte.");
  }

  return {
    // The payment-link ID is not the transaction ID sent by the webhook.
    id: null,
    checkoutUrl,
    status: "PENDING",
    amountXaf: returnedAmount,
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
