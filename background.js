const PROFILE_KEY = "userProfile";

chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason !== "install") return;

  const existing = await chrome.storage.local.get(PROFILE_KEY);
  if (!existing[PROFILE_KEY]) {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "GET_PROFILE":
      chrome.storage.local.get(PROFILE_KEY, result => {
        sendResponse({ profile: result[PROFILE_KEY] ?? null });
      });
      return true;

    case "SAVE_PROFILE":
      chrome.storage.local.set({ [PROFILE_KEY]: message.payload }, () => {
        sendResponse({ ok: true });
      });
      return true;

    case "RESET_PROFILE":
      chrome.storage.local.remove(PROFILE_KEY, () => {
        sendResponse({ ok: true });
      });
      return true;

    case "PROCESS_SESSION_FEATURES":
      processSessionFeatures(message.payload, sender.tab?.url).then(sendResponse);
      return true;

    case "RECORD_INTERVENTION_FEEDBACK":
      // Week 4 (Saanvi): Authoritative feedback processing.
      // Runs processFeedback + autoClassifyDomain + optional neural weight update.
      recordInterventionFeedback(message.payload).then(sendResponse);
      return true;

    case "GET_WEEKLY_SUMMARY":
      // Returns a computed summary of the last 7 days for the popup.
      getWeeklySummary().then(sendResponse);
      return true;

    case "CALIBRATE_SCORER":
      // Accepts { features, targetScore } — runs one gradient step on neural weights.
      calibrateScorer(message.payload).then(sendResponse);
      return true;

    case "APPLY_READING_THEME_CSS":
      injectReadingCss(sender.tab?.id, message.css, sendResponse);
      return true;

    case "DEFINE_WORD":
      defineWord(message.payload.word, message.payload.context).then(sendResponse);
      return true;

    case "SIMPLIFY_TEXT":
      simplifyText(message.payload.text).then(sendResponse);
      return true;

    default:
      sendResponse({ error: "Unknown message type" });
      return false;
  }
});

// ─── SCORING & DECISION AGENT (Saanvi Week 3) ───────────────────────────────

function getProfileData() {
  return new Promise(resolve => {
    chrome.storage.local.get(PROFILE_KEY, result => {
      resolve(result[PROFILE_KEY] ?? null);
    });
  });
}

function saveProfileData(profile) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [PROFILE_KEY]: profile }, resolve);
  });
}

function computeDifficultyScore(features) {
  const wpm = features.readingSpeedWpm || 0;
  const reg = features.regressionRate || 0;
  const hover = features.hoverDwellSpikes || 0;
  const lookup = features.copyLookupFrequency || 0;
  const comp = features.paragraphCompletionRate !== undefined ? features.paragraphCompletionRate : 1.0;
  const vocab = features.vocabularyDifficultyIndex || 0;

  // Normalization to 0-1 sub-scores
  // 1. Reading speed (WPM): Normal >= 200, Extremely slow <= 60
  const s_wpm = Math.max(0, Math.min(1, (200 - wpm) / 140));

  // 2. Regression rate: Normal <= 1.0, High >= 4.0 (per 100 words)
  const s_reg = Math.max(0, Math.min(1, (reg - 1.0) / 3.0));

  // 3. Hover dwell spikes: Normal = 0, High >= 3
  const s_hover = Math.max(0, Math.min(1, hover / 3));

  // 4. Copy/Lookup frequency: Normal = 0, High >= 3
  const s_lookup = Math.max(0, Math.min(1, lookup / 3));

  // 5. Paragraph completion rate: Normal = 1.0, High difficulty/frustration = 0.0
  const s_comp = Math.max(0, Math.min(1, 1.0 - comp));

  // 6. Vocabulary difficulty index: Normal <= 0.05, High >= 0.30
  const s_vocab = Math.max(0, Math.min(1, (vocab - 0.05) / 0.25));

  // Weights: WPM=0.35, Reg=0.25, Hover=0.15, Lookup=0.10, Vocab=0.10, Comp=0.05
  const score = (s_wpm * 0.35) + (s_reg * 0.25) + (s_hover * 0.15) + (s_lookup * 0.10) + (s_vocab * 0.10) + (s_comp * 0.05);

  return parseFloat(score.toFixed(3));
}

