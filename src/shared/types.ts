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
export type FocusStylePreference = 'dim' | 'blur' | 'both';
export type RulerModePreference = 'follow' | 'line';

export interface ReadingPreferences {
  font: PreferredFont;
  backgroundTint: BackgroundTint;
  ttsEnabled: boolean;
  lineHeight: LineHeightPreference;
  letterSpacing: LetterSpacingPreference;
  hideMedia: boolean;
  applyImmediately?: boolean;
  chunkingEnabled: boolean;
  chunkMaxSentences: number;
  rulerEnabled: boolean;
  rulerHeight: number;
  rulerOpacity: number;
  rulerColor: string;
  rulerMode: RulerModePreference;
  focusEnabled: boolean;
  focusStyle: FocusStylePreference;
  focusBlur: number;
  focusDimOpacity: number;
  focusTransition: number;
  // Optional fields set by the popup / adaptive engine at runtime.
  vocabEnabled?: boolean;
  vocabTopN?: number;
  ttsRate?: number;
  ttsPitch?: number;
  ttsVoiceURI?: string;
  ttsHighlight?: boolean;
  readingModeEnabled?: boolean;
  overlayOpacity?: number;
  /** Adaptive tier-3: auto-highlight + one-click simplify the hardest paragraph. */
  simplifySuggestEnabled?: boolean;
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
  /** Adaptive-engine state: learned weights, auto-applied set, suppressions. */
  adaptive?: AdaptiveProfileState;
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

// ---------------------------------------------------------------------------
// Adaptive engine contracts (Saanvi — difficulty model + decision agent).
// The runtime implementation lives in adaptiveEngine.js; these interfaces are
// the shared, typed source of truth referenced by the model/agent modules.
// ---------------------------------------------------------------------------

/** Signals that make up the interpretable difficulty scorer (weights sum to 1). */
export interface FeatureWeights {
  vocabularyDifficultyIndex: number;
  regressionRate: number;
  slowReading: number;
  copyLookupFrequency: number;
  lowCompletion: number;
}

/** The 0.3 / 0.5 / 0.7 tier cut-points, calibrated on synthetic pages. */
export interface DecisionThresholds {
  tier1: number;
  tier2: number;
  tier3: number;
}

export type DomainClass = 'academic' | 'news' | 'general' | 'social';

export interface PlannedIntervention {
  type: InterventionType;
  tier: InterventionTier;
  prefPatch: Partial<ReadingPreferences>;
  label: string;
  reason: string;
}

/** Output of the decision agent for a given score + context. */
export interface InterventionPlan {
  score: number;
  effectiveScore: number;
  domainClass: DomainClass;
  sensitivity: number;
  thresholds: DecisionThresholds;
  tier: 0 | 1 | 2 | 3;
  target: PlannedIntervention[];
  prefPatch: Partial<ReadingPreferences>;
  newInterventions: PlannedIntervention[];
}

/** Context the decision agent needs beyond the raw score. */
export interface DecisionContext {
  domain: string;
  alreadyApplied: InterventionType[];
  mode?: OnboardingMode;
  sensitivity?: number;
  thresholdOffset?: number;
}

export type FeedbackDecision = 'accept' | 'dismiss' | 'ignore';

export interface FeedbackEvent {
  type: FeedbackDecision;
  domain: string;
  interventions?: InterventionType[];
  dwellMsBeforeFeedback?: number;
  scoreAtTime?: number;
}

/** Learned state adjusted by feedback over time. */
export interface LearnState {
  /** Global caution: raised by dismissals, lowered by accepts. */
  thresholdOffset: number;
  /** Per-domain-class aggressiveness multipliers. */
  domainSensitivity: Partial<Record<DomainClass, number>>;
  /** Optional online-adjusted feature weights (defaults to FEATURE_WEIGHTS). */
  weights?: FeatureWeights;
  falsePositives: number;
  accepts: number;
  dismisses: number;
}

export interface ScoreSample {
  score: number;
  raw: number;
  tier: number;
  domain: string;
  ts: number;
}

export interface AdaptiveProfileState {
  learn: LearnState;
  /** Interventions the agent turned on (vs. user-set): type -> metadata. */
  autoApplied: Record<string, { tier: InterventionTier; ts: number; domain: string; coldStart?: boolean }>;
  /** Interventions the user dismissed, per domain, so we stop nagging. */
  suppressed: Record<string, Partial<Record<InterventionType, boolean>>>;
  lastTier: number;
  falsePositiveLog?: Array<{
    interventions: InterventionType[];
    domain: string;
    scoreAtTime?: number;
    dwellMs?: number;
    ts: number;
  }>;
  archivedToIDB?: boolean;
}

/** Bulk rolling telemetry persisted separately (may migrate to IndexedDB > 1MB). */
export interface AdaptiveTelemetry {
  featureHistory: FeatureVector[];
  scoreHistory: ScoreSample[];
  archivedToIDB?: boolean;
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
      chunkingEnabled: false,
      chunkMaxSentences: 3,
      rulerEnabled: false,
      rulerHeight: 36,
      rulerOpacity: 0.12,
      rulerColor: '#0082f0',
      rulerMode: 'follow',
      focusEnabled: false,
      focusStyle: 'both',
      focusBlur: 4,
      focusDimOpacity: 0.55,
      focusTransition: 220,
      ...preferences,
    },
    sessionHistory: [],
    interventionHistory: {},
    domainSettings: [],
    createdAt: now,
    updatedAt: now,
  };
}
