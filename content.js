let isApplyingChanges = false;
let observer = null;

const DYSASSIST_STYLE_ID = "dysassist-reading-theme";
const DYSASSIST_OVERLAY_ID = "dysassist-page-tint";
const DEFAULT_PREFERENCES = {
  font: "lexend",
  backgroundTint: "cream",
  lineHeight: "relaxed",
  letterSpacing: "wide",
  hideMedia: false,
  overlayOpacity: 0.18,
  readingModeEnabled: false
};

function getTheme(profile) {
  const preferences = { ...DEFAULT_PREFERENCES, ...(profile?.preferences ?? {}) };
  const useOpenDyslexic = preferences.font === "opendyslexic";
  const fontFamily = preferences.font === "system"
    ? "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    : useOpenDyslexic
      ? "'OpenDyslexic', 'Lexend', Arial, sans-serif"
      : "'Lexend', Arial, sans-serif";

  return {
    fontFamily,
    background: {
      cream: "#fff8dc",
      blue: "#e8f4fd",
      green: "#edfaf1",
      yellow: "#fef9c3",
      none: "#ffffff"
    }[preferences.backgroundTint] ?? "#ffffff",
    text: "#1d1b16",
    mutedText: "#5b5343",
    lineHeight: {
      normal: "normal",
      relaxed: "1.7",
      loose: "1.9"
    }[preferences.lineHeight] ?? preferences.lineHeight ?? "normal",
    letterSpacing: {
      normal: "normal",
      wide: "0.045em",
      wider: "0.075em"
    }[preferences.letterSpacing] ?? preferences.letterSpacing ?? "normal",
    overlayOpacity: preferences.backgroundTint === "none" ? 0 : (preferences.overlayOpacity ?? 0.18)
  };
}

