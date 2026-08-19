import { buildRouteMeta, breadcrumbSchema, faqSchema, ORG, SPEAKABLE } from "@/lib/seo";
import type { EditorialListItem, PublicEditorialArticle } from "./editorial.types";

const SITE = "https://www.livefoot.fun";

type BlogCollectionOptions = {
  path: string;
  title: string;
  description: string;
  articles?: EditorialListItem[];
  total?: number;
  page?: number;
  query?: string;
  category?: string;
  sort?: "newest" | "useful";
  breadcrumb: { name: string; path: string }[];
  alternates?: { language: "fr" | "en" | "x-default"; path: string }[];
};

/**
 * SEO partagé pour les hubs éditoriaux.
 * Les recherches, tris et filtres restent accessibles aux visiteurs mais ne
 * créent pas de copies concurrentes dans l'index. Les pages paginées propres
 * gardent leur URL canonique afin que tous les articles restent découvrables.
 */
export function blogCollectionHead(options: BlogCollectionOptions) {
  const page = Math.max(1, options.page ?? 1);
  const refined = Boolean(options.query || options.category || options.sort === "useful");
  const canonicalPath = refined
    ? options.path
    : page > 1
      ? `${options.path}?page=${page}`
      : options.path;
  const total = options.total ?? options.articles?.length ?? 0;
  const base = buildRouteMeta({
    path: canonicalPath,
    title: options.title,
    description: options.description,
    noindex: refined || total < 2,
    alternates: !refined && page === 1 ? options.alternates : undefined,
  });
  const articles = options.articles ?? [];
  return {
    ...base,
    links: [
      ...base.links,
      ...(options.path === "/blog"
        ? [{ rel: "alternate", type: "application/rss+xml", title: "Flux RSS du blog football LiveFoot", href: `${SITE}/blog/rss.xml` }]
        : []),
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: options.title,
          description: options.description,
          url: `${SITE}${canonicalPath}`,
          inLanguage: "fr",
          publisher: ORG,
          speakable: SPEAKABLE,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: total,
            itemListElement: articles.slice(0, 12).map((article, index) => ({
              "@type": "ListItem",
              position: index + 1 + (page - 1) * 12,
              name: article.title,
              url: `${SITE}/blog/${article.slug}`,
              ...(article.coverImage ? { image: article.coverImage.startsWith("/") ? `${SITE}${article.coverImage}` : article.coverImage } : {}),
            })),
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(breadcrumbSchema(options.breadcrumb)),
      },
    ],
  };
}

export function blogIndexHead(
  articles: EditorialListItem[] = [],
  options: Pick<BlogCollectionOptions, "page" | "query" | "category" | "sort" | "total"> = {},
) {
  return blogCollectionHead({
    path: "/blog",
    title: "Blog football : actualités, analyses et données vérifiées",
    description:
      "Actualités football confirmées, analyses statistiques, forme des équipes et guides utiles pour suivre les compétitions en France et en Afrique francophone.",
    articles,
    ...options,
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Blog", path: "/blog" },
    ],
    alternates: [
      { language: "fr", path: "/blog" },
      { language: "en", path: "/en/blog" },
      { language: "x-default", path: "/blog" },
    ],
  });
}

export function blogArticleHead(article: PublicEditorialArticle) {
  const path = `/blog/${article.slug}`;
  const articleImage = article.coverImage?.startsWith("/") ? `${SITE}${article.coverImage}` : article.coverImage ?? undefined;
  const base = buildRouteMeta({
    path,
    title: article.seoTitle,
    description: article.seoDescription,
    image: articleImage,
    type: "article",
  });
  const scripts = [
    {
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        description: article.seoDescription,
        image: articleImage ? [articleImage] : undefined,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        wordCount: article.wordCount,
        articleBody: [
          article.directAnswer,
          article.content.summary,
          ...article.content.sections.flatMap((section) => section.paragraphs),
        ].join("\n\n"),
        keywords: [article.title, article.category, "football", "LiveFoot"].join(", "),
        inLanguage: "fr",
        mainEntityOfPage: `${SITE}${path}`,
        author: { "@type": "Person", name: article.authorName },
        publisher: ORG,
        isPartOf: { "@type": "Blog", name: "Blog LiveFoot", url: `${SITE}/blog` },
        speakable: SPEAKABLE,
      }),
    },
    {
      type: "application/ld+json",
      children: JSON.stringify(
        breadcrumbSchema([
          { name: "Accueil", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: article.title, path },
        ]),
      ),
    },
  ];
  if (article.content.faq.length) {
    scripts.push({
      type: "application/ld+json",
      children: JSON.stringify(
        faqSchema(article.content.faq.map((item) => ({ q: item.question, a: item.answer }))),
      ),
    });
  }
  return {
    ...base,
    meta: [
      ...base.meta,
      { name: "author", content: article.authorName },
      { property: "article:published_time", content: article.publishedAt },
      { property: "article:modified_time", content: article.updatedAt },
      { property: "article:section", content: article.category },
    ],
    scripts,
  };
}
