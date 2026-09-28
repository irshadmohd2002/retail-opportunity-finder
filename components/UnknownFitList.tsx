import { FORMAT_ICONS } from "@/lib/formatIcons";
import { UNKNOWN_SPACE_LABEL, type ScoredFormat } from "@/lib/scoring";

interface UnknownFitListProps {
  formats: ScoredFormat[];
  onOpenFormat: (scored: ScoredFormat) => void;
}

export default function UnknownFitList({ formats, onOpenFormat }: UnknownFitListProps) {
  if (formats.length === 0) return null;

  return (
    <div className="bg-surface rounded-md shadow-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold">Feasibility unknown</h2>
        <p className="text-sm text-muted mt-0.5">
          Space data is missing, so these formats can&apos;t be rated feasible or not feasible yet.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {formats.map((scored) => {
          const Icon = FORMAT_ICONS[scored.taxonomy.code];
          return (
            <li
              key={scored.taxonomy.code}
              onClick={() => onOpenFormat(scored)}
              className="flex items-center justify-between gap-2.5 px-5 py-2.5 cursor-pointer hover:bg-bg"
            >
              <span className="flex items-center gap-2.5">
                {Icon && <Icon size={16} className="text-muted shrink-0" />}
                <span className="text-sm">{scored.taxonomy.format}</span>
              </span>
              <span className="text-xs text-muted italic">{UNKNOWN_SPACE_LABEL}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
