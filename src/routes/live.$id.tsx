import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Shirt, User, AlertTriangle, RefreshCw, Sparkles, Activity, ShieldCheck, Trophy, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MatchSkeleton } from "@/components/PageSkeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatBar } from "@/components/StatBar";
import { getFixtureDetail } from "@/lib/football.functions";
import { buildRouteMeta } from "@/lib/seo";
import type { RemoteMatchDetail, ApiLineup } from "@/lib/football-types";
import { cn } from "@/lib/utils";

const detailQuery = (id: number) =>
  queryOptions({
    queryKey: ["fixture", id],
    queryFn: () => getFixtureDetail({ data: { id } }),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });

export const Route = createFileRoute("/live/$id")({
  head: ({ params }) =>
    buildRouteMeta({
      path: `/live/${params.id}`,
      title: `Match en direct #${params.id} — Livefoot IA`,
      description: "Score en direct, stats détaillées, compositions tactiques 2D et prédictions IA de la rencontre.",
      noindex: true,
    }),
  loader: ({ context, params }) => {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return;
    context.queryClient.ensureQueryData(detailQuery(id)).catch(() => {});
  },
  pendingComponent: MatchSkeleton,
  pendingMs: 0,
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div className="mx-4 mt-8 rounded-2xl border border-alert/30 bg-alert/5 p-6 text-center lg:mx-0">
        <AlertTriangle className="mx-auto size-6 text-alert" aria-hidden />
        <h2 className="mt-3 text-base font-black">Match indisponible</h2>
        <p className="mt-1 text-sm text-muted-foreground">{error.message || "Impossible de charger cette rencontre."}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background"
          >
            <RefreshCw className="size-3.5" /> Réessayer
          </button>
          <Link to="/" className="inline-flex items-center rounded-full bg-surface px-4 py-2 text-xs font-bold ring-1 ring-black/5 dark:ring-white/10">
            Retour
          </Link>
        </div>
      </div>
    </AppShell>
  ),
  component: LiveMatchPage,
});

function LiveMatchPage() {
  const { id } = useParams({ from: "/live/$id" });
  const fixtureId = Number(id);
  const { data } = useSuspenseQuery(detailQuery(fixtureId));
  return <LiveMatchView m={data} />;
}

