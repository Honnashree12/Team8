// adaptiveEngine.js
// ---------------------------------------------------------------------------
// DysAssist adaptive intelligence core (Saanvi — Weeks 3-5 deliverable).
//
// This is the "brain" that turns reading signals into decisions:
//   FeatureVector  --scoreFeatures-->  difficultyScore (0..1)
//   difficultyScore --ewma-->          smoothed score across sessions
//   score + history --decideInterventions--> intervention plan
//   accept/dismiss  --applyFeedback--> updated weights / thresholds
//
// It is RULE-BASED (interpretable weighted sum) on purpose — see docs/DECISION_LOG.md.
// Pure functions only, no DOM / no chrome APIs, so it runs in:
//   - the service worker (via importScripts -> self.DysAssistAdaptive)
//   - Node   (via require, for tests + tools/calibrate.js)
// ---------------------------------------------------------------------------
(function (root) {
  "use strict";

  // --- Feature weights (documented in docs/DECISION_LOG.md) -----------------
  // Each weight is the share of the difficulty score attributable to that
  // normalized (0..1) signal. Weights sum to 1.0 so the score stays in [0,1].
  var FEATURE_WEIGHTS = {
    vocabularyDifficultyIndex: 0.30, // intrinsic hardness of the page's words
    regressionRate: 0.25,            // re-reading / scrolling back up
    slowReading: 0.20,               // reading speed well below baseline
    copyLookupFrequency: 0.15,       // copies + right-click lookups (vocab help)
    lowCompletion: 0.10              // paragraphs abandoned before finishing
  };

  // Calibrated on synthetic pages — see tools/calibrate.js + DECISION_LOG.md.
  var DECISION_THRESHOLDS = { tier1: 0.30, tier2: 0.50, tier3: 0.70 };

  // Baseline reading model used to normalize WPM into a 0..1 "slowness".
  var WPM_FLUENT = 220; // at/above this -> no slowness struggle
  var WPM_STRUGGLING = 90; // at/below this -> maximum slowness struggle

  // Per-domain aggressiveness. Academic reading -> intervene sooner; social
  // feeds -> stay light. Learned overrides live in profile.adaptive.domainSensitivity.
  var DOMAIN_SENSITIVITY = {
    academic: 1.25,
    news: 1.05,
    general: 1.0,
    social: 0.7
  };

  var SOCIAL_HOSTS = ["twitter.com", "x.com", "facebook.com", "instagram.com",
    "reddit.com", "tiktok.com", "youtube.com", "linkedin.com", "threads.net"];
  var ACADEMIC_HOSTS = ["scholar.google", "arxiv.org", "jstor.org", "sciencedirect.com",
    "springer.com", "nature.com", "wikipedia.org", "ncbi.nlm.nih.gov", "pubmed",
    "researchgate.net", ".edu"];
  var NEWS_HOSTS = ["nytimes.com", "washingtonpost.com", "theguardian.com", "bbc.",
    "reuters.com", "apnews.com", "cnn.com", "bloomberg.com", "economist.com"];

  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

  function classifyDomain(domain) {
    var d = String(domain || "").toLowerCase();
    for (var i = 0; i < SOCIAL_HOSTS.length; i++) if (d.indexOf(SOCIAL_HOSTS[i]) !== -1) return "social";
    for (var j = 0; j < ACADEMIC_HOSTS.length; j++) if (d.indexOf(ACADEMIC_HOSTS[j]) !== -1) return "academic";
    for (var k = 0; k < NEWS_HOSTS.length; k++) if (d.indexOf(NEWS_HOSTS[k]) !== -1) return "news";
    return "general";
  }

  // --- Normalization: raw FeatureVector -> per-signal struggle in [0,1] ------
  function normalizeFeatures(fv) {
    fv = fv || {};
    var wpm = Number(fv.readingSpeedWPM) || 0;
    // Very low WPM (0) usually means "no reading measured yet" — treat as neutral,
    // not maximum struggle, so we don't over-trigger on pages that were just opened.
    var slowReading = wpm <= 0
      ? 0
      : clamp((WPM_FLUENT - wpm) / (WPM_FLUENT - WPM_STRUGGLING), 0, 1);

    return {
      vocabularyDifficultyIndex: clamp(Number(fv.vocabularyDifficultyIndex) || 0, 0, 1),
      // 5+ regressions per 100 words -> maxed out
      regressionRate: clamp((Number(fv.regressionRate) || 0) / 5, 0, 1),
      slowReading: slowReading,
      // 4+ copy/lookup actions per minute -> maxed out
      copyLookupFrequency: clamp((Number(fv.copyLookupFrequency) || 0) / 4, 0, 1),
      // completion is 0..1 where 1 = finished everything; struggle = 1 - completion
      lowCompletion: clamp(1 - (fv.paragraphCompletionRate == null ? 1 : Number(fv.paragraphCompletionRate)), 0, 1)
    };
  }

  // --- The difficulty scorer: interpretable weighted sum --------------------
  function scoreFeatures(fv, weights) {
    var w = weights || FEATURE_WEIGHTS;
    var n = normalizeFeatures(fv);
    var score = 0, wsum = 0;
    for (var key in w) {
      if (!Object.prototype.hasOwnProperty.call(w, key)) continue;
      if (n[key] == null) continue;
      score += w[key] * n[key];
      wsum += w[key];
    }
    if (wsum > 0) score = score / wsum; // renormalize in case weights don't sum to 1
    return clamp(score, 0, 1);
  }

  // Returns per-signal contribution to the score — used for the "why" in the UI/log.
  function explainScore(fv, weights) {
    var w = weights || FEATURE_WEIGHTS;
    var n = normalizeFeatures(fv);
    var parts = [];
    for (var key in w) {
      if (!Object.prototype.hasOwnProperty.call(w, key)) continue;
      parts.push({ signal: key, normalized: n[key], weight: w[key], contribution: w[key] * n[key] });
    }
    parts.sort(function (a, b) { return b.contribution - a.contribution; });
    return parts;
  }

  // --- EWMA smoothing across sessions ---------------------------------------
  // alpha = weight on the newest observation (0..1). Lower alpha = smoother.
  function ewma(previous, next, alpha) {
    if (alpha == null) alpha = 0.3;
    if (previous == null || isNaN(previous)) return next;
    return clamp(alpha * next + (1 - alpha) * previous, 0, 1);
  }

  // --- Intervention catalog: tier -> preference patch -----------------------
  // Progressive: least intrusive (typography) first, heaviest (AI/TTS) last.
  var INTERVENTION_CATALOG = {
    tier1: [
      { type: "font_switch", prefPatch: { font: "lexend" }, label: "Dyslexia-friendly font", reason: "easier letter shapes" },
      { type: "letter_spacing", prefPatch: { letterSpacing: "wide" }, label: "Wider letter spacing", reason: "reduces crowding" },
      { type: "line_height", prefPatch: { lineHeight: "relaxed" }, label: "Relaxed line spacing", reason: "keeps your place on the line" },
      { type: "background_tint", prefPatch: { backgroundTint: "cream" }, label: "Cream background tint", reason: "lowers glare" }
    ],
    tier2: [
      { type: "reading_ruler", prefPatch: { rulerEnabled: true }, label: "Reading ruler", reason: "tracks the current line" },
      { type: "paragraph_chunking", prefPatch: { chunkingEnabled: true }, label: "Paragraph chunking", reason: "breaks walls of text into pieces" }
    ],
    tier3: [
      { type: "focus_mode", prefPatch: { focusEnabled: true }, label: "Focus mode", reason: "dims everything except the sentence you're reading" },
      { type: "vocabulary_tooltips", prefPatch: { vocabEnabled: true }, label: "Vocabulary tooltips", reason: "hover any hard word for a plain-English meaning" },
      { type: "text_to_speech", prefPatch: { ttsEnabled: true }, label: "Read-aloud (TTS)", reason: "hear the text spoken" },
      { type: "text_simplification", prefPatch: { simplifySuggestEnabled: true }, label: "Simplify hard paragraphs", reason: "one-click plain-English rewrite of the hardest text" }
    ]
  };

  function tierForScore(effScore, thresholds) {
    var t = thresholds || DECISION_THRESHOLDS;
    if (effScore >= t.tier3) return 3;
    if (effScore >= t.tier2) return 2;
    if (effScore >= t.tier1) return 1;
    return 0;
  }

  // --- The decision agent ----------------------------------------------------
  // Input : difficultyScore + context (domain, history, learned state).
  // Output: an intervention plan (which preference flags to turn on, and why).
  //
  // ctx = {
  //   domain: string,
  //   alreadyApplied: string[]        // intervention types already active
  //   mode: 'declared_dyslexic'|'occasional'|'fully_passive',
  //   sensitivity: number,            // learned per-domain multiplier (optional)
  //   thresholdOffset: number         // learned global caution (optional, from dismissals)
  // }
  function decideInterventions(difficultyScore, ctx) {
    ctx = ctx || {};
    var domainClass = classifyDomain(ctx.domain);
    var baseSensitivity = ctx.sensitivity != null
      ? ctx.sensitivity
      : (DOMAIN_SENSITIVITY[domainClass] || 1.0);

    // Passive users asked to be left mostly alone -> dampen.
    if (ctx.mode === "fully_passive") baseSensitivity *= 0.6;
    if (ctx.mode === "declared_dyslexic") baseSensitivity *= 1.1;

    var offset = ctx.thresholdOffset || 0; // raised by dismissals (more caution)
    var thresholds = {
      tier1: clamp(DECISION_THRESHOLDS.tier1 + offset, 0.1, 0.95),
      tier2: clamp(DECISION_THRESHOLDS.tier2 + offset, 0.1, 0.95),
      tier3: clamp(DECISION_THRESHOLDS.tier3 + offset, 0.1, 0.99)
    };

    var effScore = clamp(difficultyScore * baseSensitivity, 0, 1);
    var tier = tierForScore(effScore, thresholds);

    var already = {};
    (ctx.alreadyApplied || []).forEach(function (t) { already[t] = true; });

    var target = [];
    var prefPatch = {};
    var newInterventions = [];
    for (var level = 1; level <= tier; level++) {
      var group = INTERVENTION_CATALOG["tier" + level] || [];
      for (var i = 0; i < group.length; i++) {
        var iv = group[i];
        target.push(iv);
        for (var p in iv.prefPatch) prefPatch[p] = iv.prefPatch[p];
        if (!already[iv.type]) {
          newInterventions.push({ type: iv.type, tier: "tier" + level, prefPatch: iv.prefPatch, label: iv.label, reason: iv.reason });
        }
      }
    }

    return {
      score: clamp(difficultyScore, 0, 1),
      effectiveScore: effScore,
      domainClass: domainClass,
      sensitivity: baseSensitivity,
      thresholds: thresholds,
      tier: tier,
      target: target,               // full desired intervention set
      prefPatch: prefPatch,         // merged preference flags to apply
      newInterventions: newInterventions // only those not already active (drive the toast)
    };
  }

  // --- Feedback learning -----------------------------------------------------
  // Accepted interventions make us more eager (raise domain sensitivity, lower
  // caution). Dismissed ones make us more cautious (lower sensitivity, raise the
  // threshold). A dismissal within 5s is logged as a likely FALSE POSITIVE.
  var FALSE_POSITIVE_MS = 5000;

  function defaultLearnState() {
    return { thresholdOffset: 0, domainSensitivity: {}, falsePositives: 0, accepts: 0, dismisses: 0 };
  }

  function applyFeedback(state, event) {
    state = state || defaultLearnState();
    if (!state.domainSensitivity) state.domainSensitivity = {};
    event = event || {};
    var domainClass = classifyDomain(event.domain);
    var base = DOMAIN_SENSITIVITY[domainClass] || 1.0;
    var cur = state.domainSensitivity[domainClass] != null ? state.domainSensitivity[domainClass] : base;
    var isFalsePositive = false;

    if (event.type === "accept") {
      state.accepts = (state.accepts || 0) + 1;
      state.domainSensitivity[domainClass] = clamp(cur * 1.06, 0.4, 1.6);
      state.thresholdOffset = clamp((state.thresholdOffset || 0) - 0.01, -0.15, 0.4);
    } else if (event.type === "dismiss") {
      state.dismisses = (state.dismisses || 0) + 1;
      var quick = Number(event.dwellMsBeforeFeedback) >= 0 && Number(event.dwellMsBeforeFeedback) < FALSE_POSITIVE_MS;
      var sensPenalty = quick ? 0.82 : 0.9;
      var offsetPenalty = quick ? 0.06 : 0.03;
      state.domainSensitivity[domainClass] = clamp(cur * sensPenalty, 0.4, 1.6);
      state.thresholdOffset = clamp((state.thresholdOffset || 0) + offsetPenalty, -0.15, 0.4);
      if (quick) { state.falsePositives = (state.falsePositives || 0) + 1; isFalsePositive = true; }
    }
    // 'ignore' -> no change

    return { state: state, isFalsePositive: isFalsePositive, domainClass: domainClass };
  }

  var api = {
    FEATURE_WEIGHTS: FEATURE_WEIGHTS,
    DECISION_THRESHOLDS: DECISION_THRESHOLDS,
    DOMAIN_SENSITIVITY: DOMAIN_SENSITIVITY,
    INTERVENTION_CATALOG: INTERVENTION_CATALOG,
    FALSE_POSITIVE_MS: FALSE_POSITIVE_MS,
    clamp: clamp,
    classifyDomain: classifyDomain,
    normalizeFeatures: normalizeFeatures,
    scoreFeatures: scoreFeatures,
    explainScore: explainScore,
    ewma: ewma,
    tierForScore: tierForScore,
    decideInterventions: decideInterventions,
    applyFeedback: applyFeedback,
    defaultLearnState: defaultLearnState
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DysAssistAdaptive = api;
})(typeof self !== "undefined" ? self : (typeof globalThis !== "undefined" ? globalThis : this));
