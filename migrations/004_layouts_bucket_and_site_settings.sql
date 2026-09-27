-- Migration: (1) create the Storage bucket for outlet site layout diagrams
-- (image or PDF), used by the Admin > Outlets "Site layout" upload, mirroring
-- migrations/002_storage_bucket.sql's ro-images pattern; and (2) create the
-- single-row site_settings table used by the new admin Theme Settings page.
--
-- Write access to ro-layouts is intentionally "authenticated" here, matching
-- how 002 first created ro-images before 003 tightened it -- migration 005
-- tightens both ro-layouts and ro-images to admin-only once the admin role
-- exists. Run migrations in numeric order.

insert into storage.buckets (id, name, public)
values ('ro-layouts', 'ro-layouts', true)
on conflict (id) do nothing;

drop policy if exists "Public read ro-layouts" on storage.objects;
create policy "Public read ro-layouts"
  on storage.objects for select
  using (bucket_id = 'ro-layouts');

drop policy if exists "Authenticated write ro-layouts" on storage.objects;
create policy "Authenticated write ro-layouts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ro-layouts');

drop policy if exists "Authenticated update ro-layouts" on storage.objects;
create policy "Authenticated update ro-layouts"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'ro-layouts')
  with check (bucket_id = 'ro-layouts');

drop policy if exists "Authenticated delete ro-layouts" on storage.objects;
create policy "Authenticated delete ro-layouts"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ro-layouts');

-- site_settings ---------------------------------------------------------
-- Single-row table (id fixed to 'global') holding the site-wide, admin-only
-- Theme Settings: font pairing, accent color, and root size scale. Publicly
-- readable because the root layout applies it on every page, not just /admin.

create table if not exists site_settings (
  id text primary key default 'global',
  font_pairing text not null default 'editorial'
    check (font_pairing in ('editorial', 'classic', 'modern')),
  accent_color text not null default '#C0293A'
    check (accent_color in ('#C0293A', '#0B1F33', '#1F5D4C', '#3D5A80')),
  size_scale text not null default 'normal'
    check (size_scale in ('compact', 'normal', 'large')),
  updated_at timestamptz not null default now()
);

insert into site_settings (id) values ('global') on conflict (id) do nothing;

alter table site_settings enable row level security;

drop policy if exists "Public read site_settings" on site_settings;
create policy "Public read site_settings"
  on site_settings for select
  using (true);

drop policy if exists "Authenticated update site_settings" on site_settings;
create policy "Authenticated update site_settings"
  on site_settings for update
  to authenticated
  using (true)
  with check (true);
