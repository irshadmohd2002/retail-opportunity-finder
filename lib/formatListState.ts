import type { ScoredFormat, TieredFormats } from "./scoring";
import { isReliableCompetition } from "./scoring";

export const NOT_RANKED_SPACE_MISSING = "Not ranked - space data is missing for this outlet";
export const NOT_RANKED_SCORES_MISSING = "Not ranked — demand / whitespace data is missing for this outlet.";
export const NO_PRIORITY_FEASIBLE = "No feasible formats scored highly enough for a priority recommendation.";
export const MARKET_OPPORTUNITY_TITLE = "Market opportunity - space to be confirmed";
export const MARKET_OPPORTUNITY_SUBTEXT =
  "Ranked from nearby competitor data (Foursquare OS Places, may be stale or incomplete) and local demand. Not verified, and not a feasibility verdict. Space data is missing, so these formats are not confirmed as feasible.";
export const NO_RELIABLE_COMPETITOR_DATA = "No reliable competitor data for this format";
export const COMPETITION_SOURCE_NOTE =
  "Source: Foursquare OS Places. This data may be stale or incomplete.";

/** At least one format has a known feasibility, i.e. there is something for the "Sort by" lens to re-order. */
export function hasRankableFormats(tiers: TieredFormats): boolean {
  return (
    tiers.priority.length + tiers.alsoFeasible.length + tiers.worthExploring.length + tiers.limitedFit.length > 0
  );
}

/** Formats exist for the outlet, but every one has unknown feasibility (space data missing). */
export function allFeasibilityUnknown(tiers: TieredFormats): boolean {
  return !hasRankableFormats(tiers) && tiers.marketOpportunity.length + tiers.unknownFit.length > 0;
}

/**
 * Empty-state text for the Priority section. Missing space data wins over
 * missing demand/whitespace when both apply.
 */
export function priorityEmptyLabel(tiers: TieredFormats, scoreInputsAreMissing: boolean): string {
  if (allFeasibilityUnknown(tiers)) return NOT_RANKED_SPACE_MISSING;
  if (scoreInputsAreMissing) return NOT_RANKED_SCORES_MISSING;
  return NO_PRIORITY_FEASIBLE;
}

export interface CompetitionDisplay {
  /** "Whitespace" line value: a 0-100 number, or "no data". Null when the outlet has no competition data to talk about (legacy index). */
  whitespaceLabel: string | null;
  /** The competitor sentence, or the "no reliable data" message. Null when the outlet has no competition rows at all. */
  competitorLine: string | null;
  /** Always shown alongside competitor data; null only when there is no competition data at all. */
  sourceNote: string | null;
  /** Extra caveat, e.g. a border-risk warning. */
  caveat: string | null;
}

/** The modelled expectation can come through slightly negative; an expected count below zero is shown as 0. */
function formatExpected(n: number): string {
  const v = Math.max(0, n);
  return v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v));
}

/** Deep-dive text for a scored format's competition data. */
export function competitionDisplay(scored: ScoredFormat): CompetitionDisplay {
  const { whitespace, competition } = scored;

  // Outlet has no competition rows at all (legacy whitespace_index): nothing to say about competitors.
  if (whitespace.source === "outlet_index") {
    return { whitespaceLabel: null, competitorLine: null, sourceNote: null, caveat: null };
  }

  const whitespaceLabel = whitespace.value === null ? "no data" : String(whitespace.value);
  const hasCounts =
    competition !== null &&
    (competition.signal_quality === "strong" || competition.signal_quality === "borderline") &&
    competition.count_2km !== null;

  if (!hasCounts) {
    return { whitespaceLabel, competitorLine: NO_RELIABLE_COMPETITOR_DATA, sourceNote: COMPETITION_SOURCE_NOTE, caveat: null };
  }

  const expected =
    competition.expected_count_2km !== null
      ? ` (about ${formatExpected(competition.expected_count_2km)} expected for this area)`
      : "";
  return {
    whitespaceLabel,
    competitorLine: `Competitors within 2 km: ${competition.count_2km}${expected}`,
    sourceNote: COMPETITION_SOURCE_NOTE,
    caveat: !isReliableCompetition(competition)
      ? competition.border_risk === true
        ? "This outlet is near an area boundary, so the gap score is not used."
        : "The gap score is unavailable or unconfirmed for this format, so it is not used."
      : competition.signal_quality === "borderline"
        ? "Borderline signal - treat the gap score with caution."
        : null,
  };
}
