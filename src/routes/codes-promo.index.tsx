import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { PremiumCta } from "@/components/PremiumCta";
import { BOOKMAKERS, availableBonusTypes, type BonusType } from "@/data/bookmakers";
import { SEO_COUNTRIES } from "@/data/country-seo";
import {
  Breadcrumb,
  PromoCodeCard,
  PromoFaq,
  ResponsibleGamblingNotice,
  CopyCodeButton,
  AnswerBox,
} from "@/components/promo/PromoUI";
import { cn } from "@/lib/utils";
import { buildRouteMeta, qaSchema, SPEAKABLE, ORG } from "@/lib/seo";
import { ArrowRight, Sparkles } from "lucide-react";

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

const HUB_ANSWER =
  "Les codes promo bookmakers présentés par LiveFoot en 2026 incluent PREDAT pour 1win, MELBET et Linebet, BALL10 pour Betwinner et LIVEMONDE pour 1xBet. Les montants et conditions varient selon le pays et la campagne active. Le code se saisit pendant l'inscription et l'offre doit être vérifiée avant tout dépôt.";

export const Route = createFileRoute("/codes-promo/")({
  head: () => {
    const base = buildRouteMeta({
      path: "/codes-promo",
      title: "Codes promo bookmakers 2026 : 1win, Betwinner, MELBET, Linebet et 1xBet",
      description:
        "Comparez les codes promo 1win, Betwinner, MELBET, Linebet et 1xBet : codes partenaires, offres selon le pays, conditions, dépôt minimum, Mobile Money et avis détaillés.",
    });
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            qaSchema({
              path: "/codes-promo",
              question: "Quels sont les meilleurs codes promo bookmakers en 2026 ?",
              answer: HUB_ANSWER,
            }),
          ),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Codes promo bookmakers",
            url: `${SITE}/codes-promo`,
            inLanguage: "fr",
            publisher: ORG,
            speakable: SPEAKABLE,
          }),
        },
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
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: SITE },
              {
                "@type": "ListItem",
                position: 2,
                name: "Codes promo",
                item: `${SITE}/codes-promo`,
              },
            ],
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

/** Filtres par bookmaker et par type de bonus. */
function PromoFilters() {
  const [bookmaker, setBookmaker] = useState<string>("all");
  const [bonusType, setBonusType] = useState<BonusType | "all">("all");
  const types = availableBonusTypes();

  const list = useMemo(
    () =>
      BOOKMAKERS.filter(
        (b) =>
          (bookmaker === "all" || b.slug === bookmaker) &&
          (bonusType === "all" || b.bonusTypes.includes(bonusType)),
      ),
    [bookmaker, bonusType],
  );

  return (
    <section className="space-y-4" aria-label="Liste des codes promo">
      <div className="space-y-3 rounded-xl border border-border/70 bg-surface/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="filtre-bookmaker"
            className="text-[11px] font-black uppercase tracking-widest text-muted-foreground"
          >
            Bookmaker
          </label>
          <select
            id="filtre-bookmaker"
            value={bookmaker}
            onChange={(e) => setBookmaker(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold"
          >
            <option value="all">Tous les bookmakers</option>
            {BOOKMAKERS.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <span className="block text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            Type de bonus
          </span>
          <div className="flex flex-wrap gap-2">
            {(["all", ...types] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setBonusType(t as BonusType | "all")}
                aria-pressed={bonusType === t}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  bonusType === t
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-surface",
                )}
              >
                {t === "all" ? "Tous les bonus" : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p aria-live="polite" className="text-xs text-muted-foreground">
        {list.length} code{list.length > 1 ? "s" : ""} promo affiché{list.length > 1 ? "s" : ""}
      </p>

      {list.length === 0 ? (
        <p className="score-empty-state text-sm text-muted-foreground">
          Aucun code promo ne correspond à ces filtres.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((b) => (
            <PromoCodeCard key={b.slug} b={b} />
          ))}
        </div>
      )}
    </section>
  );
}

function PromoHub() {
  return (
    <AppShell>
      <div className="space-y-8 px-4 pb-10 lg:px-0">
        <div className="pt-4">
          <Breadcrumb items={[{ label: "Accueil", to: "/" }, { label: "Codes promo" }]} />
        </div>

        <PageTitle eyebrow="Partenaires" title="Codes promo bookmakers" />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
          <p className="text-xs text-muted-foreground">Comparez les offres partenaires, puis analysez vos matchs avec 100 crédits mensuels Premium.</p>
          <PremiumCta location="codes_promo_intro" compact label="Voir Premium" />
        </div>

        <AnswerBox
          question="Quels sont les meilleurs codes promo bookmakers en 2026 ?"
          answer={HUB_ANSWER}
        />

        <section className="animate-rise rounded-xl border border-brand/30 bg-brand/5 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
            <div className="space-y-2">
              <h2 className="text-base font-black">Choisissez votre pays</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Consultez les conditions, la devise et les moyens de paiement à vérifier pour votre
                zone avant de vous inscrire.
              </p>
              <div className="flex flex-wrap gap-2">
                {SEO_COUNTRIES.map((country) => (
                  <a
                    key={country.slug}
                    href={`/codes-promo/${country.slug}`}
                    className="inline-flex items-center gap-1 rounded-xl border border-brand/30 bg-card px-3 py-2 text-xs font-black text-brand transition-colors hover:bg-brand/10"
                  >
                    {country.name} <ArrowRight className="size-3.5" aria-hidden />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Retrouvez ici l'ensemble des{" "}
            <strong className="text-foreground">codes promo bookmakers</strong> négociés par
            LiveFoot AI pour l'Afrique francophone. Chaque code débloque le bonus de bienvenue
            maximal proposé par l'opérateur : montant supérieur à l'offre publique, sans frais et
            sans contrepartie sur vos cotes.
          </p>
          <p>
            Nous ne référençons que des plateformes qui acceptent le paiement en FCFA via Mobile
            Money (Orange Money, MTN, Moov, Wave), qui traitent les retraits rapidement et dont le
            service client répond en français. Pour chaque partenaire, une page complète détaille le
            bonus, les conditions de mise, les moyens de paiement, l'application mobile et notre
            avis, points faibles inclus.
          </p>
          <p>
            Le code doit toujours être saisi{" "}
            <strong className="text-foreground">pendant l'inscription</strong> : c'est l'erreur la
            plus fréquente, et elle est irréversible. Copiez-le d'un clic depuis les cartes
            ci-dessous avant d'ouvrir le site du bookmaker.
          </p>
        </div>

        <PromoFilters />

        <section className="space-y-3">
          <h2 className="text-lg font-black tracking-tight">Comparatif rapide</h2>
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-surface/70 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left">
                    Bookmaker
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Code
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Bonus
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Dépôt min.
                  </th>
                  <th scope="col" className="px-4 py-3 text-left">
                    Note
                  </th>
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
                    <td className="px-4 py-3 font-bold tabular-nums">
                      {b.rating ? `${b.rating.toFixed(1)}/5` : "Selon l’offre"}
                    </td>
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
