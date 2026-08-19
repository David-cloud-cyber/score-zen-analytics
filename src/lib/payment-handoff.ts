const PENDING_PAYMENT_KEY = "livefoot_pending_payment";
const PAYMENT_HANDOFF_TTL_MS = 30 * 60 * 1000;

export type PaymentHandoff = {
  externalId: string;
  transId: string;
  createdAt: number;
};

export function rememberPaymentHandoff(input: Omit<PaymentHandoff, "createdAt">) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      PENDING_PAYMENT_KEY,
      JSON.stringify({ ...input, createdAt: Date.now() } satisfies PaymentHandoff),
    );
  } catch {
    // Storage may be unavailable in private browsing. The webhook remains the fallback.
  }
}

export function readPaymentHandoff(externalId: string): PaymentHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PaymentHandoff>;
    if (
      value.externalId !== externalId ||
      typeof value.transId !== "string" ||
      typeof value.createdAt !== "number" ||
      Date.now() - value.createdAt > PAYMENT_HANDOFF_TTL_MS
    ) {
      sessionStorage.removeItem(PENDING_PAYMENT_KEY);
      return null;
    }
    return value as PaymentHandoff;
  } catch {
    return null;
  }
}

export function clearPaymentHandoff() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_PAYMENT_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}
