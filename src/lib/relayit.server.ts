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

export type RelayitCheckoutDetails = {
  country: string;
  currency: "XAF" | "XOF";
  network: string;
  phone: string;
};

export type RelayitCountryOption = { code: string; name: string; currency: "XAF" | "XOF" };
export type RelayitNetworkOption = { code: string; name: string };

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

function listFromPayload(body: unknown, names: string[]): Record<string, unknown>[] {
  if (Array.isArray(body)) return body.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  const data = record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : record;
  if (Array.isArray(data)) return data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  for (const name of names) {
    const candidate = data[name];
    if (Array.isArray(candidate)) return candidate.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }
  return [];
}

function catalogString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function relayitPublicCatalog(path: string) {
  const response = await fetch(`${RELAYIT_API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Le catalogue des moyens de paiement est temporairement indisponible.");
  return response.json() as Promise<unknown>;
}

export async function getRelayitPaymentCountries(): Promise<RelayitCountryOption[]> {
  const body = await relayitPublicCatalog("/countries");
  return listFromPayload(body, ["countries", "items", "results"])
    .map((country) => {
      const code = catalogString(country, ["code", "country_code", "countryCode", "iso2", "iso_code"])?.toUpperCase();
      const currency = catalogString(country, ["currency", "currency_code", "currencyCode"])?.toUpperCase();
      const name = catalogString(country, ["name", "label", "country_name", "countryName"]);
      return code && name && (currency === "XAF" || currency === "XOF")
        ? { code, name, currency }
        : null;
    })
    .filter((value): value is RelayitCountryOption => value !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function getRelayitPaymentNetworks(countryCode: string): Promise<RelayitNetworkOption[]> {
  const body = await relayitPublicCatalog(`/networks?country=${encodeURIComponent(countryCode.toUpperCase())}`);
  return listFromPayload(body, ["networks", "items", "results"])
    .map((network) => {
      const code = catalogString(network, ["code", "network_code", "networkCode", "slug"]);
      const name = catalogString(network, ["name", "label", "network_name", "networkName"]);
      return code && name ? { code, name } : null;
    })
    .filter((value): value is RelayitNetworkOption => value !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
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
  phone?: string;
  country: string;
  currency: "XAF" | "XOF";
  network: string;
  externalId: string;
  description: string;
  returnUrl: string;
}) {
  const phone = params.phone?.replace(/[\s()-]/g, "");
  if (!phone || !/^\+[1-9][0-9]{7,14}$/.test(phone)) {
    throw new Error("Saisissez un numéro Mobile Money au format international.");
  }
  if (!/^[A-Z]{2}$/.test(params.country) || !/^[a-z0-9_-]{2,40}$/i.test(params.network)) {
    throw new Error("Sélectionnez un pays et un réseau Mobile Money valides.");
  }

  const data = await relayitRequest<Record<string, unknown>>("/checkout-sessions", {
    method: "POST",
    headers: {
      // Relayit guarantees that retrying this request does not create a second payment.
      "Idempotency-Key": params.externalId,
    },
    body: JSON.stringify({
      amount: Math.round(params.amountXaf),
      currency: params.currency || relayitCurrency(),
      country: params.country,
      network: params.network,
      customer_email: params.email,
      customer_name: params.customerName.slice(0, 120),
      customer_phone: phone.slice(0, 24),
      description: params.description.slice(0, 180),
      return_url: params.returnUrl,
      metadata: {
        external_id: params.externalId,
        source: "livefoot",
      },
    }),
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
