// Route meta helper — keeps title/description/canonical/OG in sync.
export const SITE = "https://www.livefoot.fun";
export const SITE_NAME = "LiveFoot IA";

export type SeoLanguage = "fr" | "en";

export type SeoAlternate = {
  language: SeoLanguage | "x-default";
  path: string;
};

export type RouteMetaInput = {
  path: string; // e.g. "/analyse" or "/live/123"
  title: string; // page-specific; " — LiveFoot AI" is appended
  description: string;
  image?: string; // absolute URL for og:image / twitter:image (leaf routes only)
  type?: "website" | "article" | "product";
  noindex?: boolean;
  language?: SeoLanguage;
  alternates?: SeoAlternate[];
  imageWidth?: number;
  imageHeight?: number;
  imageType?: string;
};

export function buildRouteMeta(input: RouteMetaInput) {
  const fullTitle = input.title.includes(SITE_NAME) ? input.title : `${input.title} — ${SITE_NAME}`;
  const url = `${SITE}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;
  const socialImage = input.image ?? `${SITE}/logo.png`;
  const language = input.language ?? "fr";
  const imageWidth = input.imageWidth ?? 1200;
  const imageHeight = input.imageHeight ?? 630;
  const imageType = input.imageType ?? "image/png";
  const meta: Array<Record<string, string>> = [
    { title: fullTitle },
    { name: "description", content: input.description },
    { property: "og:title", content: fullTitle },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:description", content: input.description },
    { property: "og:url", content: url },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:locale", content: language === "en" ? "en_US" : "fr_FR" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: input.description },
    { name: "twitter:card", content: "summary_large_image" },
    { property: "og:image", content: socialImage },
    { property: "og:image:alt", content: fullTitle },
    { property: "og:image:width", content: String(imageWidth) },
    { property: "og:image:height", content: String(imageHeight) },
    { property: "og:image:type", content: imageType },
    { name: "twitter:image", content: socialImage },
    { name: "twitter:image:alt", content: fullTitle },
    {
      name: "robots",
      content: input.noindex
        ? "noindex, nofollow"
        : "index, follow, max-image-preview:large, max-snippet:-1",
    },
  ];
  const links: Array<Record<string, string>> = [{ rel: "canonical", href: url }];
  for (const alternate of input.alternates ?? []) {
    links.push({
      rel: "alternate",
      hrefLang: alternate.language,
      href: `${SITE}${alternate.path.startsWith("/") ? alternate.path : `/${alternate.path}`}`,
    });
  }
  return {
    meta,
    links,
  };
}

/* ------------------------------------------------------------------ */
/* AEO / GEO — helpers de données structurées                          */
/* ------------------------------------------------------------------ */

export const ORG = {
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE,
  logo: `${SITE}/logo.png`,
} as const;

/**
 * Bloc « speakable » : indique aux assistants vocaux et moteurs de réponse
 * quelles parties de la page contiennent la réponse directe.
 */
export const SPEAKABLE = {
  "@type": "SpeakableSpecification",
  cssSelector: ["h1", "[data-answer]", "[data-key-takeaways]"],
} as const;

/** FAQPage — utilisé par les extraits enrichis et les moteurs de réponse. */
export function faqSchema(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "fr",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Fil d'Ariane commun aux pages publiques pour renforcer la compréhension du site. */
export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE}${item.path.startsWith("/") ? item.path : `/${item.path}`}`,
    })),
  };
}

/** Bloc de faits vérifiables (GEO) : liste clé/valeur citable par une IA. */
export function factsSchema(input: {
  name: string;
  url: string;
  facts: { label: string; value: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: input.name,
    url: input.url,
    creator: ORG,
    inLanguage: "fr",
    variableMeasured: input.facts.map((f) => ({
      "@type": "PropertyValue",
      name: f.label,
      value: f.value,
    })),
  };
}
