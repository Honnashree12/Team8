/**
 * DysAssist — Feedback Weighting & Per-Domain Learning Tests (Week 4)
 * Run with: node tests/feedback-weighting-test.js
 */

const assert = require("assert");

// ─── Inline Week 4 logic from background.js ────────────────────────────────

const DOMAIN_CLASSIFY_MIN_VISITS = 3;
const DOMAIN_ACCEPT_RATE_HIGH    = 0.60;
const DOMAIN_DISMISS_RATE_HIGH   = 0.60;
const DOMAIN_SCORE_THRESHOLD     = 0.55;

function processFeedback(profile, tier, action, domain, score, quickDismiss = false) {
  if (!profile) return profile;
  if (!profile.interventionHistory) profile.interventionHistory = {};
  if (!profile.domainSettings)      profile.domainSettings      = [];
  if (!profile.domainStats)         profile.domainStats         = {};

  const now = Date.now();
  const existing = profile.interventionHistory[tier] ?? {
    level: tier === "tier3" ? 3 : tier === "tier2" ? 2 : 1,
    lastOffered: now,
    lastAction: null,
    weight: 0.5,
    acceptCount:  0,
    dismissCount: 0,
    ignoreCount:  0,
    quickDismissCount: 0,
    difficultyScoreAtTime: score,
  };

  let weight       = existing.weight       ?? 0.5;
  let acceptCount  = existing.acceptCount  ?? 0;
  let dismissCount = existing.dismissCount ?? 0;
  let ignoreCount  = existing.ignoreCount  ?? 0;
  let qdCount      = existing.quickDismissCount ?? 0;

  if (action === "accepted") {
    weight = Math.min(1.0, weight + 0.15);
    acceptCount++;
  } else if (action === "dismissed") {
    weight = Math.max(0.0, weight - 0.15);
    if (quickDismiss) weight = Math.min(1.0, weight + 0.05);
    dismissCount++;
    if (quickDismiss) qdCount++;
  } else if (action === "ignored") {
    weight = Math.max(0.0, weight - 0.05);
    ignoreCount++;
  }

  profile.interventionHistory[tier] = {
    ...existing,
    lastAction:  action,
    lastOffered: now,
    weight,
    acceptCount,
    dismissCount,
    ignoreCount,
    quickDismissCount: qdCount,
    difficultyScoreAtTime: action === "dismissed"
      ? score
      : existing.difficultyScoreAtTime,
  };

  const stats = profile.domainStats[domain];
  if (stats) {
    stats.interventionsOffered  = (stats.interventionsOffered  ?? 0) + 1;
    if (action === "accepted") {
      stats.interventionsAccepted = (stats.interventionsAccepted ?? 0) + 1;
    }
    profile.domainStats[domain] = stats;
  }

  profile.updatedAt = new Date().toISOString();
  return profile;
}

