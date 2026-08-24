import { Crown, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function PremiumCta({
  location,
  compact = false,
  label,
  mobileIconOnly = false,
}: {
  location: string;
  compact?: boolean;
  label?: string;
  mobileIconOnly?: boolean;
}) {
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
      className={
        compact
          ? mobileIconOnly
            ? "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-black text-brand transition-colors hover:bg-brand/15 min-[400px]:h-9 min-[400px]:w-auto min-[400px]:gap-1.5 min-[400px]:rounded-lg min-[400px]:px-2.5 sm:px-3"
            : "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand/10 px-3 text-[11px] font-black text-brand transition-colors hover:bg-brand/15"
          : "inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-3.5 py-2.5 text-xs font-black text-brand-foreground transition-transform active:scale-95"
      }
    >
      <Crown className="size-3.5" aria-hidden />
      {mobileIconOnly ? (
        <>
          <span className="hidden min-[400px]:inline sm:hidden">Premium</span>
          <span className="hidden sm:inline">{desktopLabel}</span>
        </>
      ) : (
        <span>{desktopLabel}</span>
      )}
      <ArrowRight
        className={mobileIconOnly ? "hidden size-3.5 sm:block" : "size-3.5"}
        aria-hidden
      />
    </a>
  );
}
