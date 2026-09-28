"use client";

import { useMemo, useState } from "react";
import {
  scoreFormatsForOutlet,
  tierFormats,
  sortTiersByLens,
  getBrandShortlist,
  type PriorityLens,
  scoreInputsMissing,
  type ScoredFormat,
} from "@/lib/scoring";
import { hasRankableFormats, priorityEmptyLabel } from "@/lib/formatListState";
import { EXISTING_OUTLETS_UNKNOWN_NOTE } from "@/lib/existingTenants";
import type { RoProfile, FormatEconomics, BrandPartnership, RoFormatCompetition } from "@/lib/types";
import PriorityLensSelect from "./PriorityLensSelect";
import FormatSection from "./FormatSection";
import LimitedFitList from "./LimitedFitList";
import MarketOpportunityList from "./MarketOpportunityList";
import UnknownFitList from "./UnknownFitList";
import FormatDeepDiveModal from "./FormatDeepDiveModal";
import BrandDeepDiveModal from "./BrandDeepDiveModal";

interface FormatListProps {
  outlet: RoProfile;
  economics: FormatEconomics[];
  brands: BrandPartnership[];
  /** This outlet's per-format competition rows; empty means the legacy whitespace_index applies. */
  competition: RoFormatCompetition[];
}

export default function FormatList({ outlet, economics, brands, competition }: FormatListProps) {
  const [lens, setLens] = useState<PriorityLens>("best_overall");
  const [openFormat, setOpenFormat] = useState<ScoredFormat | null>(null);
  const [openBrand, setOpenBrand] = useState<BrandPartnership | null>(null);

  const economicsByCode = useMemo(
    () => Object.fromEntries(economics.map((e) => [e.code, e])),
    [economics]
  );

  const competitionByCode = useMemo(
    () => Object.fromEntries(competition.map((c) => [c.format_code, c])),
    [competition]
  );

  const tiers = useMemo(() => {
    const scored = scoreFormatsForOutlet(outlet, economicsByCode, competitionByCode);
    return sortTiersByLens(tierFormats(scored), lens);
  }, [outlet, economicsByCode, competitionByCode, lens]);

  const scoresUnavailable = scoreInputsMissing(outlet, competition.length > 0);
  const canSort = hasRankableFormats(tiers);

  const brandsByFormat = useMemo(() => {
    const codes = new Set(
      [
        ...tiers.priority,
        ...tiers.alsoFeasible,
        ...tiers.worthExploring,
        ...tiers.limitedFit,
        ...tiers.marketOpportunity,
        ...tiers.unknownFit,
      ].map((f) => f.taxonomy.code)
    );
    const map: Record<string, BrandPartnership[]> = {};
    for (const code of codes) map[code] = getBrandShortlist(code, brands);
    return map;
  }, [tiers, brands]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="text-xs text-muted italic flex flex-col gap-1">
          {scoresUnavailable && (
            <p>Demand / whitespace data is missing for this outlet, so fit scores are unavailable and formats are not ranked.</p>
          )}
          {outlet.existing_tenants == null && <p>{EXISTING_OUTLETS_UNKNOWN_NOTE}</p>}
        </div>
        {canSort && <PriorityLensSelect value={lens} onChange={setLens} />}
      </div>

      <FormatSection
        title="Priority recommendations"
        description="Top-scoring feasible formats for this outlet."
        formats={tiers.priority}
        brandsByFormat={brandsByFormat}
        onOpenFormat={setOpenFormat}
        onOpenBrand={setOpenBrand}
        emptyLabel={priorityEmptyLabel(tiers, scoresUnavailable)}
      />

      <FormatSection
        title="Also feasible"
        formats={tiers.alsoFeasible}
        brandsByFormat={brandsByFormat}
        onOpenFormat={setOpenFormat}
        onOpenBrand={setOpenBrand}
      />

      <FormatSection
        title="Worth exploring"
        description="Marginal fit — close to the space threshold."
        formats={tiers.worthExploring}
        brandsByFormat={brandsByFormat}
        onOpenFormat={setOpenFormat}
        onOpenBrand={setOpenBrand}
        showShortfall
      />

      <LimitedFitList formats={tiers.limitedFit} onOpenFormat={setOpenFormat} />

      <MarketOpportunityList formats={tiers.marketOpportunity} onOpenFormat={setOpenFormat} />

      <UnknownFitList formats={tiers.unknownFit} onOpenFormat={setOpenFormat} />

      {openFormat && (
        <FormatDeepDiveModal
          scored={openFormat}
          onClose={() => setOpenFormat(null)}
        />
      )}
      {openBrand && <BrandDeepDiveModal brand={openBrand} onClose={() => setOpenBrand(null)} />}
    </div>
  );
}
