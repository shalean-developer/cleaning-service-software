-- payment_events RLS Phase 4a (5B-3) policy catalog checks.
-- Run after: 20260518170000_rls_payment_events_bookings_admin_select_only.sql
-- Example: psql "$DATABASE_URL" -f supabase/tests/payment_events_rls_phase4_checks.sql

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
    and c.relname = 'payment_events';

  if not coalesce(v_rls, false) then
    raise exception '5B-3 Phase 4a: RLS must be enabled on public.payment_events';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_events'
      and policyname = 'payment_events_admin_write'
  ) then
    raise exception '5B-3 Phase 4a: payment_events_admin_write must be dropped';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_events'
      and policyname = 'payment_events_select_admin'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3 Phase 4a: payment_events_select_admin (SELECT) must exist';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_events'
      and policyname = 'payment_events_select_customer'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3 Phase 4a: payment_events_select_customer (SELECT) must exist';
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
    and tablename = 'payment_events'
    and cmd = 'ALL'
    and 'authenticated' = any (roles);

  if v_unexpected_all_count > 0 then
    raise exception '5B-3 Phase 4a: unexpected authenticated ALL policy on payment_events (count %)', v_unexpected_all_count;
  end if;
end $$;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'payment_events'
order by policyname;
