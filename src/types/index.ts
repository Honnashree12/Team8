// ─── Shared types — single source of truth for all three devs ─────────────────

export type OnboardingMode = "declared_dyslexic" | "occasional" | "fully_passive";
export type FontChoice      = "lexend" | "opendyslexic" | "system";
export type BackgroundTint  = "none" | "cream" | "blue" | "green" | "yellow";

export interface UserPreferences {
  font: FontChoice;
  backgroundTint: BackgroundTint;
  ttsEnabled: boolean;
  letterSpacing: "normal" | "wide" | "wider";
  lineHeight: "normal" | "relaxed" | "loose";
}

export interface DomainSetting {
  domain: string;
  paused: boolean;
  sensitivityOverride?: number;
}

export interface InterventionHistory {
  level: 1 | 2 | 3;
  lastOffered: number;
  lastAction: "accepted" | "dismissed" | "ignored" | null;
  weight: number;
}

export interface UserProfile {
  version: 1;
  mode: OnboardingMode;
  difficultyScore: number;
  preferences: UserPreferences;
  domainSettings: DomainSetting[];
  interventionHistory: Record<string, InterventionHistory>;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureVector {
  readingSpeedWpm: number;
  regressionRate: number;
  copyLookupFrequency: number;
  paragraphCompletionRate: number;
  vocabularyDifficultyIndex: number;
  computedAt: number;
}

// ─── Active adaptation — one card in the popup dashboard ─────────────────────
export type AdaptationType =
  | "font"
  | "line_height"
  | "letter_spacing"
  | "background_tint"
  | "word_spacing"
  | "tts"
  | "focus_mode"
  | "reading_ruler";

export interface ActiveAdaptation {
  type: AdaptationType;
  label: string;
  description: string;
  triggerSignal: string;
  enabled: boolean;
  canToggle: boolean;
}

// ─── "Why" modal payload ──────────────────────────────────────────────────────
export interface WhyExplanation {
  score: number;
  scoreLabel: string;
  topSignals: { signal: string; value: string; weight: number }[];
  adaptationsApplied: string[];
  modeNote: string;
}
