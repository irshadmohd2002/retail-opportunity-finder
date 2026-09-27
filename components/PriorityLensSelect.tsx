import type { PriorityLens } from "@/lib/scoring";

const LENS_LABELS: Record<PriorityLens, string> = {
  best_overall: "Best overall fit",
  lowest_investment: "Lowest investment first",
  highest_margin: "Highest margin first",
  fastest_to_launch: "Fastest to launch first",
};

interface PriorityLensSelectProps {
  value: PriorityLens;
  onChange: (lens: PriorityLens) => void;
}

export default function PriorityLensSelect({ value, onChange }: PriorityLensSelectProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Sort by</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PriorityLens)}
        className="border border-border rounded-sm px-2 py-1.5 bg-surface"
      >
        {Object.entries(LENS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
