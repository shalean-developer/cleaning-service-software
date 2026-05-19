-- NF-7C: booking_cleaners RLS and schema catalog checks.
-- Run after: 20260523120000_booking_cleaners_team_foundation.sql
-- Example: psql "$DATABASE_URL" -f supabase/tests/booking_cleaners_rls_nf7c_checks.sql

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
    and c.relname = 'booking_cleaners';

  if not coalesce(v_rls, false) then
    raise exception 'NF-7C: RLS must be enabled on public.booking_cleaners';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_cleaners'
      and policyname = 'booking_cleaners_select_cleaner'
      and cmd = 'SELECT'
  ) then
    raise exception 'NF-7C: booking_cleaners_select_cleaner (SELECT) must exist';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_cleaners'
      and policyname = 'booking_cleaners_select_admin'
      and cmd = 'SELECT'
  ) then
    raise exception 'NF-7C: booking_cleaners_select_admin (SELECT) must exist';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_cleaners'
      and policyname = 'booking_cleaners_admin_write'
      and cmd = 'ALL'
  ) then
    raise exception 'NF-7C: booking_cleaners_admin_write (ALL) must exist';
  end if;
end $$;

do $$
declare
  v_customer_policy_count int;
begin
  select count(*)::int
  into v_customer_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'booking_cleaners'
    and policyname ilike '%customer%';

  if v_customer_policy_count > 0 then
    raise exception 'NF-7C: booking_cleaners must not expose customer policies (found %)', v_customer_policy_count;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'booking_cleaners'
      and indexname = 'idx_booking_cleaners_one_active_primary'
  ) then
    raise exception 'NF-7C: idx_booking_cleaners_one_active_primary must exist';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_cleaners_booking_cleaner_unique'
  ) then
    raise exception 'NF-7C: booking_cleaners_booking_cleaner_unique must exist';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'booking_cleaner_role'
  ) then
    raise exception 'NF-7C: booking_cleaner_role enum must exist';
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'booking_cleaner_status'
  ) then
    raise exception 'NF-7C: booking_cleaner_status enum must exist';
  end if;
end $$;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'booking_cleaners'
order by policyname;
