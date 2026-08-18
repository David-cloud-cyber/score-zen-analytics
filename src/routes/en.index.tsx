import { createFileRoute } from "@tanstack/react-router";
import { EnglishSeoPage } from "@/components/EnglishSeoPage";
import { buildRouteMeta, ORG, SPEAKABLE } from "@/lib/seo";

export const Route = createFileRoute("/en/")({
  head: () => ({
    ...buildRouteMeta({
      path: "/en",
      language: "en",
      title: "Live football scores and match analysis",
      description:
        "Follow live football scores, upcoming fixtures and data-based match analysis with LiveFoot IA.",
      alternates: [
        { language: "fr", path: "/" },
        { language: "en", path: "/en" },
        { language: "x-default", path: "/" },
      ],
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "LiveFoot IA",
          url: "https://www.livefoot.fun/en",
          inLanguage: "en",
          publisher: ORG,
          speakable: SPEAKABLE,
        }),
      },
    ],
  }),
  component: EnglishHomePage,
});

function EnglishHomePage() {
  return (
    <EnglishSeoPage
      eyebrow="Live football data"
      title="Live football scores and clear match analysis"
      answer="LiveFoot brings together real football scores, upcoming fixtures and structured match information. Open a match to review the score, events, statistics and available analysis in one focused interface."
      sections={[
        {
          title: "Live scores",
          text: "Follow matches as they happen and find upcoming fixtures by competition, time and status.",
        },
        {
          title: "Data-based analysis",
          text: "Compare teams using available form, head-to-head records, line-ups, injuries and match context. No result is guaranteed.",
        },
        {
          title: "Popular competitions",
          text: "Discover fixtures from major European, African and international competitions when reliable data is available.",
        },
        {
          title: "Transparent information",
          text: "LiveFoot shows when information was updated and keeps incomplete sections separate from the confirmed match identity.",
        },
      ]}
      primaryLabel="Explore analysis"
      secondaryHref="/"
      secondaryLabel="French edition"
    />
  );
}
