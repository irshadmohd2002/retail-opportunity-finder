import { formatSqft } from "@/lib/format";
import { FORMAT_ICONS } from "@/lib/formatIcons";
import FitDots from "./FitDots";
import ProgressBar from "./ProgressBar";
import BrandChip from "./BrandChip";
import SourcedValue from "./SourcedValue";
import type { ScoredFormat } from "@/lib/scoring";
import type { BrandPartnership } from "@/lib/types";

const CATEGORY_COLOR: Record<string, string> = {
  fb: "var(--cat-fb)",
  conv: "var(--cat-conv)",
  auto: "var(--cat-auto)",
  other: "var(--cat-other)",
};

interface FormatRowProps {
  scored: ScoredFormat;
  brands: BrandPartnership[];
  onOpenFormat: () => void;
  onOpenBrand: (brand: BrandPartnership) => void;
  showShortfall?: boolean;
}

export default function FormatRow({ scored, brands, onOpenFormat, onOpenBrand, showShortfall }: FormatRowProps) {
  const { taxonomy, economics, vacantSqft, shortfallSqft } = scored;
  const Icon = FORMAT_ICONS[taxonomy.code];
  const spaceUsedPct = economics?.space_sqft ? (economics.space_sqft / vacantSqft) * 100 : null;

  return (
    <tr onClick={onOpenFormat} className="cursor-pointer hover:bg-bg border-b border-border last:border-b-0">
      <td className="py-3 pl-3 pr-2 align-top" style={{ borderLeft: `3px solid ${CATEGORY_COLOR[taxonomy.categoryTag]}` }}>
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={18} className="text-navy shrink-0" />}
          <div>
            <p className="font-medium text-sm">{taxonomy.format}</p>
            <p className="text-xs text-muted">{taxonomy.theme}</p>
          </div>
        </div>
      </td>

      <td className="py-3 px-2 align-top">
        {brands.length === 0 ? (
          <p className="text-xs text-muted italic">Typically self-operated by the outlet dealer — no branded partner available.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {brands.map((b) => (
              <BrandChip key={b.id} label={b.brand_name} onClick={() => onOpenBrand(b)} />
            ))}
          </div>
        )}
      </td>

      <td className="py-3 px-2 align-top text-sm whitespace-nowrap">
        <SourcedValue
          value={economics?.space_sqft ?? null}
          sourced={economics?.space_sourced ?? false}
          format={(v) => formatSqft(Number(v))}
          alwaysMuted
        />
      </td>

      <td className="py-3 px-2 align-top">
        {spaceUsedPct !== null ? (
          <div>
            <ProgressBar pct={spaceUsedPct} color="var(--muted)" />
            <p className="text-xs text-muted mt-1">{Math.round(spaceUsedPct)}% of available space</p>
          </div>
        ) : (
          <p className="text-xs text-muted italic">—</p>
        )}
        {showShortfall && shortfallSqft !== null && (
          <p className="text-xs mt-1" style={{ color: "var(--copper)" }}>
            ~{shortfallSqft.toLocaleString("en-IN")} sq.ft. more needed
          </p>
        )}
      </td>

      <td className="py-3 pl-2 pr-3 align-top">
        <FitDots score={scored.score} />
      </td>
    </tr>
  );
}
