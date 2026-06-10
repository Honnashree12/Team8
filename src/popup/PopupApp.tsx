import { useEffect, useState } from "react";
import { useProfileStore } from "../store/profileStore";
import { ScoreBar } from "./components/ScoreBar";
import { AdaptationCard } from "./components/AdaptationCard";
import { WhyModal } from "./components/WhyModal";
import { DomainPause } from "./components/DomainPause";
import type { ActiveAdaptation, OnboardingMode, WhyExplanation } from "../types";

const MODE_INFO: Record<OnboardingMode, { label: string; emoji: string; color: string }> = {
  declared_dyslexic: { label: "Full mode",    emoji: "🧠", color: "bg-purple-100 text-purple-700" },
  occasional:        { label: "Smart mode",   emoji: "📚", color: "bg-blue-100 text-blue-700"   },
  fully_passive:     { label: "Passive mode", emoji: "👀", color: "bg-green-100 text-green-700"  },
};

// Build the "Why" explanation for a given adaptation + profile score
function buildExplanation(adaptation: ActiveAdaptation, score: number, mode: OnboardingMode): WhyExplanation {
  const scoreLabel =
    score < 0.2 ? "Reading fine — no difficulty detected" :
    score < 0.4 ? "Mild friction — subtle signals detected" :
    score < 0.7 ? "Struggling — multiple difficulty signals active" :
                  "High difficulty — full remediation active";

  // Mocked signals — in Week 3 these come from the real FeatureVector
  const signalsByType: Record<string, WhyExplanation["topSignals"]> = {
    font: [
      { signal: "Declared dyslexia mode",      value: "active",      weight: 0.9 },
      { signal: "Visual crowding sensitivity",  value: "high",        weight: 0.7 },
      { signal: "Reading speed baseline",       value: "below avg",   weight: 0.4 },
    ],
    line_height: [
      { signal: "Line-tracking regressions",   value: "3.2 / 100w",  weight: 0.8 },
      { signal: "Scroll backtrack events",     value: "4 detected",   weight: 0.6 },
      { signal: "Dwell time per line",         value: "+22% avg",     weight: 0.5 },
    ],
    letter_spacing: [
      { signal: "Scroll regression rate",      value: "4.1 / 100w",  weight: 0.75 },
      { signal: "Selection trace events",      value: "2 detected",   weight: 0.55 },
      { signal: "Difficulty score",            value: `${Math.round(score * 100)}%`, weight: 0.65 },
    ],
    background_tint: [
      { signal: "User preference",             value: "cream selected", weight: 0.95 },
      { signal: "Visual stress indicators",    value: "moderate",       weight: 0.5  },
    ],
    tts: [
      { signal: "TTS enabled in onboarding",  value: "yes",           weight: 1.0  },
      { signal: "Reading mode",               value: "full assistance", weight: 0.8 },
    ],
    focus_mode: [
      { signal: "Difficulty score",           value: `${Math.round(score * 100)}%`, weight: 0.8 },
      { signal: "Tab abandon events",         value: "2 detected",    weight: 0.6  },
      { signal: "Paragraph completion rate",  value: "58%",           weight: 0.5  },
    ],
    reading_ruler: [
      { signal: "Re-read loop events",        value: "3 detected",    weight: 0.85 },
      { signal: "Scroll backtrack frequency", value: "high",          weight: 0.7  },
    ],
  };

  const modeNotes: Record<OnboardingMode, string> = {
    declared_dyslexic: "You selected 'I have dyslexia' during setup — full adaptations are applied from page load without waiting for signals.",
    occasional:        "You selected 'I sometimes struggle' — adaptations kick in when your difficulty score crosses a threshold, based on your reading signals.",
    fully_passive:     "You selected 'Watch and help automatically' — the system monitors quietly and only intervenes when signals strongly indicate difficulty.",
  };

  return {
    score,
    scoreLabel,
    topSignals: signalsByType[adaptation.type] ?? [],
    adaptationsApplied: [],
    modeNote: modeNotes[mode],
  };
}

