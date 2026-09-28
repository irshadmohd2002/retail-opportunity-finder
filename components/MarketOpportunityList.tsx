import { FORMAT_ICONS } from "@/lib/formatIcons";
import { MARKET_OPPORTUNITY_SUBTEXT, MARKET_OPPORTUNITY_TITLE } from "@/lib/formatListState";
import { UNKNOWN_SPACE_LABEL, type ScoredFormat } from "@/lib/scoring";

interface MarketOpportunityListProps {
  formats: ScoredFormat[];
  onOpenFormat: (scored: ScoredFormat) => void;
}

/**
 * Formats whose feasibility is unknown (space data missing) but which have
 * demand and a reliable competition gap score. Deliberately visually distinct
 * from the feasible tiers: no fit dots, and the copy says feasibility is unconfirmed.
 */
export default function MarketOpportunityList({ formats, onOpenFormat }: MarketOpportunityListProps) {
  if (formats.length === 0) return null;

  return (
    <div className="bg-surface rounded-md shadow-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold">{MARKET_OPPORTUNITY_TITLE}</h2>
        <p className="text-sm text-muted mt-0.5">{MARKET_OPPORTUNITY_SUBTEXT}</p>
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
              <span className="text-xs text-muted text-right">
                Market score {Math.round(scored.marketScore ?? 0)}
                <span className="block italic">{UNKNOWN_SPACE_LABEL}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
