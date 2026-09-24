/** Missing provider headers must never be interpreted as zero remaining. */
export function readQuotaHeader(headers: Headers, names: readonly string[]): number | undefined {
  for (const name of names) {
    const raw = headers.get(name);
    if (raw === null || raw.trim() === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return undefined;
}

/** Keep a proportional reserve without blocking an entire small plan. */
export function dailyQuotaReserve(dayLimit: number | undefined, ratio: number, minimum: number): number {
  if (!dayLimit || dayLimit <= 0) return 0;
  const proportional = Math.max(1, Math.ceil(dayLimit * ratio));
  return Math.min(dayLimit - 1, dayLimit >= 1_000 ? Math.max(minimum, proportional) : proportional);
}

/** A smaller provider plan must refresh less often than the 7,500/day plan. */
export function quotaPacedRefreshMs(baseMs: number, dayLimit: number | undefined): number {
  if (!dayLimit || dayLimit <= 0) return baseMs;
  return Math.max(baseMs, Math.min(3 * 60 * 60_000, Math.ceil(baseMs * 7_500 / dayLimit)));
}

/** Wait for the UTC reset at zero, or sample sparingly inside the reserve. */
export function reserveProbeDelay(
  now: number,
  lastProviderResponseAt: number,
  remaining: number,
  probeIntervalMs: number,
): number {
  if (lastProviderResponseAt <= 0) return 0;
  const nowDay = new Date(now).toISOString().slice(0, 10);
  const lastDay = new Date(lastProviderResponseAt).toISOString().slice(0, 10);
  if (nowDay !== lastDay) return 0;
  if (remaining === 0) {
    const nextMidnight = Date.parse(`${nowDay}T00:00:00.000Z`) + 24 * 60 * 60_000;
    return Math.max(0, nextMidnight - now);
  }
  return Math.max(0, lastProviderResponseAt + probeIntervalMs - now);
}
