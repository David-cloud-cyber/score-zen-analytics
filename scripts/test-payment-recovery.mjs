import assert from "node:assert/strict";
import { getLatestFailedPayment } from "../src/lib/payment-recovery.ts";

const created_at = new Date().toISOString();
const subscription = (overrides = {}) => ({
  id: "subscription-1",
  status: "FAILED",
  created_at,
  amount_xaf: 5000,
  plan_id: "premium_monthly",
  ...overrides,
});

assert.equal(
  getLatestFailedPayment({ subscriptions: [subscription()], payments: [] }),
  null,
  "A failed server-side checkout without a hosted link must not be advertised as a failed payment",
);

const actualFailed = getLatestFailedPayment({
  subscriptions: [subscription({ had_checkout: true, plan_id: "premium_yearly" })],
  payments: [],
});
assert.equal(actualFailed?.planId, "premium_yearly");
assert.equal(actualFailed?.hadCheckout, true);

assert.equal(
  getLatestFailedPayment({
    subscriptions: [subscription({ had_checkout: true, status: "SUCCESSFUL" })],
    payments: [],
  }),
  null,
);

console.log("Payment recovery tests passed");
