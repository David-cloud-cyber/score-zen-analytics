import assert from 'node:assert/strict';
import { isActionablePrediction, scoreMatchProbabilities } from '../src/lib/prediction-evaluation.ts';
for (const pick of ['', null, 'Aucune issue suffisamment forte', 'Aucune recommandation fiable', 'Marché cartons à surveiller']) {
  assert.equal(isActionablePrediction(pick), false);
}
for (const pick of ['Lyon', 'Lyon ou nul', 'Plus de 2,5 buts', 'Non']) assert.equal(isActionablePrediction(pick), true);
assert.deepEqual(scoreMatchProbabilities({home:100,draw:0,away:0}, 'home'), {brier:0,logLoss:-0});
const score = scoreMatchProbabilities({home:60,draw:30,away:10}, 'away');
assert.ok(Math.abs(score.brier - 1.26) < 1e-10);
assert.ok(Math.abs(score.logLoss + Math.log(0.1)) < 1e-10);
assert.equal(scoreMatchProbabilities({home:null,draw:50,away:50}, 'home'), null);
assert.equal(scoreMatchProbabilities({home:50,draw:50,away:50}, 'home'), null);
console.log('Prediction evaluation: abstentions and multiclass scoring passed');
