# Deferred assignment dispatch cron

Dispatches post-payment assignment for **confirmed, paid** bookings whose `assignment_dispatch_at` window has opened. Calls `runAssignmentAfterPayment` only — never creates offers outside the assignment engine.

**Route:** `GET|POST /api/cron/dispatch-deferred-assignments`

**Scheduler:** Supabase Cron (`pg_cron` + `pg_net`), hourly by default. See migration `20260528120000_deferred_dispatch_phase2_ops.sql`.

**Feature flag:** `DEFERRED_ASSIGNMENT_ENABLED` must be `true` for bookings to be deferred at payment time. The cron route is safe to schedule while the flag is off (no candidates without `assignment_dispatch_at`).

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `CRON_SECRET` | Vercel / `.env.local` | Bearer token validated by the route |
| Vault `cron_secret` | Supabase Vault | **Must match** `CRON_SECRET` |
| Vault `dispatch_deferred_assignments_cron_url` | Supabase Vault | Full URL, e.g. `https://your-app.vercel.app/api/cron/dispatch-deferred-assignments` |
| `DEFERRED_DISPATCH_OVERDUE_GRACE_MINUTES` | Optional app env | Default `60` — ops “overdue” threshold after `assignment_dispatch_at` |
| `DEFERRED_DISPATCH_CRON_RUN_LOGGING` | Optional | Set `false` to disable persisting rows to `deferred_dispatch_cron_runs` |

## One-time Vault setup (after migration)

```sql
select vault.create_secret(
  'https://YOUR_PRODUCTION_DOMAIN/api/cron/dispatch-deferred-assignments',
  'dispatch_deferred_assignments_cron_url',
  'URL for hourly deferred assignment dispatch HTTP cron'
);

-- Reuse existing cron_secret if already created for other crons
select vault.create_secret(
  'YOUR_CRON_SECRET',
  'cron_secret',
  'Bearer token for deferred dispatch cron routes'
);
```

## Manual invocation

**Deployed app (recommended):**

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -H "x-cron-invoke-source: manual" \
  "https://YOUR_PRODUCTION_DOMAIN/api/cron/dispatch-deferred-assignments"
```

**Local:**

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  "http://localhost:3000/api/cron/dispatch-deferred-assignments"
```

**SQL (same as scheduled job):**

```sql
select public.invoke_dispatch_deferred_assignments_http();
```

## Expected response (200)

```json
{
  "ok": true,
  "ranAt": "2026-05-28T12:00:00.000Z",
  "candidateCount": 2,
  "attemptedCount": 2,
  "dispatchedCount": 1,
  "skippedCount": 0,
  "failedCount": 1,
  "dispatchedBookingIds": ["uuid-1"],
  "skippedBookingIds": [],
  "failed": [{ "bookingId": "uuid-2", "code": "STILL_CONFIRMED", "message": "..." }]
}
```

| Field | Meaning |
|-------|---------|
| `candidateCount` | Rows returned by candidate query (max 50 per run) |
| `attemptedCount` | Bookings that passed re-check and called the engine |
| `dispatchedCount` | Bookings that left `confirmed` after success |
| `skippedBookingIds` | No longer eligible (offer opened, paid removed, etc.) |
| `failed` | Per-booking engine errors; **does not abort the batch** |

**401** — missing/invalid `CRON_SECRET`.

## Staging verification

1. Apply migration `20260528120000_deferred_dispatch_phase2_ops.sql`.
2. Set Vault secrets pointing at **staging** URL.
3. Manual curl with staging `CRON_SECRET`; confirm `ok: true` and row in `deferred_dispatch_cron_runs`.
4. Run scenarios in [deferred-assignment-staging-verification.md](./deferred-assignment-staging-verification.md).

## Production schedule recommendation

| Phase | Schedule | Notes |
|-------|----------|-------|
| Initial rollout | `0 * * * *` (hourly) | Bundled in migration |
| After monitoring | Consider `*/15 * * * *` | Only after stable metrics and low overdue count |

Do **not** enable `DEFERRED_ASSIGNMENT_ENABLED` in production until [deferred-assignment-production-enablement.md](./deferred-assignment-production-enablement.md) is complete.

## Verify scheduling

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'dispatch-deferred-assignments-hourly';
```

## Rollback

```sql
update cron.job set active = false where jobname = 'dispatch-deferred-assignments-hourly';
```

Set `DEFERRED_ASSIGNMENT_ENABLED=false` in Vercel. Existing `assignment_dispatch_at` values are harmless; immediate dispatch resumes for new payments.

## Related

- [assignment-recovery.md](./assignment-recovery.md) — recovery for stuck **non-deferred** paid bookings; excludes future deferred windows
- Admin **Dispatch now** — `POST /api/admin/bookings/:bookingId/dispatch-deferred-assignment`
- Admin diagnostics — `/admin/assignments` page and `GET /api/admin/assignments/deferred-diagnostics`
