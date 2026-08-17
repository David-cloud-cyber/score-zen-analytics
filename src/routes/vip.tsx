import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Copy, ExternalLink, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useSession } from "@/hooks/use-session";
import { BOOKMAKERS } from "@/data/bookmakers";
import { getMyVipApplication, submitVipApplication, tierRules, type VipTier } from "@/lib/vip.functions";
import { buildRouteMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vip")({
  head: () => ({
    ...buildRouteMeta({ path: "/vip", title: "Premium gratuit 3 ou 6 mois — LiveFoot IA", description: "Demandez un accès Premium gratuit après votre inscription partenaire et la vérification de votre dépôt minimum." }),
    meta: [{ name: "robots", content: "index,follow" }],
  }),
  component: VipPage,
});

function VipPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const applicationFn = useServerFn(getMyVipApplication);
  const submitFn = useServerFn(submitVipApplication);
  const applicationQuery = useQuery({ queryKey: ["vip", "application"], queryFn: () => applicationFn(), enabled: Boolean(session), staleTime: 30_000 });
  const [tier, setTier] = useState<VipTier>("pro");
  const [partnerSlug, setPartnerSlug] = useState(BOOKMAKERS[0]?.slug ?? "");
  const [form, setForm] = useState({ bookmakerAccountId: "", fullName: "", contactEmail: session?.user?.email ?? "", depositAmountXaf: "", depositDate: new Date().toISOString().slice(0, 10), depositReference: "", proofNote: "", regular: false, responsible: false });
  const partner = BOOKMAKERS.find((item) => item.slug === partnerSlug) ?? BOOKMAKERS[0];
  const rule = tierRules[tier];

  function chooseTier(next: VipTier) {
    setTier(next);
    if (!session) navigate({ to: "/auth", search: { redirect: "/vip" } });
  }

  async function copyCode() {
    if (!partner) return;
    await navigator.clipboard?.writeText(partner.code);
    toast.success(`Code ${partner.code} copié.`);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session || !session.user.email) { navigate({ to: "/auth", search: { redirect: "/vip" } }); return; }
    try {
      await submitFn({ data: { tier, partnerSlug, promoCode: partner.code, bookmakerAccountId: form.bookmakerAccountId, fullName: form.fullName, contactEmail: session.user.email, depositAmountXaf: Number(form.depositAmountXaf), depositDate: form.depositDate, depositReference: form.depositReference, proofNote: form.proofNote, regularBettorConfirmed: form.regular, responsibleGamingConfirmed: form.responsible } });
      await applicationQuery.refetch();
      toast.success("Demande VIP envoyée.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "La demande n'a pas pu être envoyée."); }
  }

  const existing = applicationQuery.data;
  return <AppShell>
    <PageTitle eyebrow="Programme partenaire" title="Jusqu’à 6 mois de Premium GRATUITS" />
    <div className="space-y-6 px-4 pb-28 lg:px-0">
      <section className="rounded-3xl border border-brand/20 bg-gradient-to-br from-brand/15 via-card to-card p-5 lg:p-8">
        <div className="max-w-2xl"><span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand"><Sparkles className="size-3" /> Offre vérifiée</span><h2 className="mt-3 text-2xl font-black tracking-tight lg:text-4xl">Un accès Premium <span className="text-brand">GRATUIT</span> après validation.</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">Inscris-toi avec un code partenaire LiveFoot, effectue le dépôt minimum et envoie ta demande. Aucun mot de passe bookmaker n’est demandé.</p><button type="button" onClick={() => document.getElementById("vip-offres")?.scrollIntoView({ behavior: "smooth" })} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-xs font-black text-brand-foreground">Choisir mon offre gratuite <ChevronDown className="size-4" /></button></div>
      </section>

      <section id="vip-offres" className="grid gap-4 lg:grid-cols-2">
        <VipPlanCard tier="starter" selected={tier === "starter"} onSelect={() => chooseTier("starter")} />
        <VipPlanCard tier="pro" selected={tier === "pro"} onSelect={() => chooseTier("pro")} featured />
      </section>

      <div className="grid gap-3 sm:grid-cols-3"><Step number="1" title="Inscris-toi" text="Choisis un partenaire et utilise son code LiveFoot." /><Step number="2" title="Dépose" text={`Dépose au moins ${rule.minimum.toLocaleString("fr-FR")} FCFA chez le partenaire.`} /><Step number="3" title="Demande" text="Envoie ton identifiant pour une vérification manuelle." /></div>

      {existing ? <ApplicationStatus application={existing} /> : <section className="rounded-2xl border border-border/70 bg-card p-5 lg:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-brand">Demande d’accès</p><h2 className="mt-1 text-xl font-black">Demander mes mois gratuits</h2><p className="mt-1 text-xs text-muted-foreground">Les informations sont utilisées uniquement pour vérifier ton éligibilité.</p></div><span className="rounded-full bg-brand/10 px-3 py-1.5 text-[10px] font-black text-brand">{tier === "pro" ? "Pro · 6 mois" : "Starter · 3 mois"}</span></div><form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold">Partenaire<select value={partnerSlug} onChange={(event) => setPartnerSlug(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground">{BOOKMAKERS.map((item) => <option key={item.slug} value={item.slug}>{item.name} · {item.code}</option>)}</select></label>
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-brand">Ton code partenaire</p><div className="mt-1 flex items-center justify-between gap-2"><strong className="text-lg tracking-widest">{partner?.code}</strong><button type="button" onClick={() => void copyCode()} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-2 text-[10px] font-black text-brand-foreground"><Copy className="size-3" /> Copier</button></div>{partner && <a href={partner.affiliateUrl} target="_blank" rel="nofollow sponsored noopener" onClick={() => { try { sessionStorage.setItem("livefoot-vip-context", JSON.stringify({ tier, partner: partner.slug, code: partner.code })); } catch {} }} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-brand hover:underline">S’inscrire chez {partner.name} <ExternalLink className="size-3" /></a>}</div>
        <label className="text-xs font-bold">ID du compte bookmaker<input required value={form.bookmakerAccountId} onChange={(event) => setForm({ ...form, bookmakerAccountId: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground" placeholder="Votre identifiant de compte" /></label>
        <label className="text-xs font-bold">Nom complet<input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground" placeholder="Votre nom" /></label>
        <label className="text-xs font-bold">Email du compte LiveFoot<input required readOnly type="email" value={session?.user.email ?? ""} className="mt-2 h-11 w-full cursor-not-allowed rounded-xl border border-border bg-surface px-3 text-xs text-foreground opacity-80" /></label>
        <label className="text-xs font-bold">Montant du dépôt<input required type="number" min={rule.minimum} value={form.depositAmountXaf} onChange={(event) => setForm({ ...form, depositAmountXaf: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground" placeholder={`${rule.minimum} FCFA minimum`} /></label>
        <label className="text-xs font-bold">Date du dépôt<input required type="date" value={form.depositDate} onChange={(event) => setForm({ ...form, depositDate: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground" /></label>
        <label className="text-xs font-bold">Référence du dépôt<input required value={form.depositReference} onChange={(event) => setForm({ ...form, depositReference: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-3 text-xs text-foreground" placeholder="Référence visible dans votre compte" /></label>
        <label className="text-xs font-bold sm:col-span-2">Note de preuve facultative<textarea value={form.proofNote} onChange={(event) => setForm({ ...form, proofNote: event.target.value })} className="mt-2 min-h-20 w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground" placeholder="N’ajoutez aucune donnée sensible ou aucun mot de passe." /></label>
        <label className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2"><input required type="checkbox" checked={form.regular} onChange={(event) => setForm({ ...form, regular: event.target.checked })} className="mt-0.5 accent-brand" />Je confirme être un utilisateur régulier du partenaire indiqué.</label>
        <label className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2"><input required type="checkbox" checked={form.responsible} onChange={(event) => setForm({ ...form, responsible: event.target.checked })} className="mt-0.5 accent-brand" />Je confirme respecter l’âge légal et les règles de jeu responsable.</label>
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-xs font-black text-brand-foreground sm:col-span-2">Envoyer ma demande gratuite <ShieldCheck className="size-4" /></button>
      </form></section>}

      <section className="grid gap-2"><Faq title="Que signifie Premium gratuit ?" text="L’accès aux fonctions Premium est offert après vérification. Le dépôt est effectué chez le partenaire, pas sur LiveFoot." /><Faq title="Puis-je acheter des crédits pendant mon accès VIP ?" text="Oui. Les packs de crédits restent disponibles pendant toute la durée de l’accès Premium VIP." /><Faq title="Combien de temps prend la vérification ?" text="Une réponse est envoyée dans LiveFoot après l’examen des informations fournies." /></section>
    </div>
  </AppShell>;
}

function VipPlanCard({ tier, selected, onSelect, featured }: { tier: VipTier; selected: boolean; onSelect: () => void; featured?: boolean }) {
  const pro = tier === "pro";
  return <article className={cn("rounded-2xl border bg-card p-5 transition-shadow", selected ? "border-brand shadow-lg shadow-brand/10" : "border-border/70", featured && "ring-1 ring-brand/20")}><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">{featured ? "Meilleure valeur" : "Offre gratuite"}</span>{selected && <Check className="size-5 text-brand" />}</div><h3 className="mt-4 text-xl font-black">{pro ? "6 mois Premium GRATUITS" : "3 mois Premium GRATUITS"}</h3><p className="mt-2 text-sm font-bold">Dépôt minimum : {pro ? "25 000" : "10 000"} FCFA</p><ul className="mt-4 space-y-2 text-xs text-muted-foreground">{["Inscription avec un code partenaire LiveFoot", "100 crédits Premium par mois", "Badge VIP et support prioritaire", "Packs de crédits disponibles"].map((item) => <li key={item} className="flex items-center gap-2"><Check className="size-3.5 shrink-0 text-brand" />{item}</li>)}</ul><button type="button" onClick={onSelect} className="mt-5 w-full rounded-xl bg-brand px-4 py-3 text-xs font-black text-brand-foreground">{pro ? "Demander mes 6 mois gratuits" : "Demander mes 3 mois gratuits"}</button></article>;
}

function Step({ number, title, text }: { number: string; title: string; text: string }) { return <div className="rounded-xl border border-border/70 bg-card p-4"><span className="grid size-7 place-items-center rounded-full bg-brand text-xs font-black text-brand-foreground">{number}</span><h3 className="mt-3 text-sm font-black">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div>; }
function Faq({ title, text }: { title: string; text: string }) { return <details className="rounded-xl border border-border/70 bg-card px-4 py-3"><summary className="cursor-pointer text-xs font-black">{title}</summary><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p></details>; }
function ApplicationStatus({ application }: { application: any }) { const labels: Record<string, string> = { submitted: "Demande reçue", under_review: "Vérification en cours", needs_info: "Informations nécessaires", approved: "Accès approuvé", rejected: "Demande refusée", expired: "Demande expirée" }; return <section className="rounded-2xl border border-brand/30 bg-brand/5 p-5"><div className="flex items-center gap-3"><Trophy className="size-5 text-brand" /><div><p className="text-sm font-black">{labels[application.status] ?? "Demande VIP"}</p><p className="mt-1 text-xs text-muted-foreground">{application.status === "approved" ? "Ton accès Premium gratuit est actif." : application.review_reason || "Nous revenons vers toi directement dans LiveFoot."}</p></div></div></section>; }
