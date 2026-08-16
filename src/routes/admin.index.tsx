import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CreditCard,
  DollarSign,
  MessageCircle,
  Users,
  Zap,
} from "lucide-react";
import { AdminCard, AdminLoading, AdminSection } from "@/components/AdminShell";
import { AdminPresence } from "@/components/AdminPresence";
import { getAdminOverview, type AdminOverview } from "@/lib/admin.functions";
import { isLocalDemo } from "@/lib/local-demo";

export const Route = createFileRoute("/admin/")({ component: AdminOverviewPage });

const DEMO: AdminOverview = {
  metrics: {
    users: 1284,
    activeUsers: 947,
    newUsers: 42,
    premium: 156,
    analyses: 4820,
    payments: 398,
    revenueXaf: 1245000,
    community: 2310,
  },
  health: {
    apiFootball: {
      configured: true,
      quota: {
        updatedAt: Date.now(),
        blockedUntil: 0,
        dayLimit: 7500,
        dayRemaining: 6412,
        minuteLimit: 300,
        minuteRemaining: 278,
      },
      cache: { available: true, stale: false, storedAt: Date.now() - 12000 },
    },
    ai: true,
    fapshi: true,
    cloudflare: true,
  },
  pending: { payments: 4, criticalActions: 2, suspendedUsers: 7 },
  generatedAt: new Date().toISOString(),
};

function AdminOverviewPage() {
  const demo = isLocalDemo();
  const getOverview = useServerFn(getAdminOverview);
  const query = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => getOverview(),
    enabled: !demo,
    refetchInterval: 30_000,
  });
  if (!demo && query.isLoading) return <AdminLoading />;
  if (!demo && query.isError)
    return (
      <AdminError
        message="La vue générale est momentanément indisponible."
        onRetry={() => query.refetch()}
      />
    );
  const data = demo ? DEMO : query.data!;
  const metrics = [
    {
      label: "Utilisateurs",
      value: data.metrics.users.toLocaleString("fr-FR"),
      hint: `${data.metrics.activeUsers.toLocaleString("fr-FR")} actifs`,
      Icon: Users,
      color: "text-brand",
    },
    {
      label: "Premium actifs",
      value: data.metrics.premium.toLocaleString("fr-FR"),
      hint: `${data.metrics.newUsers} nouveaux inscrits aujourd'hui`,
      Icon: Zap,
      color: "text-violet-500",
    },
    {
      label: "Analyses",
      value: data.metrics.analyses.toLocaleString("fr-FR"),
      hint: "prédictions enregistrées",
      Icon: BarChart3,
      color: "text-sky-500",
    },
    {
      label: "Revenus",
      value: `${data.metrics.revenueXaf.toLocaleString("fr-FR")} FCFA`,
      hint: `${data.metrics.payments} paiements`,
      Icon: DollarSign,
      color: "text-amber-500",
    },
  ];
  return (
    <AdminSection
      eyebrow="Centre de contrôle"
      title="Vue générale"
      description="Un aperçu opérationnel du SaaS, de la performance commerciale et de la santé technique."
    >
      <AdminPresence />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, hint, Icon, color }) => (
          <AdminCard key={label}>
            <div className={`flex items-center gap-2 ${color}`}>
              <Icon className="size-4" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {label}
              </span>
            </div>
            <p className="mt-3 text-2xl font-black tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </AdminCard>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black">Santé des services</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Configuration et fraîcheur des dépendances critiques.
              </p>
            </div>
            <Activity className="size-5 text-brand" />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {[
              [
                "API-Football",
                data.health.apiFootball.configured,
                data.health.apiFootball.cache.stale ? "Cache ancien" : "Cache à jour",
              ],
              ["Intelligence IA", data.health.ai, "OpenRouter configuré"],
              ["Paiements Fapshi", data.health.fapshi, "Webhook configuré"],
              ["Cloudflare", data.health.cloudflare, "Worker actif"],
            ].map(([label, ok, hint]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between rounded-xl bg-surface p-3"
              >
                <div>
                  <p className="text-xs font-bold">{label}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
                </div>
                {ok ? (
                  <CheckCircle2 className="size-4 text-brand" />
                ) : (
                  <span className="size-2 rounded-full bg-alert" />
                )}
              </div>
            ))}
          </div>
        </AdminCard>
        <AdminCard>
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            <p className="text-sm font-black">À traiter</p>
          </div>
          <div className="mt-4 space-y-2">
            {[
              { label: "Paiements en attente", value: data.pending.payments, Icon: CreditCard },
              { label: "Actions critiques", value: data.pending.criticalActions, Icon: Users },
              { label: "Utilisateurs suspendus", value: data.pending.suspendedUsers, Icon: Users },
            ].map(({ label, value, Icon }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border border-border/60 p-3"
              >
                <span className="flex items-center gap-2 text-xs font-bold">
                  <Icon className="size-4 text-muted-foreground" />
                  {label}
                </span>
                <span className="rounded-full bg-warn/15 px-2 py-1 text-xs font-black text-warn">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <AdminCard>
          <p className="text-xs font-bold text-muted-foreground">Quota API restant</p>
          <p className="mt-2 text-xl font-black">
            {data.health.apiFootball.quota.dayRemaining ?? "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            sur {data.health.apiFootball.quota.dayLimit ?? "—"} appels/jour
          </p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-bold text-muted-foreground">Communauté</p>
          <p className="mt-2 text-xl font-black">
            {data.metrics.community.toLocaleString("fr-FR")}
          </p>
          <p className="text-[10px] text-muted-foreground">messages et interactions</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs font-bold text-muted-foreground">Dernière actualisation</p>
          <p className="mt-2 text-xl font-black">
            {new Date(data.generatedAt).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-[10px] text-muted-foreground">données administratives</p>
        </AdminCard>
      </div>
    </AdminSection>
  );
}

function AdminError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <AdminCard>
      <p className="text-sm font-bold">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-xl bg-foreground px-3 py-2 text-xs font-black text-background"
      >
        Réessayer
      </button>
    </AdminCard>
  );
}
