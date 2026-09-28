-- Migration: per-format competition data for each outlet (Foursquare OS Places
-- derived: competitor counts within 1 km / 2 km, the count expected for the
-- area, and a 0-100 gap score). Consumed by the scoring engine as the
-- whitespace input when an outlet has rows here; outlets with no rows keep
-- using ro_profiles.whitespace_index unchanged.
--
-- Run this in the Supabase SQL Editor after 001-010. Requires is_admin() from
-- 005_roles_and_submissions.sql.

create table if not exists ro_format_competition (
  ro_id text not null references ro_profiles (id) on delete cascade,
  format_code text not null references format_economics (code),
  count_1km int,
  count_2km int,
  expected_count_2km numeric,
  gap_score smallint check (gap_score between 0 and 100),
  naive_whitespace_score smallint,
  signal_quality text check (signal_quality in ('strong', 'borderline', 'thin', 'none')),
  border_risk boolean,
  primary key (ro_id, format_code)
);

alter table ro_format_competition enable row level security;

drop policy if exists "Public read ro_format_competition" on ro_format_competition;
create policy "Public read ro_format_competition"
  on ro_format_competition for select
  to anon, authenticated
  using (true);

drop policy if exists "Admin insert ro_format_competition" on ro_format_competition;
create policy "Admin insert ro_format_competition"
  on ro_format_competition for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Admin update ro_format_competition" on ro_format_competition;
create policy "Admin update ro_format_competition"
  on ro_format_competition for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "Admin delete ro_format_competition" on ro_format_competition;
create policy "Admin delete ro_format_competition"
  on ro_format_competition for delete
  to authenticated
  using (is_admin());
