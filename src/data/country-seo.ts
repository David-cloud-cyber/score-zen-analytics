/**
 * Pages pays utilisées par le hub codes promo et les fiches partenaires.
 *
 * Le contenu précise toujours que les moyens de paiement et le montant final
 * doivent être confirmés sur l'écran d'inscription du partenaire : ils peuvent
 * varier selon le pays, le compte et la campagne en cours.
 */
export const SEO_COUNTRIES = [
  {
    slug: "cameroun",
    name: "Cameroun",
    adjective: "camerounais",
    currency: "XAF",
    paymentMethods: ["Orange Money", "MTN MoMo"],
    queryLabel: "code promo bookmaker au Cameroun",
    intro:
      "Les joueurs au Cameroun recherchent surtout des offres en FCFA, une inscription simple et des dépôts compatibles avec le Mobile Money.",
  },
  {
    slug: "cote-ivoire",
    name: "Côte d’Ivoire",
    adjective: "ivoirien",
    currency: "XOF",
    paymentMethods: ["Orange Money", "MTN MoMo", "Moov Money", "Wave"],
    queryLabel: "code promo bookmaker en Côte d’Ivoire",
    intro:
      "En Côte d’Ivoire, une bonne fiche promo doit distinguer le montant annoncé, les conditions de mise et les moyens de paiement réellement proposés.",
  },
  {
    slug: "senegal",
    name: "Sénégal",
    adjective: "sénégalais",
    currency: "XOF",
    paymentMethods: ["Orange Money", "Wave", "Free Money"],
    queryLabel: "code promo bookmaker au Sénégal",
    intro:
      "Au Sénégal, l’inscription et le premier dépôt sont plus lisibles quand le code, la devise et les conditions de retrait sont expliqués avant le clic.",
  },
] as const;

export type SeoCountry = (typeof SEO_COUNTRIES)[number];
export type SeoCountrySlug = SeoCountry["slug"];

export const SEO_COUNTRY_SLUGS = SEO_COUNTRIES.map((country) => country.slug);

export function getSeoCountry(slug: string): SeoCountry | undefined {
  return SEO_COUNTRIES.find((country) => country.slug === slug);
}

export function getCountryPath(slug: SeoCountrySlug): string {
  return `/codes-promo/${slug}`;
}

export function getCountryBookmakerPath(bookmakerSlug: string, countrySlug: SeoCountrySlug): string {
  return `/codes-promo/${bookmakerSlug}/${countrySlug}`;
}
