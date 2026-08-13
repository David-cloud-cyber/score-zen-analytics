import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Bell,
  BellRing,
  Check,
  ChevronRight,
  Clock3,
  Crown,
  Gauge,
  History,
  Info,
  Lock,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  getPremiumDashboard,
  setPremiumFavoriteNotification,
  togglePremiumFavorite,
  type HubAlert,
  type HubFavorite,
  type PremiumHubData,
  type RadarOpportunity,
} from "@/lib/premium-hub.functions";
import { buildRouteMeta } from "@/lib/seo";
import { useSession } from "@/hooks/use-session";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isLocalDemo } from "@/lib/local-demo";
import type { PredictionHistoryItem } from "@/lib/prediction-history.functions";

export const Route = createFileRoute("/premium/tableau-de-bord")({
  head: () =>
    buildRouteMeta({
      path: "/premium/tableau-de-bord",
      title: "Premium Intelligence Hub — Radar et alertes football",
      description:
        "Tableau de bord Premium Livefoot : radar value, alertes personnalisées, analyses et scorecard de performance.",
      noindex: true,
    }),
  component: PremiumHubPage,
});

const DEMO_HUB_DATA: PremiumHubData = {
  isPremium: true,
  profile: { credits: 86, plan: "premium", premiumUntil: "2026-12-31T23:59:59.000Z" },
  radar: [
    {
      fixtureId: "demo-arsenal-chelsea",
      kickoff: "2026-08-09T18:30:00.000Z",
      league: "Premier League · Angleterre",
      home: { name: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png" },
      away: { name: "Chelsea", logo: "https://media.api-sports.io/football/teams/49.png" },
      pick: "Arsenal ou nul",
      market: "Double chance",
      probability: 74,
      impliedProbability: 62,
      odd: 1.42,
      edge: 12,
      confidence: 88,
      risk: "bas",
      reason:
        "Arsenal présente une meilleure dynamique à domicile et concède peu d'occasions sur les cinq dernières journées.",
      factors: [
        "Forme récente : 4 victoires sur 5",
        "Avantage domicile confirmé",
        "Écart défensif favorable",
      ],
    },
    {
      fixtureId: "demo-real-atletico",
      kickoff: "2026-08-09T20:00:00.000Z",
      league: "LaLiga · Espagne",
      home: { name: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png" },
      away: { name: "Atlético Madrid", logo: "https://media.api-sports.io/football/teams/530.png" },
      pick: "Moins de 3,5 buts",
      market: "Total buts",
      probability: 68,
      impliedProbability: 55,
      odd: 1.82,
      edge: 13,
      confidence: 79,
      risk: "moyen",
      reason:
        "Le profil tactique des deux équipes favorise un match fermé malgré la qualité offensive disponible.",
      factors: [
        "H2H souvent serré",
        "Rythme contrôlé attendu",
        "Marché stable sur les dernières heures",
      ],
    },
    {
      fixtureId: "demo-bayern-dortmund",
      kickoff: "2026-08-09T16:30:00.000Z",
      league: "Bundesliga · Allemagne",
      home: { name: "Bayern Munich", logo: "https://media.api-sports.io/football/teams/157.png" },
      away: { name: "Dortmund", logo: "https://media.api-sports.io/football/teams/165.png" },
      pick: "Les deux équipes marquent",
      market: "BTTS",
      probability: 71,
      impliedProbability: 59,
      odd: 1.69,
      edge: 12,
      confidence: 76,
      risk: "moyen",
      reason:
        "Les deux attaques produisent régulièrement des occasions franches et les absences concernent surtout les défenses.",
      factors: [
        "BTTS validé dans 7 des 10 derniers matchs",
        "Deux défenses remaniées",
        "Volume de tirs élevé",
      ],
    },
  ],
  alerts: [
    {
      id: "demo-alert-1",
      kind: "value",
      title: "Nouveau signal de valeur",
      message: "Arsenal ou nul vient de dépasser votre seuil de confiance.",
      time: "2026-08-09T17:42:00.000Z",
      read: false,
      fixtureId: "demo-arsenal-chelsea",
    },
    {
      id: "demo-alert-2",
      kind: "start",
      title: "Coup d'envoi bientôt",
      message: "Real Madrid · Atlético Madrid commence dans 45 minutes.",
      time: "2026-08-09T19:15:00.000Z",
      read: false,
      fixtureId: "demo-real-atletico",
    },
    {
      id: "demo-alert-3",
      kind: "system",
      title: "Données actualisées",
      message:
        "Les probabilités du radar ont été recalibrées avec les dernières cotes disponibles.",
      time: "2026-08-09T17:20:00.000Z",
      read: true,
    },
  ],
  favorites: [
    { id: "demo-fav-1", kind: "team", refId: "Arsenal", label: "Arsenal", notify: true },
    { id: "demo-fav-2", kind: "team", refId: "Real Madrid", label: "Real Madrid", notify: true },
    {
      id: "demo-fav-3",
      kind: "team",
      refId: "Bayern Munich",
      label: "Bayern Munich",
      notify: false,
    },
  ],
  scorecard: {
    totalAnalyses: 42,
    settledAnalyses: 31,
    hitRate: 68,
    theoreticalRoi: 11.4,
    favoriteMarket: "Double chance",
    favoriteTeam: "Arsenal",
  },
  recentPredictions: [],
  historySummary: {
    total: 42,
    settled: 31,
    won: 21,
    lost: 10,
    pending: 8,
    unresolvable: 3,
    hitRate: 68,
    theoreticalRoi: 11.4,
  },
  fetchedAt: "2026-08-09T17:45:00.000Z",
  warning: null,
};

function PremiumHubPage() {
  const { user, loading: sessionLoading } = useSession();
  const isDemo = isLocalDemo();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getDashboard = useServerFn(getPremiumDashboard);
  const toggleFavorite = useServerFn(togglePremiumFavorite);
  const updateNotification = useServerFn(setPremiumFavoriteNotification);
  const [busyFavorite, setBusyFavorite] = useState<string | null>(null);

  const query = useQuery<PremiumHubData>({
    queryKey: ["premium", "intelligence-hub"],
    queryFn: () => getDashboard(),
    enabled: !!user && !isDemo,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isDemo && !sessionLoading && !user)
      navigate({ to: "/auth", search: { redirect: "/premium/tableau-de-bord" } });
  }, [isDemo, sessionLoading, user, navigate]);

  async function handleToggleFavorite(item: RadarOpportunity) {
    if (isDemo) {
      toast.info("Aperçu local : cette action est désactivée en mode démo.");
      return;
    }
    const key = item.fixtureId;
    setBusyFavorite(key);
    try {
      await toggleFavorite({
        data: { kind: "team", refId: item.home.name, label: item.home.name, notify: true },
      });
      await queryClient.invalidateQueries({ queryKey: ["premium", "intelligence-hub"] });
      toast.success(`Suivi de ${item.home.name} mis à jour.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de modifier le suivi.");
    } finally {
      setBusyFavorite(null);
    }
  }

  async function handleNotification(favorite: HubFavorite) {
    if (isDemo) {
      toast.info("Aperçu local : cette action est désactivée en mode démo.");
      return;
    }
    try {
      await updateNotification({ data: { favoriteId: favorite.id, notify: !favorite.notify } });
      await queryClient.invalidateQueries({ queryKey: ["premium", "intelligence-hub"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de modifier l'alerte.");
    }
  }

  if (sessionLoading || (!isDemo && (!user || query.isLoading))) return <HubLoading />;
  if (!isDemo && (query.isError || !query.data))
    return <HubError onRetry={() => query.refetch()} />;
  const data: PremiumHubData = isDemo ? DEMO_HUB_DATA : query.data!;

  if (!data.isPremium) return <PremiumGate credits={data.profile.credits} />;

  return (
    <AppShell>
      <div className="space-y-6 px-4 pb-12 pt-4 lg:px-0">
        {isDemo && (
          <div
            className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-bold text-brand"
            role="status"
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            Aperçu local · données fictives · aucune donnée réelle ni action serveur utilisée
          </div>
        )}

        <HubHeader
          data={data}
          onRefresh={() => {
            if (!isDemo) void query.refetch();
          }}
          refreshing={!isDemo && query.isFetching}
        />

        <HubOverview data={data} />
        <HubQuickNav />

        <RecentPredictions items={data.recentPredictions} summary={data.historySummary} />

        {data.warning && (
          <div className="flex items-start gap-3 rounded-xl border border-brand/25 bg-brand/5 p-4 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <p className="text-muted-foreground">{data.warning}</p>
          </div>
        )}

        <section className="space-y-3" aria-labelledby="radar-title">
          <SectionHeading
            id="radar-title"
            eyebrow="Décisions assistées"
            title="Radar Value du jour"
            description="Les projections combinent la probabilité du modèle, le consensus disponible et la cote moyenne. Aucun signal ne garantit un gain."
            icon={<Target className="size-5" />}
          />
          {data.radar.length === 0 ? (
            <EmptyRadar />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.radar.map((item) => (
                <RadarCard
                  key={item.fixtureId}
                  item={item}
                  followed={data.favorites.some(
                    (favorite) =>
                      favorite.kind === "team" &&
                      favorite.refId.toLowerCase() === item.home.name.toLowerCase(),
                  )}
                  busy={busyFavorite === item.fixtureId}
                  onToggle={() => handleToggleFavorite(item)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-3" aria-labelledby="alerts-title">
            <SectionHeading
              id="alerts-title"
              eyebrow="Automatisation Premium"
              title="Mes alertes intelligentes"
              description="Les alertes s’appuient sur vos équipes suivies et les signaux détectés par le radar."
              icon={<BellRing className="size-5" />}
            />
            <AlertsPanel alerts={data.alerts} />
            <BrowserNotificationControl alerts={data.alerts} />
          </section>

          <section className="space-y-3" aria-labelledby="scorecard-title">
            <SectionHeading
              id="scorecard-title"
              eyebrow="Votre historique"
              title="Scorecard personnel"
              description="Une lecture honnête de vos analyses enregistrées, sans promettre de résultat futur."
              icon={<Gauge className="size-5" />}
            />
            <Scorecard scorecard={data.scorecard} />
          </section>
        </div>

        <section className="space-y-3" aria-labelledby="teams-title">
          <SectionHeading
            id="teams-title"
            eyebrow="Personnalisation"
            title="Mes équipes suivies"
            description="Suivez vos équipes depuis le radar et recevez les alertes de coup d’envoi et de valeur."
            icon={<Users className="size-5" />}
          />
          <FollowedTeams favorites={data.favorites} onNotification={handleNotification} />
        </section>

        <div className="animate-score-pop rounded-xl bg-[#181818] p-5 text-[#f7f7f7] shadow-none sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand">
                <Sparkles className="size-3.5" /> Analyse approfondie
              </p>
              <h2 className="mt-1 text-xl font-black">Passez du signal à l’explication</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#f7f7f7]/65">
                Ouvrez une analyse complète pour voir la forme, le H2H, les absences et les marchés
                recommandés.
              </p>
            </div>
            <Link
              to="/analyse"
              search={{ home: "", away: "" }}
              onClick={() => track("cta_click", { location: "premium_hub_final" })}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-brand-foreground transition-transform hover:scale-[1.02] active:scale-95"
            >
              Analyser un match <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>

        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-alert" aria-hidden />
          Les probabilités sont des estimations statistiques. Elles ne constituent pas un conseil
          financier et ne garantissent ni résultat ni gain. Ne misez jamais de l’argent nécessaire à
          vos dépenses.
        </p>
      </div>
    </AppShell>
  );
}

function HubHeader({
  data,
  onRefresh,
  refreshing,
}: {
  data: PremiumHubData;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <header className="relative animate-rise overflow-hidden rounded-xl bg-[#181818] p-5 text-[#f7f7f7] shadow-none sm:p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-brand/35 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-brand/15 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
            <Crown className="size-3.5" /> Intelligence Hub
          </span>
          <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#f7f7f7]/80">
            <span className="size-1.5 rounded-full bg-brand" /> Premium actif
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            Votre centre de décision
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#f7f7f7]/70">
            Repérez les signaux intéressants, suivez vos équipes et comprenez chaque projection
            avant de prendre une décision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-white/10 px-3 py-2 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#f7f7f7]/55">
              Crédits
            </p>
            <p className="text-lg font-black tabular-nums text-brand">{data.profile.credits}</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="grid size-10 place-items-center rounded-xl bg-white/10 text-[#f7f7f7] transition-colors hover:bg-white/20"
            aria-label="Actualiser le tableau de bord"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden />
          </button>
        </div>
      </div>
      <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[#f7f7f7]/55">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-brand" /> Données actualisées automatiquement
        </span>
        <span>
          Dernière mise à jour :{" "}
          {new Date(data.fetchedAt).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </header>
  );
}

function HubOverview({ data }: { data: PremiumHubData }) {
  const metrics = [
    {
      label: "Opportunités",
      value: String(data.radar.length),
      hint: "à étudier aujourd'hui",
      icon: <Target className="size-4" />,
    },
    {
      label: "Alertes actives",
      value: String(data.alerts.length),
      hint: "signaux personnalisés",
      icon: <BellRing className="size-4" />,
    },
    {
      label: "Taux de réussite",
      value: data.scorecard.hitRate === null ? "—" : `${data.scorecard.hitRate}%`,
      hint: `${data.scorecard.settledAnalyses} analyse(s) réglée(s)`,
      icon: <Gauge className="size-4" />,
    },
    {
      label: "Équipes suivies",
      value: String(data.favorites.filter((favorite) => favorite.kind === "team").length),
      hint: "notifications configurables",
      icon: <Users className="size-4" />,
    },
  ];

  return (
    <section aria-label="Résumé du Hub" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="score-card animate-rise p-3">
          <div className="flex items-center gap-1.5 text-brand">
            {metric.icon}
            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
              {metric.label}
            </span>
          </div>
          <p className="mt-2 text-2xl font-black tabular-nums">{metric.value}</p>
          <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{metric.hint}</p>
        </div>
      ))}
    </section>
  );
}

function HubQuickNav() {
  const links = [
    ["#radar-title", "Radar"],
    ["#alerts-title", "Alertes"],
    ["#scorecard-title", "Performances"],
    ["#teams-title", "Équipes"],
    ["#history-title", "Historique"],
  ] as const;
  return (
    <nav
      aria-label="Navigation du Hub"
      className="sticky top-[4.25rem] z-20 -mx-1 flex gap-2 overflow-x-auto rounded-xl border border-border/70 bg-background/90 p-1.5 backdrop-blur-xl lg:top-2"
    >
      {links.map(([href, label]) => (
        <a
          key={href}
          href={href}
          className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-black text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

function RecentPredictions({
  items,
  summary,
}: {
  items: PremiumHubData["recentPredictions"];
  summary: PremiumHubData["historySummary"];
}) {
  const statusLabel: Record<PredictionHistoryItem["status"], string> = {
    pending: "En attente",
    won: "Gagnée",
    lost: "Perdue",
    unresolvable: "Non réglable",
  };
  return (
    <section id="history-title" className="space-y-3" aria-labelledby="history-heading">
      <div className="flex items-end justify-between gap-3">
        <SectionHeading
          id="history-heading"
          eyebrow="Apprentissage Premium"
          title="Dernières prédictions"
          description="Retrouvez les dernières analyses et leur statut sans relancer ni débiter de crédits."
          icon={<History className="size-5" />}
        />
        <Link
          to="/premium/historique"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-brand hover:underline"
        >
          Tout voir <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="score-empty-state p-5">
          <History className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-bold">Votre historique apparaîtra ici</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Lancez une analyse pour commencer à suivre vos résultats.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to="/analyse"
              search={{ home: item.homeTeam, away: item.awayTeam, matchId: item.matchId ?? undefined }}
              className="rounded-xl border border-border/70 bg-card p-3 transition-colors hover:border-brand/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-black">{item.homeTeam} <span className="text-muted-foreground">vs</span> {item.awayTeam}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{item.marketLabel} · {item.pick}</p>
                </div>
                <span className={cn(
                  "shrink-0 rounded-full px-2 py-1 text-[9px] font-black",
                  item.status === "won" ? "bg-brand/10 text-brand" : item.status === "lost" ? "bg-alert/10 text-alert" : "bg-surface text-muted-foreground",
                )}>
                  {statusLabel[item.status]}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{item.finalScore ? `Score ${item.finalScore}` : "Résultat en attente"}</span>
                <span>{item.confidence === null ? "—" : `${item.confidence}% confiance`}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        {summary.settled} analyse(s) réglée(s) · taux de réussite {summary.hitRate === null ? "à venir" : `${summary.hitRate}%`}
      </p>
    </section>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  icon,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
        {icon}
      </span>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-brand">{eyebrow}</p>
        <h2 id={id} className="mt-0.5 text-xl font-black tracking-tight">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function RadarCard({
  item,
  followed,
  busy,
  onToggle,
}: {
  item: RadarOpportunity;
  followed: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const riskLabel =
    item.risk === "bas" ? "Risque bas" : item.risk === "moyen" ? "Risque moyen" : "Risque élevé";
  return (
    <article className="animate-rise overflow-hidden rounded-xl border border-border/70 bg-card shadow-none transition-colors hover:border-brand/30">
      <div className="border-b border-border/60 bg-surface/40 p-4">
        <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span className="truncate">{item.league}</span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Clock3 className="size-3" />{" "}
            {new Date(item.kickoff).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamMini name={item.home.name} logo={item.home.logo} align="left" />
          <span className="text-xs font-black text-muted-foreground">VS</span>
          <TeamMini name={item.away.name} logo={item.away.logo} align="right" />
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Signal principal · {item.market}
            </p>
            <p className="mt-1 text-lg font-black">{item.pick}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black tabular-nums text-brand">{item.probability}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              probabilité
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric label="Confiance" value={`${item.confidence}%`} tone="brand" />
          <Metric label="Cote" value={item.odd ? item.odd.toFixed(2) : "—"} />
          <Metric
            label="Écart"
            value={item.edge === null ? "—" : `${item.edge >= 0 ? "+" : ""}${item.edge} pts`}
            tone={item.edge !== null && item.edge >= 3 ? "brand" : undefined}
          />
        </div>

        <div className="rounded-xl border border-border/60 bg-surface/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-black">
              <Zap className="size-3.5 text-brand" /> {riskLabel}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">
              Implicite : {item.impliedProbability === null ? "—" : `${item.impliedProbability}%`}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
        </div>

        <details className="group rounded-xl border border-border/60 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold marker:hidden">
            Pourquoi ce signal ?{" "}
            <ChevronRight
              className="size-4 transition-transform group-open:rotate-90"
              aria-hidden
            />
          </summary>
          <ul className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
            {item.factors.map((factor) => (
              <li key={factor} className="text-[11px] leading-relaxed text-muted-foreground">
                • {factor}
              </li>
            ))}
          </ul>
        </details>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/analyse"
            search={{ home: item.home.name, away: item.away.name, matchId: String(item.fixtureId) }}
            onClick={() => track("cta_click", { location: `premium_radar_${item.fixtureId}` })}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-xs font-black text-brand-foreground transition-transform hover:scale-[1.01] active:scale-95"
          >
            Analyser ce match <ChevronRight className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black transition-colors disabled:opacity-50",
              followed
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-border hover:bg-surface",
            )}
          >
            <Star className={cn("size-3.5", followed && "fill-current")} aria-hidden />{" "}
            {followed ? "Suivie" : "Suivre"}
          </button>
        </div>
      </div>
    </article>
  );
}

function TeamMini({ name, logo, align }: { name: string; logo: string; align: "left" | "right" }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <img
        src={logo}
        alt={`Logo ${name}`}
        className="size-9 shrink-0 object-contain"
        loading="lazy"
      />
      <span className="line-clamp-2 text-xs font-black leading-tight">{name}</span>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "brand" }) {
  return (
    <div className="rounded-xl bg-surface px-2 py-2 text-center">
      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-sm font-black tabular-nums", tone === "brand" && "text-brand")}>
        {value}
      </p>
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: HubAlert[] }) {
  if (!alerts.length) {
    return (
      <div className="score-empty-state">
        <Bell className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-bold">Aucune alerte active</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Suivez une équipe ou attendez un nouveau signal du radar.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3",
            alert.kind === "value" ? "border-brand/25 bg-brand/5" : "border-border/70 bg-card",
          )}
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl",
              alert.kind === "value"
                ? "bg-brand/10 text-brand"
                : "bg-surface text-muted-foreground",
            )}
          >
            {alert.kind === "value" ? (
              <TrendingUp className="size-4" />
            ) : (
              <Clock3 className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black">{alert.title}</p>
              <span className="text-[10px] text-muted-foreground">
                {new Date(alert.time).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function BrowserNotificationControl({ alerts }: { alerts: HubAlert[] }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window)
      setPermission(window.Notification.permission);
  }, []);
  useEffect(() => {
    if (permission !== "granted" || !alerts.length || typeof window === "undefined") return;
    const seenKey = "livefoot_premium_alerts_seen";
    const seen = new Set(JSON.parse(window.sessionStorage.getItem(seenKey) ?? "[]") as string[]);
    const fresh = alerts.filter((alert) => !seen.has(alert.id)).slice(0, 2);
    fresh.forEach(
      (alert) => new window.Notification(alert.title, { body: alert.message, tag: alert.id }),
    );
    alerts.forEach((alert) => seen.add(alert.id));
    window.sessionStorage.setItem(seenKey, JSON.stringify([...seen].slice(-50)));
  }, [alerts, permission]);
  if (permission === "unsupported") return null;
  if (permission === "granted")
    return (
      <p className="flex items-center gap-2 text-[11px] font-bold text-brand">
        <BellRing className="size-3.5" /> Notifications navigateur activées
      </p>
    );
  return (
    <button
      type="button"
      onClick={async () => setPermission(await window.Notification.requestPermission())}
      className="inline-flex items-center gap-2 text-[11px] font-black text-brand hover:underline"
    >
      <Bell className="size-3.5" /> Activer les notifications navigateur
    </button>
  );
}

function Scorecard({ scorecard }: { scorecard: PremiumHubData["scorecard"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
      <ScoreMetric
        label="Analyses"
        value={String(scorecard.totalAnalyses)}
        icon={<Activity className="size-4" />}
      />
      <ScoreMetric
        label="Réglées"
        value={String(scorecard.settledAnalyses)}
        icon={<Check className="size-4" />}
      />
      <ScoreMetric
        label="Taux réussite"
        value={scorecard.hitRate === null ? "—" : `${scorecard.hitRate}%`}
        icon={<Target className="size-4" />}
      />
      <ScoreMetric
        label="ROI théorique"
        value={scorecard.theoreticalRoi === null ? "À venir" : `${scorecard.theoreticalRoi}%`}
        icon={<TrendingUp className="size-4" />}
      />
      <div className="col-span-2 rounded-xl border border-border/60 bg-surface/60 p-3 text-xs text-muted-foreground">
        <p className="font-bold text-foreground">Vos habitudes</p>
        <p className="mt-1">
          Marché le plus analysé :{" "}
          <strong className="text-foreground">
            {scorecard.favoriteMarket ?? "Pas encore assez de données"}
          </strong>
        </p>
        <p className="mt-1">
          Équipe la plus suivie dans l’historique :{" "}
          <strong className="text-foreground">
            {scorecard.favoriteTeam ?? "Pas encore assez de données"}
          </strong>
        </p>
        {scorecard.theoreticalRoi === null && (
          <p className="mt-2 text-[10px]">
            Le ROI sera calculé lorsque des cotes et résultats suffisants seront disponibles.
          </p>
        )}
      </div>
    </div>
  );
}

function ScoreMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="score-card p-3">
      <span className="text-brand">{icon}</span>
      <p className="mt-2 text-xl font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function FollowedTeams({
  favorites,
  onNotification,
}: {
  favorites: HubFavorite[];
  onNotification: (favorite: HubFavorite) => void;
}) {
  const teams = favorites.filter((favorite) => favorite.kind === "team");
  if (!teams.length)
    return (
      <div className="score-empty-state p-7">
        <Star className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-bold">Aucune équipe suivie</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Utilisez le bouton « Suivre » sur une carte du radar.
        </p>
      </div>
    );
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((favorite) => (
        <div key={favorite.id} className="score-card flex items-center gap-3 p-3">
          <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
            <Star className="size-4 fill-current" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-black">
            {favorite.label ?? favorite.refId}
          </span>
          <button
            type="button"
            onClick={() => onNotification(favorite)}
            className={cn(
              "grid size-8 place-items-center rounded-xl",
              favorite.notify ? "bg-brand/10 text-brand" : "bg-surface text-muted-foreground",
            )}
            aria-label={favorite.notify ? "Désactiver les alertes" : "Activer les alertes"}
          >
            <Bell className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function EmptyRadar() {
  return (
    <div className="score-empty-state">
      <Target className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-2 text-sm font-bold">Aucune opportunité calculable pour le moment</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
        Nous n’affichons pas de probabilité sans données suffisantes. Vous pouvez lancer une analyse
        manuelle depuis la page Analyse.
      </p>
      <Link
        to="/analyse"
        search={{ home: "", away: "" }}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-brand-foreground"
      >
        Ouvrir Analyse <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

function PremiumGate({ credits }: { credits: number }) {
  return (
    <AppShell>
      <div className="space-y-6 px-4 pb-12 pt-6 lg:px-0">
        <div className="relative animate-rise overflow-hidden rounded-xl bg-[#181818] p-6 text-[#f7f7f7] shadow-none">
          <Lock className="size-7 text-brand" />
          <h1 className="mt-4 text-2xl font-black">Le Premium Intelligence Hub vous attend</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#f7f7f7]/70">
            Débloquez le radar value, les alertes personnalisées, le suivi des performances et les
            explications avancées.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/premium"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-brand-foreground"
            >
              Passer Premium <ChevronRight className="size-4" />
            </Link>
            <span className="inline-flex items-center rounded-xl bg-white/10 px-3 py-3 text-xs font-bold text-[#f7f7f7]/70">
              {credits} crédits disponibles
            </span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FeaturePreview
            icon={<Target />}
            title="Radar Value"
            text="Probabilités, cotes et écarts statistiques lisibles."
          />
          <FeaturePreview
            icon={<BellRing />}
            title="Alertes intelligentes"
            text="Suivi des équipes et signaux importants."
          />
          <FeaturePreview
            icon={<Gauge />}
            title="Scorecard"
            text="Mesurez vos analyses et votre progression."
          />
          <FeaturePreview
            icon={<Sparkles />}
            title="Explications avancées"
            text="Comprenez les facteurs derrière chaque signal."
          />
        </div>
      </div>
    </AppShell>
  );
}

function FeaturePreview({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="score-card flex gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
        {icon}
      </span>
      <div>
        <p className="text-sm font-black">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function HubLoading() {
  return (
    <AppShell>
      <div className="space-y-4 px-4 pb-12 pt-6 lg:px-0">
        <div className="h-48 animate-score-shimmer rounded-xl bg-surface" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 animate-score-shimmer rounded-xl bg-surface" />
          <div className="h-72 animate-score-shimmer rounded-xl bg-surface" />
        </div>
      </div>
    </AppShell>
  );
}

function HubError({ onRetry }: { onRetry: () => void }) {
  return (
    <AppShell>
      <div className="mx-4 mt-12 rounded-xl border border-alert/30 bg-alert/5 p-6 text-center lg:mx-0">
        <ShieldAlert className="mx-auto size-7 text-alert" />
        <h1 className="mt-3 text-lg font-black">Le tableau de bord n’a pas pu être chargé</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre abonnement et vos données restent protégés. Réessayez dans quelques instants.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#181818] px-4 py-2.5 text-xs font-black text-[#f7f7f7]"
        >
          <RefreshCw className="size-4" /> Réessayer
        </button>
      </div>
    </AppShell>
  );
}
