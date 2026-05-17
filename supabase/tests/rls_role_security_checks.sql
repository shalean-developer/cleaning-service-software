-- Manual RLS verification (run after applying 20260516160000_rls_role_security.sql).
-- After 5B-3a also run: supabase/tests/payments_rls_phase1_checks.sql
-- After 5B-3b-a also run: supabase/tests/earning_lines_rls_phase3b_checks.sql
-- After 5B-3c-a also run: supabase/tests/assignment_offers_rls_phase3c_checks.sql
-- After 5B-3 Phase 4a also run: supabase/tests/payment_events_rls_phase4_checks.sql
-- After 5B-3 Phase 4a also run: supabase/tests/bookings_rls_phase4_checks.sql
-- Example: psql "$DATABASE_URL" -f supabase/tests/rls_role_security_checks.sql

\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'guard_booking_status_change'
  ) then
    raise exception 'RLS migration not applied: guard_booking_status_change missing';
  end if;
end $$;

do $$
declare
  v_table text;
  v_rls boolean;
begin
  foreach v_table in array array[
    'profiles',
    'customers',
    'cleaners',
    'services',
    'bookings',
    'payments',
    'payment_events',
    'assignment_offers',
    'earning_lines',
    'notification_outbox',
    'booking_state_audit'
  ]
  loop
    select c.relrowsecurity
    into v_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = v_table;

    if not coalesce(v_rls, false) then
      raise exception 'RLS not enabled on public.%', v_table;
    end if;
  end loop;
end $$;

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'customers',
    'cleaners',
    'services',
    'bookings',
    'payments',
    'payment_events',
    'assignment_offers',
    'earning_lines',
    'notification_outbox',
    'booking_state_audit'
  )
order by tablename, policyname;
