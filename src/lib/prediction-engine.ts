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
};

export type TeamPredictionContext = {
  id: number;
  name: string;
  recent: MatchSample[];
  injuries: string[];
  rank: number | null;
  points: number | null;
  goalsDiff: number | null;
};

export type H2HMatch = { homeGoals: number | null; awayGoals: number | null };

export type OddsSnapshot = {
  home: number | null;
  draw: number | null;
  away: number | null;
  sources: number;
  fixtureId?: number;
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
};

export type PredictionContext = {
  home: TeamPredictionContext | null;
  away: TeamPredictionContext | null;
  h2h: H2HMatch[];
  odds: OddsSnapshot | null;
  live: LiveSnapshot | null;
};

export type StatisticalPrediction = {
  probabilities: { home: number; draw: number; away: number };
  probableScore: string;
  markets: Array<{
    label: string;
    pick: string;
    confidence: number;
    risk: "bas" | "moyen" | "eleve";
    rationale: string;
  }>;
  aiText: string;
  keyFactors: string[];
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
  preferredVenue: boolean,
  defaults: TeamMetrics,
): TeamMetrics {
  const complete = team.recent.filter(
    (match) => match.goalsFor !== null && match.goalsAgainst !== null && match.result !== "?",
  );
  const venue = complete.filter((match) => match.isHome === preferredVenue);
  const sample = venue.length >= 3 ? venue : complete;
  if (!sample.length) return defaults;

  // API-Football retourne les derniers matchs dans un ordre récent : les données
  // les plus fraîches reçoivent une pondération plus forte, sans effacer la saison.
  let weightTotal = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let points = 0;
  sample.slice(0, 8).forEach((match, index) => {
    const weight = Math.exp(-index * 0.23);
    weightTotal += weight;
    goalsFor += (match.goalsFor ?? 0) * weight;
    goalsAgainst += (match.goalsAgainst ?? 0) * weight;
    points += (match.result === "W" ? 3 : match.result === "D" ? 1 : 0) * weight;
  });

  return {
    goalsFor: goalsFor / weightTotal,
    goalsAgainst: goalsAgainst / weightTotal,
    points: points / weightTotal,
    reliability: clamp(sample.length / 6, 0.35, 1),
  };
}

