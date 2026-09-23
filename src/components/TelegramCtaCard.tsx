import { Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { ReferralCta } from "@/components/ReferralCta";
import { cn } from "@/lib/utils";

export const TELEGRAM_CHANNEL_URL = "https://t.me/livefootia";

export type TelegramCtaLocation =
  | "home_bottom"
  | "community_hero"
  | "community_footer"
  | "blog_index"
  | "blog_football"
  | "blog_article"
  | "premium_footer";

export function TelegramCtaCard({
  location,
  compact = false,
  className,
}: {
  location: TelegramCtaLocation;
  compact?: boolean;
  className?: string;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const trackedView = useRef(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !trackedView.current) {
          trackedView.current = true;
          track("telegram_cta_view", { location });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [location]);

  return (
    <div className={cn("space-y-3", className)}>
      {location === "blog_article" ? <ReferralCta location="blog_article" showGuest showProgress /> : null}
      <section
        ref={cardRef}
        aria-labelledby={`telegram-cta-title-${location}`}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-sky-500/35 bg-gradient-to-br from-sky-500/10 via-card to-brand/5 p-4 shadow-[0_14px_36px_-24px_rgba(14,165,233,0.85)] ring-1 ring-black/5 dark:ring-white/5",
          compact ? "sm:p-4" : "sm:p-5",
        )}
      >
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-500 text-white shadow-sm shadow-sky-500/30">
            <Send className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
              Canal officiel LiveFoot
            </p>
            <h2
              id={`telegram-cta-title-${location}`}
              className="text-base font-black leading-tight text-foreground"
            >
              Rejoins la communauté LiveFoot sur Telegram
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Scores live, analyses football, alertes utiles et nouveautés directement dans ton
              canal Telegram.
            </p>
            <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
              Accès gratuit · sans inscription supplémentaire
            </p>
          </div>
        </div>
        <a
          href={TELEGRAM_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("telegram_cta_click", { location })}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-brand-foreground shadow-sm shadow-brand/20 transition-[transform,background-color,box-shadow] hover:bg-brand/90 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:w-auto lg:min-w-56"
          aria-label="Rejoindre le canal LiveFoot sur Telegram"
        >
          Rejoindre Telegram gratuitement <Send className="size-3.5" aria-hidden />
        </a>
        </div>
      </section>
    </div>
  );
}
