import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
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
  CalendarDays,
  Table2,
  BrainCircuit,
  ClipboardList,
  BadgeDollarSign,
  Info,
  Clock3,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MatchSkeleton } from "@/components/PageSkeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatBar } from "@/components/StatBar";
import {
  getFixtureExtendedContext,
  getFixtureMatchCenter,
  getFixtureSections,
  getFixtureSummary,
  type FixtureExtendedContext,
  type FixtureContextTeam,
  type FixtureMatchCenter,
  type StandingRow,
} from "@/lib/football.functions";
import {
  castMatchCommunityVote,
  getMyCommunityVotes,
  getMatchCommunityVotes,
  type CommunityVoteOption,
} from "@/lib/community.functions";
import { breadcrumbSchema, buildRouteMeta, ORG, SPEAKABLE } from "@/lib/seo";
import type { ApiInjury, ApiLineup, RemoteMatchDetail } from "@/lib/football-types";
import { cn } from "@/lib/utils";
import { DEMO_MATCH_DETAIL, isLocalDemo } from "@/lib/local-demo";
import { useSession } from "@/hooks/use-session";
import { useLiveMatchStream } from "@/hooks/use-live-fixture-stream";

const detailQuery = (id: number, demoMode = false) =>
  queryOptions({
    queryKey: ["fixture", id],
    queryFn: () =>
      demoMode ? Promise.resolve(DEMO_MATCH_DETAIL) : getFixtureSummary({ data: { id } }),
    staleTime: 10_000,
    refetchInterval: false,
    retry: 1,
    retryDelay: 1_000,
  });

const sectionsQuery = (id: number, demoMode = false) =>
  queryOptions({
    queryKey: ["fixture-sections", id],
    queryFn: () =>
      demoMode ? Promise.resolve(DEMO_MATCH_DETAIL) : getFixtureSections({ data: { id } }),
    staleTime: 60_000,
    refetchInterval: false,
    retry: 0,
  });

