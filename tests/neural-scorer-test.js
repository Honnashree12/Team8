/**
 * DysAssist — Neural Scorer Tests (Week 4)
 * Tests the pure-JS 2-layer MLP scorer and its online SGD update step.
 * Run with: node tests/neural-scorer-test.js
 */

const assert = require("assert");

// ─── Inline neural scorer from background.js ───────────────────────────────

const NEURAL_INPUTS = 6;
const NEURAL_HIDDEN = 8;
const NEURAL_LR     = 0.01;
const MIN_TRAINING_EX = 5;

function getDefaultNeuralWeights() {
  const W1 = Array.from({ length: NEURAL_INPUTS }, (_, i) =>
    Array.from({ length: NEURAL_HIDDEN }, (_, j) => (i === j ? 1.0 : 0.0))
  );
  const b1 = new Array(NEURAL_HIDDEN).fill(0.0);
  const W2 = [0.35, 0.25, 0.15, 0.10, 0.10, 0.05, 0.0, 0.0];
  const b2 = 0.0;
  return { W1, b1, W2, b2, version: 1, trainingExamples: 0 };
}

function featuresToInputVector(features) {
  return [
    Math.max(0, Math.min(1, (200 - (features.readingSpeedWpm    || 0)) / 140)),
    Math.max(0, Math.min(1, ((features.regressionRate           || 0) - 1.0) / 3.0)),
    Math.max(0, Math.min(1,  (features.hoverDwellSpikes         || 0) / 3)),
    Math.max(0, Math.min(1,  (features.copyLookupFrequency      || 0) / 3)),
    Math.max(0, Math.min(1, ((features.vocabularyDifficultyIndex|| 0) - 0.05) / 0.25)),
    Math.max(0, Math.min(1,   1.0 - (features.paragraphCompletionRate ?? 1.0))),
  ];
}

function runNeuralScorer(features, weights) {
  const x = featuresToInputVector(features);
  const h = Array.from({ length: NEURAL_HIDDEN }, (_, j) => {
    let z = weights.b1[j];
    for (let i = 0; i < NEURAL_INPUTS; i++) z += weights.W1[i][j] * x[i];
    return Math.max(0, z);
  });
  let y = weights.b2;
  for (let j = 0; j < NEURAL_HIDDEN; j++) y += weights.W2[j] * h[j];
  return parseFloat(Math.max(0, Math.min(1, y)).toFixed(3));
}

// Rule-based scorer (Week 3 reference implementation)
function computeDifficultyScore(features) {
  const wpm    = features.readingSpeedWpm    || 0;
  const reg    = features.regressionRate     || 0;
  const hover  = features.hoverDwellSpikes   || 0;
  const lookup = features.copyLookupFrequency|| 0;
  const comp   = features.paragraphCompletionRate !== undefined ? features.paragraphCompletionRate : 1.0;
  const vocab  = features.vocabularyDifficultyIndex || 0;
  const s_wpm    = Math.max(0, Math.min(1, (200 - wpm)  / 140));
  const s_reg    = Math.max(0, Math.min(1, (reg - 1.0)  / 3.0));
  const s_hover  = Math.max(0, Math.min(1, hover / 3));
  const s_lookup = Math.max(0, Math.min(1, lookup / 3));
  const s_comp   = Math.max(0, Math.min(1, 1.0 - comp));
  const s_vocab  = Math.max(0, Math.min(1, (vocab - 0.05) / 0.25));
  return parseFloat(((s_wpm * 0.35) + (s_reg * 0.25) + (s_hover * 0.15) + (s_lookup * 0.10) + (s_vocab * 0.10) + (s_comp * 0.05)).toFixed(3));
}