function buildReadingCss(theme) {
  return `
    @font-face {
      font-family: 'Lexend';
      src: url('${chrome.runtime.getURL("assets/Lexend-Regular.woff2")}') format('woff2');
      font-weight: normal;
      font-style: normal;
    }

    @font-face {
      font-family: 'OpenDyslexic';
      src: url('${chrome.runtime.getURL("assets/OpenDyslexic-Regular.woff")}') format('woff');
      font-weight: normal;
      font-style: normal;
    }

    @font-face {
      font-family: 'OpenDyslexic';
      src: url('${chrome.runtime.getURL("assets/OpenDyslexic-Bold.woff")}') format('woff');
      font-weight: bold;
      font-style: normal;
    }

    @font-face {
      font-family: 'OpenDyslexic';
      src: url('${chrome.runtime.getURL("assets/OpenDyslexic-Italic.woff")}') format('woff');
      font-weight: normal;
      font-style: italic;
    }

    html, body, body * {
      font-family: ${theme.fontFamily} !important;
      line-height: ${theme.lineHeight} !important;
      letter-spacing: ${theme.letterSpacing} !important;
      word-spacing: 0.12em !important;
      text-shadow: none !important;
    }

    html, body {
      background: ${theme.background} !important;
      color: ${theme.text} !important;
    }

    body, main, article, section, aside, nav, header, footer,
    div, p, li, blockquote, table, td, th, form, label,
    input, textarea, select, button {
      background-color: ${theme.background} !important;
      color: ${theme.text} !important;
      background-image: none !important;
      box-shadow: none !important;
    }

    a, a *, [role="link"], [role="link"] * {
      color: #064f7d !important;
    }

    h1, h2, h3, h4, h5, h6, strong, b, em, span, small, code, pre {
      color: ${theme.text} !important;
    }

    input, textarea, select, button {
      border-color: #5b5343 !important;
    }

    ::selection {
      background: #2f6f9f !important;
      color: #ffffff !important;
    }

    [data-dysassist-readable="true"] {
      color: ${theme.text} !important;
      background-color: ${theme.background} !important;
    }

    #${DYSASSIST_OVERLAY_ID} {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483646 !important;
      pointer-events: none !important;
      background: ${theme.background} !important;
      opacity: ${theme.overlayOpacity} !important;
      mix-blend-mode: multiply !important;
    }

    #dysassist-reader-view {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background-color: ${theme.background} !important;
      color: ${theme.text} !important;
      overflow-y: auto !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      padding: 60px 24px !important;
      box-sizing: border-box !important;
      animation: dysassist-fade-in 0.2s ease-out !important;
    }

    @keyframes dysassist-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0);    }
    }

    #dysassist-reader-view .reader-container {
      width: 100% !important;
      max-width: 720px !important;
      margin: 0 auto !important;
    }

    #dysassist-reader-view .reader-header {
      margin-bottom: 32px !important;
      border-bottom: 1px solid rgba(0,0,0,0.1) !important;
      padding-bottom: 24px !important;
    }

    #dysassist-reader-view .reader-domain {
      font-size: 0.85rem !important;
      text-transform: uppercase !important;
      letter-spacing: 0.15em !important;
      color: ${theme.mutedText || '#6b7280'} !important;
      margin-bottom: 8px !important;
      font-weight: 700 !important;
    }

    #dysassist-reader-view .reader-title {
      font-size: 2.5rem !important;
      font-weight: 800 !important;
      line-height: 1.25 !important;
      color: ${theme.text} !important;
      margin: 0 !important;
    }

    #dysassist-reader-view .reader-close-btn {
      position: fixed !important;
      top: 24px !important;
      right: 24px !important;
      width: 44px !important;
      height: 44px !important;
      border-radius: 50% !important;
      background-color: rgba(0,0,0,0.05) !important;
      border: 1px solid rgba(0,0,0,0.1) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      z-index: 2147483647 !important;
      color: ${theme.text} !important;
    }

    #dysassist-reader-view .reader-close-btn:hover {
      background-color: rgba(0,0,0,0.1) !important;
      transform: scale(1.05) !important;
    }

    #dysassist-reader-view .reader-content { font-size: 1.35rem !important; }

    #dysassist-reader-view .reader-content p {
      margin-bottom: 1.6em !important;
      text-align: left !important;
    }

    #dysassist-reader-view .reader-content h1,
    #dysassist-reader-view .reader-content h2,
    #dysassist-reader-view .reader-content h3 {
      font-weight: 700 !important;
      margin-top: 1.8em !important;
      margin-bottom: 0.8em !important;
      line-height: 1.3 !important;
    }

    #dysassist-reader-view .reader-content h1 { font-size: 1.8rem !important; }
    #dysassist-reader-view .reader-content h2 { font-size: 1.5rem !important; }
    #dysassist-reader-view .reader-content h3 { font-size: 1.3rem !important; }

    #dysassist-reader-view .reader-content img {
      max-width: 100% !important;
      height: auto !important;
      border-radius: 12px !important;
      margin: 24px 0 !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
    }

    #dysassist-reader-view .reader-content ul,
    #dysassist-reader-view .reader-content ol {
      margin-left: 24px !important;
      margin-bottom: 1.6em !important;
      list-style-position: outside !important;
    }

    #dysassist-reader-view .reader-content ul  { list-style-type: disc    !important; }
    #dysassist-reader-view .reader-content ol  { list-style-type: decimal !important; }
    #dysassist-reader-view .reader-content li  { margin-bottom: 0.6em     !important; }
  `;
}

