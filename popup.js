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
        overlayToggleOn: true
      },
      domainSettings: [],
      interventionHistory: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveProfile(currentProfile);
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

  // Reader Mode Switch
  readerModeToggle.checked = !!prefs.readingModeEnabled;
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
        overlayToggleOn: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveProfile(currentProfile);
    render(currentProfile);
  }
});

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
