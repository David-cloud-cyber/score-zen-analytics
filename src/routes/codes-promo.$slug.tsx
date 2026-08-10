import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  BOOKMAKERS,
  getBookmaker,
  getRelatedBookmakers,
  articleWordCount,
  type Bookmaker,
  type Section,
} from "@/data/bookmakers";
import { SEO_COUNTRIES } from "@/data/country-seo";
import {
  AffiliateButton,
  AFF_REL,
  BonusTable,
  Breadcrumb,
  CopyCodeButton,
  PromoFaq,
  RatingStars,
  ResponsibleGamblingNotice,
  RelatedBookmakers,
  SectionTable,
  AnswerBox,
  HighlightText,
} from "@/components/promo/PromoUI";
import { BookmakerLogo } from "@/components/promo/BookmakerLogo";
import { track, useCtaImpression } from "@/lib/analytics";
import { buildRouteMeta, qaSchema, factsSchema, SPEAKABLE, ORG } from "@/lib/seo";
import { Check, X, Sparkles, ArrowRight, BadgeCheck, ChevronDown } from "lucide-react";

const SITE = "https://www.livefoot.fun";

export const Route = createFileRoute("/codes-promo/$slug")({
  loader: ({ params }) => {
    const bookmaker = getBookmaker(params.slug);
    if (!bookmaker) throw notFound();
    return { bookmaker };
  },
  head: ({ params, loaderData }) => {
    const b = loaderData?.bookmaker;
    if (!b) {
      return buildRouteMeta({
        path: `/codes-promo/${params.slug}`,
        title: "Code promo introuvable",
        description: "Ce code promo n'existe pas ou n'est plus disponible.",
        noindex: true,
      });
    }
    const url = `${SITE}/codes-promo/${b.slug}`;
    const wordCount = articleWordCount(b);
    const base = buildRouteMeta({
      path: `/codes-promo/${b.slug}`,
      title: b.seoTitle,
      description: b.seoDescription,
      image: b.bannerUrl,
      type: "article",
    });
    const reviewScript =
      b.rating && b.reviewCount
        ? {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Review",
              name: `Avis sur le code promo ${b.name} ${b.code}`,
              itemReviewed: {
                "@type": "Organization",
                name: b.name,
                url: b.affiliateUrl,
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: b.rating,
                  bestRating: 5,
                  ratingCount: b.reviewCount,
                },
              },
              reviewRating: { "@type": "Rating", ratingValue: b.rating, bestRating: 5 },
              positiveNotes: {
                "@type": "ItemList",
                itemListElement: b.pros.map((p, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  name: p,
                })),
              },
              negativeNotes: {
                "@type": "ItemList",
                itemListElement: b.cons.map((p, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  name: p,
                })),
              },
              author: { "@type": "Organization", name: "Livefoot IA" },
            }),
          }
        : null;
    return {
      ...base,
      meta: [
        ...base.meta,
        { name: "author", content: "Livefoot IA" },
        { property: "article:published_time", content: `${b.updatedAt}T00:00:00Z` },
        { property: "article:modified_time", content: `${b.updatedAt}T00:00:00Z` },
        { property: "article:section", content: "Codes promo bookmakers" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: b.seoTitle,
            description: b.seoDescription,
            image: b.bannerUrl ? [b.bannerUrl] : undefined,
            datePublished: b.updatedAt,
            dateModified: b.updatedAt,
            wordCount,
            timeRequired: `PT${Math.max(6, Math.round(wordCount / 200))}M`,
            inLanguage: "fr",
            mainEntityOfPage: url,
            keywords: [
              `code promo ${b.name}`,
              `code promo ${b.name} ${b.code}`,
              `bonus ${b.name}`,
              `${b.name} Afrique`,
              `${b.name} Cameroun`,
              `paris sportifs FCFA`,
            ].join(", "),
            author: ORG,
            publisher: ORG,
            copyrightHolder: ORG,
            isPartOf: { "@type": "WebSite", name: "Livefoot IA", url: SITE },
            about: [
              { "@type": "Thing", name: `Code promo ${b.name}` },
              { "@type": "Thing", name: "Paris sportifs en Afrique francophone" },
            ],
            speakable: SPEAKABLE,
          }),
        },
        ...(reviewScript ? [reviewScript] : []),
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: `Comment utiliser le code promo ${b.name} ${b.code}`,
            description: `Étapes d'inscription sur ${b.name} avec le code promo ${b.code} pour activer le bonus de bienvenue.`,
            step: b.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: b.faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            qaSchema({
              path: `/codes-promo/${b.slug}`,
              question: `Quel est le code promo ${b.name} en 2026 ?`,
              answer: b.directAnswer!,
              dateModified: b.updatedAt,
            }),
          ),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            factsSchema({
              name: `Faits vérifiés — code promo ${b.name} ${b.code}`,
              url,
              facts: [
                { label: "Code promo", value: b.code },
                { label: "Bonus de bienvenue", value: b.bonusHeadline },
                { label: "Dépôt minimum", value: b.minDeposit },
                { label: "Licence", value: b.licence },
                ...(b.rating && b.reviewCount
                  ? [{ label: "Note éditoriale", value: `${b.rating}/5` }]
                  : []),
                { label: "Dernière vérification", value: b.updatedAt },
                ...b.bonusTable.map((r) => ({ label: r.label, value: r.value })),
              ],
            }),
          ),
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
              { "@type": "ListItem", position: 3, name: b.name, item: url },
            ],
          }),
        },
      ],
    };
  },
  notFoundComponent: PromoNotFound,
  component: BookmakerArticle,
});

