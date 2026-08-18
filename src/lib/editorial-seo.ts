import { buildRouteMeta, breadcrumbSchema, faqSchema, ORG, SPEAKABLE } from "@/lib/seo";
import type { EditorialListItem, PublicEditorialArticle } from "./editorial.types";

const SITE = "https://www.livefoot.fun";

export function blogIndexHead(articles: EditorialListItem[] = []) {
  const base = buildRouteMeta({
    path: "/blog",
    title: "Blog football : actualités, analyses et données vérifiées",
    description:
      "Actualités football confirmées, analyses statistiques, forme des équipes et guides utiles pour suivre les compétitions en France et en Afrique francophone.",
    alternates: [
      { language: "fr", path: "/blog" },
      { language: "en", path: "/en/blog" },
      { language: "x-default", path: "/blog" },
    ],
  });
  return {
    ...base,
    links: [
      ...base.links,
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "Flux RSS du blog football LiveFoot",
        href: `${SITE}/blog/rss.xml`,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Blog football LiveFoot",
          url: `${SITE}/blog`,
          inLanguage: "fr",
          publisher: ORG,
          speakable: SPEAKABLE,
          mainEntity: articles.length
            ? {
                "@type": "ItemList",
                itemListElement: articles.slice(0, 12).map((article, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  name: article.title,
                  url: `${SITE}/blog/${article.slug}`,
                })),
              }
            : undefined,
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "Accueil", path: "/" },
            { name: "Blog", path: "/blog" },
          ]),
        ),
      },
    ],
  };
}

export function blogArticleHead(article: PublicEditorialArticle) {
  const path = `/blog/${article.slug}`;
  const base = buildRouteMeta({
    path,
    title: article.seoTitle,
    description: article.seoDescription,
    image: article.coverImage ?? undefined,
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
        image: article.coverImage ? [article.coverImage] : undefined,
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
