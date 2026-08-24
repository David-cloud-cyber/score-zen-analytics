import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock3, Crown, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import type { DailyPredictionItem } from "@/lib/daily-predictions.types";
import { cn } from "@/lib/utils";

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <img src={src} alt={`Logo ${name}`} width={42} height={42} className="size-10 object-contain" />
  ) : (
    <span className="grid size-10 place-items-center rounded-full bg-surface text-xs font-black">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function statusLabel(status: DailyPredictionItem["status"]) {
  return {
    pending: "À venir",
    won: "Gagné",
    lost: "Perdu",
    unresolvable: "Non réglable",
  }[status];
}

export function DailyPredictionCard({
  item,
  compact = false,
}: {
  item: DailyPredictionItem;
  compact?: boolean;
}) {
  const kickoff = new Date(item.kickoff).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.13em] text-brand">
            {item.leagueName}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
            <Clock3 className="size-3" /> {kickoff} · publié avant le match
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase",
            item.status === "won"
              ? "bg-brand/10 text-brand"
              : item.status === "lost"
                ? "bg-alert/10 text-alert"
                : "bg-surface text-muted-foreground",
          )}
        >
          {statusLabel(item.status)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div className="flex min-w-0 flex-col items-center gap-1.5">
          <TeamLogo src={item.homeLogo} name={item.homeTeam} />
          <p className="line-clamp-2 text-xs font-black">{item.homeTeam}</p>
        </div>
        <span className="text-xs font-black text-muted-foreground">VS</span>
        <div className="flex min-w-0 flex-col items-center gap-1.5">
          <TeamLogo src={item.awayLogo} name={item.awayTeam} />
          <p className="line-clamp-2 text-xs font-black">{item.awayTeam}</p>
        </div>
      </div>

      {item.locked ? (
        <div className="mt-4 rounded-xl border border-brand/20 bg-brand/[0.04] p-3 text-center">
          <div className="pointer-events-none select-none blur-[6px]" aria-hidden>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">
              Sélection Premium
            </p>
            <p className="mt-1 text-base font-black">Pronostic complet du match</p>
            <div className="mx-auto mt-2 h-2 w-32 rounded-full bg-brand/40" />
          </div>
          <div className="mt-[-48px] flex min-h-14 flex-col items-center justify-center">
            <LockKeyhole className="size-4 text-brand" />
            <p className="mt-1 text-xs font-black">Sélection réservée aux membres Premium</p>
          </div>
          <Link
            to="/premium"
            search={{ plan: undefined }}
            className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-[11px] font-black text-[#06130e] transition-transform hover:-translate-y-0.5"
          >
            <Crown className="size-3.5" /> Tout débloquer
          </Link>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-surface p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                {item.marketLabel}
              </p>
              <p className="mt-1 text-sm font-black text-foreground">{item.pick}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xl font-black tabular-nums text-brand">{item.probability}%</p>
              <p className="text-[9px] font-bold text-muted-foreground">probabilité</p>
            </div>
          </div>
          {!compact && (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {item.rationale}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
              <ShieldCheck className="size-3.5 text-brand" /> Confiance {item.confidence}%
            </span>
            {item.finalScore && (
              <span className="text-[10px] font-black">Score : {item.finalScore}</span>
            )}
          </div>
        </div>
      )}

      <Link
        to="/live/$id"
        params={{ id: String(item.fixtureId) }}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-black text-foreground hover:text-brand"
      >
        Voir le match <ArrowRight className="size-3.5" />
      </Link>
      {!item.locked && !compact && item.factors.length > 0 && (
        <details className="mt-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[10px] font-black">
            <Sparkles className="size-3.5 text-brand" /> Pourquoi cette sélection ?
          </summary>
          <ul className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-muted-foreground">
            {item.factors.map((factor) => (
              <li key={factor}>• {factor}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
