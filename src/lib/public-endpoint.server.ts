const buckets = new Map<string, { startedAt: number; count: number }>();
const WINDOW_MS = 10 * 60 * 1000;

function clientKey(request: Request, scope: string) {
  const address = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim()
    ?? "unknown";
  return `${scope}:${address}`;
}

export function allowPublicRequest(request: Request, scope: string, limit = 60) {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.startedAt > WINDOW_MS) buckets.delete(key);
  }
  if (buckets.size > 2_000) buckets.clear();

  const key = clientKey(request, scope);
  const current = buckets.get(key);
  if (!current || now - current.startedAt > WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export async function readJsonBody(request: Request, maxBytes = 32_000) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) return null;
  const rawBody = await request.text();
  if (rawBody.length > maxBytes) return null;
  try {
    const parsed = JSON.parse(rawBody);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
