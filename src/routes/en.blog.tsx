import { createFileRoute } from "@tanstack/react-router";
import { EnglishSeoPage } from "@/components/EnglishSeoPage";
import { breadcrumbSchema, buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/en/blog")({
  head: () => ({
    ...buildRouteMeta({
      path: "/en/blog",
      language: "en",
      title: "Football news and data guides",
      description:
        "Read clear football explainers, competition guides and data-led match context from LiveFoot IA.",
      alternates: [
        { language: "fr", path: "/blog" },
        { language: "en", path: "/en/blog" },
        { language: "x-default", path: "/blog" },
      ],
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "LiveFoot", path: "/en" },
            { name: "Blog", path: "/en/blog" },
          ]),
        ),
      },
    ],
  }),
  component: BlogEnglishPage,
});

function BlogEnglishPage() {
  return (
    <EnglishSeoPage
      eyebrow="LiveFoot editorial"
      title="Football news, competition guides and data context"
      answer="The LiveFoot editorial section explains football topics with a focus on confirmed information, readable context and useful links to live scores and match analysis."
      sections={[
        {
          title: "Confirmed football information",
          text: "Articles should identify their sources, publication date and update date so readers can understand what is current.",
        },
        {
          title: "Competition context",
          text: "Follow practical explainers about competitions, team form, line-ups and the data that can influence a match.",
        },
        {
          title: "Useful next steps",
          text: "Move from an article to a real fixture, the analysis tool or the community when that action helps answer the question.",
        },
      ]}
      primaryHref="/blog"
      primaryLabel="Open the French blog"
      secondaryHref="/en/analyse"
      secondaryLabel="Analyse a match"
    />
  );
}
