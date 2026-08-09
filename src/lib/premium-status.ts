export type PremiumProfile = {
  plan?: string | null;
  premium_until?: string | null;
};

/** Source unique pour décider si les droits Premium sont encore actifs. */
export function isPremiumActive(profile: PremiumProfile | null | undefined): boolean {
  if (profile?.plan !== "premium") return false;
  if (!profile.premium_until) return true;
  const expiresAt = new Date(profile.premium_until).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function formatPremiumExpiry(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function premiumDaysRemaining(value: string | null | undefined): number | null {
  if (!value) return null;
  const expiresAt = new Date(value).getTime();
  if (!Number.isFinite(expiresAt)) return null;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 86_400_000));
}
