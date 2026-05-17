-- earning_lines RLS Phase 3b (5B-3b-a) policy catalog checks.
-- Run after: 20260518150000_rls_earning_lines_admin_select_only.sql
-- Example: psql "$DATABASE_URL" -f supabase/tests/earning_lines_rls_phase3b_checks.sql

\set ON_ERROR_STOP on

do $$
declare
  v_rls boolean;
begin
  select c.relrowsecurity
  into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'earning_lines';

  if not coalesce(v_rls, false) then
    raise exception '5B-3b-a: RLS must be enabled on public.earning_lines';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'earning_lines'
      and policyname = 'earning_lines_admin_write'
  ) then
    raise exception '5B-3b-a: earning_lines_admin_write must be dropped';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'earning_lines'
      and policyname = 'earning_lines_select_admin'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3b-a: earning_lines_select_admin (SELECT) must exist';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'earning_lines'
      and policyname = 'earning_lines_select_cleaner'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3b-a: earning_lines_select_cleaner (SELECT) must exist';
  end if;
end $$;

do $$
declare
  v_write_policy_count int;
begin
  select count(*)::int
  into v_write_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'earning_lines'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and 'authenticated' = any (roles);

  if v_write_policy_count > 0 then
    raise exception '5B-3b-a: unexpected authenticated write policy on earning_lines (count %)', v_write_policy_count;
  end if;
end $$;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'earning_lines'
order by policyname;
