-- Migration: multi-OMC support. Adds a proper `omcs` reference table (admin-
-- managed, joinable) instead of a text enum, links ro_profiles to it, and
-- backfills every existing outlet to Indian Oil Corporation -- confirmed:
-- all 5 current sample outlets (Jalampura, Ratanpur, Sirohi, Barmer, Andheri)
-- are genuinely Indian Oil, this isn't a placeholder default.

create table if not exists omcs (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into omcs (name) values
  ('Indian Oil Corporation'),
  ('Bharat Petroleum'),
  ('Hindustan Petroleum'),
  ('Nayara Energy'),
  ('Jio-BP'),
  ('Shell India')
on conflict (name) do nothing;

alter table omcs enable row level security;

drop policy if exists "Public read omcs" on omcs;
create policy "Public read omcs"
  on omcs for select
  using (true);

drop policy if exists "Admin write omcs" on omcs;
create policy "Admin write omcs"
  on omcs for all
  to authenticated
  using (is_admin())
  with check (is_admin());

alter table ro_profiles add column if not exists omc_id bigint references omcs (id);

update ro_profiles
set omc_id = (select id from omcs where name = 'Indian Oil Corporation')
where omc_id is null;

alter table ro_profiles alter column omc_id set not null;
