// signalCollector.ts
// Typed reference for the reading-signal collector (Weeks 1-2).
// The shipped runtime is signalCollector.js (a content script); this file is the
// canonical, typed specification of the same collection + feature-derivation.
//
// Week 1: log scroll / hover / regression events.                    [done]
// Week 2: real IntersectionObserver dwell, regression detector, hover
//         dwell, copy + lookup events; convert to a FeatureVector every 30s;
//         hand it to the service worker, which persists it to chrome.storage. [done]

import type { FeatureVector } from '../shared/types';
import { getDifficultyIndex } from '../data/wordFrequency';

const CONFIG = {
  SCROLL_SAMPLE_MS: 150,
  REGRESSION_THRESHOLD_PERCENT: 15,
  REGRESSION_WINDOW_MS: 3000,
  FEATURE_INTERVAL_MS: 30000, // derive + emit a FeatureVector every 30 seconds
  MIN_PARA_WORDS: 12,
  FAST_WPM: 400, // dwell shorter than this WPM implies "skimmed, not read"
};

interface RawSignals {
  sessionStart: number;
  activeMs: number;
  regressionCount: number;
  totalWordsSeen: number;
  wordsRead: number;
  readingTimeSec: number;
  paragraphsEntered: number;
  paragraphsCompleted: number;
  copyCount: number;
  lookupCount: number;
  hoverDurations: number[];
}

const signals: RawSignals = {
  sessionStart: Date.now(),
  activeMs: 0,
  regressionCount: 0,
  totalWordsSeen: 0,
  wordsRead: 0,
  readingTimeSec: 0,
  paragraphsEntered: 0,
  paragraphsCompleted: 0,
  copyCount: 0,
  lookupCount: 0,
  hoverDurations: [],
};

/**
 * Convert the accumulated raw signals into the derived FeatureVector that the
 * difficulty model consumes. Called on a 30-second cadence.
 */
export function deriveFeatureVector(sampleText: string): FeatureVector {
  const activeMin = Math.max(signals.activeMs / 60000, 1 / 60);
  const readingSpeedWPM =
    signals.readingTimeSec > 0
      ? Math.round(signals.wordsRead / (signals.readingTimeSec / 60))
      : 0;
  const regressionRate =
    signals.totalWordsSeen > 0
      ? (signals.regressionCount / signals.totalWordsSeen) * 100
      : 0;
  const copyLookupFrequency = (signals.copyCount + signals.lookupCount) / activeMin;
  const paragraphCompletionRate =
    signals.paragraphsEntered > 0
      ? signals.paragraphsCompleted / signals.paragraphsEntered
      : 1;

  return {
    readingSpeedWPM,
    regressionRate: Number(regressionRate.toFixed(2)),
    copyLookupFrequency: Number(copyLookupFrequency.toFixed(2)),
    paragraphCompletionRate: Number(paragraphCompletionRate.toFixed(2)),
    vocabularyDifficultyIndex: Number(getDifficultyIndex(sampleText).toFixed(3)),
    sessionDurationSeconds: Math.round((Date.now() - signals.sessionStart) / 1000),
    timestamp: Date.now(),
    domain: typeof location !== 'undefined' ? location.hostname : '',
  };
}

/** Emit the derived vector to the service worker for scoring + persistence. */
export function emitFeatureVector(sampleText: string): void {
  const fv = deriveFeatureVector(sampleText);
  try {
    chrome.runtime.sendMessage({ type: 'FEATURE_SNAPSHOT', payload: fv });
  } catch {
    // Extension context may be invalidated during navigation — safe to ignore.
  }
}

export { CONFIG, signals };
