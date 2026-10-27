import assert from "node:assert/strict";
import { ACTIVE_PAYMENT_PROVIDER } from "../src/lib/payment-provider.ts";

assert.equal(ACTIVE_PAYMENT_PROVIDER, "saspay");
console.log("Active payment provider test passed");
