/** An abstention is never a bet, a win, or a loss. Keep legacy wording covered. */
export function isActionablePrediction(pick: unknown): pick is string {
  return typeof pick === "string" && pick.trim().length > 0 &&
    !/aucun|indisponible|insuffisant|à surveiller|a surveiller|pas de recommandation/i.test(pick);
}

/** Multiclass Brier (0–2) and log loss for the actual 1X2 outcome. */
export function scoreMatchProbabilities(value: unknown, outcome: unknown) {
  if (!value || typeof value !== "object") return null;
  const key = String(outcome ?? "").toLowerCase().trim();
  const actual = ["home", "domicile", "1"].includes(key) ? "home"
    : ["away", "extérieur", "exterieur", "2"].includes(key) ? "away"
      : ["draw", "nul", "n", "x"].includes(key) ? "draw" : null;
  if (!actual) return null;
  const record = value as Record<string, unknown>;
  const keys = ["home", "draw", "away"] as const;
  const values = keys.map(k => record[k]);
  if (values.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100)) return null;
  const probabilities = values as number[];
  if (Math.abs(probabilities.reduce((a, b) => a + b, 0) - 100) > 0.01) return null;
  return {
    brier: probabilities.reduce((sum, p, i) => sum + (p / 100 - (keys[i] === actual ? 1 : 0)) ** 2, 0),
    logLoss: -Math.log(Math.max(1e-15, probabilities[keys.indexOf(actual)] / 100)),
  };
}
