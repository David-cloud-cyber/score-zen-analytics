import { createFileRoute } from "@tanstack/react-router";
import { BlogListingPage } from "@/components/BlogUI";
import { getBlogIndex } from "@/lib/editorial.functions";
import { blogCollectionHead } from "@/lib/editorial-seo";

type FootballSearch = { page: number; q: string; category: string; sort: "newest" | "useful" };

export const Route = createFileRoute("/blog/football")({
  validateSearch: (search: Record<string, unknown>): FootballSearch => ({ page: Math.max(1, Math.min(100, Number(search.page ?? 1) || 1)), q: typeof search.q === "string" ? search.q.slice(0, 80) : "", category: typeof search.category === "string" ? search.category.slice(0, 30) : "", sort: search.sort === "useful" ? "useful" : "newest" }),
  loaderDeps: ({ search }) => ({ page: search.page, q: search.q, category: search.category, sort: search.sort }),
  loader: async ({ deps }) => {
    try {
      const data = await getBlogIndex({ data: { page: deps.page, query: deps.q || undefined, category: deps.category || undefined, sort: deps.sort } });
      return { ...data, _seo: deps };
    }
    catch { return { articles: [], page: deps.page, pageSize: 12, hasMore: false, total: 0, _seo: deps }; }
  },
  head: ({ loaderData }) => blogCollectionHead({
    path: "/blog/football",
    title: "Blog football : actualités, analyses et compétitions",
    description: "Le meilleur du football expliqué par la rédaction LiveFoot : compétitions, forme des équipes, analyses et guides utiles.",
    articles: loaderData?.articles ?? [],
    total: loaderData?.total,
    page: loaderData?._seo.page,
    query: loaderData?._seo.q,
    category: loaderData?._seo.category,
    sort: loaderData?._seo.sort,
    breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Blog", path: "/blog" }, { name: "Football", path: "/blog/football" }],
  }),
  component: FootballBlogPage,
});

function FootballBlogPage() {
  return <BlogListingPage data={Route.useLoaderData()} basePath="/blog/football" title="Le football expliqué par LiveFoot" description="Retrouvez les articles football les plus utiles : compétitions, effectifs, forme, statistiques et repères pour suivre chaque journée." />;
}