function PromoNotFound() {
  return (
    <AppShell>
      <div className="space-y-4 px-4 py-16 text-center lg:px-0">
        <h1 className="text-2xl font-black">Code promo introuvable</h1>
        <p className="text-sm text-muted-foreground">
          Cette offre n'existe pas ou n'est plus active.
        </p>
        <a
          href="/codes-promo"
          className="inline-block rounded-xl bg-brand px-5 py-3 text-sm font-black text-brand-foreground"
        >
          Voir tous les codes promo
        </a>
      </div>
    </AppShell>
  );
}

/** Encart CTA vers les prédictions IA — placé aux moments clés de l'article. */
function AnalyseCta({
  title,
  text,
  label,
  location,
}: {
  title: string;
  text: string;
  label: string;
  location: string;
}) {
  const ref = useCtaImpression<HTMLElement>(location);
  return (
    <aside ref={ref} className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="space-y-2">
          <p className="text-sm font-black">{title}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
          <Link
            to="/analyse"
            search={{ home: "", away: "" }}
            onClick={() => track("cta_click", { location })}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-brand-foreground transition-transform hover:scale-[1.02] active:scale-95"
          >
            {label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </aside>
  );
}

/** CTA éditoriale placée tôt dans l'article pour répondre à l'intention d'inscription. */
function PromoRegistrationCta({ b }: { b: Bookmaker }) {
  const location = `promo_${b.slug}_registration_intro`;
  const ref = useCtaImpression<HTMLElement>(location);
  return (
    <section
      ref={ref}
      id="inscription-livefoot"
      className="scroll-mt-24 rounded-2xl border border-brand/30 bg-brand/5 p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-brand">
            Offre vérifiée par LiveFoot
          </p>
          <h2 className="text-xl font-black tracking-tight">
            Activez votre bonus avec le code {b.code}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Ouvrez votre compte {b.name} depuis cette page, saisissez{" "}
            <strong className="font-black text-foreground">{b.code}</strong> pendant l'inscription,
            puis contrôlez que le code est bien accepté avant votre premier dépôt. Le bonus dépend
            des conditions de l'opérateur : lisez-les avant de miser.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <CopyCodeButton code={b.code} size="sm" />
          <AffiliateButton href={b.affiliateUrl} className="px-4 py-2.5">
            S'inscrire avec {b.code}
          </AffiliateButton>
        </div>
      </div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
          <HighlightText text={it} />
        </li>
      ))}
    </ul>
  );
}

function SectionBlock({ s }: { s: Section }) {
  return (
    <section id={s.id} className="scroll-mt-24 space-y-4">
      <h2 className="border-l-4 border-brand pl-3 text-xl font-black leading-tight tracking-tight lg:text-2xl">
        {s.title}
      </h2>
      {s.paragraphs.map((p, i) => (
        <p key={i} className="text-[15px] leading-relaxed text-muted-foreground">
          <HighlightText text={p} />
        </p>
      ))}
      {s.bullets && <BulletList items={s.bullets} />}
      {s.table && <SectionTable head={s.table.head} rows={s.table.rows} />}
      {s.sub?.map((sub) => (
        <div
          key={sub.id}
          id={sub.id}
          className="scroll-mt-24 space-y-2 border-t border-border/50 pt-4"
        >
          <h3 className="text-base font-black tracking-tight">{sub.title}</h3>
          {sub.paragraphs.map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-muted-foreground">
              <HighlightText text={p} />
            </p>
          ))}
          {sub.bullets && <BulletList items={sub.bullets} />}
        </div>
      ))}
      {s.cta && <AnalyseCta {...s.cta} location={`article_${s.id}`} />}
    </section>
  );
}

