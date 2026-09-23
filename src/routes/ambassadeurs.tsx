import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Crown, ShieldCheck, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { AppShell } from "@/components/AppShell";
import { breadcrumbSchema, buildRouteMeta, faqSchema } from "@/lib/seo";
import { track } from "@/lib/analytics";

const FAQ = [
  {
    q: "Quand ma commission est-elle créée ?",
    a: "Elle est créée uniquement après la confirmation réelle d’un abonnement Premium payé par votre filleul. Une simple inscription ou un clic ne génère pas de commission.",
  },
  {
    q: "La commission est-elle récurrente ?",
    a: "Oui. Tant que votre filleul conserve un abonnement Premium payé et actif, vous recevez votre commission à chaque renouvellement confirmé.",
  },
  {
    q: "Comment fonctionne la progression ?",
    a: "Le taux dépend du nombre de filleuls qui ont un abonnement actif : 25 % dès 1, 30 % dès 25, 35 % dès 50 et 40 % dès 100.",
  },
  {
    q: "Quand puis-je demander un retrait ?",
    a: "Le solde disponible doit atteindre 25 000 FCFA. Les commissions récentes restent en attente pendant la période de vérification des paiements.",
  },
  {
    q: "Que se passe-t-il en cas de remboursement ?",
    a: "La commission liée au paiement remboursé est annulée ou déduite du solde disponible. Les paiements confirmés restent audités dans l’historique.",
  },
  {
    q: "Est-ce que l’inscription au programme est gratuite ?",
    a: "Oui. Tout compte LiveFoot confirmé peut partager son lien, sous réserve d’accepter les conditions du programme et les règles de communication responsable.",
  },
];

export const Route = createFileRoute("/ambassadeurs")({
  head: () => ({
    ...buildRouteMeta({
      path: "/ambassadeurs",
      title: "Programme Ambassadeurs LiveFoot",
      description:
        "Partagez LiveFoot et recevez jusqu’à 40 % de commission récurrente sur les abonnements Premium confirmés de vos filleuls.",
    }),
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Accueil", path: "/" }, { name: "Ambassadeurs", path: "/ambassadeurs" }])) },
      { type: "application/ld+json", children: JSON.stringify(faqSchema(FAQ)) },
    ],
  }),
  component: AmbassadorsPage,
});

