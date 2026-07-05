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

    html,
    body,
    body * {
      font-family: ${theme.fontFamily} !important;
      line-height: ${theme.lineHeight} !important;
      letter-spacing: ${theme.letterSpacing} !important;
      word-spacing: 0.12em !important;
      text-shadow: none !important;
    }

    html,
    body {
      background: ${theme.background} !important;
      color: ${theme.text} !important;
    }

    body,
    main,
    article,
    section,
    aside,
    nav,
    header,
    footer,
    div,
    p,
    li,
    blockquote,
    table,
    td,
    th,
    form,
    label,
    input,
    textarea,
    select,
    button {
      background-color: ${theme.background} !important;
      color: ${theme.text} !important;
      background-image: none !important;
      box-shadow: none !important;
    }

    a,
    a *,
    [role="link"],
    [role="link"] * {
      color: #064f7d !important;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    strong,
    b,
    em,
    span,
    small,
    code,
    pre {
      color: ${theme.text} !important;
    }

    input,
    textarea,
    select,
    button {
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

    /* Distraction-Free Reader Mode Styles */
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
      to { opacity: 1; transform: translateY(0); }
    }

    #dysassist-reader-view .reader-container {
      width: 100% !important;
      max-width: 720px !important;
      margin: 0 auto !important;
    }

    #dysassist-reader-view .reader-header {
      margin-bottom: 32px !important;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
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
      background-color: rgba(0, 0, 0, 0.05) !important;
      border: 1px solid rgba(0, 0, 0, 0.1) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      z-index: 2147483647 !important;
      color: ${theme.text} !important;
    }

    #dysassist-reader-view .reader-close-btn:hover {
      background-color: rgba(0, 0, 0, 0.1) !important;
      transform: scale(1.05) !important;
    }

    #dysassist-reader-view .reader-content {
      font-size: 1.35rem !important;
    }

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
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
    }

    #dysassist-reader-view .reader-content ul,
    #dysassist-reader-view .reader-content ol {
      margin-left: 24px !important;
      margin-bottom: 1.6em !important;
      list-style-position: outside !important;
    }

    #dysassist-reader-view .reader-content ul {
      list-style-type: disc !important;
    }

    #dysassist-reader-view .reader-content ol {
      list-style-type: decimal !important;
    }

    #dysassist-reader-view .reader-content li {
      margin-bottom: 0.6em !important;
    }
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
  if (style.textContent !== css) {
    style.textContent = css;
  }
}

function requestScriptingCss(css) {
  try {
    chrome.runtime.sendMessage({ type: "APPLY_READING_THEME_CSS", css }, () => {
      // The local style remains as a fallback when scripting injection is unavailable.
    });
  } catch {
    // Ignore: some extension contexts cannot message during early navigation.
  }
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
  document
    .querySelectorAll("[data-dysassist-hidden-media='true']")
    .forEach(element => {
      element.removeAttribute("data-dysassist-hidden-media");
      element.style.removeProperty("display");
      element.style.removeProperty("visibility");
      element.style.removeProperty("opacity");
    });
  window.DysAssistChunker?.reset();
  window.DysAssistRuler?.disable();
  window.DysAssistFocus?.disable();
  window.DysAssistTTS?.stop();
  window.DysAssistVocab?.reset();
  window.DysAssistSimplify?.reset();
}

function shouldApplyReadingTheme(profile) {
  return profile?.preferences?.applyImmediately !== false;
}

function removeMedia() {
  document
    .querySelectorAll("img,picture,svg,canvas,video,iframe,embed,object,figure,[role='img']")
    .forEach(element => {
      if (element.id === DYSASSIST_OVERLAY_ID) return;
      element.setAttribute("data-dysassist-hidden-media", "true");
      element.style.setProperty("display", "none", "important");
      element.style.setProperty("visibility", "hidden", "important");
      element.style.setProperty("opacity", "0", "important");
    });
}

function restoreHiddenMedia() {
  document
    .querySelectorAll("[data-dysassist-hidden-media='true']")
    .forEach(element => {
      element.removeAttribute("data-dysassist-hidden-media");
      element.style.removeProperty("display");
      element.style.removeProperty("visibility");
      element.style.removeProperty("opacity");
    });
}

function extractReadableElements() {
  if (typeof globalThis.DysAssistReadability !== "function") {
    return [];
  }

  const parser = new globalThis.DysAssistReadability(document);
  const selected = parser.parse().candidates.slice(0, 250).map(candidate => candidate.element);
  selected.forEach((element, index) => {
    element.dataset.dysassistReadable = "true";
    element.dataset.readId ||= `r-${index}`;
  });

  return selected;
}

