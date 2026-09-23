export type PaymentRecoveryAttempt = {
  id: string;
  kind: "subscription" | "pack";
  status: string;
  createdAt: string;
  amountXaf: number | null;
  planId: string | null;
  packId: string | null;
};

type PaymentHistoryRecord = {
  id: string;
  status: string | null;
  created_at: string;
  amount_xaf: number | null;
  plan_id?: string | null;
  pack_id?: string | null;
};

type PaymentHistorySnapshot = {
  payments: PaymentHistoryRecord[];
  subscriptions: PaymentHistoryRecord[];
};

const FAILED_STATUSES = new Set([
  "FAILED",
  "EXPIRED",
  "UNDERPAID",
  "CANCELLED",
  "CANCELED",
  "ABANDONED",
]);

const RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Returns the most recent real failed checkout that is still useful to recover. */
export function getLatestFailedPayment(
  snapshot: PaymentHistorySnapshot | null | undefined,
): PaymentRecoveryAttempt | null {
  if (!snapshot) return null;

  const now = Date.now();
  const candidates: PaymentRecoveryAttempt[] = [
    ...snapshot.subscriptions.map((record) => ({
      id: record.id,
      kind: "subscription" as const,
      status: record.status ?? "",
      createdAt: record.created_at,
      amountXaf: record.amount_xaf,
      planId: record.plan_id ?? null,
      packId: null,
    })),
    ...snapshot.payments.map((record) => ({
      id: record.id,
      kind: "pack" as const,
      status: record.status ?? "",
      createdAt: record.created_at,
      amountXaf: record.amount_xaf,
      planId: null,
      packId: record.pack_id ?? null,
    })),
  ];

  return (
    candidates
      .filter((candidate) => {
        const timestamp = Date.parse(candidate.createdAt);
        return (
          FAILED_STATUSES.has(candidate.status.toUpperCase()) &&
          Number.isFinite(timestamp) &&
          now - timestamp <= RECOVERY_WINDOW_MS
        );
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null
  );
}
