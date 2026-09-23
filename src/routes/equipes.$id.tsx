import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ClipboardList,
  RefreshCw,
  ShieldAlert,
  Trophy,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FootballEmpty, PlayerCard, CoachCard, TrophyList } from "@/components/FootballDirectory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTeamOverview, type TeamFormMatch, type TeamOverview } from "@/lib/football.functions";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/equipes/$id")({
  loader: ({ params }) => getTeamOverview({ data: { team: Number(params.id) } }),
  head: ({ params, loaderData }) => {
    const team = (loaderData as TeamOverview | undefined)?.team;
    const name = team?.name ?? "Équipe de football";
    return buildRouteMeta({
      path: `/equipes/${params.id}`,
      title: `${name} : matchs, effectif et statistiques`,
      description: `Retrouvez les matchs, la forme, l’effectif, les absences, les transferts et les statistiques disponibles de ${name}.`,
      noindex: !team,
    });
  },
  component: TeamPage,
});

type TeamTab = "overview" | "matches" | "squad" | "stats" | "transfers" | "trophies" | "absences";

function TeamPage() {
  const initial = Route.useLoaderData();
  const { id } = Route.useParams();
  const reload = useServerFn(getTeamOverview);
  const [tab, setTab] = useState<TeamTab>("overview");
  const teamQuery = useQuery({
    queryKey: ["football-team-overview", Number(id)],
    queryFn: () => reload({ data: { team: Number(id) } }),
    initialData: initial,
    staleTime: 60_000,
    retry: 1,
  });
  const data = teamQuery.data ?? initial;
  if (!data.team) {
    return (
      <AppShell>
        <main className="mx-auto flex min-h-[50vh] w-full max-w-3xl items-center px-4 py-8 lg:px-0">
          <FootballEmpty
            title="Cette équipe est indisponible"
            text="Aucune fiche réelle n’a été reçue pour cet identifiant."
          />
        </main>
      </AppShell>
    );
  }
  const team = data.team;
  const absenceCount = data.sidelined.length + data.injuries.length;
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-0">
        <Link
          to="/equipes"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowLeft className="size-3.5" /> Toutes les équipes
        </Link>
        <header className="rounded-2xl border border-border/70 bg-card p-5 sm:rounded-3xl sm:p-7">
          <div className="flex items-center gap-4">
            {team.logo ? (
              <img
                src={team.logo}
                alt={`Logo ${team.name}`}
                className="size-16 object-contain sm:size-20"
              />
            ) : (
              <span className="grid size-16 place-items-center rounded-2xl bg-brand/10 text-brand">
                <UsersRound className="size-7" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand">
                {team.country || "Football"}
              </p>
              <h1 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-4xl">
                {team.name}
              </h1>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {[team.code, team.venue?.name, team.venue?.city].filter(Boolean).join(" · ") ||
                  "Fiche équipe issue des données disponibles"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void teamQuery.refetch()}
              disabled={teamQuery.isFetching}
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface text-muted-foreground hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
              aria-label="Actualiser la fiche équipe"
            >
              <RefreshCw className={teamQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
            </button>
          </div>
          {data.league && (
            <p className="mt-4 text-xs text-muted-foreground">
              Compétition de référence :{" "}
              <span className="font-bold text-foreground">{data.league.name}</span> · saison{" "}
              {data.league.season}
            </p>
          )}
        </header>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TeamTab)}>
          <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card p-1.5">
            <TabsTrigger value="overview" className="h-9 shrink-0 px-3 text-xs font-bold">
              Résumé
            </TabsTrigger>
            <TabsTrigger value="matches" className="h-9 shrink-0 px-3 text-xs font-bold">
              Matchs
            </TabsTrigger>
            <TabsTrigger value="squad" className="h-9 shrink-0 px-3 text-xs font-bold">
              Effectif
            </TabsTrigger>
            <TabsTrigger value="stats" className="h-9 shrink-0 px-3 text-xs font-bold">
              Statistiques
            </TabsTrigger>
            <TabsTrigger value="transfers" className="h-9 shrink-0 px-3 text-xs font-bold">
              Transferts
            </TabsTrigger>
            <TabsTrigger value="trophies" className="h-9 shrink-0 px-3 text-xs font-bold">
              Palmarès
            </TabsTrigger>
            <TabsTrigger value="absences" className="h-9 shrink-0 px-3 text-xs font-bold">
              Absences
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <TeamFormCard
                title="Derniers matchs"
                matches={data.recent.slice(0, 5)}
                empty="Aucun résultat récent reçu."
              />
              <TeamFormCard
                title="Prochains matchs"
                matches={data.upcoming.slice(0, 5)}
                empty="Aucun prochain match reçu."
                upcoming
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <StatTile label="Effectif reçu" value={String(data.squad.length)} detail="joueurs" />
              <StatTile
                label="Absences suivies"
                value={String(absenceCount)}
                detail="données publiées"
              />
              <StatTile
                label="Palmarès"
                value={String(data.trophies.length)}
                detail="entrées reçues"
              />
            </div>
            {data.coaches.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-black">Entraîneur</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.coaches.slice(0, 2).map((coach) => (
                    <CoachCard key={coach.id} coach={coach} />
                  ))}
                </div>
              </section>
            )}
          </TabsContent>
          <TabsContent value="matches" className="mt-5 space-y-5">
            <TeamFormCard
              title="Prochains matchs"
              matches={data.upcoming}
              empty="Aucun prochain match reçu."
              upcoming
            />
            <TeamFormCard
              title="Derniers résultats"
              matches={data.recent}
              empty="Aucun résultat récent reçu."
            />
          </TabsContent>
          <TabsContent value="squad" className="mt-5 space-y-5">
            {data.squad.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.squad.map((player) => (
                  <PlayerCard key={player.id} player={player} />
                ))}
              </div>
            ) : (
              <FootballEmpty
                icon={<UsersRound className="size-5" />}
                title="Effectif non disponible"
                text="Les joueurs de cette équipe ne sont pas encore publiés par le fournisseur."
              />
            )}
            {data.coaches.length ? (
              <section>
                <h2 className="mb-3 text-lg font-black">Entraîneurs</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.coaches.map((coach) => (
                    <CoachCard key={coach.id} coach={coach} />
                  ))}
                </div>
              </section>
            ) : null}
          </TabsContent>
          <TabsContent value="stats" className="mt-5">
            <TeamStatistics data={data} />
          </TabsContent>
          <TabsContent value="transfers" className="mt-5">
            <TransferList transfers={data.transfers} />
          </TabsContent>
          <TabsContent value="trophies" className="mt-5">
            <TrophyList trophies={data.trophies} />
          </TabsContent>
          <TabsContent value="absences" className="mt-5">
            <AbsenceList data={data} />
          </TabsContent>
        </Tabs>
        <footer className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-[11px] text-muted-foreground">
          <ShieldAlert className="size-3.5 shrink-0 text-brand" /> Données mises à jour selon les
          publications disponibles du fournisseur.
        </footer>
      </main>
    </AppShell>
  );
}

