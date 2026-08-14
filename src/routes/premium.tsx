import { createFileRoute, Link, Outlet, useNavigate, useRouterState, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Crown,
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  Lock,
  ArrowRight,
} from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { breadcrumbSchema, buildRouteMeta } from "@/lib/seo";
import { PREMIUM_PLANS, PRICED_PACKS, formatXaf, type PremiumPlan } from "@/lib/pricing";
import { createSubscriptionCheckout, createTopupCheckout } from "@/lib/payments.functions";
import { getMyBalance } from "@/lib/analyses.functions";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPremiumExpiry, isPremiumActive, premiumDaysRemaining } from "@/lib/premium-status";
import { DEMO_PROFILE, isLocalDemo } from "@/lib/local-demo";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/premium")({
  validateSearch: (search) => ({
    plan:
      search.plan === "premium_monthly" || search.plan === "premium_yearly"
        ? search.plan
        : undefined,
  }),
  head: () => ({
    ...buildRouteMeta({
      title: "Abonnement Premium & Packs de Crédits",
      description:
        "Passez à LiveFoot IA Premium : 100 crédits d'analyse par mois, favoris illimités et accès aux packs de recharge exclusifs.",
      path: "/premium",
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "Accueil", path: "/" },
            { name: "Premium", path: "/premium" },
          ]),
        ),
      },
    ],
  }),
  component: PremiumPage,
});

function PremiumPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/premium/tableau-de-bord" || pathname === "/premium/historique") return <Outlet />;
  return <PremiumSubscriptionPage />;
}