function runDecisionAgent(profile, score, domain) {
  // If extension is paused globally or on this domain
  const domainSetting = profile.domainSettings?.find(d => d.domain === domain);
  if (domainSetting?.paused) {
    return { paused: true, apply: [], offer: null };
  }

  // Retrieve sensitivity override
  const sensitivity = domainSetting?.sensitivityOverride; // float
  let t1 = 0.3, t2 = 0.5, t3 = 0.7;

  if (sensitivity !== undefined) {
    if (sensitivity <= 0.35) {
      // Low sensitivity -> raise thresholds
      t1 = 0.45; t2 = 0.65; t3 = 0.85;
    } else if (sensitivity > 0.65) {
      // High sensitivity -> lower thresholds
      t1 = 0.15; t2 = 0.35; t3 = 0.55;
    }
  }

  // Determine target tier
  let targetTier = 0;
  if (score >= t3) targetTier = 3;
  else if (score >= t2) targetTier = 2;
  else if (score >= t1) targetTier = 1;

  const plan = {
    paused: false,
    apply: [], // interventions to enable immediately
    offer: null, // tier to offer via banner
    reason: "",
  };

  // If declared dyslexic, always apply Tier 1 baseline adaptations immediately on load
  const isDyslexic = profile.mode === "declared_dyslexic";

  // Check intervention history for user decisions
  const history = profile.interventionHistory || {};
  const t2Accepted = history["tier2"]?.lastAction === "accepted";
  const t2Dismissed = history["tier2"]?.lastAction === "dismissed";
  const t2DismissScore = history["tier2"]?.difficultyScoreAtTime ?? 0.5;

  const t3Accepted = history["tier3"]?.lastAction === "accepted";
  const t3Dismissed = history["tier3"]?.lastAction === "dismissed";
  const t3DismissScore = history["tier3"]?.difficultyScoreAtTime ?? 0.7;

  // Proactive rules (can run even at targetTier = 0)
  // Check if domain is historically difficult (avgScore >= 0.5 across >= 2 visits)
  const stats = profile.domainStats?.[domain];
  const isDifficultDomain = stats && stats.visits >= 2 && stats.avgDifficultyScore >= 0.5;

  const shouldProactivelyApplyTier1 = isDyslexic || isDifficultDomain || (sensitivity !== undefined && sensitivity > 0.65);

  if (shouldProactivelyApplyTier1 || targetTier >= 1) {
    plan.apply.push("font_switch", "letter_spacing", "line_height", "background_tint");
  }

  // Evaluate Tier 2 (Structural)
  if (targetTier >= 2) {
    if (t2Accepted) {
      // Apply silently since they previously accepted
      plan.apply.push("reading_ruler", "paragraph_chunking", "focus_mode");
    } else if (t2Dismissed) {
      // Re-offer only if score rises by +0.15 above dismissal score
      if (score > t2DismissScore + 0.15) {
        plan.offer = "tier2";
        plan.reason = `Difficulty score rose to ${Math.round(score*100)}% (exceeded previous dismissal baseline of ${Math.round(t2DismissScore*100)}%)`;
      }
    } else {
      // Not decided yet -> offer
      plan.offer = "tier2";
      plan.reason = `Reading difficulty detected (Score: ${Math.round(score*100)}%)`;
    }
  }

  // Evaluate Tier 3 (Full Assistance)
  if (targetTier >= 3) {
    // If Tier 3 is offered/applied, it takes precedence over offering Tier 2
    if (t3Accepted) {
      // Apply silently
      plan.apply.push("vocabulary_tooltips", "text_simplification", "text_to_speech");
      // If Tier 2 was also accepted or not dismissed, make sure we apply it too
      if (!t2Dismissed) {
        plan.apply.push("reading_ruler", "paragraph_chunking", "focus_mode");
      }
    } else if (t3Dismissed) {
      // Re-offer only if score rises by +0.15 above dismissal score
      if (score > t3DismissScore + 0.15) {
        plan.offer = "tier3";
        plan.reason = `Reading friction reached high levels (Score: ${Math.round(score*100)}%)`;
      }
    } else {
      // Offer Tier 3
      plan.offer = "tier3";
      plan.reason = `High reading difficulty detected (Score: ${Math.round(score*100)}%)`;
    }
  }

  return plan;
}