async function getProfile() {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get("userProfile", result => {
        resolve(result.userProfile ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

function installLocalStyle(css) {
  let style = document.getElementById(DYSASSIST_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = DYSASSIST_STYLE_ID;
    document.documentElement.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

function requestScriptingCss(css) {
  try {
    chrome.runtime.sendMessage({ type: "APPLY_READING_THEME_CSS", css }, () => {});
  } catch {}
}

function ensureTintOverlay() {
  if (document.getElementById(DYSASSIST_OVERLAY_ID)) return;
  const overlay = document.createElement("div");
  overlay.id = DYSASSIST_OVERLAY_ID;
  overlay.setAttribute("aria-hidden", "true");
  document.documentElement.appendChild(overlay);
}

function removeReadingTheme() {
  document.getElementById(DYSASSIST_STYLE_ID)?.remove();
  document.getElementById(DYSASSIST_OVERLAY_ID)?.remove();
  document.querySelectorAll("[data-dysassist-hidden-media='true']").forEach(el => {
    el.removeAttribute("data-dysassist-hidden-media");
    el.style.removeProperty("display");
    el.style.removeProperty("visibility");
    el.style.removeProperty("opacity");
  });
  window.DysAssistChunker?.reset();
  window.DysAssistRuler?.disable();
  window.DysAssistFocus?.disable();
  window.DysAssistTTS?.stop();
}

function shouldApplyReadingTheme(profile) {
  return profile?.preferences?.applyImmediately !== false;
}

function removeMedia() {
  document.querySelectorAll(
    "img,picture,svg,canvas,video,iframe,embed,object,figure,[role='img']"
  ).forEach(el => {
    if (el.id === DYSASSIST_OVERLAY_ID) return;
    el.setAttribute("data-dysassist-hidden-media", "true");
    el.style.setProperty("display",     "none",   "important");
    el.style.setProperty("visibility",  "hidden", "important");
    el.style.setProperty("opacity",     "0",      "important");
  });
}

function restoreHiddenMedia() {
  document.querySelectorAll("[data-dysassist-hidden-media='true']").forEach(el => {
    el.removeAttribute("data-dysassist-hidden-media");
    el.style.removeProperty("display");
    el.style.removeProperty("visibility");
    el.style.removeProperty("opacity");
  });
}

function extractReadableElements() {
  if (typeof globalThis.DysAssistReadability !== "function") return [];
  const parser = new globalThis.DysAssistReadability(document);
  const selected = parser.parse().candidates.slice(0, 250).map(c => c.element);
  selected.forEach((el, i) => {
    el.dataset.dysassistReadable = "true";
    el.dataset.readId ||= `r-${i}`;
  });
  return selected;
}

function showReaderOverlay(profile) {
  if (document.getElementById("dysassist-reader-view")) return;

  const readerView = document.createElement("div");
  readerView.id = "dysassist-reader-view";
  document.body.appendChild(readerView);
  document.body.style.setProperty("overflow", "hidden", "important");

  const parser  = new globalThis.DysAssistReadability(document);
  const parsed  = parser.parse();
  const title   = parsed.title || document.title;
  const domain  = window.location.hostname;

  readerView.innerHTML = `
    <button class="reader-close-btn" id="dysassist-close-reader" aria-label="Close reader">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
    <div class="reader-container">
      <div class="reader-header">
        <div class="reader-domain">${domain}</div>
        <h1 class="reader-title">${title}</h1>
      </div>
      <div class="reader-content" id="dysassist-reader-content-target"></div>
    </div>
  `;

  const target = readerView.querySelector("#dysassist-reader-content-target");
  const candidates = parsed.candidates;

  if (candidates && candidates.length > 0) {
    const tagsToKeep = ["p","h1","h2","h3","h4","h5","h6","blockquote","ul","ol","li","img"];
    const topCandidates = candidates.filter(c =>
      !candidates.some(other => other !== c && other.element.contains(c.element))
    );
    topCandidates.forEach(c => {
      const clone = c.element.cloneNode(true);
      const topLevel = Array.from(clone.querySelectorAll(tagsToKeep.join(","))).filter(el => {
        let p = el.parentNode;
        while (p && p !== clone) {
          if (tagsToKeep.includes(p.tagName.toLowerCase())) return false;
          p = p.parentNode;
        }
        return true;
      });
      topLevel.forEach(el => {
        const clean = el.cloneNode(true);
        clean.removeAttribute("style");
        clean.removeAttribute("class");
        clean.removeAttribute("id");
        clean.querySelectorAll("*").forEach(ch => {
          ch.removeAttribute("style");
          ch.removeAttribute("class");
          ch.removeAttribute("id");
        });
        clean.querySelectorAll("a").forEach(a => {
          a.style.setProperty("color",           "#064f7d",    "important");
          a.style.setProperty("text-decoration", "underline",  "important");
        });
        target.appendChild(clean);
      });
    });
  } else {
    const fb = document.createElement("p");
    fb.textContent = "No main article content could be detected on this page. Showing raw text paragraphs instead:";
    fb.style.setProperty("font-style", "italic",  "important");
    fb.style.setProperty("opacity",    "0.7",     "important");
    target.appendChild(fb);

    let added = false;
    document.querySelectorAll("p").forEach(p => {
      if (p.innerText.trim().length > 20 && !p.closest("#dysassist-reader-view")) {
        const clone = p.cloneNode(true);
        clone.removeAttribute("style");
        clone.removeAttribute("class");
        target.appendChild(clone);
        added = true;
      }
    });
    if (!added) {
      const msg = document.createElement("p");
      msg.textContent = "Could not extract readable text from this page.";
      target.appendChild(msg);
    }
  }

  document.getElementById("dysassist-close-reader").addEventListener("click", () => {
    hideReaderOverlay();
    chrome.storage.local.get("userProfile", result => {
      const cur = result.userProfile;
      if (cur?.preferences) {
        cur.preferences.readingModeEnabled = false;
        cur.updatedAt = new Date().toISOString();
        chrome.storage.local.set({ userProfile: cur });
      }
    });
  });
}

function hideReaderOverlay() {
  document.getElementById("dysassist-reader-view")?.remove();
  document.body.style.removeProperty("overflow");
}

// ─── Main orchestrator ────────────────────────────────────────────────────────
async function processPage() {
  if (isApplyingChanges) return;
  isApplyingChanges = true;

  if (observer) {
    try { observer.disconnect(); } catch (e) {}
  }

  try {
    const profile = await getProfile();
    if (!profile) {
      removeReadingTheme();
      hideReaderOverlay();
      return;
    }

    extractReadableElements();

    if (!profile.preferences || !shouldApplyReadingTheme(profile)) {
      restoreHiddenMedia();
      hideReaderOverlay();
      removeReadingTheme();
      return;
    }

    const theme = getTheme(profile);
    const css   = buildReadingCss(theme);
    installLocalStyle(css);
    requestScriptingCss(css);
    ensureTintOverlay();

    if (profile.preferences.hideMedia) {
      removeMedia();
    } else {
      restoreHiddenMedia();
    }

    // Handle Paragraph Chunking
    if (profile.preferences.chunkingEnabled) {
      window.DysAssistChunker?.chunkDocument(profile.preferences);
    } else {
      window.DysAssistChunker?.reset();
    }

    // Handle Reading Ruler
    if (profile.preferences.rulerEnabled) {
      window.DysAssistRuler?.enable(profile.preferences);
    } else {
      window.DysAssistRuler?.disable();
    }

    // Handle Focus Mode
    if (profile.preferences.focusEnabled) {
      window.DysAssistFocus?.enable(profile.preferences);
    } else {
      window.DysAssistFocus?.disable();
    }

    // Handle Reading Mode
    if (profile.preferences.readingModeEnabled) {
      showReaderOverlay(profile);
    } else {
      hideReaderOverlay();
    }

    // Handle Text-to-Speech Settings
    if (profile.preferences) {
      window.DysAssistTTS?.updateSettings(profile.preferences);
    }

    // ── Week 4 — Honnashree: Notification UI trigger ──────────────────────
    if (window.DysAssistNotify) {
      const NOTIFY_THRESHOLD    = 0.6;
      const NOTIFY_COOLDOWN_MS  = 5 * 60 * 1000; // 5 minutes between offers

      const score = profile.difficultyScore ?? 0;
      const lastOfferedAny = Object.values(profile.interventionHistory ?? {})
        .reduce((latest, h) => Math.max(latest, h.lastOffered ?? 0), 0);
      const cooldownOver = (Date.now() - lastOfferedAny) > NOTIFY_COOLDOWN_MS;

      if (score >= NOTIFY_THRESHOLD && cooldownOver && !window.DysAssistNotify.isShowing()) {
        window.DysAssistNotify.offer("high_difficulty_score");
      }

      // Attach "Show original" toggles to any simplified paragraphs Manoj's
      // /simplify pipeline may have added (marked data-da-simplified="true")
      window.DysAssistNotify.refreshOriginalToggles();
    }
    // ── end Week 4 ────────────────────────────────────────────────────────

  } finally {
    isApplyingChanges = false;
    if (observer) {
      try {
        observer.observe(document.documentElement, { childList: true, subtree: true });
      } catch (e) {}
    }
  }
}

function debounce(fn, delay) {
  let timeoutId;
  return () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(fn, delay);
  };
}

const scheduleReapply = debounce(() => {
  if (isApplyingChanges) return;
  processPage();
}, 150);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", processPage, { once: true });
} else {
  processPage();
}

observer = new MutationObserver(scheduleReapply);
observer.observe(document.documentElement, { childList: true, subtree: true });

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.userProfile) {
    processPage();
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TTS_TEST") {
    const firstPara = document.querySelector("p, [data-da-chunk]");
    if (firstPara) window.DysAssistTTS?.speak(firstPara);
  }
});

// ── Week 3 — Honnashree: lightweight session recorder ─────────────────────
(function () {
  const PROFILE_KEY = "userProfile";
  const pageStart   = Date.now();

  function getTaggedWordCount() {
    let total = 0;
    document.querySelectorAll("[data-read-id], [data-da-chunk]").forEach(el => {
      total += (el.innerText || el.textContent || "").trim().split(/\s+/).filter(Boolean).length;
    });
    return total;
  }

  function recordSession(profile, record) {
    if (!profile.sessionHistory) profile.sessionHistory = [];
    if (!profile.domainStats)    profile.domainStats    = {};

    profile.sessionHistory.push(record);
    if (profile.sessionHistory.length > 200) {
      profile.sessionHistory = profile.sessionHistory.slice(-200);
    }

    const ex     = profile.domainStats[record.domain];
    const visits = (ex?.visits ?? 0) + 1;
    profile.domainStats[record.domain] = {
      domain:               record.domain,
      visits,
      avgReadingSpeedWpm:   ex ? (ex.avgReadingSpeedWpm * ex.visits + record.readingSpeedWpm) / visits : record.readingSpeedWpm,
      avgDifficultyScore:   ex ? (ex.avgDifficultyScore * ex.visits + record.difficultyScore) / visits : record.difficultyScore,
      interventionsOffered: ex?.interventionsOffered ?? 0,
      interventionsAccepted:ex?.interventionsAccepted ?? 0,
      lastVisited:          record.timestamp,
    };
    profile.updatedAt = new Date().toISOString();
    return profile;
  }

  window.addEventListener("beforeunload", () => {
    const seconds    = (Date.now() - pageStart) / 1000;
    const totalWords = getTaggedWordCount();
    if (seconds < 3 || totalWords < 30) return;

    const estimatedWpm = Math.min(400, Math.round((totalWords / seconds) * 60));
    try {
      chrome.storage.local.get(PROFILE_KEY, result => {
        const profile = result[PROFILE_KEY];
        if (!profile) return;
        const updated = recordSession(profile, {
          domain:           location.hostname,
          timestamp:        Date.now(),
          readingSpeedWpm:  estimatedWpm,
          difficultyScore:  profile.difficultyScore,
        });
        chrome.storage.local.set({ [PROFILE_KEY]: updated });
      });
    } catch {}
  });
})();

// ── Week 4 — refresh original-text toggles when storage changes ────────────
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.userProfile && window.DysAssistNotify) {
    window.DysAssistNotify.refreshOriginalToggles();
  }
});