function neuralScorerStep(features, targetScore, weights) {
  const x = featuresToInputVector(features);
  const h = Array.from({ length: NEURAL_HIDDEN }, (_, j) => {
    let z = weights.b1[j];
    for (let i = 0; i < NEURAL_INPUTS; i++) z += weights.W1[i][j] * x[i];
    return Math.max(0, z);
  });
  let y = weights.b2;
  for (let j = 0; j < NEURAL_HIDDEN; j++) y += weights.W2[j] * h[j];
  y = Math.max(0, Math.min(1, y));
  const err = y - targetScore;
  const newW2 = weights.W2.map((w, j) => w - NEURAL_LR * err * h[j]);
  const newB2 = weights.b2 - NEURAL_LR * err;
  const newW1 = weights.W1.map((row, i) =>
    row.map((w, j) => {
      const rg = h[j] > 0 ? 1 : 0;
      return w - NEURAL_LR * err * weights.W2[j] * rg * x[i];
    })
  );
  const newB1 = weights.b1.map((b, j) => {
    const rg = h[j] > 0 ? 1 : 0;
    return b - NEURAL_LR * err * weights.W2[j] * rg;
  });
  return {
    ...weights,
    W1: newW1, b1: newB1,
    W2: newW2, b2: newB2,
    trainingExamples: (weights.trainingExamples || 0) + 1,
  };
}

// ─── Test runner ────────────────────────────────────────────────────────────

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

const FLUENT   = { readingSpeedWpm: 250, regressionRate: 0.5, hoverDwellSpikes: 0, copyLookupFrequency: 0, paragraphCompletionRate: 1.0, vocabularyDifficultyIndex: 0.03 };
const MODERATE = { readingSpeedWpm: 140, regressionRate: 2.0, hoverDwellSpikes: 1, copyLookupFrequency: 1, paragraphCompletionRate: 0.7, vocabularyDifficultyIndex: 0.12 };
const HARD     = { readingSpeedWpm: 75,  regressionRate: 5.0, hoverDwellSpikes: 3, copyLookupFrequency: 3, paragraphCompletionRate: 0.3, vocabularyDifficultyIndex: 0.35 };
const CRISIS   = { readingSpeedWpm: 45,  regressionRate: 8.0, hoverDwellSpikes: 4, copyLookupFrequency: 5, paragraphCompletionRate: 0.1, vocabularyDifficultyIndex: 0.50 };

console.log("\n🧠 === DysAssist Neural Scorer Tests ===\n");

// ─── SECTION 1: Default weights match rule-based scorer ─────────────────────
console.log("  ── Pre-seeded weights: neural ≡ rule-based ──");

for (const [label, fv] of [["fluent", FLUENT], ["moderate", MODERATE], ["hard", HARD], ["crisis", CRISIS]]) {
  test(`${label} reader: neural score ≈ rule-based score (within 0.001)`, () => {
    const weights = getDefaultNeuralWeights();
    const neural   = runNeuralScorer(fv, weights);
    const ruleBased = computeDifficultyScore(fv);
    const diff = Math.abs(neural - ruleBased);
    assert.ok(diff <= 0.001,
      `Neural (${neural}) diverges from rule-based (${ruleBased}) by ${diff.toFixed(4)}`
    );
  });
}

// ─── SECTION 2: Output is always in [0, 1] ──────────────────────────────────
console.log("\n  ── Output bounds ──");

test("output clamps at 0 for zero-difficulty features", () => {
  const w = getDefaultNeuralWeights();
  const score = runNeuralScorer({ readingSpeedWpm: 500, regressionRate: 0, hoverDwellSpikes: 0, copyLookupFrequency: 0, paragraphCompletionRate: 1.0, vocabularyDifficultyIndex: 0 }, w);
  assert.ok(score >= 0 && score <= 1, `Score out of range: ${score}`);
});

test("output clamps at ≤ 1 for crisis-level features", () => {
  const w = getDefaultNeuralWeights();
  const score = runNeuralScorer(CRISIS, w);
  assert.ok(score <= 1.0, `Score exceeded 1.0: ${score}`);
});

// ─── SECTION 3: SGD step reduces loss ───────────────────────────────────────
console.log("\n  ── SGD step: loss reduction ──");

test("one gradient step moves output closer to target (accept: confirm)", () => {
  const weights = getDefaultNeuralWeights();
  const fv = HARD;
  const currentScore = runNeuralScorer(fv, weights);
  const targetScore  = currentScore; // accept → confirm current estimate
  const updated = neuralScorerStep(fv, targetScore, weights);
  const newScore = runNeuralScorer(fv, updated);
  // After confirming, the loss should be near-zero (output stays at current)
  const before = Math.abs(currentScore - targetScore);
  const after  = Math.abs(newScore - targetScore);
  assert.ok(after <= before + 0.001, `Loss increased after confirm step: before=${before}, after=${after}`);
});

