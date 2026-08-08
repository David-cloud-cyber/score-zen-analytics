import { BOOKMAKERS, type Bookmaker } from "@/data/bookmakers";
import type { SeoCountry } from "@/data/country-seo";
import { buildRouteMeta, ORG, qaSchema, SPEAKABLE } from "@/lib/seo";

const SITE = "https://www.livefoot.fun";

export function countryHubHead(country: SeoCountry) {
  const path = `/codes-promo/${country.slug}`;
  const answer = `LiveFoot compare les codes promo bookmakers destinés aux joueurs majeurs au ${country.name}. Le code, le bonus, la devise ${country.currency} et les paiements doivent être confirmés sur la page d’inscription de chaque partenaire.`;
  const base = buildRouteMeta({
    path,
    title: `Codes promo bookmakers au ${country.name} : bonus ${country.currency} 2026`,
    description: `Comparez les codes promo bookmakers au ${country.name} : bonus en ${country.currency}, conditions, dépôts Mobile Money et liens d’inscription. Offres à vérifier en 2026.`,
  });

  return {
    ...base,
    meta: [
      ...base.meta,
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { name: "author", content: "Livefoot IA" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `Codes promo bookmakers au ${country.name}`,
          url: `${SITE}${path}`,
          description: base.meta.find((item) => item.name === "description")?.content,
          inLanguage: "fr",
          publisher: ORG,
          speakable: SPEAKABLE,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          qaSchema({
            path,
            question: `Quel code promo bookmaker utiliser au ${country.name} ?`,
            answer,
          }),
        ),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Codes promo bookmakers au ${country.name}`,
          itemListElement: BOOKMAKERS.filter((b) => b.countryPageSlugs?.includes(country.slug)).map((b, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: `Code promo ${b.name} ${country.name}`,
            url: `${SITE}/codes-promo/${b.slug}/${country.slug}`,
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
            { "@type": "ListItem", position: 3, name: country.name, item: `${SITE}${path}` },
          ],
        }),
      },
    ],
  };
}

export function countryBookmakerHead(bookmaker: Bookmaker, country: SeoCountry) {
  const path = `/codes-promo/${bookmaker.slug}/${country.slug}`;
  const title = `Code promo ${bookmaker.name} ${country.name} : ${bookmaker.code} et bonus`;
  const description = `Code promo ${bookmaker.name} ${bookmaker.code} au ${country.name} : bonus en ${country.currency}, inscription, dépôt, paiements et conditions à vérifier.`;
  const answer = `Le code promo ${bookmaker.name} ${bookmaker.code} peut être utilisé au ${country.name} si l’offre est disponible pour le compte. Le bonus, la devise ${country.currency}, le dépôt minimum et les paiements doivent être confirmés lors de l’inscription.`;
  const base = buildRouteMeta({ path, title, description, image: bookmaker.bannerUrl, type: "article" });

  return {
    ...base,
    meta: [
      ...base.meta,
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { name: "author", content: "Livefoot IA" },
      { property: "article:modified_time", content: `${bookmaker.updatedAt}T00:00:00Z` },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          description,
          image: bookmaker.bannerUrl ? [bookmaker.bannerUrl] : undefined,
          dateModified: bookmaker.updatedAt,
          inLanguage: "fr",
          mainEntityOfPage: `${SITE}${path}`,
          keywords: [`code promo ${bookmaker.name} ${country.name}`, `${bookmaker.name} ${country.currency}`, `bonus bookmaker ${country.name}`].join(", "),
          author: ORG,
          publisher: ORG,
          about: [
            { "@type": "Thing", name: `Code promo ${bookmaker.name}` },
            { "@type": "Place", name: country.name },
          ],
          speakable: SPEAKABLE,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          qaSchema({
            path,
            question: `Quel est le code promo ${bookmaker.name} au ${country.name} ?`,
            answer,
            dateModified: bookmaker.updatedAt,
          }),
        ),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: `Quel est le code promo ${bookmaker.name} au ${country.name} ?`,
              acceptedAnswer: { "@type": "Answer", text: `Le code partenaire présenté est ${bookmaker.code}. Vérifiez son acceptation pendant l’inscription.` },
            },
            {
              "@type": "Question",
              name: `Quels paiements sont proposés au ${country.name} ?`,
              acceptedAnswer: { "@type": "Answer", text: `Les paiements courants incluent parfois ${country.paymentMethods.join(", ")}; la disponibilité doit être vérifiée dans le compte.` },
            },
          ],
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
            { "@type": "ListItem", position: 3, name: country.name, item: `${SITE}/codes-promo/${country.slug}` },
            { "@type": "ListItem", position: 4, name: bookmaker.name, item: `${SITE}${path}` },
          ],
        }),
      },
    ],
  };
}
