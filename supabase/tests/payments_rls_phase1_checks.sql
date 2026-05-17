-- Payments RLS Phase 1 (5B-3a) policy catalog checks.
-- Run after: 20260518140000_rls_payments_admin_select_only.sql
-- Example: psql "$DATABASE_URL" -f supabase/tests/payments_rls_phase1_checks.sql

\set ON_ERROR_STOP on

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'payments_admin_write'
  ) then
    raise exception '5B-3a: payments_admin_write must be dropped';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'payments_select_admin'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3a: payments_select_admin (SELECT) must exist';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'payments_select_customer'
      and cmd = 'SELECT'
  ) then
    raise exception '5B-3a: payments_select_customer (SELECT) must exist';
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
    and tablename = 'payments'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and 'authenticated' = any (roles);

  if v_write_policy_count > 0 then
    raise exception '5B-3a: unexpected authenticated write policy on payments (count %)', v_write_policy_count;
  end if;
end $$;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'payments'
order by policyname;
