-- Existing tenants: NULL means unknown, an empty array means confirmed none.
--
-- ro_profiles.existing_tenants was text[] default '{}', so an outlet with no
-- tenant data at all looked identical to one verified to have none. Dropping
-- the default means new rows are unknown unless a value is supplied. Existing
-- rows are deliberately left as they are (no backfill): any '{}' already there
-- stays "confirmed none" until someone sets it to NULL.
--
-- Both statements are idempotent.

alter table ro_profiles alter column existing_tenants drop not null;
alter table ro_profiles alter column existing_tenants drop default;
