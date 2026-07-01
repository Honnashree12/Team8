const PROFILE_KEY = "userProfile";

// DOM Elements
const masterToggle = document.getElementById("master-toggle");
const difficultyBadge = document.getElementById("difficulty-badge");

const cardDyslexic = document.getElementById("card-dyslexic");
const cardOccasional = document.getElementById("card-occasional");
const cardPassive = document.getElementById("card-passive");

const fontLexend = document.getElementById("font-lexend");
const fontOpenDyslexic = document.getElementById("font-opendyslexic");

const letterSpacingSlider = document.getElementById("letter-spacing-slider");
const letterSpacingVal = document.getElementById("letter-spacing-val");

const lineHeightSlider = document.getElementById("line-height-slider");
const lineHeightVal = document.getElementById("line-height-val");

const overlayToggle = document.getElementById("overlay-toggle");
const overlayContent = document.getElementById("overlay-content");
const opacitySlider = document.getElementById("opacity-slider");
const opacityVal = document.getElementById("opacity-val");

const readerModeToggle = document.getElementById("reader-mode-toggle");

const resetBtn = document.getElementById("reset-btn");
const settingsBtn = document.getElementById("settings-btn");
const openOnboardingBtn = document.getElementById("open-onboarding");

const swatches = {
  none: document.getElementById("swatch-none"),
  cream: document.getElementById("swatch-cream"),
  blue: document.getElementById("swatch-blue"),
  green: document.getElementById("swatch-green"),
  yellow: document.getElementById("swatch-yellow")
};

let currentProfile = null;

// Chunker controls
const chunkingToggle = document.getElementById("chunking-toggle");
const chunkingContent = document.getElementById("chunking-content");
const chunkingSlider = document.getElementById("chunking-slider");
const chunkingVal = document.getElementById("chunking-val");

// Ruler controls
const rulerToggle = document.getElementById("ruler-toggle");
const rulerContent = document.getElementById("ruler-content");
const rulerHeightSlider = document.getElementById("ruler-height-slider");
const rulerHeightVal = document.getElementById("ruler-height-val");
const rulerOpacitySlider = document.getElementById("ruler-opacity-slider");
const rulerOpacityVal = document.getElementById("ruler-opacity-val");
const rulerModeSelect = document.getElementById("ruler-mode-select");
const rulerColorPicker = document.getElementById("ruler-color-picker");
const rulerColorHex = document.getElementById("ruler-color-hex");

// Focus Mode controls
const focusToggle = document.getElementById("focus-toggle");
const focusContent = document.getElementById("focus-content");
const focusStyleSelect = document.getElementById("focus-style-select");
const focusBlurGroup = document.getElementById("focus-blur-group");
const focusBlurSlider = document.getElementById("focus-blur-slider");
const focusBlurVal = document.getElementById("focus-blur-val");
const focusDimGroup = document.getElementById("focus-dim-group");
const focusDimSlider = document.getElementById("focus-dim-slider");
const focusDimVal = document.getElementById("focus-dim-val");

// TTS controls
const ttsToggle = document.getElementById("tts-toggle");
const ttsContent = document.getElementById("tts-content");
const ttsVoiceSelect = document.getElementById("tts-voice-select");
const ttsRateSlider = document.getElementById("tts-rate-slider");
const ttsRateVal = document.getElementById("tts-rate-val");
const ttsPitchSlider = document.getElementById("tts-pitch-slider");
const ttsPitchVal = document.getElementById("tts-pitch-val");
const ttsHighlightToggle = document.getElementById("tts-highlight-toggle");
const ttsTestBtn = document.getElementById("tts-test-btn");

// Vocab controls
const vocabToggle = document.getElementById("vocab-toggle");
const vocabContent = document.getElementById("vocab-content");
const vocabSlider = document.getElementById("vocab-slider");
const vocabVal = document.getElementById("vocab-val");

// ── Week 5 — Honnashree: error states, toasts, storage-failure handling ─────

const storageErrorBanner = document.getElementById("storage-error-banner");
const storageErrorDetail = document.getElementById("storage-error-detail");
const restrictedPageBanner = document.getElementById("restricted-page-banner");
const toastStack = document.getElementById("toast-stack");

function showToast(message, kind = "info", durationMs = 3200) {
  if (!toastStack) return;
  const el = document.createElement("div");
  el.className = `toast ${kind === "error" ? "toast-error" : kind === "success" ? "toast-success" : ""}`;
  const icon = kind === "error" ? "⚠️" : kind === "success" ? "✅" : "ℹ️";
  el.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toastStack.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 200);
  }, durationMs);
}

function showStorageError(detail) {
  if (storageErrorDetail && detail) storageErrorDetail.textContent = detail;
  if (storageErrorBanner) storageErrorBanner.classList.add("visible");
}

function clearStorageError() {
  if (storageErrorBanner) storageErrorBanner.classList.remove("visible");
}

// Week 5 — tracks whether the *last* getProfile() call genuinely found "no profile"
// versus failed to read storage at all. init() uses this so a transient storage
// error can never be mistaken for a first-install and silently overwrite real data.
let lastProfileReadFailed = false;

// Helpers to get/set Chrome local storage — Week 5: wrapped with real error handling
// instead of silently resolving null/undefined on failure.
function getProfile() {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get(PROFILE_KEY, (result) => {
          if (chrome.runtime.lastError) {
            lastProfileReadFailed = true;
            showStorageError(chrome.runtime.lastError.message || "Could not read your saved settings.");
            resolve(null);
            return;
          }
          lastProfileReadFailed = false;
          clearStorageError();
          resolve(result[PROFILE_KEY] ?? null);
        });
      } else {
        const local = localStorage.getItem(PROFILE_KEY);
        lastProfileReadFailed = false;
        resolve(local ? JSON.parse(local) : null);
      }
    } catch (err) {
      lastProfileReadFailed = true;
      showStorageError(err?.message || "Could not read your saved settings.");
      resolve(null);
    }
  });
}

