import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Shirt, Sparkles, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { matchById } from "@/data/matches";
import { team } from "@/data/teams";
import { competition } from "@/data/competitions";
import { analysisFor } from "@/data/analyses";
import { FORMATIONS } from "@/data/players";
import { TeamCrest } from "@/components/TeamCrest";
import { StatBar } from "@/components/StatBar";
import { FormGuide } from "@/components/FormGuide";
import { WinProbabilityDonut, WinProbabilityLegend } from "@/components/WinProbabilityDonut";
import { MarketCard } from "@/components/MarketCard";
import { PitchFormation } from "@/components/PitchFormation";
import { Disclaimer } from "@/components/Disclaimer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/match/$id")({
  head: ({ params }) => {
    const m = matchById(params.id);
    if (!m) return { meta: [{ title: "Match — LiveFoot AI" }] };
    const h = team(m.homeId).short, a = team(m.awayId).short;
    return {
      meta: [
        { title: `${h} vs ${a} — LiveFoot AI` },
        { name: "description", content: `Score, statistiques et analyse IA de ${h} contre ${a}.` },
        { property: "og:title", content: `${h} vs ${a}` },
        { property: "og:description", content: `Suivez le match ${h} vs ${a} en direct avec statistiques et analyse IA.` },
      ],
    };
  },
  component: MatchPage,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center p-8 text-center text-sm text-muted-foreground">
      Match introuvable. <Link to="/" className="ml-2 font-bold text-brand">Retour</Link>
    </div>
  ),
});

