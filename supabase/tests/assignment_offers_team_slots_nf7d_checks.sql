-- NF-7D: assignment_offers slot columns, per-role uniqueness, roster access.
-- Run after: 20260524120000_assignment_offers_team_slots_nf7d.sql

\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assignment_offers'
      and column_name = 'team_role'
  ) then
    raise exception 'NF-7D: assignment_offers.team_role must exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assignment_offers'
      and column_name = 'roster_id'
  ) then
    raise exception 'NF-7D: assignment_offers.roster_id must exist';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'assignment_offers'
      and indexname = 'idx_assignment_offers_one_open_per_booking'
  ) then
    raise exception 'NF-7D: legacy idx_assignment_offers_one_open_per_booking must be dropped';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'assignment_offers'
      and indexname = 'idx_assignment_offers_one_open_per_booking_team_role'
  ) then
    raise exception 'NF-7D: idx_assignment_offers_one_open_per_booking_team_role must exist';
  end if;
end $$;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
  into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'cleaner_can_access_booking';

  if v_def is null then
    raise exception 'NF-7D: cleaner_can_access_booking must exist';
  end if;

  if v_def not ilike '%booking_cleaners%' then
    raise exception 'NF-7D: cleaner_can_access_booking must reference booking_cleaners';
  end if;
end $$;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'assignment_offers'
  and indexname like '%one_open%'
order by indexname;
