-- Migration: create the Storage bucket for outlet site photos, used by the
-- Admin > Photos screen and the "Site photos" modal. Anon key cannot create
-- buckets or storage policies (confirmed: POST /storage/v1/bucket -> 403),
-- so this must be run in the Supabase SQL Editor.
--
-- This is an internal, no-login tool that authenticates only via the
-- publishable/anon key, so these policies intentionally allow any holder of
-- that key to read/write this one bucket. Do not reuse this pattern for a
-- bucket that should be restricted to authenticated staff.

insert into storage.buckets (id, name, public)
values ('ro-images', 'ro-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read ro-images" on storage.objects;
create policy "Public read ro-images"
  on storage.objects for select
  using (bucket_id = 'ro-images');

drop policy if exists "Anon write ro-images" on storage.objects;
create policy "Anon write ro-images"
  on storage.objects for insert
  with check (bucket_id = 'ro-images');

drop policy if exists "Anon update ro-images" on storage.objects;
create policy "Anon update ro-images"
  on storage.objects for update
  using (bucket_id = 'ro-images');

drop policy if exists "Anon delete ro-images" on storage.objects;
create policy "Anon delete ro-images"
  on storage.objects for delete
  using (bucket_id = 'ro-images');