function saveProfile(profile) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.set({ [PROFILE_KEY]: profile }, () => {
          if (chrome.runtime.lastError) {
            showStorageError(chrome.runtime.lastError.message || "Couldn't save your changes. They may be lost if you close this popup.");
            resolve(false);
            return;
          }
          clearStorageError();
          resolve(true);
        });
      } else {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        resolve(true);
      }
    } catch (err) {
      // Most likely QUOTA_BYTES_PER_ITEM exceeded, or storage disabled by policy
      showStorageError(err?.message || "Couldn't save your changes — storage may be full.");
      resolve(false);
    }
  });
}

// ── Week 5 — Restricted-page detection ───────────────────────────────────────
// Content scripts (and therefore all live adaptations) cannot run on chrome://,
// chrome-extension://, the Web Store, or local file:// pages without extra
// permissions. Detect this so the popup can say so honestly instead of the
// toggles looking broken.
function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("https://chromewebstore.google.com") ||
    (url.startsWith("file://") && !url.endsWith(".html"))
  );
}

async function checkRestrictedPage() {
  if (typeof chrome === "undefined" || !chrome.tabs) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const restricted = isRestrictedUrl(tab?.url);
    if (restrictedPageBanner) restrictedPageBanner.classList.toggle("visible", restricted);
  } catch {
    // If we can't even query tabs, don't block the rest of the popup on it
  }
}

