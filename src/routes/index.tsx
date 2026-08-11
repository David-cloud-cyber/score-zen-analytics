import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import {
  Sparkles,
  ChevronRight,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CalendarDays,
  Flame,
} from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { RemoteMatchCard } from "@/components/RemoteMatchCard";
import { getFixtures } from "@/lib/football.functions";
import { buildRouteMeta, faqSchema, ORG, SPEAKABLE } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/PageSkeleton";
import { track } from "@/lib/analytics";
import { DEMO_FIXTURES, isLocalDemo } from "@/lib/local-demo";

const fixturesQuery = (mode: "today" | "live", date?: string) =>
  queryOptions({
    queryKey: ["fixtures", mode, date ?? "today"],
    queryFn: () => getFixtures({ data: mode === "live" ? { live: true } : { date } }),
    staleTime: mode === "live" ? 30_000 : 5 * 60_000,
    refetchInterval: mode === "live" ? 30_000 : false,
    retry: 1,
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

const TRENDING_LEAGUES = new Set([2, 39, 61, 78, 135, 140]);
const TRENDING_TEAMS = new Set([42, 49, 50, 40, 541, 529, 530, 85, 157, 165]);
const TRENDING_WINDOW_MS = 6 * 60 * 60 * 1000;

function trendingScore(match: (typeof DEMO_FIXTURES)[number], now: number): number | null {
  const isLive = match.status === "live" || match.status === "ht";
  const kickoff = new Date(match.kickoff).getTime();
  const isSoon =
    match.status === "upcoming" && kickoff >= now && kickoff - now <= TRENDING_WINDOW_MS;
  if (!isLive && !isSoon) return null;

  const teamWeight =
    (TRENDING_TEAMS.has(match.home.id) ? 24 : 0) + (TRENDING_TEAMS.has(match.away.id) ? 24 : 0);
  const leagueWeight = TRENDING_LEAGUES.has(match.league.id) ? 30 : 0;
  const urgencyWeight = isLive ? 1000 + (match.minute ?? 0) : 500 - (kickoff - now) / 60_000;
  return urgencyWeight + teamWeight + leagueWeight;
}

function pickTrendingMatch<T extends (typeof DEMO_FIXTURES)[number]>(matches: T[]): T | undefined {
  const now = Date.now();
  return matches
    .map((match) => ({ match, score: trendingScore(match, now) }))
    .filter((item): item is { match: T; score: number } => item.score !== null)
    .sort((a, b) => b.score - a.score)[0]?.match;
}

function HomePage() {
  const demoMode = isLocalDemo();
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
    data: fixtures = [],
    isFetching,
    isError,
    refetch,
  } = useQuery({
    ...fixturesQuery("today", selectedDateIso),
    enabled: !demoMode,
  });
  const visibleFixtures = demoMode ? DEMO_FIXTURES : fixtures;
  const hasLive = visibleFixtures.some((m) => m.status === "live" || m.status === "ht");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>(
    hasLive ? "live" : "upcoming",
  );

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

  const topMatch = pickTrendingMatch(visibleFixtures);

  return (
    <AppShell>
      <PageTitle
        eyebrow={`${selectedDateLabel} · ${today}`}
        title="Matchs du jour et scores en direct"
      />

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 lg:px-0">
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
              "shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold",
              active
                ? "bg-foreground text-background"
                : "bg-surface text-muted-foreground ring-1 ring-black/5 dark:ring-white/10",
            )}
          >
            {label}
          </span>
        ))}
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
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all",
                active
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted-foreground ring-1 ring-black/5 hover:text-foreground dark:ring-white/10",
              )}
            >
              {f.label}
              <span className={cn("ml-2 tabular-nums", active ? "opacity-70" : "opacity-50")}>
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

      {/* Hero banner */}
      {topMatch && (
        <div className="grid gap-4 px-4 lg:grid-cols-3 lg:gap-5 lg:px-0">
          <Link
            to="/live/$id"
            params={{ id: String(topMatch.id) }}
            className="group relative block overflow-hidden rounded-3xl bg-foreground p-5 text-background shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl lg:col-span-2 lg:p-7"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-data/40 blur-3xl transition-transform group-hover:scale-110" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-brand/30 blur-3xl transition-transform group-hover:scale-110" />
            <div className="relative">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand ring-1 ring-brand/30">
                <Flame className="size-3" /> Trending
              </div>
              <h2 className="text-[22px] font-black leading-tight tracking-tight lg:text-3xl">
                {topMatch.home.name} <span className="text-muted-foreground">vs</span>{" "}
                {topMatch.away.name}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-background/70 lg:text-sm">
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
                <div className="text-3xl font-black tabular-nums">
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
            className="hidden overflow-hidden rounded-3xl bg-brand/10 p-6 ring-1 ring-brand/20 transition-all hover:bg-brand/15 lg:flex lg:flex-col lg:justify-between"
          >
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                <Sparkles className="size-3" /> Prédictions
              </div>

              <h3 className="text-xl font-black leading-tight tracking-tight">
                Analysez deux équipes de votre choix
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Probabilités 1X2, marchés recommandés et facteurs clés — instantanément.
              </p>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 text-xs font-black text-brand">
              Lancer une analyse <ChevronRight className="size-4" />
            </div>
          </Link>
        </div>
      )}

      {/* Grouped matches */}
      <div className="mt-8 space-y-6 px-4 lg:px-0">
        {isError ? (
          <div className="animate-score-pop rounded-xl border border-alert/30 bg-alert/5 p-4 text-center text-sm text-muted-foreground">
            Les scores du jour sont momentanément indisponibles. Vous pouvez consulter les analyses
            et les guides pendant la prochaine actualisation.
            <button
              type="button"
              onClick={() => void refetch()}
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
