-- Migration: latitude/longitude (for the Nearby Outlets display, Haversine
-- straight-line distance only -- no routing/corridor data) and pincode on
-- ro_profiles. All nullable, no backfill of existing sample outlets required.

alter table ro_profiles add column if not exists latitude numeric;
alter table ro_profiles add column if not exists longitude numeric;
alter table ro_profiles add column if not exists pincode text;
