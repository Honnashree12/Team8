// ============================================================
// types.ts — Written by Saanvi, Week 1
// This file defines what a "user" and a "reading session" look like.
// Honnashree and Manoj both import from here.
// ============================================================

// Which option the user picked during onboarding
export type OnboardingMode = 'declared' | 'occasional' | 'passive';
//   declared   = "I have dyslexia"
//   occasional = "I sometimes struggle"
//   passive    = "just watch me automatically"

// What the user does when help is offered
export type FeedbackType = 'accept' | 'dismiss' | 'ignore';

// The 4 levels of help (mild → full)
export type InterventionTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';

// Every specific type of help the system can give
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

// -------------------------------------------------------
// FeatureVector — measurements from one reading session
// -------------------------------------------------------
export interface FeatureVector {
  readingSpeedWPM: number;         // how fast they're reading (words per minute)
  regressionRate: number;          // how often they scroll back to re-read
  copyLookupFrequency: number;     // how often they copy text or look up words
  paragraphCompletionRate: number; // did they finish reading each paragraph?
  vocabularyDifficultyIndex: number; // how many hard/rare words are on this page
  sessionDurationSeconds: number;  // how long they've been on this page
  timestamp: number;               // when this was measured
  domain: string;                  // which website (e.g. "arxiv.org")
}

// -------------------------------------------------------
// UserProfile — everything we know about this user
// Stored in chrome.storage.local, never sent anywhere
// -------------------------------------------------------
export interface UserProfile {
  mode: OnboardingMode;
  initialDifficultyScore: number;   // set during onboarding (0.8 / 0.4 / 0.1)
  currentDifficultyScore: number;   // updated after every session
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

// -------------------------------------------------------
// Supporting types used inside UserProfile
// -------------------------------------------------------
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
// createDefaultProfile — called during onboarding
// Usage: const profile = createDefaultProfile('declared')
// -------------------------------------------------------
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