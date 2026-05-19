-- NF-7F: Team completion participation checks (run via psql in CI or locally).
-- Verifies support participation columns and self-complete RLS policy exist.

\set ON_ERROR_STOP on

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'booking_cleaners'
      and column_name = 'support_completed_at'
  ) then
    raise exception 'NF-7F: booking_cleaners.support_completed_at missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'booking_cleaners'
      and column_name = 'support_note'
  ) then
    raise exception 'NF-7F: booking_cleaners.support_note missing';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_cleaners'
      and policyname = 'booking_cleaners_support_complete_self'
  ) then
    raise exception 'NF-7F: booking_cleaners_support_complete_self policy missing';
  end if;
end $$;
