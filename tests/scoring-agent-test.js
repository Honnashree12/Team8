/**
 * DysAssist — Scorer & Decision Agent Tests (Week 3)
 * Run with: node tests/scoring-agent-test.js
 */

const assert = require("assert");

// ─── Inline the scorer logic from background.js ────────────────────────────

function computeDifficultyScore(features) {
  const wpm    = features.readingSpeedWpm    || 0;
  const reg    = features.regressionRate     || 0;
  const hover  = features.hoverDwellSpikes   || 0;
  const lookup = features.copyLookupFrequency || 0;
  const comp   = features.paragraphCompletionRate !== undefined ? features.paragraphCompletionRate : 1.0;
  const vocab  = features.vocabularyDifficultyIndex || 0;

  const s_wpm    = Math.max(0, Math.min(1, (200 - wpm)  / 140));
  const s_reg    = Math.max(0, Math.min(1, (reg - 1.0)  / 3.0));
  const s_hover  = Math.max(0, Math.min(1, hover / 3));
  const s_lookup = Math.max(0, Math.min(1, lookup / 3));
  const s_comp   = Math.max(0, Math.min(1, 1.0 - comp));
  const s_vocab  = Math.max(0, Math.min(1, (vocab - 0.05) / 0.25));

  const score = (s_wpm * 0.35) + (s_reg * 0.25) + (s_hover * 0.15)
              + (s_lookup * 0.10) + (s_vocab * 0.10) + (s_comp * 0.05);

  return parseFloat(score.toFixed(3));
}

function applyEWMA(sessionScore, historicalScore, alpha = 0.3) {
  return parseFloat((alpha * sessionScore + (1 - alpha) * historicalScore).toFixed(3));
}

function runDecisionAgent(profile, score, domain) {
  const domainSetting = (profile.domainSettings || []).find(d => d.domain === domain);
  if (domainSetting && domainSetting.paused) {
    return { paused: true, apply: [], offer: null, reason: "" };
  }

  const sensitivity = domainSetting ? domainSetting.sensitivityOverride : undefined;
  let t1 = 0.3, t2 = 0.5, t3 = 0.7;
  if (sensitivity !== undefined) {
    if (sensitivity <= 0.35) { t1 = 0.45; t2 = 0.65; t3 = 0.85; }
    else if (sensitivity > 0.65) { t1 = 0.15; t2 = 0.35; t3 = 0.55; }
  }

  let targetTier = 0;
  if (score >= t3) targetTier = 3;
  else if (score >= t2) targetTier = 2;
  else if (score >= t1) targetTier = 1;

  const plan = { paused: false, apply: [], offer: null, reason: "" };

  const isDyslexic = profile.mode === "declared_dyslexic";
  const history = profile.interventionHistory || {};
  const t2Accepted  = history["tier2"] && history["tier2"].lastAction === "accepted";
  const t2Dismissed = history["tier2"] && history["tier2"].lastAction === "dismissed";
  const t2DismissScore = history["tier2"] ? history["tier2"].difficultyScoreAtTime || 0.5 : 0.5;
  const t3Accepted  = history["tier3"] && history["tier3"].lastAction === "accepted";
  const t3Dismissed = history["tier3"] && history["tier3"].lastAction === "dismissed";
  const t3DismissScore = history["tier3"] ? history["tier3"].difficultyScoreAtTime || 0.7 : 0.7;

  const stats = profile.domainStats && profile.domainStats[domain];
  const isDifficultDomain = stats && stats.visits >= 2 && stats.avgDifficultyScore >= 0.5;
  const isHighSensitivity = sensitivity !== undefined && sensitivity > 0.65;
  const shouldProactivelyApplyTier1 = isDyslexic || isDifficultDomain || isHighSensitivity;

  if (shouldProactivelyApplyTier1 || targetTier >= 1) {
    plan.apply.push("font_switch", "letter_spacing", "line_height", "background_tint");
  }

  if (targetTier >= 2) {
    if (t2Accepted) {
      plan.apply.push("reading_ruler", "paragraph_chunking", "focus_mode");
    } else if (t2Dismissed) {
      if (score > t2DismissScore + 0.15) {
        plan.offer = "tier2";
        plan.reason = `Difficulty score rose above previous dismissal baseline`;
      }
    } else {
      plan.offer = "tier2";
      plan.reason = `Reading difficulty detected (Score: ${Math.round(score * 100)}%)`;
    }
  }

  if (targetTier >= 3) {
    if (t3Accepted) {
      plan.apply.push("vocabulary_tooltips", "text_simplification", "text_to_speech");
      if (history["tier2"] && history["tier2"].lastAction !== "dismissed") {
        plan.apply.push("reading_ruler", "paragraph_chunking", "focus_mode");
      }
    } else if (t3Dismissed) {
      if (score > t3DismissScore + 0.15) {
        plan.offer = "tier3";
        plan.reason = `Reading friction reached high levels`;
      }
    } else {
      plan.offer = "tier3";
      plan.reason = `High reading difficulty detected (Score: ${Math.round(score * 100)}%)`;
    }
  }

  return plan;
}

// ─── TESTS ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

