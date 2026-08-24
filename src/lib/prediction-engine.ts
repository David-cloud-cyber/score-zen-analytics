import {
  aiBlendWeight,
  calibratedQualityScore,
  evidenceAgreementScore,
  guardProbabilities,
  shouldRecommendMarket,
} from "./prediction-quality.ts";

/**
 * Moteur statistique déterministe utilisé pour chaque analyse.
 * Il ne dépend d'aucun fournisseur IA : l'IA peut enrichir le résultat, mais
 * les probabilités de base restent calculables à partir du snapshot API.
 */

export type MatchSample = {
  isHome: boolean;
  goalsFor: number | null;
  goalsAgainst: number | null;
  result: "W" | "D" | "L" | "?";
  sameCompetition?: boolean;
};

export type TeamPredictionContext = {
  id: number;
  name: string;
  recent: MatchSample[];
  injuries: string[];
  rank: number | null;
  points: number | null;
  goalsDiff: number | null;
  season: TeamSeasonProfile | null;
  dataQuality?: "complete" | "partial" | "identity";
};

export type TeamSeasonSplit = {
  played: number;
  goalsFor: number | null;
  goalsAgainst: number | null;
  pointsPerMatch: number | null;
  cleanSheetRate: number | null;
  failedToScoreRate: number | null;
};

export type TeamSeasonProfile = {
  overall: TeamSeasonSplit;
  home: TeamSeasonSplit;
  away: TeamSeasonSplit;
};

export type H2HMatch = { homeGoals: number | null; awayGoals: number | null };

export type OddsSnapshot = {
  home: number | null;
  draw: number | null;
  away: number | null;
  sources: number;
  fixtureId?: number;
  /** Écart normalisé entre les cotes disponibles. */
  marketSpread?: number;
};

export type CommunitySnapshot = {
  home: number;
  draw: number;
  away: number;
  votes: number;
};

export type MatchSignals = {
  community?: CommunitySnapshot | null;
  providerPrediction?: {
    home: number | null;
    draw: number | null;
    away: number | null;
    advice?: string | null;
  } | null;
  competition?: { id: number | null; name: string | null; importance: number } | null;
  referee?: { name: string; averageYellow?: number | null; averageRed?: number | null } | null;
  market?: { anomalyScore?: number | null; volumeAvailable?: boolean } | null;
  coverage?: number;
};

export type LiveSnapshot = {
  minute: number | null;
  status: string;
  homeScore: number;
  awayScore: number;
  homeXg: number;
  awayXg: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeRedCards: number;
  awayRedCards: number;
  homeLineupConfirmed: boolean;
  awayLineupConfirmed: boolean;
  homeCorners?: number;
  awayCorners?: number;
  homeYellowCards?: number;
  awayYellowCards?: number;
  referee?: string | null;
  competitionId?: number | null;
  competitionName?: string | null;
};

export type PredictionContext = {
  home: TeamPredictionContext | null;
  away: TeamPredictionContext | null;
  h2h: H2HMatch[];
  odds: OddsSnapshot | null;
  live: LiveSnapshot | null;
  signals?: MatchSignals;
};

export type StatisticalPrediction = {
  probabilities: { home: number; draw: number; away: number };
  probableScore: string;
  markets: Array<{
    label: string;
    pick: string;
    probability?: number;
    confidence: number;
    risk: "bas" | "moyen" | "eleve";
    rationale: string;
  }>;
  aiText: string;
  keyFactors: string[];
  dataQuality?: { level: "complete" | "partial"; score: number };
};

