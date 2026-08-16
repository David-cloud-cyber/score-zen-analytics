import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BlogCard, BlogIndexEmpty, BLOG_CATEGORY_LABELS } from "@/components/BlogUI";
import { getBlogIndex } from "@/lib/editorial.functions";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/blog/categorie/$categorie")({
  loader: ({ params }) => getBlogIndex({ data: { page: 1, category: params.categorie } }),
  head: ({ params }) => {
    const label = BLOG_CATEGORY_LABELS[params.categorie as keyof typeof BLOG_CATEGORY_LABELS] ?? "Football";
    return buildRouteMeta({ path: `/blog/categorie/${params.categorie}`, title: `${label} : articles football`, description: `Retrouvez les articles LiveFoot sur ${label.toLowerCase()}, les compétitions et les données vérifiées.` });
  },
  component: BlogCategoryPage,
});

function BlogCategoryPage() {
  const data = Route.useLoaderData();
  const category = Route.useParams().categorie;
  const label = BLOG_CATEGORY_LABELS[category as keyof typeof BLOG_CATEGORY_LABELS] ?? "Football";
  return (
    <AppShell>
      <section className="mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-8 lg:px-0">
        <header><p className="text-[10px] font-black uppercase tracking-widest text-brand">Blog LiveFoot</p><h1 className="mt-2 text-3xl font-black tracking-tight">{label}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Les articles vérifiés de la rédaction LiveFoot dans cette catégorie.</p></header>
        {data.articles.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.articles.map((article) => <BlogCard key={article.id} article={article} />)}</div> : <BlogIndexEmpty />}
      </section>
    </AppShell>
  );
}
