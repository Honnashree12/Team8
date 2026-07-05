// tests/adaptive-smoke.js
// Unit smoke tests for the adaptive engine (scorer, EWMA, decision agent,
// feedback learning). Run via `npm test` or `node tests/adaptive-smoke.js`.

const assert = require("assert");
const AE = require("../adaptiveEngine.js");

const easy = { readingSpeedWPM: 240, regressionRate: 0.2, copyLookupFrequency: 0, paragraphCompletionRate: 1, vocabularyDifficultyIndex: 0.05, domain: "example.com" };
const hard = { readingSpeedWPM: 100, regressionRate: 4.5, copyLookupFrequency: 3, paragraphCompletionRate: 0.5, vocabularyDifficultyIndex: 0.5, domain: "arxiv.org" };

// --- scorer -----------------------------------------------------------------
const es = AE.scoreFeatures(easy);
const hs = AE.scoreFeatures(hard);
assert.ok(es >= 0 && es <= 1, "score in range");
assert.ok(hs > es, "hard page scores higher than easy page");
assert.ok(es < 0.15, `easy page should be low, got ${es}`);
assert.ok(hs > 0.6, `hard page should be high, got ${hs}`);

// A page never read yet (WPM 0) must not be treated as maximum struggle.
const fresh = AE.scoreFeatures({ readingSpeedWPM: 0, regressionRate: 0, copyLookupFrequency: 0, paragraphCompletionRate: 1, vocabularyDifficultyIndex: 0.1 });
assert.ok(fresh < 0.1, `unread page should score low, got ${fresh}`);

// explainScore sums (renormalized) to the score.
const parts = AE.explainScore(hard);
const sum = parts.reduce((a, p) => a + p.contribution, 0);
assert.ok(Math.abs(sum - hs) < 1e-9, "explanation contributions sum to the score");

// --- EWMA -------------------------------------------------------------------
assert.strictEqual(AE.ewma(null, 0.8, 0.3), 0.8, "ewma seeds from first value");
assert.ok(Math.abs(AE.ewma(0.8, 0.4, 0.5) - 0.6) < 1e-9, "ewma blends 50/50");
const smoothed = AE.ewma(0.2, 0.9, 0.3);
assert.ok(smoothed > 0.2 && smoothed < 0.9, "ewma stays between old and new");

// --- domain classification --------------------------------------------------
assert.strictEqual(AE.classifyDomain("www.arxiv.org"), "academic");
assert.strictEqual(AE.classifyDomain("twitter.com"), "social");
assert.strictEqual(AE.classifyDomain("nytimes.com"), "news");
assert.strictEqual(AE.classifyDomain("randomblog.io"), "general");

// --- decision agent ---------------------------------------------------------
const easyPlan = AE.decideInterventions(0.1, { domain: "twitter.com", mode: "occasional", alreadyApplied: [] });
assert.strictEqual(easyPlan.tier, 0, "low score -> no interventions");
assert.strictEqual(easyPlan.newInterventions.length, 0, "no interventions proposed");

const hardPlan = AE.decideInterventions(0.75, { domain: "example.com", mode: "occasional", alreadyApplied: [] });
assert.strictEqual(hardPlan.tier, 3, "high score -> tier 3");
assert.ok(hardPlan.newInterventions.some(i => i.type === "text_to_speech"), "tier 3 includes TTS");
assert.ok(hardPlan.prefPatch.font === "lexend", "plan patches the font preference");

// Academic domain is more aggressive than social for the SAME score.
const acad = AE.decideInterventions(0.55, { domain: "arxiv.org", mode: "occasional", alreadyApplied: [] });
const soc = AE.decideInterventions(0.55, { domain: "reddit.com", mode: "occasional", alreadyApplied: [] });
assert.ok(acad.tier >= soc.tier, "academic intervenes at least as aggressively as social");
assert.ok(acad.effectiveScore > soc.effectiveScore, "academic sensitivity raises effective score");

// alreadyApplied interventions are not re-proposed.
const partial = AE.decideInterventions(0.75, { domain: "example.com", mode: "occasional", alreadyApplied: ["font_switch", "letter_spacing"] });
assert.ok(!partial.newInterventions.some(i => i.type === "font_switch"), "does not re-propose active interventions");

// --- feedback learning ------------------------------------------------------
let learn = AE.defaultLearnState();
const before = AE.decideInterventions(0.5, { domain: "arxiv.org", mode: "occasional", alreadyApplied: [] }).effectiveScore;

// Accepting on academic makes us more eager there.
const acc = AE.applyFeedback(learn, { type: "accept", domain: "arxiv.org" });
learn = acc.state;
assert.ok(learn.domainSensitivity.academic > (AE.DOMAIN_SENSITIVITY.academic), "accept raises academic sensitivity");
assert.strictEqual(acc.isFalsePositive, false, "accept is not a false positive");

// Dismiss within 5s = false positive, and lowers sensitivity + raises caution.
const fp = AE.applyFeedback(AE.defaultLearnState(), { type: "dismiss", domain: "arxiv.org", dwellMsBeforeFeedback: 2000 });
assert.strictEqual(fp.isFalsePositive, true, "quick dismiss flagged as false positive");
assert.ok(fp.state.thresholdOffset > 0, "dismiss raises the caution offset");
assert.ok(fp.state.domainSensitivity.academic < AE.DOMAIN_SENSITIVITY.academic, "dismiss lowers sensitivity");
assert.strictEqual(fp.state.falsePositives, 1, "false positive counted");

// Slow dismiss (>5s) is a normal dismiss, not a false positive.
const slow = AE.applyFeedback(AE.defaultLearnState(), { type: "dismiss", domain: "arxiv.org", dwellMsBeforeFeedback: 9000 });
assert.strictEqual(slow.isFalsePositive, false, "slow dismiss is not a false positive");

console.log("adaptive-smoke: all assertions passed ✓");