test("one gradient step moves output down when dismiss (over-estimated)", () => {
  const weights = getDefaultNeuralWeights();
  const fv = HARD;
  const currentScore = runNeuralScorer(fv, weights);
  const targetScore  = Math.max(0, currentScore - 0.20); // dismiss → reduce
  const updated = neuralScorerStep(fv, targetScore, weights);
  const newScore = runNeuralScorer(fv, updated);
  assert.ok(newScore < currentScore + 0.001,
    `Expected score to decrease/hold after dismiss step, but went up: ${currentScore} → ${newScore}`
  );
});

test("trainingExamples increments with each step", () => {
  let w = getDefaultNeuralWeights();
  assert.strictEqual(w.trainingExamples, 0);
  w = neuralScorerStep(HARD, 0.5, w);
  assert.strictEqual(w.trainingExamples, 1);
  w = neuralScorerStep(MODERATE, 0.3, w);
  assert.strictEqual(w.trainingExamples, 2);
});

// ─── SECTION 4: Personalisation over time ───────────────────────────────────
console.log("\n  ── Personalisation over multiple steps ──");

test("10 steps toward lower target: scorer learns to score HARD lower", () => {
  let weights = getDefaultNeuralWeights();
  const fv = HARD;
  const initialScore = runNeuralScorer(fv, weights);
  const targetScore  = Math.max(0, initialScore - 0.20); // user dismissed repeatedly

  for (let i = 0; i < 10; i++) {
    weights = neuralScorerStep(fv, targetScore, weights);
  }
  const finalScore = runNeuralScorer(fv, weights);
  assert.ok(finalScore < initialScore,
    `After 10 dismiss-steps, score should be lower than initial (${initialScore}). Got ${finalScore}`
  );
});

test("10 steps toward higher target: scorer learns to score MODERATE higher", () => {
  let weights = getDefaultNeuralWeights();
  const fv = MODERATE;
  const initialScore = runNeuralScorer(fv, weights);
  const targetScore  = Math.min(1, initialScore + 0.25); // user accepted happily

  for (let i = 0; i < 10; i++) {
    weights = neuralScorerStep(fv, targetScore, weights);
  }
  const finalScore = runNeuralScorer(fv, weights);
  assert.ok(finalScore > initialScore,
    `After 10 accept-steps, score should be higher than initial (${initialScore}). Got ${finalScore}`
  );
});

test("after personalisation, untrained features still produce reasonable output", () => {
  let weights = getDefaultNeuralWeights();
  // Train heavily on HARD features
  for (let i = 0; i < 20; i++) {
    weights = neuralScorerStep(HARD, 0.3, weights); // dismiss many times
  }
  // Fluent features should still produce a low score
  const fluent = runNeuralScorer(FLUENT, weights);
  const hard   = runNeuralScorer(HARD, weights);
  assert.ok(fluent < hard, `Fluent (${fluent}) should score lower than hard (${hard}) after training`);
});

// ─── SECTION 5: featuresToInputVector ───────────────────────────────────────
console.log("\n  ── featuresToInputVector ──");

test("all inputs clamped to [0, 1]", () => {
  const extreme = {
    readingSpeedWpm: 0, regressionRate: 100, hoverDwellSpikes: 100,
    copyLookupFrequency: 100, paragraphCompletionRate: 0, vocabularyDifficultyIndex: 100
  };
  const v = featuresToInputVector(extreme);
  v.forEach((val, i) => {
    assert.ok(val >= 0 && val <= 1, `Input ${i} out of range: ${val}`);
  });
});

test("default/easy features produce small sub-scores", () => {
  const v = featuresToInputVector({ readingSpeedWpm: 220, regressionRate: 0.5, hoverDwellSpikes: 0, copyLookupFrequency: 0, paragraphCompletionRate: 1.0, vocabularyDifficultyIndex: 0.02 });
  v.forEach((val, i) => {
    assert.ok(val < 0.1, `Sub-score ${i} should be near 0 for easy features, got ${val}`);
  });
});

// ─── RESULTS ────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exitCode = 1;
