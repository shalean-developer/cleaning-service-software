-- Stage 2B-2c-1 verification: one active booking_lock per booking; historical locks allowed.
-- Run after migrations: psql "$DATABASE_URL" -f supabase/tests/booking_lock_retry_active_unique.sql

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Catalog: old constraint removed, partial unique index present
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'booking_locks'
      and c.conname = 'booking_locks_booking_id_unique'
  ) then
    raise exception 'booking_locks_booking_id_unique still exists';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'booking_locks'
      and indexname = 'booking_locks_one_active_per_booking_idx'
  ) then
    raise exception 'booking_locks_one_active_per_booking_idx missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'booking_locks'
      and indexname = 'booking_locks_one_active_per_booking_idx'
      and indexdef ilike '%where%status%active%'
  ) then
    raise exception 'partial index predicate must filter status = active';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Behavioral checks (rolled back — no persistent test data)
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  v_profile_id uuid := gen_random_uuid();
  v_customer_id uuid;
  v_booking_id uuid := gen_random_uuid();
  v_other_booking_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_expires timestamptz := now() + interval '30 minutes';
  v_lock_base constant jsonb := '{"mode":"best_available"}'::jsonb;
begin
  insert into public.profiles (id, role, full_name)
  values (v_profile_id, 'customer', 'Stage 2B-2c-1 lock test');

  insert into public.customers (profile_id, company_name)
  values (v_profile_id, 'lock-retry-test-' || left(v_profile_id::text, 8))
  returning id into v_customer_id;

  insert into public.bookings (
    id,
    customer_id,
    status,
    scheduled_start,
    scheduled_end,
    price_cents,
    currency
  ) values
    (
      v_booking_id,
      v_customer_id,
      'draft',
      v_now + interval '2 days',
      v_now + interval '2 days' + interval '2 hours',
      50000,
      'ZAR'
    ),
    (
      v_other_booking_id,
      v_customer_id,
      'draft',
      v_now + interval '3 days',
      v_now + interval '3 days' + interval '2 hours',
      50000,
      'ZAR'
    );

  -- 1) consumed + expired historical locks on same booking are allowed
  insert into public.booking_locks (
    booking_id,
    customer_id,
    idempotency_key,
    status,
    expires_at,
    locked_price_cents,
    locked_service_slug,
    locked_schedule_start,
    locked_schedule_end,
    locked_area_slug,
    inputs_hash
  ) values (
    v_booking_id,
    v_customer_id,
    'sql-test:lock:consumed:' || gen_random_uuid()::text,
    'consumed',
    v_expires,
    50000,
    'regular-cleaning',
    v_now + interval '2 days',
    v_now + interval '2 days' + interval '2 hours',
    'cape-town',
    'hash-consumed-1'
  );

  insert into public.booking_locks (
    booking_id,
    customer_id,
    idempotency_key,
    status,
    expires_at,
    locked_price_cents,
    locked_service_slug,
    locked_schedule_start,
    locked_schedule_end,
    locked_area_slug,
    inputs_hash
  ) values (
    v_booking_id,
    v_customer_id,
    'sql-test:lock:expired:' || gen_random_uuid()::text,
    'expired',
    v_now - interval '1 hour',
    50000,
    'regular-cleaning',
    v_now + interval '2 days',
    v_now + interval '2 days' + interval '2 hours',
    'cape-town',
    'hash-expired-1'
  );

  -- 2) first active lock on booking succeeds
  insert into public.booking_locks (
    booking_id,
    customer_id,
    idempotency_key,
    status,
    expires_at,
    locked_price_cents,
    locked_service_slug,
    locked_schedule_start,
    locked_schedule_end,
    locked_area_slug,
    inputs_hash
  ) values (
    v_booking_id,
    v_customer_id,
    'sql-test:lock:active:1:' || gen_random_uuid()::text,
    'active',
    v_expires,
    50000,
    'regular-cleaning',
    v_now + interval '2 days',
    v_now + interval '2 days' + interval '2 hours',
    'cape-town',
    'hash-active-1'
  );

  -- 3) second active lock on same booking must fail
  begin
    insert into public.booking_locks (
      booking_id,
      customer_id,
      idempotency_key,
      status,
      expires_at,
      locked_price_cents,
      locked_service_slug,
      locked_schedule_start,
      locked_schedule_end,
      locked_area_slug,
      inputs_hash
    ) values (
      v_booking_id,
      v_customer_id,
      'sql-test:lock:active:2:' || gen_random_uuid()::text,
      'active',
      v_expires,
      50000,
      'regular-cleaning',
      v_now + interval '2 days',
      v_now + interval '2 days' + interval '2 hours',
      'cape-town',
      'hash-active-2'
    );
    raise exception 'expected unique_violation for second active lock on same booking';
  exception
    when unique_violation then
      null;
  end;

  -- 4) active lock on a different booking is allowed
  insert into public.booking_locks (
    booking_id,
    customer_id,
    idempotency_key,
    status,
    expires_at,
    locked_price_cents,
    locked_service_slug,
    locked_schedule_start,
    locked_schedule_end,
    locked_area_slug,
    inputs_hash
  ) values (
    v_other_booking_id,
    v_customer_id,
    'sql-test:lock:active:other:' || gen_random_uuid()::text,
    'active',
    v_expires,
    50000,
    'regular-cleaning',
    v_now + interval '3 days',
    v_now + interval '3 days' + interval '2 hours',
    'cape-town',
    'hash-active-other'
  );

  -- 5) after consuming the active lock, a new active lock on same booking is allowed (retry path)
  update public.booking_locks
  set status = 'consumed', updated_at = now()
  where booking_id = v_booking_id
    and status = 'active';

  insert into public.booking_locks (
    booking_id,
    customer_id,
    idempotency_key,
    status,
    expires_at,
    locked_price_cents,
    locked_service_slug,
    locked_schedule_start,
    locked_schedule_end,
    locked_area_slug,
    inputs_hash
  ) values (
    v_booking_id,
    v_customer_id,
    'sql-test:lock:active:retry:' || gen_random_uuid()::text,
    'active',
    v_expires,
    50000,
    'regular-cleaning',
    v_now + interval '2 days',
    v_now + interval '2 days' + interval '2 hours',
    'cape-town',
    'hash-active-retry'
  );
end $$;

rollback;

select 'booking_lock_retry_active_unique checks passed' as result;
