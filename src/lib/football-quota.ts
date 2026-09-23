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
