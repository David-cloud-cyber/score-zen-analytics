import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Shirt, User, AlertTriangle, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
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
      title: `Match en direct #${params.id}`,
      description: "Score en direct, stats détaillées, compositions et événements de la rencontre.",
      noindex: true,
    }),
  loader: ({ context, params }) => {
    const id = Number(params.id);
    if (!Number.isFinite(id)) return;
    context.queryClient.ensureQueryData(detailQuery(id)).catch(() => {});
  },
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
                <div className="flex items-center justify-center gap-1.5">
                  <img src={m.league.logo} alt="" className="size-3.5 object-contain" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{m.league.name}</span>
                </div>
                <div className="text-[11px] font-semibold text-white/80">
                  {m.dayLabel} · {m.venue?.split(",")[0] ?? "—"}
                </div>
              </div>
              <div className="size-9" />
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-6">
              <div className="flex flex-col items-center gap-2">
                <img src={m.home.logo} alt="" className="size-14 object-contain" />
                <div className="text-center text-[13px] font-bold leading-tight">{m.home.short}</div>
              </div>
              <div className="text-center">
                {isLive ? (
                  <>
                    <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-alert/20 px-2 py-0.5 text-[10px] font-black text-alert">
                      <span className="animate-pulse-dot size-1.5 rounded-full bg-alert" />
                      {m.status === "ht" ? "MI-TEMPS" : `${m.minute ?? ""}'`}
                    </div>
                    <div className="text-5xl font-black tabular-nums tracking-tighter">
                      {m.homeScore ?? 0}<span className="mx-2 text-white/40">·</span>{m.awayScore ?? 0}
                    </div>
                  </>
                ) : isFinished ? (
                  <>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/60">Terminé</div>
                    <div className="text-5xl font-black tabular-nums tracking-tighter">
                      {m.homeScore ?? 0}<span className="mx-2 text-white/40">·</span>{m.awayScore ?? 0}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/60">Coup d'envoi</div>
                    <div className="text-4xl font-black tabular-nums tracking-tighter">{m.timeLabel}</div>
                  </>
                )}
              </div>
              <div className="flex flex-col items-center gap-2">
                <img src={m.away.logo} alt="" className="size-14 object-contain" />
                <div className="text-center text-[13px] font-bold leading-tight">{m.away.short}</div>
              </div>
            </div>

            {m.venue && (
              <div className="flex items-center justify-center gap-2 border-t border-white/10 py-2 text-[10px] font-semibold text-white/60">
                <MapPin className="size-3" /> {m.venue}
              </div>
            )}
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
            <div className="rounded-2xl bg-card p-5 ring-1 ring-black/5 dark:ring-white/5">
              <div className="mb-4 flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                <span>{m.home.short}</span>
                <span className="text-muted-foreground">Statistiques</span>
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

          <TabsContent value="timeline" className="mt-0 space-y-3 p-4">
            {m.events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Aucun événement pour l'instant.
              </div>
            ) : (
              <div className="relative rounded-2xl bg-card p-5 ring-1 ring-black/5 dark:ring-white/5">
                <div className="absolute inset-y-6 left-1/2 w-px bg-border" />
                <div className="space-y-4">
                  {m.events.map((e, i) => (
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

          <TabsContent value="h2h" className="mt-0 space-y-4 p-4">
            {m.h2h.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Aucune confrontation directe récente.
              </div>
            ) : (
              <div className="rounded-2xl bg-card ring-1 ring-black/5 dark:ring-white/5">
                <div className="border-b border-border/60 px-5 py-3 text-[11px] font-black uppercase tracking-widest">
                  Confrontations directes
                </div>
                <ul className="divide-y divide-border/60">
                  {m.h2h.map((h) => (
                    <li key={h.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-3 text-xs">
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
