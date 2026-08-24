import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronLeft, Clock3, History, ShieldCheck, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DailyPredictionCard } from "@/components/DailyPredictionCard";
import { StrategicPromoCard } from "@/components/promo/StrategicPromoCard";
import { getPublicPredictionHistory } from "@/lib/daily-predictions.functions";
import { buildRouteMeta, breadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/pronostics/historique")({
  head: () => ({
    ...buildRouteMeta({
      path: "/pronostics/historique",
      title: "Historique des pronostics LiveFoot : résultats vérifiables",
      description:
        "Consultez les pronostics LiveFoot publiés avant les matchs, leurs scores finaux et les résultats gagnés ou perdus sans suppression des mauvais résultats.",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "Accueil", path: "/" },
            { name: "Pronostics du jour", path: "/pronostics-du-jour" },
            { name: "Historique", path: "/pronostics/historique" },
          ]),
        ),
      },
    ],
  }),
  loader: () => getPublicPredictionHistory(),
  component: PublicPredictionHistoryPage,
});

function PublicPredictionHistoryPage() {
  const data = Route.useLoaderData();
  const metrics = [
    ["Pronostics réglés", data.summary.settled, History],
    ["Gagnés", data.summary.won, Check],
    ["Perdus", data.summary.lost, X],
    ["Taux observé", data.summary.hitRate === null ? "—" : `${data.summary.hitRate}%`, ShieldCheck],
  ] as const;
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-0 lg:py-8">
        <header>
          <Link
            to="/pronostics-du-jour"
            className="inline-flex items-center gap-1 text-xs font-black text-brand"
          >
            <ChevronLeft className="size-4" /> Pronostics du jour
          </Link>
          <div className="mt-4 flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
              <History className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                Historique LiveFoot
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Chaque sélection est conservée avec sa publication et son résultat officiel. Les
                défaites restent visibles : la transparence compte davantage qu’un chiffre
                spectaculaire.
              </p>
            </div>
          </div>
        </header>

        <section
          className="grid grid-cols-2 gap-2 lg:grid-cols-4"
          aria-label="Statistiques publiques"
        >
          {metrics.map(([label, value, Icon]) => (
            <div key={label} className="rounded-2xl border border-border/70 bg-card p-3.5">
              <Icon className="size-4 text-brand" />
              <p className="mt-2 text-xl font-black tabular-nums">{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
            </div>
          ))}
        </section>

        {data.items.length ? (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Clock3 className="size-4 text-brand" />
              <h2 className="text-lg font-black">Derniers résultats vérifiés</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.items.map((item) => (
                <DailyPredictionCard key={item.id} item={item} compact />
              ))}
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-card p-8 text-center">
            <History className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-black">
              Les premiers résultats apparaîtront après les matchs
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Aucun taux n’est affiché tant qu’aucun pronostic n’a été officiellement réglé.
            </p>
          </div>
        )}

        <StrategicPromoCard location="prediction_history" />

        <Link
          to="/premium/historique"
          className="flex items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-brand/[0.05] p-4 text-sm font-black hover:bg-brand/10"
        >
          Consulter mon historique personnel
          <ChevronLeft className="size-4 rotate-180 text-brand" />
        </Link>
      </div>
    </AppShell>
  );
}
