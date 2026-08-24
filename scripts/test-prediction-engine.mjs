import assert from "node:assert/strict";

const { buildStatisticalPrediction, blendPredictions } =
  await import("../src/lib/prediction-engine.ts");

const identityTeam = (id, name) => ({
  id,
  name,
  recent: [],
  injuries: [],
  rank: null,
  points: null,
  goalsDiff: null,
  season: null,
  dataQuality: "identity",
});

const empty = buildStatisticalPrediction({
  home: identityTeam(1, "Domicile"),
  away: identityTeam(2, "Extérieur"),
  h2h: [],
  odds: null,
  live: null,
});
assert.equal(empty.probabilities.home + empty.probabilities.draw + empty.probabilities.away, 100);
assert.ok(
  empty.markets.every((market) => market.pick === "Aucune recommandation fiable"),
  "identity-only contexts must abstain",
);

const samples = (isHome, goals) =>
  goals.map(([goalsFor, goalsAgainst]) => ({
    isHome,
    goalsFor,
    goalsAgainst,
    result: goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L",
    sameCompetition: true,
  }));
const real = buildStatisticalPrediction({
  home: {
    ...identityTeam(10, "Atlas FC"),
    recent: samples(true, [
      [2, 0],
      [1, 0],
      [2, 1],
      [1, 1],
      [3, 1],
      [1, 0],
    ]),
    rank: 2,
    points: 48,
    goalsDiff: 21,
    dataQuality: "complete",
  },
  away: {
    ...identityTeam(20, "Union FC"),
    recent: samples(false, [
      [0, 1],
      [1, 2],
      [1, 1],
      [0, 2],
      [2, 1],
      [1, 2],
    ]),
    rank: 12,
    points: 24,
    goalsDiff: -8,
    dataQuality: "complete",
  },
  h2h: [
    { homeGoals: 2, awayGoals: 0 },
    { homeGoals: 1, awayGoals: 0 },
    { homeGoals: 2, awayGoals: 1 },
  ],
  odds: { home: 1.72, draw: 3.6, away: 5.1, sources: 5 },
  live: null,
});
assert.equal(real.probabilities.home + real.probabilities.draw + real.probabilities.away, 100);
assert.ok(real.markets.some((market) => market.pick !== "Aucune recommandation fiable"));
assert.equal(real.markets.length, 6);
assert.ok(real.markets.some((market) => market.label.includes("2,5")));
assert.ok(real.markets.some((market) => market.label === "But d'équipe"));
assert.ok(
  real.markets
    .filter((market) => !market.pick.startsWith("Aucune"))
    .every((market) => Number.isFinite(market.probability)),
);

const contradictoryAi = {
  probabilities: { home: 5, draw: 5, away: 90 },
  probableScore: "0-7",
  markets: real.markets.map((market) => ({
    ...market,
    pick: "Choix contradictoire",
    confidence: 85,
    rationale: "Explication enrichie sans remplacer le choix calculé.",
  })),
  aiText: "Analyse complémentaire.",
  keyFactors: ["Facteur inventé"],
  dataQuality: { level: "complete", score: 100 },
};
const blended = blendPredictions(real, contradictoryAi, "ai_enriched");
assert.equal(blended.probableScore, real.probableScore);
assert.deepEqual(
  blended.markets.map((market) => market.pick),
  real.markets.map((market) => market.pick),
);
assert.deepEqual(blended.keyFactors, real.keyFactors);
assert.equal(
  blended.probabilities.home + blended.probabilities.draw + blended.probabilities.away,
  100,
);

console.log("prediction-engine: ok");
