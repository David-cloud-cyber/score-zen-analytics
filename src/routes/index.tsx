import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles,
  ChevronRight,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CalendarDays,
  Flame,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RemoteMatchCard } from "@/components/RemoteMatchCard";
import { getFixtures } from "@/lib/football.functions";
import type { FixturesPayload, RemoteMatchSummary } from "@/lib/football-types";
import { getMyPremiumFavorites } from "@/lib/premium-hub.functions";
import { rankMatches, selectTrendingMatch } from "@/lib/match-ranking";
import { buildRouteMeta, faqSchema, ORG, SPEAKABLE } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/PageSkeleton";
import { reportFixtureDiagnostic, track } from "@/lib/analytics";
import { requestCookiePreferences } from "@/lib/meta-pixel";
import { DEMO_FAVORITES, DEMO_FIXTURES, isLocalDemo } from "@/lib/local-demo";
import { useSession } from "@/hooks/use-session";
import { useLiveFixtureStream } from "@/hooks/use-live-fixture-stream";

const fixturesQuery = (mode: "today" | "live", date?: string) =>
  queryOptions({
    queryKey: ["fixtures", mode, date ?? "today"],
    queryFn: () => getFixtures({ data: mode === "live" ? { live: true } : { date } }),
    staleTime: mode === "live" ? 30_000 : 60_000,
    refetchInterval: mode === "live" ? false : 60_000,
    refetchOnWindowFocus: true,
    retry: false,
    refetchIntervalInBackground: false,
  });

export const Route = createFileRoute("/")({
  head: () => {
    const base = buildRouteMeta({
      path: "/",
      title: "Scores football en direct : matchs du jour et analyses",
      description:
        "Suivez les scores football en direct et les matchs du jour : Ligue 1, Liga, Premier League, Ligue des champions, compositions et analyses statistiques.",
    });
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            faqSchema([
              {
                q: "Comment fonctionne une analyse de match LiveFoot ?",
                a: "LiveFoot croise la forme récente, le contexte domicile-extérieur, le classement, les absences, les confrontations directes et les données de marché disponibles pour produire une estimation prudente.",
              },
            ]),
          ),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "LiveFoot IA",
            url: "https://www.livefoot.fun",
            publisher: ORG,
            speakable: SPEAKABLE,
            inLanguage: "fr",
          }),
        },
      ],
    };
  },
  loader: ({ context }) => {
    if (isLocalDemo()) return;
    // Best-effort prefetch — never crash the page on API errors.
    context.queryClient
      .ensureQueryData(fixturesQuery("today", formatDate(new Date())))
      .catch(() => {});
  },
  pendingComponent: PageSkeleton,
  pendingMs: 0,
  errorComponent: HomeError,
  component: HomePage,
});

function HomeError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <AppShell>
      <div className="mx-4 mt-8 animate-score-pop rounded-xl border border-alert/30 bg-alert/5 p-4 text-center lg:mx-0">
        <AlertTriangle className="mx-auto size-6 text-alert" aria-hidden />
        <h2 className="mt-3 text-base font-black">Données football indisponibles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message || "Réessayez dans un instant."}
        </p>
        <button
          onClick={reset}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#181818] px-4 py-2 text-xs font-bold text-[#f7f7f7]"
        >
          <RefreshCw className="size-3.5" /> Réessayer
        </button>
      </div>
    </AppShell>
  );
}

function FixturesStatusNotice({
  payload,
  livePayload,
  onRetry,
}: {
  payload?: FixturesPayload;
  livePayload?: FixturesPayload;
  onRetry: () => void;
}) {
  const stale = payload?.state === "stale" || livePayload?.state === "stale";
  const liveUnavailable = livePayload?.state === "unavailable";
  const fetchedAt = payload?.fetchedAt ?? livePayload?.fetchedAt;
  const label = fetchedAt ? formatRelativeUpdate(fetchedAt) : "dernière synchronisation disponible";

  return (
    <div className="mx-4 mb-4 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-xs text-muted-foreground lg:mx-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {stale
            ? `Matchs réels affichés — ${label}.`
            : liveUnavailable
              ? "Matchs du jour disponibles ; le direct se synchronise momentanément."
              : "Actualisation momentanément indisponible."}
        </span>
        <button type="button" onClick={onRetry} className="font-black text-brand hover:underline">
          Réessayer
        </button>
      </div>
    </div>
  );
}

