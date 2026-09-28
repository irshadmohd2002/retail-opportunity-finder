import { TAXONOMY, isEligibleForOutletType, type TaxonomyFormat } from "./taxonomy";
import type { RoProfile, FormatEconomics, BrandPartnership } from "./types";

export const SQM_TO_SQFT = 10.7639;

/**
 * "unknown" means the inputs to the feasibility gate (outlet vacant area, or
 * the format's own space requirement) are missing. It is deliberately a fourth
 * status rather than a default to not_feasible: absent data is not evidence of
 * a poor fit.
 */
export type FeasibilityStatus = "feasible" | "marginal" | "not_feasible" | "unknown";

export const UNKNOWN_SPACE_LABEL = "Unknown - space data missing";

export type PriorityLens =
  | "best_overall"
  | "lowest_investment"
  | "highest_margin"
  | "fastest_to_launch";

export interface ScoredFormat {
  taxonomy: TaxonomyFormat;
  economics: FormatEconomics | null;
  /** Outlet vacant space, converted once, shared by every format. Null when the outlet's vacant_sqm is unknown. */
  vacantSqft: number | null;
  /** vacantSqft / format.space_sqft. Null when either side is unknown. */
  ratio: number | null;
  status: FeasibilityStatus;
  /** Positive sq.ft. still needed to reach the format's space threshold. Only meaningful for marginal/not_feasible. */
  shortfallSqft: number | null;
  /**
   * 0-100 composite score, or null when an input (demand/whitespace index) is
   * missing. A missing input must never be silently treated as 0 -- callers
   * should render "score not available", not a low score.
   */
  score: number | null;
}

/**
 * Stage 3 weights are an illustrative placeholder from a single-judge AHP pass
 * (see project spec). They are NOT a finalized methodology -- do not present
 * them to users as settled, and expect them to be recalibrated once the team
 * has real outlet performance data (Phase 2).
 */
const SCORE_WEIGHTS = {
  demand: 0.45,
  whitespace: 0.35,
  feasibility: 0.2,
} as const;

function feasibilityScoreFromRatio(ratio: number): number {
  return Math.min(ratio * 100, 100);
}

function statusFromRatio(ratio: number): FeasibilityStatus {
  if (ratio >= 1.0) return "feasible";
  if (ratio >= 0.7) return "marginal";
  return "not_feasible";
}

/**
 * Stages 0-3: eligibility pre-filter, feasibility gate, cannibalization
 * exclusion, and composite scoring. Returns one entry per non-excluded,
 * type-eligible Category A format -- callers apply tiering (Stage 4) and the
 * Priority Lens re-sort (Stage 5) on top of this.
 */
export function scoreFormatsForOutlet(
  outlet: RoProfile,
  economicsByCode: Record<string, FormatEconomics>
): ScoredFormat[] {
  // A missing vacant_sqm is unknown, not zero -- never coerce it into a number.
  const vacantSqft = outlet.vacant_sqm == null ? null : outlet.vacant_sqm * SQM_TO_SQFT;
  const excluded = new Set(outlet.existing_tenants ?? []);

  return TAXONOMY.filter((f) => isEligibleForOutletType(f, outlet.type))
    .filter((f) => !excluded.has(f.code))
    .map((taxonomy) => {
      const economics = economicsByCode[taxonomy.code] ?? null;
      const spaceSqft = economics?.space_sqft ?? null;

      const ratio =
        vacantSqft !== null && spaceSqft !== null && spaceSqft > 0 ? vacantSqft / spaceSqft : null;
      const status: FeasibilityStatus = ratio === null ? "unknown" : statusFromRatio(ratio);
      const shortfallSqft =
        ratio !== null && ratio < 1.0 && vacantSqft !== null && spaceSqft !== null
          ? Math.round(spaceSqft - vacantSqft)
          : null;

      const demand = outlet.demand_index;
      const whitespace = outlet.whitespace_index;
      const score =
        demand === null || whitespace === null || ratio === null
          ? null
          : SCORE_WEIGHTS.demand * demand +
            SCORE_WEIGHTS.whitespace * whitespace +
            SCORE_WEIGHTS.feasibility * feasibilityScoreFromRatio(ratio);

      return { taxonomy, economics, vacantSqft, ratio, status, shortfallSqft, score };
    });
}