function LiveMatchView({ m }: { m: RemoteMatchDetail }) {
  const isLive = m.status === "live" || m.status === "ht";
  const isFinished = m.status === "finished";

  return (
    <AppShell hideHeader>
      <div className="mx-auto min-h-screen w-full max-w-[440px] bg-background pb-20 lg:max-w-none lg:pb-0">
        {/* Dynamic Hero Header */}
        <div className="relative overflow-hidden bg-foreground text-background shadow-xl">
          <div className="pointer-events-none absolute -top-24 right-0 size-64 rounded-full bg-brand/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-0 size-56 rounded-full bg-data/25 blur-3xl" />
          <div className="relative">
            {/* Navigation Header */}
            <div className="flex items-center justify-between px-4 pt-4">
              <Link to="/" className="grid size-9 place-items-center rounded-full bg-background/10 backdrop-blur transition-transform hover:scale-105 active:scale-95">
                <ArrowLeft className="size-4" />
              </Link>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <img src={m.league.logo} alt="" className="size-3.5 object-contain" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-background/70">{m.league.name}</span>
                </div>
                <div className="text-[11px] font-semibold text-background/80">
                  {m.dayLabel} · {m.venue?.split(",")[0] ?? "—"}
                </div>
              </div>
              <div className="size-9" />
            </div>

            {/* Match Score Display */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <img src={m.home.logo} alt={m.home.name} className="size-16 object-contain drop-shadow-md" />
                <div className="text-sm font-black leading-tight">{m.home.short}</div>
              </div>

              <div className="text-center">
                {isLive ? (
                  <>
                    <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-alert/20 px-3 py-1 text-[10px] font-black text-alert shadow-sm animate-pulse">
                      <span className="size-2 rounded-full bg-alert animate-ping" />
                      {m.status === "ht" ? "MI-TEMPS" : `LIVE ${m.minute ?? ""}'`}
                    </div>
                    <div className="text-5xl font-black tabular-nums tracking-tighter">
                      {m.homeScore ?? 0}<span className="mx-2 text-background/40">·</span>{m.awayScore ?? 0}
                    </div>
                  </>
                ) : isFinished ? (
                  <>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-background/60">Terminé</div>
                    <div className="text-5xl font-black tabular-nums tracking-tighter">
                      {m.homeScore ?? 0}<span className="mx-2 text-background/40">·</span>{m.awayScore ?? 0}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-background/60">Coup d'envoi</div>
                    <div className="text-4xl font-black tabular-nums tracking-tighter">{m.timeLabel}</div>
                  </>
                )}
              </div>

              <div className="flex flex-col items-center gap-2 text-center">
                <img src={m.away.logo} alt={m.away.name} className="size-16 object-contain drop-shadow-md" />
                <div className="text-sm font-black leading-tight">{m.away.short}</div>
              </div>
            </div>

            {/* Direct AI Prediction CTA Banner */}
            <div className="border-t border-background/10 bg-background/5 p-3 backdrop-blur-sm">
              <Link
                to="/analyse"
                className="flex items-center justify-between rounded-2xl bg-brand px-4 py-2.5 text-xs font-black text-neutral-900 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 animate-bounce" />
                  <span>Obtenir la prédiction IA pour ce match (2 crédits)</span>
                </div>
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs defaultValue="stats" className="w-full">
          <div className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
            <TabsList className="no-scrollbar h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0">
              {[
                ["stats", "Stats"],
                ["timeline", "Timeline"],
                ["pitch", "Terrain 2D ⚽"],
                ["lineups", "Listes"],
                ["h2h", "H2H"],
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

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-0 space-y-5 p-4">
            <div className="rounded-3xl bg-card p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
              <div className="mb-4 flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                <span>{m.home.short}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Activity className="size-3.5 text-brand" /> Statistiques
                </span>
                <span>{m.away.short}</span>
              </div>
              <div className="space-y-4">
                <StatBar label="Possession" home={m.stats.possession.home} away={m.stats.possession.away} unit="%" accent />
                <StatBar label="xG (buts attendus)" home={m.stats.xg.home} away={m.stats.xg.away} />
                <StatBar label="Tirs" home={m.stats.shots.home} away={m.stats.shots.away} />
                <StatBar label="Tirs cadrés" home={m.stats.shotsOnTarget.home} away={m.stats.shotsOnTarget.away} accent />
                <StatBar label="Corners" home={m.stats.corners.home} away={m.stats.corners.away} />
                <StatBar label="Fautes" home={m.stats.fouls.home} away={m.stats.fouls.away} />
                <StatBar label="Cartons jaunes" home={m.stats.yellow.home} away={m.stats.yellow.away} />
                <StatBar label="Passes réussies" home={m.stats.passAccuracy.home} away={m.stats.passAccuracy.away} unit="%" />
                <StatBar label="Hors-jeu" home={m.stats.offsides.home} away={m.stats.offsides.away} />
              </div>
            </div>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-0 space-y-3 p-4">
            {m.events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Aucun événement enregistré pour l'instant.
              </div>
            ) : (
              <div className="relative rounded-3xl bg-card p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                <div className="absolute inset-y-6 left-1/2 w-px bg-border" />
                <div className="space-y-4">
                  {m.events.map((e, i) => (
                    <div key={i} className={cn("grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs", e.side === "away" && "text-right")}>
                      <div className={cn(e.side === "home" ? "text-right" : "order-3 text-left")}>
                        {e.side === "home" && <EventPill event={e} />}
                      </div>
                      <div className="grid size-8 place-items-center rounded-full bg-foreground text-[10px] font-black text-background shadow-sm">
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

          {/* 2D Pitch Tab */}
          <TabsContent value="pitch" className="mt-0 space-y-4 p-4">
            <TacticalPitch2D home={m.home} away={m.away} lineups={m.lineups} />
          </TabsContent>

          {/* Lineups List Tab */}
          <TabsContent value="lineups" className="mt-0 space-y-4 p-4">
            {m.lineups.home || m.lineups.away ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {m.lineups.home && <LineupCard title={m.home.short} lineup={m.lineups.home} />}
                {m.lineups.away && <LineupCard title={m.away.short} lineup={m.lineups.away} />}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Compositions non disponibles.
              </div>
            )}
          </TabsContent>

          {/* H2H Tab */}
          <TabsContent value="h2h" className="mt-0 space-y-4 p-4">
            {m.h2h.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Aucune confrontation directe récente.
              </div>
            ) : (
              <div className="rounded-3xl bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                <div className="border-b border-border/60 px-5 py-3.5 text-[11px] font-black uppercase tracking-widest">
                  Confrontations directes récentes
                </div>
                <ul className="divide-y divide-border/60">
                  {m.h2h.map((h) => (
                    <li key={h.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-3.5 text-xs">
                      <span className="truncate text-right font-semibold">{h.home}</span>
                      <span className="rounded-md bg-foreground px-2 py-0.5 font-mono text-[11px] font-black text-background tabular-nums">{h.score}</span>
                      <span className="truncate font-semibold">{h.away}</span>
                      <span className="col-span-3 text-[10px] font-medium text-muted-foreground">{h.date} · {h.competition}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function TacticalPitch2D({
  home,
  away,
  lineups,
}: {
  home: { short: string; logo: string };
  away: { short: string; logo: string };
  lineups: { home?: ApiLineup | null; away?: ApiLineup | null };
}) {
  const homeFormation = lineups.home?.formation ?? "4-3-3";
  const awayFormation = lineups.away?.formation ?? "4-3-3";

  return (
    <div className="rounded-3xl bg-card p-4 ring-1 ring-black/5 dark:ring-white/5">
      <div className="mb-3 flex items-center justify-between text-xs font-bold">
        <div className="flex items-center gap-2">
          <img src={home.logo} alt="" className="size-5 object-contain" />
          <span>{home.short} ({homeFormation})</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{away.short} ({awayFormation})</span>
          <img src={away.logo} alt="" className="size-5 object-contain" />
        </div>
      </div>

      {/* 2D Pitch Graphic */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-800 via-emerald-700 to-emerald-900 p-4 shadow-inner ring-1 ring-white/10">
        {/* Field lines */}
        <div className="absolute inset-2 rounded-xl border-2 border-white/20" />
        <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-white/20" />
        <div className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/20" />
        <div className="absolute left-1/2 top-2 h-12 w-28 -translate-x-1/2 rounded-b-lg border-2 border-t-0 border-white/20" />
        <div className="absolute bottom-2 left-1/2 h-12 w-28 -translate-x-1/2 rounded-t-lg border-2 border-b-0 border-white/20" />

        {/* Home Players Pitch Layout */}
        <div className="absolute inset-x-4 top-4 bottom-1/2 flex flex-col justify-around py-2">
          {lineups.home?.players ? (
            <div className="grid grid-cols-4 gap-2 text-center">
              {lineups.home.players.slice(0, 11).map((p, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <div className="grid size-6 place-items-center rounded-full bg-emerald-950 font-mono text-[9px] font-black text-white shadow-md ring-1 ring-white/40">
                    {p.number}
                  </div>
                  <span className="mt-0.5 truncate text-[9px] font-bold text-white drop-shadow-sm max-w-[60px]">{p.name.split(" ").pop()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-bold text-white/60">Formation Domicile</div>
          )}
        </div>

        {/* Away Players Pitch Layout */}
        <div className="absolute inset-x-4 top-1/2 bottom-4 flex flex-col justify-around py-2">
          {lineups.away?.players ? (
            <div className="grid grid-cols-4 gap-2 text-center">
              {lineups.away.players.slice(0, 11).map((p, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <div className="grid size-6 place-items-center rounded-full bg-blue-950 font-mono text-[9px] font-black text-white shadow-md ring-1 ring-white/40">
                    {p.number}
                  </div>
                  <span className="mt-0.5 truncate text-[9px] font-bold text-white drop-shadow-sm max-w-[60px]">{p.name.split(" ").pop()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-bold text-white/60">Formation Extérieur</div>
          )}
        </div>
      </div>
    </div>
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

function LineupCard({ title, lineup }: { title: string; lineup: ApiLineup }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5 dark:ring-white/5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg font-black text-white" style={{ background: lineup.color }}>
            <Shirt className="size-3.5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-muted-foreground">{title}</div>
            <div className="text-sm font-black tabular-nums">{lineup.formation}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          <User className="size-3" /> {lineup.coach}
        </div>
      </div>
      <ul className="space-y-1.5">
        {lineup.players.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="grid size-5 shrink-0 place-items-center rounded font-mono text-[10px] font-bold text-white" style={{ background: lineup.color }}>
              {p.number}
            </span>
            <span className="flex-1 truncate font-semibold">{p.name}</span>
            <span className="text-[9px] font-bold uppercase text-muted-foreground">{p.position}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
