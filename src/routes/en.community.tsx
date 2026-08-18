import { createFileRoute } from "@tanstack/react-router";
import { EnglishSeoPage } from "@/components/EnglishSeoPage";
import { breadcrumbSchema, buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/en/community")({
  head: () => ({
    ...buildRouteMeta({
      path: "/en/community",
      language: "en",
      title: "Live football community and match votes",
      description:
        "Join the LiveFoot football community, follow real fixtures and compare supporters' match views.",
      alternates: [
        { language: "fr", path: "/communaute" },
        { language: "en", path: "/en/community" },
        { language: "x-default", path: "/communaute" },
      ],
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "LiveFoot", path: "/en" },
            { name: "Community", path: "/en/community" },
          ]),
        ),
      },
    ],
  }),
  component: CommunityEnglishPage,
});

function CommunityEnglishPage() {
  return (
    <EnglishSeoPage
      eyebrow="Public football community"
      title="Share your view on real football matches"
      answer="LiveFoot Community brings match votes and discussions together around real fixtures. Read the conversation first, then sign in to vote or post while respecting other supporters."
      sections={[
        {
          title: "Real fixtures",
          text: "Community cards are based on matches available in the shared football data, not invented demonstrations in production.",
        },
        {
          title: "Conversation",
          text: "Reply to messages, use simple reactions and report content that breaks the community rules.",
        },
        {
          title: "Responsible discussion",
          text: "Votes are opinions, not evidence of a guaranteed result. Keep conversations respectful and avoid promises of profit.",
        },
      ]}
      primaryHref="/communaute"
      primaryLabel="Open the community"
      secondaryHref="/en"
      secondaryLabel="Back to LiveFoot"
    />
  );
}
