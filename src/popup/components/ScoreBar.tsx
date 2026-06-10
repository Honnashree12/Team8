interface Props { score: number }

const BANDS = [
  { max: 0.2, label: "Reading fine",  color: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50" },
  { max: 0.4, label: "Mild friction", color: "bg-yellow-400",  text: "text-yellow-700",  bg: "bg-yellow-50"  },
  { max: 0.7, label: "Struggling",    color: "bg-orange-400",  text: "text-orange-700",  bg: "bg-orange-50"  },
  { max: 1.0, label: "High difficulty",color: "bg-red-400",   text: "text-red-700",     bg: "bg-red-50"     },
];

export function ScoreBar({ score }: Props) {
  const band = BANDS.find((b) => score <= b.max) ?? BANDS[BANDS.length - 1];
  const pct  = Math.round(score * 100);

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Difficulty score
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${band.text} ${band.bg}`}>
          {band.label}
        </span>
      </div>

      {/* Bar track */}
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${band.color}`}
          style={{ width: `${pct}%` }}
        />
        {/* Threshold markers */}
        {[20, 40, 70].map((t) => (
          <div
            key={t}
            className="absolute top-0 bottom-0 w-px bg-white/60"
            style={{ left: `${t}%` }}
          />
        ))}
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-400">0</span>
        <span className="text-[10px] font-semibold text-gray-600">{pct}%</span>
        <span className="text-[10px] text-gray-400">100</span>
      </div>

      <p className="text-[10px] text-gray-400 mt-1 italic">
        Mocked score — live scoring arrives in Week 3
      </p>
    </div>
  );
}
