import { getConfig, getRuntimeEnv } from "./config.server";
import { constantTimeEqual, getAllowedCheckoutUrl } from "./checkout-url.server";

const CHARIOW_API_BASE = "https://api.chariow.com/v1";

export type ChariowProductKey =
  | "premium_monthly"
  | "premium_yearly"
  | "pack_starter"
  | "pack_plus"
  | "pack_pro"
  | "pack_max"
  | "promo_discovery";

export type ChariowCheckoutResult = {
  saleId: string | null;
  checkoutUrl: string | null;
  status: string;
  step: string;
  amountXaf: number | null;
};

export type ChariowSale = {
  id: string;
  status: string;
  amount?: { value?: number; currency?: string } | null;
  product?: { id?: string; slug?: string; name?: string } | null;
  customer?: { email?: string } | null;
  buyer?: { email?: string } | null;
  custom_metadata?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

const PRODUCT_CONFIG_KEYS: Record<ChariowProductKey, string> = {
  premium_monthly: "CHARIOW_PRODUCT_PREMIUM_MONTHLY",
  premium_yearly: "CHARIOW_PRODUCT_PREMIUM_YEARLY",
  pack_starter: "CHARIOW_PRODUCT_PACK_STARTER",
  pack_plus: "CHARIOW_PRODUCT_PACK_PLUS",
  pack_pro: "CHARIOW_PRODUCT_PACK_PRO",
  pack_max: "CHARIOW_PRODUCT_PACK_MAX",
  promo_discovery: "CHARIOW_PRODUCT_PROMO_DISCOVERY",
};

function clean(value: unknown, max = 255) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function numeric(value: unknown) {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

export async function getChariowApiKey() {
  return getConfig("CHARIOW_API_KEY");
}

export async function getChariowProductId(key: ChariowProductKey) {
  return getConfig(PRODUCT_CONFIG_KEYS[key]);
}

export async function isChariowConfiguredFor(key: ChariowProductKey) {
  const [apiKey, productId] = await Promise.all([getChariowApiKey(), getChariowProductId(key)]);
  return Boolean(apiKey && productId);
}

/**
 * Chariow's public payment links collect the phone number on the provider's
 * page. They are used as a safe fallback when an API checkout cannot start.
 */
export async function getChariowHostedCheckoutUrl(key: ChariowProductKey) {
  const [storeUrl, productId] = await Promise.all([
    getConfig("CHARIOW_STORE_URL"),
    getChariowProductId(key),
  ]);
  const configuredStoreUrl = storeUrl ?? getRuntimeEnv("CHARIOW_STORE_URL");
  if (!configuredStoreUrl || !productId) return null;
  try {
    const base = new URL(configuredStoreUrl);
    if (base.protocol !== "https:" || !["chariow.com", "mychariow.com"].some((host) => base.hostname === host || base.hostname.endsWith(`.${host}`))) return null;
    return new URL(`/${encodeURIComponent(productId)}/checkout`, `${base.origin}/`).toString();
  } catch {
    return null;
  }
}

async function chariowRequest<T>(path: string, init: RequestInit = {}) {
  const apiKey = await getChariowApiKey();
  if (!apiKey) throw new Error("Chariow n'est pas encore configuré.");

  const response = await fetch(`${CHARIOW_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => null)) as {
    data?: T;
    message?: string;
    errors?: Record<string, unknown> | unknown[];
  } | null;
  if (!response.ok || !body?.data) {
    console.error("Chariow request failed", {
      path,
      status: response.status,
      message: typeof body?.message === "string" ? body.message.slice(0, 180) : undefined,
      hasFieldErrors: Boolean(body?.errors && Object.keys(body.errors).length),
    });
    throw new Error("Le paiement n'est pas disponible pour le moment.");
  }
  return body.data;
}

export async function initiateChariowCheckout(params: {
  productKey: ChariowProductKey;
  email: string;
  firstName: string;
  lastName: string;
  phone?: { number: string; countryCode: string };
  externalId: string;
  redirectUrl: string;
}) {
  const productId = await getChariowProductId(params.productKey);
  if (!productId) throw new Error("Produit Chariow non configuré.");

  const data = await chariowRequest<{
    step?: string;
    purchase?: { id?: string; status?: string; amount?: { value?: number } };
    payment?: { checkout_url?: string | null; checkoutUrl?: string | null } | null;
    checkout_url?: string | null;
    checkoutUrl?: string | null;
  }>("/checkout", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
      ...(params.phone ? { phone: { number: params.phone.number, country_code: params.phone.countryCode } } : {}),
      payment_currency: "XAF",
      redirect_url: params.redirectUrl,
      custom_metadata: {
        external_id: params.externalId,
        source: "livefoot",
      },
    }),
  });

  const saleId = clean(data.purchase?.id, 120) ?? null;
  const checkoutUrl = getAllowedCheckoutUrl(
    clean(data.payment?.checkout_url ?? data.payment?.checkoutUrl ?? data.checkout_url ?? data.checkoutUrl, 2048),
    ["chariow.com", "mychariow.com"],
  );
  if (data.step !== "completed" && !checkoutUrl) {
    throw new Error("La page de paiement n'a pas pu être ouverte.");
  }

  return {
    saleId,
    checkoutUrl,
    status: clean(data.purchase?.status, 40) ?? (data.step === "completed" ? "completed" : "awaiting_payment"),
    step: clean(data.step, 40) ?? "payment",
    amountXaf: numeric(data.purchase?.amount?.value),
  } satisfies ChariowCheckoutResult;
}

export async function getChariowSale(saleId: string) {
  return chariowRequest<ChariowSale>(`/sales/${encodeURIComponent(saleId)}`);
}

export function chariowProductKeyFor(kind: "subscription" | "payment", id: string): ChariowProductKey {
  if (kind === "subscription") return id === "premium_yearly" ? "premium_yearly" : "premium_monthly";
  if (id === "promo_discovery") return "promo_discovery";
  return `pack_${id}` as ChariowProductKey;
}

export async function getChariowWebhookSecret() {
  return getConfig("CHARIOW_WEBHOOK_SECRET");
}

export async function verifyChariowWebhookSignature(rawBody: string, signature: string | null) {
  const secret = await getChariowWebhookSecret();
  if (!secret || !signature) return false;

  const normalized = signature.trim().replace(/^sha256=/i, "");
  // The provider currently documents the x-chariow-signature header. Accept
  // the two common encodings without ever logging the secret or payload.
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]).catch(() => null);
  if (!key) return false;
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(signed)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return constantTimeEqual(normalized, hex) || constantTimeEqual(normalized, base64);
}