function formatRelativeUpdate(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes === 1) return "il y a 1 minute";
  return `il y a ${minutes} minutes`;
}

const FILTERS = [
  { id: "live", label: "En direct" },
  { id: "upcoming", label: "À venir" },
  { id: "finished", label: "Terminés" },
] as const;

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function HomePage() {
  const demoMode = isLocalDemo();
  const { user } = useSession();
  const getFavorites = useServerFn(getMyPremiumFavorites);
  const [dayOffset, setDayOffset] = useState(0);
  const selectedDate = new Date();
  selectedDate.setDate(selectedDate.getDate() + dayOffset);
  const selectedDateIso = formatDate(selectedDate);
  const selectedDateLabel =
    dayOffset === 0
      ? "Aujourd'hui"
      : selectedDate.toLocaleDateString("fr-FR", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        });
  const {
    data: todayPayload,
    isFetching: isTodayFetching,
    isError: isTodayQueryError,
    refetch: refetchToday,
  } = useQuery({
    ...fixturesQuery("today", selectedDateIso),
    enabled: !demoMode,
  });
  const {
    data: livePayload,
    isFetching: isLiveFetching,
    isError: isLiveQueryError,
    refetch: refetchLive,
  } = useQuery({
    ...fixturesQuery("live"),
    enabled: !demoMode && dayOffset === 0,
  });
  const liveStream = useLiveFixtureStream({
    enabled: !demoMode && dayOffset === 0,
    initialPayload: livePayload,
    loadSnapshot: () => getFixtures({ data: { live: true } }),
  });
  const favoritesQuery = useQuery({
    queryKey: ["me", "favorites"],
    queryFn: () => (demoMode ? Promise.resolve(DEMO_FAVORITES) : getFavorites()),
    enabled: demoMode || !!user,
    staleTime: 30_000,
  });
  const favoriteMatchIds = useMemo(
    () =>
      new Set(
        (favoritesQuery.data ?? [])
          .filter((favorite) => favorite.kind === "match")
          .map((favorite) => favorite.refId),
      ),
    [favoritesQuery.data],
  );
  const favoriteTeamNames = useMemo(
    () =>
      new Set(
        (favoritesQuery.data ?? [])
          .filter((favorite) => favorite.kind === "team")
          .flatMap((favorite) => [favorite.refId, favorite.label ?? ""])
          .filter(Boolean),
      ),
    [favoritesQuery.data],
  );
  const todayMatches = demoMode ? DEMO_FIXTURES : (todayPayload?.matches ?? []);
  const sharedLivePayload = dayOffset === 0 ? liveStream.payload ?? livePayload : undefined;
  const liveMatches = demoMode ? [] : (sharedLivePayload?.matches ?? []);
  const mergedMatches = useMemo(() => {
    const byId = new Map<number, RemoteMatchSummary>();
    for (const match of todayMatches) byId.set(match.id, match);
    for (const match of liveMatches) byId.set(match.id, match);
    return Array.from(byId.values());
  }, [todayMatches, liveMatches]);
  const visibleFixtures = rankMatches(demoMode ? DEMO_FIXTURES : mergedMatches, {
    favoriteMatchIds,
    favoriteTeamNames,
    serverRanked: !demoMode,
  });
  const hasLive = visibleFixtures.some((m) => m.status === "live" || m.status === "ht");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("upcoming");
  const [filterTouched, setFilterTouched] = useState(false);

  useEffect(() => {
    if (!filterTouched && hasLive) setFilter("live");
  }, [filterTouched, hasLive]);

  const filtered = visibleFixtures.filter((m) =>
    filter === "live" ? m.status === "live" || m.status === "ht" : m.status === filter,
  );

  // Group by league name
  const groupedMap = new Map<
    number,
    { name: string; logo: string; country: string; matches: typeof visibleFixtures }
  >();
  for (const m of filtered) {
    const g = groupedMap.get(m.league.id) ?? {
      name: m.league.name,
      logo: m.league.logo,
      country: m.league.country,
      matches: [],
    };
    g.matches.push(m);
    groupedMap.set(m.league.id, g);
  }
  const grouped = Array.from(groupedMap.values());
  const today = selectedDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

  const topMatch = demoMode
    ? selectTrendingMatch(visibleFixtures)
    : visibleFixtures.find((match) => match.isTrending) ?? selectTrendingMatch(visibleFixtures);
  const isFetching = isTodayFetching || isLiveFetching || liveStream.isRefreshing;
  const todayUnavailable = !demoMode && (isTodayQueryError || todayPayload?.state === "unavailable");
  const liveUnavailable =
    !demoMode && (isLiveQueryError || sharedLivePayload?.state === "unavailable");
  const hasUsableMatches = visibleFixtures.length > 0;

  useEffect(() => {
    if (demoMode || (!todayUnavailable && !liveUnavailable)) return;
    reportFixtureDiagnostic({
      reason: todayUnavailable ? "today_unavailable" : "live_unavailable",
      errorCode: todayPayload?.errorCode ?? sharedLivePayload?.errorCode ?? "network",
      stylesLoaded: Boolean(document.querySelector("link[rel=stylesheet][href*=styles]")),
      matchesCount: visibleFixtures.length,
      cacheId: todayPayload?.cacheId ?? sharedLivePayload?.cacheId ?? null,
      page: window.location.pathname,
    });
  }, [demoMode, todayUnavailable, liveUnavailable, todayPayload, sharedLivePayload, visibleFixtures.length]);

  return (
    <AppShell>
      <div className="no-scrollbar overflow-x-auto px-4 pb-3 pt-6 lg:px-0 lg:pt-6">
        <div className="flex w-max min-w-full justify-center gap-2">
          {(
            [
              ["Football", true],
              ["Basket-ball", false],
              ["Tennis", false],
              ["Handball", false],
            ] as const
          ).map(([label, active]) => (
            <span
              key={label}
              className={cn(
                "score-sport-filter h-8 shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold leading-5",
                active
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted-foreground ring-1 ring-black/5 dark:ring-white/10",
              )}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-4 mb-4 flex items-center justify-between rounded-xl border border-border/60 bg-card px-3 py-2.5 lg:mx-0">
        <button
          type="button"
          aria-label="Jour précédent"
          onClick={() => setDayOffset((value) => value - 1)}
          className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <ChevronRight className="size-4 rotate-180" />
        </button>
        <div className="flex items-center gap-2 text-xs font-bold">
          <CalendarDays className="size-4 text-brand" />
          <span>{selectedDateLabel}</span>
          <span className="text-muted-foreground">{today}</span>
        </div>
        <button
          type="button"
          aria-label="Jour suivant"
          onClick={() => setDayOffset((value) => value + 1)}
          className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Filter pills */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 lg:px-0">
        {FILTERS.map((f) => {
          const count = visibleFixtures.filter((m) =>
            f.id === "live" ? m.status === "live" || m.status === "ht" : m.status === f.id,
          ).length;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => {
                setFilterTouched(true);
                setFilter(f.id);
              }}
              aria-pressed={active}
              className={cn(
                "match-filter h-8 shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold leading-5 transition-all",
                active
                  ? "match-filter-active"
                  : "",
              )}
            >
              {f.label}
              <span className={cn("ml-1.5 tabular-nums", active ? "opacity-70" : "opacity-50")}>
                {count}
              </span>
            </button>
          );
        })}
        {isFetching && (
          <span className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Actualisation
          </span>
        )}
      </div>

      {(todayPayload?.state === "stale" || sharedLivePayload?.state === "stale" || liveUnavailable) && (
        <FixturesStatusNotice
          payload={todayPayload}
          livePayload={sharedLivePayload}
          onRetry={() => {
            void refetchToday();
            void refetchLive();
            liveStream.retry();
          }}
        />
      )}

      {/* Hero banner */}
      {topMatch && (
        <div className="grid items-start gap-4 px-4 lg:grid-cols-3 lg:gap-5 lg:px-0">
          <Link
            to="/live/$id"
            params={{ id: String(topMatch.id) }}
            className="trending-match-card group relative block overflow-hidden p-5 transition-transform hover:-translate-y-0.5 lg:col-span-2 lg:p-7"
          >
            <div className="trending-match-halo trending-match-halo-blue pointer-events-none absolute -right-16 -top-16 size-48 transition-transform group-hover:scale-110" />
            <div className="trending-match-halo trending-match-halo-green pointer-events-none absolute -bottom-20 -left-10 size-40 transition-transform group-hover:scale-110" />
            <div className="relative">
              <div className="trending-badge mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                <Flame className="size-3" /> Trending
              </div>
              <h2 className="trending-match-title text-[22px] font-black leading-tight tracking-tight lg:text-3xl">
                {topMatch.home.name} <span className="trending-match-muted">vs</span>{" "}
                {topMatch.away.name}
              </h2>
              <p className="trending-match-meta mt-2 text-xs leading-relaxed lg:text-sm">
                {topMatch.league.name} · {topMatch.venue ?? topMatch.dayLabel} ·{" "}
                {topMatch.status === "live" || topMatch.status === "ht"
                  ? `En direct${topMatch.minute ? ` · ${topMatch.minute}'` : ""}`
                  : `Coup d'envoi ${topMatch.timeLabel}`}
                .
              </p>
              <div className="mt-4 flex items-center gap-4">
                <img
                  src={topMatch.home.logo}
                  alt={`Logo ${topMatch.home.name}`}
                  className="size-10 object-contain"
                />
                <div className="trending-match-score text-3xl font-black tabular-nums">
                  {topMatch.homeScore ?? "—"}
                  <span className="mx-2 text-background/40">·</span>
                  {topMatch.awayScore ?? "—"}
                </div>
                <img
                  src={topMatch.away.logo}
                  alt={`Logo ${topMatch.away.name}`}
                  className="size-10 object-contain"
                />
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold">
                <span>Voir la fiche complète</span>
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>

          <Link
            to="/analyse"
            search={{ home: "", away: "" }}
            onClick={() => track("cta_click", { location: "home_desktop_card" })}
            className="hidden self-start overflow-hidden rounded-3xl bg-brand/10 p-5 ring-1 ring-brand/20 transition-all hover:bg-brand/15 lg:flex lg:flex-col"
          >
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                <Sparkles className="size-3" /> Prédictions
              </div>

              <h3 className="text-lg font-black leading-tight tracking-tight">
                Analysez deux équipes de votre choix
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Probabilités 1X2, marchés recommandés et facteurs clés — instantanément.
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-black text-brand">
              Lancer une analyse <ChevronRight className="size-4" />
            </div>
          </Link>
        </div>
      )}

      {/* Grouped matches */}
      <div className="mt-8 space-y-6 px-4 lg:px-0">
        {todayUnavailable && !hasUsableMatches ? (
          <div className="animate-score-pop rounded-xl border border-alert/30 bg-alert/5 p-4 text-center text-sm text-muted-foreground">
            Les scores du jour sont momentanément indisponibles. Vous pouvez consulter les analyses
            et les guides pendant la prochaine actualisation.
            <button
              type="button"
              onClick={() => {
                void refetchToday();
                void refetchLive();
              }}
              className="mx-auto mt-3 block text-xs font-black text-brand hover:underline"
            >
              Réessayer
            </button>
          </div>
        ) : liveUnavailable && filter === "live" ? (
          <div className="animate-score-pop rounded-xl border border-alert/30 bg-alert/5 p-4 text-center text-sm text-muted-foreground">
            Le direct est momentanément indisponible. Les matchs du jour restent consultables.
            <button
              type="button"
              onClick={() => void refetchLive()}
              className="mx-auto mt-3 block text-xs font-black text-brand hover:underline"
            >
              Réessayer
            </button>
          </div>
        ) : grouped.length === 0 ? (
          <div className="score-empty-state text-sm text-muted-foreground">
            {filter === "live"
              ? "Aucun match en direct pour le moment."
              : filter === "upcoming"
                ? "Aucun match à venir aujourd'hui."
                : "Aucun match terminé aujourd'hui."}
          </div>
        ) : null}
        {grouped.map((g) => (
          <section key={g.name}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={g.logo} alt={`Logo ${g.name}`} className="size-4 object-contain" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.16em]">{g.name}</h3>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">{g.country}</span>
            </div>
            <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
              {g.matches.map((m) => (
                <RemoteMatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* CTA (mobile only) */}
      <div className="mt-8 px-4 lg:hidden">
        <Link
          to="/analyse"
          search={{ home: "", away: "" }}
          onClick={() => track("cta_click", { location: "home_mobile_cta" })}
          className="flex items-center justify-between rounded-2xl bg-brand/10 p-4 ring-1 ring-brand/20 transition-transform active:scale-[0.99]"
        >
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-brand">
              Prédictions
            </div>

            <div className="mt-1 text-sm font-bold">Analyser deux équipes de votre choix</div>
          </div>
          <div className="grid size-10 place-items-center rounded-full bg-brand text-brand-foreground">
            <ChevronRight className="size-4" />
          </div>
        </Link>
      </div>

      {/* Résumé éditorial utile aux visiteurs et aux moteurs, sans exposer de jargon technique. */}
      <section
        aria-labelledby="livefoot-summary-title"
        data-answer
        className="mt-10 space-y-3 border-t border-border/60 px-4 pt-6 lg:px-0"
      >
        <h2 id="livefoot-summary-title" className="text-lg font-black tracking-tight">
          Livescore et analyses football en direct
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          LiveFoot réunit les <strong className="text-foreground">scores en direct</strong>, les
          compositions, la forme récente et des{" "}
          <strong className="text-foreground">analyses statistiques de matchs</strong> dans une
          interface rapide. Consultez les rencontres du jour, comparez deux équipes et retrouvez nos
          guides de codes promo vérifiés pour les nouveaux inscrits majeurs.
        </p>
        <nav
          aria-label="Explorer LiveFoot"
          className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold"
        >
          <Link
            to="/analyse"
            search={{ home: "", away: "" }}
            className="text-brand hover:underline"
          >
            Analyser un match
          </Link>
          <Link to="/codes-promo" className="text-brand hover:underline">
            Voir les codes promo
          </Link>
          <Link to="/communaute" className="text-muted-foreground hover:text-foreground">
            Rejoindre la communauté
          </Link>
        </nav>
      </section>

      <section
        aria-labelledby="livefoot-howto-title"
        className="mt-8 space-y-4 border-t border-border/60 px-4 pt-6 lg:px-0"
      >
        <div className="max-w-3xl space-y-2">
          <h2 id="livefoot-howto-title" className="text-lg font-black tracking-tight">
            Comment suivre un match et obtenir une analyse football ?
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            LiveFoot rassemble les informations utiles avant et pendant la rencontre pour vous aider
            à comprendre le rapport de force. Les scores et les horaires sont actualisés, tandis que
            l'espace Analyse détaille les probabilités, les facteurs clés et le niveau de confiance
            lorsque les données sont disponibles.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-border/70 bg-surface/40 p-4">
            <h3 className="text-sm font-black">1. Trouver le match</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Filtrez les matchs en direct, à venir ou terminés, puis ouvrez la fiche de la
              rencontre qui vous intéresse.
            </p>
          </article>
          <article className="rounded-2xl border border-border/70 bg-surface/40 p-4">
            <h3 className="text-sm font-black">2. Lire les données</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Comparez la forme récente, les confrontations, les compositions, les absences et les
              tendances domicile-extérieur avant de tirer une conclusion.
            </p>
          </article>
          <article className="rounded-2xl border border-border/70 bg-surface/40 p-4">
            <h3 className="text-sm font-black">3. Analyser avec méthode</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Lancez une analyse sur deux équipes et utilisez les probabilités comme une aide à la
              décision, jamais comme une garantie de résultat.
            </p>
          </article>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-10 space-y-3 border-t border-border/60 px-4 py-6 text-center lg:px-0">
        <nav
          aria-label="Liens de bas de page"
          className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-semibold"
        >
          <Link to="/codes-promo" className="text-brand hover:underline">
            Codes promo bookmakers
          </Link>
          <Link to="/premium" className="text-muted-foreground hover:text-foreground">
            Premium
          </Link>
          <button
            type="button"
            onClick={requestCookiePreferences}
            className="text-muted-foreground hover:text-foreground"
          >
            Préférences cookies
          </button>
          <Link to="/mentions-legales" className="text-muted-foreground hover:text-foreground">
            Mentions légales
          </Link>
        </nav>
        <p className="text-[11px] text-muted-foreground">
          Analyses fournies à titre informatif. Paris interdits aux mineurs (18+).
        </p>
      </footer>
    </AppShell>
  );
}
