import { createFileRoute } from "@tanstack/react-router";
import { BlogListingPage } from "@/components/BlogUI";
import { getBlogIndex } from "@/lib/editorial.functions";
import { blogIndexHead } from "@/lib/editorial-seo";

type BlogSearch = { page: number; q: string; category: string; sort: "newest" | "useful" };

export const Route = createFileRoute("/blog/")({
  validateSearch: (search: Record<string, unknown>): BlogSearch => ({
    page: Math.max(1, Math.min(100, Number(search.page ?? 1) || 1)),
    q: typeof search.q === "string" ? search.q.slice(0, 80) : "",
    category: typeof search.category === "string" ? search.category.slice(0, 30) : "",
    sort: search.sort === "useful" ? "useful" : "newest",
  }),
  loaderDeps: ({ search }) => ({ page: search.page, q: search.q, category: search.category, sort: search.sort }),
  loader: async ({ deps }) => {
    try {
      const data = await getBlogIndex({ data: { page: deps.page, query: deps.q || undefined, category: deps.category || undefined, sort: deps.sort } });
      return { ...data, _seo: deps };
    } catch {
      return { articles: [], page: deps.page, pageSize: 12, hasMore: false, total: 0, _seo: deps };
    }
  },
  head: ({ loaderData }) =>
    blogIndexHead(loaderData?.articles ?? [], {
      page: loaderData?._seo.page,
      query: loaderData?._seo.q,
      category: loaderData?._seo.category,
      sort: loaderData?._seo.sort,
      total: loaderData?.total,
    }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  return <BlogListingPage data={Route.useLoaderData()} basePath="/blog" title="Le blog football qui explique les matchs" description="Actualités confirmées, données de forme, compétitions et analyses accessibles pour mieux comprendre le football du jour." />;
}
