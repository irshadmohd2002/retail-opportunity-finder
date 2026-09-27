-- Migration: make "Suggest an edit" fully public (no login required), matching
-- Google Maps' contribution model, while adding database-level abuse
-- safeguards on the same table -- since submissions insert directly from the
-- browser with the anon key, any check living only in frontend code (a
-- honeypot field, client-side validation) can be bypassed by a script calling
-- Supabase's REST API directly. Everything below is enforced in the INSERT
-- policy or a trigger-adjacent function, not just in the Next.js app.
--
-- Run this in the Supabase SQL Editor after 001-008. It supersedes the
-- contributor-only insert/select policies from 005_roles_and_submissions.sql.
-- The user_roles table, is_admin(), and the admin login flow are left intact
-- (still used for the admin review screen) even though contributor accounts
-- are no longer required to submit.

-- submissions: schema changes ------------------------------------------------
alter table submissions
  alter column submitted_by drop not null;

alter table submissions
  add column if not exists submitter_name text,
  add column if not exists submitter_email text;

-- IP rate-limit tracking ------------------------------------------------------
-- One row per (ip, clock-hour bucket). Best-effort layer: approximates "last
-- hour" via a fixed clock-hour window rather than a true rolling window --
-- acceptable here since this is a backstop, not the primary defense (the
-- global/per-email caps below are). RLS is enabled with no policies at all,
-- so only the security-definer function below can read or write it; anon and
-- authenticated roles have no direct access.
create table if not exists submission_rate_limits (
  ip text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (ip, window_start)
);

alter table submission_rate_limits enable row level security;

-- check_submission_rate_limit() ----------------------------------------------
-- Increments the counter for this IP's current clock-hour bucket and reports
-- whether it has exceeded the threshold. Fails OPEN (returns true, i.e. does
-- not block) when the IP is null/unavailable, so a missing or unparseable
-- x-forwarded-for header can never itself block public submissions -- this is
-- a best-effort layer on top of the global/per-email caps, not the primary
-- defense. Also does opportunistic cleanup of buckets older than 24h so the
-- table doesn't grow unbounded.
create or replace function check_submission_rate_limit(p_ip text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket timestamptz := date_trunc('hour', now());
  v_count int;
begin
  if p_ip is null or p_ip = '' then
    return true;
  end if;

  delete from submission_rate_limits where window_start < now() - interval '24 hours';

  insert into submission_rate_limits (ip, window_start, count)
  values (p_ip, v_bucket, 1)
  on conflict (ip, window_start) do update set count = submission_rate_limits.count + 1
  returning count into v_count;

  return v_count <= 20;
end;
$$;

-- client_ip() -----------------------------------------------------------------
-- Best-effort extraction of the caller's IP from the request headers Supabase
-- (PostgREST) exposes via the request.headers GUC on hosted projects.
-- x-forwarded-for is a comma-separated hop chain where each proxy appends the
-- IP it observed the request come from; the FIRST value is client-supplied
-- and trivially spoofable by a script calling the API directly, so we read
-- the LAST value instead, which should be the one Supabase's own edge
-- appended. Returns null (fail open, see check_submission_rate_limit above)
-- if the header is missing or malformed.
create or replace function client_ip()
returns text
language sql
stable
as $$
  select nullif(
    trim(
      (string_to_array(
        current_setting('request.headers', true)::json ->> 'x-forwarded-for',
        ','
      ))[array_length(
        string_to_array(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ','),
        1
      )]
    ),
    ''
  );
$$;

-- submissions: policies -------------------------------------------------------
drop policy if exists "Contributor insert own submissions" on submissions;
drop policy if exists "Read own or admin read all submissions" on submissions;
drop policy if exists "Admin update submissions" on submissions;

-- Anonymous (and still-logged-in) submitters can insert, subject to all of:
--   (a) global cap -- reject once 500+ rows are pending
--   (b) per-email cap -- reject once the same submitter_email (ci) has 10+ pending
--   (c) best-effort IP rate limit -- see check_submission_rate_limit() above
create policy "Public insert submissions with abuse limits"
  on submissions for insert
  to anon, authenticated
  with check (
    (select count(*) from submissions s where s.status = 'pending') < 500
    and
    (select count(*) from submissions s
       where s.status = 'pending'
         and lower(s.submitter_email) = lower(submissions.submitter_email)) < 10
    and
    check_submission_rate_limit(client_ip())
  );

-- Admin-only read access -- anonymous submitters can insert, never read.
create policy "Admin read submissions"
  on submissions for select
  to authenticated
  using (is_admin());

create policy "Admin update submissions"
  on submissions for update
  to authenticated
  using (is_admin())
  with check (is_admin());
