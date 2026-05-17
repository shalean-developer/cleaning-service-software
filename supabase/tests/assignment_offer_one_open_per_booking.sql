-- Stage 3C-a verification: one offered assignment_offer per booking.
-- Run after migrations: psql "$DATABASE_URL" -f supabase/tests/assignment_offer_one_open_per_booking.sql

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Catalog: partial unique index present; per-cleaner index preserved
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'assignment_offers'
      and indexname = 'idx_assignment_offers_one_open_per_booking'
  ) then
    raise exception 'idx_assignment_offers_one_open_per_booking missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'assignment_offers'
      and indexname = 'idx_assignment_offers_one_open_per_cleaner'
  ) then
    raise exception 'idx_assignment_offers_one_open_per_cleaner missing';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- No duplicate offered rows remain after migration backfill
-- ---------------------------------------------------------------------------

do $$
declare
  v_dup_count integer;
begin
  select count(*) into v_dup_count
  from (
    select booking_id
    from public.assignment_offers
    where status = 'offered'
    group by booking_id
    having count(*) > 1
  ) d;

  if v_dup_count > 0 then
    raise exception 'found % booking(s) with multiple offered rows after backfill', v_dup_count;
  end if;
end $$;

-- Insert/unique rules are covered by Vitest migration assertions and command-layer tests.
