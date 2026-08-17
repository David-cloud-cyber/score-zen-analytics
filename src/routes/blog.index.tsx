import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PremiumCta } from "@/components/PremiumCta";
import { BlogCard, BlogIndexEmpty, BLOG_CATEGORY_LABELS } from "@/components/BlogUI";
import { getBlogIndex } from "@/lib/editorial.functions";
import { blogIndexHead } from "@/lib/editorial-seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/blog/")({
  loader: () => getBlogIndex({ data: { page: 1 } }),
  head: () => blogIndexHead(),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const data = Route.useLoaderData();
  const categories = Object.entries(BLOG_CATEGORY_LABELS);
  return (
    <AppShell>
      <section className="mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-8 lg:px-0">
        <header className="max-w-3xl space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-brand">La rédaction LiveFoot</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Le blog football qui explique les matchs</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Actualités confirmées, données de forme, compétitions et analyses accessibles pour mieux comprendre le football du jour.
          </p>
          <PremiumCta location="blog_intro" compact label="Voir Premium" />
        </header>
        <nav aria-label="Catégories du blog" className="flex gap-2 overflow-x-auto pb-1">
          <a href="/blog" className="shrink-0 rounded-xl bg-foreground px-3 py-2 text-xs font-black text-background">Tous les articles</a>
          {categories.map(([slug, label]) => (
            <a key={slug} href={`/blog/categorie/${slug}`} className={cn("shrink-0 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground")}>{label}</a>
          ))}
        </nav>
        {data.articles.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.articles.map((article) => <BlogCard key={article.id} article={article} />)}</div>
        ) : <BlogIndexEmpty />}
      </section>
    </AppShell>
  );
}
