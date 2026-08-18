import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bug, History, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminCard, AdminLoading, AdminSection } from "@/components/AdminShell";
import { approveAdminCriticalAction, getAdminActionRequests, getAdminAuditLog, getAdminIncidents } from "@/lib/admin.functions";
import { isLocalDemo } from "@/lib/local-demo";
export const Route = createFileRoute("/admin/audit")({ component: AdminAuditPage });
function AdminAuditPage() {
  const demo = isLocalDemo();
  const queryClient = useQueryClient();
  const getAudit = useServerFn(getAdminAuditLog);
  const getRequests = useServerFn(getAdminActionRequests);
  const getIncidents = useServerFn(getAdminIncidents);
  const approve = useServerFn(approveAdminCriticalAction);
  const audit = useQuery({ queryKey: ["admin", "audit"], queryFn: () => getAudit({ data: { page: 1, pageSize: 100, search: "" } }), enabled: !demo });
  const requests = useQuery({ queryKey: ["admin", "requests"], queryFn: () => getRequests(), enabled: !demo });
  const incidents = useQuery({ queryKey: ["admin", "incidents"], queryFn: () => getIncidents({ data: { page: 1, pageSize: 50, search: "" } }), enabled: !demo, staleTime: 15_000 });
  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approve({ data: { requestId, reason: "Validation propriétaire de la demande." } }),
    onSuccess: async () => {
      toast.success("Action validée et journalisée.");
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["admin", "requests"] }), queryClient.invalidateQueries({ queryKey: ["admin", "audit"] }), queryClient.invalidateQueries({ queryKey: ["admin", "vip"] })]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Validation impossible."),
  });
  const entries = demo ? [{ id: "demo", actor_id: "owner", action: "user.suspend", target_type: "user", target_id: "demo", reason: "Test de modération", created_at: new Date().toISOString() }] : audit.data?.entries ?? [];
  const pending = demo ? [] : (requests.data ?? []).filter((item: any) => item.status === "pending");
  return <AdminSection eyebrow="Traçabilité" title="Audit & sécurité" description="Historique immuable des actions administratives et demandes critiques.">
    <AdminCard>
      <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand" /><p className="text-sm font-black">Demandes critiques</p><span className="ml-auto rounded-full bg-warn/15 px-2 py-1 text-[10px] font-black text-warn">{demo ? 1 : pending.length} en attente</span></div>
      <p className="mt-2 text-xs text-muted-foreground">Les actions irréversibles nécessitent un admin demandeur et un propriétaire validateur distincts.</p>
      {pending.length > 0 && <div className="mt-4 space-y-2">{pending.map((item: any) => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-warn/25 bg-warn/5 p-3"><div className="min-w-0 flex-1"><p className="text-xs font-black">{item.action_type === "vip_grant" ? "Activation VIP" : item.action_type}</p><p className="truncate text-[11px] text-muted-foreground">{item.reason} · demandeur {item.requested_by}</p></div><button type="button" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(item.id)} className="rounded-lg bg-brand px-3 py-2 text-[11px] font-black text-brand-foreground disabled:opacity-60">Valider comme propriétaire</button></div>)}</div>}
    </AdminCard>
    {!demo && audit.isLoading ? <AdminLoading /> : <AdminCard className="overflow-x-auto p-0"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-border/60 bg-surface"><tr>{["Action", "Cible", "Motif", "Acteur", "Date"].map((label) => <th key={label} className="p-3 font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/60">{entries.map((entry: any) => <tr key={entry.id}><td className="p-3"><span className="inline-flex items-center gap-1 font-black"><History className="size-3 text-brand" />{entry.action}</span></td><td className="p-3">{entry.target_type} · {entry.target_id ?? "—"}</td><td className="p-3 text-muted-foreground">{entry.reason ?? "—"}</td><td className="p-3 text-muted-foreground">{entry.actor_id}</td><td className="p-3 text-muted-foreground">{new Date(entry.created_at).toLocaleString("fr-FR")}</td></tr>)}</tbody></table></AdminCard>}
    <AdminCard>
      <div className="flex items-center gap-2"><Bug className="size-4 text-brand" /><p className="text-sm font-black">Incidents de chargement</p><span className="ml-auto rounded-full bg-surface px-2 py-1 text-[10px] font-black text-muted-foreground">{demo ? 0 : incidents.data?.total ?? 0}</span></div>
      <p className="mt-2 text-xs text-muted-foreground">Suivi privé anonymisé des erreurs de rendu, données et fournisseurs. Aucun email ni secret n’est conservé.</p>
      {!demo && incidents.isLoading ? <AdminLoading /> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-border/60 bg-surface"><tr>{["Catégorie", "Route", "Statut", "Appareil", "Référence", "Date"].map((label) => <th key={label} className="p-3 font-black">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/60">{(demo ? [] : incidents.data?.entries ?? []).map((entry) => <tr key={entry.id}><td className="p-3 font-black">{entry.category}</td><td className="p-3 text-muted-foreground">{entry.route}</td><td className="p-3">{entry.status_code}</td><td className="p-3">{entry.device_family}</td><td className="p-3 font-mono text-[10px]">{entry.incident_id}</td><td className="p-3 text-muted-foreground">{new Date(entry.created_at).toLocaleString("fr-FR")}</td></tr>)}</tbody></table>{!demo && !incidents.data?.entries.length && <p className="mt-3 rounded-xl bg-surface p-4 text-center text-xs font-bold text-muted-foreground">Aucun incident récent.</p>}</div>}
    </AdminCard>
  </AdminSection>;
}
