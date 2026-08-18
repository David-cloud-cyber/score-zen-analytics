import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { BarChart3, BrainCircuit, Target } from "lucide-react";
import { AdminCard, AdminLoading, AdminSection } from "@/components/AdminShell";
import { getAdminAnalyses, getAdminPredictionQuality } from "@/lib/admin.functions";
import { isLocalDemo } from "@/lib/local-demo";

export const Route = createFileRoute("/admin/analyses")({ component: AdminAnalysesPage });

function AdminAnalysesPage() {
  const demo = isLocalDemo();
  const getAnalyses = useServerFn(getAdminAnalyses);
  const getQuality = useServerFn(getAdminPredictionQuality);
  const query = useQuery({
    queryKey: ["admin", "analyses"],
    queryFn: () => getAnalyses({ data: { page: 1, pageSize: 50, search: "" } }),
    enabled: !demo,
  });
  const qualityQuery = useQuery({
    queryKey: ["admin", "prediction-quality"],
    queryFn: () => getQuality(),
    enabled: !demo,
  });
  const rows = demo
    ? [{
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
      }]
    : query.data?.analyses ?? [];
  const quality = demo
    ? { total: 1, settled: 1, won: 1, lost: 0, unresolvable: 0, hitRate: 100, brierScore: 0.048, logLoss: 0.22, aiEnriched: 1, aiFallback: 0, statisticalOnly: 0 }
    : qualityQuery.data;

  return (
    <AdminSection
      eyebrow="Qualité prédictive"
      title="Analyses & prédictions"
      description="Suivez la qualité réelle des analyses enregistrées et de leur règlement."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QualityCard icon={<Target className="size-4" />} label="Taux de réussite" value={quality?.hitRate == null ? "—" : `${quality.hitRate}%`} />
        <QualityCard icon={<BarChart3 className="size-4" />} label="Analyses réglées" value={quality?.settled ?? "—"} />
        <QualityCard icon={<BrainCircuit className="size-4" />} label="Enrichies par l’IA" value={quality?.aiEnriched ?? "—"} />
        <QualityCard icon={<BarChart3 className="size-4" />} label="Brier score" value={quality?.brierScore ?? "—"} />
      </div>

      {!demo && (query.isLoading || qualityQuery.isLoading) ? <AdminLoading /> : (
        <AdminCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-border/60 bg-surface">
              <tr>{["Match", "Marché", "Confiance", "IA", "Qualité", "Statut", "Score", "Créée"].map((label) => <th key={label} className="p-3 font-black">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="p-3 font-black">{row.home_team} <span className="text-muted-foreground">vs</span> {row.away_team}</td>
                  <td className="p-3">{row.prediction_market ?? "—"}<p className="text-[10px] text-muted-foreground">{row.prediction_pick ?? "—"}</p></td>
                  <td className="p-3 text-brand">{row.prediction_confidence ?? "—"}%</td>
                  <td className="p-3 font-black">{row.ai_status ?? "—"}<p className="text-[10px] font-normal text-muted-foreground">{row.ai_latency_ms ? `${row.ai_latency_ms} ms` : ""}</p></td>
                  <td className="p-3">{row.data_quality_score == null ? "—" : `${row.data_quality_score}%`}</td>
                  <td className="p-3 font-black">{row.settlement_status}</td>
                  <td className="p-3">{row.final_score ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{new Date(row.created_at).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}
      {!rows.length && <AdminCard><BarChart3 className="size-5 text-muted-foreground" /><p className="mt-2 text-sm font-bold">Aucune analyse enregistrée</p></AdminCard>}
    </AdminSection>
  );
}

function QualityCard({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return <AdminCard className="p-4"><div className="flex items-center gap-2 text-brand">{icon}<span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span></div><p className="mt-2 text-xl font-black">{value}</p></AdminCard>;
}