function PremiumSubscriptionPage() {
  const demoMode = isLocalDemo();
  const { user } = useSession();
  const navigate = useNavigate();
  const { plan: selectedPlan } = useSearch({ from: "/premium" });
  const { data: profile } = useQuery({
    queryKey: ["me", "balance"],
    queryFn: () => (demoMode ? Promise.resolve(DEMO_PROFILE) : getMyBalance()),
    enabled: !!user,
  });

  const isPremium = isPremiumActive(profile);
  const premiumExpiry = formatPremiumExpiry(profile?.premium_until);
  const premiumDays = premiumDaysRemaining(profile?.premium_until);

  // /premium est le parent de /premium/tableau-de-bord : le Hub doit être
  // rendu dans l'Outlet, sinon le parent recouvre l'interface enfant.
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const subCheckoutFn = useServerFn(createSubscriptionCheckout);
  const topupCheckoutFn = useServerFn(createTopupCheckout);

  useEffect(() => {
    track("premium_view", {
      source: selectedPlan ? "auth_return" : "direct",
      plan: selectedPlan ?? "",
    });
  }, [selectedPlan]);

  const handleSubscribe = async (plan: PremiumPlan) => {
    if (demoMode) {
      toast.info("Aperçu local : le paiement est désactivé et aucune donnée n'est envoyée.");
      navigate({ to: "/premium/tableau-de-bord" });
      return;
    }
    if (isPremium) {
      navigate({ to: "/premium/tableau-de-bord" });
      return;
    }
    if (!user) {
      toast.info("Veuillez vous connecter pour vous abonner.");
      track("premium_cta_click", { plan: plan.id, location: "premium_plan_card" });
      navigate({
        to: "/auth",
        search: {
          mode: "signup",
          redirect: `/premium?plan=${encodeURIComponent(plan.id)}`,
          plan: plan.id,
          source: "premium_plan_card",
        },
      });
      return;
    }

    setBusyPlan(plan.id);
    try {
      track("premium_checkout_started", { plan: plan.id, location: "premium_plan_card" });
      const res = await subCheckoutFn({
        data: { planId: plan.id },
      });
      toast.success(`Souscription à ${plan.name} initiée !`);
      track("premium_checkout_redirected", { plan: plan.id });
      window.location.href = res.link;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'initiation du paiement.");
    } finally {
      setBusyPlan(null);
    }
  };

  const handleBuyPack = async (packId: string) => {
    if (demoMode) {
      toast.info("Aperçu local : les paiements sont désactivés dans ce mode.");
      return;
    }
    if (!user) {
      toast.info("Veuillez vous connecter.");
      navigate({ to: "/auth" });
      return;
    }

    if (!isPremium) {
      toast.error(
        "Les packs de crédits sont réservés aux membres Premium. Choisissez une formule ci-dessous !",
      );
      return;
    }

    try {
      const res = await topupCheckoutFn({
        data: { packId },
      });
      window.location.href = res.link;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de recharge.");
    }
  };

  return (
    <AppShell>
      <PageTitle eyebrow="Offre Exclusive" title="Passer Premium" />

      {/* Hero Banner */}
      <div className="px-4 lg:px-0">
        <div className="relative animate-rise overflow-hidden rounded-xl bg-[#181818] p-6 text-[#f7f7f7] shadow-none">
          <div
            className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-brand/35 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-12 size-48 rounded-full bg-warn/30 blur-3xl"
            aria-hidden
          />

          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/20 px-3 py-1 text-xs font-black uppercase tracking-widest text-brand">
              <Crown className="size-3.5" /> Livefoot IA Premium
            </div>

            <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
              Débloquez la puissance maximale des prédictions IA
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-background/75 sm:text-sm">
              100 crédits par mois réinitialisés à chaque cycle, favoris illimités, et accès
              exclusif aux packs de recharge pour ne jamais tomber à court.
            </p>

            {isPremium && (
              <div
                className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-brand/20 px-3 py-2 text-xs font-black text-brand ring-1 ring-brand/30"
                role="status"
              >
                <Check className="size-4" /> Premium actif
                {premiumExpiry && (
                  <span className="font-medium text-brand/80">
                    jusqu’au {premiumExpiry}
                    {premiumDays !== null ? ` · ${premiumDays} j` : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 px-4 lg:px-0">
        <a
          href="/premium/tableau-de-bord"
          aria-label="Ouvrir le Premium Intelligence Hub"
          className="flex items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4 transition-colors hover:bg-brand/10"
        >
          <span className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-brand/15 text-brand">
              <Sparkles className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-black">Premium Intelligence Hub</span>
              <span className="block text-xs text-muted-foreground">
                Radar value, alertes intelligentes et scorecard personnel
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-brand" aria-hidden />
        </a>
      </div>

      {/* Subscription Plans */}
      <section className="mt-8 px-4 lg:px-0">
        <div className="mb-4 text-center">
          <h2 className="text-xl font-black">Choisissez votre formule</h2>
          <p className="text-xs text-muted-foreground">
            Sans engagement · Paiement sécurisé Fapshi Mobile Money
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PREMIUM_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative flex animate-rise flex-col justify-between rounded-xl border border-border/70 bg-card p-6 transition-all",
                plan.badge
                  ? "ring-brand shadow-lg shadow-brand/10"
                  : "ring-black/5 dark:ring-white/5",
                selectedPlan === plan.id && "ring-2 ring-brand/40 ring-offset-2 ring-offset-background",
              )}
            >
              {plan.badge && (
                <span className="absolute -top-3 right-6 rounded-full bg-brand px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-foreground">
                  {plan.badge}
                </span>
              )}

              <div>
                <div className="text-sm font-black text-muted-foreground uppercase tracking-wider">
                  {plan.name}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-black tabular-nums">
                    {formatXaf(plan.priceXaf)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{plan.interval === "year" ? "an" : "mois"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {plan.description}
                </p>

                <ul className="mt-5 space-y-2.5 text-xs font-medium">
                  <li className="flex items-center gap-2">
                    <Sparkles className="size-4 text-brand shrink-0" />
                    <span>
                      <strong>100 crédits/mois</strong> (33+ analyses IA)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-brand shrink-0" />
                    <span>Favoris & Alertes illimités</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-brand shrink-0" />
                    <span>Historique d'analyses complet</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-brand shrink-0" />
                    <span>Accès aux packs de recharges supplémentaires</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={busyPlan !== null}
                className={cn(
                  "mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-black transition-transform active:scale-95 disabled:opacity-50",
                  plan.badge
                    ? "bg-brand text-brand-foreground shadow-md shadow-brand/20"
                    : "bg-foreground text-background",
                )}
              >
                {isPremium
                  ? "Accéder au Hub"
                  : busyPlan === plan.id
                    ? "Redirection..."
                    : `Souscrire (${formatXaf(plan.priceXaf)})`}
                <ArrowRight className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="mt-10 px-4 lg:px-0">
        <h2 className="mb-4 text-center text-lg font-black">Comparatif Gratuit vs Premium</h2>
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-surface">
                <th className="p-3.5 font-bold">Fonctionnalité</th>
                <th className="p-3.5 font-bold text-center text-muted-foreground">Gratuit</th>
                <th className="p-3.5 font-bold text-center text-brand">Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-medium">
              <tr>
                <td className="p-3.5">Crédits d'analyse</td>
                <td className="p-3.5 text-center text-muted-foreground">5 offerts</td>
                <td className="p-3.5 text-center font-bold text-brand">100 / mois</td>
              </tr>
              <tr>
                <td className="p-3.5">Coût par analyse IA</td>
                <td className="p-3.5 text-center text-muted-foreground">3 crédits</td>
                <td className="p-3.5 text-center font-bold">3 crédits</td>
              </tr>
              <tr>
                <td className="p-3.5">Limite de favoris</td>
                <td className="p-3.5 text-center text-muted-foreground">Max 3</td>
                <td className="p-3.5 text-center font-bold text-brand">Illimités</td>
              </tr>
              <tr>
                <td className="p-3.5">Historique visible</td>
                <td className="p-3.5 text-center text-muted-foreground">10 entres</td>
                <td className="p-3.5 text-center font-bold text-brand">Illimité</td>
              </tr>
              <tr>
                <td className="p-3.5">Achat de packs supplémentaires</td>
                <td className="p-3.5 text-center text-alert font-bold">🔒 Verrouillé</td>
                <td className="p-3.5 text-center font-bold text-brand">✓ Débloqué</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Credit Packs Catalogue (Locked for free users) */}
      <section className="mt-10 px-4 lg:px-0">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black">Packs de crédits supplémentaires</h2>
            <p className="text-xs text-muted-foreground">
              Rechargez vos crédits à tout moment (réservé aux abonnés Premium).
            </p>
          </div>
          {!isPremium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2.5 py-1 text-[10px] font-black uppercase text-warn">
              <Lock className="size-3" /> Membres Premium uniquement
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRICED_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={cn(
                "relative flex flex-col justify-between rounded-2xl bg-card p-4 ring-1 transition-all",
                !isPremium && "opacity-60",
                pack.best ? "ring-brand/40 bg-brand/5" : "ring-black/5 dark:ring-white/5",
              )}
            >
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-warn">
                  {pack.name}
                </div>
                <div className="mt-1 text-2xl font-black tabular-nums">{pack.credits} crédits</div>
                <div className="text-xs font-bold mt-0.5">{pack.priceLabel}</div>
                <div className="text-[10px] text-muted-foreground">{pack.perAnalysisLabel}</div>
              </div>

              <button
                onClick={() => handleBuyPack(pack.id)}
                className={cn(
                  "mt-3 w-full rounded-xl py-2 text-[11px] font-black transition-transform active:scale-95",
                  isPremium
                    ? "bg-foreground text-background"
                    : "bg-surface text-muted-foreground ring-1 ring-black/5 dark:ring-white/10",
                )}
              >
                {isPremium ? "Acheter" : "🔒 Débloquer avec Premium"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-10 px-4 pb-8 lg:px-0">
        <h2 className="mb-4 text-center text-lg font-black">Foire Aux Questions (FAQ)</h2>
        <div className="space-y-3">
          <FaqItem
            q="Comment fonctionne le renouvellement des crédits ?"
            r="Chaque mois, votre solde de crédits Premium est réinitialisé à 100 crédits. Les crédits inutilisés du mois précédent ne se cumulent pas, mais les crédits achetés via des packs restent conservés indéfiniment."
          />
          <FaqItem
            q="Quels moyens de paiement sont acceptés ?"
            r="Nous acceptons MTN Mobile Money et Orange Money dans toute la zone FCFA via notre partenaire sécurisé Fapshi."
          />
          <FaqItem
            q="Puis-je annuler mon abonnement à tout moment ?"
            r="Oui, sans aucun engagement. Votre accès Premium restera actif jusqu'à la fin de la période entamée."
          />
        </div>
      </section>
    </AppShell>
  );
}

function FaqItem({ q, r }: { q: string; r: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5 dark:ring-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-xs font-black"
      >
        <span>{q}</span>
        <HelpCircle
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{r}</p>}
    </div>
  );
}