type TeamMetrics = {
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  reliability: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function round(value: number) {
  return Math.round(value);
}

function normalize(probabilities: { home: number; draw: number; away: number }) {
  const total = probabilities.home + probabilities.draw + probabilities.away;
  if (!Number.isFinite(total) || total <= 0) return { home: 40, draw: 29, away: 31 };
  const home = round((probabilities.home / total) * 100);
  const draw = round((probabilities.draw / total) * 100);
  return { home, draw, away: 100 - home - draw };
}

function poisson(lambda: number, value: number) {
  let factorial = 1;
  for (let n = 2; n <= value; n += 1) factorial *= n;
  return (Math.exp(-lambda) * lambda ** value) / factorial;
}

function metricsFor(
  team: TeamPredictionContext,
  preferredVenue: boolean | null,
  defaults: TeamMetrics,
): TeamMetrics {
  const complete = team.recent.filter(
    (match) => match.goalsFor !== null && match.goalsAgainst !== null && match.result !== "?",
  );
  const venue =
    preferredVenue === null
      ? complete
      : complete.filter((match) => match.isHome === preferredVenue);
  const sample = preferredVenue !== null && venue.length >= 3 ? venue : complete;
  const seasonSplit =
    preferredVenue === true
      ? team.season?.home
      : preferredVenue === false
        ? team.season?.away
        : team.season?.overall;
  const hasSeasonSample = Boolean(
    seasonSplit &&
    seasonSplit.played >= 3 &&
    seasonSplit.goalsFor !== null &&
    seasonSplit.goalsAgainst !== null,
  );
  const seasonMetrics: TeamMetrics | null = hasSeasonSample
    ? {
        goalsFor: seasonSplit!.goalsFor!,
        goalsAgainst: seasonSplit!.goalsAgainst!,
        points: seasonSplit!.pointsPerMatch ?? defaults.points,
        reliability: clamp(seasonSplit!.played / 12, 0.45, 0.92),
      }
    : null;
  if (!sample.length) return seasonMetrics ?? defaults;

  // API-Football retourne les derniers matchs dans un ordre récent : les données
  // les plus fraîches reçoivent une pondération plus forte, sans effacer la saison.
  let weightTotal = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let points = 0;
  sample.slice(0, 8).forEach((match, index) => {
    const competitionWeight = match.sameCompetition ? 1.15 : 1;
    const weight = Math.exp(-index * 0.23) * competitionWeight;
    weightTotal += weight;
    goalsFor += (match.goalsFor ?? 0) * weight;
    goalsAgainst += (match.goalsAgainst ?? 0) * weight;
    points += (match.result === "W" ? 3 : match.result === "D" ? 1 : 0) * weight;
  });

  const recentMetrics = {
    goalsFor: goalsFor / weightTotal,
    goalsAgainst: goalsAgainst / weightTotal,
    points: points / weightTotal,
    reliability: clamp(sample.length / 6, 0.35, 1),
  };
  if (!seasonMetrics) return recentMetrics;

  // La forme récente reste prioritaire, mais la saison stabilise les petits
  // échantillons et évite qu'un seul score atypique ne déforme la projection.
  const recentWeight = clamp(sample.length / 8, 0.48, 0.72);
  return {
    goalsFor: recentMetrics.goalsFor * recentWeight + seasonMetrics.goalsFor * (1 - recentWeight),
    goalsAgainst:
      recentMetrics.goalsAgainst * recentWeight + seasonMetrics.goalsAgainst * (1 - recentWeight),
    points: recentMetrics.points * recentWeight + seasonMetrics.points * (1 - recentWeight),
    reliability: clamp(recentMetrics.reliability * 0.65 + seasonMetrics.reliability * 0.35, 0.4, 1),
  };
}

function oddsProbabilities(odds: OddsSnapshot | null) {
  if (!odds?.home || !odds.draw || !odds.away) return null;
  const raw = { home: 1 / odds.home, draw: 1 / odds.draw, away: 1 / odds.away };
  return normalize(raw);
}

function communityProbabilities(community: CommunitySnapshot | null | undefined) {
  if (!community || community.votes < 8) return null;
  return normalize({ home: community.home, draw: community.draw, away: community.away });
}

function providerProbabilities(snapshot: MatchSignals["providerPrediction"]) {
  if (
    snapshot?.home === null ||
    snapshot?.home === undefined ||
    snapshot.draw === null ||
    snapshot.draw === undefined ||
    snapshot.away === null ||
    snapshot.away === undefined
  )
    return null;
  return normalize({ home: snapshot.home, draw: snapshot.draw, away: snapshot.away });
}

function resultProbabilities(
  homeLambda: number,
  awayLambda: number,
  currentHome = 0,
  currentAway = 0,
) {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let homeGoals = 0; homeGoals <= 7; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= 7; awayGoals += 1) {
      const chance = poisson(homeLambda, homeGoals) * poisson(awayLambda, awayGoals);
      const finalHome = currentHome + homeGoals;
      const finalAway = currentAway + awayGoals;
      if (finalHome > finalAway) home += chance;
      else if (finalHome < finalAway) away += chance;
      else draw += chance;
    }
  }
  return { home, draw, away };
}

