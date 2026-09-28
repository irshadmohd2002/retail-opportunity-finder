import { fetchAllRows } from "./fetchAllRows";
import { TAXONOMY } from "./taxonomy";
import { crossFieldColumns, type CsvDbContext, type CsvTableSchema } from "./csvImport";

export const RO_PROFILES_SCHEMA: CsvTableSchema = {
  table: "ro_profiles",
  naturalKey: ["id"],
  onConflict: "id",
  fuzzyField: "name",
  locationAwareDuplicates: { radiusM: 200 },
  excludeFromPayload: ["omc"],
  columns: [
    { key: "id", header: "ID (slug, unique)", type: "text", required: true, example: "andheri" },
    { key: "name", header: "Name", type: "text", required: true, example: "Andheri Highway RO" },
    { key: "state", header: "State", type: "text", example: "Maharashtra" },
    { key: "district", header: "District", type: "text", example: "Mumbai Suburban" },
    { key: "area", header: "Area", type: "text", example: "Andheri East" },
    { key: "location", header: "Location (display)", type: "text", example: "Western Express Highway" },
    { key: "type", header: "Type", type: "enum", required: true, enumValues: ["urban", "highway", "rural"], example: "highway" },
    { key: "ownership", header: "Ownership", type: "text", example: "COCO" },
    { key: "plot_sqm", header: "Plot area (sqm)", type: "number", example: "1200" },
    { key: "vacant_sqm", header: "Vacant area (sqm)", type: "number", example: "300" },
    { key: "existing_tenants", header: "Existing tenant format codes", type: "array", nullableArray: true, example: "A3.3, A4.1" },
    { key: "fuel_volume_kl_monthly", header: "Fuel volume (KL/month)", type: "number", example: "250" },
    { key: "vehicle_mix_2w_pct", header: "2-wheeler mix %", type: "number", example: "40" },
    { key: "vehicle_mix_4w_pct", header: "4-wheeler mix %", type: "number", example: "50" },
    { key: "vehicle_mix_cv_pct", header: "Commercial vehicle mix %", type: "number", example: "10" },
    { key: "layout_diagram_url", header: "Layout diagram URL", type: "text", example: "" },
    { key: "sourced", header: "Sourced/verified", type: "boolean", example: "true" },
    { key: "source_note", header: "Source note", type: "text", example: "" },
    { key: "last_verified", header: "Last verified (date)", type: "text", example: "" },
    { key: "demand_index", header: "Demand index (0-100)", type: "number", example: "60" },
    { key: "whitespace_index", header: "Whitespace index (0-100)", type: "number", example: "55" },
    { key: "omc", header: "OMC", type: "text", example: "Indian Oil Corporation" },
    { key: "latitude", header: "Latitude", type: "number", example: "19.1197" },
    { key: "longitude", header: "Longitude", type: "number", example: "72.8468" },
    { key: "pincode", header: "Pincode", type: "text", example: "400069" },
  ],
  crossFieldRules: [
    {
      message: "Vacant area (sqm) must be <= Plot area (sqm)",
      uses: ["plot_sqm", "vacant_sqm"],
      check: (row) =>
        row.vacant_sqm != null && row.plot_sqm != null && (row.vacant_sqm as number) > (row.plot_sqm as number),
    },
  ],
};

export const FORMAT_ECONOMICS_SCHEMA: CsvTableSchema = {
  table: "format_economics",
  naturalKey: ["code"],
  onConflict: "code",
  fuzzyField: "name",
  columns: [
    { key: "code", header: "Code", type: "text", required: true, example: "A1.3" },
    { key: "name", header: "Name", type: "text", required: true, example: "Cafe / Coffee Kiosk" },
    { key: "space_sqft", header: "Space (sqft)", type: "number", example: "300" },
    { key: "space_sourced", header: "Space sourced/verified", type: "boolean", example: "true" },
    { key: "space_source_note", header: "Space source note", type: "text", example: "" },
    { key: "capex_min_inr", header: "Capex min (INR)", type: "number", example: "1000000" },
    { key: "capex_max_inr", header: "Capex max (INR)", type: "number", example: "2000000" },
    { key: "capex_sourced", header: "Capex sourced/verified", type: "boolean", example: "true" },
    { key: "capex_source_note", header: "Capex source note", type: "text", example: "" },
    { key: "revenue_monthly_inr", header: "Typical monthly revenue (INR)", type: "number", example: "150000" },
    { key: "revenue_sourced", header: "Revenue sourced/verified", type: "boolean", example: "false" },
    { key: "ebitda_margin_pct", header: "EBITDA margin (%)", type: "number", example: "18" },
    { key: "ebitda_sourced", header: "EBITDA sourced/verified", type: "boolean", example: "false" },
    { key: "payback_months", header: "Payback (months)", type: "number", example: "24" },
    { key: "payback_sourced", header: "Payback sourced/verified", type: "boolean", example: "false" },
    { key: "notes", header: "Notes", type: "text", example: "" },
    { key: "speed_to_launch_tier", header: "Speed to launch tier (1-3)", type: "number", example: "2" },
  ],
  crossFieldRules: [
    {
      message: "Capex min (INR) must be <= Capex max (INR)",
      uses: ["capex_min_inr", "capex_max_inr"],
      check: (row) =>
        row.capex_min_inr != null &&
        row.capex_max_inr != null &&
        (row.capex_min_inr as number) > (row.capex_max_inr as number),
    },
  ],
};

