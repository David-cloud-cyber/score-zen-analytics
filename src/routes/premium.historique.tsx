import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Crown, History, Info, Lock, Target, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { buildRouteMeta } from "@/lib/seo";
import { useSession } from "@/hooks/use-session";
import { getPredictionHistory, type PredictionHistoryData, type PredictionHistoryItem } from "@/lib/prediction-history.functions";
import { cn } from "@/lib/utils";
import { isLocalDemo } from "@/lib/local-demo";

export const Route = createFileRoute("/premium/historique")({
  head: () =>
    buildRouteMeta({
      path: "/premium/historique",
      title: "Historique des prédictions Premium — Livefoot IA",
      description: "Consultez vos analyses Livefoot, leurs résultats réglés et vos statistiques personnelles.",
      noindex: true,
    }),
  component: PredictionHistoryPage,
});

const DEMO_HISTORY: PredictionHistoryData = {
  isPremium: true,
  items: [
    {
      id: "demo-history-1",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      matchId: "demo-1",
      createdAt: "2026-08-12T16:10:00.000Z",
      market: "1X2",
      marketLabel: "Issue du match",
      pick: "Arsenal",
      confidence: 78,
      odd: 1.72,
      probabilities: { home: 62, draw: 21, away: 17 },
      probableScore: "2-1",
      markets: [],
      status: "won",
      outcome: "home",
      finalScore: "2-1",
      settledAt: "2026-08-12T18:02:00.000Z",
    },
    {
      id: "demo-history-2",
      homeTeam: "Real Madrid",
      awayTeam: "Atlético Madrid",
      matchId: "demo-2",
      createdAt: "2026-08-11T17:00:00.000Z",
      market: "total_goals",
      marketLabel: "Total de buts",
      pick: "Moins de 3,5 buts",
      confidence: 71,
      odd: null,
      probabilities: { home: 48, draw: 29, away: 23 },
      probableScore: "1-1",
      markets: [],
      status: "pending",
      outcome: null,
      finalScore: null,
      settledAt: null,
    },
  ],
  summary: { total: 2, settled: 1, won: 1, lost: 0, pending: 1, unresolvable: 0, hitRate: 100, theoreticalRoi: 0.72 },
  page: 1,
  pageSize: 20,
  total: 2,
  hasMore: false,
  filters: { status: "all", market: "all", team: "", period: "all" },
  warning: null,
};

type StatusFilter = "all" | PredictionHistoryItem["status"];
type MarketFilter = "all" | PredictionHistoryItem["market"];
type PeriodFilter = "all" | "7d" | "30d" | "90d";

