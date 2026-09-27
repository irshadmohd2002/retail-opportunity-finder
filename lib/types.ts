export type OutletType = "urban" | "highway" | "rural";

export interface RoProfile {
  id: string;
  name: string;
  state: string | null;
  district: string | null;
  area: string | null;
  location: string | null;
  type: OutletType;
  ownership: string | null;
  plot_sqm: number | null;
  vacant_sqm: number | null;
  existing_tenants: string[];
  fuel_volume_kl_monthly: number | null;
  vehicle_mix_2w_pct: number | null;
  vehicle_mix_4w_pct: number | null;
  vehicle_mix_cv_pct: number | null;
  layout_diagram_url: string | null;
  sourced: boolean;
  source_note: string | null;
  last_verified: string | null;
  created_at: string;
  updated_at: string;
  /** Placeholder engine input, manually entered 0-100. See lib/scoring.ts. */
  demand_index: number | null;
  /** Placeholder engine input, manually entered 0-100. See lib/scoring.ts. */
  whitespace_index: number | null;
  omc_id: number;
  /** Backend-only -- no public field displays raw coordinates. Used for Nearby Outlets (Haversine). */
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
}

export interface Omc {
  id: number;
  name: string;
  created_at: string;
}

export interface RoImage {
  id: number;
  ro_id: string;
  url: string;
  caption: string | null;
  sort_order: number | null;
  created_at: string;
}

export interface FormatEconomics {
  code: string;
  name: string;
  space_sqft: number | null;
  space_sourced: boolean;
  space_source_note: string | null;
  capex_min_inr: number | null;
  capex_max_inr: number | null;
  capex_sourced: boolean;
  capex_source_note: string | null;
  revenue_monthly_inr: number | null;
  revenue_sourced: boolean;
  ebitda_margin_pct: number | null;
  ebitda_sourced: boolean;
  payback_months: number | null;
  payback_sourced: boolean;
  notes: string | null;
  updated_at: string;
  /** 1 (fast) - 3 (slow) placeholder used only by the "Fastest to launch" lens. */
  speed_to_launch_tier: number | null;
}

export interface BrandPartnership {
  id: number;
  brand_name: string;
  format_code: string;
  operating_model: string | null;
  brand_provides: string[];
  partner_provides: string[];
  space_min_sqft: number | null;
  space_max_sqft: number | null;
  space_sourced: boolean;
  franchise_fee_inr: number | null;
  royalty_pct: number | null;
  marketing_fee_pct: number | null;
  fees_sourced: boolean;
  regulatory_requirements: string[];
  other_requirements: string[];
  source_url: string | null;
  sourced: boolean;
  last_verified: string | null;
  created_at: string;
}

export type FontPairing = "editorial" | "classic" | "modern";
export type SizeScale = "compact" | "normal" | "large";

export interface SiteSettings {
  id: string;
  font_pairing: FontPairing;
  accent_color: string;
  size_scale: SizeScale;
  updated_at: string;
}

export type UserAppRole = "admin" | "contributor";

export interface UserRole {
  user_id: string;
  role: UserAppRole;
  created_at: string;
}

export type SubmissionTargetTable = "ro_profiles" | "format_economics" | "brand_partnerships";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Submission {
  id: number;
  target_table: SubmissionTargetTable;
  target_record_id: string | null;
  proposed_changes: Record<string, unknown>;
  submitted_by: string;
  created_at: string;
  status: SubmissionStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}