console.log("\n📊 === DysAssist Difficulty Scorer Tests ===\n");

// ─── SECTION 1: computeDifficultyScore ─────────────────────────────────────
console.log("  ── computeDifficultyScore ──");

test("fluent reader (high WPM, no regressions) should score near 0", () => {
  const score = computeDifficultyScore({
    readingSpeedWpm: 250,
    regressionRate: 0,
    hoverDwellSpikes: 0,
    copyLookupFrequency: 0,
    paragraphCompletionRate: 1.0,
    vocabularyDifficultyIndex: 0.02,
  });
  assert.ok(score < 0.15, `Expected score < 0.15, got ${score}`);
});

test("struggling reader (low WPM, high regressions) should score >= 0.5", () => {
  const score = computeDifficultyScore({
    readingSpeedWpm: 80,
    regressionRate: 5,
    hoverDwellSpikes: 2,
    copyLookupFrequency: 2,
    paragraphCompletionRate: 0.4,
    vocabularyDifficultyIndex: 0.25,
  });
  assert.ok(score >= 0.5, `Expected score >= 0.5, got ${score}`);
});

test("crisis-level reader should score >= 0.7", () => {
  const score = computeDifficultyScore({
    readingSpeedWpm: 50,
    regressionRate: 8,
    hoverDwellSpikes: 4,
    copyLookupFrequency: 5,
    paragraphCompletionRate: 0.1,
    vocabularyDifficultyIndex: 0.45,
  });
  assert.ok(score >= 0.7, `Expected score >= 0.7, got ${score}`);
});

test("score clamps to [0,1]", () => {
  const lowScore = computeDifficultyScore({
    readingSpeedWpm: 500,
    regressionRate: 0,
    hoverDwellSpikes: 0,
    copyLookupFrequency: 0,
    paragraphCompletionRate: 1.0,
    vocabularyDifficultyIndex: 0,
  });
  const highScore = computeDifficultyScore({
    readingSpeedWpm: 0,
    regressionRate: 20,
    hoverDwellSpikes: 10,
    copyLookupFrequency: 10,
    paragraphCompletionRate: 0,
    vocabularyDifficultyIndex: 1.0,
  });
  assert.ok(lowScore >= 0 && lowScore <= 1, `Low score out of range: ${lowScore}`);
  assert.ok(highScore >= 0 && highScore <= 1, `High score out of range: ${highScore}`);
});

test("WPM = 200 yields 0 contribution from WPM", () => {
  const s1 = computeDifficultyScore({ readingSpeedWpm: 200, regressionRate: 0, hoverDwellSpikes: 0, copyLookupFrequency: 0, paragraphCompletionRate: 1.0, vocabularyDifficultyIndex: 0.05 });
  const s2 = computeDifficultyScore({ readingSpeedWpm: 201, regressionRate: 0, hoverDwellSpikes: 0, copyLookupFrequency: 0, paragraphCompletionRate: 1.0, vocabularyDifficultyIndex: 0.05 });
  assert.strictEqual(s1, s2, "WPM >= 200 should produce same score");
});

test("vocab index just above 0.30 should yield full vocab sub-score", () => {
  const score = computeDifficultyScore({ readingSpeedWpm: 200, regressionRate: 1, hoverDwellSpikes: 0, copyLookupFrequency: 0, paragraphCompletionRate: 1.0, vocabularyDifficultyIndex: 0.31 });
  assert.ok(score >= 0.09, `Vocab contribution expected, got ${score}`);
});

// ─── SECTION 2: EWMA ────────────────────────────────────────────────────────
console.log("\n  ── EWMA Score Smoothing ──");

test("EWMA with same session and historical score should return same value", () => {
  const result = applyEWMA(0.5, 0.5);
  assert.strictEqual(result, 0.5);
});

test("EWMA gives more weight to history (alpha=0.3)", () => {
  const result = applyEWMA(1.0, 0.0, 0.3);
  assert.strictEqual(result, 0.3, `Expected 0.3, got ${result}`);
});

test("EWMA smooths sudden spike upward", () => {
  let score = 0.2;
  // User suddenly goes to a hard page
  for (let i = 0; i < 5; i++) score = applyEWMA(0.9, score);
  assert.ok(score < 0.9, `EWMA should be below spike value, got ${score}`);
  assert.ok(score > 0.5, `EWMA should have risen significantly, got ${score}`);
});

test("EWMA smooths sudden drop downward", () => {
  let score = 0.8;
  // User suddenly goes to an easy page
  for (let i = 0; i < 5; i++) score = applyEWMA(0.1, score);
  assert.ok(score > 0.1, `EWMA should be above easy value, got ${score}`);
  assert.ok(score < 0.6, `EWMA should have dropped significantly, got ${score}`);
});

// ─── SECTION 3: runDecisionAgent ────────────────────────────────────────────
console.log("\n  ── Decision Agent ──");

const baseProfile = {
  mode: "fully_passive",
  difficultyScore: 0.5,
  domainSettings: [],
  interventionHistory: {},
  domainStats: {},
};

