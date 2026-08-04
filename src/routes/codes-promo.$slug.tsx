import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BOOKMAKERS, getBookmaker, type Bookmaker } from "@/data/bookmakers";
import {
  AffiliateButton,
  AFF_REL,
  BonusTable,
  Breadcrumb,
  CopyCodeButton,
  PromoFaq,
  RatingStars,
  ResponsibleGamblingNotice,
} from "@/components/promo/PromoUI";
import { buildRouteMeta } from "@/lib/seo";
import { Check, X } from "lucide-react";

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
    const base = buildRouteMeta({
      path: `/codes-promo/${b.slug}`,
      title: b.seoTitle,
      description: b.seoDescription,
      image: b.bannerUrl,
      type: "article",
    });
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: b.seoTitle,
            description: b.seoDescription,
            image: b.bannerUrl ? [b.bannerUrl] : undefined,
            dateModified: b.updatedAt,
            mainEntityOfPage: url,
            author: { "@type": "Organization", name: "Livefoot IA" },
            publisher: { "@type": "Organization", name: "Livefoot IA" },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Review",
            itemReviewed: { "@type": "Organization", name: b.name, url: b.affiliateUrl },
            reviewRating: { "@type": "Rating", ratingValue: b.rating, bestRating: 5 },
            author: { "@type": "Organization", name: "Livefoot IA" },
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
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: SITE },
              { "@type": "ListItem", position: 2, name: "Codes promo", item: `${SITE}/codes-promo` },
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
        <p className="text-sm text-muted-foreground">Cette offre n'existe pas ou n'est plus active.</p>
        <a href="/codes-promo" className="inline-block rounded-xl bg-brand px-5 py-3 text-sm font-black text-brand-foreground">
          Voir tous les codes promo
        </a>
      </div>
    </AppShell>
  );
}

function BookmakerArticle() {
  const { bookmaker: b } = Route.useLoaderData() as { bookmaker: Bookmaker };

  const toc = [
    { id: "quest-ce-que", label: `Le code ${b.code}` },
    { id: "comment-utiliser", label: "Comment l'utiliser" },
    { id: "details-bonus", label: "Détails du bonus" },
    { id: "conditions", label: "Conditions" },
    ...b.sections.filter((s) => s.id !== "quest-ce-que").map((s) => ({ id: s.id, label: s.title })),
    { id: "faq", label: "FAQ" },
  ];

  const otherSections = b.sections.filter((s) => s.id !== "quest-ce-que");
  const whatIs = b.sections.find((s) => s.id === "quest-ce-que");

  return (
    <AppShell>
      <article className="space-y-8 px-4 pb-12 lg:px-0">
        <div className="pt-4">
          <Breadcrumb
            items={[{ label: "Accueil", to: "/" }, { label: "Codes promo", to: "/codes-promo" }, { label: b.name }]}
          />
        </div>

        {/* Hero */}
        <header className="space-y-4 rounded-3xl border border-border/70 bg-surface/50 p-5">
          <div className="flex items-center gap-3">
            <div
              className="grid size-14 place-items-center rounded-2xl text-base font-black text-white"
              style={{ backgroundColor: b.accent }}
              aria-hidden
            >
              {b.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-[26px] font-black leading-tight tracking-tight lg:text-4xl">
                Code promo {b.name} : {b.code}
              </h1>
              <RatingStars rating={b.rating} count={b.reviewCount} />
            </div>
          </div>

          <p className="text-lg font-black">{b.bonusHeadline}</p>
          <p className="text-sm text-muted-foreground">{b.tagline}</p>

          <div className="flex flex-wrap items-center gap-3">
            <CopyCodeButton code={b.code} size="lg" />
            <AffiliateButton href={b.affiliateUrl}>Récupérer le bonus</AffiliateButton>
          </div>

          {b.bannerUrl && (
            <a href={b.bannerLinkUrl ?? b.affiliateUrl} target="_blank" rel={AFF_REL} className="block overflow-hidden rounded-2xl">
              <img
                src={b.bannerUrl}
                alt={`Bonus de bienvenue ${b.name} avec le code promo ${b.code}`}
                loading="lazy"
                className="w-full object-cover"
              />
            </a>
          )}

          <p className="text-[11px] text-muted-foreground">
            Dernière vérification : {new Date(b.updatedAt).toLocaleDateString("fr-FR")} · Licence {b.licence} · Contenu
            sponsorisé, 18+
          </p>
        </header>

        {b.intro.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">
            {p}
          </p>
        ))}

        {/* Sommaire */}
        <nav aria-label="Sommaire" className="rounded-2xl border border-border/70 p-4">
          <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Sommaire</h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="text-sm font-semibold text-brand hover:underline">
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {whatIs && (
          <section id={whatIs.id} className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black tracking-tight">{whatIs.title}</h2>
            {whatIs.paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
            {whatIs.bullets && <BulletList items={whatIs.bullets} />}
          </section>
        )}

        <section id="comment-utiliser" className="space-y-3 scroll-mt-24">
          <h2 className="text-xl font-black tracking-tight">
            Comment utiliser le code promo {b.code} sur {b.name}
          </h2>
          <ol className="space-y-2">
            {b.steps.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-border/60 bg-surface/40 p-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-black text-brand-foreground">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="details-bonus" className="space-y-3 scroll-mt-24">
          <h2 className="text-xl font-black tracking-tight">Détails du bonus de bienvenue</h2>
          <BonusTable rows={b.bonusTable} />
        </section>

        <section id="conditions" className="space-y-3 scroll-mt-24">
          <h2 className="text-xl font-black tracking-tight">Conditions générales du bonus</h2>
          <BulletList items={b.terms} />
        </section>

        {otherSections.map((s) => (
          <section key={s.id} id={s.id} className="space-y-3 scroll-mt-24">
            <h2 className="text-xl font-black tracking-tight">{s.title}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
            {s.bullets && <BulletList items={s.bullets} />}
          </section>
        ))}

        <section className="grid gap-3 sm:grid-cols-2" aria-label="Points forts et points faibles">
          <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
            <h3 className="mb-2 text-sm font-black text-brand">Points forts</h3>
            <ul className="space-y-1.5">
              {b.pros.map((p) => (
                <li key={p} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/40 p-4">
            <h3 className="mb-2 text-sm font-black text-muted-foreground">Points faibles</h3>
            <ul className="space-y-1.5">
              {b.cons.map((p) => (
                <li key={p} className="flex gap-2 text-sm">
                  <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" className="space-y-3 scroll-mt-24">
          <h2 className="text-xl font-black tracking-tight">FAQ — code promo {b.name}</h2>
          <PromoFaq items={b.faq} />
        </section>

        <div className="space-y-3 rounded-3xl border border-border/70 bg-surface/50 p-5 text-center">
          <p className="text-base font-black">Prêt à activer votre bonus {b.name} ?</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <CopyCodeButton code={b.code} />
            <AffiliateButton href={b.affiliateUrl}>S'inscrire avec {b.code}</AffiliateButton>
          </div>
        </div>

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

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
          {it}
        </li>
      ))}
    </ul>
  );
}
