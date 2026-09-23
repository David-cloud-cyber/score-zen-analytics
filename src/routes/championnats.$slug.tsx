import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleAlert,
  ListOrdered,
  RefreshCw,
  ShieldCheck,
  Trophy,
  UserRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { RemoteMatchCard } from "@/components/RemoteMatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { competitionIdFromSlug } from "@/data/competitions";
import {
  getCompetitionOverview,
  type CompetitionOverview,
  type StandingRow,
  type TopScorer,
} from "@/lib/football.functions";
import { breadcrumbSchema, buildRouteMeta } from "@/lib/seo";

type ChampionshipSearch = { season?: number };

export const Route = createFileRoute("/championnats/$slug")({
  validateSearch: (search: Record<string, unknown>): ChampionshipSearch => {
    const value = Number(search.season);
    return {
      season: Number.isInteger(value) && value >= 1900 && value <= 2200 ? value : undefined,
    };
  },
  loaderDeps: ({ search }) => ({ season: search.season }),
  loader: ({ params, deps }) => {
    const league = competitionIdFromSlug(params.slug);
    if (!league) throw notFound();
    return getCompetitionOverview({ data: { league, season: deps.season } });
  },
  head: ({ params, loaderData }) => {
    const data = loaderData as CompetitionOverview | undefined;
    const competition = data?.competition;
    const path = `/championnats/${params.slug}`;
    const title = competition
      ? `${competition.name} : matchs, classement et buteurs`
      : "Compétition de football";
    const description = competition
      ? `Suivez ${competition.name} : rencontres, résultats, classement et meilleurs buteurs avec les données disponibles.`
      : "Cette compétition sera disponible dès que les données réelles seront reçues.";
    const base = buildRouteMeta({ path, title, description, noindex: !competition });
    return {
      ...base,
      scripts: competition
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: competition.name,
                description,
                url: `https://www.livefoot.fun${path}`,
                inLanguage: "fr",
                isAccessibleForFree: true,
                breadcrumb: breadcrumbSchema([
                  { name: "Accueil", path: "/" },
                  { name: "Championnats", path: "/championnats" },
                  { name: competition.name, path },
                ]),
              }),
            },
          ]
        : undefined,
    };
  },
  component: CompetitionPage,
});

type CompetitionTab = "matches" | "standings" | "scorers";

