// decisionAgent.ts
// Typed reference for the decision agent (Week 3, joint with Manoj) and the
// feedback learner (Week 4). Runtime lives in adaptiveEngine.js + background.js.
//
// Input : difficulty score (0..1) + context (domain, history, learned state).
// Output: an intervention plan — which preference flags to turn on, and why.
// Interventions are applied progressively: typography (tier 1) → structural
// aids (tier 2) → heavier AI/TTS aids (tier 3).

import type {
  DecisionContext,
  DecisionThresholds,
  DomainClass,
  FeedbackEvent,
  InterventionPlan,
  InterventionType,
  LearnState,
  PlannedIntervention,
  ReadingPreferences,
} from '../shared/types';

export const DECISION_THRESHOLDS: DecisionThresholds = { tier1: 0.30, tier2: 0.50, tier3: 0.70 };

export const DOMAIN_SENSITIVITY: Record<DomainClass, number> = {
  academic: 1.25,
  news: 1.05,
  general: 1.0,
  social: 0.7,
};

export const FALSE_POSITIVE_MS = 5000;

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

const SOCIAL = ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'reddit.com', 'tiktok.com', 'youtube.com', 'linkedin.com', 'threads.net'];
const ACADEMIC = ['scholar.google', 'arxiv.org', 'jstor.org', 'sciencedirect.com', 'springer.com', 'nature.com', 'wikipedia.org', 'ncbi.nlm.nih.gov', 'pubmed', 'researchgate.net', '.edu'];
const NEWS = ['nytimes.com', 'washingtonpost.com', 'theguardian.com', 'bbc.', 'reuters.com', 'apnews.com', 'cnn.com', 'bloomberg.com', 'economist.com'];

export function classifyDomain(domain: string): DomainClass {
  const d = (domain || '').toLowerCase();
  if (SOCIAL.some((h) => d.includes(h))) return 'social';
  if (ACADEMIC.some((h) => d.includes(h))) return 'academic';
  if (NEWS.some((h) => d.includes(h))) return 'news';
  return 'general';
}

type Catalog = Record<'tier1' | 'tier2' | 'tier3', PlannedIntervention[]>;

export const INTERVENTION_CATALOG: Catalog = {
  tier1: [
    { type: 'font_switch', tier: 'tier1', prefPatch: { font: 'lexend' }, label: 'Dyslexia-friendly font', reason: 'easier letter shapes' },
    { type: 'letter_spacing', tier: 'tier1', prefPatch: { letterSpacing: 'wide' }, label: 'Wider letter spacing', reason: 'reduces crowding' },
    { type: 'line_height', tier: 'tier1', prefPatch: { lineHeight: 'relaxed' }, label: 'Relaxed line spacing', reason: 'keeps your place on the line' },
    { type: 'background_tint', tier: 'tier1', prefPatch: { backgroundTint: 'cream' }, label: 'Cream background tint', reason: 'lowers glare' },
  ],
  tier2: [
    { type: 'reading_ruler', tier: 'tier2', prefPatch: { rulerEnabled: true }, label: 'Reading ruler', reason: 'tracks the current line' },
    { type: 'paragraph_chunking', tier: 'tier2', prefPatch: { chunkingEnabled: true }, label: 'Paragraph chunking', reason: 'breaks walls of text into pieces' },
  ],
  tier3: [
    { type: 'focus_mode', tier: 'tier3', prefPatch: { focusEnabled: true }, label: 'Focus mode', reason: 'dims everything except the current sentence' },
    { type: 'vocabulary_tooltips', tier: 'tier3', prefPatch: { vocabEnabled: true }, label: 'Vocabulary tooltips', reason: 'hover any hard word for a plain-English meaning' },
    { type: 'text_to_speech', tier: 'tier3', prefPatch: { ttsEnabled: true }, label: 'Read-aloud (TTS)', reason: 'hear the text spoken' },
    { type: 'text_simplification', tier: 'tier3', prefPatch: { simplifySuggestEnabled: true }, label: 'Simplify hard paragraphs', reason: 'one-click plain-English rewrite of the hardest text' },
  ],
};

