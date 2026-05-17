-- notification_outbox RLS Phase 5F-a policy catalog checks.
-- Run after: 20260518200000_rls_notification_outbox_admin_select_only.sql
--
-- psql:  psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f supabase/tests/notification_outbox_rls_phase5f_checks.sql
-- CLI:   npx supabase db query --linked -f supabase/tests/notification_outbox_rls_phase5f_checks.sql

do $$
declare
  v_rls boolean;
begin
  select c.relrowsecurity
  into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'notification_outbox';

  if not coalesce(v_rls, false) then
    raise exception '5F-a: RLS must be enabled on public.notification_outbox';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_outbox'
      and policyname = 'notification_outbox_admin'
  ) then
    raise exception '5F-a: notification_outbox_admin must be dropped';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_outbox'
      and policyname = 'notification_outbox_select_admin'
      and cmd = 'SELECT'
  ) then
    raise exception '5F-a: notification_outbox_select_admin (SELECT) must exist';
  end if;
end $$;

do $$
declare
  v_authenticated_write_count int;
begin
  select count(*)::int
  into v_authenticated_write_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'notification_outbox'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and 'authenticated' = any (roles);

  if v_authenticated_write_count > 0 then
    raise exception '5F-a: unexpected authenticated write policy on notification_outbox (count %)', v_authenticated_write_count;
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
    and tablename = 'notification_outbox'
    and cmd = 'ALL'
    and 'authenticated' = any (roles);

  if v_unexpected_all_count > 0 then
    raise exception '5F-a: unexpected authenticated ALL policy on notification_outbox (count %)', v_unexpected_all_count;
  end if;
end $$;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'notification_outbox'
order by policyname;
