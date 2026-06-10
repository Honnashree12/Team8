import { useState } from "react";
import { useProfileStore } from "../store/profileStore";
import type { OnboardingMode, UserPreferences, FontChoice, BackgroundTint } from "../types";

type Step = "mode" | "prefs" | "done";

const MODES: { id: OnboardingMode; emoji: string; title: string; badge: string }[] = [
  { id: "declared_dyslexic", emoji: "🧠", title: "I have dyslexia and want full assistance", badge: "Full mode" },
  { id: "occasional",        emoji: "📚", title: "I sometimes struggle with reading",         badge: "Smart mode" },
  { id: "fully_passive",     emoji: "👀", title: "Just watch and help me automatically",      badge: "Passive mode" },
];

const FONTS:  { id: FontChoice;     label: string }[] = [
  { id: "lexend",        label: "Lexend (recommended)" },
  { id: "opendyslexic",  label: "OpenDyslexic" },
  { id: "system",        label: "System default" },
];

const TINTS: { id: BackgroundTint; label: string; hex: string }[] = [
  { id: "none",   label: "None",        hex: "#ffffff" },
  { id: "cream",  label: "Cream",       hex: "#fdf6e3" },
  { id: "blue",   label: "Sky blue",    hex: "#e8f4fd" },
  { id: "green",  label: "Mint",        hex: "#edfaf1" },
  { id: "yellow", label: "Warm yellow", hex: "#fefce8" },
];

export function OnboardingApp() {
  const [step, setStep]   = useState<Step>("mode");
  const [mode, setMode]   = useState<OnboardingMode | null>(null);
  const [font, setFont]   = useState<FontChoice>("lexend");
  const [tint, setTint]   = useState<BackgroundTint>("cream");
  const [tts,  setTts]    = useState(false);
  const { createProfile } = useProfileStore();

  async function handleMode(m: OnboardingMode) {
    setMode(m);
    if (m === "declared_dyslexic") { setStep("prefs"); }
    else { await createProfile(m); setStep("done"); }
  }

  async function handlePrefs() {
    const prefs: Partial<UserPreferences> = { font, backgroundTint: tint, ttsEnabled: tts, lineHeight: "relaxed", letterSpacing: "wide" };
    await createProfile(mode!, prefs);
    setStep("done");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-2xl mb-3">
            <span className="text-white text-xl">📖</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 font-lexend">DysAssist</h1>
        </div>

        {step === "mode" && (
          <div>
            <h2 className="font-bold text-gray-900 mb-1">How would you like us to help?</h2>
            <p className="text-sm text-gray-400 mb-5">You can change this any time.</p>
            <div className="space-y-3">
              {MODES.map((m) => (
                <button key={m.id} onClick={() => handleMode(m.id)}
                  className="w-full text-left border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:bg-blue-50 transition-all group focus:outline-none">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{m.emoji}</span>
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">{m.title}</span>
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">{m.badge}</span>
                    </div>
                    <span className="text-gray-300 group-hover:text-blue-400">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "prefs" && (
          <div>
            <h2 className="font-bold text-gray-900 mb-1">Personalise your reading experience</h2>
            <p className="text-sm text-gray-400 mb-5">Starting points — adjust any time.</p>

            <div className="mb-5">
              <label className="text-sm font-semibold text-gray-700 block mb-2">Preferred font</label>
              {FONTS.map((f) => (
                <button key={f.id} onClick={() => setFont(f.id)}
                  className={`w-full text-left px-3 py-2 mb-1.5 rounded-lg border text-sm transition-all focus:outline-none ${font === f.id ? "border-blue-500 bg-blue-50 font-semibold text-blue-800" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {f.label} {font === f.id && "✓"}
                </button>
              ))}
            </div>

            <div className="mb-5">
              <label className="text-sm font-semibold text-gray-700 block mb-2">Background tint</label>
              <div className="flex gap-2">
                {TINTS.map((t) => (
                  <button key={t.id} onClick={() => setTint(t.id)} title={t.label}
                    className={`flex flex-col items-center gap-1 rounded-lg p-1 focus:outline-none ${tint === t.id ? "ring-2 ring-blue-500" : ""}`}>
                    <span className="w-8 h-8 rounded-lg border border-gray-200 block" style={{ backgroundColor: t.hex }} />
                    <span className="text-[10px] text-gray-400">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-700">Text-to-speech</span>
                <p className="text-xs text-gray-400">Read pages aloud</p>
              </div>
              <button onClick={() => setTts(!tts)} role="switch" aria-checked={tts}
                className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${tts ? "bg-blue-600" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${tts ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            <button onClick={handlePrefs}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors focus:outline-none">
              Save & get started →
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="font-bold text-gray-900 mb-2">You're all set!</h2>
            <p className="text-sm text-gray-500 mb-6">DysAssist is now active. Click the extension icon to see your dashboard.</p>
            <button onClick={() => window.close()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors">
              Start browsing →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
