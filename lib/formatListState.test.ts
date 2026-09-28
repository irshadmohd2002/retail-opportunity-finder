import { describe, expect, it } from "vitest";
import {
  COMPETITION_SOURCE_NOTE,
  NO_PRIORITY_FEASIBLE,
  NO_RELIABLE_COMPETITOR_DATA,
  NOT_RANKED_SCORES_MISSING,
  NOT_RANKED_SPACE_MISSING,
  allFeasibilityUnknown,
  competitionDisplay,
  hasRankableFormats,
  priorityEmptyLabel,
} from "./formatListState";
import { scoreFormatsForOutlet, tierFormats, type ScoredFormat } from "./scoring";
import type { FormatEconomics, RoFormatCompetition, RoProfile } from "./types";

function outlet(overrides: Partial<RoProfile> = {}): RoProfile {
  return {
    id: "test",
    name: "Test",
    state: null,
    district: null,
    area: null,
    location: null,
    type: "highway",
    ownership: null,
    plot_sqm: null,
    vacant_sqm: 100,
    existing_tenants: [],
    fuel_volume_kl_monthly: null,
    vehicle_mix_2w_pct: null,
    vehicle_mix_4w_pct: null,
    vehicle_mix_cv_pct: null,
    layout_diagram_url: null,
    sourced: true,
    source_note: null,
    last_verified: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    demand_index: 60,
    whitespace_index: 60,
    omc_id: 1,
    latitude: null,
    longitude: null,
    pincode: null,
    ...overrides,
  };
}

function eco(code: string, space_sqft: number | null): FormatEconomics {
  return {
    code,
    name: code,
    space_sqft,
    space_sourced: true,
    space_source_note: null,
    capex_min_inr: null,
    capex_max_inr: null,
    capex_sourced: false,
    capex_source_note: null,
    revenue_monthly_inr: null,
    revenue_sourced: false,
    ebitda_margin_pct: null,
    ebitda_sourced: false,
    payback_months: null,
    payback_sourced: false,
    notes: null,
    updated_at: "2026-01-01",
    speed_to_launch_tier: 2,
  };
}

function competition(code: string, overrides: Partial<RoFormatCompetition> = {}): RoFormatCompetition {
  return {
    ro_id: "test",
    format_code: code,
    count_1km: 10,
    count_2km: 34,
    expected_count_2km: 27.2,
    gap_score: 39,
    naive_whitespace_score: 21,
    signal_quality: "strong",
    border_risk: false,
    ...overrides,
  };
}

const ALL_CODES = ["A1.1", "A1.2", "A1.3"];
const allEco = Object.fromEntries(ALL_CODES.map((c) => [c, eco(c, 100)]));

function scoredFor(o: RoProfile, rows: RoFormatCompetition[] = [], economics = allEco): ScoredFormat[] {
  return scoreFormatsForOutlet(o, economics, Object.fromEntries(rows.map((r) => [r.format_code, r])));
}

describe("Priority empty-state wording and the Sort by control", () => {
  it("says 'Not ranked - space data is missing for this outlet' when every format's feasibility is unknown", () => {
    const tiers = tierFormats(scoredFor(outlet({ vacant_sqm: null })));
    expect(allFeasibilityUnknown(tiers)).toBe(true);
    expect(priorityEmptyLabel(tiers, false)).toBe("Not ranked - space data is missing for this outlet");
    expect(priorityEmptyLabel(tiers, false)).toBe(NOT_RANKED_SPACE_MISSING);
    expect(priorityEmptyLabel(tiers, false)).not.toContain("No feasible formats scored highly enough");
  });

  it("still says it when the only formats left are in the market opportunity section", () => {
    const tiers = tierFormats(scoredFor(outlet({ vacant_sqm: null }), [competition("A1.1")]));
    expect(tiers.marketOpportunity.length).toBeGreaterThan(0);
    expect(priorityEmptyLabel(tiers, false)).toBe(NOT_RANKED_SPACE_MISSING);
  });

  it("space-missing wording wins over missing demand/whitespace", () => {
    const tiers = tierFormats(scoredFor(outlet({ vacant_sqm: null, demand_index: null })));
    expect(priorityEmptyLabel(tiers, true)).toBe(NOT_RANKED_SPACE_MISSING);
  });

  it("keeps the other two messages when space is known", () => {
    const tiers = tierFormats(scoredFor(outlet({ demand_index: null })));
    expect(priorityEmptyLabel(tiers, true)).toBe(NOT_RANKED_SCORES_MISSING);
    expect(priorityEmptyLabel(tiers, false)).toBe(NO_PRIORITY_FEASIBLE);
  });

  it("hides Sort by when nothing is rankable, shows it when any format has known feasibility", () => {
    expect(hasRankableFormats(tierFormats(scoredFor(outlet({ vacant_sqm: null }))))).toBe(false);
    expect(hasRankableFormats(tierFormats(scoredFor(outlet({ vacant_sqm: null }), [competition("A1.1")])))).toBe(
      false
    );
    expect(hasRankableFormats(tierFormats(scoredFor(outlet())))).toBe(true);
    // Known-but-not-feasible still counts: the lens can re-order the Limited fit list.
    expect(hasRankableFormats(tierFormats(scoredFor(outlet({ vacant_sqm: 1 }))))).toBe(true);
  });

  it("does not treat an outlet with no formats at all as 'all unknown'", () => {
    const tiers = tierFormats([]);
    expect(allFeasibilityUnknown(tiers)).toBe(false);
    expect(hasRankableFormats(tiers)).toBe(false);
  });
});