export const Route = createFileRoute("/live/$id")({
  head: ({ params, loaderData }) => {
    const match = loaderData as RemoteMatchDetail | undefined;
    const path = `/live/${params.id}`;
    if (!match?.home?.name || !match?.away?.name || !match?.league?.name) {
      return buildRouteMeta({
        path,
        title: `Match football ${params.id}`,
        description:
          "La fiche de cette rencontre sera disponible dès que les informations réelles seront confirmées.",
        noindex: true,
      });
    }
    const status =
      match.status === "finished"
        ? "Match terminé"
        : match.status === "upcoming"
          ? "Match à venir"
          : "Match en direct";
    const eventStatus =
      match.status === "finished"
        ? "https://schema.org/EventCompleted"
        : match.status === "upcoming"
          ? "https://schema.org/EventScheduled"
          : "https://schema.org/EventInProgress";
    const score =
      match.homeScore !== null && match.awayScore !== null
        ? ` Score : ${match.homeScore}-${match.awayScore}.`
        : "";
    const pageDescription = `${match.home.name} contre ${match.away.name} : ${status.toLowerCase()} en ${match.league.name}.${score} Score, événements, statistiques et compositions disponibles selon les informations vérifiées.`;
    const base = buildRouteMeta({
      path,
      title: `${match.home.name} vs ${match.away.name} : score en direct et statistiques`,
      description: pageDescription,
      type: "article",
    });
    return {
      ...base,
      meta: [
        ...base.meta,
        { name: "author", content: "LiveFoot IA" },
        {
          name: "keywords",
          content: `${match.home.name}, ${match.away.name}, ${match.league.name}, score football, statistiques match`,
        },
        { property: "article:section", content: "Football" },
        { property: "article:published_time", content: match.kickoff },
        ...(match.meta?.fetchedAt
          ? [{ property: "article:modified_time", content: match.meta.fetchedAt }]
          : []),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            "@id": `https://www.livefoot.fun${path}#event`,
            name: `${match.home.name} vs ${match.away.name}`,
            description: pageDescription,
            startDate: match.kickoff,
            eventStatus,
            sport: "Football",
            homeTeam: {
              "@type": "SportsTeam",
              name: match.home.name,
              identifier: String(match.home.id),
              logo: match.home.logo,
            },
            awayTeam: {
              "@type": "SportsTeam",
              name: match.away.name,
              identifier: String(match.away.id),
              logo: match.away.logo,
            },
            competitor: [
              { "@type": "SportsTeam", name: match.home.name, identifier: String(match.home.id) },
              { "@type": "SportsTeam", name: match.away.name, identifier: String(match.away.id) },
            ],
            location: match.venue ? { "@type": "Place", name: match.venue } : undefined,
            organizer: ORG,
            url: `https://www.livefoot.fun${path}`,
            mainEntityOfPage: `https://www.livefoot.fun${path}`,
            isAccessibleForFree: true,
            inLanguage: "fr",
            speakable: SPEAKABLE,
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            breadcrumbSchema([
              { name: "Accueil", path: "/" },
              { name: "Matchs", path: "/" },
              { name: `${match.home.name} - ${match.away.name}`, path },
            ]),
          ),
        },
      ],
    };
  },
  loader: async ({ context, params }) => {
    if (isLocalDemo()) return undefined;
    const id = Number(params.id);
    if (!Number.isFinite(id)) return undefined;
    try {
      return await context.queryClient.ensureQueryData(detailQuery(id));
    } catch {
      return undefined;
    }
  },
  pendingComponent: MatchSkeleton,
  pendingMs: 0,
  errorComponent: ({ reset }) => <FixtureWaitingState onRetry={reset} />,
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const initialSummary = Route.useLoaderData();
  const summaryQuery = useQuery({
    ...detailQuery(fixtureId, demoMode),
    initialData: initialSummary,
    refetchInterval: (query) => (query.state.data ? false : 15_000),
  });
  const summary = summaryQuery.data;
  useLiveMatchStream({
    enabled: !demoMode && Boolean(summary) && summary?.status !== "finished",
    fixtureId,
    onUpdate: (nextSummary, fetchedAt) => {
      if (!nextSummary) {
        void queryClient.invalidateQueries({ queryKey: ["fixture", fixtureId] });
        return;
      }
      queryClient.setQueryData<RemoteMatchDetail>(["fixture", fixtureId], (current) =>
        current
          ? {
              ...current,
              ...nextSummary,
              meta: {
                ...current.meta,
                fetchedAt: fetchedAt ?? current.meta.fetchedAt,
                stale: false,
                state: "fresh",
                source: "live",
              },
            }
          : current,
      );
    },
  });
  const sections = useQuery({
    ...sectionsQuery(fixtureId, demoMode),
    enabled: Boolean(summary),
    // Score ticks arrive independently; detailed sections refresh at a sane
    // cadence so one open match cannot trigger seven calls every ten seconds.
    refetchInterval:
      !demoMode && (summary?.status === "live" || summary?.status === "ht") ? 30_000 : false,
  });
  const extendedContext = useQuery({
    queryKey: ["fixture-extended-context", fixtureId],
    queryFn: () => getFixtureExtendedContext({ data: { id: fixtureId } }),
    enabled: Boolean(summary) && !demoMode && ["analysis", "prematch"].includes(activeTab),
    staleTime: 10 * 60_000,
    retry: 0,
  });
  const matchCenter = useQuery({
    queryKey: ["fixture-match-center", fixtureId],
    queryFn: () => getFixtureMatchCenter({ data: { id: fixtureId } }),
    enabled:
      Boolean(summary) && !demoMode && ["round", "standings", "odds", "info"].includes(activeTab),
    staleTime: summary?.status === "finished" ? 60 * 60_000 : 60_000,
    retry: 0,
  });

  if (!summary) {
    return (
      <FixtureWaitingState
        onRetry={() => summaryQuery.refetch()}
        refreshing={summaryQuery.isFetching}
      />
    );
  }

  // Secondary responses also contain an identity snapshot. Keep their rich
  // sections, but always overlay the newest lightweight summary so an older
  // statistics response can never roll the visible score or minute backward.
  const data: RemoteMatchDetail = sections.data
    ? {
        ...sections.data,
        id: summary.id,
        isTrending: summary.isTrending,
        status: summary.status,
        statusShort: summary.statusShort,
        minute: summary.minute,
        kickoff: summary.kickoff,
        timeLabel: summary.timeLabel,
        dayLabel: summary.dayLabel,
        home: summary.home,
        away: summary.away,
        homeScore: summary.homeScore,
        awayScore: summary.awayScore,
        league: summary.league,
        venue: summary.venue,
        meta: {
          ...sections.data.meta,
          fetchedAt: summary.meta.fetchedAt,
          stale: summary.meta.stale,
          state: summary.meta.state,
          source: summary.meta.source,
          retryAfterMs: summary.meta.retryAfterMs,
        },
      }
    : summary;
  return (
    <LiveMatchView
      m={data}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      extendedContext={extendedContext.data}
      extendedContextLoading={
        extendedContext.isPending && extendedContext.fetchStatus === "fetching"
      }
      matchCenter={matchCenter.data}
      matchCenterLoading={matchCenter.isPending && matchCenter.fetchStatus === "fetching"}
    />
  );
}

