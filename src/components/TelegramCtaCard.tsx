import { Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const TELEGRAM_CHANNEL_URL = "https://t.me/livefootia";

export type TelegramCtaLocation =
  | "home_bottom"
  | "community_hero"
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
    <section
      ref={cardRef}
      aria-labelledby={`telegram-cta-title-${location}`}
      className={cn(
        "rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 ring-1 ring-black/5 dark:ring-white/5",
        compact ? "sm:p-4" : "sm:p-5",
        className,
      )}
    >
      <div className={cn("flex gap-3", compact ? "flex-col sm:flex-row sm:items-center sm:justify-between" : "items-start sm:items-center sm:justify-between")}>
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-500">
            <Send className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id={`telegram-cta-title-${location}`} className="text-sm font-black text-foreground">
              Rejoins la communauté LiveFoot sur Telegram
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Scores live, analyses football, alertes utiles et nouveautés directement dans ton canal Telegram.
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
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-brand-foreground transition-transform hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Rejoindre le canal LiveFoot sur Telegram"
        >
          Rejoindre le canal <Send className="size-3.5" aria-hidden />
        </a>
      </div>
    </section>
  );
}
