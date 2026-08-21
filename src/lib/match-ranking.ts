import type { RemoteMatchSummary } from "./football-types";

/**
 * Classement serveur des rencontres.
 *
 * Ce module ne modifie aucune donnée affichée dans une carte : il détermine
 * seulement l'ordre dans lequel les rencontres et leurs compétitions sont
 * envoyées à la page Matchs.
 */

/**
 * Priorité éditoriale des compétitions connues.
 *
 * Les IDs sont la source principale : les noms de compétitions peuvent varier
 * selon la langue ou le fournisseur. Les termes ci-dessous servent de secours
 * pour les nouveaux IDs et les libellés localisés.
 *
 * 3 = priorité majeure (grands championnats, compétitions mondiales),
 * 2 = priorité forte (coupes continentales et championnats très suivis),
 * 1 = priorité locale ou secondaire à conserver dans les affiches populaires.
 */
const POPULAR_LEAGUE_PRIORITIES = new Map<number, 1 | 2 | 3>([
  [1, 3], // FIFA World Cup
  [2, 3], // UEFA Champions League
  [3, 2], // UEFA Europa League
  [4, 3], // UEFA Euro
  [6, 3], // Africa Cup of Nations
  [11, 2], // Copa Sudamericana
  [12, 2], // CAF Champions League
  [13, 3], // Copa Libertadores
  [39, 3], // Premier League
  [40, 1], // Championship
  [61, 3], // Ligue 1
  [71, 2], // Brasileirão Série A
  [78, 3], // Bundesliga
  [88, 2], // Eredivisie
  [94, 2], // Primeira Liga
  [140, 3], // La Liga
  [143, 2], // Copa del Rey
  [253, 2], // MLS
  [307, 2], // Saudi Pro League
  [848, 2], // UEFA Conference League
  [135, 3], // Serie A
]);

const POPULAR_LEAGUE_TERMS: ReadonlyArray<{ terms: string[]; priority: 1 | 2 | 3 }> = [
  {
    priority: 3,
    terms: [
      "champions league",
      "ligue des champions",
      "premier league",
      "la liga",
      "laliga",
      "ligue 1",
      "bundesliga",
      "serie a",
      "world cup",
      "coupe du monde",
      "euro",
      "copa libertadores",
      "africa cup of nations",
      "coupe d afrique des nations",
      "afcon",
    ],
  },
  {
    priority: 2,
    terms: [
      "europa league",
      "conference league",
      "eredivisie",
      "primeira liga",
      "liga portugal",
      "brasileirao",
      "brasileiro serie a",
      "copa sudamericana",
      "copa del rey",
      "fa cup",
      "caf champions league",
      "major league soccer",
      "mls",
      "saudi pro league",
    ],
  },
  {
    priority: 1,
    terms: ["championship"],
  },
];

const POPULAR_TEAMS = new Set([
  40, // Liverpool
  42, // Arsenal
  49, // Chelsea
  50, // Manchester City
  33, // Manchester United
  157, // Bayern Munich
  165, // Borussia Dortmund
  529, // Barcelona
  530, // Atlético de Madrid
  541, // Real Madrid
  85, // PSG
  127, // Borussia M'gladbach
]);

const LIVE_STATUSES = new Set<RemoteMatchSummary["status"]>(["live", "ht"]);
const IMMINENT_WINDOW_MS = 6 * 60 * 60 * 1000;

const DERBY_PAIRS = [
  ["arsenal", "tottenham"],
  ["inter", "milan"],
  ["real madrid", "atletico madrid"],
  ["barcelona", "espanyol"],
  ["manchester city", "manchester united"],
  ["bayern munich", "borussia dortmund"],
  ["paris saint germain", "olympique de marseille"],
];

export type MatchRankingSignal = {
  /** Votes communautaires réels déjà enregistrés pour cette rencontre. */
  communityVotes?: number;
  /** Richesse des données connues côté serveur, sans exposer le détail au client. */
  dataRichness?: number;
};

export type MatchRankingOptions = {
  favoriteMatchIds?: ReadonlySet<string> | readonly string[];
  favoriteTeamIds?: ReadonlySet<string> | readonly string[];
  favoriteTeamNames?: ReadonlySet<string> | readonly string[];
  signals?: ReadonlyMap<string, MatchRankingSignal>;
  /** Conserve l'ordre calculé côté serveur et ne remonte que les favoris. */
  serverRanked?: boolean;
  now?: number;
};

