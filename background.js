// background.js — DysAssist service worker
// Handles profile storage, the LLM proxy calls, and the ADAPTIVE ENGINE:
// ingest feature vectors -> score (EWMA) -> decision agent -> auto-apply
// interventions -> learn from accept/dismiss feedback.  (Saanvi, Weeks 2-5)

importScripts("adaptiveEngine.js"); // -> self.DysAssistAdaptive
const AE = self.DysAssistAdaptive;

const PROFILE_KEY = "userProfile";
const ADAPTIVE_KEY = "dysAdaptive";      // bulk telemetry (feature/score history)
const IDB_SIZE_LIMIT = 1_000_000;         // 1 MB -> migrate telemetry to IndexedDB
const FEATURE_HISTORY_CAP = 60;
const SCORE_HISTORY_CAP = 120;
const EWMA_ALPHA = 0.3;

// Map an intervention type -> whether it is currently ON in the preferences.
function isInterventionActive(prefs, type) {
  if (!prefs) return false;
  switch (type) {
    case "font_switch": return prefs.font === "lexend" || prefs.font === "opendyslexic";
    case "letter_spacing": return prefs.letterSpacing && prefs.letterSpacing !== "normal";
    case "line_height": return prefs.lineHeight && prefs.lineHeight !== "normal";
    case "background_tint": return prefs.backgroundTint && prefs.backgroundTint !== "none";
    case "reading_ruler": return !!prefs.rulerEnabled;
    case "paragraph_chunking": return !!prefs.chunkingEnabled;
    case "focus_mode": return !!prefs.focusEnabled;
    case "vocabulary_tooltips": return !!prefs.vocabEnabled;
    case "text_to_speech": return !!prefs.ttsEnabled;
    case "text_simplification": return !!prefs.simplifySuggestEnabled;
    default: return false;
  }
}

// Neutral ("off") preference patch for reverting an intervention.
const REVERT_PATCH = {
  font_switch: { font: "system" },
  letter_spacing: { letterSpacing: "normal" },
  line_height: { lineHeight: "normal" },
  background_tint: { backgroundTint: "none" },
  reading_ruler: { rulerEnabled: false },
  paragraph_chunking: { chunkingEnabled: false },
  focus_mode: { focusEnabled: false },
  vocabulary_tooltips: { vocabEnabled: false },
  text_to_speech: { ttsEnabled: false },
  text_simplification: { simplifySuggestEnabled: false }
};

// --- storage helpers -------------------------------------------------------
function getStored(key) {
  return new Promise(resolve => {
    try { chrome.storage.local.get(key, r => resolve(r[key] ?? null)); }
    catch { resolve(null); }
  });
}
function setStored(key, value) {
  return new Promise(resolve => {
    try { chrome.storage.local.set({ [key]: value }, () => resolve(true)); }
    catch { resolve(false); }
  });
}

function ensureAdaptiveProfileShape(profile) {
  if (!profile.adaptive) profile.adaptive = {};
  const a = profile.adaptive;
  if (!a.learn) a.learn = AE.defaultLearnState();
  if (!a.autoApplied) a.autoApplied = {};      // type -> {tier, ts, domain}
  if (!a.suppressed) a.suppressed = {};        // domain -> { type: true }  (user said no)
  if (a.lastTier == null) a.lastTier = 0;
  return profile;
}

function roughSize(obj) {
  try { return JSON.stringify(obj).length; } catch { return 0; }
}

