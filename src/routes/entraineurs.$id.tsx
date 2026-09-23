import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BriefcaseBusiness, RefreshCw, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FootballEmpty } from "@/components/FootballDirectory";
import { getCoachOverview, type CoachOverview } from "@/lib/football.functions";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/entraineurs/$id")({
  loader: ({ params }) => getCoachOverview({ data: { coach: Number(params.id) } }),
  head: ({ params, loaderData }) => {
    const coach = (loaderData as CoachOverview | undefined)?.coach;
    const name = coach?.name ?? "Entraîneur de football";
    return buildRouteMeta({
      path: `/entraineurs/${params.id}`,
      title: `${name} : carrière et équipe`,
      description: `Profil de ${name}, équipe actuelle et carrière selon les données disponibles.`,
      noindex: !coach,
    });
  },
  component: CoachPage,
});

function CoachPage() {
  const initial = Route.useLoaderData();
  const { id } = Route.useParams();
  const reload = useServerFn(getCoachOverview);
  const query = useQuery({
    queryKey: ["football-coach-overview", Number(id)],
    queryFn: () => reload({ data: { coach: Number(id) } }),
    initialData: initial,
    staleTime: 60 * 60_000,
    retry: 1,
  });
  const data = query.data ?? initial;
  if (!data.coach)
    return (
      <AppShell>
        <main className="mx-auto flex min-h-[50vh] max-w-3xl items-center px-4 py-8 lg:px-0">
          <FootballEmpty
            title="Cet entraîneur est indisponible"
            text="Aucun profil réel n’a été reçu pour cet identifiant."
          />
        </main>
      </AppShell>
    );
  const coach = data.coach;
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-0">
        <Link
          to="/entraineurs"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowLeft className="size-3.5" /> Tous les entraîneurs
        </Link>
        <header className="rounded-2xl border border-border/70 bg-card p-5 sm:rounded-3xl sm:p-7">
          <div className="flex items-center gap-4">
            {coach.photo ? (
              <img
                src={coach.photo}
                alt=""
                className="size-20 rounded-2xl bg-surface object-cover"
              />
            ) : (
              <span className="grid size-20 place-items-center rounded-2xl bg-brand/10 text-brand">
                <BriefcaseBusiness className="size-7" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand">
                Profil entraîneur
              </p>
              <h1 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-4xl">
                {coach.name}
              </h1>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {[coach.nationality, coach.team?.name].filter(Boolean).join(" · ") ||
                  "Carrière publiée par l’API Football"}
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
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            <BriefcaseBusiness className="size-4 text-brand" />
            <h2 className="text-sm font-black">Carrière</h2>
          </div>
          {coach.career.length ? (
            <ul className="divide-y divide-border/60">
              {coach.career.map((item, index) => (
                <li
                  key={`${item.team.id}-${item.start}-${index}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {item.team.logo ? (
                    <img src={item.team.logo} alt="" className="size-8 object-contain" />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{item.team.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.start ?? "Date non publiée"} → {item.end ?? "en cours ou non publié"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-center text-xs text-muted-foreground">
              Aucune étape de carrière reçue.
            </p>
          )}
        </section>
        <footer className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-[11px] text-muted-foreground">
          <ShieldAlert className="size-3.5 shrink-0 text-brand" /> Ce profil ne contient que les
          informations publiées par le fournisseur.
        </footer>
      </main>
    </AppShell>
  );
}
