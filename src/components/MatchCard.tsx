import { Link } from "@tanstack/react-router";
import { team } from "@/data/teams";
import { competition } from "@/data/competitions";
import type { Match } from "@/data/matches";
import { TeamCrest } from "./TeamCrest";
import { cn } from "@/lib/utils";

export function MatchCard({ match }: { match: Match }) {
  const home = team(match.homeId);
  const away = team(match.awayId);
  const comp = competition(match.competitionId);
  const isLive = match.status === "live" || match.status === "ht";
  return (
    <Link
      to="/match/$id"
      params={{ id: match.id }}
      className="group block rounded-2xl bg-card ring-1 ring-black/5 transition-all hover:ring-black/10 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-2">
        <span className="size-1.5 rounded-full" style={{ background: comp.color }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {comp.short}
        </span>
        <span className="ml-auto text-[10px] font-medium text-muted-foreground">{match.venue.split(",")[0]}</span>
      </div>
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex flex-1 flex-col gap-2.5">
          <TeamRow team={home} score={match.homeScore} status={match.status} winning={match.homeScore > match.awayScore} />
          <TeamRow team={away} score={match.awayScore} status={match.status} winning={match.awayScore > match.homeScore} />
        </div>
        <div className="ml-2 flex w-14 flex-col items-center border-l border-border/60 pl-3">
          {isLive ? (
            <>
              <span className="flex items-center gap-1 text-[11px] font-bold text-alert">
                <span className="animate-pulse-dot size-1.5 rounded-full bg-alert" />
                {match.status === "ht" ? "MT" : `${match.minute}'`}
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Live</span>
            </>
          ) : match.status === "finished" ? (
            <>
              <span className="text-[11px] font-bold text-muted-foreground">FT</span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">Fini</span>
            </>
          ) : (
            <>
              <span className="text-xs font-bold tabular-nums">{match.kickoff}</span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">{match.date}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function TeamRow({ team, score, status, winning }: { team: ReturnType<typeof import("@/data/teams").team>; score: number; status: Match["status"]; winning: boolean }) {
  const showScore = status !== "upcoming";
  return (
    <div className="flex items-center gap-3">
      <TeamCrest team={team} size={22} />
      <span className={cn("flex-1 truncate text-[15px] font-semibold", !winning && showScore && status === "finished" && "text-muted-foreground")}>
        {team.short}
      </span>
      {showScore && (
        <span className={cn("tabular-nums text-[16px] font-black", winning && "text-brand")}>{score}</span>
      )}
    </div>
  );
}
