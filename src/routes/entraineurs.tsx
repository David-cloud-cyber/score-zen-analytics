import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useDeferredValue, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  CoachCard,
  FootballDirectoryHeader,
  FootballEmpty,
  FootballSection,
  TeamCard,
} from "@/components/FootballDirectory";
import { getCoaches, getTeams, type TeamRow } from "@/lib/football.functions";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/entraineurs")({
  head: () =>
    buildRouteMeta({
      path: "/entraineurs",
      title: "Entraîneurs de football : profils et carrières",
      description:
        "Sélectionnez une équipe pour consulter les entraîneurs et leur carrière selon les données publiées par l’API Football.",
    }),
  component: CoachesPage,
});

function CoachesPage() {
  const searchTeams = useServerFn(getTeams);
  const loadCoaches = useServerFn(getCoaches);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TeamRow | null>(null);
  const deferred = useDeferredValue(search.trim());
  const teamsQuery = useQuery({
    queryKey: ["football-coach-teams", deferred.toLowerCase()],
    queryFn: () => searchTeams({ data: { search: deferred } }),
    enabled: deferred.length >= 2,
    staleTime: 60 * 60_000,
    retry: 1,
  });
  const coachesQuery = useQuery({
    queryKey: ["football-coaches", selected?.id],
    queryFn: () => loadCoaches({ data: { team: selected!.id } }),
    enabled: Boolean(selected),
    staleTime: 60 * 60_000,
    retry: 1,
  });
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-0">
        <FootballDirectoryHeader
          eyebrow="Données football"
          title="Retrouvez les entraîneurs par équipe"
          description="L’API Football fournit les entraîneurs à partir d’une équipe. Recherchez une équipe puis ouvrez le profil réel disponible."
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            if (!value.trim()) setSelected(null);
          }}
          placeholder="Rechercher une équipe pour voir son entraîneur"
        />
        {selected ? (
          <section className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand">
                  Équipe sélectionnée
                </p>
                <p className="mt-1 text-sm font-black">{selected.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                Changer
              </button>
            </div>
          </section>
        ) : null}
        <FootballSection
          title={selected ? "Entraîneur(s) reçu(s)" : "Sélectionnez une équipe"}
          count={selected ? (coachesQuery.data?.length ?? 0) : (teamsQuery.data?.length ?? 0)}
        >
          {!selected ? (
            search.length < 2 ? (
              <FootballEmpty
                icon={<TeamCardPlaceholder />}
                title="Commencez par une équipe"
                text="Saisissez au moins deux caractères pour rechercher dans les équipes disponibles."
              />
            ) : teamsQuery.isLoading ? (
              <LoadingBlock />
            ) : teamsQuery.isError ? (
              <FootballEmpty
                title="Recherche indisponible"
                text="Réessayez dans quelques instants."
              />
            ) : teamsQuery.data?.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teamsQuery.data.map((team) => (
                  <TeamCard key={team.id} team={team} onSelect={() => setSelected(team)} />
                ))}
              </div>
            ) : (
              <FootballEmpty title="Aucune équipe trouvée" text="Essayez un nom officiel." />
            )
          ) : coachesQuery.isLoading ? (
            <LoadingBlock />
          ) : coachesQuery.isError ? (
            <FootballEmpty
              title="Entraîneur indisponible"
              text="Les données de l’équipe sont momentanément indisponibles."
            />
          ) : coachesQuery.data?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {coachesQuery.data.map((coach) => (
                <CoachCard key={coach.id} coach={coach} />
              ))}
            </div>
          ) : (
            <FootballEmpty
              title="Aucun entraîneur publié"
              text="Le fournisseur n’a pas renvoyé d’entraîneur pour cette équipe."
            />
          )}
        </FootballSection>
      </main>
    </AppShell>
  );
}

function LoadingBlock() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="h-24 animate-pulse rounded-2xl bg-card" />
      <div className="h-24 animate-pulse rounded-2xl bg-card" />
      <div className="h-24 animate-pulse rounded-2xl bg-card" />
    </div>
  );
}
function TeamCardPlaceholder() {
  return <span className="text-brand">⚽</span>;
}
