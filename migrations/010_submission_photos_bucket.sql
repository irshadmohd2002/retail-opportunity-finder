-- Migration: storage bucket for photo suggestions attached to public
-- "Suggest an edit" / "Suggest a new outlet" submissions
-- (submissions.proposed_changes.suggested_photos holds an array of paths in
-- this bucket -- no schema change to `submissions` needed, it's jsonb).
--
-- Public-write-only, no public read: anon can upload but never list or
-- download, so a leaked/guessed path still can't be browsed. Only admins
-- (is_admin()) can read -- needed both to preview a suggested photo before
-- approving it, and for the approve-time copy step (application code, see
-- SubmissionsAdmin.tsx) to pull it out of this bucket into the public
-- ro-images bucket.
--
-- No update/delete policy for anyone here. Rejected submissions' photos are
-- intentionally left in place; this will need a periodic cleanup job later
-- (e.g. a scheduled script using the service-role key, which bypasses RLS
-- entirely -- not built now, and wouldn't need a policy here anyway).
--
-- Run this in the Supabase SQL Editor after 001-009.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-photos',
  'submission-photos',
  false,
  5242880, -- 5MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public write submission-photos" on storage.objects;
create policy "Public write submission-photos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'submission-photos');

drop policy if exists "Admin read submission-photos" on storage.objects;
create policy "Admin read submission-photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'submission-photos' and is_admin());
