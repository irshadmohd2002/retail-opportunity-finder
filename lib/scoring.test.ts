import { describe, expect, it } from "vitest";
import {
  scoreFormatsForOutlet,
  tierFormats,
  sortByLens,
  sortTiersByLens,
  getBrandShortlist,
  weightedScore,
  scoreInputsMissing,
  NEUTRAL_WHITESPACE,
  SQM_TO_SQFT,
  type ScoredFormat,
} from "./scoring";
import { TAXONOMY } from "./taxonomy";
import type { RoProfile, FormatEconomics, BrandPartnership, RoFormatCompetition } from "./types";

function stubScored(economics: FormatEconomics): ScoredFormat {
  return {
    taxonomy: TAXONOMY[0],
    economics,
    whitespace: { value: null, source: "outlet_index" },
    competition: null,
    marketScore: null,
    vacantSqft: 0,
    ratio: null,
    status: "not_feasible",
    shortfallSqft: null,
    score: null,
  };
}

function makeOutlet(overrides: Partial<RoProfile> = {}): RoProfile {
  return {
    id: "test",
    name: "Test Outlet",
    state: "Rajasthan",
    district: "Test",
    area: "Test",
    location: "Test",
    type: "highway",
    ownership: null,
    plot_sqm: 1000,
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

function makeEconomics(code: string, overrides: Partial<FormatEconomics> = {}): FormatEconomics {
  return {
    code,
    name: code,
    space_sqft: 500,
    space_sourced: true,
    space_source_note: null,
    capex_min_inr: 1000000,
    capex_max_inr: 2000000,
    capex_sourced: true,
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
    ...overrides,
  };
}

const economicsByCode: Record<string, FormatEconomics> = {
  "A1.3": makeEconomics("A1.3", { space_sqft: 300 }),
};

describe("Stage 0: RO-type pre-filter", () => {
  it("excludes formats not eligible for the outlet type", () => {
    // A7.1 (Truck & Trailer Parking) is highway/rural only, never urban.
    const urban = makeOutlet({ type: "urban", vacant_sqm: 1000 });
    const scored = scoreFormatsForOutlet(urban, {});
    expect(scored.find((f) => f.taxonomy.code === "A7.1")).toBeUndefined();
  });

  it("includes formats eligible for the outlet type", () => {
    const highway = makeOutlet({ type: "highway" });
    const scored = scoreFormatsForOutlet(highway, {});
    expect(scored.find((f) => f.taxonomy.code === "A7.1")).toBeDefined();
  });
});

describe("Stage 1: feasibility gate", () => {
  it("marks feasible when vacant space fully covers the threshold", () => {
    const outlet = makeOutlet({ vacant_sqm: 100 }); // 100 * 10.7639 = 1076 sqft
    const scored = scoreFormatsForOutlet(outlet, {
      "A1.3": makeEconomics("A1.3", { space_sqft: 500 }),
    });
    const fmt = scored.find((f) => f.taxonomy.code === "A1.3")!;
    expect(fmt.status).toBe("feasible");
    expect(fmt.shortfallSqft).toBeNull();
  });

  it("marks marginal between 0.7 and 1.0 ratio and reports a numeric shortfall", () => {
    // vacant = 50 sqm = 538.195 sqft; threshold 650 -> ratio 0.828
    const outlet = makeOutlet({ vacant_sqm: 50 });
    const scored = scoreFormatsForOutlet(outlet, {
      "A1.3": makeEconomics("A1.3", { space_sqft: 650 }),
    });
    const fmt = scored.find((f) => f.taxonomy.code === "A1.3")!;
    expect(fmt.status).toBe("marginal");
    expect(fmt.shortfallSqft).not.toBeNull();
    expect(fmt.shortfallSqft).toBeGreaterThan(0);
  });

  it("marks not_feasible below 0.7 ratio", () => {
    const outlet = makeOutlet({ vacant_sqm: 10 });
    const scored = scoreFormatsForOutlet(outlet, {
      "A1.3": makeEconomics("A1.3", { space_sqft: 650 }),
    });
    const fmt = scored.find((f) => f.taxonomy.code === "A1.3")!;
    expect(fmt.status).toBe("not_feasible");
  });

  it("converts sqm to sqft using the documented constant", () => {
    expect(SQM_TO_SQFT).toBeCloseTo(10.7639, 4);
  });

  it("marks every format unknown -- not feasible, not zero -- when vacant_sqm is null", () => {
    const outlet = makeOutlet({ vacant_sqm: null, plot_sqm: null });
    const scored = scoreFormatsForOutlet(outlet, {
      "A1.3": makeEconomics("A1.3", { space_sqft: 500 }),
    });
    expect(scored.length).toBeGreaterThan(0);
    for (const f of scored) {
      expect(f.vacantSqft).toBeNull();
      expect(f.ratio).toBeNull();
      expect(f.status).toBe("unknown");
      expect(f.shortfallSqft).toBeNull();
      expect(f.score).toBeNull();
    }
  });

  it("treats vacant_sqm of 0 as a real zero (not_feasible), distinct from null", () => {
    const outlet = makeOutlet({ vacant_sqm: 0 });
    const scored = scoreFormatsForOutlet(outlet, {
      "A1.3": makeEconomics("A1.3", { space_sqft: 500 }),
    });
    expect(scored.find((f) => f.taxonomy.code === "A1.3")!.status).toBe("not_feasible");
  });

  it("marks a format unknown when its own space_sqft is missing", () => {
    const outlet = makeOutlet({ vacant_sqm: 100 });
    const scored = scoreFormatsForOutlet(outlet, {
      "A1.3": makeEconomics("A1.3", { space_sqft: null }),
    });
    expect(scored.find((f) => f.taxonomy.code === "A1.3")!.status).toBe("unknown");
  });

  it("never yields NaN or Infinity for any numeric output when inputs are null", () => {
    const outlet = makeOutlet({ vacant_sqm: null, plot_sqm: null, demand_index: null, whitespace_index: null });
    for (const f of scoreFormatsForOutlet(outlet, economicsByCode)) {
      for (const n of [f.vacantSqft, f.ratio, f.shortfallSqft, f.score]) {
        expect(n === null || Number.isFinite(n)).toBe(true);
      }
    }
  });
});

describe("Stage 2: cannibalization exclusion", () => {
  it("excludes a format already present in existing_tenants, format-level only", () => {
    const outlet = makeOutlet({ existing_tenants: ["A1.3"] });
    const scored = scoreFormatsForOutlet(outlet, economicsByCode);
    expect(scored.find((f) => f.taxonomy.code === "A1.3")).toBeUndefined();
    // A sibling format in the same theme (A1.1) must not be excluded.
    expect(scored.find((f) => f.taxonomy.code === "A1.1")).toBeDefined();
  });
});

describe("Stage 3: scoring", () => {
  it("never silently treats a missing demand/whitespace index as zero", () => {
    const outlet = makeOutlet({ demand_index: null, whitespace_index: 50 });
    const scored = scoreFormatsForOutlet(outlet, economicsByCode);
    const fmt = scored.find((f) => f.taxonomy.code === "A1.3")!;
    expect(fmt.score).toBeNull();
  });

  it("computes a 0-100 composite score when all inputs are present", () => {
    const outlet = makeOutlet({ demand_index: 100, whitespace_index: 100, vacant_sqm: 1000 });
    const scored = scoreFormatsForOutlet(outlet, economicsByCode);
    const fmt = scored.find((f) => f.taxonomy.code === "A1.3")!;
    expect(fmt.score).toBeCloseTo(100, 0);
  });
});

describe("Stage 4: tiering", () => {
  it("caps Priority Recommendations at 4 with max 2 per theme", () => {
    const outlet = makeOutlet({ vacant_sqm: 1000, demand_index: 90, whitespace_index: 90 });
    const allFb = Object.fromEntries(
      ["A1.1", "A1.3", "A1.4", "A1.5", "A1.6"].map((c) => [c, makeEconomics(c, { space_sqft: 300 })])
    );
    const scored = scoreFormatsForOutlet(outlet, allFb);
    const tiers = tierFormats(scored);
    expect(tiers.priority.length).toBeLessThanOrEqual(4);
    const fbInPriority = tiers.priority.filter((f) => f.taxonomy.theme === "Food & Beverage");
    expect(fbInPriority.length).toBeLessThanOrEqual(2);
  });

  it("never hides a format outright -- every eligible, non-excluded format lands in some tier", () => {
    const outlet = makeOutlet({ vacant_sqm: 1000, demand_index: 50, whitespace_index: 50 });
    const scored = scoreFormatsForOutlet(outlet, economicsByCode);
    const tiers = tierFormats(scored);
    const totalTiered =
      tiers.priority.length +
      tiers.alsoFeasible.length +
      tiers.worthExploring.length +
      tiers.limitedFit.length +
      tiers.marketOpportunity.length +
      tiers.unknownFit.length;
    expect(totalTiered).toBe(scored.length);
  });

  it("puts every format in unknownFit -- none in feasible or not-feasible tiers -- when vacant_sqm is null", () => {
    const outlet = makeOutlet({ vacant_sqm: null });
    const allEco = Object.fromEntries(TAXONOMY.map((t) => [t.code, makeEconomics(t.code, { space_sqft: 100 })]));
    const scored = scoreFormatsForOutlet(outlet, allEco);
    const tiers = tierFormats(scored);
    expect(tiers.unknownFit).toHaveLength(scored.length);
    expect(tiers.priority).toHaveLength(0);
    expect(tiers.alsoFeasible).toHaveLength(0);
    expect(tiers.worthExploring).toHaveLength(0);
    expect(tiers.limitedFit).toHaveLength(0);
  });

  it("does not put unscored feasible formats in Priority when demand/whitespace is missing", () => {
    const outlet = makeOutlet({ vacant_sqm: 1000, demand_index: null, whitespace_index: null });
    const allEco = Object.fromEntries(TAXONOMY.map((t) => [t.code, makeEconomics(t.code, { space_sqft: 100 })]));
    const tiers = tierFormats(scoreFormatsForOutlet(outlet, allEco));
    expect(tiers.priority).toHaveLength(0);
    expect(tiers.alsoFeasible.length).toBeGreaterThan(0);
    expect(tiers.alsoFeasible.every((f) => f.status === "feasible" && f.score === null)).toBe(true);
  });
});

describe("Stage 5: priority lens re-sort", () => {
  it("sorts by lowest investment first without changing tier membership", () => {
    const formats = [
      stubScored(makeEconomics("a", { capex_min_inr: 500000 })),
      stubScored(makeEconomics("b", { capex_min_inr: 100000 })),
    ];
    const sorted = sortByLens(formats, "lowest_investment");
    expect(sorted[0].economics!.code).toBe("b");
  });

  it("sorts by fastest to launch first using speed_to_launch_tier ascending", () => {
    const formats = [
      stubScored(makeEconomics("a", { speed_to_launch_tier: 3 })),
      stubScored(makeEconomics("b", { speed_to_launch_tier: 1 })),
    ];
    const sorted = sortByLens(formats, "fastest_to_launch");
    expect(sorted[0].economics!.code).toBe("b");
  });
});

describe("Stage 6: brand shortlist", () => {
  function makeBrand(overrides: Partial<BrandPartnership>): BrandPartnership {
    return {
      id: 1,
      brand_name: "Test Brand",
      format_code: "A1.1",
      operating_model: null,
      brand_provides: [],
      partner_provides: [],
      space_min_sqft: null,
      space_max_sqft: null,
      space_sourced: false,
      franchise_fee_inr: null,
      royalty_pct: null,
      marketing_fee_pct: null,
      fees_sourced: false,
      regulatory_requirements: [],
      other_requirements: [],
      source_url: null,
      sourced: false,
      last_verified: null,
      created_at: "2026-01-01",
      ...overrides,
    };
  }

  it("never pads to a fixed count -- returns only known brands", () => {
    const brands = [makeBrand({ id: 1 })];
    expect(getBrandShortlist("A1.1", brands)).toHaveLength(1);
  });

  it("caps at 3 brands per format", () => {
    const brands = [1, 2, 3, 4].map((id) => makeBrand({ id }));
    expect(getBrandShortlist("A1.1", brands)).toHaveLength(3);
  });

  it("returns an empty array when no brands exist for the format", () => {
    expect(getBrandShortlist("A9.9", [])).toHaveLength(0);
  });
});

function makeCompetition(code: string, overrides: Partial<RoFormatCompetition> = {}): RoFormatCompetition {
  return {
    ro_id: "test",
    format_code: code,
    count_1km: 5,
    count_2km: 12,
    expected_count_2km: 10,
    gap_score: 60,
    naive_whitespace_score: 40,
    signal_quality: "strong",
    border_risk: false,
    ...overrides,
  };
}

function competitionMap(...rows: RoFormatCompetition[]): Record<string, RoFormatCompetition> {
  return Object.fromEntries(rows.map((r) => [r.format_code, r]));
}

function ecoFor(codes: string[], space_sqft: number | null = 100): Record<string, FormatEconomics> {
  return Object.fromEntries(codes.map((c) => [c, makeEconomics(c, { space_sqft })]));
}

describe("weightedScore: the single home of the weights", () => {
  it("uses 0.45 / 0.35 / 0.20 when feasibility is present", () => {
    expect(weightedScore({ demand: 100, whitespace: 0, feasibility: 0 })).toBeCloseTo(45, 10);
    expect(weightedScore({ demand: 0, whitespace: 100, feasibility: 0 })).toBeCloseTo(35, 10);
    expect(weightedScore({ demand: 0, whitespace: 0, feasibility: 100 })).toBeCloseTo(20, 10);
  });

  it("re-weights demand/whitespace to 0.45/0.80 and 0.35/0.80 (sum 1) without feasibility", () => {
    expect(weightedScore({ demand: 100, whitespace: 0, feasibility: null })).toBeCloseTo(56.25, 10);
    expect(weightedScore({ demand: 0, whitespace: 100, feasibility: null })).toBeCloseTo(43.75, 10);
    expect(weightedScore({ demand: 100, whitespace: 100, feasibility: null })).toBeCloseTo(100, 10);
  });
});

describe("no competition rows: legacy whitespace_index behaviour is unchanged", () => {
  // Reference copy of the pre-competition formula. Do not "simplify" this to call weightedScore.
  function legacyScore(demand: number, whitespace: number, vacantSqm: number, spaceSqft: number) {
    const ratio = (vacantSqm * SQM_TO_SQFT) / spaceSqft;
    return 0.45 * demand + 0.35 * whitespace + 0.2 * Math.min(ratio * 100, 100);
  }

  // A COCO Jalampura-style outlet: known space, demand and whitespace index.
  const outlet = makeOutlet({ type: "highway", vacant_sqm: 45, demand_index: 72, whitespace_index: 64 });
  const eco = Object.fromEntries(
    TAXONOMY.map((t, i) => [t.code, makeEconomics(t.code, { space_sqft: 60 + ((i * 37) % 900) })])
  );

  it("produces exactly the legacy scores, with the competition argument omitted or empty", () => {
    for (const scored of [scoreFormatsForOutlet(outlet, eco), scoreFormatsForOutlet(outlet, eco, {})]) {
      expect(scored.length).toBeGreaterThan(5);
      for (const f of scored) {
        expect(f.score).toBe(legacyScore(72, 64, 45, eco[f.taxonomy.code].space_sqft!));
        expect(f.whitespace).toEqual({ value: 64, source: "outlet_index" });
        expect(f.marketScore).toBeNull();
      }
    }
  });

  it("ranks identically to the legacy formula", () => {
    const legacyOrder = scoreFormatsForOutlet(outlet, eco)
      .map((f) => ({ code: f.taxonomy.code, s: legacyScore(72, 64, 45, eco[f.taxonomy.code].space_sqft!) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.code);
    const newOrder = [...scoreFormatsForOutlet(outlet, eco, {})]
      .sort((a, b) => b.score! - a.score!)
      .map((f) => f.taxonomy.code);
    expect(newOrder).toEqual(legacyOrder);
  });

  it("leaves a missing whitespace_index as an unscored (null) format, not a neutral score", () => {
    const noIndex = makeOutlet({ vacant_sqm: 45, demand_index: 72, whitespace_index: null });
    for (const f of scoreFormatsForOutlet(noIndex, eco, {})) expect(f.score).toBeNull();
    expect(scoreInputsMissing(noIndex, false)).toBe(true);
  });
});

describe("outlets with competition rows: per-format whitespace", () => {
  const outlet = makeOutlet({ vacant_sqm: 1000, demand_index: 60, whitespace_index: 99 });
  const codes = ["A1.1", "A1.2", "A1.3", "A1.4", "A1.5"];
  const eco = ecoFor(codes);
  // demand 60, feasibility 100 (space is ample): score = 27 + 0.35 * whitespace + 20.
  const scoreWith = (whitespace: number) => 0.45 * 60 + 0.35 * whitespace + 0.2 * 100;
  const find = (rows: Record<string, RoFormatCompetition>, code: string) =>
    scoreFormatsForOutlet(outlet, eco, rows).find((f) => f.taxonomy.code === code)!;

  it("uses gap_score for strong and for borderline signals (ignoring whitespace_index)", () => {
    const rows = competitionMap(
      makeCompetition("A1.1", { signal_quality: "strong", gap_score: 80 }),
      makeCompetition("A1.2", { signal_quality: "borderline", gap_score: 30 })
    );
    expect(find(rows, "A1.1").whitespace).toEqual({ value: 80, source: "gap_score" });
    expect(find(rows, "A1.1").score).toBeCloseTo(scoreWith(80), 10);
    expect(find(rows, "A1.2").whitespace).toEqual({ value: 30, source: "gap_score" });
    expect(find(rows, "A1.2").score).toBeCloseTo(scoreWith(30), 10);
  });

  it.each([
    ["thin signal", { signal_quality: "thin" as const, gap_score: 95 }],
    ["none signal", { signal_quality: "none" as const, gap_score: null }],
    ["border risk", { signal_quality: "strong" as const, gap_score: 95, border_risk: true }],
    ["unknown border risk", { signal_quality: "strong" as const, gap_score: 95, border_risk: null }],
    ["missing gap score", { signal_quality: "strong" as const, gap_score: null }],
  ])("shows no data and scores at the neutral value for %s -- never 0 or high", (_label, overrides) => {
    const f = find(competitionMap(makeCompetition("A1.1", overrides), makeCompetition("A1.2")), "A1.1");
    expect(f.whitespace).toEqual({ value: null, source: "no_data" });
    expect(f.score).toBeCloseTo(scoreWith(NEUTRAL_WHITESPACE), 10);
    expect(f.score).not.toBeCloseTo(scoreWith(0), 5);
    expect(f.score).not.toBeCloseTo(scoreWith(95), 5);
  });

  it("treats a format with no row, at an outlet that has other rows, as no data (not the outlet index)", () => {
    const f = find(competitionMap(makeCompetition("A1.1")), "A1.3");
    expect(f.competition).toBeNull();
    expect(f.whitespace).toEqual({ value: null, source: "no_data" });
    expect(f.score).toBeCloseTo(scoreWith(NEUTRAL_WHITESPACE), 10);
  });

  it("keeps a real gap_score of 0 as 0 (a genuine low), distinct from no data", () => {
    const f = find(competitionMap(makeCompetition("A1.1", { gap_score: 0 })), "A1.1");
    expect(f.whitespace).toEqual({ value: 0, source: "gap_score" });
    expect(f.score).toBeCloseTo(scoreWith(0), 10);
  });

  it("scores when whitespace_index is null but competition rows exist", () => {
    const noIndex = makeOutlet({ vacant_sqm: 1000, demand_index: 60, whitespace_index: null });
    const f = scoreFormatsForOutlet(noIndex, eco, competitionMap(makeCompetition("A1.1"))).find(
      (x) => x.taxonomy.code === "A1.1"
    )!;
    expect(f.score).not.toBeNull();
    expect(scoreInputsMissing(noIndex, true)).toBe(false);
  });
});

describe("market opportunity (feasibility unknown)", () => {
  const unknownSpace = makeOutlet({ vacant_sqm: null, demand_index: 80, whitespace_index: null });
  const eco = ecoFor(["A1.1", "A1.2", "A1.3", "A1.4", "A1.5"]);
  const tiersFor = (outlet: RoProfile, rows: Record<string, RoFormatCompetition>, economics = eco) =>
    tierFormats(scoreFormatsForOutlet(outlet, economics, rows));

  it("ranks reliable formats by demand+whitespace only, re-weighted to sum to 1", () => {
    const tiers = tiersFor(
      unknownSpace,
      competitionMap(
        makeCompetition("A1.2", { signal_quality: "borderline", gap_score: 40 }),
        makeCompetition("A1.1", { signal_quality: "strong", gap_score: 60 })
      )
    );
    expect(tiers.marketOpportunity.map((f) => f.taxonomy.code)).toEqual(["A1.1", "A1.2"]);
    expect(tiers.marketOpportunity[0].marketScore).toBeCloseTo((0.45 * 80 + 0.35 * 60) / 0.8, 10);
    expect(tiers.marketOpportunity[1].marketScore).toBeCloseTo((0.45 * 80 + 0.35 * 40) / 0.8, 10);
    // Space is unknown, so the normal score stays null and nothing is Priority.
    expect(tiers.marketOpportunity.every((f) => f.status === "unknown" && f.score === null)).toBe(true);
    expect(tiers.priority).toHaveLength(0);
  });

  it("leaves unreliable formats in the plain unknown list, and never lists a format twice", () => {
    const rows = competitionMap(
      makeCompetition("A1.1"),
      makeCompetition("A1.2", { signal_quality: "thin", gap_score: 90 }),
      makeCompetition("A1.3", { border_risk: true }),
      makeCompetition("A1.4", { gap_score: null })
    );
    const tiers = tiersFor(unknownSpace, rows);
    expect(tiers.marketOpportunity.map((f) => f.taxonomy.code)).toEqual(["A1.1"]);
    const unknownCodes = tiers.unknownFit.map((f) => f.taxonomy.code);
    expect(unknownCodes).not.toContain("A1.1");
    for (const code of ["A1.2", "A1.3", "A1.4", "A1.5"]) expect(unknownCodes).toContain(code);
  });

  it("needs demand: no market score when demand_index is missing", () => {
    const noDemand = makeOutlet({ vacant_sqm: null, demand_index: null });
    const tiers = tiersFor(noDemand, competitionMap(makeCompetition("A1.1")));
    expect(tiers.marketOpportunity).toHaveLength(0);
  });

  it("does not use the legacy whitespace_index: outlets without competition rows have no market section", () => {
    const legacy = makeOutlet({ vacant_sqm: null, demand_index: 80, whitespace_index: 90 });
    expect(tiersFor(legacy, {}).marketOpportunity).toHaveLength(0);
  });

  it("never shows a format with known feasibility, however reliable its gap score", () => {
    // Feasible, marginal, not feasible, and one unknown (no space_sqft) at the same outlet.
    const outlet = makeOutlet({ vacant_sqm: 50, demand_index: 90, whitespace_index: null }); // ~538 sqft
    const mixedEco: Record<string, FormatEconomics> = {
      "A1.1": makeEconomics("A1.1", { space_sqft: 100 }), // feasible
      "A1.2": makeEconomics("A1.2", { space_sqft: 650 }), // marginal
      "A1.3": makeEconomics("A1.3", { space_sqft: 5000 }), // not feasible
      "A1.4": makeEconomics("A1.4", { space_sqft: null }), // unknown
    };
    const rows = competitionMap(
      ...["A1.1", "A1.2", "A1.3", "A1.4", "A1.5"].map((c) => makeCompetition(c, { gap_score: 95 }))
    );
    const scored = scoreFormatsForOutlet(outlet, mixedEco, rows);
    const byCode = (c: string) => scored.find((f) => f.taxonomy.code === c)!;
    expect(byCode("A1.1").status).toBe("feasible");
    expect(byCode("A1.2").status).toBe("marginal");
    expect(byCode("A1.3").status).toBe("not_feasible");
    for (const c of ["A1.1", "A1.2", "A1.3"]) expect(byCode(c).marketScore).toBeNull();

    const tiers = tierFormats(scored);
    const marketCodes = tiers.marketOpportunity.map((f) => f.taxonomy.code);
    expect(marketCodes).not.toContain("A1.1");
    expect(marketCodes).not.toContain("A1.2");
    expect(marketCodes).not.toContain("A1.3");
    expect(marketCodes).toEqual(expect.arrayContaining(["A1.4", "A1.5"]));
    expect(tiers.marketOpportunity.every((f) => f.status === "unknown")).toBe(true);
    // ...and nothing from the market section leaked into the ranked tiers.
    const ranked = [...tiers.priority, ...tiers.alsoFeasible, ...tiers.worthExploring, ...tiers.limitedFit];
    expect(ranked.some((f) => marketCodes.includes(f.taxonomy.code))).toBe(false);
  });

  it("is not re-ordered by the Sort by lens", () => {
    const tiers = tiersFor(
      unknownSpace,
      competitionMap(makeCompetition("A1.1", { gap_score: 20 }), makeCompetition("A1.2", { gap_score: 90 }))
    );
    const before = tiers.marketOpportunity.map((f) => f.taxonomy.code);
    for (const lens of ["lowest_investment", "highest_margin", "fastest_to_launch", "best_overall"] as const) {
      expect(sortTiersByLens(tiers, lens).marketOpportunity.map((f) => f.taxonomy.code)).toEqual(before);
    }
    expect(before).toEqual(["A1.2", "A1.1"]);
  });
});
