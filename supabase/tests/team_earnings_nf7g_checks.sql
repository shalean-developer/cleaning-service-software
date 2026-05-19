-- NF-7G: earning_lines multi-cleaner foundation checks (run via supabase test harness / psql).

-- Role/source columns exist
select 1
where exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'earning_lines'
    and column_name = 'team_earning_role'
);

select 1
where exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'earning_lines'
    and column_name = 'team_earning_source'
);

-- Per-cleaner completion uniqueness (replaces old booking_completion-only index)
select 1
where exists (
  select 1
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'earning_lines_booking_cleaner_completion_unique'
);

-- Legacy singleton index removed
select 1
where not exists (
  select 1
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'earning_lines_booking_completion_unique'
);
