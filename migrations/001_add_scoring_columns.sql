-- Migration: add placeholder scoring inputs not covered by the original schema.
-- Run this once in the Supabase SQL Editor (anon/publishable key cannot run DDL).
--
-- demand_index / whitespace_index: manually-entered 0-100 placeholders feeding the
-- recommendation engine's Stage 3 score. Real catchment/competition data (Google
-- Places API, quarterly refresh) is a Phase 2 item -- these are illustrative only.
--
-- speed_to_launch_tier: 1 (fast) - 3 (slow) placeholder used only by the
-- "Fastest to launch first" Priority Lens sort.

alter table ro_profiles
  add column if not exists demand_index smallint check (demand_index between 0 and 100),
  add column if not exists whitespace_index smallint check (whitespace_index between 0 and 100);

alter table format_economics
  add column if not exists speed_to_launch_tier smallint check (speed_to_launch_tier between 1 and 3);

-- Illustrative placeholder values for the 5 seeded outlets.
update ro_profiles set demand_index = 65, whitespace_index = 55 where id = 'jalampura';
update ro_profiles set demand_index = 60, whitespace_index = 60 where id = 'ratanpur';
update ro_profiles set demand_index = 55, whitespace_index = 70 where id = 'sirohi';
update ro_profiles set demand_index = 40, whitespace_index = 75 where id = 'barmer';
update ro_profiles set demand_index = 80, whitespace_index = 35 where id = 'andheri';

-- Illustrative placeholder speed-to-launch tiers for the 23 seeded formats.
update format_economics set speed_to_launch_tier = 2 where code = 'A1.1';
update format_economics set speed_to_launch_tier = 3 where code = 'A1.2';
update format_economics set speed_to_launch_tier = 1 where code = 'A1.3';
update format_economics set speed_to_launch_tier = 2 where code = 'A1.4';
update format_economics set speed_to_launch_tier = 1 where code = 'A1.5';
update format_economics set speed_to_launch_tier = 1 where code = 'A1.6';
update format_economics set speed_to_launch_tier = 2 where code = 'A2.1';
update format_economics set speed_to_launch_tier = 2 where code = 'A2.2';
update format_economics set speed_to_launch_tier = 2 where code = 'A3.1';
update format_economics set speed_to_launch_tier = 2 where code = 'A3.2';
update format_economics set speed_to_launch_tier = 2 where code = 'A3.3';
update format_economics set speed_to_launch_tier = 3 where code = 'A3.4';
update format_economics set speed_to_launch_tier = 2 where code = 'A3.5';
update format_economics set speed_to_launch_tier = 1 where code = 'A3.6';
update format_economics set speed_to_launch_tier = 2 where code = 'A3.7';
update format_economics set speed_to_launch_tier = 1 where code = 'A4.1';
update format_economics set speed_to_launch_tier = 1 where code = 'A4.2';
update format_economics set speed_to_launch_tier = 1 where code = 'A5.1';
update format_economics set speed_to_launch_tier = 2 where code = 'A5.2';
update format_economics set speed_to_launch_tier = 2 where code = 'A6.1';
update format_economics set speed_to_launch_tier = 3 where code = 'A6.2';
update format_economics set speed_to_launch_tier = 1 where code = 'A7.1';
update format_economics set speed_to_launch_tier = 2 where code = 'A7.2';