function MatchPage() {
  const { id } = useParams({ from: "/match/$id" });
  const match = matchById(id);
  if (!match) return null;
  const home = team(match.homeId);
  const away = team(match.awayId);
  const comp = competition(match.competitionId);
  const isLive = match.status === "live" || match.status === "ht";
  const analysis = analysisFor(match.id);

  return (
    <AppShell hideHeader>
    <div className="mx-auto min-h-screen w-full max-w-[440px] bg-background pb-20 lg:max-w-none lg:pb-0">
      {/* Hero */}
      <div className="relative overflow-hidden bg-foreground text-background">
        <div className="pointer-events-none absolute -top-24 right-0 size-64 rounded-full bg-brand/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 size-56 rounded-full bg-data/25 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between px-4 pt-4">
            <Link to="/" className="grid size-9 place-items-center rounded-full bg-white/10 backdrop-blur">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">{comp.name}</div>
              <div className="text-[11px] font-semibold text-white/80">{match.date} · {match.venue.split(",")[0]}</div>
            </div>
            <div className="size-9" />
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-6">
            <div className="flex flex-col items-center gap-2">
              <TeamCrest team={home} size={56} />
              <div className="text-center text-[13px] font-bold leading-tight">{home.short}</div>
              <FormGuide results={match.homeForm} size="sm" />
            </div>
            <div className="text-center">
              {isLive ? (
                <>
                  <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-alert/20 px-2 py-0.5 text-[10px] font-black text-alert">
                    <span className="animate-pulse-dot size-1.5 rounded-full bg-alert" />
                    {match.status === "ht" ? "MI-TEMPS" : `${match.minute}'`}
                  </div>
                  <div className="text-5xl font-black tabular-nums tracking-tighter">
                    {match.homeScore}<span className="mx-2 text-white/40">·</span>{match.awayScore}
                  </div>
                </>
              ) : match.status === "finished" ? (
                <>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/60">Terminé</div>
                  <div className="text-5xl font-black tabular-nums tracking-tighter">
                    {match.homeScore}<span className="mx-2 text-white/40">·</span>{match.awayScore}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/60">Coup d'envoi</div>
                  <div className="text-4xl font-black tabular-nums tracking-tighter">{match.kickoff}</div>
                </>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <TeamCrest team={away} size={56} />
              <div className="text-center text-[13px] font-bold leading-tight">{away.short}</div>
              <FormGuide results={match.awayForm} size="sm" />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-white/10 py-2 text-[10px] font-semibold text-white/60">
            <MapPin className="size-3" /> {match.venue} · Arbitre : {match.referee}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stats" className="w-full">
        <div className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
          <TabsList className="no-scrollbar h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0">
            {[
              ["stats", "Stats"],
              ["timeline", "Timeline"],
              ["lineups", "Compositions"],
              ["h2h", "H2H"],
              ["ai", "IA"],
            ].map(([v, l]) => (
              <TabsTrigger
                key={v}
                value={v}
                className="relative shrink-0 rounded-none border-0 bg-transparent px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {l}
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand opacity-0 data-[state=active]:opacity-100" />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="stats" className="mt-0 space-y-5 p-4">
          <div className="rounded-2xl bg-card p-5 ring-1 ring-black/5">
            <div className="mb-4 flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
              <span>{home.short}</span>
              <span className="text-muted-foreground">Statistiques</span>
              <span>{away.short}</span>
            </div>
            <div className="space-y-4">
              <StatBar label="Possession" home={match.stats.possession[0]} away={match.stats.possession[1]} unit="%" accent />
              <StatBar label="xG (buts attendus)" home={match.stats.xg[0]} away={match.stats.xg[1]} />
              <StatBar label="Tirs" home={match.stats.shots[0]} away={match.stats.shots[1]} />
              <StatBar label="Tirs cadrés" home={match.stats.shotsOnTarget[0]} away={match.stats.shotsOnTarget[1]} accent />
              <StatBar label="Corners" home={match.stats.corners[0]} away={match.stats.corners[1]} />
              <StatBar label="Fautes" home={match.stats.fouls[0]} away={match.stats.fouls[1]} />
              <StatBar label="Cartons jaunes" home={match.stats.yellow[0]} away={match.stats.yellow[1]} />
              <StatBar label="Passes réussies" home={match.stats.passAccuracy[0]} away={match.stats.passAccuracy[1]} unit="%" />
              <StatBar label="Hors-jeu" home={match.stats.offsides[0]} away={match.stats.offsides[1]} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0 space-y-3 p-4">
          {match.events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aucun événement pour l'instant.
            </div>
          ) : (
            <div className="relative rounded-2xl bg-card p-5 ring-1 ring-black/5">
              <div className="absolute inset-y-6 left-1/2 w-px bg-border" />
              <div className="space-y-4">
                {match.events.map((e, i) => (
                  <div key={i} className={cn("grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs", e.side === "away" && "text-right")}>
                    <div className={cn(e.side === "home" ? "text-right" : "order-3 text-left")}>
                      {e.side === "home" && <EventPill event={e} />}
                    </div>
                    <div className="grid size-8 place-items-center rounded-full bg-foreground text-[10px] font-black text-background">
                      {e.minute}'
                    </div>
                    <div className={cn(e.side === "away" ? "text-left" : "order-3")}>
                      {e.side === "away" && <EventPill event={e} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="lineups" className="mt-0 space-y-4 p-4">
          {FORMATIONS[match.homeId] && FORMATIONS[match.awayId] ? (
            <>
              <div className="flex items-center justify-between rounded-2xl bg-card p-3 ring-1 ring-black/5">
                <FormationLabel formation={FORMATIONS[match.homeId].formation} coach={FORMATIONS[match.homeId].coach} teamName={home.short} align="left" color={home.color} />
                <FormationLabel formation={FORMATIONS[match.awayId].formation} coach={FORMATIONS[match.awayId].coach} teamName={away.short} align="right" color={away.color} />
              </div>
              <PitchFormation
                home={FORMATIONS[match.homeId]}
                away={FORMATIONS[match.awayId]}
                homeColor={home.color}
                awayColor={away.color}
              />
              <div className="grid grid-cols-2 gap-3">
                <PlayerList title={home.short} players={FORMATIONS[match.homeId].players} color={home.color} />
                <PlayerList title={away.short} players={FORMATIONS[match.awayId].players} color={away.color} />
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Compositions bientôt disponibles.
            </div>
          )}
        </TabsContent>

        <TabsContent value="h2h" className="mt-0 space-y-4 p-4">
          <div className="rounded-2xl bg-card p-5 ring-1 ring-black/5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Forme récente</div>
              <div className="text-[10px] font-bold text-muted-foreground">5 derniers</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TeamCrest team={home} size={26} />
                <FormGuide results={match.homeForm} />
              </div>
              <div className="flex items-center gap-3">
                <FormGuide results={match.awayForm} />
                <TeamCrest team={away} size={26} />
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-card ring-1 ring-black/5">
            <div className="border-b border-border/60 px-5 py-3 text-[11px] font-black uppercase tracking-widest">
              Confrontations directes
            </div>
            <ul className="divide-y divide-border/60">
              {analysis.h2h.map((h, i) => (
                <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-3 text-xs">
                  <span className="truncate text-right font-semibold">{h.home}</span>
                  <span className="rounded-md bg-foreground px-2 py-0.5 font-mono text-[11px] font-black text-background tabular-nums">{h.score}</span>
                  <span className="truncate font-semibold">{h.away}</span>
                  <span className="col-span-3 text-[10px] font-medium text-muted-foreground">{h.date} · {h.competition}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-0 space-y-5 p-4">
          <AnalysisPanel matchId={match.id} homeName={home.short} awayName={away.short} />
        </TabsContent>
      </Tabs>
    </div>
    </AppShell>
  );
}

function EventPill({ event }: { event: { type: string; player: string; detail?: string } }) {
  const icon =
    event.type === "goal" ? "⚽"
      : event.type === "yellow" ? "🟨"
        : event.type === "red" ? "🟥"
          : event.type === "sub" ? "🔄"
            : "📺";
  return (
    <div className="inline-flex flex-col gap-0.5">
      <span className="font-bold">{icon} {event.player}</span>
      {event.detail && <span className="text-[10px] font-medium text-muted-foreground">{event.detail}</span>}
    </div>
  );
}

function FormationLabel({ formation, coach, teamName, align, color }: { formation: string; coach: string; teamName: string; align: "left" | "right"; color: string }) {
  return (
    <div className={cn(align === "right" && "text-right")}>
      <div className="flex items-center gap-2" style={align === "right" ? { flexDirection: "row-reverse" } : {}}>
        <div className="grid size-8 place-items-center rounded-lg font-black text-white" style={{ background: color }}>
          <Shirt className="size-4" />
        </div>
        <div className={align === "right" ? "text-right" : ""}>
          <div className="text-[10px] font-bold uppercase text-muted-foreground">{teamName}</div>
          <div className="text-sm font-black tabular-nums">{formation}</div>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground" style={align === "right" ? { justifyContent: "flex-end" } : {}}>
        <User className="size-3" /> {coach}
      </div>
    </div>
  );
}

function PlayerList({ title, players, color }: { title: string; players: { number: number; name: string; position: string }[]; color: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-black/5">
      <div className="mb-2 flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: color }} />
        <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
      </div>
      <ul className="space-y-1.5">
        {players.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="grid size-5 shrink-0 place-items-center rounded font-mono text-[10px] font-bold" style={{ background: color, color: "white" }}>{p.number}</span>
            <span className="flex-1 truncate font-semibold">{p.name}</span>
            <span className="text-[9px] font-bold uppercase text-muted-foreground">{p.position}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalysisPanel({ matchId, homeName, awayName }: { matchId: string; homeName: string; awayName: string }) {
  const a = analysisFor(matchId);
  return (
    <>
      <div className="rounded-3xl bg-foreground p-5 text-background">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
          <Sparkles className="size-3" /> Analyse IA
        </div>
        <div className="flex items-center gap-4">
          <WinProbabilityDonut home={a.probabilities.home} draw={a.probabilities.draw} away={a.probabilities.away} size={130} />
          <div className="flex-1">
            <WinProbabilityLegend home={a.probabilities.home} draw={a.probabilities.draw} away={a.probabilities.away} homeName={homeName} awayName={awayName} />
            <div className="mt-3 rounded-xl bg-white/5 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">Score probable</div>
              <div className="mt-0.5 font-mono text-lg font-black tabular-nums">{a.probableScore}</div>
              <div className="mt-1 text-[10px] text-white/60">Alternatives : {a.altScores.join(" · ")}</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 px-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Facteurs clés</h3>
        <ul className="space-y-2">
          {a.keyFactors.map((f, i) => (
            <li key={i} className="flex gap-3 rounded-2xl bg-card p-3 text-xs leading-relaxed ring-1 ring-black/5">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand/10 font-black text-brand">{i + 1}</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 px-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Marchés recommandés</h3>
        <div className="grid grid-cols-2 gap-3">
          {a.markets.map((m, i) => (
            <MarketCard key={i} market={m} />
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
        <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Blessures & suspensions</h3>
        <ul className="space-y-2">
          {a.injuries.map((inj, i) => (
            <li key={i} className="flex items-center justify-between text-xs">
              <span className="font-bold">{inj.player}</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-black/5">
                {inj.reason}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-data/10 p-4 ring-1 ring-data/20">
        <div className="flex gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-data text-data-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="flex-1">
            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-data">Assistant IA</div>
            <p className="text-[13px] leading-relaxed text-foreground">{a.aiText}</p>
          </div>
        </div>
      </div>

      <Disclaimer className="pt-2" />
    </>
  );
}
