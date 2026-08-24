import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, MousePointerClick, Pause, Play, Send } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { AdminCard, AdminLoading, AdminSection } from "@/components/AdminShell";
import { createAdminPushCampaign, getAdminPushMarketing, setAdminPushCampaignStatus } from "@/lib/push-marketing.functions";

export const Route = createFileRoute("/admin/marketing")({ component: AdminMarketingPage });

function AdminMarketingPage() {
  const queryClient = useQueryClient();
  const getOverview = useServerFn(getAdminPushMarketing);
  const createCampaign = useServerFn(createAdminPushCampaign);
  const setStatus = useServerFn(setAdminPushCampaignStatus);
  const [form, setForm] = useState({ name: "", title: "", message: "", link: "/premium", audience: "all" as "all" | "free" | "premium", startsAt: new Date().toISOString().slice(0, 16), endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16) });
  const query = useQuery({ queryKey: ["admin", "push-marketing"], queryFn: () => getOverview(), refetchInterval: 30_000 });
  const createMutation = useMutation({ mutationFn: () => createCampaign({ data: { ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() } }), onSuccess: () => { toast.success("Campagne créée en brouillon."); void queryClient.invalidateQueries({ queryKey: ["admin", "push-marketing"] }); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible.") });
  const statusMutation = useMutation({ mutationFn: (data: { id: string; status: "active" | "paused" | "completed" }) => setStatus({ data }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "push-marketing"] }) });
  function submit(event: FormEvent) { event.preventDefault(); createMutation.mutate(); }
  const rate = query.data?.sent ? Math.round(((query.data.clicked ?? 0) / query.data.sent) * 1000) / 10 : 0;

  return <AdminSection eyebrow="Acquisition responsable" title="Marketing & notifications" description="Pilotez des alertes utiles sur navigateur et application installée. Une seule campagne par utilisateur et par jour est envoyée automatiquement.">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric icon={<BellRing className="size-4" />} label="Appareils abonnés" value={query.data?.activeSubscriptions ?? "—"} />
      <Metric icon={<Send className="size-4" />} label="Notifications envoyées" value={query.data?.sent ?? "—"} />
      <Metric icon={<MousePointerClick className="size-4" />} label="Taux de clic" value={`${rate}%`} />
    </div>
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <AdminCard><h3 className="text-sm font-black">Nouvelle campagne</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Rédigez une information courte et utile. L’activation reste une action séparée.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Field label="Nom interne"><input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="admin-input" placeholder="Ex. Découverte Premium" /></Field>
          <Field label="Titre"><input required maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="admin-input" placeholder="Une analyse vous attend" /></Field>
          <Field label="Message"><textarea required maxLength={180} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="admin-input min-h-24 py-3" placeholder="Expliquez le bénéfice en une phrase." /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Destination"><input required value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="admin-input" /></Field><Field label="Audience"><select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as typeof form.audience })} className="admin-input"><option value="all">Tous</option><option value="free">Comptes gratuits</option><option value="premium">Premium</option></select></Field></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Début"><input type="datetime-local" required value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="admin-input" /></Field><Field label="Fin"><input type="datetime-local" required value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="admin-input" /></Field></div>
          <button type="submit" disabled={createMutation.isPending} className="w-full rounded-xl bg-brand px-4 py-3 text-xs font-black text-brand-foreground disabled:opacity-60">{createMutation.isPending ? "Création…" : "Créer le brouillon"}</button>
        </form>
      </AdminCard>
      <AdminCard><h3 className="text-sm font-black">Campagnes</h3>{query.isLoading ? <AdminLoading /> : <div className="mt-4 space-y-3">{(query.data?.campaigns ?? []).map((campaign: any) => <div key={campaign.id} className="rounded-xl border border-border/70 bg-surface p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><strong className="text-sm">{campaign.name}</strong><span className="rounded-full bg-card px-2 py-1 text-[9px] font-black uppercase text-muted-foreground">{campaign.status}</span></div><p className="mt-1 text-xs font-bold">{campaign.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{campaign.message}</p></div><div className="flex gap-2">{campaign.status !== "active" && campaign.status !== "completed" && <button type="button" onClick={() => statusMutation.mutate({ id: campaign.id, status: "active" })} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-[10px] font-black text-brand-foreground"><Play className="size-3" /> Activer</button>}{campaign.status === "active" && <button type="button" onClick={() => statusMutation.mutate({ id: campaign.id, status: "paused" })} className="inline-flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-[10px] font-black text-foreground ring-1 ring-border"><Pause className="size-3" /> Pause</button>}</div></div></div>)}{!query.data?.campaigns?.length && <p className="py-10 text-center text-xs text-muted-foreground">Aucune campagne créée.</p>}</div>}</AdminCard>
    </div>
  </AdminSection>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) { return <AdminCard className="p-4"><div className="flex items-center gap-2 text-brand">{icon}<span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span></div><p className="mt-2 text-xl font-black">{value}</p></AdminCard>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground"><span className="mb-1.5 block">{label}</span>{children}</label>; }

