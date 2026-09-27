import { FORMAT_ICONS } from "@/lib/formatIcons";
import type { ScoredFormat } from "@/lib/scoring";

interface LimitedFitListProps {
  formats: ScoredFormat[];
  onOpenFormat: (scored: ScoredFormat) => void;
}

export default function LimitedFitList({ formats, onOpenFormat }: LimitedFitListProps) {
  if (formats.length === 0) return null;

  return (
    <div className="bg-surface rounded-md shadow-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold">Limited fit</h2>
        <p className="text-sm text-muted mt-0.5">Not feasible with currently available space.</p>
      </div>
      <ul className="divide-y divide-border">
        {formats.map((scored) => {
          const Icon = FORMAT_ICONS[scored.taxonomy.code];
          return (
            <li
              key={scored.taxonomy.code}
              onClick={() => onOpenFormat(scored)}
              className="flex items-center gap-2.5 px-5 py-2.5 cursor-pointer hover:bg-bg"
            >
              {Icon && <Icon size={16} style={{ color: "var(--notfeasible)" }} className="shrink-0" />}
              <span className="text-sm text-muted">{scored.taxonomy.format}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