function autoClassifyDomain(profile, domain) {
  const stats = profile.domainStats?.[domain];
  if (!stats || stats.visits < DOMAIN_CLASSIFY_MIN_VISITS) return profile;

  const offered  = stats.interventionsOffered  ?? 0;
  const accepted = stats.interventionsAccepted ?? 0;
  if (offered === 0) return profile;

  const acceptRate  = accepted / offered;
  const dismissRate = (offered - accepted) / offered;
  const avgScore    = stats.avgDifficultyScore ?? 0;

  let newSensitivity;
  if (acceptRate >= DOMAIN_ACCEPT_RATE_HIGH && avgScore >= DOMAIN_SCORE_THRESHOLD) {
    newSensitivity = 0.8;
  } else if (dismissRate >= DOMAIN_DISMISS_RATE_HIGH) {
    newSensitivity = 0.2;
  }

  if (newSensitivity !== undefined) {
    const existing = (profile.domainSettings ?? []).find(d => d.domain === domain);
    if (existing) {
      existing.sensitivityOverride = newSensitivity;
    } else {
      profile.domainSettings.push({ domain, paused: false, sensitivityOverride: newSensitivity });
    }
  }
  return profile;
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

function makeProfile(overrides = {}) {
  return {
    mode: "fully_passive",
    difficultyScore: 0.5,
    interventionHistory: {},
    domainSettings: [],
    domainStats: {},
    ...overrides,
  };
}

console.log("\n🔁 === DysAssist Feedback Weighting Tests ===\n");

// ─── SECTION 1: processFeedback — weight arithmetic ─────────────────────────
console.log("  ── Weight arithmetic ──");

test("accept raises weight by 0.15", () => {
  const p = makeProfile();
  const updated = processFeedback(p, "tier2", "accepted", "example.com", 0.6);
  const w = updated.interventionHistory["tier2"].weight;
  assert.strictEqual(w, 0.65, `Expected 0.65, got ${w}`);
});

test("dismiss lowers weight by 0.15", () => {
  const p = makeProfile();
  const updated = processFeedback(p, "tier2", "dismissed", "example.com", 0.6);
  const w = updated.interventionHistory["tier2"].weight;
  assert.strictEqual(w, 0.35, `Expected 0.35, got ${w}`);
});

test("ignore lowers weight by 0.05 only", () => {
  const p = makeProfile();
  const updated = processFeedback(p, "tier2", "ignored", "example.com", 0.6);
  const w = updated.interventionHistory["tier2"].weight;
  assert.strictEqual(w, 0.45, `Expected 0.45, got ${w}`);
});

test("quick dismiss partially restores weight (+0.05 on top of -0.15 = net -0.10)", () => {
  const p = makeProfile();
  const updated = processFeedback(p, "tier2", "dismissed", "example.com", 0.6, true);
  const w = parseFloat(updated.interventionHistory["tier2"].weight.toFixed(2));
  assert.strictEqual(w, 0.40, `Expected 0.40 (net -0.10), got ${w}`);
});

test("weight clamps at 1.0 on multiple accepts", () => {
  let p = makeProfile();
  for (let i = 0; i < 10; i++) {
    p = processFeedback(p, "tier2", "accepted", "example.com", 0.6);
  }
  const w = p.interventionHistory["tier2"].weight;
  assert.ok(w <= 1.0, `Weight exceeded 1.0: ${w}`);
  assert.strictEqual(w, 1.0);
});

test("weight clamps at 0.0 on multiple dismissals", () => {
  let p = makeProfile();
  for (let i = 0; i < 10; i++) {
    p = processFeedback(p, "tier2", "dismissed", "example.com", 0.6);
  }
  const w = p.interventionHistory["tier2"].weight;
  assert.ok(w >= 0.0, `Weight went below 0: ${w}`);
  assert.strictEqual(w, 0.0);
});

// ─── SECTION 2: processFeedback — counters ──────────────────────────────────
console.log("\n  ── Counters ──");

test("acceptCount increments on accept", () => {
  let p = makeProfile();
  p = processFeedback(p, "tier2", "accepted", "example.com", 0.6);
  p = processFeedback(p, "tier2", "accepted", "example.com", 0.6);
  assert.strictEqual(p.interventionHistory["tier2"].acceptCount, 2);
});

test("dismissCount increments on dismiss", () => {
  let p = makeProfile();
  p = processFeedback(p, "tier2", "dismissed", "example.com", 0.6);
  assert.strictEqual(p.interventionHistory["tier2"].dismissCount, 1);
});

test("ignoreCount increments on ignore", () => {
  let p = makeProfile();
  p = processFeedback(p, "tier2", "ignored", "example.com", 0.6);
  assert.strictEqual(p.interventionHistory["tier2"].ignoreCount, 1);
});

test("quickDismissCount increments only on quickDismiss=true", () => {
  let p = makeProfile();
  p = processFeedback(p, "tier2", "dismissed", "example.com", 0.6, false);
  p = processFeedback(p, "tier2", "dismissed", "example.com", 0.6, true);
  assert.strictEqual(p.interventionHistory["tier2"].quickDismissCount, 1, `Expected 1 quick dismiss`);
  assert.strictEqual(p.interventionHistory["tier2"].dismissCount, 2, `Expected 2 total dismissals`);
});

// ─── SECTION 3: processFeedback — difficultyScoreAtTime ─────────────────────
console.log("\n  ── difficultyScoreAtTime ──");

test("difficultyScoreAtTime saved on dismiss", () => {
  const p = makeProfile({ difficultyScore: 0.62 });
  const updated = processFeedback(p, "tier2", "dismissed", "example.com", 0.62);
  assert.strictEqual(updated.interventionHistory["tier2"].difficultyScoreAtTime, 0.62);
});

test("difficultyScoreAtTime NOT overwritten on accept", () => {
  let p = makeProfile({ difficultyScore: 0.55 });
  p = processFeedback(p, "tier2", "dismissed", "example.com", 0.55); // dismiss first, saves 0.55
  p.difficultyScore = 0.72;
  p = processFeedback(p, "tier2", "accepted", "example.com", 0.72); // accept should not overwrite
  assert.strictEqual(p.interventionHistory["tier2"].difficultyScoreAtTime, 0.55,
    "Accept should NOT overwrite the dismissal baseline");
});

// ─── SECTION 4: processFeedback — domain stat counters ──────────────────────
console.log("\n  ── Domain stat counters ──");

test("interventionsOffered increments for every feedback call", () => {
  const p = makeProfile({
    domainStats: { "arxiv.org": { visits: 5, interventionsOffered: 2, interventionsAccepted: 1, avgDifficultyScore: 0.6 } }
  });
  const updated = processFeedback(p, "tier2", "accepted", "arxiv.org", 0.6);
  assert.strictEqual(updated.domainStats["arxiv.org"].interventionsOffered, 3);
  assert.strictEqual(updated.domainStats["arxiv.org"].interventionsAccepted, 2);
});

test("interventionsAccepted does NOT increment on dismiss", () => {
  const p = makeProfile({
    domainStats: { "twitter.com": { visits: 3, interventionsOffered: 1, interventionsAccepted: 0, avgDifficultyScore: 0.3 } }
  });
  const updated = processFeedback(p, "tier2", "dismissed", "twitter.com", 0.3);
  assert.strictEqual(updated.domainStats["twitter.com"].interventionsAccepted, 0);
  assert.strictEqual(updated.domainStats["twitter.com"].interventionsOffered, 2);
});

// ─── SECTION 5: autoClassifyDomain ──────────────────────────────────────────
console.log("\n  ── autoClassifyDomain ──");

test("academic domain (high acceptRate + high avgScore) → sensitivityOverride = 0.8", () => {
  const p = makeProfile({
    domainStats: {
      "arxiv.org": { visits: 4, avgDifficultyScore: 0.68, interventionsOffered: 5, interventionsAccepted: 4 }
    }
  });
  const updated = autoClassifyDomain(p, "arxiv.org");
  const setting = updated.domainSettings.find(d => d.domain === "arxiv.org");
  assert.ok(setting, "Expected domainSettings entry for arxiv.org");
  assert.strictEqual(setting.sensitivityOverride, 0.8);
});

test("casual domain (high dismissRate) → sensitivityOverride = 0.2", () => {
  const p = makeProfile({
    domainStats: {
      "twitter.com": { visits: 5, avgDifficultyScore: 0.3, interventionsOffered: 5, interventionsAccepted: 1 }
    }
  });
  const updated = autoClassifyDomain(p, "twitter.com");
  const setting = updated.domainSettings.find(d => d.domain === "twitter.com");
  assert.ok(setting, "Expected domainSettings entry for twitter.com");
  assert.strictEqual(setting.sensitivityOverride, 0.2);
});

test("ambiguous domain (moderate acceptance) → no override set", () => {
  const p = makeProfile({
    domainStats: {
      "medium.com": { visits: 4, avgDifficultyScore: 0.4, interventionsOffered: 4, interventionsAccepted: 2 }
    }
  });
  const updated = autoClassifyDomain(p, "medium.com");
  const setting = updated.domainSettings.find(d => d.domain === "medium.com");
  assert.ok(!setting, "No sensitivityOverride should be set for ambiguous domain");
});

test("domain with < 3 visits is not classified", () => {
  const p = makeProfile({
    domainStats: {
      "newsite.com": { visits: 2, avgDifficultyScore: 0.8, interventionsOffered: 5, interventionsAccepted: 5 }
    }
  });
  const updated = autoClassifyDomain(p, "newsite.com");
  const setting = updated.domainSettings.find(d => d.domain === "newsite.com");
  assert.ok(!setting, "Domain with < 3 visits should not be auto-classified");
});

test("existing domainSettings entry is updated, not duplicated", () => {
  const p = makeProfile({
    domainSettings: [{ domain: "arxiv.org", paused: false, sensitivityOverride: 0.5 }],
    domainStats: {
      "arxiv.org": { visits: 5, avgDifficultyScore: 0.7, interventionsOffered: 5, interventionsAccepted: 4 }
    }
  });
  const updated = autoClassifyDomain(p, "arxiv.org");
  const settings = updated.domainSettings.filter(d => d.domain === "arxiv.org");
  assert.strictEqual(settings.length, 1, "Should not duplicate the domain settings entry");
  assert.strictEqual(settings[0].sensitivityOverride, 0.8);
});

test("full simulation: 3 dismiss events → domain auto-classified as low sensitivity", () => {
  let p = makeProfile({
    domainStats: { "instagram.com": { visits: 3, avgDifficultyScore: 0.25, interventionsOffered: 0, interventionsAccepted: 0 } }
  });
  p = processFeedback(p, "tier2", "dismissed", "instagram.com", 0.35);
  p = processFeedback(p, "tier2", "dismissed", "instagram.com", 0.30);
  p = processFeedback(p, "tier2", "dismissed", "instagram.com", 0.28);
  p = autoClassifyDomain(p, "instagram.com");
  const setting = p.domainSettings.find(d => d.domain === "instagram.com");
  assert.ok(setting, "Expected domainSettings entry");
  assert.strictEqual(setting.sensitivityOverride, 0.2, `Expected 0.2, got ${setting?.sensitivityOverride}`);
});

// ─── RESULTS ────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exitCode = 1;
