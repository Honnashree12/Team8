// ============================================================
// types.ts — Written by Saanvi, Week 1
// This file defines what a "user" and a "reading session" look like.
// Honnashree and Manoj both import from here.
// ============================================================
// -------------------------------------------------------
// createDefaultProfile — called during onboarding
// Usage: const profile = createDefaultProfile('declared')
// -------------------------------------------------------
export function createDefaultProfile(mode) {
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
//# sourceMappingURL=types.js.map