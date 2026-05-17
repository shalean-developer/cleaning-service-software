-- notification_metrics_hourly RLS Phase 5H-b policy catalog checks.
-- Run after: 20260518220000_notification_metrics_hourly.sql
--
-- psql:  psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f supabase/tests/notification_metrics_hourly_rls_phase5h_checks.sql

do $$
declare
  v_rls boolean;
begin
  select c.relrowsecurity
  into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'notification_metrics_hourly';

  if not coalesce(v_rls, false) then
    raise exception '5H-b: RLS must be enabled on public.notification_metrics_hourly';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_metrics_hourly'
      and policyname = 'notification_metrics_hourly_select_admin'
      and cmd = 'SELECT'
  ) then
    raise exception '5H-b: notification_metrics_hourly_select_admin (SELECT) must exist';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_metrics_hourly'
      and roles::text[] && array['authenticated']
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) then
    raise exception '5H-b: authenticated must not have write policies on notification_metrics_hourly';
  end if;
end $$;
