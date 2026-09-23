function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function timestampSeconds(timestamp: string) {
  if (/^\d{1,15}$/.test(timestamp)) return Number(timestamp);
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

export async function verifyRelayitHmacSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
  now = Date.now(),
) {
  if (!secret || !signature || !timestamp) return false;
  const seconds = timestampSeconds(timestamp);
  if (seconds === null || Math.abs(Math.floor(now / 1000) - seconds) > 600) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  ).catch(() => null);
  if (!key) return false;

  const signed = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  ));
  const expected = Array.from(signed).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const received = signature.trim().replace(/^sha256=/i, "").toLowerCase();
  return constantTimeEqual(received, expected);
}
