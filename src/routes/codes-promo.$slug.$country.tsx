import { createFileRoute, notFound } from "@tanstack/react-router";
import { CountryBookmakerPage } from "@/components/promo/CountrySeoPage";
import { getBookmaker, type Bookmaker } from "@/data/bookmakers";
import { getSeoCountry } from "@/data/country-seo";
import { countryBookmakerHead } from "@/lib/country-seo-meta";

export const Route = createFileRoute("/codes-promo/$slug/$country")({
  loader: ({ params }) => {
    const bookmaker = getBookmaker(params.slug);
    const country = getSeoCountry(params.country);
    if (!bookmaker || !country || !bookmaker.countryPageSlugs?.includes(country.slug)) throw notFound();
    return { bookmaker, country };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Code promo introuvable" }, { name: "robots", content: "noindex" }],
      };
    }
    return countryBookmakerHead(loaderData.bookmaker, loaderData.country);
  },
  notFoundComponent: () => <p className="p-8 text-center font-bold">Cette offre pays n’est pas disponible.</p>,
  component: CountryBookmakerRoute,
});

function CountryBookmakerRoute() {
  const { bookmaker, country } = Route.useLoaderData() as { bookmaker: Bookmaker; country: ReturnType<typeof getSeoCountry> };
  if (!country) return null;
  return <CountryBookmakerPage bookmaker={bookmaker} country={country} />;
}
