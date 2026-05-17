-- assignment_offers RLS Phase 3c (5B-3c-a) policy catalog checks.
-- Run after: 20260518160000_rls_assignment_offers_admin_select_only.sql
-- Example: psql "$DATABASE_URL" -f supabase/tests/assignment_offers_rls_phase3c_checks.sql

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
    and c.relname = 'assignment_offers';

  if not coalesce(v_rls, false) then
    raise exception '5B-3c-a: RLS must be enabled on public.assignment_offers';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_offers'
      and policyname = 'assignment_offers_admin_write'
  ) then
    raise exception '5B-3c-a: assignment_offers_admin_write must be dropped';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_offers'
      and policyname = 'assignment_offers_select_admin'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3c-a: assignment_offers_select_admin (SELECT) must exist';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_offers'
      and policyname = 'assignment_offers_select_cleaner'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3c-a: assignment_offers_select_cleaner (SELECT) must exist';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_offers'
      and policyname = 'assignment_offers_select_customer'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3c-a: assignment_offers_select_customer (SELECT) must exist';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_offers'
      and policyname = 'assignment_offers_update_cleaner'
      and cmd = 'UPDATE'
  ) then
    raise exception '5B-3c-a: assignment_offers_update_cleaner (UPDATE) must exist';
  end if;
end $$;

do $$
declare
  v_admin_write_count int;
begin
  select count(*)::int
  into v_admin_write_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'assignment_offers'
    and policyname = 'assignment_offers_admin_write';

  if v_admin_write_count > 0 then
    raise exception '5B-3c-a: assignment_offers_admin_write must not exist (count %)', v_admin_write_count;
  end if;
end $$;

do $$
declare
  v_unexpected_all_count int;
begin
  select count(*)::int
  into v_unexpected_all_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'assignment_offers'
    and cmd = 'ALL'
    and 'authenticated' = any (roles);

  if v_unexpected_all_count > 0 then
    raise exception '5B-3c-a: unexpected authenticated ALL policy on assignment_offers (count %)', v_unexpected_all_count;
  end if;
end $$;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'assignment_offers'
order by policyname;
