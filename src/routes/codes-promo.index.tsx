import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
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
import { buildRouteMeta, SPEAKABLE, ORG } from "@/lib/seo";
import { ArrowRight, BadgeCheck, ClipboardCheck, ShieldCheck, Sparkles } from "lucide-react";

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
      alternates: [
        { language: "fr", path: "/codes-promo" },
        { language: "en", path: "/en/promo-codes" },
        { language: "x-default", path: "/codes-promo" },
      ],
    });
    return {
      ...base,
      scripts: [
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
    <section id="offres" className="scroll-mt-24 space-y-4" aria-label="Liste des codes promo">
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

        <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card sm:p-7">
          <div
            className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-brand/15 blur-3xl"
            aria-hidden
          />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-brand ring-1 ring-brand/20">
              <BadgeCheck className="size-3.5" aria-hidden /> Offres partenaires vérifiées
            </span>
            <h1 className="mt-4 text-3xl font-black leading-[1.05] tracking-tight text-foreground sm:text-4xl">
              Comparez les codes promo et choisissez l’offre adaptée à votre pays
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Copiez le code avant l’inscription, vérifiez le dépôt minimum et consultez les
              conditions essentielles sans perdre de temps.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <a
                href="#offres"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-brand-foreground shadow-sm shadow-brand/20 transition-transform hover:-translate-y-0.5"
              >
                Voir les offres <ArrowRight className="size-4" aria-hidden />
              </a>
              <PremiumCta location="codes_promo_intro" compact label="Découvrir Premium" />
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-brand" /> Conditions résumées
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ClipboardCheck className="size-3.5 text-brand" /> Codes faciles à copier
              </span>
              <span>18+ · Jouez de façon responsable</span>
            </div>
          </div>
        </header>

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

        <PromoFilters />

        <section className="grid gap-3 sm:grid-cols-3" aria-labelledby="promo-steps-title">
          <h2 id="promo-steps-title" className="sr-only">
            Utiliser un code promo en trois étapes
          </h2>
          {[
            [
              "1",
              "Choisissez",
              "Comparez l’offre, le dépôt minimum et la disponibilité dans votre pays.",
            ],
            ["2", "Copiez le code", "Copiez le code LiveFoot avant d’ouvrir le site partenaire."],
            [
              "3",
              "Vérifiez",
              "Relisez les conditions affichées par le bookmaker avant tout dépôt.",
            ],
          ].map(([step, title, text]) => (
            <article
              key={step}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-card"
            >
              <span className="grid size-7 place-items-center rounded-full bg-brand text-xs font-black text-brand-foreground">
                {step}
              </span>
              <h3 className="mt-3 text-sm font-black text-foreground">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
            </article>
          ))}
        </section>

        <p className="rounded-xl border border-border/70 bg-surface/50 p-4 text-xs leading-relaxed text-muted-foreground">
          LiveFoot peut percevoir une commission si vous utilisez un lien partenaire, sans coût
          supplémentaire pour vous. Les bonus et moyens de paiement peuvent varier selon le pays :
          les conditions affichées sur le site du bookmaker font foi.
        </p>

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
