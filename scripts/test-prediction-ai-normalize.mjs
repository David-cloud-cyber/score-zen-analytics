import assert from "node:assert/strict";
import { normalizeAiCandidate } from "../src/lib/prediction-ai-normalize.ts";

const normalized = normalizeAiCandidate({
  probabilities: { home: "50.6", draw: "50.6", away: "0.1" },
  probableScore: 21,
  markets: [
    {
      label: "1X2",
      pick: "Domicile",
      probability: "68.7",
      confidence: "91.4",
      risk: "medium",
      rationale: "Contexte vérifié.",
    },
  ],
  aiText: "Analyse vérifiée.",
  keyFactors: ["Forme récente", null, "Domicile"],
});

assert.equal(
  normalized.probabilities.home + normalized.probabilities.draw + normalized.probabilities.away,
  100,
);
assert.ok(normalized.probabilities.away >= 0);
assert.equal(normalized.markets[0].confidence, 85);
assert.equal(normalized.markets[0].probability, 69);
assert.equal(normalized.markets[0].risk, "moyen");
assert.equal(normalized.probableScore, "21");
assert.deepEqual(normalized.keyFactors, ["Forme récente", "Domicile"]);

console.log("Prediction AI normalization checks passed.");
