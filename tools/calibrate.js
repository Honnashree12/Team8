#!/usr/bin/env node
// tools/calibrate.js
// Calibrates the 0.3 / 0.5 / 0.7 tier thresholds on synthetic reading pages
// (Week 3 deliverable). Run: `node tools/calibrate.js`
//
// Each synthetic page is a FeatureVector representing how a reader behaved on a
// page of known difficulty. We score it with the real engine and check the tier
// it lands in against the intended tier — this is how we picked/validated the
// cut-points documented in docs/DECISION_LOG.md.

const AE = require("../adaptiveEngine.js");

// domain left as "general" so no per-domain sensitivity skews calibration.
const SYNTHETIC_PAGES = [
  {
    name: "Children's blog (very easy)",
    expectedTier: 0,
    fv: { readingSpeedWPM: 250, regressionRate: 0.1, copyLookupFrequency: 0, paragraphCompletionRate: 1.0, vocabularyDifficultyIndex: 0.04 },
  },
  {
    name: "Casual recipe page (easy)",
    expectedTier: 0,
    fv: { readingSpeedWPM: 225, regressionRate: 0.6, copyLookupFrequency: 0.3, paragraphCompletionRate: 0.92, vocabularyDifficultyIndex: 0.12 },
  },
  {
    name: "General news article (mild struggle)",
    expectedTier: 1,
    fv: { readingSpeedWPM: 160, regressionRate: 2.0, copyLookupFrequency: 1.0, paragraphCompletionRate: 0.8, vocabularyDifficultyIndex: 0.28 },
  },
  {
    name: "Long-form opinion essay (moderate)",
    expectedTier: 2,
    fv: { readingSpeedWPM: 135, regressionRate: 3.2, copyLookupFrequency: 2.0, paragraphCompletionRate: 0.65, vocabularyDifficultyIndex: 0.38 },
  },
  {
    name: "Academic abstract (hard)",
    expectedTier: 3,
    fv: { readingSpeedWPM: 100, regressionRate: 4.5, copyLookupFrequency: 3.2, paragraphCompletionRate: 0.5, vocabularyDifficultyIndex: 0.55 },
  },
  {
    name: "Dense legal / medical text (very hard)",
    expectedTier: 3,
    fv: { readingSpeedWPM: 90, regressionRate: 4.9, copyLookupFrequency: 3.8, paragraphCompletionRate: 0.35, vocabularyDifficultyIndex: 0.62 },
  },
];

function tierOf(score) {
  const t = AE.DECISION_THRESHOLDS;
  if (score >= t.tier3) return 3;
  if (score >= t.tier2) return 2;
  if (score >= t.tier1) return 1;
  return 0;
}

const t = AE.DECISION_THRESHOLDS;
console.log("\nDysAssist threshold calibration (general domain, no sensitivity)");
console.log("Thresholds:  tier1 >= " + t.tier1 + "   tier2 >= " + t.tier2 + "   tier3 >= " + t.tier3 + "\n");
console.log("page".padEnd(40) + "score   tier  expected  " + "ok");
console.log("-".repeat(72));

let pass = 0;
for (const page of SYNTHETIC_PAGES) {
  const score = AE.scoreFeatures(page.fv);
  const tier = tierOf(score);
  const ok = tier === page.expectedTier;
  if (ok) pass++;
  console.log(
    page.name.padEnd(40) +
      score.toFixed(3).padEnd(8) +
      String(tier).padEnd(6) +
      String(page.expectedTier).padEnd(10) +
      (ok ? "✓" : "✗")
  );
}

console.log("-".repeat(72));
console.log(`Calibration: ${pass}/${SYNTHETIC_PAGES.length} synthetic pages land in the intended tier.\n`);

// Show the top driver for the hardest page, to demonstrate interpretability.
const hardest = SYNTHETIC_PAGES[SYNTHETIC_PAGES.length - 1];
console.log(`Why "${hardest.name}" scores high (top signals):`);
AE.explainScore(hardest.fv).slice(0, 3).forEach((c) => {
  console.log(
    "  - " + c.signal.padEnd(26) +
      "normalized " + c.normalized.toFixed(2) +
      "  × weight " + c.weight.toFixed(2) +
      "  = " + c.contribution.toFixed(3)
  );
});
console.log("");

process.exit(pass === SYNTHETIC_PAGES.length ? 0 : 1);
