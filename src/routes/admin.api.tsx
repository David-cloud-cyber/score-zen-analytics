import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CheckCircle2, Database, KeyRound, RefreshCw, Server, TriangleAlert } from "lucide-react";
import { AdminCard, AdminLoading, AdminSection } from "@/components/AdminShell";
import { getAdminApiHealth } from "@/lib/admin.functions";
import { isLocalDemo } from "@/lib/local-demo";

export const Route = createFileRoute("/admin/api")({ component: AdminApiPage });

function AdminApiPage() {
  const demo = isLocalDemo();
  const getHealth = useServerFn(getAdminApiHealth);
  const query = useQuery({ queryKey: ["admin", "api"], queryFn: () => getHealth(), enabled: !demo, refetchInterval: 30_000 });
  const data = demo ? { apiFootball: { configured: true, quota: { dayRemaining: 6412, dayLimit: 7500, minuteRemaining: 278, minuteLimit: 300 }, cache: { stale: false, storedAt: Date.now() - 12000 } }, aiConfigured: true, saspayConfigured: true, relayitConfigured: false, relayitCredentialStatus: "missing", paymentProvider: "saspay", cloudflareConfigured: true, checkedAt: new Date().toISOString() } : query.data;
  if (!demo && query.isLoading) return <AdminLoading />;
  const cache = data?.apiFootball.cache;
  const cacheState = !cache ? "Aucun snapshot" : cache.stale ? "Snapshot à vérifier" : "Snapshot disponible";
  const services = [
    { label: "API-Football", status: data?.apiFootball.configured ? "Clé configurée" : "Non configurée", ok: Boolean(data?.apiFootball.configured), Icon: KeyRound },
    { label: "Cache partagé", status: cacheState, ok: Boolean(cache && !cache.stale), Icon: Database },
    { label: "IA", status: data?.aiConfigured ? "Clé configurée" : "Non configurée", ok: Boolean(data?.aiConfigured), Icon: Activity },
    { label: "Paiements SasPay", status: data?.saspayConfigured ? "Clé configurée" : "Non configurée", ok: Boolean(data?.saspayConfigured), Icon: Server },
    { label: "Paiements Relayit", status: !data?.relayitConfigured ? "Clé ou webhook manquant" : data.relayitCredentialStatus === "valid" ? "Clé vérifiée · webhook configuré" : data.relayitCredentialStatus === "invalid" ? "Clé refusée par Relayit" : "Vérification du fournisseur indisponible", ok: Boolean(data?.relayitConfigured && data.relayitCredentialStatus === "valid"), Icon: Server },
    { label: "Prestataire actif", status: data?.paymentProvider === "relayit" ? "Relayit" : "SasPay", ok: true, Icon: CheckCircle2 },
  ];
  const checkedAt = data?.checkedAt ? new Date(data.checkedAt).toLocaleString("fr-FR") : "—";
  return <AdminSection eyebrow="Observabilité" title="Matchs & API" description="Vérifiez la configuration, la fraîcheur du cache et les quotas connus sans exposer de secret ni présenter une configuration comme un test fournisseur.">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{services.map(({ label, status, ok, Icon }) => <AdminCard key={label}><Icon className="size-5 text-brand" aria-hidden /><p className="mt-3 text-sm font-black">{label}</p><p className={`mt-1 flex items-center gap-1 text-xs ${ok ? "text-brand" : "text-alert"}`}>{ok ? <CheckCircle2 className="size-3" aria-hidden /> : <TriangleAlert className="size-3" aria-hidden />}{status}</p></AdminCard>)}</div>
    <AdminCard>
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">Quota et fraîcheur API-Football</p><p className="mt-1 text-xs text-muted-foreground">Les valeurs affichées viennent du dernier état serveur connu. Un quota non remonté reste « — ».</p></div><button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} aria-label="Actualiser l’état des API" className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface text-foreground hover:border-brand/50 disabled:opacity-50"><RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden /></button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Jour restant", data?.apiFootball.quota.dayRemaining ?? "—"], ["Limite jour", data?.apiFootball.quota.dayLimit ?? "—"], ["Minute restante", data?.apiFootball.quota.minuteRemaining ?? "—"], ["Limite minute", data?.apiFootball.quota.minuteLimit ?? "—"]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-surface p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>)}</div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground"><span>Dernière vérification : {checkedAt}</span><span>Cache : {cache?.storedAt ? new Date(cache.storedAt).toLocaleString("fr-FR") : "aucune date"}</span></div>
    </AdminCard>
  </AdminSection>;
}