function PredictionHistoryPage() {
  const demoMode = isLocalDemo();
  const { user, loading: sessionLoading } = useSession();
  const navigate = useNavigate();
  const getHistory = useServerFn(getPredictionHistory);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [market, setMarket] = useState<MarketFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [team, setTeam] = useState("");
  const [page, setPage] = useState(1);
  const filters = useMemo(() => ({ page, pageSize: 20, status, market, period, team }), [page, status, market, period, team]);
  const query = useQuery<PredictionHistoryData>({
    queryKey: ["premium", "prediction-history", filters],
    queryFn: () => getHistory({ data: filters }),
    enabled: Boolean(user) && !demoMode,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!demoMode && !sessionLoading && !user) {
      navigate({ to: "/auth", search: { redirect: "/premium/historique" } });
    }
  }, [demoMode, sessionLoading, user, navigate]);

  useEffect(() => setPage(1), [status, market, period, team]);

  if (sessionLoading || (!demoMode && !user) || (!demoMode && query.isLoading)) return <HistoryLoading />;
  if (!demoMode && query.isError) return <HistoryError onRetry={() => query.refetch()} />;
  const data = demoMode ? DEMO_HISTORY : query.data!;

  return (
    <AppShell>
      <div className="space-y-5 px-4 pb-12 pt-4 lg:px-0">
        <header className="flex items-start justify-between gap-3">
          <div>
            <Link to="/premium/tableau-de-bord" search={{}} className="mb-3 inline-flex items-center gap-1.5 text-xs font-black text-brand hover:underline">
              <ArrowLeft className="size-3.5" /> Retour au Hub
            </Link>
            <div className="flex items-center gap-2 text-brand">
              <History className="size-5" />
              <p className="text-[10px] font-black uppercase tracking-widest">Suivi personnel</p>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Historique des prédictions</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Consultez vos analyses déjà enregistrées, sans nouveau débit de crédits. Les verdicts sont calculés uniquement après un statut final officiel.
            </p>
          </div>
          {data.isPremium && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-[10px] font-black text-brand"><Crown className="size-3.5" /> Premium</span>}
        </header>

        {demoMode && <DemoNotice />}
        {data.warning && <div className="flex items-start gap-2 rounded-xl border border-brand/25 bg-brand/5 p-3 text-xs text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0 text-brand" />{data.warning}</div>}

        <HistorySummary data={data} />
        <HistoryFilters status={status} market={market} period={period} team={team} onStatus={setStatus} onMarket={setMarket} onPeriod={setPeriod} onTeam={setTeam} />
        <HistoryResults data={data} />

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <span className="text-xs text-muted-foreground">{data.total} analyse(s) dans cette sélection</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid size-9 place-items-center rounded-xl border border-border/70 bg-card text-foreground transition-colors hover:bg-surface disabled:opacity-40" aria-label="Page précédente"><ChevronLeft className="size-4" /></button>
            <span className="min-w-8 text-center text-xs font-black">{page}</span>
            <button type="button" disabled={!data.hasMore} onClick={() => setPage((value) => value + 1)} className="grid size-9 place-items-center rounded-xl border border-border/70 bg-card text-foreground transition-colors hover:bg-surface disabled:opacity-40" aria-label="Page suivante"><ChevronRight className="size-4" /></button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function HistorySummary({ data }: { data: PredictionHistoryData }) {
  const metrics = [
    ["Analyses", data.summary.total, <History className="size-4" />],
    ["Réglées", data.summary.settled, <Check className="size-4" />],
    ["Taux de réussite", data.summary.hitRate === null ? "—" : `${data.summary.hitRate}%`, <Target className="size-4" />],
    ["En attente", data.summary.pending, <Info className="size-4" />],
  ] as const;
  return <section aria-label="Résumé de l'historique" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{metrics.map(([label, value, icon]) => <div key={label} className="score-card p-3"><span className="text-brand">{icon}</span><p className="mt-2 text-xl font-black tabular-nums">{value}</p><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p></div>)}</section>;
}

function HistoryFilters({
  status, market, period, team, onStatus, onMarket, onPeriod, onTeam,
}: {
  status: StatusFilter; market: MarketFilter; period: PeriodFilter; team: string;
  onStatus: (value: StatusFilter) => void; onMarket: (value: MarketFilter) => void; onPeriod: (value: PeriodFilter) => void; onTeam: (value: string) => void;
}) {
  const selectClass = "h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-xs font-bold outline-none focus:border-brand sm:w-auto";
  return <section aria-label="Filtres de l'historique" className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
    <select value={status} onChange={(event) => onStatus(event.target.value as StatusFilter)} className={selectClass} aria-label="Filtrer par statut"><option value="all">Tous les statuts</option><option value="pending">En attente</option><option value="won">Gagnées</option><option value="lost">Perdues</option><option value="unresolvable">Non réglables</option></select>
    <select value={market} onChange={(event) => onMarket(event.target.value as MarketFilter)} className={selectClass} aria-label="Filtrer par marché"><option value="all">Tous les marchés</option><option value="1X2">1X2</option><option value="double_chance">Double chance</option><option value="btts">BTTS</option><option value="total_goals">Total de buts</option></select>
    <select value={period} onChange={(event) => onPeriod(event.target.value as PeriodFilter)} className={selectClass} aria-label="Filtrer par période"><option value="all">Toute la période</option><option value="7d">7 derniers jours</option><option value="30d">30 derniers jours</option><option value="90d">90 derniers jours</option></select>
    <input value={team} onChange={(event) => onTeam(event.target.value)} placeholder="Rechercher une équipe" className="h-10 min-w-0 flex-1 rounded-xl border border-border/70 bg-card px-3 text-xs font-bold outline-none placeholder:text-muted-foreground focus:border-brand" />
  </section>;
}

function HistoryResults({ data }: { data: PredictionHistoryData }) {
  if (!data.items.length) return <div className="score-empty-state p-8"><History className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 text-sm font-bold">Aucune analyse dans cette sélection</p><p className="mt-1 text-xs text-muted-foreground">Modifiez vos filtres ou lancez une nouvelle analyse.</p></div>;
  return <>
    <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card lg:block"><table className="w-full text-left text-xs"><thead className="border-b border-border/60 bg-surface"><tr><th className="p-3 font-black">Match</th><th className="p-3 font-black">Marché / choix</th><th className="p-3 font-black">Confiance</th><th className="p-3 font-black">Statut</th><th className="p-3 font-black">Résultat</th><th className="p-3" /></tr></thead><tbody className="divide-y divide-border/60">{data.items.map((item) => <HistoryTableRow key={item.id} item={item} />)}</tbody></table></div>
    <div className="space-y-2 lg:hidden">{data.items.map((item) => <HistoryCard key={item.id} item={item} />)}</div>
  </>;
}

function statusTone(status: PredictionHistoryItem["status"]) {
  return status === "won" ? "bg-brand/10 text-brand" : status === "lost" ? "bg-alert/10 text-alert" : "bg-surface text-muted-foreground";
}

function statusText(status: PredictionHistoryItem["status"]) {
  return { pending: "En attente", won: "Gagnée", lost: "Perdue", unresolvable: "Non réglable" }[status];
}

function HistoryTableRow({ item }: { item: PredictionHistoryItem }) {
  return <tr><td className="p-3"><p className="font-black">{item.homeTeam} <span className="text-muted-foreground">vs</span> {item.awayTeam}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("fr-FR")}</p></td><td className="p-3"><p className="font-bold">{item.marketLabel}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.pick}</p></td><td className="p-3 font-black text-brand">{item.confidence === null ? "—" : `${item.confidence}%`}</td><td className="p-3"><span className={cn("rounded-full px-2 py-1 text-[10px] font-black", statusTone(item.status))}>{statusText(item.status)}</span></td><td className="p-3 font-bold">{item.finalScore ?? "—"}</td><td className="p-3 text-right"><HistoryLink item={item} /></td></tr>;
}

