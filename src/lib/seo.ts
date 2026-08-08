// Route meta helper — keeps title/description/canonical/OG in sync.
const SITE = "https://www.livefoot.fun";
const SITE_NAME = "Livefoot IA";

export type RouteMetaInput = {
  path: string; // e.g. "/analyse" or "/live/123"
  title: string; // page-specific; " — LiveFoot AI" is appended
  description: string;
  image?: string; // absolute URL for og:image / twitter:image (leaf routes only)
  type?: "website" | "article" | "product";
  noindex?: boolean;
};

export function buildRouteMeta(input: RouteMetaInput) {
  const fullTitle = input.title.includes(SITE_NAME)
    ? input.title
    : `${input.title} — ${SITE_NAME}`;
  const url = `${SITE}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;
  const meta: Array<Record<string, string>> = [
    { title: fullTitle },
    { name: "description", content: input.description },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: input.description },
    { property: "og:url", content: url },
    { property: "og:type", content: input.type ?? "website" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: input.description },
    { name: "twitter:card", content: input.image ? "summary_large_image" : "summary" },
  ];
  if (input.image) {
    meta.push({ property: "og:image", content: input.image });
    meta.push({ name: "twitter:image", content: input.image });
  }
  if (input.noindex) meta.push({ name: "robots", content: "noindex" });
  return {
    meta,
    links: [{ rel: "canonical", href: url }],
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

/**
 * QAPage — une question principale et sa réponse courte factuelle.
 * C'est le format que les moteurs génératifs citent le plus volontiers.
 */
export function qaSchema(input: {
  path: string;
  question: string;
  answer: string;
  dateModified?: string;
}) {
  const url = `${SITE}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;
  return {
    "@context": "https://schema.org",
    "@type": "QAPage",
    inLanguage: "fr",
    mainEntity: {
      "@type": "Question",
      name: input.question,
      text: input.question,
      answerCount: 1,
      dateCreated: input.dateModified,
      author: ORG,
      acceptedAnswer: {
        "@type": "Answer",
        text: input.answer,
        url,
        author: ORG,
      },
    },
  };
}

/** Bloc de faits vérifiables (GEO) : liste clé/valeur citable par une IA. */
export function factsSchema(input: { name: string; url: string; facts: { label: string; value: string }[] }) {
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
