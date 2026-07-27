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