async function processSessionFeatures(features, tabUrl) {
  if (!features) return { ok: false, error: "Missing features" };

  const domain = tabUrl ? new URL(tabUrl).hostname : "";
  const profile = await getProfileData();
  if (!profile) return { ok: false, error: "No profile found" };

  // Persist the raw feature vector so the neural scorer can use it as a
  // training signal when the user later accepts or dismisses an intervention.
  profile.lastFeatureVector = features;

  // 1. Compute difficulty score for this session
  // Week 4: switch to the in-browser neural scorer once it has been calibrated
  //         by at least MIN_TRAINING_EX accepted/dismissed events.
  let sessionScore;
  const neuralWeights = await getNeuralWeights();
  if ((neuralWeights.trainingExamples ?? 0) >= MIN_TRAINING_EX) {
    sessionScore = runNeuralScorer(features, neuralWeights);
    profile.scoringModel = "neural";
  } else {
    sessionScore = computeDifficultyScore(features);
    profile.scoringModel = "rule_based";
  }

  // 2. Smooth running score with EWMA
  const ALPHA = 0.3;
  const oldScore = profile.difficultyScore ?? 0.5;
  const newScore = parseFloat((ALPHA * sessionScore + (1 - ALPHA) * oldScore).toFixed(3));

  profile.difficultyScore = newScore;
  profile.currentDifficultyScore = newScore;
  profile.lastSessionScore = sessionScore;

  // 3. Record session in domain statistics
  if (!profile.domainStats) profile.domainStats = {};
  const stats = profile.domainStats[domain] ?? {
    domain,
    visits: 0,
    avgReadingSpeedWpm: 0,
    avgDifficultyScore: 0,
    interventionsOffered: 0,
    interventionsAccepted: 0,
  };
  stats.visits++;
  // Update running average for domain
  stats.avgDifficultyScore = parseFloat(
    ((stats.avgDifficultyScore * (stats.visits - 1) + sessionScore) / stats.visits).toFixed(3)
  );
  if (features.readingSpeedWpm > 0) {
    stats.avgReadingSpeedWpm = Math.round(
      (stats.avgReadingSpeedWpm * (stats.visits - 1) + features.readingSpeedWpm) / stats.visits
    );
  }
  stats.lastVisited = Date.now();
  profile.domainStats[domain] = stats;

  // 4. Run Decision Agent
  const plan = runDecisionAgent(profile, newScore, domain);

  // 5. Save updated profile
  profile.updatedAt = new Date().toISOString();
  await saveProfileData(profile);

  return { ok: true, plan, currentDifficultyScore: newScore, scoringModel: profile.scoringModel };
}




async function injectReadingCss(tabId, css, sendResponse) {
  if (!tabId || !css) {
    sendResponse({ ok: false, error: "Missing tab id or css" });
    return;
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId, allFrames: true },
      css
    });
    sendResponse({ ok: true });
  } catch (error) {
    sendResponse({ ok: false, error: error?.message ?? String(error) });
  }
}

