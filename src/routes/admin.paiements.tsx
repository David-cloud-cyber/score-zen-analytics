import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { AdminCard, AdminLoading, AdminSection } from "@/components/AdminShell";
import { getAdminPayments } from "@/lib/admin.functions";
import { isLocalDemo } from "@/lib/local-demo";

export const Route = createFileRoute("/admin/paiements")({ component: AdminPaymentsPage });

type PaymentStatus = "PENDING" | "SUCCESSFUL" | "FAILED" | "EXPIRED" | "UNDERPAID";

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "En attente",
  SUCCESSFUL: "Confirmé",
  FAILED: "Échoué",
  EXPIRED: "Expiré",
  UNDERPAID: "Montant incomplet",
};

function statusLabel(value: string) {
  return STATUS_LABELS[value as PaymentStatus] ?? "Statut à vérifier";
}

function statusClass(value: string) {
  if (value === "SUCCESSFUL") return "bg-brand/10 text-brand";
  if (value === "FAILED" || value === "EXPIRED" || value === "UNDERPAID") return "bg-alert/10 text-alert";
  return "bg-surface text-muted-foreground";
}

function AdminPaymentsPage() {
  const demo = isLocalDemo();
  const getPayments = useServerFn(getAdminPayments);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | PaymentStatus>("all");
  const query = useQuery({
    queryKey: ["admin", "payments", page, search, status],
    queryFn: () => getPayments({ data: { page, pageSize: 50, search, status } }),
    enabled: !demo,
    refetchInterval: 30_000,
  });
  const payments = demo
    ? [{ id: "demo", user_id: "demo", provider: "saspay", pack_id: "premium-annual", credits: 100, amount_xaf: 25000, status: "SUCCESSFUL", created_at: new Date().toISOString() }]
    : query.data?.payments ?? [];

  return <AdminSection eyebrow="Finance" title="Paiements & abonnements" description="Suivez les transactions, les retours fournisseurs et les paiements nécessitant une vérification.">
    <AdminCard className="mb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Rechercher une transaction ou une offre" aria-label="Rechercher un paiement" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="payment-status">Filtrer par statut</label>
          <select id="payment-status" value={status} onChange={(event) => { setStatus(event.target.value as "all" | PaymentStatus); setPage(1); }} className="h-10 rounded-xl border border-border bg-surface px-3 text-xs font-bold text-foreground">
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} aria-label="Actualiser les paiements" className="grid size-10 place-items-center rounded-xl border border-border bg-surface text-foreground hover:border-brand/50 disabled:opacity-50"><RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden /></button>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Actualisation automatique toutes les 30 secondes · Les paiements restent en attente jusqu’à confirmation fournisseur.</p>
    </AdminCard>

    {!demo && query.isLoading ? <AdminLoading /> : <>
      <AdminCard className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-border/60 bg-surface"><tr>{["Transaction", "Provider", "Offre", "Montant", "Crédits", "Statut", "Date"].map((label) => <th key={label} className="p-3 font-black">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-border/60">{payments.map((payment) => <tr key={payment.id}>
            <td className="p-3"><p className="font-black">{payment.id}</p><p className="max-w-[220px] truncate text-[10px] text-muted-foreground" title={payment.user_id}>{payment.user_id}</p></td>
            <td className="p-3 font-bold uppercase">{payment.provider}</td><td className="p-3 font-bold">{payment.pack_id ?? "Abonnement"}</td><td className="p-3 font-black">{Number(payment.amount_xaf).toLocaleString("fr-FR")} FCFA</td><td className="p-3 text-brand">{payment.credits ?? "—"}</td>
            <td className="p-3"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${statusClass(payment.status)}`}>{statusLabel(payment.status)}</span></td><td className="p-3 text-muted-foreground">{new Date(payment.created_at).toLocaleString("fr-FR")}</td>
          </tr>)}</tbody>
        </table>
      </AdminCard>
      <div className="space-y-3 md:hidden">{payments.map((payment) => <AdminCard key={payment.id} className="space-y-3">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-black">{payment.id}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{payment.user_id}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${statusClass(payment.status)}`}>{statusLabel(payment.status)}</span></div>
        <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-surface p-3"><p className="text-[10px] uppercase text-muted-foreground">Offre</p><p className="mt-1 font-bold">{payment.pack_id ?? "Abonnement"}</p></div><div className="rounded-xl bg-surface p-3"><p className="text-[10px] uppercase text-muted-foreground">Montant</p><p className="mt-1 font-black">{Number(payment.amount_xaf).toLocaleString("fr-FR")} FCFA</p></div></div>
        <p className="text-[11px] text-muted-foreground">{payment.provider} · {payment.credits ?? "—"} crédits · {new Date(payment.created_at).toLocaleString("fr-FR")}</p>
      </AdminCard>)}</div>
      {!payments.length && <AdminCard><CreditCard className="size-5 text-muted-foreground" aria-hidden /><p className="mt-2 text-sm font-bold">Aucun paiement correspondant</p><p className="mt-1 text-xs text-muted-foreground">Modifiez les filtres ou actualisez la liste.</p></AdminCard>}
      <div className="mt-4 flex items-center justify-between text-xs"><span className="text-muted-foreground">Page {page}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPage((current) => current - 1)} className="rounded-xl border border-border bg-surface px-3 py-2 font-bold text-foreground disabled:opacity-40">Précédent</button><button type="button" disabled={!query.data?.hasMore || query.isFetching} onClick={() => setPage((current) => current + 1)} className="rounded-xl bg-brand px-3 py-2 font-black text-brand-foreground disabled:opacity-40">Suivant</button></div></div>
    </>}
  </AdminSection>;
}
