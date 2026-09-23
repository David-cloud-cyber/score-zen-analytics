import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarDays, Globe2, Loader2, Search, Trophy } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { competitionPath, competitionSlug, FEATURED_COMPETITIONS } from "@/data/competitions";
import { track } from "@/lib/analytics";
import { getCountries, getLeagues, getSeasons, type LeagueRow } from "@/lib/football.functions";
import { breadcrumbSchema, buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/championnats")({
  head: () => ({
    ...buildRouteMeta({
      path: "/championnats",
      title: "Championnats de football : matchs, classements et buteurs",
      description:
        "Consultez les compétitions de football, les matchs à venir, les derniers résultats, les classements et les buteurs avec les données disponibles.",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "Accueil", path: "/" },
            { name: "Championnats", path: "/championnats" },
          ]),
        ),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Championnats de football",
          description: "Répertoire des compétitions de football suivies par LiveFoot.",
          mainEntity: {
            "@type": "ItemList",
            itemListElement: FEATURED_COMPETITIONS.map((competition, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: competition.name,
              url: `https://www.livefoot.fun${competitionPath(competition)}`,
            })),
          },
        }),
      },
    ],
  }),
  loader: () => getLeagues({ data: { current: true } }),
  component: ChampionshipsPage,
});

const REGIONS = [
  "Tous",
  "Angleterre",
  "Espagne",
  "Italie",
  "France",
  "Allemagne",
  "Europe",
  "Afrique",
];

function ChampionshipsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const initialLeagues = Route.useLoaderData();
  const loadLeagues = useServerFn(getLeagues);
  const loadCountries = useServerFn(getCountries);
  const loadSeasons = useServerFn(getSeasons);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("Tous");
  const [season, setSeason] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const isSearching = deferredQuery.length >= 2;

  const leaguesQuery = useQuery({
    queryKey: [
      "championship-directory",
      isSearching ? deferredQuery.toLowerCase() : "current",
      season,
    ],
    queryFn: () =>
      loadLeagues({
        data: isSearching
          ? { search: deferredQuery }
          : season
            ? { season: Number(season) }
            : { current: true },
      }),
    initialData: isSearching || season ? undefined : initialLeagues,
    staleTime: 60 * 60_000,
    retry: 1,
  });
  const countriesQuery = useQuery({
    queryKey: ["football-countries"],
    queryFn: () => loadCountries(),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });
  const seasonsQuery = useQuery({
    queryKey: ["football-seasons"],
    queryFn: () => loadSeasons(),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    track("championship_directory_view", { location: "championship_directory" });
  }, []);

  useEffect(() => {
    if (isSearching) track("championship_search", { query_length: deferredQuery.length });
  }, [deferredQuery, isSearching]);

  const leagues = useMemo(() => {
    const values = leaguesQuery.data ?? [];
    return values
      .filter((league) => country === "Tous" || countryMatches(league, country))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .slice(0, 72);
  }, [country, leaguesQuery.data]);
  const featuredLeagues = useMemo(() => {
    // Les cartes éditoriales conservent un ordre utile, mais leurs noms, pays
    // et logos proviennent de la réponse API-Football déjà chargée pour le
    // répertoire. Aucun logo local ou valeur fictive n'est injecté.
    const available = leaguesQuery.data ?? initialLeagues;
    return FEATURED_COMPETITIONS.map((featured) => {
      const fromApi = available.find((league) => league.id === featured.id);
      return (
        fromApi ?? {
          ...featured,
          type: "League",
          logo: "",
          countryCode: null,
          seasons: [],
        }
      );
    });
  }, [initialLeagues, leaguesQuery.data]);
  const hasDirectoryData = (leaguesQuery.data?.length ?? 0) > 0;

  if (pathname !== "/championnats") return <Outlet />;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-0">
        <header className="overflow-hidden rounded-2xl border border-border/70 bg-card p-5 sm:rounded-3xl sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                <Trophy className="size-3.5" /> Football mondial
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
                Championnats de football
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Trouvez une compétition puis consultez les rencontres, le classement et les
                meilleurs buteurs quand les données sont disponibles.
              </p>
            </div>
            <Link
              to="/pronostics-du-jour"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 text-xs font-bold text-brand transition-colors hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <CalendarDays className="size-4" /> Pronostics du jour
            </Link>
          </div>
          <label className="relative mt-6 block">
            <span className="sr-only">Rechercher un championnat</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un championnat ou un pays"
              className="h-11 rounded-xl border-border bg-surface pl-10 text-sm"
            />
          </label>
        </header>

        {!isSearching && !season && (
          <section aria-labelledby="featured-championships">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                  À suivre
                </p>
                <h2 id="featured-championships" className="mt-1 text-xl font-bold">
                  Compétitions populaires
                </h2>
              </div>
              <Globe2 className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {featuredLeagues.map((competition) => (
                <CompetitionLink key={competition.id} league={competition} />
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="directory-results">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
                {isSearching ? "Résultats de recherche" : "Répertoire"}
              </p>
              <h2 id="directory-results" className="mt-1 text-xl font-bold">
                {isSearching
                  ? `Championnat${leagues.length > 1 ? "s" : ""} trouvé${leagues.length > 1 ? "s" : ""}`
                  : "Toutes les compétitions actives"}
              </h2>
            </div>
            <div
              className="flex max-w-full gap-2 overflow-x-auto pb-1"
              aria-label="Filtrer les compétitions par pays"
            >
              {REGIONS.map((region) => (
                <button
                  key={region}
                  type="button"
                  onClick={() => setCountry(region)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    country === region
                      ? "border-brand bg-brand text-[#06130e]"
                      : "border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground"
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
            {countriesQuery.data?.length ? (
              <label className="flex shrink-0 items-center gap-2 text-xs font-bold text-muted-foreground">
                <span className="sr-only">Pays du championnat</span>
                <select
                  value={country === "Tous" || REGIONS.includes(country) ? "" : country}
                  onChange={(event) => setCountry(event.target.value || "Tous")}
                  className="h-9 max-w-[190px] rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <option value="">Tous les pays API</option>
                  {countriesQuery.data
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
                    .map((item) => (
                      <option key={item.code ?? item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            {seasonsQuery.data?.length ? (
              <label className="flex shrink-0 items-center gap-2 text-xs font-bold text-muted-foreground">
                <span className="sr-only">Saison du championnat</span>
                <select
                  value={season}
                  onChange={(event) => setSeason(event.target.value)}
                  className="h-9 max-w-[150px] rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <option value="">Saisons disponibles</option>
                  {seasonsQuery.data
                    .slice()
                    .sort((a, b) => b - a)
                    .slice(0, 12)
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
          </div>

          {query.trim().length === 1 ? (
            <DirectoryEmpty
              title="Ajoutez encore un caractère"
              text="La recherche démarre à partir de deux caractères."
            />
          ) : leaguesQuery.isLoading ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-border/70 bg-card text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin text-brand" /> Chargement des
              compétitions
            </div>
          ) : leaguesQuery.isError ? (
            <DirectoryEmpty
              title="Le répertoire est indisponible"
              text="Réessayez dans quelques instants ou ouvrez une compétition populaire ci dessus."
            />
          ) : leagues.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {leagues.map((league) => (
                <CompetitionLink key={league.id} league={league} />
              ))}
            </div>
          ) : (
            <DirectoryEmpty
              title={
                hasDirectoryData
                  ? "Aucun championnat correspondant"
                  : "Le répertoire complet se synchronise"
              }
              text={
                hasDirectoryData
                  ? "Essayez le nom officiel de la compétition ou choisissez un autre filtre de pays."
                  : "Les compétitions populaires restent accessibles ci dessus pendant la synchronisation des autres championnats."
              }
            />
          )}
        </section>
      </main>
    </AppShell>
  );
}

function countryMatches(league: LeagueRow, filter: string) {
  const country = league.country.toLocaleLowerCase("fr");
  if (filter === "Europe") return ["europe", "world"].some((value) => country.includes(value));
  if (filter === "Afrique") {
    return [
      "cameroon",
      "cote d'ivoire",
      "senegal",
      "morocco",
      "egypt",
      "algeria",
      "south africa",
      "nigeria",
      "ghana",
      "tunisia",
    ].some((value) => country.includes(value));
  }
  return country.includes(filter.toLocaleLowerCase("fr"));
}

function CompetitionLink({ league }: { league: LeagueRow }) {
  const slug = competitionSlug(league.name, league.id);
  return (
    <Link
      to="/championnats/$slug"
      params={{ slug }}
      className="group flex min-h-20 items-center gap-3 rounded-2xl border border-border/70 bg-card p-3.5 transition-colors hover:border-brand/40 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {league.logo ? (
        <img
          src={league.logo}
          alt={`Logo ${league.name}`}
          className="size-11 shrink-0 object-contain"
          loading="lazy"
        />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <Trophy className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-foreground">{league.name}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">{league.country}</span>
      </span>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
        aria-hidden
      />
    </Link>
  );
}

function DirectoryEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-7 text-center">
      <Trophy className="mx-auto size-6 text-brand" aria-hidden />
      <h3 className="mt-3 text-sm font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