function AmbassadorsPage() {
  const { user } = useSession();
  useEffect(() => {
    track("affiliate_page_view", { location: "ambassadors_landing", audience: user ? "member" : "guest" });
  }, [user]);
  const dashboardLink = user
    ? "/ambassadeurs/tableau-de-bord"
    : "/auth?mode=signup&redirect=%2Fambassadeurs%2Ftableau-de-bord&source=affiliate_program";

  const handleCta = () => track("affiliate_cta_click", { location: "ambassadors_hero", audience: user ? "member" : "guest" });

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl space-y-16 px-4 pb-20 pt-8 lg:px-0 lg:pt-14">
        <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">LiveFoot Ambassadeurs</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-balance sm:text-5xl">
              Transformez vos recommandations en revenus récurrents
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty">
              Partagez votre lien LiveFoot. Lorsqu’un filleul active Premium, vous recevez une commission confirmée à chaque renouvellement, jusqu’à 40 % selon votre niveau.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to={dashboardLink as any}
                onClick={handleCta}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-semibold text-brand-foreground transition-transform hover:translate-y-[-1px] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {user ? "Ouvrir mon espace" : "Devenir ambassadeur"} <ArrowRight className="size-4" />
              </Link>
              <a href="#fonctionnement" className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                Voir les niveaux
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Check className="size-4 text-brand" /> Inscription gratuite</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-brand" /> Paiements confirmés uniquement</span>
            </div>
          </div>
          <div className="rounded-3xl border border-brand/20 bg-card p-5 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Votre progression</p>
                <p className="mt-2 text-3xl font-black">Jusqu’à 40 %</p>
                <p className="mt-1 text-sm text-muted-foreground">sur chaque abonnement Premium confirmé</p>
              </div>
              <span className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand"><Crown className="size-6" /></span>
            </div>
            <div className="mt-7 space-y-3">
              <TierRow label="1 à 24 actifs" rate="25 %" />
              <TierRow label="25 à 49 actifs" rate="30 %" active />
              <TierRow label="50 à 99 actifs" rate="35 %" />
              <TierRow label="100 actifs ou plus" rate="40 %" />
            </div>
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Le niveau est recalculé à partir des abonnements actifs. Une période de grâce peut préserver votre niveau lors d’une résiliation ponctuelle.</p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl py-8 text-center" data-key-takeaways>
          <p className="text-3xl font-black tracking-tight text-balance sm:text-4xl">Chaque recommandation utile peut devenir une relation durable avec LiveFoot.</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Benefit icon={<Users className="size-5" />} title="Un lien personnel" text="Votre code identifie vos filleuls dès leur inscription, sans exposer leurs données privées." />
          <Benefit icon={<Wallet className="size-5" />} title="Une commission récurrente" text="Un abonnement payé et confirmé peut générer une commission à chaque renouvellement actif." />
          <Benefit icon={<ShieldCheck className="size-5" />} title="Un suivi clair" text="Consultez les montants en attente, disponibles, réservés et déjà versés depuis votre espace." />
        </section>

        <section id="fonctionnement" className="space-y-6">
          <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Comment ça marche</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Trois étapes pour commencer</h2></div>
          <div className="grid gap-4 md:grid-cols-3">
            <Step number="01" title="Créez votre lien" text="Connectez-vous et récupérez votre lien ainsi que votre code ambassadeur." />
            <Step number="02" title="Partagez avec transparence" text="Invitez des personnes qui souhaitent réellement découvrir les analyses LiveFoot." />
            <Step number="03" title="Suivez vos commissions" text="Après chaque abonnement confirmé, votre solde évolue selon votre niveau actif." />
          </div>
        </section>

        <section className="space-y-6">
          <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Conditions simples</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Une récompense basée sur de vrais abonnements</h2></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5"><h3 className="text-base font-bold">Ce qui déclenche une commission</h3><ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground"><li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" /> Le compte du filleul est confirmé.</li><li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" /> L’abonnement est payé et validé par le fournisseur.</li><li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand" /> Le paiement n’est pas remboursé ou contesté.</li></ul></div>
            <div className="rounded-2xl border border-border bg-card p-5"><h3 className="text-base font-bold">Retrait à partir de 25 000 FCFA</h3><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Les commissions récentes passent par une courte période de vérification. Lorsque votre solde disponible atteint 25 000 FCFA, vous pouvez demander un versement Mobile Money depuis votre tableau de bord.</p></div>
          </div>
        </section>

        <section className="space-y-5"><h2 className="text-2xl font-black tracking-tight sm:text-3xl">Questions fréquentes</h2><div className="grid gap-3 md:grid-cols-2">{FAQ.map((item) => <details key={item.q} className="rounded-2xl border border-border bg-card p-4"><summary className="cursor-pointer text-sm font-bold text-foreground">{item.q}</summary><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p></details>)}</div></section>

        <section className="rounded-3xl border border-brand/20 bg-brand/5 p-6 text-center sm:p-10"><p className="text-2xl font-black tracking-tight">Prêt à partager LiveFoot ?</p><p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Commencez gratuitement et retrouvez votre progression dans un espace simple et privé.</p><Link to={dashboardLink as any} onClick={handleCta} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-semibold text-brand-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Accéder au programme <ArrowRight className="size-4" /></Link></section>
      </main>
    </AppShell>
  );
}

function TierRow({ label, rate, active = false }: { label: string; rate: string; active?: boolean }) {
  return <div className={active ? "flex items-center justify-between rounded-xl bg-brand/10 px-3 py-2.5 ring-1 ring-brand/20" : "flex items-center justify-between rounded-xl bg-surface px-3 py-2.5"}><span className="text-sm font-semibold text-foreground">{label}</span><span className="text-sm font-black text-brand">{rate}</span></div>;
}

function Benefit({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <article className="rounded-2xl border border-border bg-card p-5"><span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">{icon}</span><h3 className="mt-4 text-base font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></article>;
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-black tracking-[0.16em] text-brand">{number}</p><h3 className="mt-4 text-base font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></article>;
}