// Week 5 — Same shape as the normal default profile, used only when storage
// itself is unreachable so the popup can still render something sensible
// without ever writing it back to (possibly still-broken) storage.
function buildInMemoryFallbackProfile() {
  return {
    version: 1,
    mode: "declared_dyslexic",
    difficultyScore: 0.8,
    preferences: {
      font: "lexend",
      backgroundTint: "cream",
      lineHeight: "1.7",
      letterSpacing: "0.045em",
      overlayOpacity: 0.18,
      applyImmediately: true,
      readingModeEnabled: false,
      overlayToggleOn: true,
      chunkingEnabled: false,
      chunkMaxSentences: 3,
      rulerEnabled: false,
      rulerHeight: 36,
      rulerOpacity: 0.12,
      rulerColor: "#0082f0",
      rulerMode: "follow",
      focusEnabled: false,
      focusStyle: "both",
      focusBlur: 4,
      focusDimOpacity: 0.55,
      focusTransition: 220,
      ttsEnabled: false,
      ttsRate: 1.0,
      ttsPitch: 1.0,
      ttsVoiceURI: "",
      ttsHighlight: true,
      vocabEnabled: false,
      vocabTopN: 5
    },
    domainSettings: [],
    interventionHistory: {},
    sessionHistory: [],
    domainStats: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// Initializer
async function init() {
  checkRestrictedPage();

  currentProfile = await getProfile();

  if (!currentProfile && lastProfileReadFailed) {
    // Week 5 — storage genuinely failed to respond (not "no profile yet").
    // Use an in-memory default so the popup is still usable, but do NOT
    // persist it — that would risk clobbering a real profile once storage
    // recovers. The error banner stays visible so the user knows why.
    currentProfile = buildInMemoryFallbackProfile();
    render(currentProfile);
    checkAiStatus();
    revealPopup();
    return;
  }

  if (!currentProfile) {
    // Fallback default profile structure
    currentProfile = {
      version: 1,
      mode: "declared_dyslexic",
      difficultyScore: 0.8,
      preferences: {
        font: "lexend",
        backgroundTint: "cream",
        lineHeight: "1.7",
        letterSpacing: "0.045em",
        overlayOpacity: 0.18,
        applyImmediately: true,
        readingModeEnabled: false,
        overlayToggleOn: true,
        chunkingEnabled: false,
        chunkMaxSentences: 3,
        rulerEnabled: false,
        rulerHeight: 36,
        rulerOpacity: 0.12,
        rulerColor: "#0082f0",
        rulerMode: "follow",
        focusEnabled: false,
        focusStyle: "both",
        focusBlur: 4,
        focusDimOpacity: 0.55,
        focusTransition: 220,
        ttsEnabled: false,
        ttsRate: 1.0,
        ttsPitch: 1.0,
        ttsVoiceURI: "",
        ttsHighlight: true,
        vocabEnabled: false,
        vocabTopN: 5
      },
      domainSettings: [],
      interventionHistory: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveProfile(currentProfile);
  } else {
    // Ensure new properties exist on an existing profile
    const prefs = currentProfile.preferences || {};
    let updated = false;
    if (prefs.chunkingEnabled === undefined) { prefs.chunkingEnabled = false; updated = true; }
    if (prefs.chunkMaxSentences === undefined) { prefs.chunkMaxSentences = 3; updated = true; }
    if (prefs.rulerEnabled === undefined) { prefs.rulerEnabled = false; updated = true; }
    if (prefs.rulerHeight === undefined) { prefs.rulerHeight = 36; updated = true; }
    if (prefs.rulerOpacity === undefined) { prefs.rulerOpacity = 0.12; updated = true; }
    if (prefs.rulerColor === undefined) { prefs.rulerColor = "#0082f0"; updated = true; }
    if (prefs.rulerMode === undefined) { prefs.rulerMode = "follow"; updated = true; }
    if (prefs.focusEnabled === undefined) { prefs.focusEnabled = false; updated = true; }
    if (prefs.focusStyle === undefined) { prefs.focusStyle = "both"; updated = true; }
    if (prefs.focusBlur === undefined) { prefs.focusBlur = 4; updated = true; }
    if (prefs.focusDimOpacity === undefined) { prefs.focusDimOpacity = 0.55; updated = true; }
    if (prefs.focusTransition === undefined) { prefs.focusTransition = 220; updated = true; }
    if (prefs.ttsEnabled === undefined) { prefs.ttsEnabled = false; updated = true; }
    if (prefs.ttsRate === undefined) { prefs.ttsRate = 1.0; updated = true; }
    if (prefs.ttsPitch === undefined) { prefs.ttsPitch = 1.0; updated = true; }
    if (prefs.ttsVoiceURI === undefined) { prefs.ttsVoiceURI = ""; updated = true; }
    if (prefs.ttsHighlight === undefined) { prefs.ttsHighlight = true; updated = true; }
    if (prefs.vocabEnabled === undefined) { prefs.vocabEnabled = false; updated = true; }
    if (prefs.vocabTopN === undefined) { prefs.vocabTopN = 5; updated = true; }
    if (updated) {
      currentProfile.preferences = prefs;
      await saveProfile(currentProfile);
    }
  }

  render(currentProfile);
  checkAiStatus();
  revealPopup();
}

// Week 5 — swap the loading skeleton for the real UI once init() has data
// (or has definitively failed to get any, so the user isn't stuck on a spinner).
function revealPopup() {
  const loading = document.getElementById("popup-loading");
  const container = document.getElementById("popup-container");
  if (loading) loading.style.display = "none";
  if (container) container.style.display = "flex";
}

// Render values into DOM
function render(profile) {
  ensureWeek3Fields(profile);
  if (currentTab === "summary") renderSummaryTab(profile);
  if (currentTab === "domains") renderDomainsTab(profile);

  const prefs = profile.preferences || {};

  // Master Switch
  masterToggle.checked = !!prefs.applyImmediately;

  // Status Badge
  const scorePct = Math.round(profile.difficultyScore * 100);
  difficultyBadge.textContent = `Score: ${scorePct}%`;

  // Profile cards
  cardDyslexic.classList.remove("active");
  cardOccasional.classList.remove("active");
  cardPassive.classList.remove("active");
  
  if (profile.mode === "declared_dyslexic") cardDyslexic.classList.add("active");
  else if (profile.mode === "occasional") cardOccasional.classList.add("active");
  else if (profile.mode === "fully_passive") cardPassive.classList.add("active");

  // Font cards
  fontLexend.classList.remove("active");
  fontOpenDyslexic.classList.remove("active");
  
  if (prefs.font === "opendyslexic") {
    fontOpenDyslexic.classList.add("active");
    document.body.className = "font-opendyslexic";
  } else {
    fontLexend.classList.add("active");
    document.body.className = "font-lexend";
  }

  // Letter Spacing Slider
  let lsNum = 0;
  if (prefs.letterSpacing === "normal") lsNum = 0;
  else if (prefs.letterSpacing === "wide") lsNum = 0.045;
  else if (prefs.letterSpacing === "wider") lsNum = 0.075;
  else {
    const parsed = parseFloat(prefs.letterSpacing);
    lsNum = isNaN(parsed) ? 0 : parsed;
  }
  letterSpacingSlider.value = lsNum;
  letterSpacingVal.textContent = lsNum === 0 ? "Normal" : `+${lsNum}em`;

  // Line Height Slider
  let lhNum = 1.4;
  if (prefs.lineHeight === "normal") lhNum = 1.4;
  else if (prefs.lineHeight === "relaxed") lhNum = 1.7;
  else if (prefs.lineHeight === "loose") lhNum = 1.9;
  else {
    const parsed = parseFloat(prefs.lineHeight);
    lhNum = isNaN(parsed) ? 1.4 : parsed;
  }
  lineHeightSlider.value = lhNum;
  lineHeightVal.textContent = `${lhNum}x`;

  // Overlay Tint Toggle (persist card open/close state separately from "none" color selection)
  const isOverlayOn = prefs.overlayToggleOn !== undefined ? prefs.overlayToggleOn : (prefs.backgroundTint && prefs.backgroundTint !== "none");
  overlayToggle.checked = isOverlayOn;
  
  if (isOverlayOn) {
    overlayContent.classList.remove("hidden");
  } else {
    overlayContent.classList.add("hidden");
  }

  // Color Swatches Selection State
  Object.entries(swatches).forEach(([tint, el]) => {
    if (!el) return;
    el.classList.remove("active");
    const check = el.querySelector(".swatch-check");
    if (check) check.remove();
  });

  const activeSwatch = swatches[prefs.backgroundTint || "none"];
  if (activeSwatch) {
    activeSwatch.classList.add("active");
    const checkEl = document.createElement("span");
    checkEl.className = "swatch-check";
    checkEl.textContent = "✓";
    checkEl.style.color = (prefs.backgroundTint === "none" || prefs.backgroundTint === "cream" || prefs.backgroundTint === "yellow") ? "#0f172a" : "#ffffff";
    activeSwatch.appendChild(checkEl);
  }

  // Opacity Slider
  const opacity = prefs.overlayOpacity !== undefined ? prefs.overlayOpacity : 0.18;
  opacitySlider.value = opacity;
  opacityVal.textContent = `${Math.round(opacity * 100)}%`;

  // Paragraph Chunking
  chunkingToggle.checked = !!prefs.chunkingEnabled;
  if (prefs.chunkingEnabled) {
    chunkingContent.classList.remove("hidden");
  } else {
    chunkingContent.classList.add("hidden");
  }
  const chunkMax = prefs.chunkMaxSentences ?? 3;
  chunkingSlider.value = chunkMax;
  chunkingVal.textContent = chunkMax;

  // Reading Ruler
  rulerToggle.checked = !!prefs.rulerEnabled;
  if (prefs.rulerEnabled) {
    rulerContent.classList.remove("hidden");
  } else {
    rulerContent.classList.add("hidden");
  }
  const rulerHeight = prefs.rulerHeight ?? 36;
  rulerHeightSlider.value = rulerHeight;
  rulerHeightVal.textContent = `${rulerHeight}px`;

  const rulerOpacity = prefs.rulerOpacity ?? 0.12;
  rulerOpacitySlider.value = rulerOpacity;
  rulerOpacityVal.textContent = `${Math.round(rulerOpacity * 100)}%`;

  rulerModeSelect.value = prefs.rulerMode ?? "follow";

  // Week 5 — Ruler Color
  const rulerColor = prefs.rulerColor ?? "#0082f0";
  if (rulerColorPicker) rulerColorPicker.value = rulerColor;
  if (rulerColorHex) rulerColorHex.textContent = rulerColor;

  // Focus Mode
  focusToggle.checked = !!prefs.focusEnabled;
  if (prefs.focusEnabled) {
    focusContent.classList.remove("hidden");
  } else {
    focusContent.classList.add("hidden");
  }
  const focusStyle = prefs.focusStyle ?? "both";
  focusStyleSelect.value = focusStyle;

  if (focusStyle === "dim") {
    focusBlurGroup.classList.add("hidden");
    focusDimGroup.classList.remove("hidden");
  } else if (focusStyle === "blur") {
    focusBlurGroup.classList.remove("hidden");
    focusDimGroup.classList.add("hidden");
  } else {
    focusBlurGroup.classList.remove("hidden");
    focusDimGroup.classList.remove("hidden");
  }

  const focusBlur = prefs.focusBlur ?? 4;
  focusBlurSlider.value = focusBlur;
  focusBlurVal.textContent = `${focusBlur}px`;

  const focusDim = prefs.focusDimOpacity ?? 0.55;
  focusDimSlider.value = focusDim;
  focusDimVal.textContent = `${Math.round(focusDim * 100)}%`;

  // Reader Mode Switch
  readerModeToggle.checked = !!prefs.readingModeEnabled;

  // Text-to-Speech
  ttsToggle.checked = !!prefs.ttsEnabled;
  if (prefs.ttsEnabled) {
    ttsContent.classList.remove("hidden");
  } else {
    ttsContent.classList.add("hidden");
  }
  const ttsRate = prefs.ttsRate ?? 1.0;
  ttsRateSlider.value = ttsRate;
  ttsRateVal.textContent = `${ttsRate.toFixed(1)}x`;

  const ttsPitch = prefs.ttsPitch ?? 1.0;
  ttsPitchSlider.value = ttsPitch;
  ttsPitchVal.textContent = `${ttsPitch.toFixed(1)}`;

  ttsHighlightToggle.checked = prefs.ttsHighlight !== false;
  populateTTSVoices(prefs.ttsVoiceURI || "");

  // Vocabulary Tooltips
  vocabToggle.checked = !!prefs.vocabEnabled;
  if (prefs.vocabEnabled) {
    vocabContent.classList.remove("hidden");
  } else {
    vocabContent.classList.add("hidden");
  }
  const vocabTopN = prefs.vocabTopN ?? 5;
  vocabSlider.value = vocabTopN;
  vocabVal.textContent = vocabTopN;
}

// Event Listeners
masterToggle.addEventListener("change", async (e) => {
  currentProfile.preferences.applyImmediately = e.target.checked;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

// Mode Cards Click
const modes = [
  { id: "declared_dyslexic", el: cardDyslexic, score: 0.8 },
  { id: "occasional", el: cardOccasional, score: 0.4 },
  { id: "fully_passive", el: cardPassive, score: 0.1 }
];

modes.forEach(item => {
  item.el.addEventListener("click", async () => {
    currentProfile.mode = item.id;
    currentProfile.difficultyScore = item.score;
    currentProfile.updatedAt = new Date().toISOString();
    await saveProfile(currentProfile);
    render(currentProfile);
  });
});

// Font Cards Click
fontLexend.addEventListener("click", async () => {
  currentProfile.preferences.font = "lexend";
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

fontOpenDyslexic.addEventListener("click", async () => {
  currentProfile.preferences.font = "opendyslexic";
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

// Sliders Dragging (continuous display update)
letterSpacingSlider.addEventListener("input", (e) => {
  const val = parseFloat(e.target.value);
  letterSpacingVal.textContent = val === 0 ? "Normal" : `+${val}em`;
});

letterSpacingSlider.addEventListener("change", async (e) => {
  const val = parseFloat(e.target.value);
  currentProfile.preferences.letterSpacing = val === 0 ? "normal" : `${val}em`;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

lineHeightSlider.addEventListener("input", (e) => {
  lineHeightVal.textContent = `${e.target.value}x`;
});

lineHeightSlider.addEventListener("change", async (e) => {
  currentProfile.preferences.lineHeight = e.target.value;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

// Overlay Tint Switch Toggle
overlayToggle.addEventListener("change", async (e) => {
  const isEnabled = e.target.checked;
  currentProfile.preferences.overlayToggleOn = isEnabled;
  if (isEnabled) {
    overlayContent.classList.remove("hidden");
    // Fallback if none was previously selected
    if (!currentProfile.preferences.backgroundTint || currentProfile.preferences.backgroundTint === "none") {
      currentProfile.preferences.backgroundTint = "cream";
    }
  } else {
    overlayContent.classList.add("hidden");
    currentProfile.preferences.backgroundTint = "none";
  }
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

// Swatches Click
Object.entries(swatches).forEach(([tint, el]) => {
  if (!el) return;
  el.addEventListener("click", async () => {
    currentProfile.preferences.backgroundTint = tint;
    currentProfile.preferences.overlayToggleOn = true;
    currentProfile.updatedAt = new Date().toISOString();
    await saveProfile(currentProfile);
    render(currentProfile);
  });
});

// Opacity Slider Drag
opacitySlider.addEventListener("input", (e) => {
  opacityVal.textContent = `${Math.round(e.target.value * 100)}%`;
});

opacitySlider.addEventListener("change", async (e) => {
  currentProfile.preferences.overlayOpacity = parseFloat(e.target.value);
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

// Reader Mode Switch Click
readerModeToggle.addEventListener("change", async (e) => {
  currentProfile.preferences.readingModeEnabled = e.target.checked;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

// ─── Week 3 — Reset Profile Modal (replaces old confirm()) ──────────────────
const resetModalOverlay = document.getElementById("reset-modal-overlay");
const resetModalWarnStage = document.getElementById("reset-modal-stage-warn");
const resetModalConfirmStage = document.getElementById("reset-modal-stage-confirm");
const resetModalCancel1 = document.getElementById("reset-modal-cancel-1");
const resetModalCancel2 = document.getElementById("reset-modal-cancel-2");
const resetModalContinue = document.getElementById("reset-modal-continue");
const resetModalConfirmBtn = document.getElementById("reset-modal-confirm");

function openResetModal() {
  resetModalWarnStage.style.display = "block";
  resetModalConfirmStage.style.display = "none";
  resetModalOverlay.classList.add("open");
}

function closeResetModal() {
  resetModalOverlay.classList.remove("open");
}

async function performReset() {
  currentProfile = {
    version: 1,
    mode: "declared_dyslexic",
    difficultyScore: 0.8,
    preferences: {
      font: "lexend",
      backgroundTint: "cream",
      lineHeight: "1.7",
      letterSpacing: "0.045em",
      overlayOpacity: 0.18,
      applyImmediately: true,
      readingModeEnabled: false,
      overlayToggleOn: true,
      chunkingEnabled: false,
      chunkMaxSentences: 3,
      rulerEnabled: false,
      rulerHeight: 36,
      rulerOpacity: 0.12,
      rulerColor: "#0082f0",
      rulerMode: "follow",
      focusEnabled: false,
      focusStyle: "both",
      focusBlur: 4,
      focusDimOpacity: 0.55,
      focusTransition: 220,
      ttsEnabled: false,
      ttsRate: 1.0,
      ttsPitch: 1.0,
      ttsVoiceURI: "",
      ttsHighlight: true,
      vocabEnabled: false,
      vocabTopN: 5
    },
    domainSettings: [],
    interventionHistory: {},
    sessionHistory: [],
    domainStats: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await saveProfile(currentProfile);
  render(currentProfile);
  closeResetModal();
}

resetBtn.addEventListener("click", openResetModal);
resetModalCancel1.addEventListener("click", closeResetModal);
resetModalCancel2.addEventListener("click", closeResetModal);
resetModalOverlay.addEventListener("click", (e) => {
  if (e.target === resetModalOverlay) closeResetModal();
});
resetModalContinue.addEventListener("click", () => {
  resetModalWarnStage.style.display = "none";
  resetModalConfirmStage.style.display = "block";
});
resetModalConfirmBtn.addEventListener("click", performReset);

// Paragraph Chunking Event Listeners
chunkingToggle.addEventListener("change", async (e) => {
  currentProfile.preferences.chunkingEnabled = e.target.checked;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

chunkingSlider.addEventListener("input", (e) => {
  chunkingVal.textContent = e.target.value;
});

chunkingSlider.addEventListener("change", async (e) => {
  currentProfile.preferences.chunkMaxSentences = Number(e.target.value);
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

// Reading Ruler Event Listeners
rulerToggle.addEventListener("change", async (e) => {
  currentProfile.preferences.rulerEnabled = e.target.checked;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

rulerHeightSlider.addEventListener("input", (e) => {
  rulerHeightVal.textContent = `${e.target.value}px`;
});

rulerHeightSlider.addEventListener("change", async (e) => {
  currentProfile.preferences.rulerHeight = Number(e.target.value);
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

rulerOpacitySlider.addEventListener("input", (e) => {
  rulerOpacityVal.textContent = `${Math.round(e.target.value * 100)}%`;
});

rulerOpacitySlider.addEventListener("change", async (e) => {
  currentProfile.preferences.rulerOpacity = parseFloat(e.target.value);
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

rulerModeSelect.addEventListener("change", async (e) => {
  currentProfile.preferences.rulerMode = e.target.value;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

// Week 5 — Ruler Color Event Listener (settings completeness fix: this
// preference existed in the data model since Week 2 but had no UI control)
if (rulerColorPicker) {
  rulerColorPicker.addEventListener("input", (e) => {
    if (rulerColorHex) rulerColorHex.textContent = e.target.value;
  });

  rulerColorPicker.addEventListener("change", async (e) => {
    currentProfile.preferences.rulerColor = e.target.value;
    currentProfile.updatedAt = new Date().toISOString();
    const ok = await saveProfile(currentProfile);
    if (ok) showToast("Ruler color updated", "success", 1600);
    render(currentProfile);
  });
}

// Focus Mode Event Listeners
focusToggle.addEventListener("change", async (e) => {
  currentProfile.preferences.focusEnabled = e.target.checked;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

focusStyleSelect.addEventListener("change", async (e) => {
  currentProfile.preferences.focusStyle = e.target.value;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

focusBlurSlider.addEventListener("input", (e) => {
  focusBlurVal.textContent = `${e.target.value}px`;
});

focusBlurSlider.addEventListener("change", async (e) => {
  currentProfile.preferences.focusBlur = Number(e.target.value);
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

focusDimSlider.addEventListener("input", (e) => {
  focusDimVal.textContent = `${Math.round(e.target.value * 100)}%`;
});

focusDimSlider.addEventListener("change", async (e) => {
  currentProfile.preferences.focusDimOpacity = parseFloat(e.target.value);
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

// TTS Event Listeners
ttsToggle.addEventListener("change", async (e) => {
  currentProfile.preferences.ttsEnabled = e.target.checked;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

ttsRateSlider.addEventListener("input", (e) => {
  const val = parseFloat(e.target.value);
  ttsRateVal.textContent = `${val.toFixed(1)}x`;
});

ttsRateSlider.addEventListener("change", async (e) => {
  currentProfile.preferences.ttsRate = parseFloat(e.target.value);
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

ttsPitchSlider.addEventListener("input", (e) => {
  const val = parseFloat(e.target.value);
  ttsPitchVal.textContent = `${val.toFixed(1)}`;
});

ttsPitchSlider.addEventListener("change", async (e) => {
  currentProfile.preferences.ttsPitch = parseFloat(e.target.value);
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

ttsHighlightToggle.addEventListener("change", async (e) => {
  currentProfile.preferences.ttsHighlight = e.target.checked;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

ttsVoiceSelect.addEventListener("change", async (e) => {
  currentProfile.preferences.ttsVoiceURI = e.target.value;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

ttsTestBtn.addEventListener("click", async () => {
  if (typeof chrome !== "undefined" && chrome.tabs) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (isRestrictedUrl(tab?.url)) {
      showToast("Open a regular webpage first — DysAssist can't run here.", "error");
      return;
    }
    if (tab) {
      // Week 5 — was previously a silent .catch(() => {}), which made TTS
      // look broken on any page where the content script hadn't loaded
      // (e.g. page opened before the extension was installed/reloaded).
      chrome.tabs.sendMessage(tab.id, { type: "TTS_TEST" }).catch(() => {
        showToast("Couldn't reach this page — try refreshing it first.", "error");
      });
    }
  }
});

// Vocab Event Listeners
vocabToggle.addEventListener("change", async (e) => {
  currentProfile.preferences.vocabEnabled = e.target.checked;
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

vocabSlider.addEventListener("input", (e) => {
  vocabVal.textContent = e.target.value;
});

vocabSlider.addEventListener("change", async (e) => {
  currentProfile.preferences.vocabTopN = Number(e.target.value);
  currentProfile.updatedAt = new Date().toISOString();
  await saveProfile(currentProfile);
  render(currentProfile);
});

function populateTTSVoices(selectedURI) {
  const sel = document.getElementById("tts-voice-select");
  if (!sel) return;

  if (typeof chrome !== "undefined" && chrome.tabs && chrome.scripting) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab || isRestrictedUrl(tab.url)) return;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => speechSynthesis.getVoices().map(v => ({ name: v.name, uri: v.voiceURI, lang: v.lang }))
      }, (results) => {
        // Week 5 — chrome.scripting.executeScript reports failures via
        // chrome.runtime.lastError, not a thrown exception or rejected
        // promise, so this previously failed silently on CSP-strict sites.
        if (chrome.runtime.lastError) return;
        const voices = results?.[0]?.result || [];
        if (!voices.length) return;

        sel.innerHTML = '<option value="">Default Voice</option>';
        voices
          .filter(v => v.lang.startsWith("en"))
          .forEach(v => {
            const opt = document.createElement("option");
            opt.value = v.uri;
            opt.textContent = `${v.name} (${v.lang})`;
            opt.selected = v.uri === selectedURI;
            sel.appendChild(opt);
          });
      });
    });
  }
}

// Utility Redirections to Settings/Onboarding
const openOnboarding = () => {
  if (typeof chrome !== "undefined" && chrome.tabs) {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
};

openOnboardingBtn.addEventListener("click", openOnboarding);
settingsBtn.addEventListener("click", openOnboarding);

// =============================================================================
// WEEK 3 — Honnashree: Profile summary view, per-domain settings, reset flow
// =============================================================================

// ── Tab switching ────────────────────────────────────────────────────────────
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = {
  dashboard: document.getElementById("tab-panel-dashboard"),
  summary: document.getElementById("tab-panel-summary"),
  domains: document.getElementById("tab-panel-domains"),
};

let currentTab = "dashboard";
let currentDomain = "";

function switchTab(tabId) {
  currentTab = tabId;
  tabButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  Object.entries(tabPanels).forEach(([id, panel]) => {
    panel.classList.toggle("active", id === tabId);
  });
  if (tabId === "summary") renderSummaryTab(currentProfile);
  if (tabId === "domains") renderDomainsTab(currentProfile);
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// Get current tab's domain (used to highlight "current site" and for quick pause)
function detectCurrentDomain() {
  if (typeof chrome !== "undefined" && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      try {
        currentDomain = new URL(tabs[0]?.url ?? "").hostname;
      } catch {
        currentDomain = "";
      }
      // Re-render whichever tab is open so the current-site dot shows correctly
      if (currentTab === "domains") renderDomainsTab(currentProfile);
    });
  }
}

// ── Helpers shared by Summary + Domains tabs ─────────────────────────────────
function scoreClass(score) {
  if (score < 0.3) return "domain-score-low";
  if (score < 0.5) return "domain-score-mid";
  if (score < 0.7) return "domain-score-high";
  return "domain-score-crit";
}

function timeAgo(ts) {
  const diffHrs = Math.floor((Date.now() - ts) / 3600000);
  if (diffHrs < 1) return "just now";
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

function ensureWeek3Fields(profile) {
  if (!profile.domainStats) profile.domainStats = {};
  if (!profile.sessionHistory) profile.sessionHistory = [];
  if (!profile.domainSettings) profile.domainSettings = [];
  if (!profile.interventionHistory) profile.interventionHistory = {};
  return profile;
}

function computeSummary(profile) {
  ensureWeek3Fields(profile);
  const sessions = profile.sessionHistory;
  const domains = Object.values(profile.domainStats);

  const totalSessions = sessions.length;
  const avgWpm = totalSessions
    ? Math.round(sessions.reduce((s, r) => s + (r.readingSpeedWpm || 0), 0) / totalSessions)
    : 0;
  const avgScore = totalSessions
    ? sessions.reduce((s, r) => s + (r.difficultyScore || 0), 0) / totalSessions
    : profile.difficultyScore;

  const topDomains = [...domains]
    .sort((a, b) => b.avgDifficultyScore - a.avgDifficultyScore)
    .slice(0, 5);

  const offered = domains.reduce((s, d) => s + (d.interventionsOffered || 0), 0);
  const accepted = domains.reduce((s, d) => s + (d.interventionsAccepted || 0), 0);
  const acceptanceRate = offered > 0 ? accepted / offered : 0;

  return { totalSessions, avgWpm, avgScore, topDomains, offered, accepted, acceptanceRate };
}

// ── Render: Summary tab ──────────────────────────────────────────────────────
function renderSummaryTab(profile) {
  const summary = computeSummary(profile);

  document.getElementById("summary-avg-wpm").innerHTML =
    `${summary.avgWpm || "—"}<span class="unit">wpm</span>`;
  document.getElementById("summary-avg-score").innerHTML =
    `${Math.round(summary.avgScore * 100)}<span class="unit">%</span>`;

  const pct = Math.round(summary.acceptanceRate * 100);
  document.getElementById("summary-acceptance-pct").textContent = `${pct}%`;
  document.getElementById("summary-acceptance-fill").style.width = `${pct}%`;
  document.getElementById("summary-acceptance-sub").textContent =
    `${summary.accepted} accepted of ${summary.offered} offered`;

  // Top difficult domains
  const domainsList = document.getElementById("summary-domains-list");
  if (summary.topDomains.length === 0) {
    domainsList.innerHTML = `<div class="empty-state">No site data yet — keep browsing.</div>`;
  } else {
    domainsList.innerHTML = summary.topDomains.map(d => `
      <div class="domain-row" data-domain="${d.domain}">
        <div class="domain-row-info">
          <div class="domain-row-name">${d.domain}</div>
          <div class="domain-row-sub">${d.visits} visit${d.visits !== 1 ? "s" : ""} · ${Math.round(d.avgReadingSpeedWpm)} wpm · ${timeAgo(d.lastVisited)}</div>
        </div>
        <span class="domain-score-pill ${scoreClass(d.avgDifficultyScore)}">${Math.round(d.avgDifficultyScore * 100)}%</span>
        <button class="domain-remove-btn" data-remove-domain="${d.domain}" title="Reset history for this site">✕</button>
      </div>
    `).join("");

    domainsList.querySelectorAll("[data-remove-domain]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const domain = btn.dataset.removeDomain;
        delete currentProfile.domainStats[domain];
        currentProfile.sessionHistory = currentProfile.sessionHistory.filter(s => s.domain !== domain);
        currentProfile.updatedAt = new Date().toISOString();
        await saveProfile(currentProfile);
        renderSummaryTab(currentProfile);
      });
    });
  }

  // Intervention history
  const historyList = document.getElementById("summary-history-list");
  const historyEntries = Object.entries(profile.interventionHistory || {});
  if (historyEntries.length === 0) {
    historyList.innerHTML = `<div class="empty-state">No interventions recorded yet.</div>`;
  } else {
    historyList.innerHTML = historyEntries.map(([key, h]) => {
      const statusClass = h.lastAction === "accepted" ? "history-accepted"
        : h.lastAction === "dismissed" ? "history-dismissed" : "history-pending";
      return `
        <div class="history-row">
          <div>
            <div class="history-row-label">${key.replace(/_/g, " ")}</div>
            <div class="history-row-sub">Level ${h.level} · weight ${Math.round((h.weight || 0) * 100)}%</div>
          </div>
          <span class="history-status ${statusClass}">${h.lastAction || "pending"}</span>
        </div>
      `;
    }).join("");
  }

  const memberDays = Math.max(1, Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / 86400000));
  document.getElementById("summary-footer-note").textContent =
    `${summary.totalSessions} sessions tracked · member for ${memberDays} day${memberDays !== 1 ? "s" : ""}`;
}

// ── Render: Per-Domain Settings tab ──────────────────────────────────────────
const SENSITIVITY_LABELS = [
  { max: 0.35, label: "Low — only intervene when struggling badly" },
  { max: 0.65, label: "Default — follows global thresholds" },
  { max: 1.01, label: "High — intervene early and often" },
];

function sensitivityLabel(v) {
  return SENSITIVITY_LABELS.find(s => v <= s.max).label;
}

function renderDomainsTab(profile) {
  ensureWeek3Fields(profile);

  const known = new Set([
    ...(currentDomain ? [currentDomain] : []),
    ...profile.domainSettings.map(d => d.domain),
    ...Object.keys(profile.domainStats),
  ]);

  const domains = Array.from(known).sort((a, b) => {
    if (a === currentDomain) return -1;
    if (b === currentDomain) return 1;
    return a.localeCompare(b);
  });

  const list = document.getElementById("domains-list");

  if (domains.length === 0) {
    list.innerHTML = `<div class="empty-state">No site data yet — visit a few pages first.</div>`;
    return;
  }

  list.innerHTML = domains.map(domain => {
    const setting = profile.domainSettings.find(d => d.domain === domain);
    const stats = profile.domainStats[domain];
    const paused = setting?.paused ?? false;
    const sensitivity = setting?.sensitivityOverride;
    const isCurrent = domain === currentDomain;

    return `
      <div class="domain-row" data-domain-toggle="${domain}" style="flex-direction: column; align-items: stretch; cursor: default; padding: 0; overflow: hidden;">
        <div style="display:flex; align-items:center; gap:8px; padding: 9px 10px; cursor: pointer;" data-domain-header="${domain}">
          ${isCurrent ? '<span class="domain-current-dot"></span>' : ''}
          <div class="domain-row-info">
            <div class="domain-row-name">${domain}</div>
          </div>
          ${paused ? '<span class="domain-score-pill domain-score-crit">paused</span>' : ''}
          ${sensitivity !== undefined ? '<span class="domain-score-pill domain-score-mid">custom</span>' : ''}
          <span style="color:#475569; font-size:10px;" data-chevron="${domain}">▼</span>
        </div>
        <div class="domain-detail" id="domain-detail-${cssEscape(domain)}">
          ${stats ? `
            <div class="domain-detail-stats">
              <div class="domain-detail-stat">
                <div class="domain-detail-stat-val">${Math.round(stats.avgReadingSpeedWpm)}</div>
                <div class="domain-detail-stat-label">avg wpm</div>
              </div>
              <div class="domain-detail-stat">
                <div class="domain-detail-stat-val">${Math.round(stats.avgDifficultyScore * 100)}%</div>
                <div class="domain-detail-stat-label">difficulty</div>
              </div>
            </div>
          ` : ''}
          <div class="domain-detail-row">
            <span class="domain-detail-row-label">Pause DysAssist here</span>
            <label class="switch" style="width:32px; height:18px;">
              <input type="checkbox" data-pause-domain="${domain}" ${paused ? "checked" : ""}>
              <span class="slider"></span>
            </label>
          </div>
          <div>
            <div class="domain-detail-row">
              <span class="domain-detail-row-label">Sensitivity override</span>
              ${sensitivity !== undefined ? `<button class="clear-override-btn" data-clear-override="${domain}">Reset to default</button>` : ''}
            </div>
            <input type="range" min="0.1" max="0.9" step="0.1" value="${sensitivity ?? 0.5}" data-sensitivity-domain="${domain}" style="margin-top:4px;">
            <div class="sensitivity-note" data-sensitivity-note="${domain}">${sensitivityLabel(sensitivity ?? 0.5)}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Wire up expand/collapse
  list.querySelectorAll("[data-domain-header]").forEach(header => {
    header.addEventListener("click", () => {
      const domain = header.dataset.domainHeader;
      const detail = document.getElementById(`domain-detail-${cssEscape(domain)}`);
      const chevron = list.querySelector(`[data-chevron="${cssEscapeAttr(domain)}"]`);
      const willOpen = !detail.classList.contains("open");
      detail.classList.toggle("open", willOpen);
      if (chevron) chevron.textContent = willOpen ? "▲" : "▼";
    });
  });

  // Wire up pause toggles
  list.querySelectorAll("[data-pause-domain]").forEach(input => {
    input.addEventListener("change", async (e) => {
      e.stopPropagation();
      const domain = input.dataset.pauseDomain;
      const paused = input.checked;
      const existing = currentProfile.domainSettings.find(d => d.domain === domain);
      if (existing) existing.paused = paused;
      else currentProfile.domainSettings.push({ domain, paused, sensitivityOverride: undefined });
      currentProfile.updatedAt = new Date().toISOString();
      await saveProfile(currentProfile);
      renderDomainsTab(currentProfile);
    });
  });

  // Wire up sensitivity sliders
  list.querySelectorAll("[data-sensitivity-domain]").forEach(input => {
    input.addEventListener("input", (e) => {
      const domain = input.dataset.sensitivityDomain;
      const note = list.querySelector(`[data-sensitivity-note="${cssEscapeAttr(domain)}"]`);
      if (note) note.textContent = sensitivityLabel(parseFloat(input.value));
    });
    input.addEventListener("change", async (e) => {
      const domain = input.dataset.sensitivityDomain;
      const value = parseFloat(input.value);
      const existing = currentProfile.domainSettings.find(d => d.domain === domain);
      if (existing) existing.sensitivityOverride = value;
      else currentProfile.domainSettings.push({ domain, paused: false, sensitivityOverride: value });
      currentProfile.updatedAt = new Date().toISOString();
      await saveProfile(currentProfile);
      renderDomainsTab(currentProfile);
    });
  });

  // Wire up clear override buttons
  list.querySelectorAll("[data-clear-override]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const domain = btn.dataset.clearOverride;
      const existing = currentProfile.domainSettings.find(d => d.domain === domain);
      if (existing) existing.sensitivityOverride = undefined;
      currentProfile.updatedAt = new Date().toISOString();
      await saveProfile(currentProfile);
      renderDomainsTab(currentProfile);
    });
  });
}

// Small helper since domain strings can contain dots which break CSS selectors
function cssEscape(str) {
  return str.replace(/[^a-zA-Z0-9]/g, "_");
}
function cssEscapeAttr(str) {
  return str; // used only inside [data-x="..."] attribute selectors, safe as-is
}

// =============================================================================
// WEEK 5 — Honnashree: offline / no-API-key fallback for Manoj's Gemini backend
// =============================================================================
//
// The /simplify and /define features (server/index.js) depend on a locally
// running proxy server and, for real AI output, a configured GEMINI_API_KEY.
// Neither is guaranteed to be present — the server might not be running, the
// user might be offline, or USE_GEMINI might be false (mock mode). Rather
// than let those features fail silently or look broken, this checks reachability
// up front and tells the user plainly what mode they're in. Tier 1 (typography)
// and Tier 2 (structural: chunking, ruler, focus mode) never depend on this and
// keep working regardless — this banner only concerns the AI-simplify layer.

const AI_HEALTH_URL = "http://127.0.0.1:8787/health";
const AI_HEALTH_TIMEOUT_MS = 2500;

const aiStatusDot = document.getElementById("ai-status-dot");
const aiStatusSub = document.getElementById("ai-status-sub");
const aiStatusRetry = document.getElementById("ai-status-retry");

function setAiStatus(state, subtext) {
  if (aiStatusDot) aiStatusDot.className = `ai-status-dot ${state}`;
  if (aiStatusSub) aiStatusSub.textContent = subtext;
}

async function checkAiStatus() {
  setAiStatus("checking", "Checking…");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_HEALTH_TIMEOUT_MS);

  try {
    const res = await fetch(AI_HEALTH_URL, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      setAiStatus("offline", "Backend unreachable — Tier 1 & 2 still work");
      return;
    }

    const data = await res.json();

    if (data.mode === "gemini" && data.geminiConfigured) {
      setAiStatus("online", "Live — simplify & define ready");
    } else {
      // Server is up but running in mock mode (no API key / USE_GEMINI=false)
      setAiStatus("offline", "No API key set — using local mock responses");
    }
  } catch (err) {
    clearTimeout(timer);
    // Covers: server not running, offline, timed out, CORS blocked, etc.
    // This is expected in most dev/demo setups, so this is a neutral
    // "offline" state, not an alarming error banner.
    setAiStatus("offline", "Offline — typography & structure features still work");
  }
}

if (aiStatusRetry) {
  aiStatusRetry.addEventListener("click", checkAiStatus);
}

// Kick off current-domain detection once popup opens
detectCurrentDomain();

// Initialize popup logic on document ready
// Week 5 — wrapped so an unexpected error during init() can never leave the
// user staring at an infinite loading spinner with no explanation.
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await init();
  } catch (err) {
    console.error("[DysAssist] popup init failed:", err);
    showStorageError("Something went wrong loading your settings. Try closing and reopening this popup.");
    revealPopup();
  }
});

// Hard safety net: if init() somehow never resolves within 5s (should not
// happen, but a hung chrome.storage callback is not impossible), reveal the
// popup anyway rather than leaving a spinner running forever.
setTimeout(() => {
  const loading = document.getElementById("popup-loading");
  if (loading && loading.style.display !== "none") {
    revealPopup();
    showToast("Taking longer than expected to load — some data may be stale.", "error");
  }
}, 5000);

if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.userProfile) {
      currentProfile = changes.userProfile.newValue;
      render(currentProfile);
    }
  });
}