async function defineWord(word, context = "") {
  if (!word || word.trim().length < 2) {
    return { ok: false, error: "Word too short" };
  }

  const clean = word.toLowerCase().replace(/[^a-z'-]/g, "");

  try {
    const res = await fetch("http://127.0.0.1:8787/define", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        term: clean,
        context: context
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, result: data.result };
  } catch (err) {
    console.error("[DysAssist] Error fetching definition:", err.message);
    return { ok: false, error: err.message };
  }
}

async function simplifyText(text) {
  if (!text || text.trim().length < 10) {
    return { ok: false, error: "Text too short to simplify" };
  }

  try {
    const res = await fetch("http://127.0.0.1:8787/simplify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text.trim()
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, result: data.result };
  } catch (err) {
    console.error("[DysAssist] Error simplifying text:", err.message);
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEK 4 — Saanvi: Feedback Weighting, Per-Domain Learning, Neural Scorer
// ═══════════════════════════════════════════════════════════════════════════

// ─── Constants ─────────────────────────────────────────────────────────────
const NEURAL_SCORER_KEY = "neuralScorerWeights";
const NEURAL_INPUTS     = 6;
const NEURAL_HIDDEN     = 8;
const NEURAL_LR         = 0.01;      // learning rate for online gradient updates
const MIN_TRAINING_EX   = 5;         // switch from rule-based to neural after this many examples

const DOMAIN_CLASSIFY_MIN_VISITS  = 3;   // min domain sessions before auto-classification
const DOMAIN_ACCEPT_RATE_HIGH     = 0.60; // → high sensitivity (proactive)
const DOMAIN_DISMISS_RATE_HIGH    = 0.60; // → low sensitivity (back off)
const DOMAIN_SCORE_THRESHOLD      = 0.55; // used alongside acceptRate

// ─── A. processFeedback ────────────────────────────────────────────────────
//
// Pure function — does NOT touch storage. Returns the updated profile.
// Called by recordInterventionFeedback() which handles persistence.
//
function processFeedback(profile, tier, action, domain, score, quickDismiss) {
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
    if (quickDismiss) weight = Math.min(1.0, weight + 0.05); // soften false-positive
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
    // Preserve dismissal baseline so decision agent can re-offer after +0.15 rise
    difficultyScoreAtTime: action === "dismissed"
      ? score
      : existing.difficultyScoreAtTime,
  };

  // Update domain intervention counters
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

// ─── B. autoClassifyDomain ─────────────────────────────────────────────────
//
// After processFeedback updates domainStats, check whether this domain has
// enough history to assign a permanent sensitivityOverride.
//
// Rules:
//   acceptRate ≥ 0.60 AND avgScore ≥ 0.55  →  sensitivityOverride = 0.8 (be proactive)
//   dismissRate ≥ 0.60                      →  sensitivityOverride = 0.2 (back off)
//
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
    newSensitivity = 0.8; // academic / difficult content → lower trigger thresholds
  } else if (dismissRate >= DOMAIN_DISMISS_RATE_HIGH) {
    newSensitivity = 0.2; // social / casual → raise trigger thresholds
  }

  if (newSensitivity !== undefined) {
    const existing = (profile.domainSettings ?? []).find(d => d.domain === domain);
    if (existing) {
      existing.sensitivityOverride = newSensitivity;
    } else {
      profile.domainSettings.push({ domain, paused: false, sensitivityOverride: newSensitivity });
    }
    console.log(
      `[DysAssist] Domain auto-classified: ${domain} → sensitivity ${
        newSensitivity === 0.8 ? "HIGH (proactive)" : "LOW (back-off)"
      }`
    );
  }

  return profile;
}

// ─── C. NeuralScorer (pure-JS 2-layer MLP) ────────────────────────────────
//
// Architecture: 6 inputs → 8 hidden (ReLU) → 1 output (linear, clipped [0,1])
//
// Pre-seeded weights are derived analytically from the Week 3 rule-based scorer:
//   W1 = identity-like (6×8); W2 = [0.35, 0.25, 0.15, 0.10, 0.10, 0.05, 0, 0]
// This makes the untrained network produce EXACTLY the same output as the
// rule-based scorer, so swapping in the neural scorer is a no-op at day 0.
//
// As the user generates labelled feedback events (accept/dismiss), a single
// stochastic gradient step (SGD, LR=0.01) is applied to personalise the weights.
// The network switches from rule-based → neural after MIN_TRAINING_EX examples.
//

function getDefaultNeuralWeights() {
  // W1[input][hidden]: identity for inputs 0-5; neurons 6-7 unused initially
  const W1 = Array.from({ length: NEURAL_INPUTS }, (_, i) =>
    Array.from({ length: NEURAL_HIDDEN }, (_, j) => (i === j ? 1.0 : 0.0))
  );
  const b1 = new Array(NEURAL_HIDDEN).fill(0.0);

  // W2[hidden]: rule-based weights for neurons 0-5, 0 for neurons 6-7
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

  // Hidden layer: h = ReLU(W1ᵀ · x + b1)
  const h = Array.from({ length: NEURAL_HIDDEN }, (_, j) => {
    let z = weights.b1[j];
    for (let i = 0; i < NEURAL_INPUTS; i++) z += weights.W1[i][j] * x[i];
    return Math.max(0, z); // ReLU
  });

  // Output layer: y = W2 · h + b2 (linear)
  let y = weights.b2;
  for (let j = 0; j < NEURAL_HIDDEN; j++) y += weights.W2[j] * h[j];

  return parseFloat(Math.max(0, Math.min(1, y)).toFixed(3));
}

// One online SGD step. targetScore is the supervision signal.
function neuralScorerStep(features, targetScore, weights) {
  const x = featuresToInputVector(features);

  // Forward pass
  const h = Array.from({ length: NEURAL_HIDDEN }, (_, j) => {
    let z = weights.b1[j];
    for (let i = 0; i < NEURAL_INPUTS; i++) z += weights.W1[i][j] * x[i];
    return Math.max(0, z);
  });

  let y = weights.b2;
  for (let j = 0; j < NEURAL_HIDDEN; j++) y += weights.W2[j] * h[j];
  y = Math.max(0, Math.min(1, y));

  const err = y - targetScore; // MSE gradient numerator

  // Output layer gradients
  const newW2 = weights.W2.map((w, j) => w - NEURAL_LR * err * h[j]);
  const newB2 = weights.b2 - NEURAL_LR * err;

  // Hidden layer gradients (ReLU derivative: 1 if h > 0, else 0)
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

function getNeuralWeights() {
  return new Promise(resolve =>
    chrome.storage.local.get(NEURAL_SCORER_KEY, r =>
      resolve(r[NEURAL_SCORER_KEY] ?? getDefaultNeuralWeights())
    )
  );
}

function saveNeuralWeights(weights) {
  return new Promise(resolve =>
    chrome.storage.local.set({ [NEURAL_SCORER_KEY]: weights }, resolve)
  );
}

// ─── D. computeWeeklySummary ───────────────────────────────────────────────
function computeWeeklySummary(profile) {
  const now        = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const recent = (profile.sessionHistory ?? []).filter(s => s.timestamp >= oneWeekAgo);

  const avgSpeed = recent.length
    ? Math.round(recent.reduce((s, r) => s + (r.readingSpeedWpm ?? 0), 0) / recent.length)
    : 0;

  const avgDifficulty = recent.length
    ? parseFloat((recent.reduce((s, r) => s + (r.difficultyScore ?? 0), 0) / recent.length).toFixed(2))
    : (profile.difficultyScore ?? 0);

  const difficultDomains = Object.values(profile.domainStats ?? {})
    .filter(d => d.visits >= 2)
    .sort((a, b) => b.avgDifficultyScore - a.avgDifficultyScore)
    .slice(0, 3)
    .map(d => ({ domain: d.domain, avgScore: d.avgDifficultyScore, visits: d.visits }));

  const interventionUsage = Object.entries(profile.interventionHistory ?? {})
    .map(([tier, h]) => ({
      tier,
      acceptCount:  h.acceptCount  ?? 0,
      dismissCount: h.dismissCount ?? 0,
      ignoreCount:  h.ignoreCount  ?? 0,
      weight: parseFloat((h.weight ?? 0.5).toFixed(2)),
    }))
    .sort((a, b) => b.acceptCount - a.acceptCount);

  const totOffered  = interventionUsage.reduce((s, i) => s + i.acceptCount + i.dismissCount + i.ignoreCount, 0);
  const totAccepted = interventionUsage.reduce((s, i) => s + i.acceptCount, 0);

  return {
    period: "last_7_days",
    totalSessions:              recent.length,
    avgReadingSpeedWpm:         avgSpeed,
    avgDifficultyScore:         avgDifficulty,
    currentDifficultyScore:     profile.difficultyScore ?? 0,
    difficultDomains,
    interventionUsage,
    totalInterventionsOffered:  totOffered,
    totalInterventionsAccepted: totAccepted,
    acceptanceRate: totOffered > 0
      ? parseFloat((totAccepted / totOffered).toFixed(2))
      : 0,
    generatedAt: now,
  };
}

// ─── E. Message handler implementations ───────────────────────────────────

async function recordInterventionFeedback({ tier, action, domain, score, quickDismiss }) {
  if (!tier || !action || !domain) return { ok: false, error: "Missing fields" };

  // 1. Update profile
  let profile = await getProfileData();
  if (!profile) return { ok: false, error: "No profile" };

  profile = processFeedback(profile, tier, action, domain, score, quickDismiss);
  profile = autoClassifyDomain(profile, domain);
  await saveProfileData(profile);

  // 2. Update neural scorer weights (only for accept/dismiss — ignore is ambiguous)
  if (action === "accepted" || action === "dismissed") {
    const weights = await getNeuralWeights();
    // Supervision signal:
    //   accept  → score was correct (confirm it)
    //   dismiss → model over-estimated; reduce by 0.20
    const targetScore = action === "accepted"
      ? Math.min(1, score)
      : Math.max(0, score - 0.20);

    // We need the feature vector, but this message doesn't carry it.
    // Use the stored last feature vector from the profile as a proxy.
    const lastFv = profile.lastFeatureVector;
    if (lastFv) {
      const updated = neuralScorerStep(lastFv, targetScore, weights);
      await saveNeuralWeights(updated);
    }
  }

  return { ok: true };
}

async function getWeeklySummary() {
  const profile = await getProfileData();
  if (!profile) return { ok: false, error: "No profile" };
  return { ok: true, summary: computeWeeklySummary(profile) };
}

async function calibrateScorer({ features, targetScore }) {
  if (!features || targetScore === undefined) return { ok: false, error: "Missing fields" };
  const weights = await getNeuralWeights();
  const updated = neuralScorerStep(features, targetScore, weights);
  await saveNeuralWeights(updated);
  return { ok: true, trainingExamples: updated.trainingExamples };
}