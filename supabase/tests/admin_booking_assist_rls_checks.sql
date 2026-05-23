-- admin_booking_assist audit + idempotency RLS checks (Phase 2).
-- Run after: 20260705100000_admin_booking_assist_audit.sql

\set ON_ERROR_STOP on

do $$
declare
  v_rls boolean;
begin
  foreach v_rls in array (
    select array_agg(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('admin_booking_assist_audit', 'admin_booking_assist_idempotency')
  )
  loop
    null;
  end loop;

  select c.relrowsecurity
  into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'admin_booking_assist_audit';

  if not coalesce(v_rls, false) then
    raise exception 'Phase 2: RLS must be enabled on public.admin_booking_assist_audit';
  end if;

  select c.relrowsecurity
  into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'admin_booking_assist_idempotency';

  if not coalesce(v_rls, false) then
    raise exception 'Phase 2: RLS must be enabled on public.admin_booking_assist_idempotency';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_booking_assist_audit'
      and policyname = 'admin_booking_assist_audit_select_admin'
      and cmd = 'SELECT'
  ) then
    raise exception 'Phase 2: admin_booking_assist_audit_select_admin must exist';
  end if;
end $$;

do $$
declare
  v_insert_count int;
  v_update_count int;
  v_delete_count int;
begin
  select count(*)::int
  into v_insert_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'admin_booking_assist_audit'
    and cmd = 'INSERT'
    and 'authenticated' = any (roles);

  select count(*)::int
  into v_update_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'admin_booking_assist_audit'
    and cmd = 'UPDATE'
    and 'authenticated' = any (roles);

  select count(*)::int
  into v_delete_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'admin_booking_assist_audit'
    and cmd = 'DELETE'
    and 'authenticated' = any (roles);

  if v_insert_count > 0 or v_update_count > 0 or v_delete_count > 0 then
    raise exception 'Phase 2: authenticated must not have write policies on admin_booking_assist_audit';
  end if;
end $$;

do $$
declare
  v_policy_count int;
begin
  select count(*)::int
  into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'admin_booking_assist_idempotency';

  if v_policy_count > 0 then
    raise exception 'Phase 2: admin_booking_assist_idempotency must have no RLS policies (service_role only)';
  end if;
end $$;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('admin_booking_assist_audit', 'admin_booking_assist_idempotency')
order by tablename, policyname;
