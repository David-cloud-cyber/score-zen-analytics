import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarCheck, Crown, History, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DailyPredictionCard } from "@/components/DailyPredictionCard";
import { StrategicPromoCard } from "@/components/promo/StrategicPromoCard";
import { getDailyPredictions } from "@/lib/daily-predictions.functions";
import { buildRouteMeta, breadcrumbSchema } from "@/lib/seo";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/pronostics-du-jour")({
  head: () => ({
    ...buildRouteMeta({
      path: "/pronostics-du-jour",
      title: "Pronostics football du jour : sélections statistiques LiveFoot",
      description:
        "Découvrez les pronostics football du jour sélectionnés avant les matchs à partir des données disponibles, avec deux sélections gratuites chaque jour.",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "Accueil", path: "/" },
            { name: "Pronostics du jour", path: "/pronostics-du-jour" },
          ]),
        ),
      },
    ],
  }),
  loader: () => getDailyPredictions(),
  component: DailyPredictionsPage,
});

function DailyPredictionsPage() {
  const initial = Route.useLoaderData();
  const { user } = useSession();
  const load = useServerFn(getDailyPredictions);
  const query = useQuery({
    queryKey: ["daily-predictions", user?.id ?? "visitor"],
    queryFn: () => load(),
    initialData: initial,
    staleTime: 5 * 60_000,
    refetchOnMount: Boolean(user),
  });
  const data = query.data;
  const unlocked = data.items.filter((item) => !item.locked).length;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-0 lg:py-8">
        <header className="score-dark-surface overflow-hidden rounded-2xl border border-brand/25 bg-[radial-gradient(circle_at_85%_10%,rgba(28,211,151,0.18),transparent_34%),#151817] p-4 text-[#f7f7f7] sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-brand">
                <CalendarCheck className="size-3.5" /> Sélection du jour
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl">
                Pronostics football du jour
              </h1>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#bac2bf] sm:text-sm">
                Des sélections publiées avant le coup d’envoi uniquement lorsque les données
                disponibles convergent. Deux pronostics sont accessibles gratuitement chaque jour.
              </p>
            </div>
            <Link
              to="/pronostics/historique"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-black text-white hover:bg-white/15"
            >
              <History className="size-4" /> Voir les résultats
            </Link>
          </div>
        </header>

        {!data.isPremium && data.items.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black">
                {unlocked} pronostics gratuits disponibles aujourd’hui
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Premium débloque toutes les sélections du jour et l’historique personnel complet.
              </p>
            </div>
            <Link
              to="/premium"
              search={{ plan: undefined }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-xs font-black text-[#06130e]"
            >
              <Crown className="size-4" /> Voir Premium
            </Link>
          </div>
        )}

        {data.items.length ? (
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-brand">
                  Aujourd’hui
                </p>
                <h2 className="mt-1 text-xl font-black">Sélections disponibles</h2>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">
                {data.items.length} match(s)
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.items.map((item) => (
                <DailyPredictionCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-border/70 bg-card p-8 text-center">
            <ShieldCheck className="mx-auto size-7 text-brand" />
            <h2 className="mt-3 text-base font-black">Aucune sélection suffisamment documentée</h2>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
              LiveFoot préfère ne rien publier plutôt que d’afficher un pronostic fragile. La page
              sera actualisée automatiquement lorsque de nouvelles rencontres seront éligibles.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-1 text-xs font-black text-brand"
            >
              Voir les matchs du jour <ArrowRight className="size-3.5" />
            </Link>
          </section>
        )}

        <details className="group rounded-2xl border border-border/70 bg-card p-3.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-black marker:hidden">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-4 text-brand" /> Comment les sélections sont filtrées
            </span>
            <span className="text-[10px] font-bold text-muted-foreground group-open:hidden">
              En savoir plus
            </span>
          </summary>
          <section
            className="mt-3 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-3"
            aria-label="Principes des pronostics"
          >
            {[
              [
                ShieldCheck,
                "Données vérifiées",
                "Aucune sélection n’est inventée lorsque les informations sont insuffisantes.",
              ],
              [
                Sparkles,
                "Sélection prudente",
                "Les divergences importantes retirent automatiquement un pronostic.",
              ],
              [
                History,
                "Résultats conservés",
                "Les pronostics sont réglés après le résultat officiel et restent consultables.",
              ],
            ].map(([Icon, title, text]) => (
              <div key={String(title)} className="rounded-xl bg-surface/65 p-3">
                <Icon className="size-4 text-brand" />
                <p className="mt-2 text-xs font-black">{String(title)}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {String(text)}
                </p>
              </div>
            ))}
          </section>
        </details>

        <StrategicPromoCard location="daily_predictions" />

        <footer className="rounded-2xl border border-border/70 bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          Les probabilités sont des estimations, jamais des garanties. Les résultats passés ne
          préjugent pas des résultats futurs. Jouez de façon responsable et uniquement si vous avez
          l’âge légal.
        </footer>
      </div>
    </AppShell>
  );
}
