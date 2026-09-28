import { describe, expect, it, vi } from "vitest";

// csvSchemas.ts builds a Supabase client at import time; the schema/validation
// logic under test never touches it.
vi.mock("./supabase", () => ({ supabase: {} }));

import {
  buildImportPayload,
  chunk,
  countUnchangedBlankCells,
  groupByKeySet,
  locationDuplicateVerdict,
  recheckUpdateRows,
  validateImport,
  type CsvDbContext,
} from "./csvImport";
import {
  BRAND_PARTNERSHIPS_SCHEMA,
  FORMAT_ECONOMICS_SCHEMA,
  RO_FORMAT_COMPETITION_SCHEMA,
  RO_PROFILES_SCHEMA,
} from "./csvSchemas";

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

describe("ro_profiles CSV: existing tenants (null = unknown, [] = confirmed none)", () => {
  const HEADER = "Existing tenant format codes";
  const codesCtx = { ...ctx, formatCodes: new Set(["A1.3", "A3.3", "A3.4"]) };
  const validateWithCodes = (overrides: Record<string, string>) =>
    validateImport(RO_PROFILES_SCHEMA, [row(overrides)], codesCtx).rows[0];

  it("parses a blank cell, a missing column and 'unknown' (any case) as null, not []", () => {
    expect(validate({}).parsed?.existing_tenants).toBeNull();
    expect(validate({ [HEADER]: "" }).parsed?.existing_tenants).toBeNull();
    expect(validate({ [HEADER]: "unknown" }).parsed?.existing_tenants).toBeNull();
    expect(validate({ [HEADER]: " Unknown " }).parsed?.existing_tenants).toBeNull();
  });

  it("parses 'none' (any case) as an empty array", () => {
    for (const cell of ["none", "None", "NONE"]) {
      const r = validate({ [HEADER]: cell });
      expect(r.errors).toEqual([]);
      expect(r.parsed?.existing_tenants).toEqual([]);
    }
  });

  it("still parses and validates format codes", () => {
    expect(validateWithCodes({ [HEADER]: "A1.3" }).parsed?.existing_tenants).toEqual(["A1.3"]);
    expect(validateWithCodes({ [HEADER]: "A3.3, A3.4" }).parsed?.existing_tenants).toEqual(["A3.3", "A3.4"]);
    expect(validateWithCodes({ [HEADER]: "Z9.9" }).errors.join(" ")).toContain("does not exist in format_economics");
  });

  it("does not treat 'none' mixed with codes as the keyword", () => {
    expect(validateWithCodes({ [HEADER]: "none, A1.3" }).errors.join(" ")).toContain('"none" does not exist');
  });

  it("on update: a blank cell leaves the tenants alone, 'unknown' writes null, 'none' writes [], codes write codes", () => {
    const updateCtx = { ...codesCtx, existingKeys: new Set(["iocl-test-1"]) };
    const payloadFor = (cell: string) => {
      const r = validateImport(RO_PROFILES_SCHEMA, [row({ [HEADER]: cell })], updateCtx).rows[0];
      expect(r.action).toBe("update");
      return buildImportPayload(RO_PROFILES_SCHEMA, r.parsed!, r.resolution, r.blankColumns);
    };
    expect(payloadFor("")).not.toHaveProperty("existing_tenants");
    expect(payloadFor("unknown")).toHaveProperty("existing_tenants", null);
    expect(payloadFor("none").existing_tenants).toEqual([]);
    expect(payloadFor("A1.3").existing_tenants).toEqual(["A1.3"]);
  });
});

