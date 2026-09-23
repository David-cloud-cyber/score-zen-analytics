export type FeaturedCompetition = {
  id: number;
  slug: string;
  name: string;
  country: string;
};

/**
 * Répertoire éditorial stable des compétitions que les visiteurs recherchent le
 * plus. Les données de calendrier, classement et buteurs sont toujours lues
 * depuis le fournisseur au moment de l'ouverture de la page.
 */
export const FEATURED_COMPETITIONS: readonly FeaturedCompetition[] = [
  { id: 39, slug: "premier-league-39", name: "Premier League", country: "Angleterre" },
  { id: 140, slug: "la-liga-140", name: "La Liga", country: "Espagne" },
  { id: 135, slug: "serie-a-135", name: "Serie A", country: "Italie" },
  { id: 78, slug: "bundesliga-78", name: "Bundesliga", country: "Allemagne" },
  { id: 61, slug: "ligue-1-61", name: "Ligue 1", country: "France" },
  { id: 2, slug: "uefa-champions-league-2", name: "UEFA Champions League", country: "Europe" },
  { id: 3, slug: "uefa-europa-league-3", name: "UEFA Europa League", country: "Europe" },
  { id: 1, slug: "world-cup-1", name: "Coupe du monde", country: "Monde" },
  { id: 88, slug: "eredivisie-88", name: "Eredivisie", country: "Pays Bas" },
  { id: 94, slug: "primeira-liga-94", name: "Primeira Liga", country: "Portugal" },
  { id: 71, slug: "brazil-serie-a-71", name: "Brazil Serie A", country: "Brésil" },
  { id: 233, slug: "egypt-premier-league-233", name: "Premier League Égypte", country: "Égypte" },
] as const;

export function competitionSlug(name: string, id: number) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${normalized || "competition"}-${id}`;
}

export function competitionPath(competition: Pick<FeaturedCompetition, "id" | "slug">) {
  return `/championnats/${competition.slug || `competition-${competition.id}`}`;
}

export function competitionIdFromSlug(slug: string) {
  const match = /(?:^|-)(\d+)$/.exec(slug);
  const id = Number(match?.[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
