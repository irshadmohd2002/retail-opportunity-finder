import { describe, expect, it, vi } from "vitest";

// csvSchemas.ts builds a Supabase client at import time; the schema/validation
// logic under test never touches it.
vi.mock("./supabase", () => ({ supabase: {} }));

import { validateImport, type CsvDbContext } from "./csvImport";
import { RO_PROFILES_SCHEMA } from "./csvSchemas";

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