test("score < 0.3 → no interventions offered or applied", () => {
  const plan = runDecisionAgent(baseProfile, 0.2, "example.com");
  assert.deepStrictEqual(plan.apply, [], `Expected empty apply, got ${JSON.stringify(plan.apply)}`);
  assert.strictEqual(plan.offer, null);
});

test("score 0.3–0.5 → only Tier 1 typography applied, no offer", () => {
  const plan = runDecisionAgent(baseProfile, 0.35, "example.com");
  assert.ok(plan.apply.includes("font_switch"), "Expected font_switch");
  assert.strictEqual(plan.offer, null, "Should not offer anything yet");
});

test("score 0.5–0.7 → Tier 1 applied + Tier 2 offered", () => {
  const plan = runDecisionAgent(baseProfile, 0.55, "example.com");
  assert.ok(plan.apply.includes("font_switch"), "Expected font_switch");
  assert.strictEqual(plan.offer, "tier2");
});

test("score >= 0.7 → Tier 1 applied + Tier 3 offered", () => {
  const plan = runDecisionAgent(baseProfile, 0.75, "example.com");
  assert.ok(plan.apply.includes("font_switch"), "Expected font_switch");
  assert.strictEqual(plan.offer, "tier3");
});

test("declared_dyslexic → Tier 1 applied proactively at score 0.1", () => {
  const dyslexicProfile = { ...baseProfile, mode: "declared_dyslexic" };
  const plan = runDecisionAgent(dyslexicProfile, 0.1, "example.com");
  assert.ok(plan.apply.includes("font_switch"), "Expected proactive font_switch for dyslexic");
  assert.strictEqual(plan.offer, null);
});

test("paused domain → no interventions", () => {
  const pausedProfile = {
    ...baseProfile,
    domainSettings: [{ domain: "example.com", paused: true }],
  };
  const plan = runDecisionAgent(pausedProfile, 0.9, "example.com");
  assert.strictEqual(plan.paused, true);
  assert.deepStrictEqual(plan.apply, []);
  assert.strictEqual(plan.offer, null);
});

test("Tier 2 previously accepted → applied silently at score >= 0.5", () => {
  const acceptedProfile = {
    ...baseProfile,
    interventionHistory: {
      tier2: { lastAction: "accepted", difficultyScoreAtTime: 0.55, weight: 0.6, level: 2 }
    },
  };
  const plan = runDecisionAgent(acceptedProfile, 0.6, "example.com");
  assert.ok(plan.apply.includes("reading_ruler"), "Expected reading_ruler for previously accepted Tier 2");
  assert.strictEqual(plan.offer, null, "Should not offer Tier 2 if already accepted");
});

test("Tier 2 previously dismissed → not re-offered until +0.15 above dismissal", () => {
  const dismissedProfile = {
    ...baseProfile,
    interventionHistory: {
      tier2: { lastAction: "dismissed", difficultyScoreAtTime: 0.50, weight: 0.4, level: 2 }
    },
  };
  // Score at 0.55 = only +0.05 above dismissal → should NOT re-offer
  const plan1 = runDecisionAgent(dismissedProfile, 0.55, "example.com");
  assert.strictEqual(plan1.offer, null, `Should not offer Tier 2 at 0.55 (dismissed at 0.50)`);

  // Score at 0.67 = +0.17 above dismissal (still in Tier 2 range < 0.7) → should re-offer
  const plan2 = runDecisionAgent(dismissedProfile, 0.67, "example.com");
  assert.strictEqual(plan2.offer, "tier2", `Should offer Tier 2 at 0.67 (dismissed at 0.50, threshold +0.15 = 0.65)`);
});

test("low sensitivity domain raises thresholds", () => {
  const lowSensProfile = {
    ...baseProfile,
    domainSettings: [{ domain: "twitter.com", paused: false, sensitivityOverride: 0.2 }],
  };
  // Score 0.35 would normally trigger Tier 1, but with low sensitivity T1=0.45 → no intervention
  const plan = runDecisionAgent(lowSensProfile, 0.35, "twitter.com");
  assert.deepStrictEqual(plan.apply, [], `Low sensitivity should suppress Tier 1 at score 0.35`);
});

test("high sensitivity domain lowers thresholds", () => {
  const highSensProfile = {
    ...baseProfile,
    domainSettings: [{ domain: "arxiv.org", paused: false, sensitivityOverride: 0.9 }],
  };
  // Score 0.2 would normally not trigger anything, but with high sensitivity T1=0.15 → Tier 1
  const plan = runDecisionAgent(highSensProfile, 0.20, "arxiv.org");
  assert.ok(plan.apply.includes("font_switch"), `High sensitivity should apply Tier 1 at score 0.20`);
});

test("domain with 2+ visits and avg >= 0.5 triggers proactive Tier 1", () => {
  const difficultDomainProfile = {
    ...baseProfile,
    domainStats: {
      "arxiv.org": { visits: 3, avgDifficultyScore: 0.62 }
    },
  };
  const plan = runDecisionAgent(difficultDomainProfile, 0.15, "arxiv.org");
  assert.ok(plan.apply.includes("font_switch"), `Difficult domain should apply Tier 1 proactively`);
});

// ─── RESULTS ───────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exitCode = 1;
}
