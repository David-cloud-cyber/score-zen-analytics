import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Sparkles, ChevronRight, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { RemoteMatchCard } from "@/components/RemoteMatchCard";
import { getFixtures } from "@/lib/football.functions";
import { buildRouteMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/PageSkeleton";

const fixturesQuery = (mode: "today" | "live") =>
  queryOptions({
    queryKey: ["fixtures", mode],
    queryFn: () => getFixtures({ data: mode === "live" ? { live: true } : {} }),
    staleTime: mode === "live" ? 30_000 : 5 * 60_000,
    refetchInterval: mode === "live" ? 30_000 : false,
    retry: 1,
  });

export const Route = createFileRoute("/")({
  head: () =>
    buildRouteMeta({
      path: "/",
      title: "Matchs du jour & scores en direct",
      description:
        "Suivez tous les matchs du jour en direct : Ligue 1, Liga, Premier League, Ligue des champions. Scores, compos et analyses IA.",
    }),
  loader: ({ context }) => {
    // Best-effort prefetch — never crash the page on API errors.
    context.queryClient.ensureQueryData(fixturesQuery("today")).catch(() => {});
  },
  pendingComponent: PageSkeleton,
  pendingMs: 0,
  errorComponent: HomeError,
  component: HomePage,
});

function HomeError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <AppShell>
      <div className="mx-4 mt-8 rounded-2xl border border-alert/30 bg-alert/5 p-6 text-center lg:mx-0">
        <AlertTriangle className="mx-auto size-6 text-alert" aria-hidden />
        <h2 className="mt-3 text-base font-black">Données football indisponibles</h2>
        <p className="mt-1 text-sm text-muted-foreground">{error.message || "Réessayez dans un instant."}</p>
        <button
          onClick={reset}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background"
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

function HomePage() {
  const { data: fixtures, isFetching } = useSuspenseQuery(fixturesQuery("today"));
  const hasLive = fixtures.some((m) => m.status === "live" || m.status === "ht");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>(hasLive ? "live" : "upcoming");

  const filtered = fixtures.filter((m) =>
    filter === "live" ? m.status === "live" || m.status === "ht" : m.status === filter,
  );

  // Group by league name
  const groupedMap = new Map<number, { name: string; logo: string; country: string; matches: typeof fixtures }>();
  for (const m of filtered) {
    const g = groupedMap.get(m.league.id) ?? { name: m.league.name, logo: m.league.logo, country: m.league.country, matches: [] };
    g.matches.push(m);
    groupedMap.set(m.league.id, g);
  }
  const grouped = Array.from(groupedMap.values());
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

  const topMatch = fixtures.find((m) => m.status === "live" || m.status === "ht") ?? fixtures[0];

  return (
    <AppShell>
      <PageTitle
        eyebrow={`Aujourd'hui · ${today}`}
        title="Matchs du jour"
      />

      {/* Filter pills */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 lg:px-0">
        {FILTERS.map((f) => {
          const count = fixtures.filter((m) =>
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
              <span className={cn("ml-2 tabular-nums", active ? "opacity-70" : "opacity-50")}>{count}</span>
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
                <Sparkles className="size-3" /> Match du jour
              </div>
              <h2 className="text-[22px] font-black leading-tight tracking-tight lg:text-3xl">
                {topMatch.home.name} <span className="text-muted-foreground">vs</span> {topMatch.away.name}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-background/70 lg:text-sm">
                {topMatch.league.name} · {topMatch.venue ?? topMatch.dayLabel} · Coup d'envoi {topMatch.timeLabel}.
              </p>
              <div className="mt-4 flex items-center gap-4">
                <img src={topMatch.home.logo} alt="" className="size-10 object-contain" />
                <div className="text-3xl font-black tabular-nums">
                  {topMatch.homeScore ?? "—"}<span className="mx-2 text-background/40">·</span>{topMatch.awayScore ?? "—"}
                </div>
                <img src={topMatch.away.logo} alt="" className="size-10 object-contain" />

              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold">
                <span>Voir la fiche complète</span>
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>

          <Link
            to="/analyse"
            className="hidden overflow-hidden rounded-3xl bg-brand/10 p-6 ring-1 ring-brand/20 transition-all hover:bg-brand/15 lg:flex lg:flex-col lg:justify-between"
          >
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                <Sparkles className="size-3" /> Comparateur
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
        {grouped.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {filter === "live"
              ? "Aucun match en direct pour le moment."
              : filter === "upcoming"
                ? "Aucun match à venir aujourd'hui."
                : "Aucun match terminé aujourd'hui."}
          </div>
        )}
        {grouped.map((g) => (
          <section key={g.name}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={g.logo} alt="" className="size-4 object-contain" />
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
          className="flex items-center justify-between rounded-2xl bg-brand/10 p-4 ring-1 ring-brand/20 transition-transform active:scale-[0.99]"
        >
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-brand">Comparateur</div>
            <div className="mt-1 text-sm font-bold">Analyser deux équipes de votre choix</div>
          </div>
          <div className="grid size-10 place-items-center rounded-full bg-brand text-brand-foreground">
            <ChevronRight className="size-4" />
          </div>
        </Link>
      </div>
    </AppShell>
  );
}
