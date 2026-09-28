import { describe, expect, it } from "vitest";
import {
  scoreFormatsForOutlet,
  tierFormats,
  sortByLens,
  getBrandShortlist,
  SQM_TO_SQFT,
  type ScoredFormat,
} from "./scoring";
import { TAXONOMY } from "./taxonomy";
import type { RoProfile, FormatEconomics, BrandPartnership } from "./types";

function stubScored(economics: FormatEconomics): ScoredFormat {
  return {
    taxonomy: TAXONOMY[0],
    economics,
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