export function tierForScore(effScore: number, t: DecisionThresholds = DECISION_THRESHOLDS): 0 | 1 | 2 | 3 {
  if (effScore >= t.tier3) return 3;
  if (effScore >= t.tier2) return 2;
  if (effScore >= t.tier1) return 1;
  return 0;
}

export function decideInterventions(difficultyScore: number, ctx: DecisionContext): InterventionPlan {
  const domainClass = classifyDomain(ctx.domain);
  let sensitivity = ctx.sensitivity ?? DOMAIN_SENSITIVITY[domainClass];
  if (ctx.mode === 'fully_passive') sensitivity *= 0.6;
  if (ctx.mode === 'declared_dyslexic') sensitivity *= 1.1;

  const offset = ctx.thresholdOffset ?? 0;
  const thresholds: DecisionThresholds = {
    tier1: clamp(DECISION_THRESHOLDS.tier1 + offset, 0.1, 0.95),
    tier2: clamp(DECISION_THRESHOLDS.tier2 + offset, 0.1, 0.95),
    tier3: clamp(DECISION_THRESHOLDS.tier3 + offset, 0.1, 0.99),
  };

  const effectiveScore = clamp(difficultyScore * sensitivity, 0, 1);
  const tier = tierForScore(effectiveScore, thresholds);
  const already = new Set(ctx.alreadyApplied);

  const target: PlannedIntervention[] = [];
  const prefPatch: Partial<ReadingPreferences> = {};
  const newInterventions: PlannedIntervention[] = [];

  (['tier1', 'tier2', 'tier3'] as const).slice(0, tier).forEach((level) => {
    INTERVENTION_CATALOG[level].forEach((iv) => {
      target.push(iv);
      Object.assign(prefPatch, iv.prefPatch);
      if (!already.has(iv.type)) newInterventions.push(iv);
    });
  });

  return { score: clamp(difficultyScore, 0, 1), effectiveScore, domainClass, sensitivity, thresholds, tier, target, prefPatch, newInterventions };
}

export function defaultLearnState(): LearnState {
  return { thresholdOffset: 0, domainSensitivity: {}, falsePositives: 0, accepts: 0, dismisses: 0 };
}

export interface FeedbackResult {
  state: LearnState;
  isFalsePositive: boolean;
  domainClass: DomainClass;
}

/**
 * Accepted interventions → more eager (raise domain sensitivity, lower caution).
 * Dismissed → more cautious; a dismissal within 5s is logged as a false positive
 * and penalized harder.
 */
export function applyFeedback(state: LearnState, event: FeedbackEvent): FeedbackResult {
  const domainClass = classifyDomain(event.domain);
  const base = DOMAIN_SENSITIVITY[domainClass];
  const cur = state.domainSensitivity[domainClass] ?? base;
  let isFalsePositive = false;

  if (event.type === 'accept') {
    state.accepts += 1;
    state.domainSensitivity[domainClass] = clamp(cur * 1.06, 0.4, 1.6);
    state.thresholdOffset = clamp(state.thresholdOffset - 0.01, -0.15, 0.4);
  } else if (event.type === 'dismiss') {
    state.dismisses += 1;
    const quick = (event.dwellMsBeforeFeedback ?? Infinity) < FALSE_POSITIVE_MS;
    state.domainSensitivity[domainClass] = clamp(cur * (quick ? 0.82 : 0.9), 0.4, 1.6);
    state.thresholdOffset = clamp(state.thresholdOffset + (quick ? 0.06 : 0.03), -0.15, 0.4);
    if (quick) {
      state.falsePositives += 1;
      isFalsePositive = true;
    }
  }

  return { state, isFalsePositive, domainClass };
}

export type { InterventionType };
