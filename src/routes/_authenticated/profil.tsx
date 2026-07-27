import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { Crown, History, Settings, LogOut, ChevronRight, Coins, Sparkles, Plus, TrendingDown, TrendingUp, Check, Info, X, Lock, ShieldCheck } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { PRICED_PACKS, formatXaf, type PricedPack } from "@/lib/pricing";
import { createTopupCheckout, verifyTopup, getMyPayments } from "@/lib/payments.functions";
import { getMyBalance, getMyAnalysisHistory } from "@/lib/analyses.functions";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CREDIT_RULES = [
  { cost: 3, label: "Analyse IA d'un match", desc: "Probabilités 1X2, score probable et 5 marchés recommandés" },
  { cost: 3, label: "Comparateur personnalisé", desc: "Analyse avancée de deux équipes de votre choix" },
  { cost: 0, label: "Livescore & statistiques", desc: "Toujours gratuit — mises à jour temps réel" },
];

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil & crédits — ScoreZen AI" },
      { name: "description", content: "Votre tableau de bord ScoreZen AI : solde de crédits, historique d'analyses, packs de recharge et abonnement Premium." },
      { property: "og:title", content: "Mon profil & crédits — ScoreZen AI" },
      { property: "og:description", content: "Gérez vos crédits d'analyse IA, votre historique et votre abonnement Premium." },
      { property: "og:url", content: "https://www.livefoot.fun/profil" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://www.livefoot.fun/profil" }],
  }),
  component: ProfilPage,
});

const balanceQuery = queryOptions({
  queryKey: ["me", "balance"],
  queryFn: () => getMyBalance(),
  staleTime: 30_000,
});

const historyQuery = queryOptions({
  queryKey: ["me", "history"],
  queryFn: () => getMyAnalysisHistory(),
  staleTime: 60_000,
});

