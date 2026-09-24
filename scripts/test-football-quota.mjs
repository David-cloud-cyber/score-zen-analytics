import assert from "node:assert/strict";
import {
  dailyQuotaReserve,
  quotaPacedRefreshMs,
  readQuotaHeader,
  reserveProbeDelay,
} from "../src/lib/football-quota.ts";

const absent = new Headers();
assert.equal(readQuotaHeader(absent, ["x-ratelimit-requests-remaining"]), undefined);
assert.equal(readQuotaHeader(new Headers({ "x-ratelimit-requests-remaining": "" }), ["x-ratelimit-requests-remaining"]), undefined);
assert.equal(readQuotaHeader(new Headers({ "x-ratelimit-requests-remaining": "0" }), ["x-ratelimit-requests-remaining"]), 0);
assert.equal(readQuotaHeader(new Headers({ "x-ratelimit-day-remaining": "42" }), ["x-ratelimit-requests-remaining", "x-ratelimit-day-remaining"]), 42);

assert.equal(dailyQuotaReserve(100, 0.15, 250), 15);
assert.equal(dailyQuotaReserve(7_500, 0.15, 250), 1_125);
assert.equal(dailyQuotaReserve(undefined, 0.15, 250), 0);
assert.equal(quotaPacedRefreshMs(30_000, 100), 2_250_000);
assert.equal(quotaPacedRefreshMs(30_000, 7_500), 30_000);
assert.equal(quotaPacedRefreshMs(120_000, 100), 9_000_000);

const beforeReset = Date.parse("2026-09-23T23:59:00.000Z");
assert.equal(reserveProbeDelay(beforeReset, beforeReset - 60_000, 0, 30 * 60_000), 60_000);
assert.equal(reserveProbeDelay(beforeReset + 60_000, beforeReset, 0, 30 * 60_000), 0);
assert.equal(reserveProbeDelay(beforeReset, beforeReset - 10 * 60_000, 100, 30 * 60_000), 20 * 60_000);
assert.equal(reserveProbeDelay(beforeReset, beforeReset - 31 * 60_000, 100, 30 * 60_000), 0);

console.log("Football quota tests passed.");