function showReaderOverlay(profile) {
  let readerView = document.getElementById("dysassist-reader-view");
  if (readerView) {
    return;
  }

  readerView = document.createElement("div");
  readerView.id = "dysassist-reader-view";
  document.body.appendChild(readerView);

  // Prevent background scrolling
  document.body.style.setProperty("overflow", "hidden", "important");

  // Parse page
  const parser = new globalThis.DysAssistReadability(document);
  const parsed = parser.parse();
  const title = parsed.title || document.title;
  const domain = window.location.hostname;

  // Build the reader structure
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

  // Clone candidates
  const target = readerView.querySelector("#dysassist-reader-content-target");
  const candidates = parsed.candidates;
  
  if (candidates && candidates.length > 0) {
    const topCandidates = candidates.filter(c => {
      return !candidates.some(other => other !== c && other.element.contains(c.element));
    });

    topCandidates.forEach(c => {
      const clone = c.element.cloneNode(true);
      
      // We only want to keep highly structured content tags
      const tagsToKeep = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol", "li", "img"];
      const contentElements = clone.querySelectorAll(tagsToKeep.join(","));
      
      // Filter out descendants of other kept elements to prevent duplication
      const topLevelElements = Array.from(contentElements).filter(el => {
        let parent = el.parentNode;
        while (parent && parent !== clone) {
          if (tagsToKeep.includes(parent.tagName.toLowerCase())) {
            return false;
          }
          parent = parent.parentNode;
        }
        return true;
      });

      topLevelElements.forEach(el => {
        const cleanEl = el.cloneNode(true);
        cleanEl.removeAttribute("style");
        cleanEl.removeAttribute("class");
        cleanEl.removeAttribute("id");
        
        // Clean all descendants of styles and classes
        cleanEl.querySelectorAll("*").forEach(child => {
          child.removeAttribute("style");
          child.removeAttribute("class");
          child.removeAttribute("id");
        });
        
        // Setup simple styles for links
        if (cleanEl.matches("a")) {
          cleanEl.style.setProperty("color", "#064f7d", "important");
          cleanEl.style.setProperty("text-decoration", "underline", "important");
        }
        cleanEl.querySelectorAll("a").forEach(a => {
          a.style.setProperty("color", "#064f7d", "important");
          a.style.setProperty("text-decoration", "underline", "important");
        });

        // Ensure paragraph fonts are clean and large
        target.appendChild(cleanEl);
      });
    });
  } else {
    // Fallback if no readability candidates were found
    const fallbackText = document.createElement("p");
    fallbackText.textContent = "No main article content could be detected on this page. Showing raw text paragraphs instead:";
    fallbackText.style.setProperty("font-style", "italic", "important");
    fallbackText.style.setProperty("opacity", "0.7", "important");
    target.appendChild(fallbackText);

    // Fallback: put paragraphs
    const paragraphs = document.querySelectorAll("p");
    let added = false;
    paragraphs.forEach(p => {
      if (p.innerText.trim().length > 20 && !p.closest("#dysassist-reader-view")) {
        const clone = p.cloneNode(true);
        clone.removeAttribute("style");
        clone.removeAttribute("class");
        target.appendChild(clone);
        added = true;
      }
    });

    if (!added) {
      const emptyMsg = document.createElement("p");
      emptyMsg.textContent = "Could not extract readable text from this page.";
      target.appendChild(emptyMsg);
    }
  }

  // Setup close button listener
  document.getElementById("dysassist-close-reader").addEventListener("click", () => {
    hideReaderOverlay();
    // Disable in preferences directly in storage
    chrome.storage.local.get("userProfile", result => {
      const current = result.userProfile;
      if (current && current.preferences) {
        current.preferences.readingModeEnabled = false;
        current.updatedAt = new Date().toISOString();
        chrome.storage.local.set({ userProfile: current });
      }
    });
  });
}

function hideReaderOverlay() {
  document.getElementById("dysassist-reader-view")?.remove();
  document.body.style.removeProperty("overflow");
}

async function processPage() {
  if (isApplyingChanges) return;
  isApplyingChanges = true;

  if (observer) {
    try {
      observer.disconnect();
    } catch (e) {}
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
    const css = buildReadingCss(theme);

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

    // Handle Vocabulary Tooltips Settings & Processing
    if (profile.preferences) {
      window.DysAssistVocab?.updateSettings(profile.preferences);
      if (profile.preferences.vocabEnabled) {
        window.DysAssistVocab?.enable();
      } else {
        window.DysAssistVocab?.reset();
      }
    }

    // Handle AI Simplify text selection listener
    if (profile.preferences) {
      if (profile.preferences.applyImmediately !== false) {
        window.DysAssistSimplify?.enable();
      } else {
        window.DysAssistSimplify?.disable();
      }

      // Adaptive tier-3: auto-highlight the hardest paragraph with a one-click
      // "Simplify this paragraph" chip when the decision agent turns it on.
      if (profile.preferences.simplifySuggestEnabled && profile.preferences.applyImmediately !== false) {
        window.DysAssistSimplify?.suggestHardest();
      } else {
        window.DysAssistSimplify?.clearSuggestion();
      }
    }
  } finally {
    isApplyingChanges = false;
    if (observer) {
      try {
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true
        });
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
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.userProfile) {
    processPage();
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TTS_TEST") {
    const firstPara = document.querySelector("p, [data-da-chunk]");
    if (firstPara) {
      window.DysAssistTTS?.speak(firstPara);
    }
  }
});
