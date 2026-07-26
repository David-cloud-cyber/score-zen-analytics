// Client serveur pour l'API Fapshi (Mobile Money / Orange Money — Cameroun).
// Sandbox : https://sandbox.fapshi.com — Live : https://live.fapshi.com

export type FapshiStatus = "CREATED" | "PENDING" | "SUCCESSFUL" | "FAILED" | "EXPIRED";

export type FapshiTransaction = {
  transId: string;
  status: FapshiStatus;
  medium?: string;
  amount: number;
  revenue?: number;
  email?: string;
  externalId?: string;
  userId?: string;
  dateInitiated?: string;
  dateConfirmed?: string;
};

function config() {
  const apiUser = process.env.FAPSHI_API_USER;
  const apiKey = process.env.FAPSHI_API_KEY;
  const base = (process.env.FAPSHI_BASE_URL ?? "https://sandbox.fapshi.com").replace(/\/+$/, "");
  if (!apiUser || !apiKey) {
    throw new Error("Paiement indisponible : identifiants Fapshi non configurés.");
  }
  return { apiUser, apiKey, base };
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { apiUser, apiKey, base } = config();
  const res = await fetch(`${base}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      apiuser: apiUser,
      apikey: apiKey,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Fapshi ${path} failed [${res.status}]: ${text}`);
    throw new Error(`Fapshi a refusé la requête [${res.status}].`);
  }
  return JSON.parse(text) as T;
}

export function initiatePay(params: {
  amount: number;
  email?: string;
  redirectUrl?: string;
  userId?: string;
  externalId?: string;
  message?: string;
}) {
  return call<{ message: string; link: string; transId: string; dateInitiated: string }>(
    "/initiate-pay",
    { method: "POST", body: params },
  );
}

export function paymentStatus(transId: string) {
  return call<FapshiTransaction>(`/payment-status/${encodeURIComponent(transId)}`);
}