function BookmakerArticle() {
  const { bookmaker: b } = Route.useLoaderData() as { bookmaker: Bookmaker };

  const readingMinutes = Math.max(
    6,
    Math.round(
      (b.intro.join(" ").split(" ").length +
        b.sections.reduce(
          (n, s) =>
            n +
            s.paragraphs.join(" ").split(" ").length +
            (s.sub?.reduce((m, x) => m + x.paragraphs.join(" ").split(" ").length, 0) ?? 0),
          0,
        )) /
        200,
    ),
  );

  const toc: { id: string; label: string; children?: { id: string; label: string }[] }[] = [
    { id: "inscription-livefoot", label: `S'inscrire avec le code ${b.code}` },
    { id: "comment-utiliser", label: `Comment utiliser le code ${b.code}` },
    { id: "details-bonus", label: "Détails du bonus" },
    { id: "conditions", label: "Conditions générales" },
    ...b.sections.map((s) => ({
      id: s.id,
      label: s.title,
      children: s.sub?.map((x) => ({ id: x.id, label: x.title })),
    })),
    { id: "avis-pros-cons", label: "Points forts et limites" },
    { id: "faq", label: "Foire aux questions" },
  ];

  return (
    <AppShell>
      <article className="space-y-8 px-4 pb-12 lg:px-0">
        <div className="pt-4">
          <Breadcrumb
            items={[
              { label: "Accueil", to: "/" },
              { label: "Codes promo", to: "/codes-promo" },
              { label: b.name },
            ]}
          />
        </div>

        {/* Hero */}
        <header className="space-y-4 rounded-3xl border border-border/70 bg-surface/50 p-5">
          <div className="flex items-center gap-3">
            <BookmakerLogo
              name={b.name}
              logoUrl={b.logoUrl}
              accent={b.accent}
              className="size-14 rounded-2xl text-base"
              imageClassName="inset-0 size-full rounded-2xl"
            />
            <div>
              <h1 className="text-[26px] font-black leading-tight tracking-tight lg:text-4xl">
                Code promo {b.name} : {b.code}
              </h1>
              {b.rating && b.reviewCount ? (
                <RatingStars rating={b.rating} count={b.reviewCount} />
              ) : (
                <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-brand">
                  Offre partenaire
                </span>
              )}
            </div>
          </div>

          <p className="text-lg font-black">{b.bonusHeadline}</p>
          <p className="text-sm text-muted-foreground">{b.tagline}</p>

          <div className="flex flex-wrap items-center gap-3">
            <CopyCodeButton code={b.code} size="lg" />
            <AffiliateButton href={b.affiliateUrl}>Récupérer le bonus</AffiliateButton>
            <Link
              to="/analyse"
              search={{ home: "", away: "" }}
              onClick={() => track("cta_click", { location: `promo_${b.slug}_hero` })}
              className="inline-flex items-center gap-2 rounded-xl border border-brand/40 px-4 py-3 text-sm font-black text-brand transition-colors hover:bg-brand/10"
            >
              <Sparkles className="size-4" aria-hidden />
              Analyser un match
            </Link>
          </div>

          {b.bannerUrl && (
            <a
              href={b.bannerLinkUrl ?? b.affiliateUrl}
              target="_blank"
              rel={AFF_REL}
              className="block overflow-hidden rounded-2xl"
            >
              <img
                src={b.bannerUrl}
                alt={`Bonus de bienvenue ${b.name} avec le code promo ${b.code}`}
                loading="lazy"
                className="w-full object-cover"
              />
            </a>
          )}

          <p className="text-[11px] text-muted-foreground">
            Dernière vérification : {new Date(b.updatedAt).toLocaleDateString("fr-FR")} · Licence{" "}
            {b.licence} · {readingMinutes} min de lecture · Contenu sponsorisé, 18+
          </p>
        </header>

        {/* Réponse directe — AEO/GEO */}
        {b.directAnswer && (
          <AnswerBox
            question={`Quel est le code promo ${b.name} en 2026 ?`}
            answer={b.directAnswer}
          />
        )}

        <PromoRegistrationCta b={b} />

        {/* À retenir */}
        {b.keyTakeaways.length > 0 && (
          <section
            data-key-takeaways
            aria-label="L'essentiel"
            className="rounded-2xl border border-border/70 bg-surface/40 p-5"
          >
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted-foreground">
              <BadgeCheck className="size-4 text-brand" aria-hidden />
              L'essentiel en 30 secondes
            </h2>
            <ul className="space-y-2">
              {b.keyTakeaways.map((k) => (
                <li key={k} className="flex gap-2 text-sm leading-relaxed">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  {k}
                </li>
              ))}
            </ul>
          </section>
        )}

        {b.intro.map((p, i) => (
          <p key={i} className="text-[15px] leading-relaxed text-muted-foreground">
            <HighlightText text={p} />
          </p>
        ))}

        {/* Sommaire */}
        <details open className="group rounded-2xl border border-border/70 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Sommaire
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-brand">
              <span className="group-open:hidden">Afficher</span>
              <span className="hidden group-open:inline">Masquer</span>
              <ChevronDown
                className="size-4 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </span>
          </summary>
          <nav aria-label="Sommaire">
            <ol className="mt-3 space-y-2">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="text-sm font-bold text-brand hover:underline">
                    {t.label}
                  </a>
                  {t.children && t.children.length > 0 && (
                    <ul className="mt-1 space-y-0.5 border-l border-border/60 pl-3">
                      {t.children.map((c) => (
                        <li key={c.id}>
                          <a
                            href={`#${c.id}`}
                            className="text-[13px] text-muted-foreground hover:text-foreground"
                          >
                            {c.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </details>

        <section id="comment-utiliser" className="scroll-mt-24 space-y-3">
          <h2 className="border-l-4 border-brand pl-3 text-xl font-black tracking-tight lg:text-2xl">
            Comment utiliser le code promo {b.code} sur {b.name} : étape par étape
          </h2>
          <ol className="space-y-2">
            {b.steps.map((s, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl border border-border/60 bg-surface/40 p-3"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-black text-brand-foreground">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <CopyCodeButton code={b.code} />
            <AffiliateButton href={b.affiliateUrl}>Créer mon compte {b.name}</AffiliateButton>
          </div>
        </section>

        <section id="details-bonus" className="scroll-mt-24 space-y-3">
          <h2 className="border-l-4 border-brand pl-3 text-xl font-black tracking-tight lg:text-2xl">
            Détails du bonus de bienvenue {b.name}
          </h2>
          <BonusTable rows={b.bonusTable} />
        </section>

        <section id="conditions" className="scroll-mt-24 space-y-3">
          <h2 className="border-l-4 border-brand pl-3 text-xl font-black tracking-tight lg:text-2xl">
            Conditions générales du bonus
          </h2>
          <BulletList items={b.terms} />
        </section>

        {b.sections.map((s) => (
          <SectionBlock key={s.id} s={s} />
        ))}

        <section
          id="avis-pros-cons"
          className="grid scroll-mt-24 gap-3 sm:grid-cols-2"
          aria-label="Points forts et points faibles"
        >
          <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
            <h2 className="mb-2 text-sm font-black text-brand">Points forts</h2>
            <ul className="space-y-1.5">
              {b.pros.map((p) => (
                <li key={p} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <HighlightText text={p} />
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/40 p-4">
            <h2 className="mb-2 text-sm font-black text-muted-foreground">Points faibles</h2>
            <ul className="space-y-1.5">
              {b.cons.map((p) => (
                <li key={p} className="flex gap-2 text-sm">
                  <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <HighlightText text={p} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 space-y-3">
          <h2 className="border-l-4 border-brand pl-3 text-xl font-black tracking-tight lg:text-2xl">
            Foire aux questions (FAQ) sur le code promo {b.name} en Afrique
          </h2>
          <PromoFaq items={b.faq} />
        </section>

        <RelatedBookmakers items={getRelatedBookmakers(b.slug)} />

        <div className="space-y-3 rounded-3xl border border-border/70 bg-surface/50 p-5 text-center">
          <p className="text-base font-black">Prêt à activer votre bonus {b.name} ?</p>
          <p className="text-sm text-muted-foreground">
            Copiez le code, ouvrez votre compte, puis analysez vos premières affiches avec notre IA.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <CopyCodeButton code={b.code} />
            <AffiliateButton href={b.affiliateUrl}>S'inscrire avec {b.code}</AffiliateButton>
            <Link
              to="/analyse"
              search={{ home: "", away: "" }}
              onClick={() => track("cta_click", { location: `promo_${b.slug}_final` })}
              className="inline-flex items-center gap-2 rounded-xl border border-brand/40 px-4 py-3 text-sm font-black text-brand transition-colors hover:bg-brand/10"
            >
              <Sparkles className="size-4" aria-hidden />
              Analyser un match
            </Link>
          </div>
        </div>

        <section className="space-y-3" aria-label={`Code promo ${b.name} par pays`}>
          <h2 className="text-xl font-black tracking-tight">Code promo {b.name} par pays</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Consultez la devise, les paiements et les conditions à vérifier dans votre zone avant de
            vous inscrire.
          </p>
          <div className="flex flex-wrap gap-2">
            {SEO_COUNTRIES.filter((country) => b.countryPageSlugs?.includes(country.slug)).map(
              (country) => (
                <a
                  key={country.slug}
                  href={`/codes-promo/${b.slug}/${country.slug}`}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-bold transition-colors hover:bg-surface"
                >
                  {b.name} au {country.name}
                </a>
              ),
            )}
          </div>
        </section>

        <ResponsibleGamblingNotice />

        {BOOKMAKERS.length > 1 && (
          <p className="text-center text-sm">
            <a href="/codes-promo" className="font-bold text-brand hover:underline">
              Voir tous les codes promo bookmakers
            </a>
          </p>
        )}
      </article>
    </AppShell>
  );
}
