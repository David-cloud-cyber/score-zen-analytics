import { Crown, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function PremiumCta({ location, compact = false, label }: { location: string; compact?: boolean; label?: string }) {
  useEffect(() => {
    track("premium_cta_view", { location });
  }, [location]);

  const desktopLabel = label ?? (compact ? "Voir Premium" : "Passer Premium");

  return (
    <a
      href="/premium"
      aria-label={desktopLabel}
      title={desktopLabel}
      onClick={() => track("premium_cta_click", { location })}
      className={compact ? "inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand/10 px-2.5 py-2 text-[11px] font-black text-brand transition-colors hover:bg-brand/15 sm:px-3" : "inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-3.5 py-2.5 text-xs font-black text-brand-foreground transition-transform active:scale-95"}
    >
      <Crown className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">{desktopLabel}</span>
      <span className="sm:hidden">Premium</span>
      <ArrowRight className="size-3.5" aria-hidden />
    </a>
  );
}