export interface TieredFormats {
  priority: ScoredFormat[];
  alsoFeasible: ScoredFormat[];
  worthExploring: ScoredFormat[];
  limitedFit: ScoredFormat[];
  /** Feasibility could not be computed (space data missing). Never ranked. */
  unknownFit: ScoredFormat[];
}

/**
 * Stage 4: presentation tiering, deliberately isolated in its own function.
 * The cap-of-4 / max-2-per-theme diversity rule is a provisional prioritization
 * rule the team plans to refine -- swap this function out without touching
 * scoring (Stage 3) or the lens re-sort (Stage 5).
 */
export function tierFormats(scored: ScoredFormat[]): TieredFormats {
  const feasible = scored.filter((f) => f.status === "feasible");
  const marginal = scored.filter((f) => f.status === "marginal");
  const notFeasible = scored.filter((f) => f.status === "not_feasible");
  const unknownFit = scored.filter((f) => f.status === "unknown");

  const byScoreDesc = (a: ScoredFormat, b: ScoredFormat) => (b.score ?? -1) - (a.score ?? -1);
  const feasibleRanked = [...feasible].sort(byScoreDesc);

  const priority: ScoredFormat[] = [];
  const themeCounts = new Map<string, number>();
  for (const f of feasibleRanked) {
    if (priority.length >= 4) break;
    // Priority means top-*scoring*. A feasible format with no score (demand or
    // whitespace index missing) has nothing to rank on, so it stays in
    // "also feasible" instead of being picked in arbitrary order.
    if (f.score === null) continue;
    const theme = f.taxonomy.theme;
    const count = themeCounts.get(theme) ?? 0;
    if (count >= 2) continue;
    priority.push(f);
    themeCounts.set(theme, count + 1);
  }

  const priorityCodes = new Set(priority.map((f) => f.taxonomy.code));
  const alsoFeasible = feasibleRanked.filter((f) => !priorityCodes.has(f.taxonomy.code));

  return {
    priority,
    alsoFeasible,
    worthExploring: [...marginal].sort(byScoreDesc),
    limitedFit: [...notFeasible].sort(byScoreDesc),
    unknownFit,
  };
}

/**
 * Stage 5: Priority Lens re-sort. Re-orders within a tier only -- never moves
 * a format between tiers.
 */
export function sortByLens(formats: ScoredFormat[], lens: PriorityLens): ScoredFormat[] {
  const sorted = [...formats];
  switch (lens) {
    case "lowest_investment":
      return sorted.sort(
        (a, b) => (a.economics?.capex_min_inr ?? Infinity) - (b.economics?.capex_min_inr ?? Infinity)
      );
    case "highest_margin":
      return sorted.sort(
        (a, b) => (b.economics?.ebitda_margin_pct ?? -Infinity) - (a.economics?.ebitda_margin_pct ?? -Infinity)
      );
    case "fastest_to_launch":
      return sorted.sort(
        (a, b) =>
          (a.economics?.speed_to_launch_tier ?? Infinity) - (b.economics?.speed_to_launch_tier ?? Infinity)
      );
    case "best_overall":
    default:
      return sorted.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }
}

export function sortTiersByLens(tiers: TieredFormats, lens: PriorityLens): TieredFormats {
  return {
    priority: sortByLens(tiers.priority, lens),
    alsoFeasible: sortByLens(tiers.alsoFeasible, lens),
    worthExploring: sortByLens(tiers.worthExploring, lens),
    limitedFit: sortByLens(tiers.limitedFit, lens),
    unknownFit: sortByLens(tiers.unknownFit, lens),
  };
}

/**
 * Stage 6: brand shortlist. Never pads to a fixed count -- returns whatever
 * is actually known (0-3 brands) for the format.
 */
export function getBrandShortlist(
  formatCode: string,
  allPartnerships: BrandPartnership[]
): BrandPartnership[] {
  return allPartnerships.filter((b) => b.format_code === formatCode).slice(0, 3);
}
