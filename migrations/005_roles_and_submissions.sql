-- Migration: contributor role support and the submission/approval queue.
--
-- Adds a `user_roles` table (deliberately not named `profiles`, to avoid
-- confusion with the existing `ro_profiles` outlet-profile table) and an
-- `is_admin()` helper, then TIGHTENS every existing "Authenticated ..." write
-- policy (created across 002-004) from "any logged-in user" to "admin only" --
-- necessary now that contributor accounts will also be logged-in users but
-- must never write directly to these tables, only submit proposals.
--
-- Run this in the Supabase SQL Editor after 001-004. After running it, you
-- must manually insert a user_roles row for your own existing admin account,
-- e.g.:
--   insert into user_roles (user_id, role)
--   values ('<your auth.users id>', 'admin');
-- Find your user id in Supabase Dashboard > Authentication > Users.
-- Do the same with role='contributor' for each contributor account you create.

-- user_roles --------------------------------------------------------------
create table if not exists user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'contributor')),
  created_at timestamptz not null default now()
);

alter table user_roles enable row level security;

drop policy if exists "Read own role" on user_roles;
create policy "Read own role"
  on user_roles for select
  to authenticated
  using (user_id = auth.uid());

-- is_admin() --------------------------------------------------------------
-- security definer so it can read user_roles regardless of the caller's own
-- RLS grant on that table -- it's used inside the RLS policies below, so it
-- must not itself depend on the row it's evaluating being visible.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'admin'
  );
$$;

-- submissions ---------------------------------------------------------------
create table if not exists submissions (
  id bigint generated always as identity primary key,
  target_table text not null check (target_table in ('ro_profiles', 'format_economics', 'brand_partnerships')),
  -- text so it can hold ro_profiles.id / format_economics.code (text PKs) or
  -- brand_partnerships.id (int PK, cast on approve); null = new-record proposal.
  target_record_id text,
  proposed_changes jsonb not null,
  submitted_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz
);

alter table submissions enable row level security;

drop policy if exists "Contributor insert own submissions" on submissions;
create policy "Contributor insert own submissions"
  on submissions for insert
  to authenticated
  with check (submitted_by = auth.uid());

drop policy if exists "Read own or admin read all submissions" on submissions;
create policy "Read own or admin read all submissions"
  on submissions for select
  to authenticated
  using (submitted_by = auth.uid() or is_admin());

drop policy if exists "Admin update submissions" on submissions;
create policy "Admin update submissions"
  on submissions for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Tighten ro_profiles -------------------------------------------------------
drop policy if exists "Authenticated insert ro_profiles" on ro_profiles;
create policy "Authenticated insert ro_profiles"
  on ro_profiles for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Authenticated update ro_profiles" on ro_profiles;
create policy "Authenticated update ro_profiles"
  on ro_profiles for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "Authenticated delete ro_profiles" on ro_profiles;
create policy "Authenticated delete ro_profiles"
  on ro_profiles for delete
  to authenticated
  using (is_admin());

-- Tighten ro_images -----------------------------------------------------
drop policy if exists "Authenticated insert ro_images" on ro_images;
create policy "Authenticated insert ro_images"
  on ro_images for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Authenticated update ro_images" on ro_images;
create policy "Authenticated update ro_images"
  on ro_images for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "Authenticated delete ro_images" on ro_images;
create policy "Authenticated delete ro_images"
  on ro_images for delete
  to authenticated
  using (is_admin());

-- Tighten format_economics ------------------------------------------------
drop policy if exists "Authenticated insert format_economics" on format_economics;
create policy "Authenticated insert format_economics"
  on format_economics for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Authenticated update format_economics" on format_economics;
create policy "Authenticated update format_economics"
  on format_economics for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "Authenticated delete format_economics" on format_economics;
create policy "Authenticated delete format_economics"
  on format_economics for delete
  to authenticated
  using (is_admin());

-- Tighten brand_partnerships ------------------------------------------------
drop policy if exists "Authenticated insert brand_partnerships" on brand_partnerships;
create policy "Authenticated insert brand_partnerships"
  on brand_partnerships for insert
  to authenticated
  with check (is_admin());

drop policy if exists "Authenticated update brand_partnerships" on brand_partnerships;
create policy "Authenticated update brand_partnerships"
  on brand_partnerships for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "Authenticated delete brand_partnerships" on brand_partnerships;
create policy "Authenticated delete brand_partnerships"
  on brand_partnerships for delete
  to authenticated
  using (is_admin());

-- Tighten site_settings -----------------------------------------------------
drop policy if exists "Authenticated update site_settings" on site_settings;
create policy "Authenticated update site_settings"
  on site_settings for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Tighten ro-images storage -------------------------------------------------
drop policy if exists "Authenticated write ro-images" on storage.objects;
create policy "Authenticated write ro-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ro-images' and is_admin());

drop policy if exists "Authenticated update ro-images" on storage.objects;
create policy "Authenticated update ro-images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'ro-images' and is_admin())
  with check (bucket_id = 'ro-images' and is_admin());

drop policy if exists "Authenticated delete ro-images" on storage.objects;
create policy "Authenticated delete ro-images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ro-images' and is_admin());

-- Tighten ro-layouts storage -------------------------------------------------
drop policy if exists "Authenticated write ro-layouts" on storage.objects;
create policy "Authenticated write ro-layouts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ro-layouts' and is_admin());

drop policy if exists "Authenticated update ro-layouts" on storage.objects;
create policy "Authenticated update ro-layouts"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'ro-layouts' and is_admin())
  with check (bucket_id = 'ro-layouts' and is_admin());

drop policy if exists "Authenticated delete ro-layouts" on storage.objects;
create policy "Authenticated delete ro-layouts"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ro-layouts' and is_admin());
