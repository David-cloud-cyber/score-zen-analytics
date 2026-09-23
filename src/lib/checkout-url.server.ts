/**
 * Provider checkout links are returned by a third party and are ultimately
 * opened by the browser. Keep the allow-list server-side so a compromised or
 * malformed provider response cannot turn a payment CTA into an open redirect.
 */
export function getAllowedCheckoutUrl(value: unknown, hosts: readonly string[]) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const hostAllowed = hosts.some((allowedHost) => {
      const normalized = allowedHost.toLowerCase();
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    });

    if (url.protocol !== "https:" || !hostAllowed || url.username || url.password || url.port) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}