function mostLikelyScore(homeLambda: number, awayLambda: number, currentHome = 0, currentAway = 0) {
  let best = { home: currentHome, away: currentAway, probability: -1 };
  for (let homeGoals = 0; homeGoals <= 6; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= 6; awayGoals += 1) {
      const probability = poisson(homeLambda, homeGoals) * poisson(awayLambda, awayGoals);
      if (probability > best.probability) {
        best = { home: currentHome + homeGoals, away: currentAway + awayGoals, probability };
      }
    }
  }
  return `${best.home} - ${best.away}`;
}

function totalGoalsProbability(
  homeLambda: number,
  awayLambda: number,
  threshold: number,
  over: boolean,
) {
  let probability = 0;
  for (let homeGoals = 0; homeGoals <= 7; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= 7; awayGoals += 1) {
      const isOver = homeGoals + awayGoals > threshold;
      if (isOver === over)
        probability += poisson(homeLambda, homeGoals) * poisson(awayLambda, awayGoals);
    }
  }
  return probability;
}

function confidenceFrom(probability: number, dataQuality: number, live: LiveSnapshot | null) {
  const certainty = Math.abs(probability - 0.5) * 42;
  const liveBoost = live?.minute && live.minute >= 60 ? 4 : 0;
  return clamp(round(43 + certainty + dataQuality * 22 + liveBoost), 45, 85);
}

function riskFor(confidence: number): "bas" | "moyen" | "eleve" {
  if (confidence >= 70) return "bas";
  if (confidence >= 58) return "moyen";
  return "eleve";
}

function livePace(live: LiveSnapshot, homeExpected: number, awayExpected: number) {
  const elapsed = clamp(live.minute ?? 0, 1, 90);
  const xgHomePace = live.homeXg > 0 ? live.homeXg / elapsed / (homeExpected / 90) : 1;
  const xgAwayPace = live.awayXg > 0 ? live.awayXg / elapsed / (awayExpected / 90) : 1;
  const shotsHomePace =
    live.homeShotsOnTarget > 0
      ? 1 + clamp((live.homeShotsOnTarget - elapsed / 30) * 0.05, -0.12, 0.18)
      : 1;
  const shotsAwayPace =
    live.awayShotsOnTarget > 0
      ? 1 + clamp((live.awayShotsOnTarget - elapsed / 30) * 0.05, -0.12, 0.18)
      : 1;
  return {
    home: clamp(
      ((xgHomePace + shotsHomePace) / 2) * (live.homeRedCards ? 0.7 : live.awayRedCards ? 1.13 : 1),
      0.55,
      1.5,
    ),
    away: clamp(
      ((xgAwayPace + shotsAwayPace) / 2) * (live.awayRedCards ? 0.7 : live.homeRedCards ? 1.13 : 1),
      0.55,
      1.5,
    ),
  };
}

/**
 * Calcule une projection pré-match ou live depuis un snapshot API normalisé.
 * Le moteur refuse un contexte sans équipes, évitant toute prédiction inventée.
 */
