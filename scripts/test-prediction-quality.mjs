import assert from "node:assert/strict";

const quality = await import("../src/lib/prediction-quality.ts");

const normalized = quality.normalizeProbabilityTriplet({ home: 63, draw: 21, away: 16 });
assert.equal(normalized.home + normalized.draw + normalized.away, 100);

const guarded = quality.guardProbabilities(normalized, 35);
assert.equal(guarded.home + guarded.draw + guarded.away, 100);
assert.ok(guarded.home < normalized.home, "thin contexts must shrink extreme probabilities");

assert.equal(
  quality.aiBlendWeight({ dataQuality: "complete", divergence: 4, aiStatus: "ai_enriched" }),
  0.3,
);
assert.equal(
  quality.aiBlendWeight({ dataQuality: "partial", divergence: 4, aiStatus: "ai_fallback" }),
  0.2,
);
assert.equal(
  quality.aiBlendWeight({ dataQuality: "complete", divergence: 22, aiStatus: "ai_enriched" }),
  0.12,
);

const agreement = quality.evidenceAgreementScore({
  model: { home: 58, draw: 24, away: 18 },
  market: { home: 55, draw: 25, away: 20 },
  provider: { home: 60, draw: 22, away: 18 },
});
assert.ok(agreement.score > 80);
const conflict = quality.evidenceAgreementScore({
  model: { home: 68, draw: 20, away: 12 },
  market: { home: 24, draw: 26, away: 50 },
});
assert.ok(conflict.score < agreement.score);
assert.ok(
  quality.calibratedQualityScore({
    baseQuality: 78,
    agreementScore: conflict.score,
    sourceCount: 2,
  }) < 78,
);
assert.equal(
  quality.shouldRecommendMarket({ confidence: 61, qualityScore: 70, divergence: 8 }),
  true,
);
assert.equal(
  quality.shouldRecommendMarket({ confidence: 61, qualityScore: 38, divergence: 8 }),
  false,
);

assert.ok(Math.abs(quality.brierScore(0.8, true) - 0.04) < 1e-9);
assert.ok(quality.logLoss(0.8, true) > 0);

const metadata = quality.predictionMetadataFor({
  aiStatus: "ai_enriched",
  dataQualityLevel: "complete",
  dataQualityScore: 97,
  aiLatencyMs: 1200,
  availableSections: ["forme", "forme", "cotes"],
  unavailableSections: ["news"],
  marketCount: 5,
});
assert.equal(metadata.engineVersion, "v2.3.0");
assert.deepEqual(metadata.availableSections, ["forme", "cotes"]);
assert.equal(metadata.marketCount, 5);

console.log("prediction-quality: ok");
