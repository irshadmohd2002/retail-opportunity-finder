/**
 * ro_profiles.existing_tenants is tri-state: null = unknown, [] = confirmed
 * none, a non-empty array = the formats already operating there. Nothing here
 * may ever turn null into [] as a side effect.
 */

export const EXISTING_OUTLETS_UNKNOWN_NOTE =
  "Existing outlets are unknown for this site - some formats may already operate here.";

export type TenantsMode = "unknown" | "none" | "has";

export const TENANTS_UNKNOWN_LABEL = "Unknown";
export const TENANTS_NONE_LABEL = "None (confirmed)";

export function tenantsMode(value: string[] | null | undefined): TenantsMode {
  if (value == null) return "unknown";
  return value.length === 0 ? "none" : "has";
}

export function parseCodes(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const TENANTS_INCOMPLETE_MESSAGE =
  "Enter at least one format code, or choose Unknown / None confirmed";

export type TenantsEdit = { ok: true; value: string[] | null } | { ok: false; error: string };

/**
 * What the three-way control means: Unknown -> null, None confirmed -> [], Has
 * outlets -> the codes. "Has outlets" with no codes is incomplete, never [] --
 * it must not silently become "None confirmed".
 */
export function resolveTenantsEdit(mode: TenantsMode, codesText: string): TenantsEdit {
  if (mode === "unknown") return { ok: true, value: null };
  if (mode === "none") return { ok: true, value: [] };
  const codes = parseCodes(codesText);
  return codes.length === 0 ? { ok: false, error: TENANTS_INCOMPLETE_MESSAGE } : { ok: true, value: codes };
}

/** Summary-card content: null is unknown, never a count. */
export type ExistingTenantsSummary =
  | { known: false }
  | { known: true; count: number; names: string[] };

export function existingTenantsSummary(
  tenants: string[] | null | undefined,
  nameOf: (code: string) => string
): ExistingTenantsSummary {
  if (!Array.isArray(tenants)) return { known: false };
  return { known: true, count: tenants.length, names: tenants.map(nameOf) };
}

/** Text for the submissions review table. */
export function existingTenantsLabel(value: unknown): string {
  if (value == null) return TENANTS_UNKNOWN_LABEL;
  if (Array.isArray(value)) return value.length === 0 ? TENANTS_NONE_LABEL : value.join(", ");
  return String(value);
}
