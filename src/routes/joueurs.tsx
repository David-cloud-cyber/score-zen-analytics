import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useDeferredValue, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  FootballDirectoryHeader,
  FootballEmpty,
  FootballSection,
  PlayerCard,
} from "@/components/FootballDirectory";
import { currentSeasonYear, getPlayers } from "@/lib/football.functions";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/joueurs")({
  loader: () => getPlayers({ data: { league: 39, season: currentSeasonYear() } }),
  head: () =>
    buildRouteMeta({
      path: "/joueurs",
      title: "Joueurs de football : profils et statistiques",
      description:
        "Recherchez un joueur et consultez ses statistiques, son équipe, ses transferts, son palmarès et ses indisponibilités.",
    }),
  component: PlayersPage,
});

function PlayersPage() {
  const initial = Route.useLoaderData();
  const loadPlayers = useServerFn(getPlayers);
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const searching = deferred.length >= 2;
  const playersQuery = useQuery({
    queryKey: ["football-players", searching ? deferred.toLowerCase() : "popular"],
    queryFn: () =>
      loadPlayers({
        data: searching ? { search: deferred } : { league: 39, season: currentSeasonYear() },
      }),
    initialData: searching ? undefined : initial,
    staleTime: 60 * 60_000,
    retry: 1,
  });
  const players = playersQuery.data ?? [];
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-0">
        <FootballDirectoryHeader
          eyebrow="Données football"
          title="Trouvez un joueur et ses chiffres réels"
          description="Consultez les profils reçus par l’API Football, leurs statistiques de saison, leurs clubs et leurs mouvements connus."
          search={search}
          onSearchChange={setSearch}
          placeholder="Rechercher un joueur"
        />
        <FootballSection
          title={searching ? `Résultats pour « ${deferred} »` : "Joueurs suivis"}
          count={players.length}
        >
          {search.length === 1 ? (
            <FootballEmpty
              title="Continuez votre recherche"
              text="Saisissez au moins deux caractères pour interroger les joueurs disponibles."
            />
          ) : playersQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <PlayerSkeleton />
              <PlayerSkeleton />
              <PlayerSkeleton />
            </div>
          ) : playersQuery.isError ? (
            <FootballEmpty
              title="Les joueurs sont momentanément indisponibles"
              text="Réessayez dans quelques instants."
            />
          ) : players.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </div>
          ) : (
            <FootballEmpty title="Aucun joueur trouvé" text="Essayez le nom officiel du joueur." />
          )}
        </FootballSection>
      </main>
    </AppShell>
  );
}

function PlayerSkeleton() {
  return (
    <div className="h-20 animate-pulse rounded-2xl border border-border/70 bg-card" aria-hidden />
  );
}
