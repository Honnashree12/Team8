interface Props {
  domain: string;
  paused: boolean;
  onToggle: () => void;
}

export function DomainPause({ domain, paused, onToggle }: Props) {
  if (!domain) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-700 truncate">
          {paused ? "⏸ Paused on" : "▶ Active on"}
        </p>
        <p className="text-[11px] text-gray-400 truncate">{domain}</p>
      </div>
      <button
        onClick={onToggle}
        className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
          paused
            ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
            : "bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-600"
        }`}
      >
        {paused ? "Resume here" : "Pause here"}
      </button>
    </div>
  );
}
