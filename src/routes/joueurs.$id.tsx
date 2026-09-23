import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  RefreshCw,
  ShieldAlert,
  Trophy,
  ArrowRightLeft,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FootballEmpty, TrophyList } from "@/components/FootballDirectory";
import { getPlayerOverview, type PlayerOverview } from "@/lib/football.functions";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/joueurs/$id")({
  loader: ({ params }) => getPlayerOverview({ data: { player: Number(params.id) } }),
  head: ({ params, loaderData }) => {
    const player = (loaderData as PlayerOverview | undefined)?.player;
    const name = player?.name ?? "Joueur de football";
    return buildRouteMeta({
      path: `/joueurs/${params.id}`,
      title: `${name} : statistiques et profil`,
      description: `Profil de ${name}, statistiques, équipe, transferts, palmarès et indisponibilités selon les données reçues.`,
      noindex: !player,
    });
  },
  component: PlayerPage,
});

function PlayerPage() {
  const initial = Route.useLoaderData();
  const { id } = Route.useParams();
  const reload = useServerFn(getPlayerOverview);
  const query = useQuery({
    queryKey: ["football-player-overview", Number(id)],
    queryFn: () => reload({ data: { player: Number(id) } }),
    initialData: initial,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const data = query.data ?? initial;
  if (!data.player)
    return (
      <AppShell>
        <main className="mx-auto flex min-h-[50vh] max-w-3xl items-center px-4 py-8 lg:px-0">
          <FootballEmpty
            title="Ce joueur est indisponible"
            text="Aucun profil réel n’a été reçu pour cet identifiant."
          />
        </main>
      </AppShell>
    );
  const player = data.player;
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-0">
        <Link
          to="/joueurs"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowLeft className="size-3.5" /> Tous les joueurs
        </Link>
        <header className="rounded-2xl border border-border/70 bg-card p-5 sm:rounded-3xl sm:p-7">
          <div className="flex items-center gap-4">
            {player.photo ? (
              <img
                src={player.photo}
                alt=""
                className="size-20 rounded-2xl bg-surface object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand">
                Profil joueur
              </p>
              <h1 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-4xl">
                {player.name}
              </h1>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {[player.position, player.nationality, player.team?.name]
                  .filter(Boolean)
                  .join(" · ") || "Données de profil disponibles"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              aria-label="Actualiser le profil"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface text-muted-foreground hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
            >
              <RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} />
            </button>
          </div>
        </header>
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <PlayerStats data={data} />
          <div className="space-y-5">
            <TrophyList trophies={data.trophies} />
            <PlayerAbsences data={data} />
          </div>
        </div>
        <PlayerTransfers data={data} />
        <footer className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-[11px] text-muted-foreground">
          <ShieldAlert className="size-3.5 shrink-0 text-brand" /> Les chiffres affichés
          correspondent aux saisons publiées par le fournisseur.
        </footer>
      </main>
    </AppShell>
  );
}

function PlayerStats({ data }: { data: PlayerOverview }) {
  if (!data.statistics.length)
    return (
      <FootballEmpty
        icon={<BarChart3 className="size-5" />}
        title="Statistiques non disponibles"
        text="Les statistiques détaillées de ce joueur ne sont pas publiées pour le moment."
      />
    );
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-4 text-brand" />
        <h2 className="text-sm font-black">Statistiques par saison et équipe</h2>
      </div>
      <div className="mt-4 space-y-3">
        {data.statistics.map((stat, index) => (
          <article
            key={`${stat.team.id}-${stat.league.id}-${stat.league.season}-${index}`}
            className="rounded-xl bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black">{stat.team.name}</h3>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {stat.league.name} · {stat.league.season}
                  {stat.position ? ` · ${stat.position}` : ""}
                </p>
              </div>
              <span className="text-xs font-black text-brand">{stat.rating ?? "—"}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
              {[
                ["MJ", stat.appearances],
                ["Min", stat.minutes],
                ["Buts", stat.goals],
                ["PD", stat.assists],
                ["Tirs", stat.shots],
                ["Jaunes", stat.yellow],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border/60 bg-card px-2 py-2">
                  <p className="text-[9px] font-bold text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm font-black">{value ?? "—"}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PlayerAbsences({ data }: { data: PlayerOverview }) {
  if (!data.injuries.length)
    return (
      <FootballEmpty
        icon={<ClipboardList className="size-5" />}
        title="Aucune indisponibilité reçue"
        text="Aucune blessure publiée n’est associée à ce joueur."
      />
    );
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <ClipboardList className="size-4 text-brand" />
        <h2 className="text-sm font-black">Indisponibilités</h2>
      </div>
      <ul className="divide-y divide-border/60">
        {data.injuries.map((injury, index) => (
          <li key={`${injury.playerId}-${injury.fixtureId}-${index}`} className="px-4 py-3">
            <p className="text-xs font-bold">
              {injury.reason || injury.type || "Motif non communiqué"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {injury.team} · {injury.fixtureId ? `match ${injury.fixtureId}` : "date non publiée"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlayerTransfers({ data }: { data: PlayerOverview }) {
  if (!data.transfers.length)
    return (
      <FootballEmpty
        icon={<ArrowRightLeft className="size-5" />}
        title="Transferts non disponibles"
        text="Aucun mouvement réel n’a été reçu pour ce joueur."
      />
    );
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <ArrowRightLeft className="size-4 text-brand" />
        <h2 className="text-sm font-black">Historique des transferts</h2>
      </div>
      <ul className="divide-y divide-border/60">
        {data.transfers.slice(0, 60).map((item, index) => (
          <li key={`${item.date}-${index}`} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{item.player}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {item.date ?? "Date non publiée"} · {item.type ?? "Mouvement"}
              </span>
            </span>
            <span className="max-w-[48%] text-right text-[11px] font-bold text-muted-foreground">
              {item.teams.out?.name ?? "—"} → {item.teams.in?.name ?? "—"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
