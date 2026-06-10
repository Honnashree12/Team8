import { create } from "zustand";
import type {
  UserProfile, OnboardingMode, UserPreferences,
  ActiveAdaptation, DomainSetting,
} from "../types";

// ─── chrome.storage helpers ───────────────────────────────────────────────────
const KEY = "userProfile";

export async function loadProfileFromStorage(): Promise<UserProfile | null> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(KEY, (r) => resolve(r[KEY] ?? null));
    } else {
      const raw = localStorage.getItem(KEY);
      resolve(raw ? JSON.parse(raw) : null);
    }
  });
}

export async function saveProfileToStorage(p: UserProfile): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ [KEY]: p }, resolve);
    } else {
      localStorage.setItem(KEY, JSON.stringify(p));
      resolve();
    }
  });
}

const INITIAL_SCORES: Record<OnboardingMode, number> = {
  declared_dyslexic: 0.8,
  occasional: 0.4,
  fully_passive: 0.1,
};

export function buildDefaultProfile(mode: OnboardingMode): UserProfile {
  return {
    version: 1, mode,
    difficultyScore: INITIAL_SCORES[mode],
    preferences: {
      font: mode === "declared_dyslexic" ? "lexend" : "system",
      backgroundTint: "none",
      ttsEnabled: mode === "declared_dyslexic",
      letterSpacing: "normal",
      lineHeight: "normal",
    },
    domainSettings: [],
    interventionHistory: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Mocked adaptations for Week 2 dashboard ─────────────────────────────────
// In Week 3 these will be computed from the real feature vector.
export function getMockedAdaptations(profile: UserProfile): ActiveAdaptation[] {
  const score = profile.difficultyScore;
  const isDyslexic = profile.mode === "declared_dyslexic";
  const adaptations: ActiveAdaptation[] = [];

  if (isDyslexic || score >= 0.2) {
    adaptations.push({
      type: "font",
      label: "Dyslexia-friendly font",
      description: "Switched to Lexend — a font designed to reduce visual crowding and improve letter recognition.",
      triggerSignal: isDyslexic ? "Declared dyslexic mode" : `Difficulty score: ${Math.round(score * 100)}%`,
      enabled: profile.preferences.font !== "system",
      canToggle: true,
    });
  }

  if (isDyslexic || score >= 0.2) {
    adaptations.push({
      type: "line_height",
      label: "Increased line height",
      description: "Line spacing increased to 1.8× to reduce line-tracking errors and crowding between lines.",
      triggerSignal: isDyslexic ? "Declared dyslexic mode" : "Reading pace drop detected",
      enabled: true,
      canToggle: true,
    });
  }

  if (isDyslexic || score >= 0.2) {
    adaptations.push({
      type: "letter_spacing",
      label: "Wider letter spacing",
      description: "Extra space between letters reduces visual crowding — a primary cause of letter transposition in dyslexia.",
      triggerSignal: isDyslexic ? "Declared dyslexic mode" : "Scroll regression rate: elevated",
      enabled: true,
      canToggle: true,
    });
  }

  if (profile.preferences.backgroundTint !== "none") {
    adaptations.push({
      type: "background_tint",
      label: "Background tint",
      description: "A warm cream overlay reduces the harsh white-on-black contrast that causes visual stress and eye strain.",
      triggerSignal: "User preference: cream tint selected",
      enabled: true,
      canToggle: true,
    });
  }

  if (score >= 0.5) {
    adaptations.push({
      type: "focus_mode",
      label: "Focus mode",
      description: "Non-active paragraphs are lightly greyed out to help maintain focus on the current reading position.",
      triggerSignal: `Difficulty score: ${Math.round(score * 100)}% (above 50% threshold)`,
      enabled: false, // offered but not applied yet — Week 3 will auto-apply
      canToggle: false,
    });
  }

  if (profile.preferences.ttsEnabled) {
    adaptations.push({
      type: "tts",
      label: "Text-to-speech",
      description: "Reads text aloud with word-level highlighting. Helps when visual decoding is difficult.",
      triggerSignal: "User preference: TTS enabled in setup",
      enabled: true,
      canToggle: true,
    });
  }

  return adaptations;
}

// ─── Store interface ──────────────────────────────────────────────────────────
interface ProfileStore {
  profile: UserProfile | null;
  isLoading: boolean;
  isOnboardingComplete: boolean;
  adaptations: ActiveAdaptation[];
  currentDomain: string;

  loadProfile: () => Promise<void>;
  createProfile: (mode: OnboardingMode, prefs?: Partial<UserPreferences>) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  toggleAdaptation: (type: string) => void;
  pauseDomain: (domain: string, paused: boolean) => Promise<void>;
  resetProfile: () => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  isLoading: true,
  isOnboardingComplete: false,
  adaptations: [],
  currentDomain: "",

  loadProfile: async () => {
    set({ isLoading: true });
    const stored = await loadProfileFromStorage();

    // get current tab domain
    let domain = "";
    if (typeof chrome !== "undefined" && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      try { domain = new URL(tab?.url ?? "").hostname; } catch { domain = ""; }
    }

    set({
      profile: stored,
      isOnboardingComplete: stored !== null,
      isLoading: false,
      currentDomain: domain,
      adaptations: stored ? getMockedAdaptations(stored) : [],
    });
  },

  createProfile: async (mode, prefs) => {
    const base = buildDefaultProfile(mode);
    const profile: UserProfile = { ...base, preferences: { ...base.preferences, ...prefs } };
    await saveProfileToStorage(profile);
    set({ profile, isOnboardingComplete: true, adaptations: getMockedAdaptations(profile) });
  },

  updatePreferences: async (prefs) => {
    const { profile } = get();
    if (!profile) return;
    const updated: UserProfile = {
      ...profile,
      preferences: { ...profile.preferences, ...prefs },
      updatedAt: new Date().toISOString(),
    };
    await saveProfileToStorage(updated);
    set({ profile: updated, adaptations: getMockedAdaptations(updated) });
  },

  toggleAdaptation: (type) => {
    set((s) => ({
      adaptations: s.adaptations.map((a) =>
        a.type === type && a.canToggle ? { ...a, enabled: !a.enabled } : a
      ),
    }));
  },

  pauseDomain: async (domain, paused) => {
    const { profile } = get();
    if (!profile) return;
    const existing = profile.domainSettings.find((d) => d.domain === domain);
    const domainSettings: DomainSetting[] = existing
      ? profile.domainSettings.map((d) => d.domain === domain ? { ...d, paused } : d)
      : [...profile.domainSettings, { domain, paused }];
    const updated = { ...profile, domainSettings, updatedAt: new Date().toISOString() };
    await saveProfileToStorage(updated);
    set({ profile: updated });
  },

  resetProfile: async () => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      await new Promise<void>((r) => chrome.storage.local.remove(KEY, r));
    } else { localStorage.removeItem(KEY); }
    set({ profile: null, isOnboardingComplete: false, adaptations: [] });
  },
}));
