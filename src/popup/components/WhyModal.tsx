import type { ActiveAdaptation, WhyExplanation } from "../../types";

interface Props {
  adaptation: ActiveAdaptation | null;
  explanation: WhyExplanation | null;
  onClose: () => void;
}

// Signal weight bar
function WeightBar({ weight }: { weight: number }) {
  const pct = Math.round(weight * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-400 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-400 w-6 text-right">{pct}%</span>
    </div>
  );
}

export function WhyModal({ adaptation, explanation, onClose }: Props) {
  if (!adaptation || !explanation) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="fixed inset-x-3 bottom-3 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 animate-slideUp overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-blue-50">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Why is this happening?</h2>
            <p className="text-xs text-gray-500 mt-0.5">{adaptation.label}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-blue-100 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 max-h-80 overflow-y-auto">

          {/* Score context */}
          <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-xl">
            <div className="text-xl">📊</div>
            <div>
              <p className="text-xs font-semibold text-gray-700">
                Current difficulty score: <span className="text-blue-600">{Math.round(explanation.score * 100)}%</span>
              </p>
              <p className="text-xs text-gray-500">{explanation.scoreLabel}</p>
            </div>
          </div>

          {/* What triggered it */}
          <div className="mb-3">
            <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              What triggered this
            </h3>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              <p className="text-xs text-blue-800 leading-relaxed">
                {adaptation.description}
              </p>
              <p className="text-[10px] text-blue-500 mt-1.5 font-medium">
                Signal: {adaptation.triggerSignal}
              </p>
            </div>
          </div>

          {/* Top signals */}
          {explanation.topSignals.length > 0 && (
            <div className="mb-3">
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Signals detected
              </h3>
              <div className="space-y-2">
                {explanation.topSignals.map((s, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[11px] text-gray-700">{s.signal}</span>
                      <span className="text-[11px] font-mono text-gray-500">{s.value}</span>
                    </div>
                    <WeightBar weight={s.weight} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode note */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <p className="text-[11px] text-amber-700 leading-relaxed">
              <span className="font-semibold">Note: </span>
              {explanation.modeNote}
            </p>
          </div>

          {/* Week 2 stub notice */}
          <p className="text-[10px] text-gray-400 mt-3 text-center italic">
            Signal values are mocked in Week 2. Live signals connect in Week 3.
          </p>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl transition-colors focus:outline-none"
          >
            Got it
          </button>
          <button
            onClick={onClose}
            className="flex-1 text-xs font-semibold border border-gray-200 hover:border-gray-300 text-gray-600 py-2 rounded-xl transition-colors focus:outline-none"
          >
            Turn off this adaptation
          </button>
        </div>
      </div>
    </>
  );
}
