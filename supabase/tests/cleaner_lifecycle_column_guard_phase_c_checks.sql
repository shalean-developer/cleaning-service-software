-- Manual verification after applying 20260531120000_cleaner_lifecycle_column_guard_phase_c.sql
-- Example: psql "$DATABASE_URL" -f supabase/tests/cleaner_lifecycle_column_guard_phase_c_checks.sql

\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'guard_cleaner_lifecycle_columns'
  ) then
    raise exception 'guard_cleaner_lifecycle_columns function missing (Phase C)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'cleaners'
      and t.tgname = 'guard_cleaner_lifecycle_columns'
      and not t.tgisinternal
  ) then
    raise exception 'guard_cleaner_lifecycle_columns trigger missing on public.cleaners (Phase C)';
  end if;
end $$;

select
  p.proname as function_name,
  t.tgname as trigger_name
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public'
  and c.relname = 'cleaners'
  and t.tgname = 'guard_cleaner_lifecycle_columns';