function ProfilPage() {
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useSuspenseQuery(balanceQuery);
  const { data: rawHistory } = useSuspenseQuery(historyQuery);
  const { data: paymentData = { payments: [], subscriptions: [] } } = useQuery({
    queryKey: ["me", "payments"],
    queryFn: () => getMyPayments(),
    staleTime: 15_000,
  });

  const [showTopup, setShowTopup] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const isPremium = profile.plan === "premium";
  const history = isPremium ? rawHistory : rawHistory.slice(0, 10);
  const balance = profile.credits;
  const monthlyLimit = isPremium ? 100 : 5;
  const usedPct = Math.min(100, Math.round((balance / monthlyLimit) * 100));
  const displayName = profile.display_name ?? user?.email?.split("@")[0] ?? "Utilisateur";
  const initials = displayName.split(/[\s.]+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const [busyPack, setBusyPack] = useState<string | null>(null);
  const checkoutFn = useServerFn(createTopupCheckout);
  const verifyFn = useServerFn(verifyTopup);

  const handleTopup = async (pack: PricedPack) => {
    if (!isPremium) {
      toast.error("Les packs sont réservés aux membres Premium. Passez Premium d'abord !");
      navigate({ to: "/premium" });
      return;
    }
    setBusyPack(pack.id);
    try {
      const res = await checkoutFn({
        data: { packId: pack.id, origin: typeof window !== "undefined" ? window.location.origin : undefined },
      });
      setShowTopup(false);
      setFlash(`Paiement de ${formatXaf(res.amountXaf)} initié — finalisez sur Fapshi.`);
      window.location.href = res.link;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'initier le paiement.");
    } finally {
      setBusyPack(null);
    }
  };

  const handleVerify = async (transId: string) => {
    try {
      const out = await verifyFn({ data: { transId } });
      if (out.credited) {
        toast.success(`Succès ! ${out.credits} crédits crédités.`);
      } else if (out.status === "SUCCESSFUL") {
        toast.info("Paiement déjà validé.");
      } else {
        toast.info(`Statut du paiement : ${out.status}.`);
      }
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vérification impossible.");
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Vous êtes déconnecté.");
    navigate({ to: "/" });
  };

  const runFn = useServerFn(getMyBalance);
  const refresh = async () => {
    try {
      const fresh = await runFn();
      queryClient.setQueryData(balanceQuery.queryKey, fresh);
      toast.success("Solde actualisé.");
    } catch {
      toast.error("Impossible d'actualiser.");
    }
  };

  return (
    <AppShell>
      <PageTitle eyebrow="Compte" title="Profil" />

      {flash && (
        <div
          role="status"
          aria-live="polite"
          className="mx-4 mb-4 flex items-center gap-2 rounded-2xl bg-brand/10 px-3 py-2 text-xs font-bold text-brand ring-1 ring-brand/20 lg:mx-0"
        >
          <Check className="size-4" aria-hidden /> {flash}
        </div>
      )}

      {/* Profil Header */}
      <div className="px-4 lg:px-0">
        <div className="flex items-center gap-4 rounded-3xl bg-card p-4 ring-1 ring-black/5 dark:ring-white/5">
          <div className="grid size-16 place-items-center rounded-full bg-foreground text-2xl font-black text-background">
            {initials || "?"}
          </div>
          <div className="flex-1">
            <div className="text-base font-black">{displayName}</div>
            <div className="text-xs text-muted-foreground">{user?.email ?? "—"}</div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-surface ring-1 ring-black/5 dark:ring-white/10">
              {isPremium ? (
                <>
                  <Crown className="size-3 text-brand" />
                  <span className="text-brand font-bold">Membre Premium</span>
                </>
              ) : (
                <span className="text-muted-foreground font-bold">Plan Gratuit</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Credits Wallet */}
      <section aria-labelledby="wallet-title" className="mt-4 px-4 lg:px-0">
        <div className="relative overflow-hidden rounded-3xl bg-foreground p-5 text-background">
          <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-warn/25 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full bg-brand/20 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-warn/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-warn">
                  <Coins className="size-3" aria-hidden /> Solde de crédits
                </div>
                <h2 id="wallet-title" className="text-4xl font-black tabular-nums leading-none">
                  {balance}
                </h2>
                <p className="mt-1 text-[11px] text-background/60">≈ {Math.floor(balance / 3)} analyses IA restantes (3 crédits / analyse)</p>
              </div>

              {isPremium ? (
                <button
                  onClick={() => setShowTopup(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-warn px-3 py-2 text-xs font-black text-neutral-900 transition-transform hover:scale-105 active:scale-95"
                >
                  <Plus className="size-3.5" /> Recharger
                </button>
              ) : (
                <Link
                  to="/premium"
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-black text-brand-foreground transition-transform hover:scale-105 active:scale-95 shadow-md"
                >
                  <Crown className="size-3.5" /> Passer Premium
                </Link>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-background/60">
                <span>{isPremium ? "Crédits Mensuels Premium" : "Crédits de bienvenue"}</span>
                <span className="tabular-nums text-background">{balance} / {monthlyLimit}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background/10">
                <div className="h-full rounded-full bg-warn transition-all" style={{ width: `${usedPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <div className="mt-4 grid grid-cols-3 gap-3 px-4 lg:px-0">
        <StatCard value={String(rawHistory.filter((h) => h.kind === "analysis").length)} label="Analyses" icon={<Sparkles className="size-3.5 text-brand" />} />
        <StatCard value={isPremium ? "Premium" : "Gratuit"} label="Plan" />
        <StatCard value={String(balance)} label="Crédits" />
      </div>

      {/* Credit Rules */}
      <section aria-labelledby="rules-title" className="mt-6 px-4 lg:px-0">
        <div className="mb-3 flex items-center gap-2">
          <Info className="size-3.5 text-muted-foreground" aria-hidden />
          <h3 id="rules-title" className="text-[11px] font-black uppercase tracking-widest">
            Règles d'utilisation des crédits
          </h3>
        </div>
        <ul className="space-y-2 rounded-2xl bg-card ring-1 ring-black/5 dark:ring-white/5" role="list">
          {CREDIT_RULES.map((r) => (
            <li key={r.label} className="flex items-start gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
              <div
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-black tabular-nums ring-1",
                  r.cost === 0
                    ? "bg-brand/10 text-brand ring-brand/20"
                    : "bg-warn/10 text-warn ring-warn/20",
                )}
              >
                {r.cost === 0 ? "0" : `-${r.cost}`}
              </div>
              <div className="flex-1">
                <div className="text-xs font-black">{r.label}</div>
                <div className="text-[11px] leading-snug text-muted-foreground">{r.desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* History */}
      <section aria-labelledby="history-title" className="mt-6 px-4 lg:px-0">
        <div className="mb-3 flex items-center justify-between">
          <h3 id="history-title" className="text-[11px] font-black uppercase tracking-widest">
            Historique des crédits {!isPremium && "(Limité aux 10 derniers)"}
          </h3>
          <button onClick={refresh} className="text-[10px] font-bold text-brand hover:underline">
            Actualiser
          </button>
        </div>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Aucune transaction pour l'instant. Lancez votre première analyse.
          </div>
        ) : (
          <ul className="rounded-2xl bg-card ring-1 ring-black/5 dark:ring-white/5" role="list">
            {history.map((h) => {
              const positive = h.amount > 0;
              const date = new Date(h.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
              return (
                <li key={h.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
                  <div
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full",
                      positive ? "bg-brand/10 text-brand" : "bg-alert/10 text-alert",
                    )}
                  >
                    {positive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black">{h.label ?? h.kind}</div>
                    <div className="truncate text-[11px] text-muted-foreground">Solde après : {h.balance_after} · {date}</div>
                  </div>
                  <div className={cn("shrink-0 tabular-nums text-sm font-black", positive ? "text-brand" : "text-alert")}>
                    {positive ? "+" : ""}{h.amount}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Premium Banner / Upsell */}
      {!isPremium && (
        <div className="mt-6 px-4 lg:px-0">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand/20 via-card to-card p-5 ring-1 ring-brand/30">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
              <Crown className="size-3" /> Offre Premium
            </div>
            <h3 className="text-lg font-black leading-tight">100 crédits d'analyse mensuels & Favoris illimités</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Pour seulement 4 900 FCFA/mois, obtenez 100 crédits par mois et débloquez la possibilité de télécharger des packs de recharges.
            </p>
            <Link
              to="/premium"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-xs font-black text-brand-foreground transition-transform active:scale-[0.98]"
            >
              Découvrir les offres Premium <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Menu */}
      <section className="mt-6 space-y-2 px-4 lg:px-0" aria-label="Menu du compte">
        <MenuRow
          icon={<Crown className="size-4 text-brand" />}
          label="Offres & Abonnements Premium"
          onClick={() => navigate({ to: "/premium" })}
        />
        <MenuRow
          icon={<LogOut className="size-4" />}
          label="Se déconnecter"
          tone="alert"
          onClick={handleLogout}
        />
      </section>

      {/* Payment History */}
      {(paymentData.payments.length > 0 || paymentData.subscriptions.length > 0) && (
        <section className="mt-6 px-4 lg:px-0">
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Mes paiements & abonnements</h2>
          <div className="space-y-2">
            {paymentData.subscriptions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 ring-1 ring-black/5 dark:ring-white/5">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold">Abonnement Premium · {formatXaf(s.amount_xaf)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(s.created_at).toLocaleString("fr-FR")} · Statut : {s.status}
                  </div>
                </div>
                {s.status !== "ACTIVE" && s.trans_id && (
                  <button
                    onClick={() => handleVerify(s.trans_id as string)}
                    className="rounded-xl bg-foreground px-2.5 py-1.5 text-[11px] font-bold text-background shrink-0"
                  >
                    Vérifier
                  </button>
                )}
              </div>
            ))}
            {paymentData.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 ring-1 ring-black/5 dark:ring-white/5">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold">{p.credits} crédits · {formatXaf(p.amount_xaf)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("fr-FR")} · {p.status}
                  </div>
                </div>
                {p.status !== "SUCCESSFUL" && p.trans_id && (
                  <button
                    onClick={() => handleVerify(p.trans_id as string)}
                    className="rounded-xl bg-foreground px-2.5 py-1.5 text-[11px] font-bold text-background shrink-0"
                  >
                    Vérifier
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 px-4 pb-4 lg:px-0">
        <Link to="/" className="block text-center text-[10px] font-semibold text-muted-foreground">
          ScoreZen AI · v1.0 · © 2026
        </Link>
      </div>

      {showTopup && (
        <TopupDialog onClose={() => setShowTopup(false)} onBuy={handleTopup} busyPack={busyPack} isPremium={isPremium} />
      )}
    </AppShell>
  );
}

function StatCard({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-black/5 dark:ring-white/5">
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1 text-xl font-black tabular-nums leading-none">{value}</div>
    </div>
  );
}

function MenuRow({ icon, label, tone, onClick }: { icon: React.ReactNode; label: string; tone?: "alert"; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left text-sm font-bold ring-1 ring-black/5 transition-colors hover:bg-surface dark:ring-white/5",
        tone === "alert" && "text-alert",
      )}
    >
      <span className={cn("grid size-8 place-items-center rounded-full", tone === "alert" ? "bg-alert/10" : "bg-surface")}>{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </button>
  );
}

function TopupDialog({ onClose, onBuy, busyPack, isPremium }: { onClose: () => void; onBuy: (pack: PricedPack) => void; busyPack: string | null; isPremium: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/60 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-warn">
              <Coins className="size-3" /> Recharge de crédits
            </div>
            <h2 className="text-xl font-black leading-tight">Choisir un pack</h2>
            <p className="mt-1 text-xs text-muted-foreground">Paiement MTN MoMo / Orange Money via Fapshi.</p>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-surface ring-1 ring-black/5 dark:ring-white/10">
            <X className="size-4" />
          </button>
        </div>

        {!isPremium && (
          <div className="mt-3 rounded-2xl bg-warn/10 p-3 ring-1 ring-warn/20 text-xs">
            <div className="font-bold text-warn flex items-center gap-1.5">
              <Lock className="size-4" /> Packs réservés aux membres Premium
            </div>
            <p className="mt-1 text-muted-foreground text-[11px]">
              Vous devez disposer d'un abonnement Premium actif pour recharger des crédits.
            </p>
            <button
              onClick={() => { onClose(); navigate({ to: "/premium" }); }}
              className="mt-2 w-full rounded-xl bg-brand py-2 text-xs font-black text-brand-foreground"
            >
              Passer Premium
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {PRICED_PACKS.map((p) => (
            <button
              key={p.id}
              onClick={() => onBuy(p)}
              disabled={busyPack !== null || !isPremium}
              className={cn(
                "relative flex flex-col items-start gap-1 rounded-2xl p-3 text-left ring-1 transition-all disabled:opacity-50",
                p.best ? "bg-brand/10 ring-brand/40" : "bg-card ring-black/5 dark:ring-white/5",
              )}
            >
              <div className="flex items-center gap-1 text-warn">
                <Coins className="size-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Crédits</span>
              </div>
              <div className="text-2xl font-black tabular-nums leading-none">{p.credits}</div>
              <div className="text-sm font-black tabular-nums">{p.priceLabel}</div>
              <div className="text-[10px] text-muted-foreground">{p.perAnalysisLabel}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
