import { describe, expect, it, vi } from "vitest";

// csvSchemas.ts builds a Supabase client at import time; the schema/validation
// logic under test never touches it.
vi.mock("./supabase", () => ({ supabase: {} }));

import { locationDuplicateVerdict, validateImport, type CsvDbContext } from "./csvImport";
import { BRAND_PARTNERSHIPS_SCHEMA, RO_PROFILES_SCHEMA } from "./csvSchemas";

const ctx: CsvDbContext = {
  existingKeys: new Set(),
  fuzzyCandidates: [],
  formatCodes: new Set(["A1.3"]),
  omcNameToId: new Map([["indian oil corporation", 1]]),
  existingStates: [],
  existingDistricts: [],
};

function row(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "ID (slug, unique)": "iocl-test-1",
    Name: "Test Pump",
    State: "Delhi",
    District: "Delhi",
    Type: "urban",
    "Plot area (sqm)": "",
    "Vacant area (sqm)": "",
    "Demand index (0-100)": "",
    "Whitespace index (0-100)": "",
    OMC: "Indian Oil Corporation",
    ...overrides,
  };
}

function validate(overrides: Record<string, string>) {
  return validateImport(RO_PROFILES_SCHEMA, [row(overrides)], ctx).rows[0];
}

describe("ro_profiles CSV: blank plot / vacant / index cells", () => {
  it("accepts a row with blank plot, vacant, demand and whitespace, parsing them as null (not 0 or NaN)", () => {
    const r = validate({});
    expect(r.errors).toEqual([]);
    expect(r.action).toBe("insert");
    expect(r.parsed).toMatchObject({
      plot_sqm: null,
      vacant_sqm: null,
      demand_index: null,
      whitespace_index: null,
    });
  });

  it("skips the vacant <= plot check when plot is blank", () => {
    expect(validate({ "Vacant area (sqm)": "300" }).errors).toEqual([]);
  });

  it("skips the vacant <= plot check when vacant is blank", () => {
    expect(validate({ "Plot area (sqm)": "300" }).errors).toEqual([]);
  });

  it("still rejects vacant > plot when both are present", () => {
    const r = validate({ "Plot area (sqm)": "100", "Vacant area (sqm)": "200" });
    expect(r.errors).toContain("Vacant area (sqm) must be <= Plot area (sqm)");
  });

  it("accepts vacant == plot and vacant == 0 (zero is a real value, not blank)", () => {
    expect(validate({ "Plot area (sqm)": "100", "Vacant area (sqm)": "100" }).errors).toEqual([]);
    const zero = validate({ "Plot area (sqm)": "100", "Vacant area (sqm)": "0" });
    expect(zero.errors).toEqual([]);
    expect(zero.parsed?.vacant_sqm).toBe(0);
  });

  it("accepts one index blank while the other is present", () => {
    const r = validate({ "Demand index (0-100)": "80" });
    expect(r.errors).toEqual([]);
    expect(r.parsed).toMatchObject({ demand_index: 80, whitespace_index: null });
  });
});

