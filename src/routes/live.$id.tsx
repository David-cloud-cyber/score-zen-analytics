import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Shirt,
  User,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Activity,
  ShieldCheck,
  Trophy,
  ChevronRight,
  Flame,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MatchSkeleton } from "@/components/PageSkeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatBar } from "@/components/StatBar";
import { getFixtureSections, getFixtureSummary } from "@/lib/football.functions";
import {
  castMatchCommunityVote,
  getMatchCommunityVotes,
  type CommunityVoteOption,
} from "@/lib/community.functions";
import { buildRouteMeta } from "@/lib/seo";
import type { ApiInjury, ApiLineup, RemoteMatchDetail } from "@/lib/football-types";
import { cn } from "@/lib/utils";
import { DEMO_MATCH_DETAIL, isLocalDemo } from "@/lib/local-demo";
import { useSession } from "@/hooks/use-session";

const detailQuery = (id: number, demoMode = false) =>
  queryOptions({
    queryKey: ["fixture", id],
    queryFn: () =>
      demoMode ? Promise.resolve(DEMO_MATCH_DETAIL) : getFixtureSummary({ data: { id } }),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });

const sectionsQuery = (id: number, demoMode = false) =>
  queryOptions({
    queryKey: ["fixture-sections", id],
    queryFn: () =>
      demoMode ? Promise.resolve(DEMO_MATCH_DETAIL) : getFixtureSections({ data: { id } }),
    staleTime: 45_000,
    refetchInterval: 60_000,
    retry: 1,
  });

export const Route = createFileRoute("/live/$id")({
  head: ({ params }) =>
    buildRouteMeta({
      path: `/live/${params.id}`,
      title: `Match en direct #${params.id} — Livefoot IA`,
      description:
        "Score en direct, stats détaillées, compositions tactiques 2D et prédictions IA de la rencontre.",
      noindex: true,
    }),
  loader: ({ context, params }) => {
    if (isLocalDemo()) return;
    const id = Number(params.id);
    if (!Number.isFinite(id)) return;
    context.queryClient.ensureQueryData(detailQuery(id)).catch(() => {});
  },
  pendingComponent: MatchSkeleton,
  pendingMs: 0,
  errorComponent: ({ error, reset }) => <MatchErrorState error={error} reset={reset} />,
  /* errorComponent: ({ error, reset }) => (
    <AppShell>
      <div className="mx-4 mt-8 rounded-2xl border border-alert/30 bg-alert/5 p-6 text-center lg:mx-0">
        <AlertTriangle className="mx-auto size-6 text-alert" aria-hidden />
        <h2 className="mt-3 text-base font-black">Match indisponible</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message || "Impossible de charger cette rencontre."}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background"
          >
            <RefreshCw className="size-3.5" /> Réessayer
          </button>
          <Link
            to="/"
            className="inline-flex items-center rounded-full bg-surface px-4 py-2 text-xs font-bold ring-1 ring-black/5 dark:ring-white/10"
          >
            Retour
          </Link>
        </div>
      </div>
    </AppShell>
  ), */
  component: LiveMatchPage,
});

function LiveMatchPage() {
  const { id } = useParams({ from: "/live/$id" });
  const fixtureId = Number(id);
  const demoMode = isLocalDemo();
  const { data: summary } = useSuspenseQuery(detailQuery(fixtureId, demoMode));
  const sections = useQuery({
    ...sectionsQuery(fixtureId, demoMode),
    enabled: true,
  });
  const data = sections.data
    ? { ...summary, ...sections.data, meta: sections.data.meta ?? summary.meta }
    : summary;
  return <LiveMatchView m={data} />;
}