describe("competitionDisplay: format deep-dive text", () => {
  const find = (rows: RoFormatCompetition[], code = "A1.1", o = outlet()) =>
    scoredFor(o, rows).find((f) => f.taxonomy.code === code)!;

  it("shows counts with the expected figure, whitespace, and the source disclaimer for strong signal", () => {
    const d = competitionDisplay(find([competition("A1.1")]));
    expect(d.competitorLine).toBe("Competitors within 2 km: 34 (about 27 expected for this area)");
    expect(d.whitespaceLabel).toBe("39");
    expect(d.sourceNote).toBe(COMPETITION_SOURCE_NOTE);
    expect(d.sourceNote).toContain("Foursquare OS Places");
    expect(d.sourceNote).toContain("stale or incomplete");
  });

  it("keeps one decimal for small expected counts", () => {
    const d = competitionDisplay(find([competition("A1.1", { expected_count_2km: 3.46 })]));
    expect(d.competitorLine).toBe("Competitors within 2 km: 34 (about 3.5 expected for this area)");
  });

  it("shows a slightly negative modelled expectation as 0, never a negative count", () => {
    const d = competitionDisplay(find([competition("A1.1", { expected_count_2km: -0.4 })]));
    expect(d.competitorLine).toBe("Competitors within 2 km: 34 (about 0 expected for this area)");
  });

  it("omits the expected clause when expected_count_2km is missing", () => {
    const d = competitionDisplay(find([competition("A1.1", { expected_count_2km: null })]));
    expect(d.competitorLine).toBe("Competitors within 2 km: 34");
  });

  it.each(["thin", "none"] as const)("says no reliable data for %s signal, with no numbers", (signal_quality) => {
    const d = competitionDisplay(
      find([competition("A1.1", { signal_quality, count_2km: 7, expected_count_2km: 5, gap_score: 50 })])
    );
    expect(d.competitorLine).toBe("No reliable competitor data for this format");
    expect(d.competitorLine).toBe(NO_RELIABLE_COMPETITOR_DATA);
    expect(d.whitespaceLabel).toBe("no data");
    expect(d.sourceNote).toBe(COMPETITION_SOURCE_NOTE);
  });

  it("shows 'no data' whitespace, not a number, when border risk blocks the gap score, but still shows counts", () => {
    const d = competitionDisplay(find([competition("A1.1", { border_risk: true })]));
    expect(d.whitespaceLabel).toBe("no data");
    expect(d.competitorLine).toContain("Competitors within 2 km: 34");
    expect(d.caveat).toContain("boundary");
  });

  it("treats a format with no row (at an outlet with other rows) as no reliable data", () => {
    const d = competitionDisplay(find([competition("A1.2")], "A1.1"));
    expect(d.competitorLine).toBe(NO_RELIABLE_COMPETITOR_DATA);
    expect(d.whitespaceLabel).toBe("no data");
  });

  it("shows nothing about competitors for an outlet with no competition rows", () => {
    const d = competitionDisplay(find([]));
    expect(d).toEqual({ whitespaceLabel: null, competitorLine: null, sourceNote: null, caveat: null });
  });
});
