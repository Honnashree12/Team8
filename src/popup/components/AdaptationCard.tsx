import type { ActiveAdaptation } from "../../types";

const ICONS: Record<string, string> = {
  font:            "🔤",
  line_height:     "↕️",
  letter_spacing:  "↔️",
  background_tint: "🎨",
  word_spacing:    "⠀",
  tts:             "🔊",
  focus_mode:      "🎯",
  reading_ruler:   "📏",
};

interface Props {
  adaptation: ActiveAdaptation;
  onToggle: () => void;
  onWhyClick: () => void;
}

export function AdaptationCard({ adaptation, onToggle, onWhyClick }: Props) {
  const icon = ICONS[adaptation.type] ?? "⚙️";

  return (
    <div
      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all ${
        adaptation.enabled
          ? "bg-white border-gray-200"
          : "bg-gray-50 border-gray-100 opacity-60"
      }`}
    >
      {/* Icon */}
      <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold ${adaptation.enabled ? "text-gray-800" : "text-gray-400"}`}>
            {adaptation.label}
          </span>
          {/* Live dot */}
          {adaptation.enabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          )}
        </div>
        {/* Why button */}
        <button
          onClick={onWhyClick}
          className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline mt-0.5 focus:outline-none"
        >
          Why is this happening?
        </button>
      </div>

      {/* Toggle */}
      {adaptation.canToggle ? (
        <button
          role="switch"
          aria-checked={adaptation.enabled}
          onClick={onToggle}
          className={`relative flex-shrink-0 w-8 h-4.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 mt-0.5 ${
            adaptation.enabled ? "bg-blue-500" : "bg-gray-200"
          }`}
          style={{ height: "18px", width: "32px" }}
        >
          <span
            className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${
              adaptation.enabled ? "translate-x-3.5" : "translate-x-0.5"
            }`}
          />
        </button>
      ) : (
        <span className="text-[10px] text-gray-300 flex-shrink-0 mt-1 italic">auto</span>
      )}
    </div>
  );
}
