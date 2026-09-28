import Papa from "papaparse";
import { isPossibleDuplicate, similarity } from "./fuzzyMatch";
import { haversineKm } from "./geo";

export type CsvColumnType = "text" | "number" | "boolean" | "array" | "enum";

export interface CsvColumn {
  key: string;
  header: string;
  type: CsvColumnType;
  required?: boolean;
  enumValues?: readonly string[];
  /** Example value for the downloadable template's sample row. */
  example: string;
}

export interface CsvDbContext {
  /** Natural-key string (see naturalKeyValue) -> existing record's identifying value, for insert/update classification. */
  existingKeys: Set<string>;
  /** For the fuzzy-duplicate-vs-DB check: existing records' natural key + fuzzy field value. */
  fuzzyCandidates: {
    naturalKey: string;
    label: string;
    value: string;
    /** Only used by schemas with locationAwareDuplicates (ro_profiles). */
    latitude?: number | null;
    longitude?: number | null;
    pincode?: string | null;
  }[];
  /** Existing format_economics.code values, for existing_tenants / format_code FK checks from other tables. */
  formatCodes?: Set<string>;
  /** Fixed TAXONOMY code set, for validating format_economics' own `code` column. */
  taxonomyCodes?: Set<string>;
  /** Lowercased, trimmed OMC name -> id, for the omc column. */
  omcNameToId?: Map<string, number>;
  /** Existing distinct state/district values, for the always-on consistency check. */
  existingStates?: string[];
  existingDistricts?: string[];
}

export interface CsvTableSchema {
  table: "ro_profiles" | "format_economics" | "brand_partnerships";
  columns: CsvColumn[];
  /** Column key(s) forming the natural/conflict key used to match existing rows. */
  naturalKey: string[];
  /** postgrest onConflict target, e.g. "id" or "brand_name,format_code". */
  onConflict: string;
  /** Column checked for near-duplicates (within the CSV and against the DB). */
  fuzzyField?: string;
  /**
   * Opt-in: a name match alone is not enough to flag a duplicate; location is
   * also compared (see locationDuplicateVerdict). Without this, fuzzyField is
   * name-only.
   */
  locationAwareDuplicates?: { radiusM: number };
  crossFieldRules: { message: string; check: (row: Record<string, unknown>) => boolean }[];
  /** Keys present in `columns` (for template/parsing purposes) that are not real DB columns and must be dropped before writing, e.g. "omc" (resolves to omc_id). */
  excludeFromPayload?: string[];
}

export interface DuplicateFlag {
  kind: "within_csv" | "against_db";
  matchedRowNumber?: number;
  matchedLabel?: string;
  /** Only for "against_db": the matched existing record's natural key, so a row can be redirected to update it. */
  matchedNaturalKey?: string;
  similarityPct: number;
  /** Human-readable why this was flagged, e.g. "similar name, 60 m apart". Only set for location-aware schemas. */
  reason?: string;
  /** Only set when both records had coordinates. */
  distanceM?: number;
}

/**
 * "insert": write as a new row. "skip": don't import this row. "update":
 * upsert targeting `naturalKey` -- normally the row's own key (exact match),
 * but for a possible-duplicate the admin can redirect it to a different
 * existing record's key instead, so the onConflict upsert lands on that row.
 */
export type RowResolution =
  | { type: "insert" }
  | { type: "skip" }
  | { type: "update"; naturalKey: string };

export interface PreviewRow {
  rowNumber: number;
  raw: Record<string, string>;
  parsed: Record<string, unknown> | null;
  errors: string[];
  whitespaceFixed: boolean;
  naturalKeyValue: string | null;
  action: "insert" | "update" | null;
  duplicates: DuplicateFlag[];
  /** Admin's chosen resolution for this row; defaults to the engine's classification. */
  resolution: RowResolution;
}

export interface StateDistrictFlag {
  field: "state" | "district";
  valueA: string;
  valueB: string;
  similarityPct: number;
}

export interface ImportPreview {
  rows: PreviewRow[];
  stateDistrictFlags: StateDistrictFlag[];
  whitespaceFixCount: number;
}

export function parseCsvFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => resolve({ headers: result.meta.fields ?? [], rows: result.data }),
      error: (err: Error) => reject(err),
    });
  });
}

export function buildTemplateCsv(schema: CsvTableSchema): string {
  const headerRow = Object.fromEntries(schema.columns.map((c) => [c.header, c.example]));
  return Papa.unparse({ fields: schema.columns.map((c) => c.header), data: [headerRow] });
}

function collapseWhitespace(value: string): { value: string; changed: boolean } {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return { value: trimmed, changed: trimmed !== value };
}