function CompetitionPage() {
  const initial = Route.useLoaderData();
  const { slug } = Route.useParams();
  const { season: requestedSeason } = Route.useSearch();
  const league = competitionIdFromSlug(slug);
  const reload = useServerFn(getCompetitionOverview);
  const [tab, setTab] = useState<CompetitionTab>("matches");
  const overview = useQuery({
    queryKey: ["competition-overview", league, requestedSeason ?? "active"],
    queryFn: () => reload({ data: { league: league!, season: requestedSeason } }),
    initialData: initial,
    staleTime: 60_000,
    retry: 1,
  });
  const data = overview.data ?? initial;
  const competition = data.competition;

  if (!competition) {
    return (
      <AppShell>
        <main className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center px-4 py-8 sm:px-6 lg:px-0">
          <section className="w-full rounded-2xl border border-border/70 bg-card p-7 text-center">
            <CircleAlert className="mx-auto size-7 text-brand" aria-hidden />
            <h1 className="mt-3 text-xl font-bold">
              Cette compétition est indisponible pour le moment
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Les informations de la compétition ne sont pas encore disponibles. Aucun résultat
              n’est affiché à la place.
            </p>
            <Link
              to="/championnats"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-xs font-bold text-[#06130e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ArrowLeft className="size-4" /> Voir les championnats
            </Link>
          </section>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-0">
        <Link
          to="/championnats"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-brand"
        >
          <ArrowLeft className="size-3.5" /> Tous les championnats
        </Link>

        <header className="rounded-2xl border border-border/70 bg-card p-4 sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              {competition.logo ? (
                <img
                  src={competition.logo}
                  alt={`Logo ${competition.name}`}
                  className="size-14 shrink-0 object-contain sm:size-16"
                />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand sm:size-16">
                  <Trophy className="size-7" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                  {competition.country}
                </p>
                <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">
                  {competition.name}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Saison {competition.season} · {competition.type}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => overview.refetch()}
              disabled={overview.isFetching}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-bold text-foreground transition-colors hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-70"
            >
              <RefreshCw className={`size-3.5 ${overview.isFetching ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          </div>
          {competition.seasons.length > 0 && (
            <label className="mt-4 flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <span>Saison consultée</span>
              <select
                value={String(competition.season)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isInteger(next)) return;
                  window.location.assign(
                    `/championnats/${slug}?season=${encodeURIComponent(String(next))}`,
                  );
                }}
                className="h-9 rounded-xl border border-border bg-surface px-3 text-xs font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {competition.seasons
                  .slice()
                  .sort((a, b) => b.year - a.year)
                  .map((item) => (
                    <option key={item.year} value={item.year}>
                      {item.year}
                      {item.current ? " · actuelle" : ""}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {data.unavailableSections.length > 0 && (
            <p className="mt-4 rounded-xl border border-border/70 bg-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Certaines informations de cette compétition arrivent encore. Les données déjà
              disponibles restent affichées.
            </p>
          )}
        </header>

        <Tabs value={tab} onValueChange={(value) => setTab(value as CompetitionTab)}>
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card p-1.5">
            <TabsTrigger value="matches" className="h-9 shrink-0 gap-1.5 px-3 text-xs font-bold">
              <CalendarDays className="size-3.5" /> Matchs
            </TabsTrigger>
            <TabsTrigger value="standings" className="h-9 shrink-0 gap-1.5 px-3 text-xs font-bold">
              <ListOrdered className="size-3.5" /> Classement
            </TabsTrigger>
            <TabsTrigger value="scorers" className="h-9 shrink-0 gap-1.5 px-3 text-xs font-bold">
              <UserRound className="size-3.5" /> Buteurs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="mt-5 space-y-6">
            <MatchesSection
              title="En direct"
              matches={data.live}
              empty="Aucun match en direct n’est confirmé pour le moment."
              live
            />
            <MatchesSection
              title="Matchs à venir"
              matches={data.upcoming}
              empty="Les prochaines rencontres vérifiées s’afficheront ici."
            />
            <MatchesSection
              title="Derniers résultats"
              matches={data.results}
              empty="Les derniers résultats vérifiés s’afficheront ici."
            />
            <Link
              to="/pronostics-du-jour"
              className="flex items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-brand/[0.06] p-4 transition-colors hover:bg-brand/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span>
                <span className="block text-sm font-bold">Voir les pronostics du jour</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Les sélections ne sont publiées que lorsque les données sont suffisantes.
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-brand" />
            </Link>
          </TabsContent>

          <TabsContent value="standings" className="mt-5">
            <StandingsTable standings={data.standings} />
          </TabsContent>

          <TabsContent value="scorers" className="mt-5">
            <TopScorers scorers={data.topScorers} />
          </TabsContent>
        </Tabs>

        <footer className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-brand" />
          Dernière synchronisation :{" "}
          {new Date(data.fetchedAt).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </footer>
      </main>
    </AppShell>
  );
}

function MatchesSection({
  title,
  matches,
  empty,
  live = false,
}: {
  title: string;
  matches: CompetitionOverview["upcoming"];
  empty: string;
  live?: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {live && <span className="size-2 rounded-full bg-brand" aria-hidden />}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {matches.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {matches.map((match) => (
            <RemoteMatchCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <DataEmpty icon={<CalendarDays className="size-5" />} message={empty} />
      )}
    </section>
  );
}

function StandingsTable({ standings }: { standings: StandingRow[] }) {
  if (!standings.length)
    return (
      <DataEmpty
        icon={<ListOrdered className="size-5" />}
        message="Le classement officiel n’est pas encore publié pour cette compétition. Les matchs disponibles restent affichés."
      />
    );
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-lg font-bold">Classement</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[660px] w-full text-left text-xs">
          <thead className="bg-surface text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-bold">#</th>
              <th className="px-3 py-3 font-bold">Équipe</th>
              <th className="px-2 py-3 text-center font-bold">J</th>
              <th className="px-2 py-3 text-center font-bold">V</th>
              <th className="px-2 py-3 text-center font-bold">N</th>
              <th className="px-2 py-3 text-center font-bold">D</th>
              <th className="px-2 py-3 text-center font-bold">BP</th>
              <th className="px-2 py-3 text-center font-bold">BC</th>
              <th className="px-2 py-3 text-center font-bold">Diff.</th>
              <th className="px-3 py-3 text-right font-bold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.teamId}
                className="border-t border-border/50 text-foreground hover:bg-surface/70"
              >
                <td className="px-3 py-3 font-bold text-muted-foreground">{row.rank}</td>
                <td className="px-3 py-3">
                  <span className="flex min-w-[180px] items-center gap-2">
                    <img src={row.logo} alt="" className="size-5 object-contain" loading="lazy" />
                    <a
                      href={`/equipes/${row.teamId}`}
                      className="truncate font-bold hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {row.team}
                    </a>
                  </span>
                </td>
                <StatCell value={row.played} />
                <StatCell value={row.win} />
                <StatCell value={row.draw} />
                <StatCell value={row.lose} />
                <StatCell value={row.goalsFor} />
                <StatCell value={row.goalsAgainst} />
                <StatCell value={row.gd > 0 ? `+${row.gd}` : row.gd} />
                <td className="px-3 py-3 text-right font-bold text-brand">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatCell({ value }: { value: number | string }) {
  return <td className="px-2 py-3 text-center tabular-nums">{value}</td>;
}

function TopScorers({ scorers }: { scorers: TopScorer[] }) {
  if (!scorers.length)
    return (
      <DataEmpty
        icon={<UserRound className="size-5" />}
        message="Les statistiques des meilleurs buteurs ne sont pas encore publiées pour cette compétition."
      />
    );
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-lg font-bold">Meilleurs buteurs</h2>
      </div>
      <ol className="divide-y divide-border/60">
        {scorers.map((scorer) => (
          <li key={scorer.playerId} className="flex items-center gap-3 px-4 py-3">
            <span className="w-5 text-center text-xs font-bold text-muted-foreground">
              {scorer.rank}
            </span>
            <img
              src={scorer.photo}
              alt=""
              className="size-9 rounded-full bg-surface object-cover"
              loading="lazy"
            />
            <span className="min-w-0 flex-1">
              <a
                href={`/joueurs/${scorer.playerId}`}
                className="block truncate text-sm font-bold hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {scorer.name}
              </a>
              <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                {scorer.teamLogo ? (
                  <img
                    src={scorer.teamLogo}
                    alt=""
                    className="size-3.5 object-contain"
                    loading="lazy"
                  />
                ) : null}
                {scorer.team}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-base font-bold text-brand">{scorer.goals}</span>
              <span className="block text-[10px] text-muted-foreground">
                but{scorer.goals > 1 ? "s" : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DataEmpty({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 text-center">
      <span className="mx-auto grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
        {icon}
      </span>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