export const BRAND_PARTNERSHIPS_SCHEMA: CsvTableSchema = {
  table: "brand_partnerships",
  naturalKey: ["brand_name", "format_code"],
  onConflict: "brand_name,format_code",
  fuzzyField: "brand_name",
  columns: [
    { key: "brand_name", header: "Brand name", type: "text", required: true, example: "Chai Point" },
    { key: "format_code", header: "Format code", type: "text", required: true, example: "A1.6" },
    { key: "operating_model", header: "Operating model", type: "text", example: "FOFO" },
    { key: "brand_provides", header: "Brand provides", type: "array", example: "Branding, Training" },
    { key: "partner_provides", header: "Partner provides", type: "array", example: "Space, Staff" },
    { key: "space_min_sqft", header: "Space min (sqft)", type: "number", example: "80" },
    { key: "space_max_sqft", header: "Space max (sqft)", type: "number", example: "150" },
    { key: "space_sourced", header: "Space sourced/verified", type: "boolean", example: "true" },
    { key: "franchise_fee_inr", header: "Franchise fee (INR)", type: "number", example: "500000" },
    { key: "royalty_pct", header: "Royalty (%)", type: "number", example: "8" },
    { key: "marketing_fee_pct", header: "Marketing fee (%)", type: "number", example: "2" },
    { key: "fees_sourced", header: "Fees sourced/verified", type: "boolean", example: "true" },
    { key: "regulatory_requirements", header: "Regulatory requirements", type: "array", example: "FSSAI" },
    { key: "other_requirements", header: "Other requirements", type: "array", example: "" },
    { key: "source_url", header: "Source URL", type: "text", example: "" },
    { key: "sourced", header: "Overall record sourced/verified", type: "boolean", example: "true" },
    { key: "last_verified", header: "Last verified (date)", type: "text", example: "" },
  ],
  crossFieldRules: [
    {
      message: "Space min (sqft) must be <= Space max (sqft)",
      uses: ["space_min_sqft", "space_max_sqft"],
      check: (row) =>
        row.space_min_sqft != null &&
        row.space_max_sqft != null &&
        (row.space_min_sqft as number) > (row.space_max_sqft as number),
    },
  ],
};

/**
 * Headers are the raw CSV column names (no display headers) since this file
 * comes from the data pipeline, not the template. Extra columns in the file
 * (fsq_place_id) are simply not listed here, so they are ignored.
 */
export const RO_FORMAT_COMPETITION_SCHEMA: CsvTableSchema = {
  table: "ro_format_competition",
  naturalKey: ["ro_id", "format_code"],
  onConflict: "ro_id,format_code",
  // Machine-generated snapshot: a refresh file replaces rows fully, so blank means not available (null).
  replaceOnUpdate: true,
  columns: [
    { key: "ro_id", header: "ro_id", type: "text", required: true, example: "iocl-delhi-new-delhi-77fd5db2" },
    { key: "format_code", header: "format_code", type: "text", required: true, example: "A1.1" },
    { key: "count_1km", header: "count_1km", type: "number", integer: true, min: 0, example: "15" },
    { key: "count_2km", header: "count_2km", type: "number", integer: true, min: 0, example: "34" },
    // No lower bound: the source's modelled expectation is occasionally slightly negative (about -0.1 to -0.9).
    { key: "expected_count_2km", header: "expected_count_2km", type: "number", example: "27.2" },
    { key: "gap_score", header: "gap_score", type: "number", integer: true, min: 0, max: 100, example: "39" },
    { key: "naive_whitespace_score", header: "naive_whitespace_score", type: "number", integer: true, example: "21" },
    {
      key: "signal_quality",
      header: "signal_quality",
      type: "enum",
      required: true,
      enumValues: ["strong", "borderline", "thin", "none"],
      example: "strong",
    },
    { key: "border_risk", header: "border_risk", type: "boolean", acceptZeroOne: true, blankIsNull: true, example: "0" },
  ],
  crossFieldRules: [],
};

