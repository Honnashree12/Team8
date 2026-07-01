/**
 * DysAssist NotificationUI
 *
 * Week 4 — Honnashree
 *
 * Shows a non-intrusive banner asking the user if they want adjustments
 * applied when the difficulty score crosses a threshold. Tracks the
 * accept / dismiss / ignore outcome into profile.interventionHistory so
 * Saanvi's feedback-weighting module (Week 4) can read it directly.
 *
 * Also owns:
 *   - 30s soft-dismiss timer (dismissing without a decision counts as "ignored")
 *   - Undo button (reverts whatever the notification just turned on)
 *   - Original-text toggle injected onto every simplified paragraph
 *     (paragraphs marked with [data-da-simplified] by Manoj's /simplify pipeline)
 *
 * Public API mirrors the other window.DysAssistX modules in this codebase:
 *   window.DysAssistNotify.offer(reason)   → shows the banner
 *   window.DysAssistNotify.dismissAll()    → hides banner, clears timers
 *   window.DysAssistNotify.isShowing()
 */

window.DysAssistNotify = (() => {

  // ─── STATE ──────────────────────────────────────────────────────────────
  let bannerEl = null;
  let softDismissTimer = null;
  let currentInterventionKey = null;
  let undoSnapshot = null; // { type, before } — what to restore on Undo

  const SOFT_DISMISS_MS = 30000;
  const BANNER_ID = "dysassist-notify-banner";
  const STYLE_ID = "dysassist-notify-style";

  // ─── Styles — injected once, matches the dark popup theme ────────────────
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BANNER_ID} {
        position: fixed;
        bottom: 18px;
        left: 50%;
        transform: translateX(-50%) translateY(8px);
        z-index: 2147483000;
        background: #161925;
        border: 1px solid #1e293b;
        border-radius: 14px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 420px;
        width: calc(100% - 32px);
        font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        opacity: 0;
        transition: opacity 0.25s ease, transform 0.25s ease;
        pointer-events: none;
      }
      #${BANNER_ID}.da-notify-visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
        pointer-events: auto;
      }
      #${BANNER_ID} .da-notify-icon {
        font-size: 20px;
        flex-shrink: 0;
      }
      #${BANNER_ID} .da-notify-body {
        flex: 1;
        min-width: 0;
      }
      #${BANNER_ID} .da-notify-text {
        font-size: 12px;
        font-weight: 600;
        color: #e2e8f0;
        line-height: 1.4;
        margin: 0;
      }
      #${BANNER_ID} .da-notify-sub {
        font-size: 10px;
        color: #64748b;
        margin-top: 2px;
      }
      #${BANNER_ID} .da-notify-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
      }
      #${BANNER_ID} button {
        font-family: inherit;
        font-size: 11px;
        font-weight: 700;
        border-radius: 8px;
        padding: 7px 11px;
        cursor: pointer;
        border: 1px solid #1e293b;
        transition: all 0.15s ease;
        white-space: nowrap;
      }
      #${BANNER_ID} .da-notify-accept {
        background: #0082f0;
        color: #fff;
        border-color: #0082f0;
      }
      #${BANNER_ID} .da-notify-accept:hover { background: #0070d6; }
      #${BANNER_ID} .da-notify-dismiss {
        background: #1c2030;
        color: #94a3b8;
      }
      #${BANNER_ID} .da-notify-dismiss:hover { background: #232838; color: #cbd5e1; }
      #${BANNER_ID} .da-notify-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: #0082f0;
        border-radius: 0 0 14px 14px;
        transition: width linear;
      }

      /* Undo toast — separate small pill, shown after an accept */
      #dysassist-undo-toast {
        position: fixed;
        bottom: 18px;
        left: 50%;
        transform: translateX(-50%) translateY(8px);
        z-index: 2147483000;
        background: #161925;
        border: 1px solid #1e293b;
        border-radius: 99px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        padding: 9px 9px 9px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        font-weight: 600;
        color: #cbd5e1;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
        pointer-events: none;
      }
      #dysassist-undo-toast.da-notify-visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
        pointer-events: auto;
      }
      #dysassist-undo-toast button {
        font-family: inherit;
        font-size: 11px;
        font-weight: 700;
        color: #0082f0;
        background: rgba(0,130,240,0.12);
        border: none;
        border-radius: 99px;
        padding: 6px 12px;
        cursor: pointer;
      }
      #dysassist-undo-toast button:hover { background: rgba(0,130,240,0.22); }

      /* Original-text toggle — attached to simplified paragraphs */
      .da-original-toggle {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 10px;
        font-weight: 700;
        color: #0082f0;
        background: rgba(0,130,240,0.08);
        border: 1px solid rgba(0,130,240,0.25);
        border-radius: 6px;
        padding: 2px 7px;
        margin-left: 6px;
        cursor: pointer;
        vertical-align: middle;
        user-select: none;
      }
      .da-original-toggle:hover { background: rgba(0,130,240,0.16); }
    `;
    document.head.appendChild(style);
  }

  // ─── Storage helpers ────────────────────────────────────────────────────
  function getProfile() {
    return new Promise(resolve => {
      chrome.storage.local.get("userProfile", result => resolve(result.userProfile ?? null));
    });
  }

  function saveProfile(profile) {
    return new Promise(resolve => {
      chrome.storage.local.set({ userProfile: profile }, resolve);
    });
  }

  // ─── Week 4 (Saanvi): rich feedback recording ─────────────────────────────
  // Records the outcome into profile.interventionHistory with full metadata:
  // difficultyScoreAtTime, per-action counts, quick-dismiss telemetry.
  // Also forwards to background.js for authoritative domain-learning.
  async function recordOutcome(key, action, quickDismiss = false) {
    const profile = await getProfile();
    if (!profile) return;
    if (!profile.interventionHistory) profile.interventionHistory = {};

    const now = Date.now();
    const existing = profile.interventionHistory[key] ?? {
      level: key === "tier3" ? 3 : key === "tier2" ? 2 : 1,
      lastOffered: now,
      lastAction: null,
      weight: 0.5,
      acceptCount: 0,
      dismissCount: 0,
      ignoreCount: 0,
      difficultyScoreAtTime: profile.difficultyScore ?? 0.5,
    };

    // Weight nudge (background does authoritative update; this keeps local history consistent)
    let weight = existing.weight ?? 0.5;
    if (action === "accepted") weight = Math.min(1, weight + 0.15);
    else if (action === "dismissed") {
      weight = Math.max(0, weight - 0.15);
      if (quickDismiss) weight = Math.min(1, weight + 0.05); // partial restore for false-positive
    } else if (action === "ignored") {
      weight = Math.max(0, weight - 0.05);
    }

    profile.interventionHistory[key] = {
      ...existing,
      lastAction: action,
      lastOffered: now,
      weight,
      acceptCount:  (existing.acceptCount  ?? 0) + (action === "accepted"  ? 1 : 0),
      dismissCount: (existing.dismissCount ?? 0) + (action === "dismissed" ? 1 : 0),
      ignoreCount:  (existing.ignoreCount  ?? 0) + (action === "ignored"   ? 1 : 0),
      // difficultyScoreAtTime is saved on dismissal so the decision agent can re-offer
      // only when the score rises ≥ 0.15 above the dismissal baseline.
      difficultyScoreAtTime: action === "dismissed"
        ? (profile.difficultyScore ?? existing.difficultyScoreAtTime ?? 0.5)
        : existing.difficultyScoreAtTime,
      quickDismissCount: (existing.quickDismissCount ?? 0) + (quickDismiss ? 1 : 0),
    };
    profile.updatedAt = new Date().toISOString();
    await saveProfile(profile);

    // Forward to background for domain-learning & neural scorer update
    try {
      chrome.runtime.sendMessage({
        type: "RECORD_INTERVENTION_FEEDBACK",
        payload: {
          tier: key,
          action,
          domain: location.hostname,
          score: profile.difficultyScore ?? 0.5,
          quickDismiss,
        },
      });
    } catch (_) { /* service worker may be inactive — background will catch up on next load */ }
  }

  // ─── Soft-dismiss timer ─────────────────────────────────────────────────
  function startSoftDismissTimer(key) {
    clearSoftDismissTimer();
    const progressEl = bannerEl?.querySelector(".da-notify-progress");
    if (progressEl) {
      progressEl.style.width = "100%";
      // force reflow so the transition actually animates from 100% → 0%
      void progressEl.offsetWidth;
      progressEl.style.transitionDuration = `${SOFT_DISMISS_MS}ms`;
      progressEl.style.width = "0%";
    }
    softDismissTimer = setTimeout(() => {
      // No explicit user action within 30s — counts as "ignored"
      recordOutcome(key, "ignored");
      hideBanner();
    }, SOFT_DISMISS_MS);
  }

  function clearSoftDismissTimer() {
    if (softDismissTimer) {
      clearTimeout(softDismissTimer);
      softDismissTimer = null;
    }
  }

  // ─── Banner show/hide ───────────────────────────────────────────────────
  function buildBanner() {
    if (bannerEl) return bannerEl;
    ensureStyles();

    bannerEl = document.createElement("div");
    bannerEl.id = BANNER_ID;
    bannerEl.innerHTML = `
      <span class="da-notify-icon">💡</span>
      <div class="da-notify-body">
        <p class="da-notify-text">Reading seems harder on this page — want us to adjust it?</p>
        <p class="da-notify-sub">Font, spacing, and tint will be tuned automatically</p>
      </div>
      <div class="da-notify-actions">
        <button class="da-notify-accept" type="button">Yes, adjust</button>
        <button class="da-notify-dismiss" type="button">Not now</button>
      </div>
      <div class="da-notify-progress" style="width:100%;"></div>
    `;
    document.body.appendChild(bannerEl);

    bannerEl.querySelector(".da-notify-accept").addEventListener("click", handleAccept);
    bannerEl.querySelector(".da-notify-dismiss").addEventListener("click", handleDismiss);

    return bannerEl;
  }

  // Track when the banner became visible — used to detect quick dismissals (< 5 s)
  let bannerShownAt = null;

  function showBanner() {
    buildBanner();
    bannerShownAt = Date.now();
    requestAnimationFrame(() => bannerEl.classList.add("da-notify-visible"));
  }

  function hideBanner() {
    clearSoftDismissTimer();
    if (bannerEl) {
      bannerEl.classList.remove("da-notify-visible");
    }
    currentInterventionKey = null;
  }

  // ─── Accept / Dismiss handlers ──────────────────────────────────────────
  async function handleAccept() {
    if (!currentInterventionKey) return;
    const key = currentInterventionKey;
    clearSoftDismissTimer();

    // Snapshot current preferences so Undo can revert exactly this change
    const profile = await getProfile();
    undoSnapshot = {
      key,
      beforePreferences: profile ? JSON.parse(JSON.stringify(profile.preferences)) : null,
    };

    await recordOutcome(key, "accepted");
    await applyAdjustments(key);

    hideBanner();
    showUndoToast();
  }

  async function handleDismiss() {
    if (!currentInterventionKey) return;
    const key = currentInterventionKey;
    clearSoftDismissTimer();
    // Quick dismiss: user closed within 5 seconds of the banner appearing.
    // This is a false-positive signal — penalise less and note in telemetry.
    const quickDismiss = bannerShownAt !== null && (Date.now() - bannerShownAt) < 5000;
    bannerShownAt = null;
    await recordOutcome(key, "dismissed", quickDismiss);
    hideBanner();
  }
  // Applies adjustments when the user accepts.
  async function applyAdjustments(key) {
    const profile = await getProfile();
    if (!profile) return;
    if (!profile.preferences) profile.preferences = {};

    profile.preferences.font = "lexend";
    profile.preferences.lineHeight = "1.7";
    profile.preferences.letterSpacing = "0.045em";
    profile.preferences.overlayToggleOn = true;
    profile.preferences.backgroundTint = profile.preferences.backgroundTint && profile.preferences.backgroundTint !== "none"
      ? profile.preferences.backgroundTint
      : "cream";

    // If they accepted Tier 2, enable structural interventions
    if (key === "tier2") {
      profile.preferences.chunkingEnabled = true;
      profile.preferences.rulerEnabled = true;
      profile.preferences.focusEnabled = true;
    }
    // If they accepted Tier 3, enable full assistance
    if (key === "tier3") {
      profile.preferences.vocabEnabled = true;
      profile.preferences.ttsEnabled = true;
    }

    profile.updatedAt = new Date().toISOString();
    await saveProfile(profile);
  }

  // ─── Undo toast ─────────────────────────────────────────────────────────
  function showUndoToast() {
    let toast = document.getElementById("dysassist-undo-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "dysassist-undo-toast";
      toast.innerHTML = `
        <span>Adjustments applied</span>
        <button type="button">Undo</button>
      `;
      document.body.appendChild(toast);
      toast.querySelector("button").addEventListener("click", handleUndo);
    }
    requestAnimationFrame(() => toast.classList.add("da-notify-visible"));

    // Auto-hide the undo option after 8s so it doesn't linger forever
    setTimeout(() => {
      toast.classList.remove("da-notify-visible");
    }, 8000);
  }

  async function handleUndo() {
    if (!undoSnapshot || !undoSnapshot.beforePreferences) return;
    const profile = await getProfile();
    if (!profile) return;

    profile.preferences = undoSnapshot.beforePreferences;
    profile.updatedAt = new Date().toISOString();
    await saveProfile(profile);

    if (undoSnapshot.key) {
      await recordOutcome(undoSnapshot.key, "dismissed"); // treat undo same as a dismiss for learning purposes
    }

    undoSnapshot = null;
    document.getElementById("dysassist-undo-toast")?.classList.remove("da-notify-visible");
  }

  // ─── Original-text toggle on simplified paragraphs ─────────────────────
  // Manoj's /simplify pipeline marks simplified paragraphs with
  // data-da-simplified="true" and stores the original in data-da-original.
  // This module just attaches the toggle UI — it doesn't do the simplification.
  function attachOriginalToggles() {
    const simplified = document.querySelectorAll("[data-da-simplified='true']:not([data-da-toggle-attached])");
    simplified.forEach(el => {
      el.dataset.daToggleAttached = "true";

      const simplifiedHTML = el.innerHTML;
      const originalText = el.dataset.daOriginal || "";
      let showingOriginal = false;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "da-original-toggle";
      toggle.textContent = "Show original";
      toggle.setAttribute("aria-label", "Toggle between simplified and original text");

      function render() {
        if (showingOriginal) {
          const textNode = document.createElement("span");
          textNode.textContent = originalText;
          el.innerHTML = "";
          el.appendChild(textNode);
          toggle.textContent = "Show simplified";
        } else {
          el.innerHTML = simplifiedHTML;
          toggle.textContent = "Show original";
        }
        el.appendChild(toggle);
      }

      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        showingOriginal = !showingOriginal;
        render();
      });

      el.appendChild(toggle);
    });
  }

  // Re-scan periodically for newly simplified paragraphs (cheap, debounced by caller)
  function refreshOriginalToggles() {
    attachOriginalToggles();
  }

  // ─── Public: offer a notification ──────────────────────────────────────
  // reason: short string describing why, e.g. "high_difficulty_score"
  // Used as the interventionHistory key so repeated offers of the same
  // type accumulate weight correctly.
  function offer(reason = "general_difficulty") {
    if (bannerEl && bannerEl.classList.contains("da-notify-visible")) return; // already showing one
    currentInterventionKey = reason;
    showBanner();
    startSoftDismissTimer(reason);
  }

  function dismissAll() {
    hideBanner();
  }

  function isShowing() {
    return !!(bannerEl && bannerEl.classList.contains("da-notify-visible"));
  }

  return {
    offer,
    dismissAll,
    isShowing,
    refreshOriginalToggles,
  };
})();