export function PopupApp() {
  const {
    profile, isLoading, adaptations, currentDomain,
    loadProfile, toggleAdaptation, pauseDomain, resetProfile,
  } = useProfileStore();

  const [whyAdaptation, setWhyAdaptation] = useState<ActiveAdaptation | null>(null);
  const [whyExplanation, setWhyExplanation] = useState<WhyExplanation | null>(null);
  const [globalPaused, setGlobalPaused] = useState(false);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  function openWhy(adaptation: ActiveAdaptation) {
    if (!profile) return;
    setWhyAdaptation(adaptation);
    setWhyExplanation(buildExplanation(adaptation, profile.difficultyScore, profile.mode));
  }

  if (isLoading) {
    return (
      <div className="w-80 h-40 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="w-80 p-6 text-center">
        <p className="text-sm text-gray-500 mb-4">No profile found. Please complete setup.</p>
        <button
          onClick={() => chrome?.tabs?.create({ url: chrome.runtime.getURL("onboarding.html") })}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          Complete setup →
        </button>
      </div>
    );
  }

  const modeInfo = MODE_INFO[profile.mode];
  const domainPaused = profile.domainSettings.find((d) => d.domain === currentDomain)?.paused ?? false;
  const effectivelyPaused = globalPaused || domainPaused;
  const activeCount = adaptations.filter((a) => a.enabled).length;

  return (
    <div className="w-80 bg-white flex flex-col animate-fadeIn">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <span className="font-bold text-gray-900 text-sm font-lexend">DysAssist</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${modeInfo.color}`}>
            {modeInfo.emoji} {modeInfo.label}
          </span>
          {/* Global pause */}
          <button
            onClick={() => setGlobalPaused(!globalPaused)}
            title={globalPaused ? "Resume" : "Pause globally"}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors border focus:outline-none ${
              globalPaused
                ? "bg-red-50 border-red-200 text-red-500"
                : "bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600"
            }`}
          >
            {globalPaused ? "▶" : "⏸"}
          </button>
        </div>
      </div>

      {/* ── Paused banner ──────────────────────────────────────────────────── */}
      {effectivelyPaused && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium text-center">
          ⏸ DysAssist is paused {globalPaused ? "globally" : "on this site"}
        </div>
      )}

      {/* ── Score bar ──────────────────────────────────────────────────────── */}
      <ScoreBar score={profile.difficultyScore} />

      {/* ── Adaptations list ───────────────────────────────────────────────── */}
      <div className="px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Active adaptations
          </h2>
          <span className="text-xs text-gray-400">
            {activeCount} of {adaptations.length} on
          </span>
        </div>

        {adaptations.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs text-gray-400 italic">
              No adaptations active yet — monitoring passively.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {adaptations.map((a) => (
              <AdaptationCard
                key={a.type}
                adaptation={a}
                onToggle={() => toggleAdaptation(a.type)}
                onWhyClick={() => openWhy(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Per-domain pause ───────────────────────────────────────────────── */}
      <DomainPause
        domain={currentDomain}
        paused={domainPaused}
        onToggle={() => pauseDomain(currentDomain, !domainPaused)}
      />

      {/* ── Footer actions ─────────────────────────────────────────────────── */}
      <div className="px-3 pb-3 pt-2 flex gap-2 border-t border-gray-100">
        <button
          onClick={() => chrome?.tabs?.create({ url: chrome.runtime.getURL("onboarding.html") })}
          className="flex-1 text-xs border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-blue-600 py-2 rounded-lg transition-colors focus:outline-none"
        >
          ⚙️ Settings
        </button>
        <button
          onClick={() => { if (confirm("Reset profile?")) resetProfile(); }}
          className="flex-1 text-xs border border-red-100 hover:border-red-300 text-red-400 hover:text-red-600 py-2 rounded-lg transition-colors focus:outline-none"
        >
          🗑️ Reset
        </button>
      </div>

      <div className="pb-2 text-center">
        <p className="text-[10px] text-gray-300">All data stored locally on your device</p>
      </div>

      {/* ── Why modal ──────────────────────────────────────────────────────── */}
      <WhyModal
        adaptation={whyAdaptation}
        explanation={whyExplanation}
        onClose={() => { setWhyAdaptation(null); setWhyExplanation(null); }}
      />
    </div>
  );
}
