type JsonRecord = Record<string, unknown>;

function normalizeProbabilityValues(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  const scaled = values.map((value) => (value / total) * 100);
  const normalized = scaled.map((value) => Math.floor(value));
  let remaining = 100 - normalized.reduce((sum, value) => sum + value, 0);
  const order = scaled
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder);

  for (let cursor = 0; remaining > 0; cursor += 1, remaining -= 1) {
    normalized[order[cursor % order.length].index] += 1;
  }

  return { home: normalized[0], draw: normalized[1], away: normalized[2] };
}

function normalizeRisk(risk: unknown): "bas" | "moyen" | "eleve" {
  const label = String(risk ?? "").toLowerCase();
  if (label.includes("bas") || label.includes("low")) return "bas";
  if (label.includes("moy") || label.includes("medium") || label.includes("moderate")) {
    return "moyen";
  }
  return "eleve";
}

/**
 * Normalise uniquement la forme d'une réponse IA avant sa validation stricte.
 * Aucune donnée sportive absente n'est créée ou remplacée par cette fonction.
 */
export function normalizeAiCandidate(candidate: unknown): unknown {
  if (!candidate || typeof candidate !== "object") return candidate;
  const value = candidate as JsonRecord;
  const probabilities = value.probabilities;
  if (!probabilities || typeof probabilities !== "object") return candidate;

  const raw = probabilities as JsonRecord;
  const parsedProbabilities = [raw.home, raw.draw, raw.away].map((item) => {
    const parsed = typeof item === "number" ? item : Number(item);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  });
  if (parsedProbabilities.some((item) => item === null)) return candidate;

  const normalizedProbabilities = normalizeProbabilityValues(parsedProbabilities as number[]);
  if (!normalizedProbabilities) return candidate;

  const markets = Array.isArray(value.markets)
    ? value.markets.map((market) => {
        const item = market && typeof market === "object" ? (market as JsonRecord) : {};
        const confidenceValue = Number(item.confidence);
        const probabilityValue = Number(item.probability);
        return {
          label: String(item.label ?? "Marché"),
          pick: String(item.pick ?? "À surveiller"),
          ...(Number.isFinite(probabilityValue)
            ? { probability: Math.max(0, Math.min(100, Math.round(probabilityValue))) }
            : {}),
          confidence: Number.isFinite(confidenceValue)
            ? Math.max(0, Math.min(85, Math.round(confidenceValue)))
            : 0,
          risk: normalizeRisk(item.risk),
          rationale: String(
            item.rationale ?? "Projection calculée à partir des informations disponibles.",
          ),
        };
      })
    : value.markets;

  return {
    ...value,
    probabilities: normalizedProbabilities,
    markets,
    probableScore:
      typeof value.probableScore === "string"
        ? value.probableScore
        : String(value.probableScore ?? "0 - 0"),
    aiText:
      typeof value.aiText === "string"
        ? value.aiText
        : "Analyse calculée à partir des informations vérifiées disponibles.",
    keyFactors: Array.isArray(value.keyFactors)
      ? value.keyFactors.filter((item): item is string => typeof item === "string").slice(0, 6)
      : value.keyFactors,
  };
}
