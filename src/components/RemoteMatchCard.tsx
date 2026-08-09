import { Link } from "@tanstack/react-router";
import { ChevronRight, Star } from "lucide-react";
import type { RemoteMatchSummary } from "@/lib/football-types";
import { cn } from "@/lib/utils";

export function RemoteMatchCard({ match }: { match: RemoteMatchSummary }) {
  const isLive = match.status === "live" || match.status === "ht";
  const isFinished = match.status === "finished";

  return (
    <Link
      to="/live/$id"
      params={{ id: String(match.id) }}
      aria-label={`${match.home.name} contre ${match.away.name}, ${match.league.name}`}
      className={cn(
        "group relative block overflow-hidden rounded-xl border border-[#252525] bg-[#181818] text-[#fdfdfd] transition-colors hover:border-[#3a3a3a] hover:bg-[#1d1d1d] active:scale-[0.99]",
        isLive && "border-l-2 border-l-alert",
      )}
    >
      <div className="flex items-center gap-2 border-b border-[#2a2a2a] px-3 py-2.5">
        <img
          src={match.league.logo}
          alt=""
          className="size-4 shrink-0 object-contain"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-bold">{match.league.name}</div>
          <div className="truncate text-[9px] uppercase tracking-wider text-[#888888]">
            {match.league.country}
          </div>
        </div>
        <Star
          className="size-4 text-[#777777] transition-colors group-hover:text-brand"
          aria-hidden
        />
        <ChevronRight
          className="size-4 text-[#666666] transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>

      <div className="grid grid-cols-[54px_1fr] items-center gap-3 px-3 py-3.5">
        <StatusColumn match={match} isLive={isLive} isFinished={isFinished} />
        <div className="min-w-0 space-y-2.5 border-l border-[#303030] pl-3">
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
      </div>
    </Link>
  );
}

function StatusColumn({
  match,
  isLive,
  isFinished,
}: {
  match: RemoteMatchSummary;
  isLive: boolean;
  isFinished: boolean;
}) {
  if (isLive) {
    return (
      <div className="flex flex-col items-center justify-center text-center">
        <span className="flex items-center gap-1 text-[11px] font-black text-alert">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-alert" />
          {match.status === "ht" ? "MT" : `${match.minute ?? ""}'`}
        </span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#888888]">
          Live
        </span>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-black text-[#aaaaaa]">FT</span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#777777]">
          Fini
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <span className="text-[12px] font-black tabular-nums">{match.timeLabel}</span>
      <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#777777]">
        {match.dayLabel}
      </span>
    </div>
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
    <div className="flex min-w-0 items-center gap-2.5">
      <img src={logo} alt="" className="size-6 shrink-0 object-contain" loading="lazy" />
      <span
        title={fullName}
        className={cn("min-w-0 flex-1 truncate text-[14px] font-semibold", dim && "text-[#777777]")}
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
