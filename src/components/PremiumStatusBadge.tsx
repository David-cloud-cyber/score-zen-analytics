import { Crown, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPremiumExpiry, isPremiumActive, premiumDaysRemaining, type PremiumProfile } from "@/lib/premium-status";

export function PremiumStatusBadge({
  profile,
  compact = false,
  className,
}: {
  profile: PremiumProfile | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  if (!isPremiumActive(profile)) return null;

  const days = premiumDaysRemaining(profile?.premium_until);
  const expiry = formatPremiumExpiry(profile?.premium_until);
  const proActive = Boolean(profile?.referral_pro_until && new Date(profile.referral_pro_until).getTime() > Date.now());

  return (
    <a
      href="/premium/tableau-de-bord"
      aria-label={expiry ? `Premium actif jusqu'au ${expiry}` : "Premium actif"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-brand/10 text-brand ring-1 ring-brand/25 transition-colors hover:bg-brand/15",
        compact ? "px-2 py-1 text-[10px] font-black" : "px-2.5 py-1.5 text-[11px] font-black",
        className,
      )}
    >
      {compact ? <Crown className="size-3" aria-hidden /> : <ShieldCheck className="size-3.5" aria-hidden />}
      <span>{proActive ? "Premium Pro" : "Premium actif"}</span>
      {!compact && days !== null && <span className="text-brand/70">· {days} j</span>}
    </a>
  );
}
