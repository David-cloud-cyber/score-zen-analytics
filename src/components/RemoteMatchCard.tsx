import { Link } from "@tanstack/react-router";
import type { RemoteMatchSummary } from "@/lib/football-types";
import { cn } from "@/lib/utils";

export function RemoteMatchCard({ match }: { match: RemoteMatchSummary }) {
  const isLive = match.status === "live" || match.status === "ht";
  const isFinished = match.status === "finished";
  return (
    <Link
      to="/live/$id"
      params={{ id: String(match.id) }}
      className="group block rounded-2xl bg-card ring-1 ring-black/5 transition-all hover:ring-black/10 active:scale-[0.99] dark:ring-white/10"
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
        <img src={match.league.logo} alt="" className="size-3.5 shrink-0 object-contain" loading="lazy" />
        <span className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {match.league.name}
        </span>
        {match.venue && (
          <span className="ml-auto truncate text-[10px] font-medium text-muted-foreground">
            {match.venue.split(",")[0]}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex flex-1 flex-col gap-2.5">
          <TeamRow
            logo={match.home.logo}
            name={match.home.short}
            fullName={match.home.name}
            score={match.homeScore}
            showScore={!isFinished ? isLive : true}
            dim={isFinished && (match.homeScore ?? 0) < (match.awayScore ?? 0)}
            winner={isFinished && (match.homeScore ?? 0) > (match.awayScore ?? 0)}
          />
          <TeamRow
            logo={match.away.logo}
            name={match.away.short}
            fullName={match.away.name}
            score={match.awayScore}
            showScore={!isFinished ? isLive : true}
            dim={isFinished && (match.awayScore ?? 0) < (match.homeScore ?? 0)}
            winner={isFinished && (match.awayScore ?? 0) > (match.homeScore ?? 0)}
          />
        </div>
        <div className="ml-2 flex w-16 flex-col items-center border-l border-border/60 pl-3">
          {isLive ? (
            <>
              <span className="flex items-center gap-1 text-[11px] font-bold text-alert">
                <span className="animate-pulse-dot size-1.5 rounded-full bg-alert" />
                {match.status === "ht" ? "MT" : `${match.minute ?? ""}'`}
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Live</span>
            </>
          ) : isFinished ? (
            <>
              <span className="text-[11px] font-bold text-muted-foreground">FT</span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Fini</span>
            </>
          ) : (
            <>
              <span className="text-xs font-bold tabular-nums">{match.timeLabel}</span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">{match.dayLabel}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function TeamRow({
  logo,
  name,
  fullName,
  score,
  showScore,
  dim,
  winner,
}: {
  logo: string;
  name: string;
  fullName: string;
  score: number | null;
  showScore: boolean;
  dim: boolean;
  winner: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <img
        src={logo}
        alt=""
        className="size-6 shrink-0 object-contain"
        loading="lazy"
      />
      <span
        title={fullName}
        className={cn("flex-1 truncate text-[15px] font-semibold", dim && "text-muted-foreground")}
      >
        {name}
      </span>
      {showScore && (
        <span className={cn("tabular-nums text-[16px] font-black", winner && "text-brand")}>
          {score ?? 0}
        </span>
      )}
    </div>
  );
}
