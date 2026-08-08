import { createFileRoute } from "@tanstack/react-router";
import { CountryHubPage } from "@/components/promo/CountrySeoPage";
import { SEO_COUNTRIES } from "@/data/country-seo";
import { countryHubHead } from "@/lib/country-seo-meta";

const country = SEO_COUNTRIES[0];

export const Route = createFileRoute("/codes-promo/cameroun")({
  head: () => countryHubHead(country),
  component: () => <CountryHubPage country={country} />,
});
