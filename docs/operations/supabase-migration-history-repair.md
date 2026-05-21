# Supabase migration history repair (recurring engine)

This document records known migration drift for the Shalean recurring bookings rollout and safe repair steps. **Do not repair blindly** — always back up first.

## What was applied manually (or out-of-band)

These changes may exist on production/staging before the matching local migration history reflects them:

| Change | Local migration file | Notes |
|--------|----------------------|-------|
| `booking_series` RLS policies | `20260602130000_booking_series_rls_policies.sql` | Admin/customer SELECT; admin write; engine uses `service_role` |
| `recurring_generation_runs` table | `20260521200000_recurring_generation_runs.sql` | Duplicate timestamp file `20260521215348_recurring_generation_runs.sql` is empty — safe to ignore |
| Audit FK preservation on ops clear | `20260521120000_ops_preserve_append_only_audit_on_clear.sql` | Append-only triggers on operational audit tables |
| `recurring_series_requests` (Phase 5B) | `20260605120000_recurring_series_requests.sql` | Customer support queue |

## Why `supabase db push` may fail

Common causes:

1. **Remote already has objects** from manual SQL in the dashboard — push tries to re-apply `CREATE TABLE` / `CREATE POLICY`.
2. **Empty or duplicate migration filenames** in history (e.g. `20260521215348_recurring_generation_runs.sql` with no body).
3. **Migration order vs. manual hotfix** — a policy was added in SQL editor before the migration file landed in git.
4. **Local-only migrations** never linked to the linked Supabase project.

## Safe repair steps

1. **Backup** — Supabase dashboard → Database → Backups, or `pg_dump` before any change.
2. **Compare** — List local files under `supabase/migrations/` vs. `supabase migration list` (remote applied).
3. **Mark applied** (when remote already matches file contents):
   ```bash
   supabase migration repair --status applied <version>
   ```
   Use only when you've verified the remote schema matches the SQL file.
4. **Apply missing only** — Run individual SQL files in the SQL editor for gaps, then `migration repair` to sync history.
5. **Verify** — `npm run ops:audit:recurring-launch` and `npm run ops:audit:recurring-bookings`.

## What not to do

- Do **not** `DROP TABLE booking_series` or child `bookings.series_id` links to “fix” drift.
- Do **not** force-push migration history without confirming remote DDL.
- Do **not** disable RLS on `booking_series` or `recurring_series_requests` in production.
- Do **not** run destructive `db reset` against a shared staging/production project.

## Recommended verification after repair

```bash
npm run ops:audit:recurring-bookings
npm run ops:audit:recurring-launch
npm run ops:soak:recurring-bookings
npm run test
```

## Phase 5 tables checklist

- [ ] `booking_series` — exists, RLS on
- [ ] `recurring_generation_runs` — exists, append-only trigger
- [ ] `recurring_series_requests` — exists, RLS on
- [ ] `bookings.series_id` — populated for recurring children
- [ ] Cron `CRON_SECRET` set in Vercel + Vault (if using pg_cron HTTP)
