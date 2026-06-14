// =============================================================================
// featurePipeline.ts — WEEK 2 NEW FILE
// Takes raw signals every 30 seconds → computes FeatureVector → saves to storage
//
// Think of this as the "translator":
//   raw events (scroll count, hover durations) → clean numbers (WPM, regression rate)
// =============================================================================

import { FeatureVector, STORAGE_KEYS } from '../shared/types';
import { rawSignals }                  from './signalCollector';
import { getDifficultyIndex }          from '../data/wordFrequency';

// ============================================================================
// MAIN FUNCTION — call this every 30 seconds
// Reads rawSignals, computes FeatureVector, saves to chrome.storage.local
// ============================================================================
export async function computeAndSaveFeatureVector(): Promise<FeatureVector | null> {
  const sessionMs = Date.now() - rawSignals.sessionStart;

  // Don't compute until we have at least 30 seconds of data
  if (sessionMs < 30_000) {
    const secondsLeft = Math.ceil((30_000 - sessionMs) / 1000);
    console.log(`[Pipeline] ⏳ Waiting... ${secondsLeft}s until first feature vector`);
    return null;
  }

  const sessionSeconds = sessionMs / 1000;
  const domain         = window.location.hostname;

  // ------------------------------------------------------------------
  // FEATURE 1 — Reading Speed (words per minute)
  // How fast is the user reading?
  // Normal adult: ~238 wpm. Struggling reader: under 100 wpm.
  // ------------------------------------------------------------------
  const totalWords     = rawSignals.totalWordsTagged;
  const minutesElapsed = sessionSeconds / 60;
  const readingSpeedWPM = totalWords > 0
    ? Math.round(totalWords / minutesElapsed)
    : 0;

  // ------------------------------------------------------------------
  // FEATURE 2 — Regression Rate (scroll-backs per 100 words)
  // How often does the user scroll up to re-read?
  // Normal: 0–3 per 100 words. Struggling: 5+
  // ------------------------------------------------------------------
  const regressionRate = totalWords > 0
    ? parseFloat(((rawSignals.regressionCount / totalWords) * 100).toFixed(2))
    : 0;

  // ------------------------------------------------------------------
  // FEATURE 3 — Copy + Lookup Frequency
  // Total times user copied text or right-clicked to look something up
  // ------------------------------------------------------------------
  const copyLookupFrequency = rawSignals.copyCount + rawSignals.lookupCount;

  // ------------------------------------------------------------------
  // FEATURE 4 — Paragraph Completion Rate
  // What proportion of paragraphs did the user actually read?
  // We consider a paragraph "read" if dwell time > 3 seconds
  // (skimming would be less than that)
  // ------------------------------------------------------------------
  const totalParagraphs = rawSignals.paragraphDwellTimes.size;
  const readParagraphs  = Array.from(rawSignals.paragraphDwellTimes.values())
    .filter(dwell => dwell > 3000).length;

  const paragraphCompletionRate = totalParagraphs > 0
    ? parseFloat((readParagraphs / totalParagraphs).toFixed(2))
    : 0;

  // ------------------------------------------------------------------
  // FEATURE 5 — Vocabulary Difficulty Index
  // What proportion of words on this page are "hard" (not in top 5000)?
  // Uses your wordFrequency.ts file from Week 1!
  // ------------------------------------------------------------------
  const pageText = document.body.innerText ?? '';
  const vocabularyDifficultyIndex = parseFloat(
    getDifficultyIndex(pageText).toFixed(2)
  );

  // ------------------------------------------------------------------
  // BUILD THE FEATURE VECTOR
  // ------------------------------------------------------------------
  const vector: FeatureVector = {
    readingSpeedWPM,
    regressionRate,
    copyLookupFrequency,
    paragraphCompletionRate,
    vocabularyDifficultyIndex,
    sessionDurationSeconds: Math.round(sessionSeconds),
    timestamp: Date.now(),
    domain,
  };

  // ------------------------------------------------------------------
  // SAVE TO chrome.storage.local
  // This is how the rest of the extension reads your work.
  // Honnashree's popup will read this to show the difficulty score.
  // Saanvi's scorer (Week 3) will read this to compute the RDS score.
  // ------------------------------------------------------------------
  await chrome.storage.local.set({
    [STORAGE_KEYS.FEATURE_VECTOR]: vector,
  });

  // Log nicely so you can see it working in DevTools console
  console.log(
    '%c[Pipeline] 📊 Feature Vector saved',
    'background:#534AB7; color:white; padding:2px 6px; border-radius:4px',
    {
      '🏃 Reading speed':    `${vector.readingSpeedWPM} wpm`,
      '🔄 Regressions':      `${vector.regressionRate} per 100 words`,
      '📋 Copy+Lookups':     vector.copyLookupFrequency,
      '📖 Para completion':  `${(vector.paragraphCompletionRate * 100).toFixed(0)}%`,
      '📚 Vocab difficulty': `${(vector.vocabularyDifficultyIndex * 100).toFixed(0)}% hard words`,
      '⏱ Session':          `${vector.sessionDurationSeconds}s`,
      '🌐 Domain':           vector.domain,
    }
  );

  return vector;
}

// ============================================================================
// START THE PIPELINE — call this once from your content script
// It will automatically compute + save a FeatureVector every 30 seconds
// ============================================================================
export function startFeaturePipeline() {
  console.log('[Pipeline] ▶ Feature pipeline started — first snapshot in 30s');

  setInterval(async () => {
    await computeAndSaveFeatureVector();
  }, 30_000);
}