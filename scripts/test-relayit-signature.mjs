import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { verifyRelayitHmacSignature } from "../src/lib/relayit-signature.ts";

globalThis.crypto ??= webcrypto;

const secret = "relayit-webhook-test-secret";
const body = JSON.stringify({ event: "payment.success", data: { id: "test-payment" } });
const now = Date.now();
const timestamp = String(Math.floor(now / 1000));
const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

assert.equal(await verifyRelayitHmacSignature(body, signature, timestamp, secret, now), true);
assert.equal(await verifyRelayitHmacSignature(body, `sha256=${signature}`, timestamp, secret, now), true);
assert.equal(await verifyRelayitHmacSignature(`${body} `, signature, timestamp, secret, now), false);
assert.equal(await verifyRelayitHmacSignature(body, "00", timestamp, secret, now), false);
assert.equal(await verifyRelayitHmacSignature(body, signature, null, secret, now), false);
assert.equal(await verifyRelayitHmacSignature(body, signature, "not-a-timestamp", secret, now), false);
assert.equal(
  await verifyRelayitHmacSignature(body, signature, String(Math.floor(now / 1000) - 601), secret, now),
  false,
);
assert.equal(
  await verifyRelayitHmacSignature(body, signature, String(Math.floor(now / 1000) + 601), secret, now),
  false,
);

console.log("Relayit webhook HMAC tests passed.");
