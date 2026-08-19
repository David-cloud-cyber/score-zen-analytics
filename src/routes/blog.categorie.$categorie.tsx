import { createFileRoute } from "@tanstack/react-router";
import { BlogListingPage, BLOG_CATEGORY_LABELS } from "@/components/BlogUI";
import { getBlogIndex } from "@/lib/editorial.functions";
import { blogCollectionHead } from "@/lib/editorial-seo";

type CategorySearch = { page: number; q: string; sort: "newest" | "useful" };

export const Route = createFileRoute("/blog/categorie/$categorie")({
  validateSearch: (search: Record<string, unknown>): CategorySearch => ({ page: Math.max(1, Math.min(100, Number(search.page ?? 1) || 1)), q: typeof search.q === "string" ? search.q.slice(0, 80) : "", sort: search.sort === "useful" ? "useful" : "newest" }),
  loaderDeps: ({ search }) => ({ page: search.page, q: search.q, sort: search.sort }),
  loader: async ({ params, deps }) => {
    try {
      const data = await getBlogIndex({ data: { page: deps.page, query: deps.q || undefined, category: params.categorie, sort: deps.sort } });
      return { ...data, _seo: deps };
    }
    catch { return { articles: [], page: deps.page, pageSize: 12, hasMore: false, total: 0, _seo: deps }; }
  },
  head: ({ params, loaderData }) => {
    const label = BLOG_CATEGORY_LABELS[params.categorie as keyof typeof BLOG_CATEGORY_LABELS] ?? "Football";
    return blogCollectionHead({
      path: `/blog/categorie/${params.categorie}`,
      title: `${label} : articles football`,
      description: `Retrouvez les articles LiveFoot sur ${label.toLowerCase()}, les compétitions et les données vérifiées.`,
      articles: loaderData?.articles ?? [],
      total: loaderData?.total,
      page: loaderData?._seo.page,
      query: loaderData?._seo.q,
      sort: loaderData?._seo.sort,
      breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Blog", path: "/blog" }, { name: label, path: `/blog/categorie/${params.categorie}` }],
    });
  },
  component: BlogCategoryPage,
});

function BlogCategoryPage() {
  const category = Route.useParams().categorie;
  const label = BLOG_CATEGORY_LABELS[category as keyof typeof BLOG_CATEGORY_LABELS] ?? "Football";
  return <BlogListingPage data={Route.useLoaderData()} basePath={`/blog/categorie/${category}`} activeCategory={category} title={label} description={`Les articles vérifiés de la rédaction LiveFoot dans la catégorie ${label.toLowerCase()}.`}/>;
}
