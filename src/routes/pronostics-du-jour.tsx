import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Crown,
  History,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DailyPredictionCard } from "@/components/DailyPredictionCard";
import { StrategicPromoCard } from "@/components/promo/StrategicPromoCard";
import { ReferralCta } from "@/components/ReferralCta";
import { getDailyPredictions } from "@/lib/daily-predictions.functions";
import { buildRouteMeta, breadcrumbSchema } from "@/lib/seo";
import { useSession } from "@/hooks/use-session";
import { PwaInstallCard } from "@/components/PwaInstallCard";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/pronostics-du-jour")({
  head: () => ({
    ...buildRouteMeta({
      path: "/pronostics-du-jour",
      title: "Pronostics football du jour : sélections statistiques LiveFoot",
      description:
        "Découvrez les pronostics football du jour sélectionnés avant les matchs lorsque les données disponibles sont suffisamment fiables, avec un historique transparent.",
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
  const { user, session, loading } = useSession();
  const load = useServerFn(getDailyPredictions);
  const query = useQuery({
    queryKey: ["daily-predictions", user?.id ?? "visitor"],
    queryFn: () =>
      session?.access_token ? load({ data: { accessToken: session.access_token } }) : load(),
    // SSR deliberately has no browser token. Never seed an authenticated
    // query with that visitor response, otherwise React Query can retain the
    // locked cards for its whole stale window after session restoration.
    initialData: user ? undefined : initial,
    placeholderData: user ? undefined : initial,
    staleTime: user ? 0 : 5 * 60_000,
    enabled: !loading,
    refetchOnMount: !loading && Boolean(user),
    retry: 1,
  });
  const { refetch: refetchDailyPredictions } = query;
  useEffect(() => {
    if (session?.access_token) void refetchDailyPredictions();
  }, [refetchDailyPredictions, session?.access_token]);

  const restoringAuthenticatedAccess =
    Boolean(user && session?.access_token) &&
    (query.isLoading || query.isFetching) &&
    (!query.data || query.data.access === "visitor");
  const data = query.data ?? initial;
  const unlocked = data.items.filter((item) => !item.locked).length;
  const isVisitor = data.access === "visitor";
  const isFree = data.access === "free";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-0 lg:py-8">
        <header className="daily-predictions-hero score-dark-surface overflow-hidden rounded-2xl border border-brand/25 p-4 text-[#f7f7f7] sm:rounded-3xl sm:p-6">
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
                disponibles convergent. Trois pronostics du jour sont accessibles avec un compte
                gratuit, puis Premium donne accès à toutes les sélections publiées.
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

        <PwaInstallCard location="daily_predictions" />

        {restoringAuthenticatedAccess ? (
          <section className="rounded-2xl border border-border/70 bg-card p-4" aria-live="polite">
            <div className="h-3 w-28 animate-pulse rounded-full bg-surface" />
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-56 animate-pulse rounded-2xl bg-surface" />
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Vérification de vos accès…
            </p>
          </section>
        ) : (
          <>

        {isVisitor && data.items.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black">
                Créez un compte pour lire les {data.items.length} pronostic
                {data.items.length > 1 ? "s" : ""} disponible{data.items.length > 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                L’inscription donne accès aux trois sélections publiées et à votre espace personnel.
              </p>
            </div>
            <Link
              to="/auth"
              search={{
                mode: "signup",
                redirect: "/pronostics-du-jour",
                source: "daily_predictions",
              }}
              onClick={() => track("cta_click", { location: "daily_predictions_signup" })}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-xs font-black text-[#06130e]"
            >
              <UserPlus className="size-4" /> Créer mon compte
            </Link>
          </div>
        )}

        {isFree && data.items.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black">
                {unlocked} pronostics gratuits disponibles aujourd’hui
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Premium donne accès à toutes les sélections publiées chaque jour et à l’historique
                personnel complet.
              </p>
            </div>
            <Link
              to="/premium"
              search={{ plan: undefined }}
              onClick={() => track("premium_cta_click", { location: "daily_predictions" })}
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
                <DailyPredictionCard
                  key={item.id}
                  item={item}
                  lockedAction={isVisitor ? "signup" : "premium"}
                />
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
        <ReferralCta location="daily_predictions" showGuest showProgress />

        <footer className="rounded-2xl border border-border/70 bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          Les probabilités sont des estimations, jamais des garanties. Les résultats passés ne
          préjugent pas des résultats futurs. Jouez de façon responsable et uniquement si vous avez
          l’âge légal.
        </footer>
          </>
        )}
      </div>
    </AppShell>
  );
}