describe("blank cells on CSV update keep stored values (ro_profiles)", () => {
  const updateCtx: CsvDbContext = {
    ...ctx,
    existingKeys: new Set(["iocl-test-1"]),
    existingValues: new Map([["iocl-test-1", { plot_sqm: 300, vacant_sqm: 100 }]]),
  };
  const validateUpdate = (overrides: Record<string, string>, c: CsvDbContext = updateCtx) =>
    validateImport(RO_PROFILES_SCHEMA, [row(overrides)], c).rows[0];
  const payloadOf = (r: ReturnType<typeof validateUpdate>) =>
    buildImportPayload(RO_PROFILES_SCHEMA, r.parsed!, r.resolution, r.blankColumns);

  const BLANKED = ["plot_sqm", "vacant_sqm", "demand_index", "whitespace_index", "existing_tenants", "sourced"];

  it("an update with blank plot / vacant / demand / whitespace leaves those columns out of the payload", () => {
    const r = validateUpdate({});
    expect(r.action).toBe("update");
    const payload = payloadOf(r);
    for (const key of BLANKED) expect(payload).not.toHaveProperty(key);
    expect(payload).toMatchObject({ id: "iocl-test-1", name: "Test Pump", type: "urban", omc_id: 1 });
    expect(payload).not.toHaveProperty("omc");
  });

  it("an update still writes the columns the CSV does supply", () => {
    const payload = payloadOf(validateUpdate({ "Demand index (0-100)": "80", "Plot area (sqm)": "500" }));
    expect(payload).toMatchObject({ demand_index: 80, plot_sqm: 500 });
    expect(payload).not.toHaveProperty("vacant_sqm");
    expect(payload).not.toHaveProperty("whitespace_index");
  });

  it("an insert with the same blanks keeps them: null, and false for the blank boolean", () => {
    const r = validate({});
    expect(r.action).toBe("insert");
    const payload = payloadOf(r);
    expect(payload).toMatchObject({
      plot_sqm: null,
      vacant_sqm: null,
      demand_index: null,
      whitespace_index: null,
      existing_tenants: null,
      sourced: false,
    });
  });

  it("a blank boolean is left out on update, so a verified flag is not reset to false", () => {
    expect(payloadOf(validateUpdate({}))).not.toHaveProperty("sourced");
    expect(payloadOf(validateUpdate({ "Sourced/verified": "false" }))).toHaveProperty("sourced", false);
  });

  it("never puts payloads with different key sets in the same bulk request", () => {
    const rows = validateImport(
      RO_PROFILES_SCHEMA,
      [
        row({ "ID (slug, unique)": "iocl-test-1" }), // update, blanks omitted
        row({ "ID (slug, unique)": "iocl-test-1b", Name: "Other Pump" }), // insert, blanks kept as null
        row({ "ID (slug, unique)": "iocl-test-1c", Name: "Third Pump" }), // insert
      ],
      updateCtx
    ).rows;
    const items = rows.map((r) => buildImportPayload(RO_PROFILES_SCHEMA, r.parsed!, r.resolution, r.blankColumns));
    const groups = groupByKeySet(items, (p) => p);
    expect(groups.flat()).toHaveLength(3);
    expect(groups).toHaveLength(2);
    for (const g of groups) {
      expect(new Set(g.map((p) => Object.keys(p).sort().join(","))).size).toBe(1);
    }
  });

  describe("vacant <= plot is checked on the values that will be stored", () => {
    it("a CSV supplying only vacant is validated against the stored plot", () => {
      const tooBig = validateUpdate({ "Vacant area (sqm)": "500" });
      expect(tooBig.errors).toHaveLength(1);
      expect(tooBig.errors[0]).toContain("Vacant area (sqm) must be <= Plot area (sqm)");
      expect(tooBig.errors[0]).toContain("using stored Plot area (sqm) = 300");
      expect(tooBig.parsed).toBeNull();

      expect(validateUpdate({ "Vacant area (sqm)": "300" }).errors).toEqual([]);
      expect(validateUpdate({ "Vacant area (sqm)": "200" }).errors).toEqual([]);
    });

    it("a CSV supplying only plot is validated against the stored vacant", () => {
      expect(validateUpdate({ "Plot area (sqm)": "50" }).errors[0]).toContain("using stored Vacant area (sqm) = 100");
      expect(validateUpdate({ "Plot area (sqm)": "150" }).errors).toEqual([]);
    });

    it("CSV values override stored ones, and a stored null is not a constraint", () => {
      expect(validateUpdate({ "Plot area (sqm)": "1000", "Vacant area (sqm)": "900" }).errors).toEqual([]);
      const nullPlot: CsvDbContext = {
        ...updateCtx,
        existingValues: new Map([["iocl-test-1", { plot_sqm: null, vacant_sqm: null }]]),
      };
      expect(validateUpdate({ "Vacant area (sqm)": "5000" }, nullPlot).errors).toEqual([]);
    });

    it("an insert is checked on the CSV alone (no stored row to merge)", () => {
      expect(validate({ "Vacant area (sqm)": "500" }).errors).toEqual([]);
    });

    it("re-checks a row redirected to a different existing record against that record's stored values", () => {
      const redirectCtx: CsvDbContext = {
        ...ctx,
        existingKeys: new Set(["other"]),
        existingValues: new Map([["other", { plot_sqm: 100, vacant_sqm: 50 }]]),
      };
      const r = validateImport(RO_PROFILES_SCHEMA, [row({ "Vacant area (sqm)": "500" })], redirectCtx).rows[0];
      expect(r.errors).toEqual([]); // an insert as far as its own key goes
      r.resolution = { type: "update", naturalKey: "other" };
      const failures = recheckUpdateRows(RO_PROFILES_SCHEMA, [r], redirectCtx);
      expect(failures).toHaveLength(1);
      expect(failures[0].rowNumber).toBe(r.rowNumber);
      expect(failures[0].errors[0]).toContain("using stored Plot area (sqm) = 100");

      const roomy: CsvDbContext = { ...redirectCtx, existingValues: new Map([["other", { plot_sqm: 1000, vacant_sqm: 50 }]]) };
      expect(recheckUpdateRows(RO_PROFILES_SCHEMA, [r], roomy)).toEqual([]);
      // Untouched rows (insert / skip) are never re-checked.
      r.resolution = { type: "insert" };
      expect(recheckUpdateRows(RO_PROFILES_SCHEMA, [r], redirectCtx)).toEqual([]);
    });
  });

  it("counts blank or missing cells on rows that will be updated, and follows redirects", () => {
    const rows = validateImport(
      RO_PROFILES_SCHEMA,
      [row({}), row({ "ID (slug, unique)": "new-1", Name: "Brand New Pump" })],
      updateCtx
    ).rows;
    const [update, insert] = rows;
    expect(update.action).toBe("update");
    expect(countUnchangedBlankCells(RO_PROFILES_SCHEMA, rows)).toBe(update.blankColumns.length);
    expect(update.blankColumns).toEqual(expect.arrayContaining(BLANKED));
    insert.resolution = { type: "update", naturalKey: "iocl-test-1" };
    expect(countUnchangedBlankCells(RO_PROFILES_SCHEMA, rows)).toBe(update.blankColumns.length + insert.blankColumns.length);
    update.resolution = { type: "skip" };
    expect(countUnchangedBlankCells(RO_PROFILES_SCHEMA, rows)).toBe(insert.blankColumns.length);
  });
});