function coerceColumn(
  column: CsvColumn,
  rawValue: string,
  errors: string[]
): unknown {
  if (column.type === "number") {
    if (rawValue === "") return null;
    const n = Number(rawValue);
    if (Number.isNaN(n)) {
      errors.push(`"${column.header}": malformed number ("${rawValue}")`);
      return null;
    }
    return n;
  }
  if (column.type === "boolean") {
    if (rawValue === "") return false;
    const lower = rawValue.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
    errors.push(`"${column.header}": must be true or false (got "${rawValue}")`);
    return false;
  }
  if (column.type === "array") {
    return rawValue
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (column.type === "enum") {
    if (rawValue === "") {
      if (column.required) errors.push(`"${column.header}": required`);
      return null;
    }
    if (!column.enumValues?.includes(rawValue)) {
      errors.push(
        `"${column.header}": must be exactly one of ${column.enumValues?.join(" / ")} (got "${rawValue}")`
      );
      return null;
    }
    return rawValue;
  }
  return rawValue === "" ? null : rawValue;
}

export function naturalKeyValue(schema: CsvTableSchema, source: Record<string, unknown>): string {
  return schema.naturalKey.map((k) => String(source[k] ?? "").trim()).join("||");
}

/** Inverse of naturalKeyValue: splits a joined key back into {column: value} for redirecting a row's write target. */
export function splitNaturalKey(schema: CsvTableSchema, key: string): Record<string, string> {
  const parts = key.split("||");
  return Object.fromEntries(schema.naturalKey.map((k, i) => [k, parts[i] ?? ""]));
}

interface DuplicateLocation {
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
}

function toLocation(source: {
  latitude?: unknown;
  longitude?: unknown;
  pincode?: unknown;
}): DuplicateLocation {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const pin = typeof source.pincode === "string" ? source.pincode.trim() : "";
  return { latitude: num(source.latitude), longitude: num(source.longitude), pincode: pin === "" ? null : pin };
}

/**
 * Given two records whose names already matched, decides whether they are
 * possible duplicates. In order: both have coordinates -> flag only within
 * radiusM (inclusive); else both have a pincode -> flag only if equal; else
 * nothing to compare -> flag on name alone, labelled low-confidence.
 */
export function locationDuplicateVerdict(
  a: DuplicateLocation,
  b: DuplicateLocation,
  radiusM: number
): { flag: boolean; reason: string; distanceM?: number } {
  if (a.latitude !== null && a.longitude !== null && b.latitude !== null && b.longitude !== null) {
    const distanceM = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000;
    return { flag: distanceM <= radiusM, reason: `similar name, ${Math.round(distanceM)} m apart`, distanceM };
  }
  if (a.pincode !== null && b.pincode !== null) {
    return { flag: a.pincode === b.pincode, reason: `similar name, same pincode ${a.pincode}` };
  }
  return { flag: true, reason: "similar name, no location data to compare (low confidence)" };
}

/**
 * Validates and classifies every parsed row against a table schema and live
 * DB context. Never writes anything -- purely a preview computation. Hard
 * errors block a row from import; possible-duplicate flags never do (the
 * admin decides per row via `resolution`).
 */
export function validateImport(
  schema: CsvTableSchema,
  rawRows: Record<string, string>[],
  ctx: CsvDbContext
): ImportPreview {
  let whitespaceFixCount = 0;
  const seenKeysThisFile = new Map<string, number>();

  const rows: PreviewRow[] = rawRows.map((raw, i) => {
    const rowNumber = i + 2; // header is row 1
    const errors: string[] = [];
    let whitespaceFixed = false;
    const cleanedRaw: Record<string, string> = {};

    for (const column of schema.columns) {
      const original = raw[column.header] ?? "";
      const { value, changed } = collapseWhitespace(original);
      if (changed) {
        whitespaceFixed = true;
        whitespaceFixCount += 1;
      }
      cleanedRaw[column.key] = value;
      if (column.required && value === "" && column.type !== "enum") {
        errors.push(`"${column.header}": required`);
      }
    }

    const parsed: Record<string, unknown> = {};
    for (const column of schema.columns) {
      parsed[column.key] = coerceColumn(column, cleanedRaw[column.key], errors);
    }

    // FK checks
    if (schema.table === "ro_profiles" && ctx.formatCodes) {
      for (const code of (parsed.existing_tenants as string[]) ?? []) {
        if (!ctx.formatCodes.has(code)) {
          errors.push(`"Existing tenant format codes": "${code}" does not exist in format_economics`);
        }
      }
      const omcName = String(cleanedRaw.omc ?? "");
      if (omcName === "") {
        errors.push(`"OMC": required`);
      } else if (ctx.omcNameToId) {
        const resolved = ctx.omcNameToId.get(omcName.toLowerCase());
        if (resolved === undefined) {
          errors.push(`"OMC": "${omcName}" does not match any OMC on file`);
        } else {
          parsed.omc_id = resolved;
        }
      }
    }
    if (schema.table === "brand_partnerships" && ctx.formatCodes) {
      const code = parsed.format_code as string;
      if (code && !ctx.formatCodes.has(code)) {
        errors.push(`"Format code": "${code}" does not exist in format_economics`);
      }
    }
    if (schema.table === "format_economics" && ctx.taxonomyCodes) {
      const code = parsed.code as string;
      if (code && !ctx.taxonomyCodes.has(code)) {
        errors.push(`"Code": "${code}" is not a recognized format taxonomy code`);
      }
    }

    // Cross-field business rules (hard errors -- internally contradictory data)
    for (const rule of schema.crossFieldRules) {
      if (rule.check(parsed)) errors.push(rule.message);
    }

    const key = naturalKeyValue(schema, parsed);
    const dupRowNumber = key ? seenKeysThisFile.get(key) : undefined;
    if (key && dupRowNumber !== undefined) {
      errors.push(`Duplicate key within this file (also on row ${dupRowNumber})`);
    } else if (key) {
      seenKeysThisFile.set(key, rowNumber);
    }

    const hasErrors = errors.length > 0;
    const action: PreviewRow["action"] = hasErrors ? null : ctx.existingKeys.has(key) ? "update" : "insert";

    return {
      rowNumber,
      raw: cleanedRaw,
      parsed: hasErrors ? null : parsed,
      errors,
      whitespaceFixed,
      naturalKeyValue: hasErrors ? null : key,
      action,
      duplicates: [],
      resolution: hasErrors
        ? { type: "skip" }
        : action === "update"
          ? { type: "update", naturalKey: key }
          : { type: "insert" },
    };
  });

  // Fuzzy duplicate detection -- only for rows that passed hard validation and are genuinely new inserts.
  if (schema.fuzzyField) {
    const field = schema.fuzzyField;
    const geo = schema.locationAwareDuplicates;
    const validNewRows = rows.filter((r) => r.parsed !== null && r.action === "insert");
    const locations = new Map(validNewRows.map((r) => [r, toLocation(r.parsed!)]));

    for (const row of validNewRows) {
      const value = String(row.parsed![field] ?? "");
      if (!value) continue;

      for (const other of validNewRows) {
        if (other === row || other.rowNumber >= row.rowNumber) continue;
        const otherValue = String(other.parsed![field] ?? "");
        const sim = similarity(value, otherValue);
        if (!isPossibleDuplicate(value, otherValue)) continue;
        const verdict = geo
          ? locationDuplicateVerdict(locations.get(row)!, locations.get(other)!, geo.radiusM)
          : null;
        if (verdict && !verdict.flag) continue;
        row.duplicates.push({
          kind: "within_csv",
          matchedRowNumber: other.rowNumber,
          matchedLabel: otherValue,
          similarityPct: Math.round(sim * 100),
          ...(verdict && { reason: verdict.reason, distanceM: verdict.distanceM }),
        });
      }

      for (const candidate of ctx.fuzzyCandidates) {
        const sim = similarity(value, candidate.value);
        if (!isPossibleDuplicate(value, candidate.value)) continue;
        const verdict = geo
          ? locationDuplicateVerdict(locations.get(row)!, toLocation(candidate), geo.radiusM)
          : null;
        if (verdict && !verdict.flag) continue;
        row.duplicates.push({
          kind: "against_db",
          matchedLabel: candidate.label,
          matchedNaturalKey: candidate.naturalKey,
          similarityPct: Math.round(sim * 100),
          ...(verdict && { reason: verdict.reason, distanceM: verdict.distanceM }),
        });
      }
    }
  }

  // State/district consistency (ro_profiles only) -- always on, feeds the sidebar filters directly.
  const stateDistrictFlags: StateDistrictFlag[] = [];
  if (schema.table === "ro_profiles") {
    for (const field of ["state", "district"] as const) {
      const inCsv = rows
        .filter((r) => r.parsed !== null)
        .map((r) => String(r.parsed![field] ?? ""))
        .filter(Boolean);
      const fromDb = (field === "state" ? ctx.existingStates : ctx.existingDistricts) ?? [];
      const combined = Array.from(new Set([...inCsv, ...fromDb]));

      for (let a = 0; a < combined.length; a++) {
        for (let b = a + 1; b < combined.length; b++) {
          if (combined[a] === combined[b]) continue;
          const sim = similarity(combined[a], combined[b]);
          if (isPossibleDuplicate(combined[a], combined[b])) {
            stateDistrictFlags.push({
              field,
              valueA: combined[a],
              valueB: combined[b],
              similarityPct: Math.round(sim * 100),
            });
          }
        }
      }
    }
  }

  return { rows, stateDistrictFlags, whitespaceFixCount };
}
