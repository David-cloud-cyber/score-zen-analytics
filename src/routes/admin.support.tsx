import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminCard, AdminLoading, AdminSection } from "@/components/AdminShell";
import { adminReplySupport, getAdminSupportTickets, getAdminSupportThread, setSupportStatus } from "@/lib/support.functions";

export const Route = createFileRoute("/admin/support")({ component: AdminSupportPage });

const SUPPORT_STATUS_LABELS: Record<string, string> = { open: "Ouvert", waiting_support: "En attente support", waiting_user: "En attente utilisateur", resolved: "Résolu", closed: "Fermé" };
const SUPPORT_CATEGORY_LABELS: Record<string, string> = { payment: "Paiement", analysis: "Analyse", account: "Compte", premium: "Premium", partner: "Partenaire", bug: "Bug", other: "Autre" };

function AdminSupportPage() {
  const listFn = useServerFn(getAdminSupportTickets);
  const threadFn = useServerFn(getAdminSupportThread);
  const replyFn = useServerFn(adminReplySupport);
  const statusFn = useServerFn(setSupportStatus);
  const query = useQuery({ queryKey: ["admin", "support"], queryFn: () => listFn({ data: { status: "all" } }), refetchInterval: 15_000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const thread = useQuery({ queryKey: ["admin", "support", selectedId], queryFn: () => threadFn({ data: { ticketId: selectedId! } }), enabled: Boolean(selectedId), refetchInterval: 15_000 });

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !reply.trim()) return;
    try { await replyFn({ data: { ticketId: selectedId, message: reply } }); setReply(""); await thread.refetch(); await query.refetch(); } catch (error) { toast.error(error instanceof Error ? error.message : "La réponse n'a pas pu être envoyée."); }
  }
  async function updateStatus(status: "open" | "waiting_support" | "waiting_user" | "resolved" | "closed") {
    if (!selectedId) return;
    try { await statusFn({ data: { ticketId: selectedId, status } }); await query.refetch(); await thread.refetch(); } catch (error) { toast.error(error instanceof Error ? error.message : "Le statut n'a pas pu être mis à jour."); }
  }
  if (query.isLoading) return <AdminLoading />;
  return <AdminSection eyebrow="Relation utilisateur" title="Support" description="Répondez aux demandes privées et suivez les sujets qui nécessitent une intervention.">
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <AdminCard className="space-y-2">{(query.data ?? []).map((ticket: any) => <button type="button" key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`w-full rounded-xl p-3 text-left ring-1 ring-border/60 ${selectedId === ticket.id ? "bg-brand/10 ring-brand/30" : "bg-surface hover:bg-muted"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-black">{ticket.subject}</span><span className="text-[10px] font-bold text-brand">{SUPPORT_STATUS_LABELS[ticket.status] ?? "À vérifier"}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{SUPPORT_CATEGORY_LABELS[ticket.category] ?? "Autre"} · {new Date(ticket.updated_at).toLocaleString("fr-FR")}</p></button>)}{!(query.data ?? []).length && <p className="py-10 text-center text-xs text-muted-foreground">Aucune demande support.</p>}</AdminCard>
      <AdminCard>{selectedId && thread.data ? <>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3"><div><div className="flex items-center gap-2"><LifeBuoy className="size-4 text-brand" aria-hidden /><p className="text-sm font-black">{thread.data.ticket.subject}</p></div><p className="mt-1 text-[10px] text-muted-foreground">{thread.data.user?.displayName ?? "Utilisateur"}{thread.data.user?.email ? ` · ${thread.data.user.email}` : ""}</p></div><label className="sr-only" htmlFor="support-status">Statut du ticket</label><select id="support-status" value={thread.data.ticket.status} onChange={(event) => void updateStatus(event.target.value as "open" | "waiting_support" | "waiting_user" | "resolved" | "closed")} className="rounded-lg border border-border bg-surface px-2 py-2 text-[10px] font-bold text-foreground">{Object.entries(SUPPORT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto">{thread.data.messages.map((item: any) => <div key={item.id} className={`max-w-[85%] rounded-2xl p-3 text-xs ${item.author_role === "user" ? "bg-surface" : "ml-auto bg-brand/10"}`}><p>{item.message}</p><p className="mt-1 text-[9px] text-muted-foreground">{item.author_role === "user" ? "Utilisateur" : "Support"} · {new Date(item.created_at).toLocaleString("fr-FR")}</p></div>)}</div>
        <form onSubmit={(event) => void send(event)} className="mt-4 flex gap-2"><input required value={reply} onChange={(event) => setReply(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted-foreground" placeholder="Répondre à l'utilisateur..." /><button type="submit" className="grid size-11 place-items-center rounded-xl bg-brand text-brand-foreground" aria-label="Envoyer la réponse"><Send className="size-4" aria-hidden /></button></form>
      </> : <div className="py-16 text-center text-xs text-muted-foreground"><LifeBuoy className="mx-auto size-8 text-brand/50" aria-hidden /><p className="mt-3">Sélectionnez une demande.</p></div>}</AdminCard>
    </div>
  </AdminSection>;
}