/** Stored values of the given columns, keyed like validateImport's natural key, for cross-field checks on update rows. */
function storedValues(
  rows: Record<string, unknown>[],
  keyOf: (row: Record<string, unknown>) => string,
  columns: string[]
): Map<string, Record<string, unknown>> {
  return new Map(rows.map((r) => [keyOf(r), Object.fromEntries(columns.map((c) => [c, r[c]]))]));
}

const trimmed = (v: unknown) => String(v ?? "").trim();

export async function fetchRoFormatCompetitionDbContext(): Promise<CsvDbContext> {
  const [profiles, formats, existing] = await Promise.all([
    fetchAllRows<{ id: string }>("ro_profiles", "id", ["id"]),
    fetchAllRows<{ code: string }>("format_economics", "code", ["code"]),
    fetchAllRows<{ ro_id: string; format_code: string }>("ro_format_competition", "ro_id, format_code", [
      "ro_id",
      "format_code",
    ]),
  ]);
  return {
    existingKeys: new Set(existing.map((r) => `${r.ro_id.trim()}||${r.format_code.trim()}`)),
    fuzzyCandidates: [],
    roIds: new Set(profiles.map((p) => p.id)),
    formatCodes: new Set(formats.map((f) => f.code)),
  };
}

interface RoProfileContextRow {
  id: string;
  name: string;
  state: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
  [column: string]: unknown;
}

export async function fetchRoProfilesDbContext(): Promise<CsvDbContext> {
  const ruleColumns = crossFieldColumns(RO_PROFILES_SCHEMA);
  const [profiles, formats, omcs] = await Promise.all([
    fetchAllRows<RoProfileContextRow>(
      "ro_profiles",
      ["id", "name", "state", "district", "latitude", "longitude", "pincode", ...ruleColumns].join(", "),
      ["id"]
    ),
    fetchAllRows<{ code: string }>("format_economics", "code", ["code"]),
    fetchAllRows<{ id: number; name: string }>("omcs", "id, name", ["id"]),
  ]);
  return {
    existingKeys: new Set(profiles.map((p) => p.id)),
    existingValues: storedValues(profiles, (r) => trimmed(r.id), ruleColumns),
    fuzzyCandidates: profiles.map((p) => ({
      naturalKey: p.id,
      label: `${p.name} (${p.id})`,
      value: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      pincode: p.pincode,
    })),
    formatCodes: new Set(formats.map((f) => f.code)),
    omcNameToId: new Map(omcs.map((o) => [o.name.toLowerCase(), o.id])),
    existingStates: Array.from(new Set(profiles.map((p) => p.state).filter((v): v is string => !!v))),
    existingDistricts: Array.from(new Set(profiles.map((p) => p.district).filter((v): v is string => !!v))),
  };
}

export async function fetchFormatEconomicsDbContext(): Promise<CsvDbContext> {
  const ruleColumns = crossFieldColumns(FORMAT_ECONOMICS_SCHEMA);
  const rows = await fetchAllRows<{ code: string; name: string; [column: string]: unknown }>(
    "format_economics",
    ["code", "name", ...ruleColumns].join(", "),
    ["code"]
  );
  return {
    existingKeys: new Set(rows.map((r) => r.code)),
    existingValues: storedValues(rows, (r) => trimmed(r.code), ruleColumns),
    fuzzyCandidates: rows.map((r) => ({
      naturalKey: r.code,
      label: `${r.name} (${r.code})`,
      value: r.name,
    })),
    taxonomyCodes: new Set(TAXONOMY.map((t) => t.code)),
  };
}

export async function fetchBrandPartnershipsDbContext(): Promise<CsvDbContext> {
  const ruleColumns = crossFieldColumns(BRAND_PARTNERSHIPS_SCHEMA);
  const [brands, formats] = await Promise.all([
    fetchAllRows<{ brand_name: string; format_code: string; [column: string]: unknown }>(
      "brand_partnerships",
      ["brand_name", "format_code", ...ruleColumns].join(", "),
      ["brand_name", "format_code"]
    ),
    fetchAllRows<{ code: string }>("format_economics", "code", ["code"]),
  ]);
  const keyOf = (b: { brand_name?: unknown; format_code?: unknown }) =>
    `${trimmed(b.brand_name)}||${trimmed(b.format_code)}`;
  return {
    existingKeys: new Set(brands.map(keyOf)),
    existingValues: storedValues(brands, keyOf, ruleColumns),
    fuzzyCandidates: brands.map((b) => ({
      naturalKey: keyOf(b),
      label: `${b.brand_name} (${b.format_code})`,
      value: b.brand_name,
    })),
    formatCodes: new Set(formats.map((f) => f.code)),
  };
}
