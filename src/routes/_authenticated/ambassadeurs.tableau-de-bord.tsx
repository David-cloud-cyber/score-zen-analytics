import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ExternalLink, ShieldCheck, Wallet, Users, Crown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AdminCard } from "@/components/AdminShell";
import { getMyAffiliateDashboard, requestMyAffiliatePayout, saveMyAffiliatePayoutProfile, type AffiliateDashboardData } from "@/lib/referral.functions";
import { track } from "@/lib/analytics";
import { isLocalDemo } from "@/lib/local-demo";

export const Route = createFileRoute("/_authenticated/ambassadeurs/tableau-de-bord")({
  head: () => ({
    meta: [
      { title: "Mon espace Ambassadeur — LiveFoot IA" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Suivez vos filleuls confirmés, vos commissions et vos demandes de versement LiveFoot." },
    ],
  }),
  component: AffiliateDashboardPage,
});

const DEMO_AFFILIATE: AffiliateDashboardData = {
  code: "LIVE2026",
  referralLink: "https://www.livefoot.fun/auth?ref=LIVE2026",
  activeReferrals: 7,
  commissionRateBps: 2500,
  nextThreshold: 25,
  protectedUntil: null,
  pendingXaf: 8_500,
  availableXaf: 12_500,
  reservedXaf: 0,
  paidXaf: 0,
  totalXaf: 21_000,
  minimumPayoutXaf: 25_000,
  qualifiedReferrals: 11,
  pendingReferrals: 2,
  payoutProfile: null,
  recentCommissions: [],
  payouts: [],
};

function AffiliateDashboardPage() {
  const queryClient = useQueryClient();
  const getDashboard = useServerFn(getMyAffiliateDashboard);
  const saveProfile = useServerFn(saveMyAffiliatePayoutProfile);
  const requestPayout = useServerFn(requestMyAffiliatePayout);
  const [copied, setCopied] = useState(false);
  const [operator, setOperator] = useState<"mtn" | "orange">("mtn");
  const [mobileNumber, setMobileNumber] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const query = useQuery({
    queryKey: ["me", "affiliate-dashboard"],
    queryFn: () => (isLocalDemo() ? Promise.resolve(DEMO_AFFILIATE) : getDashboard()),
    staleTime: 30_000,
  });
  const data = query.data;

  useEffect(() => {
    if (data) {
      track("affiliate_page_view", { location: "affiliate_dashboard", rate: data.commissionRateBps / 100 });
      track("affiliate_commission_view", { location: "affiliate_dashboard", available_xaf: data.availableXaf });
      if (data.payoutProfile) {
        setOperator(data.payoutProfile.operator);
      }
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => saveProfile({ data: { operator, mobileNumber, acceptTerms } }),
    onSuccess: () => {
      toast.success("Moyen de versement enregistré.");
      track("affiliate_payout_profile_saved", { location: "affiliate_dashboard", operator });
      void queryClient.invalidateQueries({ queryKey: ["me", "affiliate-dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Impossible d’enregistrer le numéro."),
  });
  const payoutMutation = useMutation({
    mutationFn: () => requestPayout(),
    onSuccess: (result) => {
      toast.success(`Demande de ${result.amountXaf.toLocaleString("fr-FR")} FCFA enregistrée.`);
      track("affiliate_payout_requested", { location: "affiliate_dashboard", amount_xaf: result.amountXaf });
      void queryClient.invalidateQueries({ queryKey: ["me", "affiliate-dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Demande de versement impossible."),
  });

  const copyLink = async () => {
    if (!data?.referralLink) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      toast.success("Lien ambassadeur copié.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  };

  if (query.isLoading || !data) {
    return <AppShell><main className="mx-auto max-w-6xl space-y-4 px-4 pb-20 pt-8 lg:px-0"><div className="lf-loading-skeleton h-10 w-72 rounded-xl" /><div className="grid gap-4 sm:grid-cols-3"><div className="lf-loading-skeleton h-28 rounded-2xl" /><div className="lf-loading-skeleton h-28 rounded-2xl" /><div className="lf-loading-skeleton h-28 rounded-2xl" /></div></main></AppShell>;
  }

  const rate = data.commissionRateBps / 100;
  const previousThreshold = rate >= 40 ? 100 : rate >= 35 ? 50 : rate >= 30 ? 25 : 1;
  const progress = Math.min(100, Math.round(((data.activeReferrals - previousThreshold + 1) / Math.max(1, data.nextThreshold - previousThreshold + 1)) * 100));
  const canRequest = data.availableXaf >= data.minimumPayoutXaf && Boolean(data.payoutProfile) && !isLocalDemo();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-20 pt-8 lg:px-0 lg:pt-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-brand">LiveFoot Ambassadeurs</p><h1 className="mt-2 text-3xl font-black tracking-tight text-balance">Mon espace de commissions</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Suivez les abonnements Premium confirmés par votre lien et vos revenus récurrents.</p></div><Link to="/ambassadeurs" className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground">Voir les conditions</Link></div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<Users className="size-4" />} label="Abonnés actifs" value={data.activeReferrals} />
          <Stat icon={<Crown className="size-4" />} label="Taux actuel" value={`${rate} %`} />
          <Stat icon={<Wallet className="size-4" />} label="Disponible" value={`${data.availableXaf.toLocaleString("fr-FR")} FCFA`} />
          <Stat icon={<Check className="size-4" />} label="Déjà versé" value={`${data.paidXaf.toLocaleString("fr-FR")} FCFA`} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <AdminCard className="border-brand/20 bg-brand/5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Niveau ambassadeur</p><h2 className="mt-2 text-2xl font-black">{rate > 0 ? `${rate} % de commission` : "Commencez à 25 %"}</h2></div><Crown className="size-6 text-brand" /></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-brand/15"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-3 flex justify-between gap-3 text-xs text-muted-foreground"><span>{data.activeReferrals} actif{data.activeReferrals > 1 ? "s" : ""}</span><span>{data.nextThreshold > data.activeReferrals ? `${data.nextThreshold - data.activeReferrals} pour le prochain niveau` : "Niveau maximal atteint"}</span></div></AdminCard>
          <AdminCard><p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Votre lien personnel</p><div className="mt-3 flex items-center gap-2 rounded-xl bg-surface p-2"><span className="min-w-0 flex-1 truncate text-xs font-mono text-muted-foreground">{data.referralLink ?? "Création du lien en cours"}</span><button type="button" onClick={() => void copyLink()} disabled={!data.referralLink} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copié" : "Copier"}</button></div><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Partagez ce lien avec des personnes qui souhaitent réellement utiliser LiveFoot. Aucun revenu n’est garanti par une simple inscription.</p></AdminCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <AdminCard><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold">Versement Mobile Money</h2><p className="mt-1 text-xs text-muted-foreground">Retrait minimum : {data.minimumPayoutXaf.toLocaleString("fr-FR")} FCFA</p></div><Wallet className="size-5 text-brand" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-muted-foreground"><span className="mb-1.5 block">Opérateur</span><select value={operator} onChange={(event) => setOperator(event.target.value as "mtn" | "orange")} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground"><option value="mtn">MTN Mobile Money</option><option value="orange">Orange Money</option></select></label><label className="text-xs font-semibold text-muted-foreground"><span className="mb-1.5 block">Numéro</span><input value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} placeholder="2376XXXXXXXX" inputMode="tel" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground" /></label></div><label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} className="mt-0.5 accent-brand" /> <span>J’accepte les conditions de versement et l’utilisation de ce numéro pour traiter mes demandes.</span></label><button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !mobileNumber || !acceptTerms} className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-50">{saveMutation.isPending ? "Enregistrement…" : "Enregistrer le moyen de versement"}</button></AdminCard>
          <AdminCard><h2 className="text-base font-bold">Solde et retrait</h2><div className="mt-4 grid grid-cols-2 gap-3"><Balance label="En attente" value={data.pendingXaf} /><Balance label="Disponible" value={data.availableXaf} /><Balance label="Réservé" value={data.reservedXaf} /><Balance label="Total généré" value={data.totalXaf} /></div><button type="button" onClick={() => payoutMutation.mutate()} disabled={!canRequest || payoutMutation.isPending} className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-50">{payoutMutation.isPending ? "Préparation…" : data.availableXaf < data.minimumPayoutXaf ? `Encore ${(data.minimumPayoutXaf - data.availableXaf).toLocaleString("fr-FR")} FCFA pour retirer` : data.payoutProfile ? "Demander mon versement" : "Ajoutez votre numéro pour retirer"}</button><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Chaque demande est vérifiée par l’administration avant le versement réel. Les remboursements peuvent annuler une commission.</p></AdminCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-2"><AdminCard><div className="flex items-center justify-between"><h2 className="text-base font-bold">Commissions récentes</h2><ExternalLink className="size-4 text-muted-foreground" /></div>{data.recentCommissions.length ? <div className="mt-4 divide-y divide-border/70">{data.recentCommissions.slice(0, 10).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-xs"><div><p className="font-semibold">Abonnement confirmé</p><p className="mt-1 text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("fr-FR")} · {item.rateBps / 100} %</p></div><div className="text-right"><p className="font-black text-brand">+{item.amountXaf.toLocaleString("fr-FR")} FCFA</p><p className="mt-1 text-muted-foreground">{commissionStatus(item.status)}</p></div></div>)}</div> : <EmptyState text="Vos premières commissions apparaîtront après un abonnement Premium confirmé." />}</AdminCard><AdminCard><h2 className="text-base font-bold">Filleuls et paiements</h2><div className="mt-4 grid grid-cols-2 gap-3"><Balance label="Comptes confirmés" value={data.qualifiedReferrals} suffix="" /><Balance label="En attente" value={data.pendingReferrals} suffix="" /></div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Les données des filleuls restent privées. Vous voyez uniquement leur état d’activation agrégé.</p>{data.payouts.length ? <div className="mt-4 border-t border-border/70 pt-3 text-xs">{data.payouts.slice(0, 3).map((item) => <div key={item.id} className="flex justify-between gap-3 py-2"><span>{new Date(item.requestedAt).toLocaleDateString("fr-FR")}</span><span className="font-semibold">{item.amountXaf.toLocaleString("fr-FR")} FCFA · {payoutStatus(item.status)}</span></div>)}</div> : null}</AdminCard></section>
        <div className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" /><p>LiveFoot ne garantit aucun revenu. Les commissions dépendent des paiements réels, des abonnements conservés et des règles du programme.</p></div>
      </main>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) { return <AdminCard className="p-4"><div className="flex items-center gap-2 text-brand">{icon}<span className="text-xs font-semibold text-muted-foreground">{label}</span></div><p className="mt-3 text-xl font-black text-foreground">{value}</p></AdminCard>; }
function Balance({ label, value, suffix = " FCFA" }: { label: string; value: number; suffix?: string }) { return <div className="rounded-xl bg-surface p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-base font-black text-foreground">{value.toLocaleString("fr-FR")}{suffix}</p></div>; }
function EmptyState({ text }: { text: string }) { return <p className="py-8 text-center text-sm leading-relaxed text-muted-foreground">{text}</p>; }
function commissionStatus(status: AffiliateDashboardData["recentCommissions"][number]["status"]) { return status === "available" ? "Disponible" : status === "pending" ? "En vérification" : status === "reserved" ? "Réservée" : status === "paid" ? "Versée" : "Annulée"; }
function payoutStatus(status: AffiliateDashboardData["payouts"][number]["status"]) { return status === "paid" ? "versée" : status === "rejected" ? "refusée" : status === "requested" ? "en attente" : status; }