function TeamFormCard({
  title,
  matches,
  empty,
  upcoming = false,
}: {
  title: string;
  matches: TeamFormMatch[];
  empty: string;
  upcoming?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <CalendarDays className="size-4 text-brand" />
        <h2 className="text-sm font-black">{title}</h2>
      </div>
      {matches.length ? (
        <ul className="divide-y divide-border/60">
          {matches.map((match) => (
            <li key={match.id}>
              <a
                href={`/live/${match.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-[10px] font-black text-muted-foreground">
                  {upcoming
                    ? "→"
                    : match.result === "W"
                      ? "V"
                      : match.result === "L"
                        ? "D"
                        : match.result === "D"
                          ? "N"
                          : "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">
                    {match.home ? `vs ${match.opponent}` : `@ ${match.opponent}`}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {match.competition} · {match.date}
                  </span>
                </span>
                <span className="text-xs font-black tabular-nums">
                  {match.goalsFor ?? "—"} · {match.goalsAgainst ?? "—"}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-5 text-center text-xs text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-brand">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function TeamStatistics({ data }: { data: TeamOverview }) {
  const stats = data.statistics;
  if (!stats)
    return (
      <FootballEmpty
        icon={<BarChart3 className="size-5" />}
        title="Statistiques non disponibles"
        text="Les statistiques saisonnières n’ont pas été publiées pour cette équipe et cette compétition."
      />
    );
  const values = [
    ["Forme", stats.form || "—"],
    ["Matchs joués", stats.played.total ?? "—"],
    ["Victoires", stats.wins.total ?? "—"],
    ["Nuls", stats.draws.total ?? "—"],
    ["Défaites", stats.loses.total ?? "—"],
    ["Buts par match", stats.goalsForAverage.total ?? "—"],
    ["Buts encaissés par match", stats.goalsAgainstAverage.total ?? "—"],
    ["Sans encaisser", stats.cleanSheets.total ?? "—"],
    ["Sans marquer", stats.failedToScore.total ?? "—"],
  ];
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-4 text-brand" />
        <h2 className="text-sm font-black">Statistiques de saison</h2>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {values.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-base font-black">{String(value)}</p>
          </div>
        ))}
      </div>
      {stats.lineups.length ? (
        <div className="mt-4">
          <h3 className="text-xs font-black">Formations utilisées</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {stats.lineups.map((lineup) => (
              <span
                key={lineup.formation}
                className="rounded-full border border-border px-3 py-1 text-xs font-bold"
              >
                {lineup.formation} · {lineup.played ?? "—"}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TransferList({ transfers }: { transfers: TeamOverview["transfers"] }) {
  if (!transfers.length)
    return (
      <FootballEmpty
        icon={<ArrowLeft className="size-5" />}
        title="Transferts non disponibles"
        text="Aucun mouvement réel n’a été reçu pour cette équipe."
      />
    );
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <ul className="divide-y divide-border/60">
        {transfers.slice(0, 60).map((transfer, index) => (
          <li
            key={`${transfer.playerId}-${transfer.date}-${index}`}
            className="flex items-center gap-3 px-4 py-3"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              →
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{transfer.player}</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {transfer.date ?? "Date non publiée"} · {transfer.type ?? "Mouvement"}
              </span>
            </span>
            <span className="max-w-[42%] text-right text-[11px] font-bold text-muted-foreground">
              {transfer.teams.out?.name ?? "—"} → {transfer.teams.in?.name ?? "—"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AbsenceList({ data }: { data: TeamOverview }) {
  const rows = [
    ...data.sidelined.map((item) => ({
      id: `s-${item.playerId}-${item.start}`,
      name: item.player,
      detail: item.type,
      date: item.end,
    })),
    ...data.injuries.map((item) => ({
      id: `i-${item.playerId}-${item.fixtureId}`,
      name: item.name,
      detail: item.reason || item.type,
      date: null,
    })),
  ];
  if (!rows.length)
    return (
      <FootballEmpty
        icon={<ClipboardList className="size-5" />}
        title="Aucune absence publiée"
        text="Aucune absence ou indisponibilité n’a été reçue pour cette équipe."
      />
    );
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-alert/10 text-alert">
              !
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{row.name}</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {row.detail || "Motif non communiqué"}
              </span>
            </span>
            {row.date && (
              <span className="text-[11px] font-bold text-muted-foreground">{row.date}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
