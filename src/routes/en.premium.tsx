import { createFileRoute } from "@tanstack/react-router";
import { EnglishSeoPage } from "@/components/EnglishSeoPage";
import { breadcrumbSchema, buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/en/premium")({
  head: () => ({
    ...buildRouteMeta({
      path: "/en/premium",
      language: "en",
      title: "LiveFoot Premium football analysis",
      description:
        "Explore LiveFoot Premium: monthly analysis credits, favourites, history and additional football tools.",
      alternates: [
        { language: "fr", path: "/premium" },
        { language: "en", path: "/en/premium" },
        { language: "x-default", path: "/premium" },
      ],
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "LiveFoot", path: "/en" },
            { name: "Premium", path: "/en/premium" },
          ]),
        ),
      },
    ],
  }),
  component: PremiumEnglishPage,
});

function PremiumEnglishPage() {
  return (
    <EnglishSeoPage
      eyebrow="Premium access"
      title="More room for football analysis"
      answer="LiveFoot Premium is designed for users who want a regular analysis workflow, monthly credits, saved favourites and access to a fuller history without changing the match experience."
      sections={[
        {
          title: "100 monthly credits",
          text: "Premium credits are renewed with the active cycle. One analysis uses 3 credits, which is approximately 33 analyses when all credits are used for that purpose.",
        },
        {
          title: "A clearer workflow",
          text: "Save relevant teams and matches, review previous analyses and keep your football research in one place.",
        },
        {
          title: "No guaranteed outcome",
          text: "Premium adds tools and access. It does not guarantee a match result, a winning bet or a financial return.",
        },
      ]}
      primaryHref="/premium"
      primaryLabel="View current offers"
      secondaryHref="/en/analyse"
      secondaryLabel="Try analysis"
    />
  );
}
