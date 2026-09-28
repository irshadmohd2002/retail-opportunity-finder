"use client";

import { useMemo, useState } from "react";
import {
  scoreFormatsForOutlet,
  tierFormats,
  sortTiersByLens,
  getBrandShortlist,
  type PriorityLens,
  type ScoredFormat,
} from "@/lib/scoring";
import type { RoProfile, FormatEconomics, BrandPartnership } from "@/lib/types";
import PriorityLensSelect from "./PriorityLensSelect";
import FormatSection from "./FormatSection";
import LimitedFitList from "./LimitedFitList";
import UnknownFitList from "./UnknownFitList";
import FormatDeepDiveModal from "./FormatDeepDiveModal";
import BrandDeepDiveModal from "./BrandDeepDiveModal";

interface FormatListProps {
  outlet: RoProfile;
  economics: FormatEconomics[];
  brands: BrandPartnership[];
}

export default function FormatList({ outlet, economics, brands }: FormatListProps) {
  const [lens, setLens] = useState<PriorityLens>("best_overall");
  const [openFormat, setOpenFormat] = useState<ScoredFormat | null>(null);
  const [openBrand, setOpenBrand] = useState<BrandPartnership | null>(null);

  const economicsByCode = useMemo(
    () => Object.fromEntries(economics.map((e) => [e.code, e])),
    [economics]
  );

  const tiers = useMemo(() => {
    const scored = scoreFormatsForOutlet(outlet, economicsByCode);
    return sortTiersByLens(tierFormats(scored), lens);
  }, [outlet, economicsByCode, lens]);

  const scoresUnavailable = outlet.demand_index == null || outlet.whitespace_index == null;

  const brandsByFormat = useMemo(() => {
    const codes = new Set(
      [...tiers.priority, ...tiers.alsoFeasible, ...tiers.worthExploring, ...tiers.limitedFit, ...tiers.unknownFit].map(
        (f) => f.taxonomy.code
      )
    );
    const map: Record<string, BrandPartnership[]> = {};
    for (const code of codes) map[code] = getBrandShortlist(code, brands);
    return map;
  }, [tiers, brands]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-muted italic">
          {scoresUnavailable
            ? "Demand / whitespace data is missing for this outlet, so fit scores are unavailable and formats are not ranked."
            : ""}
        </p>
        <PriorityLensSelect value={lens} onChange={setLens} />
      </div>

      <FormatSection
        title="Priority recommendations"
        description="Top-scoring feasible formats for this outlet."
        formats={tiers.priority}
        brandsByFormat={brandsByFormat}
        onOpenFormat={setOpenFormat}
        onOpenBrand={setOpenBrand}
        emptyLabel={
          scoresUnavailable
            ? "Not ranked — demand / whitespace data is missing for this outlet."
            : "No feasible formats scored highly enough for a priority recommendation."
        }
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

      <UnknownFitList formats={tiers.unknownFit} onOpenFormat={setOpenFormat} />

      {openFormat && (
        <FormatDeepDiveModal
          taxonomy={openFormat.taxonomy}
          economics={openFormat.economics}
          onClose={() => setOpenFormat(null)}
        />
      )}
      {openBrand && <BrandDeepDiveModal brand={openBrand} onClose={() => setOpenBrand(null)} />}
    </div>
  );
}