describe("ro_profiles CSV: location-aware possible-duplicate detection", () => {
  // 0.00054 deg of latitude ~ 60 m; 0.045 deg ~ 5 km.
  const LAT = 28.6139;
  const LNG = 77.209;
  const at = (lat: number, lng: number) => ({ Latitude: String(lat), Longitude: String(lng) });

  function dbCtx(candidate: { latitude?: number | null; longitude?: number | null; pincode?: string | null }): CsvDbContext {
    return {
      ...ctx,
      fuzzyCandidates: [{ naturalKey: "existing-1", label: "Indian Oil Petrol Pump (existing-1)", value: "Indian Oil Petrol Pump", ...candidate }],
    };
  }
  function flagsAgainstDb(overrides: Record<string, string>, candidate: Parameters<typeof dbCtx>[0]) {
    return validateImport(RO_PROFILES_SCHEMA, [row({ Name: "Indian Oil Petrol Pump", ...overrides })], dbCtx(candidate)).rows[0]
      .duplicates;
  }

  it("does not flag identically named outlets 5 km apart", () => {
    const dups = flagsAgainstDb(at(LAT + 0.045, LNG), { latitude: LAT, longitude: LNG });
    expect(dups).toEqual([]);
  });

  it("flags near-identical names 60 m apart, with the distance in the reason", () => {
    const dups = flagsAgainstDb({ ...at(LAT + 0.00054, LNG), Name: "Indian Oil Petrol Pump." }, { latitude: LAT, longitude: LNG });
    expect(dups).toHaveLength(1);
    expect(dups[0].kind).toBe("against_db");
    expect(dups[0].reason).toMatch(/^similar name, (5\d|6\d) m apart$/);
    expect(dups[0].distanceM).toBeGreaterThan(50);
    expect(dups[0].distanceM).toBeLessThan(70);
  });

  it("applies the same rule within the CSV", () => {
    const rows = [
      row({ "ID (slug, unique)": "a", Name: "Indian Oil Petrol Pump", ...at(LAT, LNG) }),
      row({ "ID (slug, unique)": "b", Name: "Indian Oil Petrol Pump", ...at(LAT + 0.045, LNG) }),
      row({ "ID (slug, unique)": "c", Name: "Indian Oil Petrol Pump", ...at(LAT + 0.00054, LNG) }),
    ];
    const out = validateImport(RO_PROFILES_SCHEMA, rows, ctx).rows;
    expect(out[1].duplicates).toEqual([]);
    expect(out[2].duplicates.map((d) => d.matchedRowNumber)).toEqual([2]);
    expect(out[2].duplicates[0].reason).toMatch(/m apart$/);
  });

  it("treats exactly the radius as inside (inclusive) and just beyond it as outside", () => {
    const base = { latitude: LAT, longitude: LNG, pincode: null };
    const metresPerDegLat = (Math.PI / 180) * 6371000;
    const at200 = { latitude: LAT + 200 / metresPerDegLat, longitude: LNG, pincode: null };
    const at210 = { latitude: LAT + 210 / metresPerDegLat, longitude: LNG, pincode: null };
    expect(locationDuplicateVerdict(base, at200, 200 + 1e-6).flag).toBe(true);
    expect(locationDuplicateVerdict(base, at210, 200).flag).toBe(false);
    expect(locationDuplicateVerdict(base, base, 200).flag).toBe(true);
  });

  it("without coordinates on both sides, flags when the pincodes are equal", () => {
    const dups = flagsAgainstDb({ Pincode: "110001" }, { pincode: "110001" });
    expect(dups).toHaveLength(1);
    expect(dups[0].reason).toBe("similar name, same pincode 110001");
  });

  it("falls back to pincode when only one side has coordinates", () => {
    expect(flagsAgainstDb({ ...at(LAT, LNG), Pincode: "110001" }, { pincode: "110001" })).toHaveLength(1);
    expect(flagsAgainstDb({ ...at(LAT, LNG), Pincode: "110001" }, { pincode: "110002" })).toEqual([]);
  });

  it("does not flag when the pincodes differ", () => {
    expect(flagsAgainstDb({ Pincode: "110001" }, { pincode: "110002" })).toEqual([]);
  });

  it("flags on name alone, marked low confidence, when there is no location data to compare", () => {
    const dups = flagsAgainstDb({}, { pincode: null });
    expect(dups).toHaveLength(1);
    expect(dups[0].reason).toBe("similar name, no location data to compare (low confidence)");
    // one side has a pincode but the other has none: still no usable pair
    const oneSided = flagsAgainstDb({ Pincode: "110001" }, { pincode: null });
    expect(oneSided).toHaveLength(1);
    expect(oneSided[0].reason).toMatch(/low confidence/);
  });

  it("still requires name similarity: different names at the same spot are not flagged", () => {
    const dups = flagsAgainstDb({ ...at(LAT, LNG), Name: "Completely Different Station" }, { latitude: LAT, longitude: LNG });
    expect(dups).toEqual([]);
  });
});

describe("brand_partnerships CSV: possible-duplicate detection stays name-only", () => {
  it("flags a near-identical brand name with no reason/location logic", () => {
    const brandCtx: CsvDbContext = {
      existingKeys: new Set(),
      fuzzyCandidates: [{ naturalKey: "Chai Point||A1.6", label: "Chai Point (A1.6)", value: "Chai Point" }],
      formatCodes: new Set(["A1.6"]),
    };
    const out = validateImport(
      BRAND_PARTNERSHIPS_SCHEMA,
      [{ "Brand name": "Chai Pointt", "Format code": "A1.7" }],
      { ...brandCtx, formatCodes: new Set(["A1.7"]) }
    ).rows[0];
    expect(out.errors).toEqual([]);
    expect(out.duplicates).toHaveLength(1);
    expect(out.duplicates[0].reason).toBeUndefined();
    expect(out.duplicates[0].distanceM).toBeUndefined();
  });
});
