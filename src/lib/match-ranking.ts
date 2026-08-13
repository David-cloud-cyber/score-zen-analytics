import type { RemoteMatchSummary } from "./football-types";

/**
 * Classement serveur des rencontres.
 *
 * Ce module ne modifie aucune donnée affichée dans une carte : il détermine
 * seulement l'ordre dans lequel les rencontres et leurs compétitions sont
 * envoyées à la page Matchs.
 */

const POPULAR_LEAGUES = new Set([
  2, // UEFA Champions League
  3, // UEFA Europa League
  39, // Premier League
  61, // Ligue 1
  78, // Bundesliga
  135, // Serie A
  140, // La Liga
  141, // La Liga 2
  143, // Copa del Rey
  72, // Brasileirão
  94, // Primeira Liga
]);

const POPULAR_LEAGUE_TERMS = [
  "champions league",
  "ligue des champions",
  "europa league",
  "conference league",
  "premier league",
  "la liga",
  "laliga",
  "ligue 1",
  "bundesliga",
  "serie a",
  "eredivisie",
  "primeira liga",
  "brasileirao",
  "brasileirão",
  "copa libertadores",
  "copa del rey",
  "fa cup",
  "championship",
  "major league soccer",
  "mls",
  "saudi pro league",
  "coupe d'afrique",
  "africa cup of nations",
  "world cup",
  "euro",
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
  return (
    match.status === "upcoming" &&
    kickoff >= now &&
    kickoff - now <= IMMINENT_WINDOW_MS
  );
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

function popularityScore(match: RemoteMatchSummary, signal?: MatchRankingSignal): number {
  const leagueName = normalizeName(match.league.name);
  const popularLeague =
    POPULAR_LEAGUES.has(match.league.id) ||
    POPULAR_LEAGUE_TERMS.some((term) => leagueName.includes(normalizeName(term)));
  const leagueScore = popularLeague ? 100 : 0;
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
