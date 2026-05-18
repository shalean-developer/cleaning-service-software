-- Manual verification after applying 20260529120000_cleaner_lifecycle_safety_phase_a.sql
-- Example: psql "$DATABASE_URL" -f supabase/tests/cleaner_lifecycle_safety_phase_a_checks.sql

\set ON_ERROR_STOP on

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cleaners'
      and policyname = 'cleaners_admin_delete'
  ) then
    raise exception 'cleaners_admin_delete policy must be dropped (Phase A)';
  end if;
end $$;

do $$
declare
  v_rule text;
begin
  select rc.delete_rule
  into v_rule
  from information_schema.referential_constraints rc
  join information_schema.key_column_usage kcu
    on kcu.constraint_catalog = rc.constraint_catalog
   and kcu.constraint_schema = rc.constraint_schema
   and kcu.constraint_name = rc.constraint_name
  where kcu.table_schema = 'public'
    and kcu.table_name = 'assignment_offers'
    and kcu.column_name = 'cleaner_id';

  if v_rule is distinct from 'RESTRICT' then
    raise exception 'assignment_offers.cleaner_id FK delete_rule expected RESTRICT, got %', v_rule;
  end if;

  select rc.delete_rule
  into v_rule
  from information_schema.referential_constraints rc
  join information_schema.key_column_usage kcu
    on kcu.constraint_catalog = rc.constraint_catalog
   and kcu.constraint_schema = rc.constraint_schema
   and kcu.constraint_name = rc.constraint_name
  where kcu.table_schema = 'public'
    and kcu.table_name = 'earning_lines'
    and kcu.column_name = 'cleaner_id';

  if v_rule is distinct from 'RESTRICT' then
    raise exception 'earning_lines.cleaner_id FK delete_rule expected RESTRICT, got %', v_rule;
  end if;
end $$;

select
  kcu.table_name,
  kcu.column_name,
  rc.delete_rule
from information_schema.referential_constraints rc
join information_schema.key_column_usage kcu
  on kcu.constraint_catalog = rc.constraint_catalog
 and kcu.constraint_schema = rc.constraint_schema
 and kcu.constraint_name = rc.constraint_name
where kcu.table_schema = 'public'
  and kcu.column_name = 'cleaner_id'
  and kcu.table_name in (
    'assignment_offers',
    'earning_lines',
    'bookings',
    'cleaner_service_areas',
    'cleaner_service_capabilities',
    'cleaner_availability',
    'cleaner_time_off',
    'booking_cleaners',
    'admin_operational_audit'
  )
order by kcu.table_name;