function LiveMatchView({
  m,
  activeTab,
  onTabChange,
  extendedContext,
  extendedContextLoading,
  matchCenter,
  matchCenterLoading,
}: {
  m: RemoteMatchDetail;
  activeTab: string;
  onTabChange: (value: string) => void;
  extendedContext?: FixtureExtendedContext;
  extendedContextLoading: boolean;
  matchCenter?: FixtureMatchCenter;
  matchCenterLoading: boolean;
}) {
  const isLive = m.status === "live" || m.status === "ht";
  const isFinished = m.status === "finished";
  const hasStats = Object.values(m.stats).some((pair) => pair.home !== null && pair.away !== null);
  const hasLineups = Boolean(m.lineups.home || m.lineups.away);
  const tabs = [
    ["overview", "Résumé"],
    ["round", "Journée"],
    ["standings", "Classement"],
    ["analysis", "Analyse"],
    ["prematch", "Avant-match"],
    ["lineups", "Compositions"],
    ["odds", "Cotes"],
    ["info", "Infos"],
  ];

  return (
    <AppShell hideHeader>
      <div className="mx-auto min-h-screen w-full max-w-[440px] bg-background pb-20 lg:max-w-[980px] lg:pb-0">
        {/* Dynamic Hero Header */}
        <div className="score-dark-surface relative overflow-hidden border-b border-[#252525] bg-[#111111] text-[#fdfdfd]">
          <div className="relative">
            {/* Navigation Header */}
            <div className="flex items-center justify-between border-b border-[#252525] px-3 py-3 sm:px-4">
              <Link
                to="/"
                aria-label="Retour aux matchs"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-[#202020] text-[#d4d4d4] transition-colors hover:bg-[#292929] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div className="min-w-0 flex-1 px-2 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <img src={m.league.logo} alt="" className="size-3.5 object-contain" />
                  <span className="truncate text-[10px] font-bold uppercase tracking-widest text-[#b8b8b8]">
                    {m.league.name}
                  </span>
                </div>
                <h1 className="mx-auto mt-1 line-clamp-2 max-w-[270px] text-xs font-black leading-tight text-[#fdfdfd]">
                  {m.home.name} <span className="text-[#777777]">vs</span> {m.away.name}
                </h1>
                <div className="truncate text-[11px] font-semibold text-[#a3a3a3]">
                  <time dateTime={m.kickoff}>{m.dayLabel}</time> · {m.venue?.split(",")[0] ?? "—"}
                </div>
              </div>
              <div className="size-11 shrink-0" aria-hidden />
            </div>

            {/* Match Score Display */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-6 sm:gap-4 sm:px-4 sm:py-7">
              <div className="flex flex-col items-center gap-2 text-center">
                <img
                  src={m.home.logo}
                  alt={m.home.name}
                  className="size-14 object-contain drop-shadow-md sm:size-16"
                />
                <div className="line-clamp-2 text-xs font-black leading-tight sm:text-sm">
                  {m.home.short}
                </div>
              </div>

              <div className="text-center">
                {isLive ? (
                  <>
                    <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-alert/20 px-3 py-1 text-[10px] font-black text-alert shadow-sm animate-pulse">
                      <span className="size-2 rounded-full bg-alert animate-ping" />
                      {m.status === "ht" ? "MI-TEMPS" : `LIVE ${m.minute ?? ""}'`}
                    </div>
                    <div className="text-5xl font-black tabular-nums tracking-tighter">
                      {m.homeScore ?? "—"}
                      <span className="mx-2 text-[#777777]">·</span>
                      {m.awayScore ?? "—"}
                    </div>
                  </>
                ) : isFinished ? (
                  <>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#888888]">
                      Terminé
                    </div>
                    <div className="text-5xl font-black tabular-nums tracking-tighter">
                      {m.homeScore ?? "—"}
                      <span className="mx-2 text-[#777777]">·</span>
                      {m.awayScore ?? "—"}
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
                  className="size-14 object-contain drop-shadow-md sm:size-16"
                />
                <div className="line-clamp-2 text-xs font-black leading-tight sm:text-sm">
                  {m.away.short}
                </div>
              </div>
            </div>

            {/* Prediction CTA: a finished match cannot start a new paid analysis. */}
            <div className="score-dark-surface border-t border-[#252525] bg-[#181818] p-3">
              {isFinished ? (
                <a
                  href="/pronostics/historique"
                  className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList className="size-4" />
                    <span>Consulter l’historique des pronostics</span>
                  </div>
                  <ChevronRight className="size-4" />
                </a>
              ) : (
                <a
                  href={`/analyse?home=${encodeURIComponent(m.home.name)}&away=${encodeURIComponent(m.away.name)}&matchId=${m.id}`}
                  className="flex min-h-11 w-full items-center justify-between rounded-2xl bg-brand px-4 py-2.5 text-xs font-black text-neutral-900 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 animate-bounce" />
                    <span>
                      {isLive ? "Analyser le match en direct" : "Obtenir l’analyse IA de ce match"}{" "}
                      · 3 crédits
                    </span>
                  </div>
                  <ChevronRight className="size-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        <MatchVoteCard match={m} />

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
          <div className="sticky top-0 z-20 border-b border-[#252525] bg-background/95 backdrop-blur">
            <TabsList className="no-scrollbar h-auto w-full snap-x snap-mandatory justify-start gap-0 overflow-x-auto overscroll-x-contain scroll-px-3 rounded-none bg-transparent p-0 touch-pan-x">
              {tabs.map(([v, l]) => (
                <TabsTrigger
                  key={v}
                  value={v}
                  className="group relative min-h-11 shrink-0 snap-start rounded-none border-0 bg-transparent px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-brand data-[state=active]:shadow-none sm:px-4"
                >
                  {l}
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand opacity-0 group-data-[state=active]:opacity-100" />
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0 space-y-4 p-4">
            <MatchOverview match={m} isLive={isLive} isFinished={isFinished} />
            <MatchDataSignals match={m} />
            {hasStats && <MatchStatisticsCard match={m} />}
            {m.events.length > 0 && <MatchTimelineCard match={m} />}
            {m.h2h.length > 0 && <MatchH2HCard match={m} />}
          </TabsContent>

          <TabsContent value="round" className="mt-0 p-4">
            <FixtureRoundPanel currentId={m.id} data={matchCenter} loading={matchCenterLoading} />
          </TabsContent>

          <TabsContent value="standings" className="mt-0 p-4">
            <FixtureStandingsPanel
              rows={matchCenter?.standings}
              homeId={m.home.id}
              awayId={m.away.id}
              loading={matchCenterLoading}
            />
          </TabsContent>

          <TabsContent value="analysis" className="mt-0 p-4">
            <FixtureAnalysisPanel
              match={m}
              context={extendedContext}
              loading={extendedContextLoading}
            />
          </TabsContent>

          <TabsContent value="prematch" className="mt-0 p-4">
            <FixturePrematchPanel
              match={m}
              context={extendedContext}
              loading={extendedContextLoading}
            />
          </TabsContent>

          {/* Lineups Tab */}
          <TabsContent value="lineups" className="mt-0 space-y-4 p-4">
            {hasLineups ? (
              <>
                <TacticalPitch2D home={m.home} away={m.away} lineups={m.lineups} />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {m.lineups.home && <LineupCard title={m.home.short} lineup={m.lineups.home} />}
                  {m.lineups.away && <LineupCard title={m.away.short} lineup={m.lineups.away} />}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Compositions non disponibles.
              </div>
            )}
          </TabsContent>

          <TabsContent value="odds" className="mt-0 p-4">
            <FixtureOddsPanel data={matchCenter} loading={matchCenterLoading} />
          </TabsContent>

          <TabsContent value="info" className="mt-0 p-4">
            <FixtureInfoPanel match={m} data={matchCenter} loading={matchCenterLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function formatFetchedAtTechnical(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "récemment";
  return `${date.toISOString().slice(11, 16)} UTC`;
}

function formatFetchedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "récemment";
  const minutes = Math.floor(Math.max(0, Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l’instant";
  if (minutes === 1) return "il y a 1 minute";
  return `il y a ${minutes} minutes`;
}

function FixtureWaitingState({
  onRetry,
  refreshing = false,
}: {
  onRetry: () => void | Promise<unknown>;
  refreshing?: boolean;
}) {
  return (
    <AppShell>
      <main className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center px-4 py-8 sm:px-6 lg:px-0">
        <section className="w-full rounded-2xl border border-border/60 bg-card p-6 text-center">
          <AlertTriangle className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <h1 className="mt-3 text-base font-bold">Cette fiche est en cours de synchronisation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Le score et les informations vérifiées apparaîtront dès que la rencontre sera reçue.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => void onRetry()}
              disabled={refreshing}
              className="recovery-primary inline-flex items-center gap-2 rounded-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
              Actualiser la fiche
            </button>
            <Link
              to="/"
              className="recovery-secondary inline-flex items-center rounded-full ring-1 ring-black/5 dark:ring-white/10"
            >
              Retour
            </Link>
          </div>
        </section>
      </main>
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
            Actualisation automatique
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

function MatchPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="score-card space-y-3 p-4" aria-label="Chargement en cours">
      <div className="h-4 w-36 animate-pulse rounded bg-surface" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-xl bg-surface" />
      ))}
    </div>
  );
}

function MatchPanelEmpty({ children }: { children: string }) {
  return (
    <div className="score-card border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function MatchStatisticsCard({ match }: { match: RemoteMatchDetail }) {
  return (
    <section className="score-dark-surface rounded-xl border border-[#252525] bg-[#181818] p-4">
      <div className="mb-4 flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
        <span>{match.home.short}</span>
        <span className="flex items-center gap-1 text-[#b8b8b8]">
          <Activity className="size-3.5 text-brand" /> Statistiques clés
        </span>
        <span>{match.away.short}</span>
      </div>
      <div className="space-y-4">
        <StatBar
          label="Possession"
          home={match.stats.possession.home}
          away={match.stats.possession.away}
          unit="%"
          accent
        />
        <StatBar label="xG" home={match.stats.xg.home} away={match.stats.xg.away} />
        <StatBar
          label="Tirs cadrés"
          home={match.stats.shotsOnTarget.home}
          away={match.stats.shotsOnTarget.away}
          accent
        />
        <StatBar label="Corners" home={match.stats.corners.home} away={match.stats.corners.away} />
        <StatBar
          label="Cartons jaunes"
          home={match.stats.yellow.home}
          away={match.stats.yellow.away}
        />
      </div>
    </section>
  );
}

function MatchTimelineCard({ match }: { match: RemoteMatchDetail }) {
  return (
    <section className="score-dark-surface rounded-xl border border-[#252525] bg-[#181818] p-4">
      <h2 className="text-xs font-black uppercase tracking-wider">Temps forts</h2>
      <div className="mt-4 space-y-3">
        {match.events.map((event, index) => (
          <div
            key={`${event.minute}-${event.player}-${index}`}
            className="grid grid-cols-[38px_1fr] items-center gap-3"
          >
            <span className="grid size-8 place-items-center rounded-full bg-[#fdfdfd] text-[10px] font-black text-[#111111]">
              {event.minute}'
            </span>
            <EventPill event={event} />
          </div>
        ))}
      </div>
    </section>
  );
}

function MatchH2HCard({ match }: { match: RemoteMatchDetail }) {
  return (
    <section className="score-dark-surface overflow-hidden rounded-xl border border-[#252525] bg-[#181818]">
      <h2 className="border-b border-[#2b2b2b] px-4 py-3 text-xs font-black uppercase tracking-wider">
        Confrontations récentes
      </h2>
      <ul className="divide-y divide-[#2b2b2b]">
        {match.h2h.map((item) => (
          <li
            key={item.id}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 text-xs"
          >
            <span className="truncate text-right font-semibold">{item.home}</span>
            <span className="rounded-md bg-[#fdfdfd] px-2 py-1 font-black text-[#111111] tabular-nums">
              {item.score}
            </span>
            <span className="truncate font-semibold">{item.away}</span>
            <span className="col-span-3 text-center text-[10px] text-[#a3a3a3]">
              {item.date} · {item.competition}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FixtureRoundPanel({
  currentId,
  data,
  loading,
}: {
  currentId: number;
  data?: FixtureMatchCenter;
  loading: boolean;
}) {
  if (loading) return <MatchPanelSkeleton rows={5} />;
  if (!data?.roundFixtures.length) {
    return (
      <MatchPanelEmpty>
        Les autres rencontres de cette journée ne sont pas encore disponibles.
      </MatchPanelEmpty>
    );
  }
  return (
    <section className="score-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <p className="score-section-label">Journée</p>
          <h2 className="mt-1 text-sm font-black">
            {data.round ?? "Rencontres de la compétition"}
          </h2>
        </div>
        <CalendarDays className="size-4 text-brand" />
      </div>
      <ul className="divide-y divide-border/60">
        {data.roundFixtures.map((fixture) => {
          const live = fixture.status === "live" || fixture.status === "ht";
          const current = fixture.id === currentId;
          return (
            <li key={fixture.id} className={cn(current && "bg-brand/5")}>
              <Link
                to="/live/$id"
                params={{ id: String(fixture.id) }}
                className="grid min-h-14 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface"
              >
                <span
                  className={cn(
                    "text-[10px] font-black",
                    live ? "text-alert" : "text-muted-foreground",
                  )}
                >
                  {live
                    ? `${fixture.minute ?? ""}'`
                    : fixture.status === "finished"
                      ? "TER"
                      : fixture.timeLabel}
                </span>
                <span className="min-w-0 space-y-1 text-xs font-semibold">
                  <span className="flex items-center gap-2">
                    <img src={fixture.home.logo} alt="" className="size-4 object-contain" />
                    <span className="truncate">{fixture.home.name}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <img src={fixture.away.logo} alt="" className="size-4 object-contain" />
                    <span className="truncate">{fixture.away.name}</span>
                  </span>
                </span>
                <span className="space-y-1 text-right text-xs font-black tabular-nums">
                  <span className="block">{fixture.homeScore ?? "—"}</span>
                  <span className="block">{fixture.awayScore ?? "—"}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FixtureStandingsPanel({
  rows,
  homeId,
  awayId,
  loading,
}: {
  rows?: StandingRow[];
  homeId: number;
  awayId: number;
  loading: boolean;
}) {
  if (loading) return <MatchPanelSkeleton rows={7} />;
  if (!rows?.length)
    return (
      <MatchPanelEmpty>
        Le classement de cette compétition n’est pas encore disponible.
      </MatchPanelEmpty>
    );
  return (
    <section className="score-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Table2 className="size-4 text-brand" />
        <h2 className="text-sm font-black">Classement actuel</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-[11px]">
          <thead className="bg-surface text-[9px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Équipe</th>
              <th className="px-2 py-2">MJ</th>
              <th className="px-2 py-2">V</th>
              <th className="px-2 py-2">N</th>
              <th className="px-2 py-2">D</th>
              <th className="px-2 py-2">BP</th>
              <th className="px-2 py-2">BC</th>
              <th className="px-2 py-2">DB</th>
              <th className="px-3 py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => {
              const highlighted = row.teamId === homeId || row.teamId === awayId;
              return (
                <tr key={row.teamId} className={cn(highlighted && "bg-brand/10 font-bold")}>
                  <td className="px-3 py-2.5 font-black">{row.rank}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <img src={row.logo} alt="" className="size-5 object-contain" />
                      <span className="max-w-44 truncate">{row.team}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5">{row.played}</td>
                  <td className="px-2 py-2.5">{row.win}</td>
                  <td className="px-2 py-2.5">{row.draw}</td>
                  <td className="px-2 py-2.5">{row.lose}</td>
                  <td className="px-2 py-2.5">{row.goalsFor}</td>
                  <td className="px-2 py-2.5">{row.goalsAgainst}</td>
                  <td className="px-2 py-2.5">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                  <td className="px-3 py-2.5 text-right font-black">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FixtureAnalysisPanel({
  match,
  context,
  loading,
}: {
  match: RemoteMatchDetail;
  context?: FixtureExtendedContext;
  loading: boolean;
}) {
  if (loading) return <MatchPanelSkeleton rows={4} />;
  const hasAnalysis = Boolean(
    match.prediction ||
    context ||
    match.h2h.length ||
    Object.values(match.stats).some((item) => item.home !== null || item.away !== null),
  );
  if (!hasAnalysis)
    return (
      <MatchPanelEmpty>
        Aucune analyse suffisamment documentée n’est disponible pour le moment.
      </MatchPanelEmpty>
    );
  return (
    <div className="space-y-4">
      {match.prediction && (
        <section className="score-card p-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="size-4 text-brand" />
            <h2 className="text-sm font-black">Probabilités disponibles</h2>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              [match.home.short, match.prediction.home],
              ["Nul", match.prediction.draw],
              [match.away.short, match.prediction.away],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-surface p-3 text-center">
                <div className="truncate text-[10px] font-bold text-muted-foreground">{label}</div>
                <div className="mt-1 text-xl font-black">{value !== null ? `${value}%` : "—"}</div>
              </div>
            ))}
          </div>
          {(match.prediction.advice || match.prediction.underOver) && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {[match.prediction.advice, match.prediction.underOver].filter(Boolean).join(" · ")}
            </p>
          )}
        </section>
      )}
      {context && <FixtureTeamsContext data={context} loading={false} />}
      {Object.values(match.stats).some((item) => item.home !== null || item.away !== null) && (
        <MatchStatisticsCard match={match} />
      )}
      {match.h2h.length > 0 && <MatchH2HCard match={match} />}
    </div>
  );
}

function FixturePrematchPanel({
  match,
  context,
  loading,
}: {
  match: RemoteMatchDetail;
  context?: FixtureExtendedContext;
  loading: boolean;
}) {
  if (loading) return <MatchPanelSkeleton rows={5} />;
  const absences = match.injuries.home.length + match.injuries.away.length;
  if (!context && !absences && !match.h2h.length)
    return (
      <MatchPanelEmpty>
        Les informations d’avant-match seront ajoutées dès leur publication.
      </MatchPanelEmpty>
    );
  return (
    <div className="space-y-4">
      {context && <FixtureTeamsContext data={context} loading={false} />}
      {absences > 0 && (
        <section className="score-card p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-brand" />
            <h2 className="text-sm font-black">Absents signalés</h2>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              [match.home.short, match.injuries.home],
              [match.away.short, match.injuries.away],
            ].map(([team, players]) => (
              <div key={String(team)} className="rounded-xl bg-surface p-3">
                <h3 className="text-xs font-black">{String(team)}</h3>
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {(players as ApiInjury[]).map((player) => (
                    <li key={player.playerId}>
                      {player.name} · {player.reason || "motif non communiqué"}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      {match.h2h.length > 0 && <MatchH2HCard match={match} />}
    </div>
  );
}

function FixtureOddsPanel({ data, loading }: { data?: FixtureMatchCenter; loading: boolean }) {
  if (loading) return <MatchPanelSkeleton rows={4} />;
  if (!data?.oddsMarkets.length && !data?.liveOddsMarkets.length)
    return (
      <MatchPanelEmpty>Aucune cote vérifiée n’est disponible pour cette rencontre.</MatchPanelEmpty>
    );
  return (
    <div className="space-y-3">
      <OddsGroup title="Cotes en direct" markets={data.liveOddsMarkets} live />
      <OddsGroup title="Cotes pré-match" markets={data.oddsMarkets} />
      <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
        {data.oddsUpdatedAt
          ? `Dernière mise à jour : ${formatFetchedAtTechnical(data.oddsUpdatedAt)}. Les cotes peuvent évoluer.`
          : "Les cotes peuvent évoluer. Vérifiez les conditions au moment de votre consultation."}
      </p>
    </div>
  );
}

function OddsGroup({
  title,
  markets,
  live = false,
}: {
  title: string;
  markets: FixtureMatchCenter["oddsMarkets"];
  live?: boolean;
}) {
  if (!markets.length) return null;
  return (
    <section className="score-card p-4">
      <div className="flex items-center gap-2">
        <BadgeDollarSign className="size-4 text-brand" />
        <h2 className="text-sm font-black">{title}</h2>
        {live && (
          <span className="ml-auto rounded-full bg-alert/10 px-2 py-1 text-[10px] font-black text-alert">
            LIVE
          </span>
        )}
      </div>
      <div className="mt-4 space-y-3">
        {markets.map((market) => (
          <div key={`${title}-${market.name}`}>
            <h3 className="text-xs font-bold text-muted-foreground">{market.name}</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {market.selections.map((selection) => (
                <div
                  key={selection.label}
                  className="flex items-center justify-between rounded-xl bg-surface px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-xs font-bold text-muted-foreground">
                    {selection.label}
                  </span>
                  <span className="ml-2 text-sm font-black tabular-nums">
                    {selection.odd.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FixtureInfoPanel({
  match,
  data,
  loading,
}: {
  match: RemoteMatchDetail;
  data?: FixtureMatchCenter;
  loading: boolean;
}) {
  if (loading) return <MatchPanelSkeleton rows={6} />;
  const date = new Date(match.kickoff);
  const details = [
    ["Compétition", match.league.name],
    ["Saison", String(match.league.season)],
    ["Journée", data?.round ?? match.league.round ?? null],
    [
      "Date",
      Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("fr-FR", { dateStyle: "long" }),
    ],
    ["Heure", match.timeLabel],
    ["Stade", data?.info.venue ?? match.venue],
    ["Ville", data?.info.city ?? null],
    ["Arbitre", data?.info.referee ?? null],
    [
      "Statut",
      match.status === "finished"
        ? "Terminé"
        : match.status === "upcoming"
          ? "À venir"
          : match.status === "ht"
            ? "Mi-temps"
            : "En direct",
    ],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  return (
    <section className="score-card p-4">
      <div className="flex items-center gap-2">
        <Info className="size-4 text-brand" />
        <h2 className="text-sm font-black">Informations du match</h2>
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface p-3">
            <dt className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-1 text-xs font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <Clock3 className="size-3" /> Informations mises à jour selon les données publiées.
      </div>
    </section>
  );
}

function FixtureTeamsContext({
  data,
  loading,
}: {
  data?: FixtureExtendedContext;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-label="Chargement des équipes">
        {[0, 1].map((item) => (
          <div key={item} className="score-card animate-pulse p-4">
            <div className="h-10 w-10 rounded-full bg-surface" />
            <div className="mt-3 h-4 w-2/3 rounded bg-surface" />
            <div className="mt-4 h-24 rounded-xl bg-surface" />
          </div>
        ))}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Les informations complémentaires ne sont pas encore disponibles.
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FixtureTeamCard team={data.home} />
      <FixtureTeamCard team={data.away} />
    </div>
  );
}

function FixtureTeamCard({ team }: { team: FixtureContextTeam }) {
  const hasDetails =
    team.standing ||
    team.recent.length ||
    team.coach ||
    team.sidelined.length ||
    team.topScorers.length ||
    team.statistics;
  const goalsFor = formatTeamStat(team.statistics?.goalsForAverage.total);
  const goalsAgainst = formatTeamStat(team.statistics?.goalsAgainstAverage.total);
  const wins = formatTeamStat(team.statistics?.wins.total);
  const cleanSheets = formatTeamStat(team.statistics?.cleanSheets.total);
  return (
    <section className="score-card overflow-hidden p-4">
      <div className="flex items-center gap-3">
        <img src={team.logo} alt="" className="size-10 object-contain" />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black">
            <a
              href={`/equipes/${team.id}`}
              className="hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {team.name}
            </a>
          </h2>
          {team.coach && (
            <p className="text-xs text-muted-foreground">
              Coach ·{" "}
              <a
                href={`/entraineurs/${team.coach.id}`}
                className="hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {team.coach.name}
              </a>
            </p>
          )}
        </div>
      </div>

      {team.standing && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <TeamMetric label="Classement" value={`${team.standing.rank}e`} />
          <TeamMetric label="Points" value={String(team.standing.points)} />
          <TeamMetric label="Matchs" value={String(team.standing.played)} />
        </div>
      )}

      {[goalsFor, goalsAgainst, wins, cleanSheets].some((value) => value !== null) && (
        <div className="mt-4">
          <h3 className="score-section-label">Repères de la saison</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <TeamMetric label="Buts / match" value={goalsFor ?? "—"} />
            <TeamMetric label="Encaissés / match" value={goalsAgainst ?? "—"} />
            <TeamMetric label="Victoires" value={wins ?? "—"} />
            <TeamMetric label="Sans encaisser" value={cleanSheets ?? "—"} />
          </div>
        </div>
      )}

      {team.recent.length > 0 && (
        <div className="mt-4">
          <h3 className="score-section-label">Forme récente</h3>
          <ul className="mt-2 divide-y divide-border/60 rounded-xl border border-border/60">
            {team.recent.map((match) => (
              <li key={match.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-black",
                    match.result === "W"
                      ? "bg-brand/15 text-brand"
                      : match.result === "L"
                        ? "bg-alert/10 text-alert"
                        : "bg-surface text-muted-foreground",
                  )}
                >
                  {match.result === "W" ? "V" : match.result === "L" ? "D" : "N"}
                </span>
                <span className="min-w-0 flex-1 truncate">{match.opponent}</span>
                <span className="font-black tabular-nums">{match.score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {team.topScorers.length > 0 && (
        <div className="mt-4">
          <h3 className="score-section-label">Meilleurs buteurs</h3>
          <div className="mt-2 space-y-2">
            {team.topScorers.map((player) => (
              <div key={player.id} className="flex items-center gap-2 text-xs">
                <img src={player.photo} alt="" className="size-7 rounded-full object-cover" />
                <a
                  href={`/joueurs/${player.id}`}
                  className="min-w-0 flex-1 truncate font-semibold hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {player.name}
                </a>
                <span className="font-black">{player.goals} buts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {team.sidelined.length > 0 && (
        <div className="mt-4 rounded-xl bg-alert/5 p-3">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-alert">Absences</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {team.sidelined
              .slice(0, 3)
              .map((player) => player.name)
              .join(" · ")}
            {team.sidelined.length > 3 ? ` · +${team.sidelined.length - 3}` : ""}
          </p>
        </div>
      )}

      {!hasDetails && (
        <p className="mt-4 text-xs text-muted-foreground">
          Les informations de l’équipe seront ajoutées dès leur publication.
        </p>
      )}
    </section>
  );
}

function formatTeamStat(value: string | number | null | undefined) {
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function TeamMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-2 py-2.5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-black">{value}</div>
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
        <ShieldCheck className="size-4 shrink-0 text-brand" aria-label="Informations vérifiées" />
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
  const getMyVotes = useServerFn(getMyCommunityVotes);
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
  const myVoteQuery = useQuery({
    queryKey: ["my-community-vote", match.id, user?.id],
    queryFn: () => getMyVotes({ data: { fixtureIds: [match.id] } }),
    enabled: !demoMode && Boolean(user),
    staleTime: 60_000,
  });

  useEffect(() => {
    const savedVote = myVoteQuery.data?.[match.id];
    if (savedVote === "home" || savedVote === "draw" || savedVote === "away") {
      setSelected(savedVote);
    }
  }, [match.id, myVoteQuery.data]);
  const counts = demoMode ? demoCounts : (votesQuery.data?.counts ?? { home: 0, draw: 0, away: 0 });
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
      {Boolean(lineup.substitutes?.length) && (
        <div className="mt-4 border-t border-border/60 pt-3">
          <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Remplaçants
          </h3>
          <ul className="space-y-1.5">
            {lineup.substitutes?.map((player, index) => (
              <li
                key={`${player.number}-${player.name}-${index}`}
                className="flex items-center gap-2 text-xs"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded bg-surface font-mono text-[10px] font-bold">
                  {player.number}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
                <span className="text-[9px] font-bold uppercase text-muted-foreground">
                  {player.position}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
