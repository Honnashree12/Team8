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

// Helpers to get/set Chrome local storage
function getProfile() {
  return new Promise(resolve => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(PROFILE_KEY, result => {
        resolve(result[PROFILE_KEY] ?? null);
      });
    } else {
      const local = localStorage.getItem(PROFILE_KEY);
      resolve(local ? JSON.parse(local) : null);
    }
  });
}

function saveProfile(profile) {
  return new Promise(resolve => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ [PROFILE_KEY]: profile }, () => {
        resolve();
      });
    } else {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      resolve();
    }
  });
}

// Initializer
async function init() {
  currentProfile = await getProfile();
  
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
        ttsHighlight: true
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
    if (updated) {
      currentProfile.preferences = prefs;
      await saveProfile(currentProfile);
    }
  }

  render(currentProfile);
}

// Render values into DOM
function render(profile) {
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

// Reset Button Click
resetBtn.addEventListener("click", async () => {
  if (confirm("Reset all settings to default?")) {
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
        ttsHighlight: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveProfile(currentProfile);
    render(currentProfile);
  }
});

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
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: "TTS_TEST" }).catch(() => {});
    }
  }
});

function populateTTSVoices(selectedURI) {
  const sel = document.getElementById("tts-voice-select");
  if (!sel) return;

  if (typeof chrome !== "undefined" && chrome.tabs && chrome.scripting) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return;
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => speechSynthesis.getVoices().map(v => ({ name: v.name, uri: v.voiceURI, lang: v.lang }))
      }, (results) => {
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

// Initialize popup logic on document ready
document.addEventListener("DOMContentLoaded", init);

if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.userProfile) {
      currentProfile = changes.userProfile.newValue;
      render(currentProfile);
    }
  });
}
