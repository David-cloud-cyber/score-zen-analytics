import { createFileRoute } from "@tanstack/react-router";
import { EnglishSeoPage } from "@/components/EnglishSeoPage";
import { breadcrumbSchema, buildRouteMeta, faqSchema, SPEAKABLE } from "@/lib/seo";

const FAQ = [
  {
    q: "How much does an analysis cost?",
    a: "One match analysis uses 3 credits. New accounts receive 5 welcome credits, while Premium members receive 100 credits per month.",
  },
  {
    q: "Are football predictions guaranteed?",
    a: "No. Football is uncertain. LiveFoot provides statistical estimates to help users understand a match, never a guaranteed result or profit.",
  },
];

export const Route = createFileRoute("/en/analyse")({
  head: () => ({
    ...buildRouteMeta({
      path: "/en/analyse",
      language: "en",
      title: "Football match predictions and team analysis",
      description:
        "Compare two teams with structured football data, probabilities and available match context on LiveFoot IA.",
      alternates: [
        { language: "fr", path: "/analyse" },
        { language: "en", path: "/en/analyse" },
        { language: "x-default", path: "/analyse" },
      ],
    }),
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(faqSchema(FAQ)) },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "LiveFoot", path: "/en" },
            { name: "Analysis", path: "/en/analyse" },
          ]),
        ),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "LiveFoot football analysis",
          applicationCategory: "SportsApplication",
          operatingSystem: "Web",
          inLanguage: "en",
          url: "https://www.livefoot.fun/en/analyse",
          speakable: SPEAKABLE,
          offers: { "@type": "Offer", price: "0", priceCurrency: "XAF" },
        }),
      },
    ],
  }),
  component: AnalysisEnglishPage,
});

function AnalysisEnglishPage() {
  return (
    <EnglishSeoPage
      eyebrow="Football analysis"
      title="Understand a match before kick-off"
      answer="LiveFoot compares the available data around two teams and presents probabilities, relevant markets and the main factors behind the estimate. The result is informative, not a promise of success."
      sections={[
        {
          title: "What is reviewed?",
          text: "The analysis can use recent form, home and away context, head-to-head history, injuries, line-ups, competition context and available market information.",
        },
        {
          title: "A concise result",
          text: "The key probabilities and reasons are presented first, with additional sections available when the underlying data is confirmed.",
        },
        {
          title: "Responsible use",
          text: "Treat every prediction as an estimate. Set limits and never stake money you cannot afford to lose.",
        },
      ]}
      primaryHref="/analyse"
      primaryLabel="Open the analysis tool"
      secondaryHref="/en/premium"
      secondaryLabel="See Premium"
    />
  );
}
