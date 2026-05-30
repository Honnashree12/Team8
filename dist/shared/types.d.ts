export type OnboardingMode = 'declared' | 'occasional' | 'passive';
export type FeedbackType = 'accept' | 'dismiss' | 'ignore';
export type InterventionTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';
export type InterventionType = 'font_switch' | 'letter_spacing' | 'line_height' | 'background_tint' | 'reading_ruler' | 'paragraph_chunking' | 'focus_mode' | 'text_simplification' | 'vocabulary_tooltips' | 'text_to_speech';
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
export declare function createDefaultProfile(mode: OnboardingMode): UserProfile;
//# sourceMappingURL=types.d.ts.map