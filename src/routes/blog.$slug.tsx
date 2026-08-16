import { createFileRoute, notFound } from "@tanstack/react-router";
import { BlogArticleView } from "@/components/BlogUI";
import { getBlogArticle } from "@/lib/editorial.functions";
import { blogArticleHead } from "@/lib/editorial-seo";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const article = await getBlogArticle({ data: { slug: params.slug } });
    if (!article) throw notFound();
    return article;
  },
  head: ({ loaderData }) => (loaderData ? blogArticleHead(loaderData) : { meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: () => <BlogArticleView article={Route.useLoaderData()} />,
});
