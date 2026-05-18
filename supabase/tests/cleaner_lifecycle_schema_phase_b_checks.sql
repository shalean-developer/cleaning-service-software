-- Manual verification after applying 20260530120000_cleaner_lifecycle_schema_phase_b.sql
-- Example: psql "$DATABASE_URL" -f supabase/tests/cleaner_lifecycle_schema_phase_b_checks.sql

\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cleaners'
      and column_name = 'deleted_at'
  ) then
    raise exception 'cleaners.deleted_at column missing (Phase B)';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cleaners'
      and column_name = 'onboarding_completed_at'
  ) then
    raise exception 'cleaners.onboarding_completed_at column missing (Phase B)';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cleaners'
      and column_name = 'suspension_ends_at'
  ) then
    raise exception 'cleaners.suspension_ends_at column missing (Phase B)';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cleaners'
      and column_name = 'lifecycle_reason'
  ) then
    raise exception 'cleaners.lifecycle_reason column missing (Phase B)';
  end if;
end $$;

do $$
declare
  v_null_onboarding bigint;
begin
  select count(*)
  into v_null_onboarding
  from public.cleaners
  where onboarding_completed_at is null;

  if v_null_onboarding > 0 then
    raise exception 'onboarding_completed_at backfill incomplete: % rows still null', v_null_onboarding;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'cleaner_operational_audit'
  ) then
    raise exception 'cleaner_operational_audit table missing (Phase B)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'cleaner_operational_audit'
      and c.relrowsecurity
  ) then
    raise exception 'cleaner_operational_audit RLS must be enabled (Phase B)';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cleaner_operational_audit'
      and policyname = 'cleaner_operational_audit_select_admin'
  ) then
    raise exception 'cleaner_operational_audit_select_admin policy missing (Phase B)';
  end if;
end $$;

select
  indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'cleaners'
  and indexname in (
    'idx_cleaners_not_deleted',
    'idx_cleaners_active_not_deleted',
    'idx_cleaners_suspended_window'
  )
order by indexname;
