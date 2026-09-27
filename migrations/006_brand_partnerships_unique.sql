-- Migration: unique(brand_name, format_code) on brand_partnerships, so the
-- Feature 4 CSV import can upsert with onConflict on this natural key instead
-- of an app-code lookup-then-branch. Verified against live data before
-- writing this migration -- 38 existing rows, zero duplicate
-- (brand_name, format_code) pairs (case-sensitive or case-insensitive) -- so
-- this is safe to add with no cleanup step.

alter table brand_partnerships
  add constraint brand_partnerships_brand_format_unique unique (brand_name, format_code);
