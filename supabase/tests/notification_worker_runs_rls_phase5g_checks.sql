-- notification_worker_runs RLS Phase 5G-a policy catalog checks.
-- Run after: 20260518210000_notification_worker_runs.sql
--
-- psql:  psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f supabase/tests/notification_worker_runs_rls_phase5g_checks.sql

do $$
declare
  v_rls boolean;
begin
  select c.relrowsecurity
  into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'notification_worker_runs';

  if not coalesce(v_rls, false) then
    raise exception '5G-a: RLS must be enabled on public.notification_worker_runs';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_worker_runs'
      and policyname = 'notification_worker_runs_select_admin'
      and cmd = 'SELECT'
  ) then
    raise exception '5G-a: notification_worker_runs_select_admin (SELECT) must exist';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_worker_runs'
      and roles::text[] && array['authenticated']
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) then
    raise exception '5G-a: authenticated must not have write policies on notification_worker_runs';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'notification_worker_runs_append_only'
  ) then
    raise exception '5G-a: notification_worker_runs_append_only trigger must exist';
  end if;
end $$;