export function buildStatisticalPrediction(context: PredictionContext): StatisticalPrediction {
  if (!context.home || !context.away) {
    throw new Error("Données statistiques insuffisantes pour établir une prédiction fiable.");
  }

  const partialContext =
    context.home.dataQuality !== "complete" || context.away.dataQuality !== "complete";

  const homeMetrics = metricsFor(context.home, true, {
    goalsFor: 1.42,
    goalsAgainst: 1.18,
    points: 1.48,
    reliability: 0.12,
  });
  const awayMetrics = metricsFor(context.away, false, {
    goalsFor: 1.16,
    goalsAgainst: 1.36,
    points: 1.18,
    reliability: 0.12,
  });
  const homeAll = metricsFor(context.home, null, homeMetrics);
  const awayAll = metricsFor(context.away, null, awayMetrics);
  const observedHomeMatches = context.home.recent.filter(
    (match) => match.goalsFor !== null && match.goalsAgainst !== null && match.result !== "?",
  ).length;
  const observedAwayMatches = context.away.recent.filter(
    (match) => match.goalsFor !== null && match.goalsAgainst !== null && match.result !== "?",
  ).length;

  // Attaque/défense récentes + avantage domicile. Les bornes empêchent un petit
  // échantillon ou un score atypique de produire des probabilités extrêmes.
  let homeExpected = clamp(
    0.56 * homeMetrics.goalsFor + 0.32 * awayMetrics.goalsAgainst + 0.3,
    0.35,
    3.35,
  );
  let awayExpected = clamp(
    0.56 * awayMetrics.goalsFor + 0.32 * homeMetrics.goalsAgainst + 0.08,
    0.25,
    3.1,
  );

  const formDelta = clamp(homeAll.points - awayAll.points, -1.5, 1.5);
  homeExpected += formDelta * 0.11;
  awayExpected -= formDelta * 0.08;

  if (context.home.rank && context.away.rank) {
    const rankDelta = clamp((context.away.rank - context.home.rank) / 18, -0.22, 0.22);
    homeExpected += rankDelta;
    awayExpected -= rankDelta * 0.75;
  }

  const injuryDelta = clamp(
    (context.away.injuries.length - context.home.injuries.length) * 0.025,
    -0.14,
    0.14,
  );
  homeExpected += injuryDelta;
  awayExpected -= injuryDelta;

  const scoredH2H = context.h2h.filter(
    (match) => match.homeGoals !== null && match.awayGoals !== null,
  );
  if (scoredH2H.length >= 3) {
    const h2hGoals =
      scoredH2H.reduce((sum, match) => sum + (match.homeGoals ?? 0) + (match.awayGoals ?? 0), 0) /
      scoredH2H.length;
    const totalCorrection = clamp((h2hGoals - 2.45) * 0.06, -0.12, 0.12);
    homeExpected += totalCorrection / 2;
    awayExpected += totalCorrection / 2;
  }

  homeExpected = clamp(homeExpected, 0.25, 3.5);
  awayExpected = clamp(awayExpected, 0.2, 3.25);

  const activeLiveStatuses = new Set(["1H", "HT", "2H", "ET", "BT", "P", "INT", "LIVE"]);
  const live =
    context.live?.minute &&
    context.live.minute > 0 &&
    context.live.minute < 120 &&
    activeLiveStatuses.has(context.live.status.toUpperCase())
      ? context.live
      : null;
  const remainingRatio = live ? clamp((95 - live.minute!) / 95, 0.02, 1) : 1;
  if (live) {
    const pace = livePace(live, homeExpected, awayExpected);
    homeExpected *= remainingRatio * pace.home;
    awayExpected *= remainingRatio * pace.away;
  }

  let probabilities = resultProbabilities(
    homeExpected,
    awayExpected,
    live?.homeScore ?? 0,
    live?.awayScore ?? 0,
  );
  const independentModel = normalize(probabilities);
  const market = oddsProbabilities(context.odds);
  const provider = providerProbabilities(context.signals?.providerPrediction);
  const agreement = evidenceAgreementScore({ model: independentModel, market, provider });
  if (market && !live) {
    // Les cotes sont un signal de consensus, pas une vérité : elles calibrent
    // modérément le modèle indépendant au lieu de le remplacer.
    const base = normalize(probabilities);
    const spreadPenalty = clamp((context.odds?.marketSpread ?? 0) * 0.8, 0, 0.12);
    const marketWeight = clamp(
      (context.odds && context.odds.sources >= 3 ? 0.28 : 0.2) - spreadPenalty,
      0.12,
      0.28,
    );
    probabilities = {
      home: base.home * (1 - marketWeight) + market.home * marketWeight,
      draw: base.draw * (1 - marketWeight) + market.draw * marketWeight,
      away: base.away * (1 - marketWeight) + market.away * marketWeight,
    };
  }
  const community = communityProbabilities(context.signals?.community);
  if (community && !live) {
    // La communauté enrichit le consensus sans pouvoir renverser seule
    // la projection statistique ou le marché.
    const communityWeight =
      context.signals?.community && context.signals.community.votes >= 40 ? 0.12 : 0.07;
    probabilities = {
      home: probabilities.home * (1 - communityWeight) + community.home * communityWeight,
      draw: probabilities.draw * (1 - communityWeight) + community.draw * communityWeight,
      away: probabilities.away * (1 - communityWeight) + community.away * communityWeight,
    };
  }
  if (provider && !live) {
    // Ce signal peut être corrélé au marché : il reste secondaire.
    const providerWeight = context.odds ? 0.04 : 0.08;
    probabilities = {
      home: probabilities.home * (1 - providerWeight) + provider.home * providerWeight,
      draw: probabilities.draw * (1 - providerWeight) + provider.draw * providerWeight,
      away: probabilities.away * (1 - providerWeight) + provider.away * providerWeight,
    };
  }
  const observedFormQuality = clamp(
    (Math.min(observedHomeMatches, 8) + Math.min(observedAwayMatches, 8)) / 16,
    0,
    1,
  );
  const seasonSampleQuality = clamp(
    (Math.min(context.home.season?.overall.played ?? 0, 12) +
      Math.min(context.away.season?.overall.played ?? 0, 12)) /
      24,
    0,
    1,
  );
  const rawDataQuality = clamp(
    Math.max(observedFormQuality, seasonSampleQuality * 0.82) * 0.62 +
      (context.odds ? 0.1 : 0) +
      (provider ? 0.08 : 0) +
      (live && live.homeLineupConfirmed && live.awayLineupConfirmed ? 0.1 : 0) +
      (context.signals?.competition?.importance ?? 0) * 0.06 +
      (community ? 0.04 : 0) -
      (context.odds?.marketSpread ?? 0) * 0.18 -
      (context.signals?.market?.anomalyScore ?? 0) * 0.14,
    0.3,
    1,
  );
  // Shrink extreme probabilities when the evidence is thin. This guard keeps
  // the deterministic baseline conservative before the AI is allowed to
  // enrich it.
  const qualityScore = calibratedQualityScore({
    baseQuality: rawDataQuality * 100,
    agreementScore: agreement.score,
    sourceCount: agreement.sources,
  });
  const dataQuality = qualityScore / 100;
  const normalized = guardProbabilities(normalize(probabilities), qualityScore);
  const finalHomeExpected = homeExpected + (live?.homeScore ?? 0);
  const finalAwayExpected = awayExpected + (live?.awayScore ?? 0);
  const probableScore = mostLikelyScore(
    homeExpected,
    awayExpected,
    live?.homeScore ?? 0,
    live?.awayScore ?? 0,
  );
  const winner =
    normalized.home >= normalized.away && normalized.home >= normalized.draw
      ? "home"
      : normalized.away >= normalized.draw
        ? "away"
        : "draw";
  const winnerName =
    winner === "home" ? context.home.name : winner === "away" ? context.away.name : "Match nul";
  const winnerProbability = normalized[winner];
  const homeWillScore = (live?.homeScore ?? 0) > 0 ? 1 : 1 - Math.exp(-homeExpected);
  const awayWillScore = (live?.awayScore ?? 0) > 0 ? 1 : 1 - Math.exp(-awayExpected);
  const bttsYes = homeWillScore * awayWillScore;
  const bttsNo = 1 - bttsYes;
  const over15 = totalGoalsProbability(
    homeExpected,
    awayExpected,
    1.5 - (live ? live.homeScore + live.awayScore : 0),
    true,
  );
  const over25 = totalGoalsProbability(
    homeExpected,
    awayExpected,
    2.5 - (live ? live.homeScore + live.awayScore : 0),
    true,
  );
  const under25 = totalGoalsProbability(
    homeExpected,
    awayExpected,
    2.5 - (live ? live.homeScore + live.awayScore : 0),
    false,
  );
  const under35 = totalGoalsProbability(
    homeExpected,
    awayExpected,
    3.5 - (live ? live.homeScore + live.awayScore : 0),
    false,
  );
  const doubleChanceOptions = [
    {
      pick: `${context.home.name} ou nul`,
      probability: normalized.home + normalized.draw,
    },
    {
      pick: `${context.away.name} ou nul`,
      probability: normalized.away + normalized.draw,
    },
    {
      pick: `${context.home.name} ou ${context.away.name}`,
      probability: normalized.home + normalized.away,
    },
  ];
  const doubleChance = doubleChanceOptions.reduce((best, option) =>
    option.probability > best.probability ? option : best,
  );

  const livePrefix = live
    ? `À la ${live.minute}e minute, le score et les statistiques live sont intégrés. `
    : "";
  const keyFactors = partialContext
    ? [
        `Identité confirmée : ${context.home.name} reçoit ${context.away.name}.`,
        `Projection prudente calculée à partir des informations vérifiées disponibles ; l'historique détaillé est encore incomplet.`,
      ]
    : [
        `Forme pondérée : ${context.home.name} ${homeMetrics.points.toFixed(2)} point(s)/match à domicile, ${context.away.name} ${awayMetrics.points.toFixed(2)} à l'extérieur.`,
        `Projection de buts : ${finalHomeExpected.toFixed(2)} pour ${context.home.name} et ${finalAwayExpected.toFixed(2)} pour ${context.away.name}.`,
      ];
  if (context.home.season?.overall.played || context.away.season?.overall.played) {
    keyFactors.push(
      `Repères saisonniers : ${context.home.name} ${context.home.season?.overall.goalsFor?.toFixed(2) ?? "n/d"} but(s)/match, ${context.away.name} ${context.away.season?.overall.goalsFor?.toFixed(2) ?? "n/d"}.`,
    );
  }
  keyFactors.push(
    context.odds
      ? `Consensus de marché intégré avec ${context.odds.sources} source(s) de cotes, sans le laisser dominer le modèle.`
      : partialContext
        ? "Aucune cote exploitable dans les informations actuellement disponibles."
        : "Aucune cote exploitable : projection fondée sur les statistiques d'équipe disponibles.",
    context.home.injuries.length || context.away.injuries.length
      ? `Absences signalées : ${context.home.injuries.length} côté ${context.home.name}, ${context.away.injuries.length} côté ${context.away.name}.`
      : partialContext
        ? "Les absences n'ont pas encore pu être vérifiées."
        : "Aucune absence exploitable n'a été remontée dans le snapshot courant.",
  );
  if (live) {
    keyFactors.push(
      `Données live : ${live.homeShotsOnTarget}-${live.awayShotsOnTarget} tirs cadrés et ${live.homeXg.toFixed(2)}-${live.awayXg.toFixed(2)} xG lorsque disponibles.`,
    );
  }

  if (community) {
    keyFactors.push(
      `Consensus communautaire : ${community.home}% domicile, ${community.draw}% nul, ${community.away}% extérieur sur ${context.signals?.community?.votes ?? 0} vote(s), avec un poids secondaire.`,
    );
  }
  if (provider) {
    keyFactors.push(
      `Projection fournisseur intégrée comme signal secondaire${context.signals?.providerPrediction?.advice ? ` : ${context.signals.providerPrediction.advice}` : "."}`,
    );
  }
  if (agreement.sources > 1) {
    keyFactors.push(
      agreement.divergence <= 8
        ? "Les sources indépendantes disponibles convergent vers une lecture proche du match."
        : "Les sources disponibles divergent ; la confiance a été réduite automatiquement.",
    );
  }
  if (live && (live.homeCorners !== undefined || live.awayCorners !== undefined)) {
    keyFactors.push(
      `Rythme live : ${live.homeCorners ?? 0}-${live.awayCorners ?? 0} corners et ${live.homeYellowCards ?? 0}-${live.awayYellowCards ?? 0} cartons jaunes.`,
    );
  }

  const marketConfidence = (probability: number) => confidenceFrom(probability, dataQuality, live);
  const hasIndependentEvidence = observedHomeMatches >= 3 && observedAwayMatches >= 3;
  const hasSeasonEvidence =
    (context.home.season?.overall.played ?? 0) >= 5 &&
    (context.away.season?.overall.played ?? 0) >= 5;
  const hasExternalEvidence = Boolean(market || provider || live);
  const evidenceIsActionable = hasIndependentEvidence || hasSeasonEvidence || hasExternalEvidence;
  const winnerConfidence = marketConfidence(winnerProbability / 100);
  const doubleChanceConfidence = marketConfidence(doubleChance.probability / 100);
  const total25Probability = Math.max(over25, under25);
  const total25Pick = over25 >= under25 ? "Plus de 2,5 buts" : "Moins de 2,5 buts";
  const total25Confidence = marketConfidence(total25Probability);
  const prudentTotalProbability = Math.max(over15, under35);
  const prudentTotalPick = over15 >= under35 ? "Plus de 1,5 buts" : "Moins de 3,5 buts";
  const prudentTotalConfidence = marketConfidence(prudentTotalProbability);
  const bttsProbability = Math.max(bttsYes, bttsNo);
  const bttsConfidence = marketConfidence(bttsProbability);
  const teamGoalOptions = [
    {
      pick: `${context.home.name} marque au moins un but`,
      probability: homeWillScore,
    },
    {
      pick: `${context.away.name} marque au moins un but`,
      probability: awayWillScore,
    },
  ];
  const teamGoal = teamGoalOptions.reduce((best, option) =>
    option.probability > best.probability ? option : best,
  );
  const teamGoalConfidence = marketConfidence(teamGoal.probability);
  const candidateMarkets: StatisticalPrediction["markets"] = [
    {
      label: "Issue du match",
      pick: winnerName,
      probability: winnerProbability,
      confidence: winnerConfidence,
      risk: riskFor(winnerConfidence),
      rationale: `${livePrefix}Le modèle donne ${winnerProbability}% à cette issue après pondération de la forme, du terrain et des données disponibles.`,
    },
    {
      label: "Double chance",
      pick: doubleChance.pick,
      probability: doubleChance.probability,
      confidence: doubleChanceConfidence,
      risk: riskFor(doubleChanceConfidence),
      rationale: `La combinaison des deux issues les plus solides atteint une probabilité estimée de ${doubleChance.probability}%.`,
    },
    {
      label: "Plus/Moins de 2,5 buts",
      pick: total25Pick,
      probability: round(total25Probability * 100),
      confidence: total25Confidence,
      risk: riskFor(total25Confidence),
      rationale: `La ligne de 2,5 buts est évaluée à partir d'un total attendu d'environ ${(finalHomeExpected + finalAwayExpected).toFixed(2)} buts.`,
    },
    {
      label: "Total de buts prudent",
      pick: prudentTotalPick,
      probability: round(prudentTotalProbability * 100),
      confidence: prudentTotalConfidence,
      risk: riskFor(prudentTotalConfidence),
      rationale: `La projection de score ${probableScore} soutient cette ligne plus prudente sans la présenter comme certaine.`,
    },
    {
      label: "Les deux équipes marquent",
      pick: bttsYes >= 0.5 ? "Oui" : "Non",
      probability: round(bttsProbability * 100),
      confidence: bttsConfidence,
      risk: riskFor(bttsConfidence),
      rationale: `Les deux équipes marquent est estimé à ${round(bttsYes * 100)}% contre ${round(bttsNo * 100)}% pour le scénario contraire.`,
    },
    {
      label: "But d'équipe",
      pick: teamGoal.pick,
      probability: round(teamGoal.probability * 100),
      confidence: teamGoalConfidence,
      risk: riskFor(teamGoalConfidence),
      rationale: `La capacité offensive et la résistance adverse donnent ${round(teamGoal.probability * 100)}% à cette équipe pour marquer au moins une fois.`,
    },
  ];
  const markets = candidateMarkets.map((item, index) => {
    const primary = index === 0;
    const recommended = shouldRecommendMarket({
      confidence: item.confidence,
      qualityScore,
      divergence: agreement.divergence,
    });
    if (!evidenceIsActionable) {
      return {
        ...item,
        pick: "Aucune recommandation fiable",
        probability: undefined,
        confidence: Math.min(item.confidence, 48),
        risk: "eleve" as const,
        rationale:
          "La forme récente et les signaux externes disponibles ne suffisent pas encore pour produire un choix fiable.",
      };
    }
    if (recommended || (!primary && (item.probability ?? 0) >= 55)) return item;
    return {
      ...item,
      pick: "Aucune issue suffisamment forte",
      probability: undefined,
      confidence: Math.min(item.confidence, 54),
      risk: "eleve" as const,
      rationale:
        "Les signaux disponibles ne convergent pas assez pour recommander une issue simple avec prudence.",
    };
  });

  const liveMarkets: StatisticalPrediction["markets"] = [];
  if (live && (live.homeCorners ?? 0) + (live.awayCorners ?? 0) > 0) {
    const totalCorners = (live.homeCorners ?? 0) + (live.awayCorners ?? 0);
    const cornerConfidence = marketConfidence(
      clamp(0.52 + Math.min(totalCorners, 12) * 0.018, 0.5, 0.78),
    );
    liveMarkets.push({
      label: "Corners live",
      pick: totalCorners >= 7 ? "Plus de 8,5 corners" : "Plus de 5,5 corners",
      probability: round(clamp(0.52 + Math.min(totalCorners, 12) * 0.018, 0.5, 0.78) * 100),
      confidence: cornerConfidence,
      risk: riskFor(cornerConfidence),
      rationale: `Le match compte ${totalCorners} corner(s) actuellement ; ce marché reste conditionné au rythme observé et à la minute de jeu.`,
    });
  }

  if (live && (live.homeYellowCards ?? 0) + (live.awayYellowCards ?? 0) > 0) {
    const totalCards = (live.homeYellowCards ?? 0) + (live.awayYellowCards ?? 0);
    const cardConfidence = marketConfidence(
      clamp(0.5 + Math.min(totalCards, 6) * 0.025, 0.5, 0.72),
    );
    liveMarkets.push({
      label: "Cartons live",
      pick: totalCards >= 3 ? "Plus de 3,5 cartons" : "Marché cartons à surveiller",
      probability: round(clamp(0.5 + Math.min(totalCards, 6) * 0.025, 0.5, 0.72) * 100),
      confidence: cardConfidence,
      risk: riskFor(cardConfidence),
      rationale: `Les événements live recensent ${totalCards} carton(s) ; l'arbitre et le contexte disciplinaire restent à confirmer.`,
    });
  }
  if (liveMarkets.length) {
    markets.splice(6 - liveMarkets.length, liveMarkets.length, ...liveMarkets);
  }

  return {
    probabilities: normalized,
    probableScore,
    markets,
    aiText: `${livePrefix}${context.home.dataQuality !== "complete" || context.away.dataQuality !== "complete" ? "Certaines statistiques d’équipe sont encore en cours de mise à jour. " : ""}La projection statistique favorise ${winnerName} (${winnerProbability}%), avec un score modal de ${probableScore}. Elle combine uniquement les informations vérifiées disponibles et réduit la confiance lorsque le contexte est incomplet ou contradictoire.`,
    keyFactors: keyFactors.slice(0, 5),
    dataQuality: {
      level: partialContext ? "partial" : "complete",
      score: qualityScore,
    },
  };
}

