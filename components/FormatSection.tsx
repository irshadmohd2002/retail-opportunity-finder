import type { ScoredFormat } from "@/lib/scoring";
import type { BrandPartnership } from "@/lib/types";
import FormatRow from "./FormatRow";

interface FormatSectionProps {
  title: string;
  description?: string;
  formats: ScoredFormat[];
  brandsByFormat: Record<string, BrandPartnership[]>;
  onOpenFormat: (scored: ScoredFormat) => void;
  onOpenBrand: (brand: BrandPartnership) => void;
  showShortfall?: boolean;
  emptyLabel?: string;
}

export default function FormatSection({
  title,
  description,
  formats,
  brandsByFormat,
  onOpenFormat,
  onOpenBrand,
  showShortfall,
  emptyLabel,
}: FormatSectionProps) {
  if (formats.length === 0 && !emptyLabel) return null;

  return (
    <div className="bg-surface rounded-md shadow-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
      </div>
      {formats.length === 0 ? (
        <p className="text-sm text-muted italic px-5 py-4">{emptyLabel}</p>
      ) : (
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: "24%" }} />
            <col style={{ width: "32%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="py-2 pl-3 pr-2 font-medium">Format</th>
              <th className="py-2 px-2 font-medium">Recommended brands</th>
              <th className="py-2 px-2 font-medium">Typical space</th>
              <th className="py-2 px-2 font-medium">Space used</th>
              <th className="py-2 pl-2 pr-3 font-medium">Fit</th>
            </tr>
          </thead>
          <tbody>
            {formats.map((scored) => (
              <FormatRow
                key={scored.taxonomy.code}
                scored={scored}
                brands={brandsByFormat[scored.taxonomy.code] ?? []}
                onOpenFormat={() => onOpenFormat(scored)}
                onOpenBrand={onOpenBrand}
                showShortfall={showShortfall}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