function HistoryCard({ item }: { item: PredictionHistoryItem }) {
  return <article className="rounded-xl border border-border/70 bg-card p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black">{item.homeTeam} <span className="text-muted-foreground">vs</span> {item.awayTeam}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("fr-FR")} · {item.marketLabel}</p></div><span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-black", statusTone(item.status))}>{statusText(item.status)}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-surface p-2"><p className="text-[9px] font-bold uppercase text-muted-foreground">Choix</p><p className="mt-1 font-black">{item.pick}</p></div><div className="rounded-lg bg-surface p-2"><p className="text-[9px] font-bold uppercase text-muted-foreground">Confiance</p><p className="mt-1 font-black text-brand">{item.confidence === null ? "—" : `${item.confidence}%`}</p></div></div><div className="mt-3 flex items-center justify-between"><span className="text-xs font-bold">Score : {item.finalScore ?? "en attente"}</span><HistoryLink item={item} /></div></article>;
}

function HistoryLink({ item }: { item: PredictionHistoryItem }) {
  return <Link to="/analyse" search={{ home: item.homeTeam, away: item.awayTeam, matchId: item.matchId ?? undefined }} className="inline-flex items-center gap-1 text-[11px] font-black text-brand hover:underline">Voir l'analyse <ChevronRight className="size-3.5" /></Link>;
}

function DemoNotice() { return <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-bold text-brand"><SparklesIcon /> Aperçu local · données fictives · aucune action serveur utilisée</div>; }
function SparklesIcon() { return <History className="size-3.5 shrink-0" aria-hidden />; }
function HistoryLoading() { return <AppShell><div className="space-y-4 px-4 pt-6 lg:px-0"><div className="h-8 w-64 animate-pulse rounded-lg bg-surface" /><div className="h-24 animate-pulse rounded-xl bg-surface" /><div className="h-64 animate-pulse rounded-xl bg-surface" /></div></AppShell>; }
function HistoryError({ onRetry }: { onRetry: () => void }) { return <AppShell><div className="mx-4 mt-8 rounded-xl border border-alert/40 bg-alert/5 p-6 text-center lg:mx-0"><X className="mx-auto size-7 text-alert" /><p className="mt-2 text-sm font-black">Historique momentanément indisponible</p><button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-foreground px-4 py-2 text-xs font-black text-background">Réessayer</button></div></AppShell>; }
