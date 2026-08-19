import { createFileRoute } from "@tanstack/react-router";
import { BlogListingPage } from "@/components/BlogUI";
import { getBlogIndex } from "@/lib/editorial.functions";
import { buildRouteMeta } from "@/lib/seo";

type FootballSearch = { page: number; q: string; category: string; sort: "newest" | "useful" };

export const Route = createFileRoute("/blog/football")({
  validateSearch: (search: Record<string, unknown>): FootballSearch => ({ page: Math.max(1, Math.min(100, Number(search.page ?? 1) || 1)), q: typeof search.q === "string" ? search.q.slice(0, 80) : "", category: typeof search.category === "string" ? search.category.slice(0, 30) : "", sort: search.sort === "useful" ? "useful" : "newest" }),
  loaderDeps: ({ search }) => ({ page: search.page, q: search.q, category: search.category, sort: search.sort }),
  loader: async ({ deps }) => {
    try { return await getBlogIndex({ data: { page: deps.page, query: deps.q || undefined, category: deps.category || undefined, sort: deps.sort } }); }
    catch { return { articles: [], page: deps.page, pageSize: 12, hasMore: false, total: 0 }; }
  },
  head: ({ loaderData }) => ({ ...buildRouteMeta({ path: "/blog/football", title: "Blog football : actualités, analyses et compétitions", description: "Le meilleur du football expliqué par la rédaction LiveFoot : compétitions, forme des équipes, analyses et guides utiles." }), scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", name: "Blog football LiveFoot", url: "https://www.livefoot.fun/blog/football", mainEntity: { "@type": "ItemList", itemListElement: (loaderData?.articles ?? []).map((article, index) => ({ "@type": "ListItem", position: index + 1, name: article.title, url: `https://www.livefoot.fun/blog/${article.slug}` })) } }) }] }),
  component: FootballBlogPage,
});

function FootballBlogPage() {
  return <BlogListingPage data={Route.useLoaderData()} basePath="/blog/football" title="Le football expliqué par LiveFoot" description="Retrouvez les articles football les plus utiles : compétitions, effectifs, forme, statistiques et repères pour suivre chaque journée." />;
}
