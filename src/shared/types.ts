// Shared DysAssist data model.
// Keep this aligned with the profile object persisted by the extension UI.

export type OnboardingMode = 'declared_dyslexic' | 'occasional' | 'fully_passive';

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

export type PreferredFont = 'lexend' | 'opendyslexic' | 'system';
export type BackgroundTint = 'none' | 'cream' | 'blue' | 'green' | 'yellow';
export type LineHeightPreference = 'normal' | 'relaxed' | 'loose';
export type LetterSpacingPreference = 'normal' | 'wide' | 'wider';

export interface ReadingPreferences {
  font: PreferredFont;
  backgroundTint: BackgroundTint;
  ttsEnabled: boolean;
  lineHeight: LineHeightPreference;
  letterSpacing: LetterSpacingPreference;
  hideMedia: boolean;
  applyImmediately?: boolean;
}

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
  version: 1;
  mode: OnboardingMode;
  difficultyScore: number;
  preferences: ReadingPreferences;
  sessionHistory: SessionSummary[];
  interventionHistory: Record<string, InterventionRecord>;
  domainSettings: DomainSetting[];
  createdAt: string;
  updatedAt: string;
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

export function createDefaultProfile(
  mode: OnboardingMode,
  preferences: Partial<ReadingPreferences> = {}
): UserProfile {
  const scoreMap: Record<OnboardingMode, number> = {
    declared_dyslexic: 0.8,
    occasional: 0.4,
    fully_passive: 0.1,
  };
  const now = new Date().toISOString();

  return {
    version: 1,
    mode,
    difficultyScore: scoreMap[mode],
    preferences: {
      font: mode === 'declared_dyslexic' ? 'lexend' : 'system',
      backgroundTint: 'none',
      ttsEnabled: mode === 'declared_dyslexic',
      letterSpacing: 'normal',
      lineHeight: 'normal',
      hideMedia: false,
      ...preferences,
    },
    sessionHistory: [],
    interventionHistory: {},
    domainSettings: [],
    createdAt: now,
    updatedAt: now,
  };
}