/** Fusion prudente du modèle déterministe et de l'enrichissement IA. */
export function blendPredictions(
  base: StatisticalPrediction,
  enriched: StatisticalPrediction | null,
  aiStatus: "ai_enriched" | "ai_fallback" = "ai_enriched",
): StatisticalPrediction {
  if (!enriched) return base;
  const divergence =
    (Math.abs(base.probabilities.home - enriched.probabilities.home) +
      Math.abs(base.probabilities.draw - enriched.probabilities.draw) +
      Math.abs(base.probabilities.away - enriched.probabilities.away)) /
    3;
  // L'IA peut ajuster, mais un écart fort réduit son poids et protège la
  // calibration. Le poids dépend aussi du statut de secours du routeur.
  const aiWeight = aiBlendWeight({
    dataQuality: base.dataQuality?.level ?? "partial",
    divergence,
    aiStatus,
  });
  const probabilities = normalize({
    home: base.probabilities.home * (1 - aiWeight) + enriched.probabilities.home * aiWeight,
    draw: base.probabilities.draw * (1 - aiWeight) + enriched.probabilities.draw * aiWeight,
    away: base.probabilities.away * (1 - aiWeight) + enriched.probabilities.away * aiWeight,
  });
  const marketKey = (label: string) =>
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const pickKey = marketKey;
  const enrichedMarkets = base.markets.slice(0, 6).map((baseline) => {
    const baselineKey = marketKey(baseline.label);
    const market =
      enriched.markets.find((candidate) => marketKey(candidate.label) === baselineKey) ?? baseline;
    const confidence = clamp(
      round(baseline.confidence * (1 - aiWeight) + market.confidence * aiWeight),
      45,
      85,
    );
    return {
      ...baseline,
      confidence,
      risk: riskFor(confidence),
      rationale:
        pickKey(market.pick) === pickKey(baseline.pick)
          ? market.rationale
          : baseline.rationale || "Projection calculée à partir des données disponibles.",
    };
  });
  return {
    probabilities,
    // Le score et les choix restent issus du moteur déterministe : l'IA
    // enrichit l'explication et ajuste modérément les probabilités, sans
    // pouvoir substituer un marché contradictoire ou un score halluciné.
    probableScore: base.probableScore,
    markets: enrichedMarkets.length >= 4 ? enrichedMarkets : base.markets,
    aiText: enriched.aiText?.trim() || base.aiText,
    keyFactors: base.keyFactors,
    dataQuality: base.dataQuality,
  };
}
