import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { Activity, BarChart3, BrainCircuit, CalendarDays, Clock3, Target } from "lucide-react";
import { AdminCard, AdminLoading, AdminSection } from "@/components/AdminShell";
import {
  getAdminAnalyses,
  getAdminDailyPredictionsStatus,
  getAdminPredictionQuality,
} from "@/lib/admin.functions";
import { isLocalDemo } from "@/lib/local-demo";

export const Route = createFileRoute("/admin/analyses")({ component: AdminAnalysesPage });

function AdminAnalysesPage() {
  const demo = isLocalDemo();
  const getAnalyses = useServerFn(getAdminAnalyses);
  const getQuality = useServerFn(getAdminPredictionQuality);
  const getDailyStatus = useServerFn(getAdminDailyPredictionsStatus);
  const query = useQuery({
    queryKey: ["admin", "analyses"],
    queryFn: () => getAnalyses({ data: { page: 1, pageSize: 50, search: "" } }),
    enabled: !demo,
    refetchInterval: 30_000,
  });
  const qualityQuery = useQuery({
    queryKey: ["admin", "prediction-quality"],
    queryFn: () => getQuality(),
    enabled: !demo,
    refetchInterval: 30_000,
  });
  const dailyStatusQuery = useQuery({
    queryKey: ["admin", "daily-predictions-status"],
    queryFn: () => getDailyStatus(),
    enabled: !demo,
    refetchInterval: 30_000,
  });
  const rows = demo
    ? [
        {
          id: "demo",
          user_id: "demo",
          home_team: "Arsenal",
          away_team: "Chelsea",
          match_id: "1",
          prediction_market: "1X2",
          prediction_pick: "Arsenal",
          prediction_confidence: 78,
          ai_status: "ai_enriched",
          data_quality_score: 92,
          ai_latency_ms: 1450,
          settlement_status: "won",
          final_score: "2-1",
          created_at: new Date().toISOString(),
          settled_at: new Date().toISOString(),
        },
      ]
    : (query.data?.analyses ?? []);
  const quality = demo
    ? {
        total: 1,
        settled: 1,
        won: 1,
        lost: 0,
        unresolvable: 0,
        hitRate: 100,
        brierScore: 0.048,
        logLoss: 0.22,
        aiEnriched: 1,
        aiFallback: 0,
        statisticalOnly: 0,
        aiSuccessRate: 100,
        averageDataQuality: 92,
        averageAiLatencyMs: 1450,
        byMarket: [{ market: "1X2", settled: 1, won: 1, hitRate: 100 }],
        byConfidence: [{ label: "75 % et +", settled: 1, won: 1, hitRate: 100 }],
        engineVersions: [{ version: "v2.1.0", total: 1 }],
      }
    : qualityQuery.data;

  return (
    <AdminSection
      eyebrow="Qualité prédictive"
      title="Analyses & prédictions"
      description="Suivez la qualité réelle des analyses enregistrées et de leur règlement."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <QualityCard
          icon={<Target className="size-4" />}
          label="Taux de réussite"
          value={quality?.hitRate == null ? "—" : `${quality.hitRate}%`}
        />
        <QualityCard
          icon={<BarChart3 className="size-4" />}
          label="Pronostics distincts réglés"
          value={quality?.settled ?? "—"}
        />
        <QualityCard
          icon={<BrainCircuit className="size-4" />}
          label="Enrichies par l’IA"
          value={quality?.aiEnriched ?? "—"}
        />
        <QualityCard
          icon={<BarChart3 className="size-4" />}
          label="Brier score"
          value={quality?.brierScore ?? "—"}
        />
        <QualityCard
          icon={<Activity className="size-4" />}
          label="Qualité moyenne"
          value={quality?.averageDataQuality == null ? "—" : `${quality.averageDataQuality}%`}
        />
        <QualityCard
          icon={<Clock3 className="size-4" />}
          label="Latence IA"
          value={quality?.averageAiLatencyMs == null ? "—" : `${quality.averageAiLatencyMs} ms`}
        />
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Taux calculé hors abstentions et répétitions du même choix sur un match. Un petit
        échantillon ne permet pas de conclure sur la précision globale. Brier 1X2 : 0 est optimal, 2
        est le maximum.
      </p>
      <AdminCard>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-brand">
              <CalendarDays className="size-3.5" /> Pronostics du jour
            </p>
            <h3 className="mt-1 text-sm font-black">
              Publication du {dailyStatusQuery.data?.date ?? "—"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Les visiteurs reçoivent un aperçu protégé, les comptes gratuits lisent jusqu’à trois
              sélections et Premium lit toutes les sélections publiées.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <MetricInline
              label="Publiées"
              value={demo ? 3 : (dailyStatusQuery.data?.published ?? "—")}
            />
            <MetricInline
              label="À venir"
              value={demo ? 3 : (dailyStatusQuery.data?.pending ?? "—")}
            />
            <MetricInline
              label="Réglées"
              value={demo ? 0 : (dailyStatusQuery.data?.settled ?? "—")}
            />
          </div>
        </div>
        {(demo
          ? [
              { name: "Premier League", count: 1 },
              { name: "Ligue 1", count: 1 },
            ]
          : dailyStatusQuery.data?.leagues
        )?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {(demo
              ? [
                  { name: "Premier League", count: 1 },
                  { name: "Ligue 1", count: 1 },
                ]
              : (dailyStatusQuery.data?.leagues ?? [])
            ).map((league) => (
              <span
                key={league.name}
                className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-bold text-muted-foreground"
              >
                {league.name} · {league.count}
              </span>
            ))}
          </div>
        ) : null}
      </AdminCard>
      {quality && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <AdminCard>
            <p className="text-xs font-black uppercase tracking-wider">Calibration par confiance</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Une confiance élevée doit produire un meilleur taux réel, sinon le moteur est à
              recalibrer.
            </p>
            <div className="mt-4 space-y-3">
              {quality.byConfidence.map((bucket) => (
                <div key={bucket.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">{bucket.label}</span>
                    <span className="text-muted-foreground">
                      {bucket.settled} réglée(s) · {bucket.hitRate}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${bucket.hitRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>
          <AdminCard>
            <p className="text-xs font-black uppercase tracking-wider">Performance par marché</p>
            <div className="mt-4 space-y-2">
              {quality.byMarket.slice(0, 6).map((market) => (
                <div
                  key={market.market}
                  className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-xs"
                >
                  <span className="font-black">{market.market}</span>
                  <span className="text-muted-foreground">
                    {market.won}/{market.settled} ·{" "}
                    <strong className="text-foreground">{market.hitRate}%</strong>
                  </span>
                </div>
              ))}
              {!quality.byMarket.length && (
                <p className="text-xs text-muted-foreground">
                  Les performances apparaîtront après le règlement des analyses.
                </p>
              )}
            </div>
          </AdminCard>
        </div>
      )}

      {!demo && (query.isLoading || qualityQuery.isLoading) ? (
        <AdminLoading />
      ) : (
        <AdminCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-border/60 bg-surface">
              <tr>
                {["Match", "Marché", "Confiance", "IA", "Qualité", "Statut", "Score", "Créée"].map(
                  (label) => (
                    <th key={label} className="p-3 font-black">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="p-3 font-black">
                    {row.home_team} <span className="text-muted-foreground">vs</span>{" "}
                    {row.away_team}
                  </td>
                  <td className="p-3">
                    {row.prediction_market ?? "—"}
                    <p className="text-[10px] text-muted-foreground">
                      {row.prediction_pick ?? "—"}
                    </p>
                  </td>
                  <td className="p-3 text-brand">{row.prediction_confidence ?? "—"}%</td>
                  <td className="p-3 font-black">
                    {aiStatusLabel(row.ai_status)}
                    <p className="text-[10px] font-normal text-muted-foreground">
                      {row.ai_latency_ms ? `${row.ai_latency_ms} ms` : ""}
                    </p>
                  </td>
                  <td className="p-3">
                    {row.data_quality_score == null ? "—" : `${row.data_quality_score}%`}
                  </td>
                  <td className="p-3 font-black">{row.settlement_status}</td>
                  <td className="p-3">{row.final_score ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}
      {!rows.length && (
        <AdminCard>
          <BarChart3 className="size-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-bold">Aucune analyse enregistrée</p>
        </AdminCard>
      )}
    </AdminSection>
  );
}

function QualityCard({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <AdminCard className="p-4">
      <div className="flex items-center gap-2 text-brand">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-2 text-xl font-black">{value}</p>
    </AdminCard>
  );
}

function MetricInline({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="rounded-xl bg-surface px-2.5 py-2">
      <span className="block text-base font-black text-foreground">{value}</span>
      <span className="block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </span>
  );
}

function aiStatusLabel(status: string | null) {
  if (status === "ai_enriched") return "IA enrichie";
  if (status === "ai_fallback") return "IA de secours";
  if (status === "statistical_only") return "Statistique";
  if (status === "no_recommendation") return "Abstention";
  return "—";
}
