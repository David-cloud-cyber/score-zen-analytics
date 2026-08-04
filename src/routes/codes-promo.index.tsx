import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageTitle } from "@/components/AppShell";
import { BOOKMAKERS } from "@/data/bookmakers";
import {
  Breadcrumb,
  PromoCodeCard,
  PromoFaq,
  ResponsibleGamblingNotice,
  CopyCodeButton,
} from "@/components/promo/PromoUI";
import { buildRouteMeta } from "@/lib/seo";

const SITE = "https://www.livefoot.fun";

const HUB_FAQ = [
  {
    q: "Qu'est-ce qu'un code promo bookmaker ?",
    a: "C'est un code partenaire à saisir lors de l'inscription sur un site de paris. Il débloque une offre de bienvenue supérieure à l'offre standard, sans frais supplémentaires pour le joueur.",
  },
  {
    q: "Les codes promo de cette page sont-ils gratuits ?",
    a: "Oui. Tous les codes listés sont gratuits. LiveFoot AI perçoit une commission d'affiliation de la part du bookmaker si vous vous inscrivez, ce qui n'affecte ni vos cotes ni votre bonus.",
  },
  {
    q: "Faut-il saisir le code avant ou après l'inscription ?",
    a: "Toujours pendant l'inscription. La quasi-totalité des bookmakers refusent d'appliquer un code promo une fois le compte créé.",
  },
  {
    q: "Puis-je cumuler plusieurs codes promo ?",
    a: "Un seul code par bookmaker et par personne. En revanche, rien n'empêche d'ouvrir un compte chez plusieurs opérateurs et de profiter de chaque bonus de bienvenue.",
  },
  {
    q: "Ces bonus sont-ils retirables immédiatement ?",
    a: "Non. Chaque bonus est soumis à des conditions de mise (type de pari, cote minimale, délai). Les détails figurent sur la page dédiée à chaque bookmaker.",
  },
];

export const Route = createFileRoute("/codes-promo/")({
  head: () => {
    const base = buildRouteMeta({
      path: "/codes-promo",
      title: "Codes promo bookmakers 2026 : bonus vérifiés en FCFA",
      description:
        "Tous nos codes promo partenaires vérifiés : bonus de bienvenue, conditions, dépôt minimum et avis détaillé pour chaque bookmaker accepté en Afrique francophone.",
    });
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Codes promo bookmakers",
            itemListElement: BOOKMAKERS.map((b, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `Code promo ${b.name} ${b.code}`,
              url: `${SITE}/codes-promo/${b.slug}`,
            })),
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: HUB_FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
      ],
    };
  },
  component: PromoHub,
});

function PromoHub() {
  return (
    <AppShell>
      <div className="space-y-8 px-4 pb-10 lg:px-0">
        <div className="pt-4">
          <Breadcrumb items={[{ label: "Accueil", to: "/" }, { label: "Codes promo" }]} />
        </div>

        <PageTitle eyebrow="Partenaires" title="Codes promo bookmakers" />

        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Retrouvez ici l'ensemble des <strong className="text-foreground">codes promo bookmakers</strong> négociés par
            LiveFoot AI pour l'Afrique francophone. Chaque code débloque le bonus de bienvenue maximal proposé par
            l'opérateur : montant supérieur à l'offre publique, sans frais et sans contrepartie sur vos cotes.
          </p>
          <p>
            Nous ne référençons que des plateformes qui acceptent le paiement en FCFA via Mobile Money (Orange Money,
            MTN, Moov, Wave), qui traitent les retraits rapidement et dont le service client répond en français. Pour
            chaque partenaire, une page complète détaille le bonus, les conditions de mise, les moyens de paiement,
            l'application mobile et notre avis, points faibles inclus.
          </p>
          <p>
            Le code doit toujours être saisi <strong className="text-foreground">pendant l'inscription</strong> : c'est
            l'erreur la plus fréquente, et elle est irréversible. Copiez-le d'un clic depuis les cartes ci-dessous avant
            d'ouvrir le site du bookmaker.
          </p>
        </div>

        <section className="grid gap-4 lg:grid-cols-2" aria-label="Liste des codes promo">
          {BOOKMAKERS.map((b) => (
            <PromoCodeCard key={b.slug} b={b} />
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black tracking-tight">Comparatif rapide</h2>
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-surface/70 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left">Bookmaker</th>
                  <th scope="col" className="px-4 py-3 text-left">Code</th>
                  <th scope="col" className="px-4 py-3 text-left">Bonus</th>
                  <th scope="col" className="px-4 py-3 text-left">Dépôt min.</th>
                  <th scope="col" className="px-4 py-3 text-left">Note</th>
                </tr>
              </thead>
              <tbody>
                {BOOKMAKERS.map((b) => (
                  <tr key={b.slug} className="border-t border-border/60">
                    <td className="px-4 py-3 font-bold">{b.name}</td>
                    <td className="px-4 py-3">
                      <CopyCodeButton code={b.code} size="sm" />
                    </td>
                    <td className="px-4 py-3">{b.bonusHeadline}</td>
                    <td className="px-4 py-3 tabular-nums">{b.minDeposit}</td>
                    <td className="px-4 py-3 font-bold tabular-nums">{b.rating.toFixed(1)}/5</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black tracking-tight">Questions fréquentes</h2>
          <PromoFaq items={HUB_FAQ} />
        </section>

        <ResponsibleGamblingNotice />
      </div>
    </AppShell>
  );
}