function isTrendingCandidate(match: RemoteMatchSummary, now: number): boolean {
  if (LIVE_STATUSES.has(match.status)) return true;

  const kickoff = kickoffTime(match);
  return match.status === "upcoming" && kickoff >= now && kickoff - now <= IMMINENT_WINDOW_MS;
}

function kickoffTime(match: RemoteMatchSummary): number {
  const value = new Date(match.kickoff).getTime();
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\b(fc|cf|sc|ac|as|afc|fk|bk|sk)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasReference(reference: string, id: number, names: string[]): boolean {
  const normalizedReference = normalizeName(reference);
  if (!normalizedReference) return false;
  return (
    reference === String(id) ||
    names.some((name) => {
      const normalizedName = normalizeName(name);
      return (
        normalizedName === normalizedReference ||
        normalizedName.includes(normalizedReference) ||
        normalizedReference.includes(normalizedName)
      );
    })
  );
}

function toArray(
  references: ReadonlySet<string> | readonly string[] | undefined,
): readonly string[] {
  if (!references) return [];
  return references instanceof Set ? [...references] : (references as readonly string[]);
}

function includesReference(
  references: MatchRankingOptions["favoriteTeamIds"] | MatchRankingOptions["favoriteTeamNames"],
  id: number,
  names: string[],
): boolean {
  return toArray(references).some((reference) => hasReference(String(reference), id, names));
}

function isFavorite(
  match: RemoteMatchSummary,
  favoriteMatchIds?: MatchRankingOptions["favoriteMatchIds"],
  favoriteTeamIds?: MatchRankingOptions["favoriteTeamIds"],
  favoriteTeamNames?: MatchRankingOptions["favoriteTeamNames"],
): boolean {
  const matchIsFavorite = toArray(favoriteMatchIds).includes(String(match.id));
  if (matchIsFavorite) return true;

  const teamReferences = [favoriteTeamIds, favoriteTeamNames].filter(Boolean) as string[][];
  return [match.home, match.away].some((team) =>
    teamReferences.some((references) =>
      includesReference(references, team.id, [team.name, team.short]),
    ),
  );
}

export function competitionPriority(match: RemoteMatchSummary): 0 | 1 | 2 | 3 {
  const byId = POPULAR_LEAGUE_PRIORITIES.get(match.league.id);
  if (byId) return byId;

  const leagueName = normalizeName(match.league.name);
  return (
    POPULAR_LEAGUE_TERMS.find(({ terms }) =>
      terms.some((term) => leagueName.includes(normalizeName(term))),
    )?.priority ?? 0
  );
}

function popularityScore(match: RemoteMatchSummary, signal?: MatchRankingSignal): number {
  // La compétition est comparée séparément avant les équipes et les votes.
  // Le score garde toutefois une valeur numérique stable pour les appels
  // existants et les égalités entre compétitions du même niveau.
  const leagueScore = competitionPriority(match) * 250;
  const teamScore =
    (POPULAR_TEAMS.has(match.home.id) ? 55 : 0) + (POPULAR_TEAMS.has(match.away.id) ? 55 : 0);
  const communityScore = Math.min(Math.max(signal?.communityVotes ?? 0, 0), 100) * 3;
  return leagueScore + teamScore + communityScore;
}

function importanceScore(match: RemoteMatchSummary): number {
  const round = normalizeName(match.league.round ?? "");
  let score = 0;
  if (round.includes("final")) score += 55;
  else if (round.includes("semi")) score += 38;
  else if (round.includes("quarter")) score += 28;
  else if (round.includes("round of 16") || round.includes("knockout")) score += 20;
  else if (round.includes("playoff") || round.includes("qualification")) score += 16;
  else if (round.includes("relegation") || round.includes("promotion")) score += 14;

  const teams = [normalizeName(match.home.name), normalizeName(match.away.name)].sort();
  const isDerby = DERBY_PAIRS.some(
    ([first, second]) =>
      teams.some((team) => team.includes(first)) && teams.some((team) => team.includes(second)),
  );
  return score + (isDerby ? 22 : 0);
}

function dataRichnessScore(match: RemoteMatchSummary, signal?: MatchRankingSignal): number {
  const availableSummaryFields = [
    match.home.logo,
    match.away.logo,
    match.league.logo,
    match.league.flag,
    match.league.round,
    match.venue,
  ].filter(Boolean).length;
  return (signal?.dataRichness ?? 0) + availableSummaryFields;
}

/**
 * Sélectionne la rencontre réellement la plus populaire parmi les matchs
 * actuellement pertinents pour Trending. Les votes communautaires sont un
 * signal réel quand ils existent; les signaux de compétition et d'équipes
 * servent de référence stable quand aucun vote n'est encore disponible.
 */
export function selectTrendingMatch<T extends RemoteMatchSummary>(
  matches: T[],
  signals?: ReadonlyMap<string, MatchRankingSignal>,
  now = Date.now(),
): T | undefined {
  return matches
    .map((match, index) => ({ match, index }))
    .filter(({ match }) => isTrendingCandidate(match, now))
    .sort((a, b) => {
      const popularityDifference =
        popularityScore(b.match, signals?.get(String(b.match.id))) -
        popularityScore(a.match, signals?.get(String(a.match.id)));
      if (popularityDifference !== 0) return popularityDifference;

      const importanceDifference = importanceScore(b.match) - importanceScore(a.match);
      if (importanceDifference !== 0) return importanceDifference;

      // À signaux équivalents, le match en direct est le plus pertinent.
      const liveDifference =
        Number(LIVE_STATUSES.has(b.match.status)) - Number(LIVE_STATUSES.has(a.match.status));
      if (liveDifference !== 0) return liveDifference;

      const richnessDifference =
        dataRichnessScore(b.match, signals?.get(String(b.match.id))) -
        dataRichnessScore(a.match, signals?.get(String(a.match.id)));
      if (richnessDifference !== 0) return richnessDifference;

      const kickoffDifference = kickoffTime(a.match) - kickoffTime(b.match);
      if (kickoffDifference !== 0) return kickoffDifference;
      return a.index - b.index;
    })[0]?.match;
}

function rankingBucket(
  match: RemoteMatchSummary,
  now: number,
  favoriteMatchIds?: MatchRankingOptions["favoriteMatchIds"],
  favoriteTeamIds?: MatchRankingOptions["favoriteTeamIds"],
  favoriteTeamNames?: MatchRankingOptions["favoriteTeamNames"],
  signal?: MatchRankingSignal,
): number {
  if (LIVE_STATUSES.has(match.status)) return 5;
  if (isFavorite(match, favoriteMatchIds, favoriteTeamIds, favoriteTeamNames)) return 4;

  const popular = popularityScore(match, signal) > 0;
  const kickoff = kickoffTime(match);
  const imminent =
    match.status === "upcoming" && kickoff >= now && kickoff - now <= IMMINENT_WINDOW_MS;

  // Les affiches populaires passent avant les autres rencontres à venir.
  if (popular) return 3;
  if (imminent) return 2;
  if (match.status === "upcoming") return 1;
  return 0;
}

export function rankMatches<T extends RemoteMatchSummary>(
  matches: T[],
  options: MatchRankingOptions = {},
): T[] {
  const now = options.now ?? Date.now();
  return matches
    .map((match, index) => ({ match, index }))
    .sort((a, b) => {
      const bucketDifference =
        rankingBucket(
          b.match,
          now,
          options.favoriteMatchIds,
          options.favoriteTeamIds,
          options.favoriteTeamNames,
          options.signals?.get(String(b.match.id)),
        ) -
        rankingBucket(
          a.match,
          now,
          options.favoriteMatchIds,
          options.favoriteTeamIds,
          options.favoriteTeamNames,
          options.signals?.get(String(a.match.id)),
        );
      if (bucketDifference !== 0) return bucketDifference;

      if (options.serverRanked) return a.index - b.index;

      const competitionDifference = competitionPriority(b.match) - competitionPriority(a.match);
      if (competitionDifference !== 0) return competitionDifference;

      const popularityDifference =
        popularityScore(b.match, options.signals?.get(String(b.match.id))) -
        popularityScore(a.match, options.signals?.get(String(a.match.id)));
      if (popularityDifference !== 0) return popularityDifference;

      const importanceDifference = importanceScore(b.match) - importanceScore(a.match);
      if (importanceDifference !== 0) return importanceDifference;

      const richnessDifference =
        dataRichnessScore(b.match, options.signals?.get(String(b.match.id))) -
        dataRichnessScore(a.match, options.signals?.get(String(a.match.id)));
      if (richnessDifference !== 0) return richnessDifference;

      // À priorité équivalente, conserver la lecture naturelle par heure.
      const kickoffDifference = kickoffTime(a.match) - kickoffTime(b.match);
      if (kickoffDifference !== 0) return kickoffDifference;

      // Garantit un tri stable sur les environnements qui ne le garantissent
      // pas nativement, notamment pour les matchs sans date exploitable.
      return a.index - b.index;
    })
    .map(({ match }) => match);
}
