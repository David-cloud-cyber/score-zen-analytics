import { createFileRoute } from "@tanstack/react-router";
import { EnglishSeoPage } from "@/components/EnglishSeoPage";
import { BOOKMAKERS } from "@/data/bookmakers";
import { breadcrumbSchema, buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/en/promo-codes")({
  head: () => ({
    ...buildRouteMeta({
      path: "/en/promo-codes",
      language: "en",
      title: "Football bookmaker promo codes and conditions",
      description:
        "Compare partner promo codes, bonus conditions and country availability. Always verify the offer before depositing.",
      alternates: [
        { language: "fr", path: "/codes-promo" },
        { language: "en", path: "/en/promo-codes" },
        { language: "x-default", path: "/codes-promo" },
      ],
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbSchema([
            { name: "LiveFoot", path: "/en" },
            { name: "Promo codes", path: "/en/promo-codes" },
          ]),
        ),
      },
    ],
  }),
  component: PromoCodesEnglishPage,
});

function PromoCodesEnglishPage() {
  return (
    <EnglishSeoPage
      eyebrow="Verified partner information"
      title="Bookmaker promo codes and bonus conditions"
      answer="LiveFoot lists partner codes and explains how to check the bonus, minimum deposit, country availability and important conditions before opening an account. Partner links may generate an affiliate commission."
      sections={BOOKMAKERS.slice(0, 6).map((bookmaker) => ({
        title: `${bookmaker.name} — ${bookmaker.code}`,
        text: `${bookmaker.bonusHeadline} Check the current terms, eligibility and deposit requirements on the partner registration page before using the code.`,
      }))}
      primaryHref="/codes-promo"
      primaryLabel="See all French promo pages"
      secondaryHref="/en/premium"
      secondaryLabel="Explore Premium"
    />
  );
}
