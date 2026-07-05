// signalCollector.js  (runtime content script — Weeks 2-4 deliverable)
// -----------------------------------------------------------------------------
// Watches how the user reads, converts raw events into a FeatureVector every
// 30 seconds, and sends it to the service worker (which scores it and decides
// whether to auto-apply interventions). Also renders the "we turned this on —
// Keep / Undo" toast and reports the accept/dismiss feedback back.
//
// Runs only in the top frame (content scripts default to all_frames:false).
// -----------------------------------------------------------------------------
(function () {
  "use strict";

  // Don't run inside the extension's own pages.
  if (location.protocol === "chrome-extension:") return;
  // Only meaningful on pages with real prose.
  if (!document.body) return;

  var CONFIG = {
    SCROLL_SAMPLE_MS: 150,
    REGRESSION_THRESHOLD_PERCENT: 15,
    REGRESSION_WINDOW_MS: 3000,
    FEATURE_INTERVAL_MS: 30000, // derive + send a FeatureVector every 30s
    MIN_PARA_WORDS: 12,
    FAST_WPM: 400,              // dwell shorter than this WPM implies "skimmed, not read"
    TOAST_TIMEOUT_MS: 14000
  };

  var wordFreq = (typeof window !== "undefined" && window.DysAssistWordFreq) || null;

  // --- Raw signal state (memory only) ----------------------------------------
  var state = {
    sessionStart: Date.now(),
    activeMs: 0,               // time the tab was focused
    lastActiveTick: Date.now(),
    scrollPositions: [],       // {y, t}
    lastScrollY: window.scrollY,
    regressionCount: 0,
    totalWordsSeen: 0,
    wordsRead: 0,              // words on paragraphs dwelled long enough to be "read"
    readingTimeSec: 0,         // dwell time on those paragraphs
    paragraphsEntered: 0,
    paragraphsCompleted: 0,
    copyCount: 0,
    lookupCount: 0,
    hoverDurations: [],
    domain: location.hostname
  };

  var enterTimes = new Map();
  var counted = new Set();

  // --- Track focused/active time so WPM & frequencies use real reading time ---
  function tickActive() {
    var now = Date.now();
    if (document.hasFocus() && document.visibilityState === "visible") {
      state.activeMs += now - state.lastActiveTick;
    }
    state.lastActiveTick = now;
  }
  setInterval(tickActive, 1000);

  // --- Scroll regression detector --------------------------------------------
  setInterval(function () {
    var now = Date.now();
    var y = window.scrollY;
    var vh = window.innerHeight || 800;
    state.scrollPositions.push({ y: y, t: now });
    state.scrollPositions = state.scrollPositions.filter(function (p) { return p.t > now - 30000; });

    var recent = state.scrollPositions.filter(function (p) { return p.t > now - CONFIG.REGRESSION_WINDOW_MS; });
    if (recent.length >= 2) {
      var first = recent[0];
      var threshold = (CONFIG.REGRESSION_THRESHOLD_PERCENT / 100) * vh;
      var wentDown = y > first.y;
      var goingUp = y < state.lastScrollY - threshold;
      if (!wentDown && goingUp) state.regressionCount++;
    }
    state.lastScrollY = y;
  }, CONFIG.SCROLL_SAMPLE_MS);

  // --- Paragraph dwell via IntersectionObserver ------------------------------
  function observeParagraphs() {
    var paras = document.querySelectorAll("p, article li, [data-da-chunk]");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        var id = el.__dysId;
        var words = el.__dysWords || 0;
        if (entry.isIntersecting) {
          enterTimes.set(id, Date.now());
          if (!counted.has(id)) { state.paragraphsEntered++; counted.add(id); }
        } else {
          var entered = enterTimes.get(id);
          if (entered) {
            var dwellSec = (Date.now() - entered) / 1000;
            enterTimes.delete(id);
            // Minimum time a fluent reader needs for this many words.
            var needSec = words / (CONFIG.FAST_WPM / 60);
            if (dwellSec >= needSec) {
              state.wordsRead += words;
              state.readingTimeSec += dwellSec;
              state.paragraphsCompleted++;
            }
          }
        }
      });
    }, { threshold: 0.5 });

    var idx = 0;
    paras.forEach(function (el) {
      var text = (el.textContent || "").trim();
      var words = text.split(/\s+/).filter(Boolean).length;
      if (words < CONFIG.MIN_PARA_WORDS) return;
      el.__dysId = "p" + (idx++);
      el.__dysWords = words;
      state.totalWordsSeen += words;
      io.observe(el);
    });
    return io;
  }
  var paraObserver = observeParagraphs();
  // Re-scan when the page mutates a lot (SPAs, lazy content).
  var rescanTimer = null;
  new MutationObserver(function () {
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(function () {
      try { paraObserver.disconnect(); } catch (e) {}
      paraObserver = observeParagraphs();
    }, 2000);
  }).observe(document.body, { childList: true, subtree: true });

  // --- Copy / lookup / hover signals -----------------------------------------
  document.addEventListener("copy", function () { state.copyCount++; });
  document.addEventListener("contextmenu", function () {
    var sel = (window.getSelection && window.getSelection().toString().trim()) || "";
    if (sel.length > 0 && sel.length < 60) state.lookupCount++;
  });

  var hoverStart = null;
  document.addEventListener("mouseover", function (e) {
    if (e.target && e.target.nodeType === 1 && /^(P|SPAN|LI|A|EM|STRONG)$/.test(e.target.tagName)) {
      hoverStart = Date.now();
    }
  });
  document.addEventListener("mouseout", function () {
    if (hoverStart) {
      var d = Date.now() - hoverStart;
      if (d > 400 && d < 15000) state.hoverDurations.push(d);
      hoverStart = null;
    }
  });

  // --- Sample the page's intrinsic vocabulary difficulty ----------------------
  function sampleVocabDifficulty() {
    if (!wordFreq) return 0;
    var paras = document.querySelectorAll("p");
    var sample = "";
    for (var i = 0; i < paras.length && sample.length < 4000; i++) {
      sample += " " + (paras[i].textContent || "");
    }
    return wordFreq.getDifficultyIndex(sample);
  }

  // --- Convert raw signals -> derived FeatureVector --------------------------
  function buildFeatureVector() {
    tickActive();
    var activeMin = Math.max(state.activeMs / 60000, 1 / 60);
    var wpm = state.readingTimeSec > 0
      ? Math.round(state.wordsRead / (state.readingTimeSec / 60))
      : 0;
    var regressionRate = state.totalWordsSeen > 0
      ? (state.regressionCount / state.totalWordsSeen) * 100
      : 0;
    var copyLookupFrequency = (state.copyCount + state.lookupCount) / activeMin;
    var completion = state.paragraphsEntered > 0
      ? state.paragraphsCompleted / state.paragraphsEntered
      : 1;

    return {
      readingSpeedWPM: wpm,
      regressionRate: Number(regressionRate.toFixed(2)),
      copyLookupFrequency: Number(copyLookupFrequency.toFixed(2)),
      paragraphCompletionRate: Number(completion.toFixed(2)),
      vocabularyDifficultyIndex: Number(sampleVocabDifficulty().toFixed(3)),
      sessionDurationSeconds: Math.round((Date.now() - state.sessionStart) / 1000),
      timestamp: Date.now(),
      domain: state.domain
    };
  }

  function sendFeatureVector() {
    var fv = buildFeatureVector();
    try {
      chrome.runtime.sendMessage({ type: "FEATURE_SNAPSHOT", payload: fv }, function (resp) {
        if (chrome.runtime.lastError) return; // service worker asleep / navigating
        if (resp && resp.newInterventions && resp.newInterventions.length) {
          showAdaptiveToast(resp);
        }
      });
    } catch (e) { /* extension context invalidated */ }
  }

  // First snapshot after 30s, then every 30s.
  setInterval(sendFeatureVector, CONFIG.FEATURE_INTERVAL_MS);

  // ---------------------------------------------------------------------------
  // Adaptive feedback toast — "we turned this on, Keep / Undo"
  // ---------------------------------------------------------------------------
  var activeToast = null;

  function reportFeedback(decision, interventions, scoreAtTime, shownAt) {
    try {
      chrome.runtime.sendMessage({
        type: "INTERVENTION_FEEDBACK",
        payload: {
          decision: decision, // 'accept' | 'dismiss' | 'ignore'
          interventions: interventions.map(function (i) { return i.type; }),
          domain: state.domain,
          scoreAtTime: scoreAtTime,
          dwellMsBeforeFeedback: Date.now() - shownAt
        }
      }, function () { void chrome.runtime.lastError; });
    } catch (e) { /* ignore */ }
  }

  function showAdaptiveToast(plan) {
    if (activeToast) return; // one at a time
    var interventions = plan.newInterventions;
    var shownAt = Date.now();

    var host = document.createElement("div");
    host.id = "dysassist-adaptive-toast";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    var shadow = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

    var list = interventions.map(function (i) {
      return '<li><strong>' + escapeHtml(i.label) + '</strong> — ' + escapeHtml(i.reason) + '</li>';
    }).join("");

    var scorePct = Math.round((plan.score || 0) * 100);
    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<style>' +
      '.da-card{position:fixed;right:18px;bottom:18px;z-index:2147483647;width:320px;' +
      'font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;background:#ffffff;color:#1d1b16;' +
      'border:1px solid #e4e0d5;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:16px 16px 12px;' +
      'animation:daIn .22s ease-out}' +
      '@keyframes daIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
      '.da-h{display:flex;align-items:center;gap:8px;font-weight:800;font-size:14px;margin-bottom:6px}' +
      '.da-badge{margin-left:auto;font-size:11px;font-weight:700;color:#534AB7;background:#efeefb;border-radius:999px;padding:2px 8px}' +
      '.da-sub{font-size:12px;color:#5b5343;margin:0 0 8px}' +
      '.da-list{margin:0 0 12px;padding-left:18px;font-size:12.5px;line-height:1.5}' +
      '.da-row{display:flex;gap:8px}' +
      '.da-btn{flex:1;border:0;border-radius:9px;padding:8px 10px;font-weight:700;font-size:13px;cursor:pointer}' +
      '.da-keep{background:#1D9E75;color:#fff}.da-keep:hover{background:#178a65}' +
      '.da-undo{background:#f1efe9;color:#1d1b16}.da-undo:hover{background:#e6e3da}' +
      '</style>' +
      '<div class="da-card">' +
      '<div class="da-h"><span>DysAssist adapted this page</span><span class="da-badge">difficulty ' + scorePct + '%</span></div>' +
      '<p class="da-sub">This page looked hard to read, so I turned on:</p>' +
      '<ul class="da-list">' + list + '</ul>' +
      '<div class="da-row">' +
      '<button class="da-btn da-keep" id="da-keep">Keep</button>' +
      '<button class="da-btn da-undo" id="da-undo">Undo</button>' +
      '</div></div>';
    shadow.appendChild(wrap);
    document.documentElement.appendChild(host);
    activeToast = host;

    var settled = false;
    function close(decision) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reportFeedback(decision, interventions, plan.score, shownAt);
      if (decision === "dismiss") {
        // Ask the worker to revert the just-applied preference flags.
        try {
          chrome.runtime.sendMessage({
            type: "REVERT_INTERVENTIONS",
            payload: { interventions: interventions.map(function (i) { return i.type; }) }
          }, function () { void chrome.runtime.lastError; });
        } catch (e) {}
      }
      host.remove();
      activeToast = null;
    }

    shadow.querySelector("#da-keep").addEventListener("click", function () { close("accept"); });
    shadow.querySelector("#da-undo").addEventListener("click", function () { close("dismiss"); });
    var timer = setTimeout(function () { close("ignore"); }, CONFIG.TOAST_TIMEOUT_MS);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Expose hooks for debugging / the live demo.
  //   DysAssistSignals.snapshot()      -> the current derived FeatureVector
  //   DysAssistSignals.forceSnapshot() -> send it to the engine NOW (skip the 30s wait)
  //   DysAssistSignals.simulate(fv)    -> push a fake FeatureVector to demo the decision agent
  window.DysAssistSignals = {
    snapshot: buildFeatureVector,
    raw: function () { return state; },
    forceSnapshot: sendFeatureVector,
    simulate: function (overrides) {
      var fv = Object.assign(buildFeatureVector(), overrides || {});
      try {
        chrome.runtime.sendMessage({ type: "FEATURE_SNAPSHOT", payload: fv }, function (resp) {
          if (chrome.runtime.lastError) return;
          if (resp && resp.newInterventions && resp.newInterventions.length) showAdaptiveToast(resp);
        });
      } catch (e) {}
      return fv;
    }
  };
})();
