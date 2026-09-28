import { TAXONOMY, isEligibleForOutletType, type TaxonomyFormat } from "./taxonomy";
import type { RoProfile, FormatEconomics, BrandPartnership, RoFormatCompetition } from "./types";

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

/**
 * Where a format's whitespace input came from.
 * - "outlet_index": the outlet-wide ro_profiles.whitespace_index (outlets with no competition rows; legacy behaviour).
 * - "gap_score": a reliable per-format competition gap score.
 * - "no_data": the outlet has competition rows but this format's signal is not reliable. Shown as
 *   "no data" in the UI and scored with NEUTRAL_WHITESPACE -- never as zero or as high whitespace.
 */
export type WhitespaceSource = "outlet_index" | "gap_score" | "no_data";

export interface WhitespaceInput {
  value: number | null;
  source: WhitespaceSource;
}

/** Whitespace value used in the score when there is no reliable data: the midpoint, so it neither rewards nor penalizes. */
export const NEUTRAL_WHITESPACE = 50;

export interface ScoredFormat {
  taxonomy: TaxonomyFormat;
  economics: FormatEconomics | null;
  /** Whitespace input actually used for this format, and where it came from. */
  whitespace: WhitespaceInput;
  /** This outlet's competition row for the format, if any. Null for outlets with no competition data. */
  competition: RoFormatCompetition | null;
  /**
   * Demand + whitespace only (feasibility weight dropped and the rest re-weighted).
   * Set ONLY when feasibility is unknown, demand exists and the gap score is
   * reliable -- otherwise null. Never comparable to `score`, never a "feasible" signal.
   */
  marketScore: number | null;
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
 * The one place score weights live. Stage 3 weights are an illustrative
 * placeholder from a single-judge AHP pass (see project spec). They are NOT a
 * finalized methodology -- do not present them to users as settled, and expect
 * them to be recalibrated once the team has real outlet performance data
 * (Phase 2).
 *
 * With a feasibility input: 0.45 demand / 0.35 whitespace / 0.20 feasibility.
 * With `feasibility: null` (market score, space unknown): the feasibility
 * weight is dropped and the remaining two are re-weighted to sum to 1
 * (0.45/0.80 and 0.35/0.80).
 */
export function weightedScore(inputs: {
  demand: number;
  whitespace: number;
  feasibility: number | null;
}): number {
  const weights = { demand: 0.45, whitespace: 0.35, feasibility: 0.2 } as const;
  if (inputs.feasibility === null) {
    const total = weights.demand + weights.whitespace;
    return (weights.demand / total) * inputs.demand + (weights.whitespace / total) * inputs.whitespace;
  }
  return (
    weights.demand * inputs.demand +
    weights.whitespace * inputs.whitespace +
    weights.feasibility * inputs.feasibility
  );
}

/** A per-format gap score is only trusted when the signal is strong/borderline, there is no border risk, and the score exists. */
export function isReliableCompetition(row: RoFormatCompetition | null | undefined): row is RoFormatCompetition & {
  gap_score: number;
} {
  return (
    !!row &&
    (row.signal_quality === "strong" || row.signal_quality === "borderline") &&
    row.border_risk === false &&
    row.gap_score !== null
  );
}

/**
 * Whitespace input for one format. An outlet with NO competition rows keeps
 * the legacy outlet-wide whitespace_index exactly (including null = missing).
 * An outlet WITH rows ignores whitespace_index and uses only per-format gap
 * scores; anything unreliable or absent is "no data", never 0 or high.
 */
export function resolveWhitespace(
  outlet: RoProfile,
  outletHasCompetition: boolean,
  row: RoFormatCompetition | null
): WhitespaceInput {
  if (!outletHasCompetition) return { value: outlet.whitespace_index, source: "outlet_index" };
  if (isReliableCompetition(row)) return { value: row.gap_score, source: "gap_score" };
  return { value: null, source: "no_data" };
}

/** True when the inputs needed to score any format are missing for this outlet (demand, or whitespace with no competition rows to fall back on). */
export function scoreInputsMissing(outlet: RoProfile, outletHasCompetition: boolean): boolean {
  return outlet.demand_index == null || (!outletHasCompetition && outlet.whitespace_index == null);
}

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
  economicsByCode: Record<string, FormatEconomics>,
  competitionByCode: Record<string, RoFormatCompetition> = {}
): ScoredFormat[] {
  // A missing vacant_sqm is unknown, not zero -- never coerce it into a number.
  const vacantSqft = outlet.vacant_sqm == null ? null : outlet.vacant_sqm * SQM_TO_SQFT;
  const excluded = new Set(outlet.existing_tenants ?? []);
  const outletHasCompetition = Object.keys(competitionByCode).length > 0;

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

      const competition = competitionByCode[taxonomy.code] ?? null;
      const whitespace = resolveWhitespace(outlet, outletHasCompetition, competition);
      const demand = outlet.demand_index;
      // "no data" scores at the neutral midpoint; a legacy missing whitespace_index stays null (unscored).
      const whitespaceForScore = whitespace.source === "no_data" ? NEUTRAL_WHITESPACE : whitespace.value;
      const score =
        demand === null || whitespaceForScore === null || ratio === null
          ? null
          : weightedScore({
              demand,
              whitespace: whitespaceForScore,
              feasibility: feasibilityScoreFromRatio(ratio),
            });
      const marketScore =
        status === "unknown" && demand !== null && whitespace.source === "gap_score" && whitespace.value !== null
          ? weightedScore({ demand, whitespace: whitespace.value, feasibility: null })
          : null;

      return {
        taxonomy,
        economics,
        whitespace,
        competition,
        marketScore,
        vacantSqft,
        ratio,
        status,
        shortfallSqft,
        score,
      };
    });
}

export interface TieredFormats {
  priority: ScoredFormat[];
  alsoFeasible: ScoredFormat[];
  worthExploring: ScoredFormat[];
  limitedFit: ScoredFormat[];
  /**
   * Feasibility unknown but demand and a reliable gap score exist: ranked by
   * market score only (never mixed into priority, never called "feasible").
   * Formats with known feasibility can never be here.
   */
  marketOpportunity: ScoredFormat[];
  /** Feasibility could not be computed (space data missing) and no market score either. Never ranked. */
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
  const unknown = scored.filter((f) => f.status === "unknown");
  const marketOpportunity = unknown
    .filter((f) => f.marketScore !== null)
    .sort((a, b) => (b.marketScore ?? -1) - (a.marketScore ?? -1));
  const unknownFit = unknown.filter((f) => f.marketScore === null);

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
    marketOpportunity,
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
    // Always ordered by market score -- the lens only re-orders formats whose feasibility is known.
    marketOpportunity: tiers.marketOpportunity,
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
