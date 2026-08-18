/**
 * Invariants shared by the statistical and AI prediction paths.
 *
 * This module deliberately contains no provider names, secrets or UI wording.
 * It is safe to use from server functions and from pure verification scripts.
 */

export const PREDICTION_ENGINE_VERSION = "v2.0.0";
export const PREDICTION_CALIBRATION_VERSION = "guarded-v1";

export type PredictionAiStatus =
  | "ai_enriched"
  | "ai_fallback"
  | "statistical_only"
  | "no_recommendation";

export type PredictionMetadata = {
  engineVersion: string;
  calibrationVersion: string;
  aiStatus: PredictionAiStatus;
  dataQualityLevel: "complete" | "partial" | "identity";
  dataQualityScore: number;
  aiLatencyMs: number | null;
  availableSections: string[];
  unavailableSections: string[];
  marketCount: number;
};

export type ProbabilityTriplet = {
  home: number;
  draw: number;
  away: number;
};

export function normalizeProbabilityTriplet(value: ProbabilityTriplet): ProbabilityTriplet {
  const safe = {
    home: Number.isFinite(value.home) ? Math.max(0, value.home) : 0,
    draw: Number.isFinite(value.draw) ? Math.max(0, value.draw) : 0,
    away: Number.isFinite(value.away) ? Math.max(0, value.away) : 0,
  };
  const total = safe.home + safe.draw + safe.away;
  if (total <= 0) return { home: 34, draw: 33, away: 33 };

  const home = Math.round((safe.home / total) * 100);
  const draw = Math.round((safe.draw / total) * 100);
  return { home, draw, away: 100 - home - draw };
}

/**
 * Conservative guard against overconfident probabilities on thin contexts.
 * This is intentionally a shrinkage guard, not a claim of historical
 * calibration. Empirical calibration versions can replace it after backtests.
 */
export function guardProbabilities(
  probabilities: ProbabilityTriplet,
  qualityScore: number,
): ProbabilityTriplet {
  const quality = Math.max(0, Math.min(100, qualityScore)) / 100;
  const shrinkage = 0.38 + quality * 0.42;
  return normalizeProbabilityTriplet({
    home: 33.333 + (probabilities.home - 33.333) * shrinkage,
    draw: 33.333 + (probabilities.draw - 33.333) * shrinkage,
    away: 33.333 + (probabilities.away - 33.333) * shrinkage,
  });
}

export function aiBlendWeight(params: {
  dataQuality: "complete" | "partial" | "identity";
  divergence: number;
  aiStatus: Exclude<PredictionAiStatus, "statistical_only" | "no_recommendation">;
}): number {
  if (params.dataQuality === "identity") return 0;
  if (params.divergence > 18) return 0.12;
  if (params.divergence > 10) return 0.18;
  if (params.dataQuality === "partial") return 0.2;
  return params.aiStatus === "ai_fallback" ? 0.24 : 0.3;
}

export function brierScore(probability: number, outcome: boolean): number {
  const p = Math.max(0, Math.min(1, probability));
  return (p - (outcome ? 1 : 0)) ** 2;
}

export function logLoss(probability: number, outcome: boolean): number {
  const p = Math.max(0.001, Math.min(0.999, probability));
  return -(outcome ? Math.log(p) : Math.log(1 - p));
}

export function predictionMetadataFor(params: {
  aiStatus: PredictionAiStatus;
  dataQualityLevel: "complete" | "partial" | "identity";
  dataQualityScore: number;
  aiLatencyMs?: number | null;
  availableSections: string[];
  unavailableSections: string[];
  marketCount: number;
}): PredictionMetadata {
  return {
    engineVersion: PREDICTION_ENGINE_VERSION,
    calibrationVersion: PREDICTION_CALIBRATION_VERSION,
    aiStatus: params.aiStatus,
    dataQualityLevel: params.dataQualityLevel,
    dataQualityScore: Math.max(0, Math.min(100, Math.round(params.dataQualityScore))),
    aiLatencyMs: params.aiLatencyMs ?? null,
    availableSections: [...new Set(params.availableSections)].slice(0, 40),
    unavailableSections: [...new Set(params.unavailableSections)].slice(0, 40),
    marketCount: Math.max(0, Math.min(6, Math.trunc(params.marketCount))),
  };
}