// --- IndexedDB overflow store (used when telemetry > 1 MB) -----------------
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("dysassist", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("archive");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("archive", "readwrite");
    tx.objectStore("archive").put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// If the rolling telemetry exceeds 1 MB, archive the older history to IndexedDB
// and keep only a recent tail in chrome.storage.local.
async function maybeMigrateTelemetry(adaptive) {
  if (roughSize(adaptive) <= IDB_SIZE_LIMIT) return adaptive;
  try {
    const stamp = adaptive.scoreHistory?.[adaptive.scoreHistory.length - 1]?.ts || "latest";
    await idbPut("featureHistory_" + stamp, adaptive.featureHistory || []);
    await idbPut("scoreHistory_" + stamp, adaptive.scoreHistory || []);
    adaptive.featureHistory = (adaptive.featureHistory || []).slice(-10);
    adaptive.scoreHistory = (adaptive.scoreHistory || []).slice(-10);
    adaptive.archivedToIDB = true;
    console.log("[DysAssist] Telemetry exceeded 1MB — archived history to IndexedDB.");
  } catch (e) {
    // Fallback: hard-trim so chrome.storage never overflows.
    adaptive.featureHistory = (adaptive.featureHistory || []).slice(-20);
    adaptive.scoreHistory = (adaptive.scoreHistory || []).slice(-20);
  }
  return adaptive;
}

// --- shared decision context builder --------------------------------------
function buildContext(profile, domain) {
  const prefs = profile.preferences || {};
  const learn = profile.adaptive.learn || AE.defaultLearnState();
  const domainClass = AE.classifyDomain(domain);
  const alreadyApplied = [
    "font_switch", "letter_spacing", "line_height", "background_tint",
    "reading_ruler", "paragraph_chunking", "focus_mode",
    "vocabulary_tooltips", "text_to_speech"
  ].filter(t => isInterventionActive(prefs, t));

  return {
    domain,
    alreadyApplied,
    mode: profile.mode,
    sensitivity: learn.domainSensitivity ? learn.domainSensitivity[domainClass] : undefined,
    thresholdOffset: learn.thresholdOffset || 0
  };
}

// Filter out interventions the user explicitly dismissed for this domain.
function notSuppressed(profile, domain, interventions) {
  const supp = (profile.adaptive.suppressed || {})[domain] || {};
  return interventions.filter(iv => !supp[iv.type]);
}

// Apply an intervention's preference patch onto prefs. Returns true if changed.
function applyPatch(prefs, patch) {
  let changed = false;
  for (const k in patch) {
    if (prefs[k] !== patch[k]) { prefs[k] = patch[k]; changed = true; }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// FEATURE_SNAPSHOT: the main adaptive loop (called ~every 30s per tab).
// ---------------------------------------------------------------------------
async function handleFeatureSnapshot(fv) {
  const profile = await getStored(PROFILE_KEY);
  if (!profile) return { ok: false, reason: "no-profile" };
  ensureAdaptiveProfileShape(profile);

  // Respect the master switch.
  if (profile.preferences && profile.preferences.applyImmediately === false) {
    return { ok: false, reason: "master-off" };
  }

  const adaptive = (await getStored(ADAPTIVE_KEY)) || { featureHistory: [], scoreHistory: [] };

  // Score this snapshot, smooth across the session/history with EWMA.
  const raw = AE.scoreFeatures(fv, profile.adaptive.learn.weights);
  const prevScore = typeof profile.difficultyScore === "number" ? profile.difficultyScore : raw;
  const smoothed = AE.ewma(prevScore, raw, EWMA_ALPHA);

  // Persist rolling telemetry.
  adaptive.featureHistory = (adaptive.featureHistory || []).concat([fv]).slice(-FEATURE_HISTORY_CAP);
  const domain = fv.domain || "";

  // Decision agent.
  const ctx = buildContext(profile, domain);
  const plan = AE.decideInterventions(smoothed, ctx);
  const applicable = notSuppressed(profile, domain, plan.newInterventions);

  adaptive.scoreHistory = (adaptive.scoreHistory || [])
    .concat([{ score: Number(smoothed.toFixed(3)), raw: Number(raw.toFixed(3)), tier: plan.tier, domain, ts: fv.timestamp }])
    .slice(-SCORE_HISTORY_CAP);

  // Apply the newly-decided interventions to the live preferences.
  const prefs = profile.preferences || (profile.preferences = {});
  let prefsChanged = false;
  const applied = [];
  for (const iv of applicable) {
    if (applyPatch(prefs, iv.prefPatch)) prefsChanged = true;
    profile.adaptive.autoApplied[iv.type] = { tier: iv.tier, ts: fv.timestamp, domain };
    applied.push(iv);
  }

  profile.difficultyScore = smoothed;
  profile.adaptive.lastTier = plan.tier;
  profile.updatedAt = new Date().toISOString();

  await maybeMigrateTelemetry(adaptive);
  await setStored(ADAPTIVE_KEY, adaptive);

  // Only rewrite userProfile (which re-renders the page) when something the
  // user would notice changed — prefs flipped or the score % moved.
  const scoreMoved = Math.round(prevScore * 100) !== Math.round(smoothed * 100);
  if (prefsChanged || scoreMoved || applied.length) {
    await setStored(PROFILE_KEY, profile);
  }

  return {
    ok: true,
    score: smoothed,
    tier: plan.tier,
    domainClass: plan.domainClass,
    newInterventions: applied
  };
}

// ---------------------------------------------------------------------------
// INTERVENTION_FEEDBACK: learn from Keep / Undo / ignore.
// ---------------------------------------------------------------------------
async function handleFeedback(payload) {
  const profile = await getStored(PROFILE_KEY);
  if (!profile) return { ok: false };
  ensureAdaptiveProfileShape(profile);

  const decision = payload.decision; // 'accept' | 'dismiss' | 'ignore'
  const domain = payload.domain || "";
  const domainClass = AE.classifyDomain(domain);

  const res = AE.applyFeedback(profile.adaptive.learn, {
    type: decision,
    domain,
    dwellMsBeforeFeedback: payload.dwellMsBeforeFeedback
  });
  profile.adaptive.learn = res.state;

  if (decision === "dismiss") {
    // Don't nag: remember the user said no to these on this domain.
    if (!profile.adaptive.suppressed[domain]) profile.adaptive.suppressed[domain] = {};
    (payload.interventions || []).forEach(t => { profile.adaptive.suppressed[domain][t] = true; });

    if (res.isFalsePositive) {
      if (!profile.adaptive.falsePositiveLog) profile.adaptive.falsePositiveLog = [];
      profile.adaptive.falsePositiveLog.push({
        interventions: payload.interventions || [],
        domain, domainClass,
        scoreAtTime: payload.scoreAtTime,
        dwellMs: payload.dwellMsBeforeFeedback,
        ts: Date.now()
      });
      profile.adaptive.falsePositiveLog = profile.adaptive.falsePositiveLog.slice(-50);
      console.log("[DysAssist] Likely false positive (dismissed in <5s):", payload.interventions, domain);
    }
  }

  profile.updatedAt = new Date().toISOString();
  await setStored(PROFILE_KEY, profile);
  return { ok: true, isFalsePositive: res.isFalsePositive };
}

// ---------------------------------------------------------------------------
// REVERT_INTERVENTIONS: turn back off what the user just undid.
// ---------------------------------------------------------------------------
async function handleRevert(payload) {
  const profile = await getStored(PROFILE_KEY);
  if (!profile) return { ok: false };
  ensureAdaptiveProfileShape(profile);
  const prefs = profile.preferences || {};
  let changed = false;
  (payload.interventions || []).forEach(t => {
    const patch = REVERT_PATCH[t];
    if (patch && applyPatch(prefs, patch)) changed = true;
    delete profile.adaptive.autoApplied[t];
  });
  if (changed) {
    profile.updatedAt = new Date().toISOString();
    await setStored(PROFILE_KEY, profile);
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// COLD START: if a profile is already established, apply baseline
// interventions the moment a page loads — don't wait for the first 30s snapshot.
// ---------------------------------------------------------------------------
function profileIsEstablished(profile, adaptive) {
  if (!profile) return false;
  if (profile.mode === "declared_dyslexic") return true;
  const n = (adaptive && adaptive.scoreHistory && adaptive.scoreHistory.length) || 0;
  return n >= 3;
}

async function applyColdStart(domain) {
  const profile = await getStored(PROFILE_KEY);
  if (!profile) return;
  ensureAdaptiveProfileShape(profile);
  if (profile.preferences && profile.preferences.applyImmediately === false) return;
  const adaptive = (await getStored(ADAPTIVE_KEY)) || { scoreHistory: [] };
  if (!profileIsEstablished(profile, adaptive)) return;

  const ctx = buildContext(profile, domain);
  const plan = AE.decideInterventions(profile.difficultyScore || 0, ctx);
  const applicable = notSuppressed(profile, domain, plan.newInterventions);
  if (!applicable.length) return;

  const prefs = profile.preferences || (profile.preferences = {});
  let changed = false;
  for (const iv of applicable) {
    if (applyPatch(prefs, iv.prefPatch)) changed = true;
    profile.adaptive.autoApplied[iv.type] = { tier: iv.tier, ts: Date.now(), domain, coldStart: true };
  }
  if (changed) {
    profile.updatedAt = new Date().toISOString();
    await setStored(PROFILE_KEY, profile);
    console.log("[DysAssist] Cold-start baseline applied for", domain, "tier", plan.tier);
  }
}

function hostnameOf(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab || !tab.url || !/^https?:/.test(tab.url)) return;
  applyColdStart(hostnameOf(tab.url));
});

// ---------------------------------------------------------------------------
// Onboarding + LLM proxy (unchanged behavior).
// ---------------------------------------------------------------------------
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
      chrome.storage.local.remove([PROFILE_KEY, ADAPTIVE_KEY], () => {
        sendResponse({ ok: true });
      });
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

    // --- adaptive engine messages -----------------------------------------
    case "FEATURE_SNAPSHOT":
      handleFeatureSnapshot(message.payload).then(sendResponse);
      return true;

    case "INTERVENTION_FEEDBACK":
      handleFeedback(message.payload).then(sendResponse);
      return true;

    case "REVERT_INTERVENTIONS":
      handleRevert(message.payload).then(sendResponse);
      return true;

    default:
      sendResponse({ error: "Unknown message type" });
      return false;
  }
});

async function injectReadingCss(tabId, css, sendResponse) {
  if (!tabId || !css) {
    sendResponse({ ok: false, error: "Missing tab id or css" });
    return;
  }
  try {
    await chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, css });
    sendResponse({ ok: true });
  } catch (error) {
    sendResponse({ ok: false, error: error?.message ?? String(error) });
  }
}

async function defineWord(word, context = "") {
  if (!word || word.trim().length < 2) return { ok: false, error: "Word too short" };
  const clean = word.toLowerCase().replace(/[^a-z'-]/g, "");
  try {
    const res = await fetch("http://127.0.0.1:8787/define", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: clean, context })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return { ok: true, result: data.result };
  } catch (err) {
    console.error("[DysAssist] Error fetching definition:", err.message);
    return { ok: false, error: err.message };
  }
}

async function simplifyText(text) {
  if (!text || text.trim().length < 10) return { ok: false, error: "Text too short to simplify" };
  try {
    const res = await fetch("http://127.0.0.1:8787/simplify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() })
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return { ok: true, result: data.result };
  } catch (err) {
    console.error("[DysAssist] Error simplifying text:", err.message);
    return { ok: false, error: err.message };
  }
}