function LiveMatchView({ m }: { m: RemoteMatchDetail }) {
  const isLive = m.status === "live" || m.status === "ht";
  const isFinished = m.status === "finished";

  return (
    <AppShell hideHeader>
      <div className="mx-auto min-h-screen w-full max-w-[440px] bg-background pb-20 lg:max-w-[980px] lg:pb-0">
        {/* Dynamic Hero Header */}
        <div className="relative overflow-hidden border-b border-[#252525] bg-[#111111] text-[#fdfdfd]">
          <div className="relative">
            {/* Navigation Header */}
            <div className="flex items-center justify-between border-b border-[#252525] px-4 py-3">
              <Link
                to="/"
                className="grid size-9 place-items-center rounded-full bg-[#202020] text-[#aaaaaa] transition-colors hover:text-white"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <img src={m.league.logo} alt="" className="size-3.5 object-contain" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#aaaaaa]">
                    {m.league.name}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-[#888888]">
                  {m.dayLabel} · {m.venue?.split(",")[0] ?? "—"}
                </div>
              </div>
              <div className="size-9" />
            </div>

            {/* Match Score Display */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-7">
              <div className="flex flex-col items-center gap-2 text-center">
                <img
                  src={m.home.logo}
                  alt={m.home.name}
                  className="size-16 object-contain drop-shadow-md"
                />
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
                      {m.homeScore ?? 0}
                      <span className="mx-2 text-[#777777]">·</span>
                      {m.awayScore ?? 0}
                    </div>
                  </>
                ) : isFinished ? (
                  <>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#888888]">
                      Terminé
                    </div>
                    <div className="text-5xl font-black tabular-nums tracking-tighter">
                      {m.homeScore ?? 0}
                      <span className="mx-2 text-[#777777]">·</span>
                      {m.awayScore ?? 0}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#888888]">
                      Coup d'envoi
                    </div>
                    <div className="text-4xl font-black tabular-nums tracking-tighter">
                      {m.timeLabel}
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col items-center gap-2 text-center">
                <img
                  src={m.away.logo}
                  alt={m.away.name}
                  className="size-16 object-contain drop-shadow-md"
                />
                <div className="text-sm font-black leading-tight">{m.away.short}</div>
              </div>
            </div>

            {/* Direct AI Prediction CTA Banner */}
            <div className="border-t border-[#252525] bg-[#181818] p-3">
              <a
                href={`/analyse?home=${encodeURIComponent(m.home.name)}&away=${encodeURIComponent(m.away.name)}&matchId=${m.id}`}
                className="flex w-full items-center justify-between rounded-2xl bg-brand px-4 py-2.5 text-xs font-black text-neutral-900 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 animate-bounce" />
                  <span>
                    {isLive
                      ? "Analyser le match en direct"
                      : isFinished
                        ? "Revoir l’analyse de ce match"
                        : "Obtenir l’analyse IA de ce match"}{" "}
                    · 3 crédits
                  </span>
                </div>
                <ChevronRight className="size-4" />
              </a>
            </div>
          </div>
        </div>

        {(m.meta?.stale || m.meta?.unavailableSections.length) && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2.5 text-xs text-muted-foreground lg:mx-0">
            <div className="font-bold text-foreground">
              {m.meta?.stale ? "Données réelles en cache" : "Données secondaires partielles"}
            </div>
            <div className="mt-0.5">
              {m.meta?.stale
                ? `Dernière mise à jour : ${formatFetchedAt(m.meta.fetchedAt)}.`
                : "Le score et les informations principales restent disponibles."}
              {m.meta?.unavailableSections.length
                ? ` Sections indisponibles : ${m.meta.unavailableSections.join(", ")}.`
                : ""}
            </div>
          </div>
        )}

        <MatchVoteCard match={m} />

        {/* Navigation Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <div className="sticky top-0 z-20 border-b border-[#252525] bg-background/95 backdrop-blur">
            <TabsList className="no-scrollbar h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0">
              {[
                ["overview", "Résumé"],
                ["stats", "Stats"],
                ["timeline", "Timeline"],
                ["pitch", "Terrain 2D ⚽"],
                ["lineups", "Listes"],
                ["h2h", "H2H"],
              ].map(([v, l]) => (
                <TabsTrigger
                  key={v}
                  value={v}
                  className="relative shrink-0 rounded-none border-0 bg-transparent px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-brand data-[state=active]:shadow-none"
                >
                  {l}
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand opacity-0 data-[state=active]:opacity-100" />
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0 space-y-4 p-4">
            <MatchOverview match={m} isLive={isLive} isFinished={isFinished} />
            <MatchDataSignals match={m} />
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-0 space-y-5 p-4">
            <div className="rounded-xl border border-[#252525] bg-[#181818] p-5 shadow-none">
              <div className="mb-4 flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                <span>{m.home.short}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Activity className="size-3.5 text-brand" /> Statistiques
                </span>
                <span>{m.away.short}</span>
              </div>
              <div className="space-y-4">
                <StatBar
                  label="Possession"
                  home={m.stats.possession.home}
                  away={m.stats.possession.away}
                  unit="%"
                  accent
                />
                <StatBar label="xG (buts attendus)" home={m.stats.xg.home} away={m.stats.xg.away} />
                <StatBar label="Tirs" home={m.stats.shots.home} away={m.stats.shots.away} />
                <StatBar
                  label="Tirs cadrés"
                  home={m.stats.shotsOnTarget.home}
                  away={m.stats.shotsOnTarget.away}
                  accent
                />
                <StatBar label="Corners" home={m.stats.corners.home} away={m.stats.corners.away} />
                <StatBar label="Fautes" home={m.stats.fouls.home} away={m.stats.fouls.away} />
                <StatBar
                  label="Cartons jaunes"
                  home={m.stats.yellow.home}
                  away={m.stats.yellow.away}
                />
                <StatBar
                  label="Passes réussies"
                  home={m.stats.passAccuracy.home}
                  away={m.stats.passAccuracy.away}
                  unit="%"
                />
                <StatBar
                  label="Hors-jeu"
                  home={m.stats.offsides.home}
                  away={m.stats.offsides.away}
                />
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
              <div className="relative rounded-xl border border-[#252525] bg-[#181818] p-5 shadow-none">
                <div className="absolute inset-y-6 left-1/2 w-px bg-border" />
                <div className="space-y-4">
                  {m.events.map((e, i) => (
                    <div
                      key={i}
                      className={cn(
                        "grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs",
                        e.side === "away" && "text-right",
                      )}
                    >
                      <div className={cn(e.side === "home" ? "text-right" : "order-3 text-left")}>
                        {e.side === "home" && <EventPill event={e} />}
                      </div>
                      <div className="grid size-8 place-items-center rounded-full bg-[#fdfdfd] text-[10px] font-black text-[#111111] shadow-sm">
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
              <div className="rounded-xl border border-[#252525] bg-[#181818] shadow-none">
                <div className="border-b border-border/60 px-5 py-3.5 text-[11px] font-black uppercase tracking-widest">
                  Confrontations directes récentes
                </div>
                <ul className="divide-y divide-border/60">
                  {m.h2h.map((h) => (
                    <li
                      key={h.id}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-3.5 text-xs"
                    >
                      <span className="truncate text-right font-semibold">{h.home}</span>
                      <span className="rounded-md bg-[#fdfdfd] px-2 py-0.5 font-mono text-[11px] font-black text-[#111111] tabular-nums">
                        {h.score}
                      </span>
                      <span className="truncate font-semibold">{h.away}</span>
                      <span className="col-span-3 text-[10px] font-medium text-muted-foreground">
                        {h.date} · {h.competition}
                      </span>
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

function formatFetchedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "récemment";
  return `${date.toISOString().slice(11, 16)} UTC`;
}

function MatchErrorState({ error, reset }: { error: Error; reset: () => void }) {
  const isQuotaError = /quota|limite|rate|429|requests|requêtes/i.test(error.message ?? "");
  const [cooldown, setCooldown] = useState(isQuotaError ? 15 : 0);

  useEffect(() => {
    if (!isQuotaError || cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown, isQuotaError]);

  const retryDisabled = isQuotaError && cooldown > 0;

  return (
    <AppShell>
      <div className="mx-4 mt-8 rounded-2xl border border-alert/30 bg-alert/5 p-6 text-center lg:mx-0">
        <AlertTriangle className="mx-auto size-6 text-alert" aria-hidden />
        <h2 className="mt-3 text-base font-black">Match indisponible</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message || "Impossible de charger cette rencontre."}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => {
              if (retryDisabled) return;
              reset();
            }}
            disabled={retryDisabled}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="size-3.5" />
            {retryDisabled ? `Réessayer dans ${cooldown}s` : "Réessayer"}
          </button>
          <Link
            to="/"
            className="inline-flex items-center rounded-full bg-surface px-4 py-2 text-xs font-bold ring-1 ring-black/5 dark:ring-white/10"
          >
            Retour
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function MatchOverview({
  match,
  isLive,
  isFinished,
}: {
  match: RemoteMatchDetail;
  isLive: boolean;
  isFinished: boolean;
}) {
  const availableStats = Object.values(match.stats).filter(
    (pair) => pair.home !== null && pair.away !== null,
  ).length;
  const lineupLabel =
    match.lineups.home && match.lineups.away
      ? "Compositions disponibles"
      : match.lineups.home || match.lineups.away
        ? "Composition partielle"
        : "Compositions indisponibles";
  const statusLabel = isLive ? "Match en direct" : isFinished ? "Match terminé" : "Match à venir";
  const latestEvent = match.events.at(-1);

  return (
    <div className="space-y-4">
      <section className="score-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="score-section-label">Lecture rapide</p>
            <h2 className="mt-1 text-lg font-black">{statusLabel}</h2>
          </div>
          <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-bold text-brand">
            API actualisée automatiquement
          </span>
        </div>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-surface p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Compétition
            </dt>
            <dd className="mt-1 text-xs font-bold">{match.league.name}</dd>
          </div>
          <div className="rounded-lg bg-surface p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Stade
            </dt>
            <dd className="mt-1 truncate text-xs font-bold">{match.venue ?? "Non communiqué"}</dd>
          </div>
        </dl>
      </section>

      <section className="score-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black">Données disponibles</h2>
          <ShieldCheck className="size-4 text-brand" aria-hidden />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <AvailabilityItem
            label="Événements"
            value={match.events.length ? `${match.events.length}` : "—"}
          />
          <AvailabilityItem label="Statistiques" value={`${availableStats}/10`} />
          <AvailabilityItem label="Compositions" value={lineupLabel} />
          <AvailabilityItem
            label="Confrontations"
            value={match.h2h.length ? `${match.h2h.length}` : "—"}
          />
        </div>
      </section>

      {latestEvent && (
        <section className="score-card p-4">
          <p className="score-section-label">Dernier événement</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-black text-brand">
              {latestEvent.minute}'
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-black">{latestEvent.player}</div>
              <div className="text-xs text-muted-foreground">
                {latestEvent.detail ?? latestEvent.type}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function AvailabilityItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface/60 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-black">{value}</div>
    </div>
  );
}

function MatchDataSignals({ match }: { match: RemoteMatchDetail }) {
  const hasInjuries = match.injuries.home.length > 0 || match.injuries.away.length > 0;
  if (!match.prediction && !match.odds && !hasInjuries) return null;

  return (
    <section className="score-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="score-section-label">Données enrichies</p>
          <h2 className="mt-1 text-base font-black">Signaux disponibles pour ce match</h2>
        </div>
        <ShieldCheck
          className="size-4 shrink-0 text-brand"
          aria-label="Données vérifiées par l'API"
        />
      </div>

      {match.prediction && (
        <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand">
              Projection disponible
            </span>
            {match.prediction.winnerName && (
              <span className="truncate text-xs font-black">{match.prediction.winnerName}</span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["1", match.prediction.home],
              ["N", match.prediction.draw],
              ["2", match.prediction.away],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-surface px-2 py-2">
                <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
                <div className="mt-1 text-sm font-black">{value !== null ? `${value}%` : "—"}</div>
              </div>
            ))}
          </div>
          {(match.prediction.advice || match.prediction.underOver) && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {[match.prediction.advice, match.prediction.underOver].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}

      {match.odds && (
        <div className="mt-3 rounded-xl border border-border/70 bg-surface/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Cotes moyennes
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {match.odds.bookmakers > 0
                ? `${match.odds.bookmakers} opérateurs`
                : "Source indisponible"}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["1", match.odds.home],
              ["N", match.odds.draw],
              ["2", match.odds.away],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
                <div className="mt-1 text-sm font-black tabular-nums">
                  {typeof value === "number" ? value.toFixed(2) : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasInjuries && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(
            [
              [match.home.short, match.injuries.home],
              [match.away.short, match.injuries.away],
            ] as Array<[string, ApiInjury[]]>
          ).map(([team, injuries]) => (
            <div key={team} className="rounded-xl border border-border/70 bg-surface/50 p-3">
              <div className="flex items-center gap-2 text-xs font-black">
                <AlertTriangle className="size-3.5 text-alert" aria-hidden />
                <span className="truncate">Absences · {team}</span>
              </div>
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {injuries.slice(0, 4).map((injury) => (
                  <li key={injury.playerId} className="truncate">
                    {injury.name} · {injury.reason || "motif non communiqué"}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MatchVoteCard({ match }: { match: RemoteMatchDetail }) {
  const navigate = useNavigate();
  const { user } = useSession();
  const demoMode = isLocalDemo();
  const getVotes = useServerFn(getMatchCommunityVotes);
  const castVote = useServerFn(castMatchCommunityVote);
  const [selected, setSelected] = useState<CommunityVoteOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoCounts, setDemoCounts] = useState({ home: 58, draw: 23, away: 19 });
  const votesQuery = useQuery({
    queryKey: ["community-votes", match.id],
    queryFn: () => getVotes({ data: { fixtureId: match.id } }),
    enabled: !demoMode,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const counts = demoMode
    ? demoCounts
    : (votesQuery.data?.counts ?? { home: 0, draw: 0, away: 0 });
  const total = demoMode
    ? demoCounts.home + demoCounts.draw + demoCounts.away
    : (votesQuery.data?.total ?? 0);
  const options = [
    { id: "home" as const, label: "1", name: match.home.short, value: counts.home },
    { id: "draw" as const, label: "N", name: "Match nul", value: counts.draw },
    { id: "away" as const, label: "2", name: match.away.short, value: counts.away },
  ];

  async function vote(id: CommunityVoteOption) {
    if (demoMode) {
      if (selected === id) return;
      setSelected(id);
      setDemoCounts((current) => ({
        ...current,
        [id]: current[id] + 1,
        ...(selected ? { [selected]: Math.max(0, current[selected] - 1) } : {}),
      }));
      toast.success("Votre vote a été enregistré dans l’aperçu local.");
      return;
    }
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/live/${match.id}` } });
      return;
    }

    setSubmitting(true);
    try {
      await castVote({
        data: {
          fixtureId: match.id,
          homeTeam: match.home.name,
          awayTeam: match.away.name,
          prediction: id,
        },
      });
      setSelected(id);
      await votesQuery.refetch();
      toast.success("Votre vote a été enregistré.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer votre vote.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="match-votes-title" className="space-y-3 px-4">
      <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand">
              <Flame className="mr-1 inline size-3" /> Communauté
            </p>
            <h2 id="match-votes-title" className="mt-1 text-base font-black">
              Qui va s’imposer ?
            </h2>
          </div>
          <span className="rounded-full bg-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
            {demoMode ? "Données réelles uniquement" : `${total} vote${total > 1 ? "s" : ""}`}
          </span>
          </div>
          {votesQuery.isLoading && !demoMode ? (
            <div
              className="mt-3 h-20 animate-pulse rounded-xl bg-surface"
              aria-label="Chargement des votes"
            />
          ) : votesQuery.isError && !demoMode ? (
            <p className="mt-3 text-xs text-muted-foreground">Votes momentanément indisponibles.</p>
          ) : (
            <>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {options.map((option) => {
                const percentage = total ? Math.round((option.value / total) * 100) : null;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected === option.id}
                    aria-label={`Voter ${option.label}, ${option.name}`}
                    disabled={submitting}
                    onClick={() => vote(option.id)}
                    className={cn(
                      "rounded-xl px-2 py-2.5 text-left ring-1 ring-border/70 transition-all hover:-translate-y-0.5 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-60",
                      selected === option.id
                        ? "bg-brand text-brand-foreground ring-brand"
                        : "bg-card",
                    )}
                  >
                    <span className="block text-sm font-black">{option.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-semibold opacity-75">
                      {option.name}
                    </span>
                    <span className="mt-2 block text-lg font-black tabular-nums">
                      {percentage === null ? "—" : `${percentage}%`}
                    </span>
                  </button>
                );
              })}
            </div>
            {total > 0 && (
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                <div className="bg-brand" style={{ width: `${(counts.home / total) * 100}%` }} />
                <div
                  className="bg-muted-foreground/50"
                  style={{ width: `${(counts.draw / total) * 100}%` }}
                />
                <div className="bg-data" style={{ width: `${(counts.away / total) * 100}%` }} />
              </div>
            )}
              <p className="mt-2 text-[10px] text-muted-foreground">
                {selected
                  ? "Votre vote est enregistré. Vous pouvez modifier votre choix."
                  : demoMode
                    ? "Choisissez 1, N ou 2 pour comparer votre avis à la communauté."
                    : user
                      ? "Choisissez 1, N ou 2 pour voter."
                      : "Connectez-vous pour voter et comparer votre avis à la communauté."}
              </p>
          </>
        )}
      </div>
    </section>
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
  const homeFormation = lineups.home?.formation;
  const awayFormation = lineups.away?.formation;

  if (!lineups.home || !lineups.away) {
    return (
      <div className="score-empty-state">
        <Shirt className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <div className="mt-2 text-sm font-bold">Terrain indisponible</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Les compositions officielles des deux équipes sont nécessaires pour afficher le terrain.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-card p-4 ring-1 ring-black/5 dark:ring-white/5">
      <div className="mb-3 flex items-center justify-between text-xs font-bold">
        <div className="flex items-center gap-2">
          <img src={home.logo} alt="" className="size-5 object-contain" />
          <span>
            {home.short} ({homeFormation})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            {away.short} ({awayFormation})
          </span>
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
                  <span className="mt-0.5 truncate text-[9px] font-bold text-white drop-shadow-sm max-w-[60px]">
                    {p.name.split(" ").pop()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-bold text-white/60">
              Formation Domicile
            </div>
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
                  <span className="mt-0.5 truncate text-[9px] font-bold text-white drop-shadow-sm max-w-[60px]">
                    {p.name.split(" ").pop()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-bold text-white/60">
              Formation Extérieur
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventPill({ event }: { event: { type: string; player: string; detail?: string } }) {
  const icon =
    event.type === "goal"
      ? "⚽"
      : event.type === "yellow"
        ? "🟨"
        : event.type === "red"
          ? "🟥"
          : event.type === "sub"
            ? "🔄"
            : "📺";
  return (
    <div className="inline-flex flex-col gap-0.5">
      <span className="font-bold">
        {icon} {event.player}
      </span>
      {event.detail && (
        <span className="text-[10px] font-medium text-muted-foreground">{event.detail}</span>
      )}
    </div>
  );
}

function LineupCard({ title, lineup }: { title: string; lineup: ApiLineup }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5 dark:ring-white/5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="grid size-7 place-items-center rounded-lg font-black text-white"
            style={{ background: lineup.color }}
          >
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
            <span
              className="grid size-5 shrink-0 place-items-center rounded font-mono text-[10px] font-bold text-white"
              style={{ background: lineup.color }}
            >
              {p.number}
            </span>
            <span className="flex-1 truncate font-semibold">{p.name}</span>
            <span className="text-[9px] font-bold uppercase text-muted-foreground">
              {p.position}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
