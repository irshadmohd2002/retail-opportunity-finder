-- Migration: lock down writes to admin-only (Supabase Auth "authenticated" role)
-- while keeping all four tables readable by anyone, including anonymous
-- visitors browsing the outlet pages. Run this once in the Supabase SQL
-- Editor (anon/publishable key cannot enable RLS or create policies).
--
-- This supersedes the "no-login tool" assumption baked into
-- migrations/002_storage_bucket.sql: the ro-images storage bucket is
-- updated at the bottom of this file to match (public read, authenticated
-- write) now that the admin area requires a logged-in session.

-- ro_profiles ---------------------------------------------------------------
alter table ro_profiles enable row level security;

drop policy if exists "Public read ro_profiles" on ro_profiles;
create policy "Public read ro_profiles"
  on ro_profiles for select
  using (true);

drop policy if exists "Authenticated insert ro_profiles" on ro_profiles;
create policy "Authenticated insert ro_profiles"
  on ro_profiles for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated update ro_profiles" on ro_profiles;
create policy "Authenticated update ro_profiles"
  on ro_profiles for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated delete ro_profiles" on ro_profiles;
create policy "Authenticated delete ro_profiles"
  on ro_profiles for delete
  to authenticated
  using (true);

-- ro_images -------------------------------------------------------------
alter table ro_images enable row level security;

drop policy if exists "Public read ro_images" on ro_images;
create policy "Public read ro_images"
  on ro_images for select
  using (true);

drop policy if exists "Authenticated insert ro_images" on ro_images;
create policy "Authenticated insert ro_images"
  on ro_images for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated update ro_images" on ro_images;
create policy "Authenticated update ro_images"
  on ro_images for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated delete ro_images" on ro_images;
create policy "Authenticated delete ro_images"
  on ro_images for delete
  to authenticated
  using (true);

-- format_economics --------------------------------------------------------
alter table format_economics enable row level security;

drop policy if exists "Public read format_economics" on format_economics;
create policy "Public read format_economics"
  on format_economics for select
  using (true);

drop policy if exists "Authenticated insert format_economics" on format_economics;
create policy "Authenticated insert format_economics"
  on format_economics for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated update format_economics" on format_economics;
create policy "Authenticated update format_economics"
  on format_economics for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated delete format_economics" on format_economics;
create policy "Authenticated delete format_economics"
  on format_economics for delete
  to authenticated
  using (true);

-- brand_partnerships --------------------------------------------------------
alter table brand_partnerships enable row level security;

drop policy if exists "Public read brand_partnerships" on brand_partnerships;
create policy "Public read brand_partnerships"
  on brand_partnerships for select
  using (true);

drop policy if exists "Authenticated insert brand_partnerships" on brand_partnerships;
create policy "Authenticated insert brand_partnerships"
  on brand_partnerships for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated update brand_partnerships" on brand_partnerships;
create policy "Authenticated update brand_partnerships"
  on brand_partnerships for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated delete brand_partnerships" on brand_partnerships;
create policy "Authenticated delete brand_partnerships"
  on brand_partnerships for delete
  to authenticated
  using (true);

-- ro-images storage bucket --------------------------------------------------
-- Replace the anon-write policies from 002_storage_bucket.sql now that
-- uploads happen from the logged-in admin area.
drop policy if exists "Anon write ro-images" on storage.objects;
drop policy if exists "Anon update ro-images" on storage.objects;
drop policy if exists "Anon delete ro-images" on storage.objects;

drop policy if exists "Authenticated write ro-images" on storage.objects;
create policy "Authenticated write ro-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ro-images');

drop policy if exists "Authenticated update ro-images" on storage.objects;
create policy "Authenticated update ro-images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'ro-images')
  with check (bucket_id = 'ro-images');

drop policy if exists "Authenticated delete ro-images" on storage.objects;
create policy "Authenticated delete ro-images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ro-images');

-- "Public read ro-images" (select) from 002_storage_bucket.sql is unchanged
-- and still allows anyone to view photos on the public outlet pages.
