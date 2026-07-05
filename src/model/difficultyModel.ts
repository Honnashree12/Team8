// difficultyModel.ts
// Typed reference for the rule-based difficulty scorer (Week 3).
// The shipped runtime is adaptiveEngine.js; this file is the canonical, typed
// specification of the same math, shared with the team and used in review.
//
// We deliberately use an INTERPRETABLE weighted sum rather than an ML model so
// that every score can be explained ("slow reading + hard vocabulary drove
// this") and it works from the very first page with zero training data.
// See docs/DECISION_LOG.md for the weight rationale and calibration.

import type { FeatureVector, FeatureWeights } from '../shared/types';

/** Share of the score attributable to each normalized (0..1) signal. Sums to 1. */
export const FEATURE_WEIGHTS: FeatureWeights = {
  vocabularyDifficultyIndex: 0.30,
  regressionRate: 0.25,
  slowReading: 0.20,
  copyLookupFrequency: 0.15,
  lowCompletion: 0.10,
};

export const WPM_FLUENT = 220;
export const WPM_STRUGGLING = 90;

const clamp = (x: number, lo: number, hi: number): number =>
  x < lo ? lo : x > hi ? hi : x;

export interface NormalizedFeatures {
  vocabularyDifficultyIndex: number;
  regressionRate: number;
  slowReading: number;
  copyLookupFrequency: number;
  lowCompletion: number;
}

/** Map a raw FeatureVector to per-signal "struggle" values in [0,1]. */
export function normalizeFeatures(fv: FeatureVector): NormalizedFeatures {
  const wpm = Number(fv.readingSpeedWPM) || 0;
  const slowReading =
    wpm <= 0 ? 0 : clamp((WPM_FLUENT - wpm) / (WPM_FLUENT - WPM_STRUGGLING), 0, 1);
  return {
    vocabularyDifficultyIndex: clamp(fv.vocabularyDifficultyIndex || 0, 0, 1),
    regressionRate: clamp((fv.regressionRate || 0) / 5, 0, 1),
    slowReading,
    copyLookupFrequency: clamp((fv.copyLookupFrequency || 0) / 4, 0, 1),
    lowCompletion: clamp(1 - (fv.paragraphCompletionRate ?? 1), 0, 1),
  };
}

/** Interpretable weighted sum → difficulty score in [0,1]. */
export function scoreFeatures(
  fv: FeatureVector,
  weights: FeatureWeights = FEATURE_WEIGHTS
): number {
  const n = normalizeFeatures(fv);
  let score = 0;
  let wsum = 0;
  (Object.keys(weights) as Array<keyof FeatureWeights>).forEach((k) => {
    score += weights[k] * n[k];
    wsum += weights[k];
  });
  return clamp(wsum > 0 ? score / wsum : 0, 0, 1);
}

export interface Contribution {
  signal: keyof FeatureWeights;
  normalized: number;
  weight: number;
  contribution: number;
}

/** Per-signal breakdown, largest first — powers the "why" in the UI. */
export function explainScore(
  fv: FeatureVector,
  weights: FeatureWeights = FEATURE_WEIGHTS
): Contribution[] {
  const n = normalizeFeatures(fv);
  return (Object.keys(weights) as Array<keyof FeatureWeights>)
    .map((signal) => ({
      signal,
      normalized: n[signal],
      weight: weights[signal],
      contribution: weights[signal] * n[signal],
    }))
    .sort((a, b) => b.contribution - a.contribution);
}

/**
 * EWMA smoothing so a single hard/easy page doesn't whipsaw the profile.
 * alpha = weight on the newest observation (lower = smoother). Default 0.3.
 */
export function ewma(previous: number | null, next: number, alpha = 0.3): number {
  if (previous == null || Number.isNaN(previous)) return next;
  return clamp(alpha * next + (1 - alpha) * previous, 0, 1);
}
