const DYSASSIST_STYLE_ID = "dysassist-reading-theme";
const DYSASSIST_OVERLAY_ID = "dysassist-page-tint";
const DEFAULT_PREFERENCES = {
  font: "lexend",
  backgroundTint: "cream",
  lineHeight: "relaxed",
  letterSpacing: "wide"
};

function getTheme(profile) {
  const preferences = { ...DEFAULT_PREFERENCES, ...(profile?.preferences ?? {}) };
  const useOpenDyslexic = preferences.font === "opendyslexic";
  const fontFamily = useOpenDyslexic
    ? "'OpenDyslexic', 'Lexend', Arial, sans-serif"
    : "'Lexend', Arial, sans-serif";

  return {
    fontFamily,
    background: {
      cream: "#fff8dc",
      blue: "#e8f4fd",
      green: "#edfaf1",
      yellow: "#fef9c3",
      none: "#fff8dc"
    }[preferences.backgroundTint] ?? "#fff8dc",
    text: "#1d1b16",
    mutedText: "#302d25",
    lineHeight: {
      normal: "1.7",
      relaxed: "1.7",
      loose: "1.9"
    }[preferences.lineHeight] ?? "1.7",
    letterSpacing: {
      normal: "0.02em",
      wide: "0.045em",
      wider: "0.075em"
    }[preferences.letterSpacing] ?? "0.045em"
  };
}

function buildReadingCss(theme) {
  return `
    @import url("https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap");

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

    img,
    picture,
    svg,
    canvas,
    video,
    iframe,
    embed,
    object,
    figure,
    [role="img"],
    [style*="background-image"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
      max-width: 0 !important;
      max-height: 0 !important;
      overflow: hidden !important;
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
      opacity: 0.18 !important;
      mix-blend-mode: multiply !important;
    }
  `;
}

async function getProfile() {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage({ type: "GET_PROFILE" }, response => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response?.profile ?? null);
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
  style.textContent = css;
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

function extractReadableElements() {
  const parser = new globalThis.DysAssistReadability(document);
  const selected = parser.parse().candidates.slice(0, 250).map(candidate => candidate.element);
  selected.forEach((element, index) => {
    element.dataset.dysassistReadable = "true";
    element.dataset.readId ||= `r-${index}`;
  });

  return selected;
}

async function applyReadingTheme() {
  const profile = await getProfile();
  const theme = getTheme(profile);
  const css = buildReadingCss(theme);

  installLocalStyle(css);
  requestScriptingCss(css);
  ensureTintOverlay();
  removeMedia();
  extractReadableElements();
}

function debounce(fn, delay) {
  let timeoutId;
  return () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(fn, delay);
  };
}

const scheduleReapply = debounce(applyReadingTheme, 150);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyReadingTheme, { once: true });
} else {
  applyReadingTheme();
}

const observer = new MutationObserver(scheduleReapply);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});
