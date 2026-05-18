# Deferred assignment — production enablement checklist

Do **not** enable `DEFERRED_ASSIGNMENT_ENABLED` in production until every item below is checked.

## Before enabling

- [ ] Phase 1 migration applied: `20260527120000_assignment_dispatch_deferred_phase1.sql`
- [ ] Phase 2 migration applied: `20260528120000_deferred_dispatch_phase2_ops.sql`
- [ ] `CRON_SECRET` set in production Vercel env
- [ ] Vault `cron_secret` matches production `CRON_SECRET`
- [ ] Vault `dispatch_deferred_assignments_cron_url` points to production HTTPS route
- [ ] pg_cron job `dispatch-deferred-assignments-hourly` active
- [ ] Manual cron tested in production (or staging with production-like data): 200 + `deferred_dispatch_cron_runs` row
- [ ] Admin deferred panel + diagnostics verified on staging
- [ ] Recovery / `dispatch_not_started` exclusion verified on staging
- [ ] [deferred-assignment-staging-verification.md](./deferred-assignment-staging-verification.md) passed
- [ ] Rollback tested: set `DEFERRED_ASSIGNMENT_ENABLED=false` on staging; confirm immediate dispatch for new payments

## Enablement order

1. Deploy application code with **`DEFERRED_ASSIGNMENT_ENABLED=false`** in production.
2. Apply database migrations (phase 1, then phase 2).
3. Configure Vault secrets and confirm pg_cron job registered.
4. Manually invoke cron once; verify response and `deferred_dispatch_cron_runs`.
5. Complete staging verification checklist on staging with flag **on**.
6. Enable `DEFERRED_ASSIGNMENT_ENABLED=true` on **staging**; monitor 24–48h.
7. After approval: enable `DEFERRED_ASSIGNMENT_ENABLED=true` in **production**.
8. Monitor: overdue dispatch count, cron `failed_count`, recovery queue noise, customer support tickets.

## Do not (until separate approval)

- Expand booking date window to 90 days
- Change assignment engine internals
- Add new booking statuses
- Schedule cron faster than hourly without monitoring baseline

## Rollback plan

1. Set `DEFERRED_ASSIGNMENT_ENABLED=false` in Vercel production (immediate for new payments).
2. Disable pg_cron job: `update cron.job set active = false where jobname = 'dispatch-deferred-assignments-hourly';`
3. Ops may use **Dispatch now** or recovery cron for bookings already deferred with open dispatch windows.
4. No payment rollback required; `assignment_dispatch_at` column may remain.

## Remaining risks after enablement

| Risk | Mitigation |
|------|------------|
| Hourly cron lag | Ready-for-dispatch grace + recovery after overdue grace |
| Cron outage | Recovery cron + admin Dispatch now |
| False ops alarms | Deferred excluded from `dispatch_not_started` until overdue |
| Cleaner sees early job | No offers until engine runs (by design) |
