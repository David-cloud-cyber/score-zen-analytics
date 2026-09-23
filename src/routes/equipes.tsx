import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  FootballDirectoryHeader,
  FootballEmpty,
  FootballSection,
  TeamCard,
} from "@/components/FootballDirectory";
import { currentSeasonYear, getTeams } from "@/lib/football.functions";
import { buildRouteMeta } from "@/lib/seo";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/equipes")({
  loader: () => getTeams({ data: { league: 39, season: currentSeasonYear() } }),
  head: () =>
    buildRouteMeta({
      path: "/equipes",
      title: "Équipes de football : recherche et statistiques",
      description:
        "Recherchez une équipe de football et consultez ses matchs, son effectif, sa forme, ses statistiques, ses absents et son palmarès.",
    }),
  component: TeamsDirectoryPage,
});

function TeamsDirectoryPage() {
  const initial = Route.useLoaderData();
  const loadTeams = useServerFn(getTeams);
  const [search, setSearch] = useState("");
  const deferredInput = useDeferredValue(search.trim());
  const [deferredSearch, setDeferredSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDeferredSearch(deferredInput), 350);
    return () => window.clearTimeout(timer);
  }, [deferredInput]);
  const searching = deferredSearch.length >= 3;
  const teamsQuery = useQuery({
    queryKey: ["football-teams", searching ? deferredSearch.toLowerCase() : "popular"],
    queryFn: () =>
      loadTeams({
        data: searching
          ? { search: deferredSearch }
          : { league: 39, season: currentSeasonYear() },
      }),
    initialData: searching ? undefined : initial,
    staleTime: 60 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    document.title = searching
      ? `Équipes correspondant à ${deferredSearch} · LiveFoot IA`
      : "Équipes de football · LiveFoot IA";
  }, [deferredSearch, searching]);

  const teams = teamsQuery.data ?? [];
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-0">
        <FootballDirectoryHeader
          eyebrow="Données football"
          title="Explorez les équipes qui vous intéressent"
          description="Recherchez une équipe et retrouvez ses matchs réels, son effectif, sa forme, ses statistiques et les informations publiées par l’API Football."
          search={search}
          onSearchChange={setSearch}
          placeholder="Rechercher une équipe"
        />
        <FootballSection
          title={searching ? `Résultats pour « ${deferredSearch} »` : "Équipes populaires"}
          count={teams.length}
        >
          {search.trim().length > 0 && !searching ? (
            <FootballEmpty
              title="Continuez votre recherche"
              text="Saisissez au moins trois caractères pour interroger les équipes disponibles."
            />
          ) : teamsQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <TeamSkeleton />
              <TeamSkeleton />
              <TeamSkeleton />
            </div>
          ) : teamsQuery.isError ? (
            <FootballEmpty
              title="Les équipes sont momentanément indisponibles"
              text="Réessayez dans quelques instants. Les données affichées proviennent uniquement du fournisseur football configuré."
            />
          ) : teams.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          ) : (
            <FootballEmpty
              title="Aucune équipe trouvée"
              text="Essayez le nom officiel d’une équipe."
            />
          )}
        </FootballSection>
      </main>
    </AppShell>
  );
}

function TeamSkeleton() {
  return (
    <div className="h-24 animate-pulse rounded-2xl border border-border/70 bg-card" aria-hidden />
  );
}
