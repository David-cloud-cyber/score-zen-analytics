import assert from "node:assert/strict";
import { analysisMatchId, analysisReturnPath, analysisErrorMessage } from "../src/lib/analysis-navigation.ts";

const target = new URL(analysisReturnPath("Paris SG", "Lyon", "12345"), "https://example.test");
assert.equal(target.searchParams.get("matchId"), "12345");
assert.equal(target.searchParams.get("home"), "Paris SG");
assert.equal(analysisMatchId(" Paris SG ", "Lyon", "Paris SG", "Lyon", "12345"), "12345");
assert.equal(analysisMatchId("Lyon", "Paris SG", "Paris SG", "Lyon", "12345"), undefined);
assert.equal(analysisMatchId("Lille", "Lyon", "Paris SG", "Lyon", "12345"), undefined);
assert.equal(analysisReturnPath("", "Lyon", "12345"), "/analyse");
assert.match(analysisErrorMessage("Aucune recommandation fiable"), /autre rencontre/);
assert.match(analysisErrorMessage("Cette rencontre est déjà terminée."), /terminée/);
console.log("analysis-navigation: 8 checks passed");