function oddsProbabilities(odds: OddsSnapshot | null) {
  if (!odds?.home || !odds.draw || !odds.away) return null;
  const raw = { home: 1 / odds.home, draw: 1 / odds.draw, away: 1 / odds.away };
  return normalize(raw);
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

  const homeMetrics = metricsFor(context.home, true, {
    goalsFor: 1.42,
    goalsAgainst: 1.18,
    points: 1.48,
    reliability: 0.35,
  });
  const awayMetrics = metricsFor(context.away, false, {
    goalsFor: 1.16,
    goalsAgainst: 1.36,
    points: 1.18,
    reliability: 0.35,
  });
  const homeAll = metricsFor(context.home, true, homeMetrics);
  const awayAll = metricsFor(context.away, false, awayMetrics);

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

  const live =
    context.live?.minute && context.live.minute > 0 && context.live.minute < 120
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
  const market = oddsProbabilities(context.odds);
  if (market && !live) {
    // Les cotes sont un signal de consensus, pas une vérité : elles calibrent
    // modérément le modèle indépendant au lieu de le remplacer.
    const base = normalize(probabilities);
    const marketWeight = context.odds && context.odds.sources >= 3 ? 0.28 : 0.2;
    probabilities = {
      home: base.home * (1 - marketWeight) + market.home * marketWeight,
      draw: base.draw * (1 - marketWeight) + market.draw * marketWeight,
      away: base.away * (1 - marketWeight) + market.away * marketWeight,
    };
  }
  const normalized = normalize(probabilities);

  const dataQuality = clamp(
    (homeMetrics.reliability + awayMetrics.reliability) / 2 +
      (context.odds ? 0.1 : 0) +
      (live && live.homeLineupConfirmed && live.awayLineupConfirmed ? 0.1 : 0),
    0.3,
    1,
  );
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
  const bttsYes = (1 - Math.exp(-homeExpected)) * (1 - Math.exp(-awayExpected));
  const over15 = totalGoalsProbability(
    homeExpected,
    awayExpected,
    1.5 - (live ? live.homeScore + live.awayScore : 0),
    true,
  );
  const under35 = totalGoalsProbability(
    homeExpected,
    awayExpected,
    3.5 - (live ? live.homeScore + live.awayScore : 0),
    false,
  );
  const doubleChance =
    winner === "home"
      ? normalized.home + normalized.draw
      : winner === "away"
        ? normalized.away + normalized.draw
        : normalized.draw + Math.max(normalized.home, normalized.away);

  const livePrefix = live
    ? `À la ${live.minute}e minute, le score et les statistiques live sont intégrés. `
    : "";
  const keyFactors = [
    `Forme pondérée : ${context.home.name} ${homeMetrics.points.toFixed(2)} point(s)/match à domicile, ${context.away.name} ${awayMetrics.points.toFixed(2)} à l'extérieur.`,
    `Projection de buts : ${finalHomeExpected.toFixed(2)} pour ${context.home.name} et ${finalAwayExpected.toFixed(2)} pour ${context.away.name}.`,
    context.odds
      ? `Consensus de marché intégré avec ${context.odds.sources} source(s) de cotes, sans le laisser dominer le modèle.`
      : "Aucune cote exploitable : projection fondée sur les statistiques d'équipe disponibles.",
    context.home.injuries.length || context.away.injuries.length
      ? `Absences signalées : ${context.home.injuries.length} côté ${context.home.name}, ${context.away.injuries.length} côté ${context.away.name}.`
      : "Aucune absence exploitable n'a été remontée dans le snapshot courant.",
  ];
  if (live) {
    keyFactors.push(
      `Données live : ${live.homeShotsOnTarget}-${live.awayShotsOnTarget} tirs cadrés et ${live.homeXg.toFixed(2)}-${live.awayXg.toFixed(2)} xG lorsque disponibles.`,
    );
  }

  const marketConfidence = (probability: number) => confidenceFrom(probability, dataQuality, live);
  const markets: StatisticalPrediction["markets"] = [
    {
      label: "Issue du match",
      pick: winnerName,
      confidence: marketConfidence(winnerProbability / 100),
      risk: riskFor(marketConfidence(winnerProbability / 100)),
      rationale: `${livePrefix}Le modèle donne ${winnerProbability}% à cette issue après pondération de la forme, du terrain et des données disponibles.`,
    },
    {
      label: "Double chance",
      pick:
        winner === "home"
          ? `${context.home.name} ou nul`
          : winner === "away"
            ? `${context.away.name} ou nul`
            : "Match nul ou issue la plus probable",
      confidence: marketConfidence(doubleChance / 100),
      risk: riskFor(marketConfidence(doubleChance / 100)),
      rationale: `La couverture de deux issues porte la probabilité estimée à ${doubleChance}%.`,
    },
    {
      label: "Total de buts",
      pick: over15 >= 0.56 ? "Plus de 1,5 buts" : "Moins de 3,5 buts",
      confidence: marketConfidence(Math.max(over15, under35)),
      risk: riskFor(marketConfidence(Math.max(over15, under35))),
      rationale: `La projection de score ${probableScore} repose sur un total attendu d'environ ${(finalHomeExpected + finalAwayExpected).toFixed(2)} buts.`,
    },
    {
      label: "Les deux équipes marquent",
      pick: bttsYes >= 0.5 ? "Oui" : "Non",
      confidence: marketConfidence(bttsYes >= 0.5 ? bttsYes : 1 - bttsYes),
      risk: riskFor(marketConfidence(bttsYes >= 0.5 ? bttsYes : 1 - bttsYes)),
      rationale: `La probabilité statistique que les deux équipes marquent est estimée à ${round(bttsYes * 100)}%.`,
    },
  ];

  return {
    probabilities: normalized,
    probableScore,
    markets,
    aiText: `${livePrefix}La projection statistique favorise ${winnerName} (${winnerProbability}%), avec un score modal de ${probableScore}. Elle combine la forme récente, les rendements domicile/extérieur, les absences, le classement, les confrontations et les cotes lorsque celles-ci sont disponibles. La confiance diminue automatiquement si le contexte est incomplet.`,
    keyFactors: keyFactors.slice(0, 5),
  };
}

/** Fusion prudente du modèle déterministe et de l'enrichissement IA. */
export function blendPredictions(
  base: StatisticalPrediction,
  enriched: StatisticalPrediction | null,
): StatisticalPrediction {
  if (!enriched) return base;
  const divergence =
    (Math.abs(base.probabilities.home - enriched.probabilities.home) +
      Math.abs(base.probabilities.draw - enriched.probabilities.draw) +
      Math.abs(base.probabilities.away - enriched.probabilities.away)) /
    3;
  // L'IA peut ajuster, mais un écart fort réduit son poids et protège la calibration.
  const aiWeight = divergence > 18 ? 0.16 : divergence > 10 ? 0.24 : 0.34;
  const probabilities = normalize({
    home: base.probabilities.home * (1 - aiWeight) + enriched.probabilities.home * aiWeight,
    draw: base.probabilities.draw * (1 - aiWeight) + enriched.probabilities.draw * aiWeight,
    away: base.probabilities.away * (1 - aiWeight) + enriched.probabilities.away * aiWeight,
  });
  const enrichedMarkets = enriched.markets.slice(0, 4).map((market, index) => {
    const baseline = base.markets[index];
    const confidence = clamp(
      round(
        (baseline?.confidence ?? market.confidence) * (1 - aiWeight) + market.confidence * aiWeight,
      ),
      45,
      85,
    );
    return {
      ...market,
      confidence,
      risk: riskFor(confidence),
      rationale:
        market.rationale ||
        baseline?.rationale ||
        "Projection calculée à partir des données disponibles.",
    };
  });
  return {
    probabilities,
    probableScore: enriched.probableScore || base.probableScore,
    markets: enrichedMarkets.length >= 4 ? enrichedMarkets : base.markets,
    aiText: enriched.aiText?.trim() || base.aiText,
    keyFactors:
      (enriched.keyFactors?.filter(Boolean).slice(0, 5) ?? []).length >= 2
        ? enriched.keyFactors.slice(0, 5)
        : base.keyFactors,
  };
}
