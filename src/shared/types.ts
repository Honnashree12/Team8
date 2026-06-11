// ============================================================
// types.ts — Written by Saanvi, Week 1
// This file defines what a "user" and a "reading session" look like.
// Honnashree and Manoj both import from here.
// ============================================================

export type OnboardingMode = 'declared' | 'occasional' | 'passive';
export type FeedbackType = 'accept' | 'dismiss' | 'ignore';
export type InterventionTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';

export type InterventionType =
  | 'font_switch'
  | 'letter_spacing'
  | 'line_height'
  | 'background_tint'
  | 'reading_ruler'
  | 'paragraph_chunking'
  | 'focus_mode'
  | 'text_simplification'
  | 'vocabulary_tooltips'
  | 'text_to_speech';

export interface FeatureVector {
  readingSpeedWPM: number;
  regressionRate: number;
  copyLookupFrequency: number;
  paragraphCompletionRate: number;
  vocabularyDifficultyIndex: number;
  sessionDurationSeconds: number;
  timestamp: number;
  domain: string;
}

export interface UserProfile {
  mode: OnboardingMode;
  initialDifficultyScore: number;
  currentDifficultyScore: number;
  lastSessionScore: number;

  preferredFont: 'lexend' | 'openDyslexic' | 'system';
  preferredBackgroundTint: 'none' | 'cream' | 'sepia' | 'blue';
  textToSpeechEnabled: boolean;

  sessionHistory: SessionSummary[];
  interventionHistory: InterventionRecord[];
  domainSettings: Record<string, DomainSetting>;

  createdAt: number;
  lastUpdated: number;
}

export interface SessionSummary {
  domain: string;
  difficultyScore: number;
  readingSpeedWPM: number;
  interventionsApplied: InterventionType[];
  durationSeconds: number;
  timestamp: number;
}

export interface InterventionRecord {
  type: InterventionType;
  tier: InterventionTier;
  feedback: FeedbackType;
  difficultyScoreAtTime: number;
  domain: string;
  timestamp: number;
}

export interface DomainSetting {
  domain: string;
  averageDifficultyScore: number;
  applyImmediately: boolean;
  sensitivityOverride: number | null;
  sessionCount: number;
}

// -------------------------------------------------------
// STORAGE_KEYS — used by featurePipeline and popup
// Import this instead of typing the key string by hand
// (prevents typo bugs)
// -------------------------------------------------------
export const STORAGE_KEYS = {
  USER_PROFILE: 'userProfile',
  FEATURE_VECTOR: 'lastFeatureVector',
} as const;

export function createDefaultProfile(mode: OnboardingMode): UserProfile {
  const scoreMap = { declared: 0.8, occasional: 0.4, passive: 0.1 };

  return {
    mode,
    initialDifficultyScore: scoreMap[mode],
    currentDifficultyScore: scoreMap[mode],
    lastSessionScore: scoreMap[mode],

    preferredFont: mode === 'declared' ? 'lexend' : 'system',
    preferredBackgroundTint: mode === 'declared' ? 'cream' : 'none',
    textToSpeechEnabled: mode === 'declared',

    sessionHistory: [],
    interventionHistory: [],
    domainSettings: {},

    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };
}