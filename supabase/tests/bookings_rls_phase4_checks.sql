-- bookings RLS Phase 4a (5B-3) policy catalog checks.
-- Run after: 20260518170000_rls_payment_events_bookings_admin_select_only.sql
-- Example: psql "$DATABASE_URL" -f supabase/tests/bookings_rls_phase4_checks.sql

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
    and c.relname = 'bookings';

  if not coalesce(v_rls, false) then
    raise exception '5B-3 Phase 4a: RLS must be enabled on public.bookings';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'guard_booking_status_change'
  ) then
    raise exception '5B-3 Phase 4a: guard_booking_status_change must exist';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'bookings'
      and t.tgname = 'guard_booking_status_change'
      and not t.tgisinternal
  ) then
    raise exception '5B-3 Phase 4a: guard_booking_status_change trigger must exist on bookings';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
      and policyname = 'bookings_admin_write'
  ) then
    raise exception '5B-3 Phase 4a: bookings_admin_write must be dropped';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
      and policyname = 'bookings_select_admin'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3 Phase 4a: bookings_select_admin (SELECT) must exist';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
      and policyname = 'bookings_select_customer'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3 Phase 4a: bookings_select_customer (SELECT) must exist';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
      and policyname = 'bookings_select_cleaner'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3 Phase 4a: bookings_select_cleaner (SELECT) must exist';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bookings'
      and policyname = 'bookings_update_customer'
      and cmd = 'UPDATE'
  ) then
    raise exception '5B-3 Phase 4a: bookings_update_customer (UPDATE) must exist';
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
    and tablename = 'bookings'
    and cmd = 'ALL'
    and 'authenticated' = any (roles);

  if v_unexpected_all_count > 0 then
    raise exception '5B-3 Phase 4a: unexpected authenticated ALL policy on bookings (count %)', v_unexpected_all_count;
  end if;
end $$;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'bookings'
order by policyname;