describe("blank cells on CSV update: format_economics and brand_partnerships", () => {
  it("format_economics: blank cells are left out on update, kept as null on insert, capex checked against stored", () => {
    const feRow = (overrides: Record<string, string> = {}) => ({ Code: "A1.3", Name: "Cafe", ...overrides });
    const feCtx: CsvDbContext = {
      existingKeys: new Set(["A1.3"]),
      existingValues: new Map([["A1.3", { capex_min_inr: 1000, capex_max_inr: 5000 }]]),
      fuzzyCandidates: [],
      taxonomyCodes: new Set(["A1.3", "A1.4"]),
    };
    const upd = validateImport(FORMAT_ECONOMICS_SCHEMA, [feRow({ "Space (sqft)": "300" })], feCtx).rows[0];
    const payload = buildImportPayload(FORMAT_ECONOMICS_SCHEMA, upd.parsed!, upd.resolution, upd.blankColumns);
    expect(payload).toMatchObject({ code: "A1.3", name: "Cafe", space_sqft: 300 });
    for (const k of ["capex_min_inr", "notes", "space_sourced", "revenue_monthly_inr"]) expect(payload).not.toHaveProperty(k);

    const ins = validateImport(FORMAT_ECONOMICS_SCHEMA, [feRow({ Code: "A1.4" })], feCtx).rows[0];
    expect(buildImportPayload(FORMAT_ECONOMICS_SCHEMA, ins.parsed!, ins.resolution, ins.blankColumns)).toMatchObject({
      capex_min_inr: null,
      notes: null,
      space_sourced: false,
    });

    const bad = validateImport(FORMAT_ECONOMICS_SCHEMA, [feRow({ "Capex min (INR)": "9000" })], feCtx).rows[0];
    expect(bad.errors[0]).toContain("using stored Capex max (INR) = 5000");
  });

  it("brand_partnerships: blank cells are left out on update and space min is checked against stored max", () => {
    const bRow = (overrides: Record<string, string> = {}) => ({ "Brand name": "Chai Point", "Format code": "A1.3", ...overrides });
    const bCtx: CsvDbContext = {
      existingKeys: new Set(["Chai Point||A1.3"]),
      existingValues: new Map([["Chai Point||A1.3", { space_min_sqft: 80, space_max_sqft: 150 }]]),
      fuzzyCandidates: [],
      formatCodes: new Set(["A1.3"]),
    };
    const upd = validateImport(BRAND_PARTNERSHIPS_SCHEMA, [bRow({ "Royalty (%)": "8" })], bCtx).rows[0];
    const payload = buildImportPayload(BRAND_PARTNERSHIPS_SCHEMA, upd.parsed!, upd.resolution, upd.blankColumns);
    expect(payload).toMatchObject({ brand_name: "Chai Point", format_code: "A1.3", royalty_pct: 8 });
    for (const k of ["franchise_fee_inr", "brand_provides", "sourced", "operating_model"]) expect(payload).not.toHaveProperty(k);

    const bad = validateImport(BRAND_PARTNERSHIPS_SCHEMA, [bRow({ "Space min (sqft)": "200" })], bCtx).rows[0];
    expect(bad.errors[0]).toContain("using stored Space max (sqft) = 150");
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

describe("ro_format_competition CSV", () => {
  const compCtx: CsvDbContext = {
    existingKeys: new Set(["iocl-1||A1.2"]),
    fuzzyCandidates: [],
    roIds: new Set(["iocl-1", "iocl-2"]),
    formatCodes: new Set(["A1.1", "A1.2"]),
  };

  function compRow(overrides: Record<string, string> = {}): Record<string, string> {
    return {
      ro_id: "iocl-1",
      fsq_place_id: "4e0de08fb61c3fe477fd5db2",
      format_code: "A1.1",
      count_1km: "15.0",
      count_2km: "34.0",
      expected_count_2km: "27.2",
      gap_score: "39.0",
      naive_whitespace_score: "21.0",
      signal_quality: "strong",
      border_risk: "0",
      ...overrides,
    };
  }

  const one = (overrides: Record<string, string> = {}) =>
    validateImport(RO_FORMAT_COMPETITION_SCHEMA, [compRow(overrides)], compCtx).rows[0];

  it("replaces rows entirely on update: blank cells write null and nothing is left out", () => {
    // iocl-1 / A1.2 already exists in compCtx, so this row is an update.
    const r = one({
      format_code: "A1.2",
      count_1km: "",
      count_2km: "",
      expected_count_2km: "",
      gap_score: "",
      naive_whitespace_score: "",
      border_risk: "",
    });
    expect(r.action).toBe("update");
    const payload = buildImportPayload(RO_FORMAT_COMPETITION_SCHEMA, r.parsed!, r.resolution, r.blankColumns);
    expect(payload).toMatchObject({
      ro_id: "iocl-1",
      format_code: "A1.2",
      count_1km: null,
      count_2km: null,
      expected_count_2km: null,
      gap_score: null,
      naive_whitespace_score: null,
      border_risk: null,
      signal_quality: "strong",
    });
    for (const key of ["count_1km", "count_2km", "gap_score", "border_risk"]) expect(payload).toHaveProperty(key, null);
    expect(countUnchangedBlankCells(RO_FORMAT_COMPETITION_SCHEMA, [r])).toBe(0);
  });

  it("accepts a normal row, converting numbers and border_risk 0/1 to a boolean, and ignoring fsq_place_id", () => {
    const r = one();
    expect(r.errors).toEqual([]);
    expect(r.action).toBe("insert");
    expect(r.parsed).toEqual({
      ro_id: "iocl-1",
      format_code: "A1.1",
      count_1km: 15,
      count_2km: 34,
      expected_count_2km: 27.2,
      gap_score: 39,
      naive_whitespace_score: 21,
      signal_quality: "strong",
      border_risk: false,
    });
    expect(r.parsed).not.toHaveProperty("fsq_place_id");
    expect(one({ border_risk: "1" }).parsed).toMatchObject({ border_risk: true });
    expect(one({ border_risk: "1.0" }).parsed).toMatchObject({ border_risk: true });
  });

  it("rejects border_risk values other than 0/1", () => {
    expect(one({ border_risk: "2" }).errors).toHaveLength(1);
    expect(one({ border_risk: "yes" }).errors).toHaveLength(1);
  });

  it("imports blank numeric cells as null -- never 0 -- for a thin-signal row", () => {
    const r = one({
      count_1km: "",
      count_2km: "",
      expected_count_2km: "",
      gap_score: "",
      naive_whitespace_score: "",
      signal_quality: "thin",
    });
    expect(r.errors).toEqual([]);
    expect(r.parsed).toMatchObject({
      count_1km: null,
      count_2km: null,
      expected_count_2km: null,
      gap_score: null,
      naive_whitespace_score: null,
      signal_quality: "thin",
    });
  });

  it("keeps a blank border_risk as null (unknown), not false", () => {
    expect(one({ border_risk: "" }).parsed).toMatchObject({ border_risk: null });
  });

  it("accepts a slightly negative expected_count_2km as-is (present in the real file)", () => {
    const r = one({ expected_count_2km: "-0.4" });
    expect(r.errors).toEqual([]);
    expect(r.parsed).toMatchObject({ expected_count_2km: -0.4 });
  });

  it("keeps a genuine 0 as 0", () => {
    expect(one({ count_2km: "0", gap_score: "0" }).parsed).toMatchObject({ count_2km: 0, gap_score: 0 });
  });

  it("requires gap_score within 0-100", () => {
    expect(one({ gap_score: "100" }).errors).toEqual([]);
    expect(one({ gap_score: "101" }).errors).toEqual([expect.stringContaining("between 0 and 100")]);
    expect(one({ gap_score: "-1" }).errors).toEqual([expect.stringContaining("between 0 and 100")]);
    expect(one({ gap_score: "abc" }).errors).toHaveLength(1);
  });

  it("rejects fractional counts / gap score and negative counts", () => {
    expect(one({ count_2km: "3.5" }).errors).toEqual([expect.stringContaining("whole number")]);
    expect(one({ gap_score: "39.5" }).errors).toEqual([expect.stringContaining("whole number")]);
    expect(one({ count_1km: "-2" }).errors).toHaveLength(1);
  });

  it("rejects an unknown ro_id and an unknown format_code", () => {
    expect(one({ ro_id: "nope" }).errors).toEqual([expect.stringContaining("does not exist in ro_profiles")]);
    expect(one({ format_code: "Z9.9" }).errors).toEqual([expect.stringContaining("does not exist in format_economics")]);
  });

  it("requires ro_id, format_code and a valid signal_quality", () => {
    expect(one({ ro_id: "" }).errors.length).toBeGreaterThan(0);
    expect(one({ format_code: "" }).errors.length).toBeGreaterThan(0);
    expect(one({ signal_quality: "" }).errors).toHaveLength(1);
    expect(one({ signal_quality: "great" }).errors).toHaveLength(1);
  });

  it("classifies insert vs update on the (ro_id, format_code) key", () => {
    expect(one({ format_code: "A1.1" }).action).toBe("insert");
    const update = one({ format_code: "A1.2" });
    expect(update.action).toBe("update");
    expect(update.naturalKeyValue).toBe("iocl-1||A1.2");
  });

  it("flags a repeated (ro_id, format_code) within the file, but allows the same format at another outlet", () => {
    const rows = validateImport(
      RO_FORMAT_COMPETITION_SCHEMA,
      [compRow(), compRow(), compRow({ ro_id: "iocl-2" })],
      compCtx
    ).rows;
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toEqual([expect.stringContaining("Duplicate key within this file")]);
    expect(rows[2].errors).toEqual([]);
  });

  it("never flags near-duplicate names (no fuzzy matching for this table)", () => {
    const rows = validateImport(RO_FORMAT_COMPETITION_SCHEMA, [compRow(), compRow({ ro_id: "iocl-2" })], compCtx).rows;
    expect(rows.every((r) => r.duplicates.length === 0)).toBe(true);
  });
});

describe("chunk (batched upserts)", () => {
  it("splits into consecutive batches and keeps every item", () => {
    const items = Array.from({ length: 6118 }, (_, i) => i);
    const batches = chunk(items, 500);
    expect(batches).toHaveLength(13);
    expect(batches.every((b) => b.length <= 500)).toBe(true);
    expect(batches.flat()).toEqual(items);
  });

  it("returns no batches for no items and rejects a non-positive size", () => {
    expect(chunk([], 500)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow();
  });
});
