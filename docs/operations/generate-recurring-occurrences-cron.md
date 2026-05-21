# Recurring occurrence generation cron

Generates unpaid child bookings (`pending_payment`) for **active** recurring series within the configured horizon (default **45 days**). Idempotent via `bookings (series_id, scheduled_start)` unique index and command idempotency keys.

**Route:** `/api/cron/generate-recurring-occurrences`  
**Service:** `generateRecurringOccurrences()` in `src/features/recurring/generateRecurringOccurrences.ts`

**Recommended schedule:** hourly or every 6 hours (UTC). Hourly is safer for stale `next_occurrence_at` recovery.

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `CRON_SECRET` | Vercel (and local `.env.local`) | Bearer token validated by the Next.js route |
| `RECURRING_GENERATION_RUN_LOGGING` | Optional | Set `false` to disable persisting rows to `recurring_generation_runs` |

Vault secrets for Supabase-scheduled HTTP calls: full HTTPS URL and `cron_secret` matching `CRON_SECRET`.

## Scheduler options

### Option A — Vercel Cron (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-recurring-occurrences",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Ensure `CRON_SECRET` is set in the Vercel project. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when using [Cron Jobs](https://vercel.com/docs/cron-jobs).

### Option B — Supabase `pg_cron` + `pg_net`

After migration `20260521200000_recurring_generation_runs.sql`, register Vault secrets:

```sql
select vault.create_secret(
  'https://YOUR_PRODUCTION_DOMAIN/api/cron/generate-recurring-occurrences',
  'generate_recurring_occurrences_cron_url',
  'URL for recurring occurrence generation HTTP cron'
);
-- cron_secret: reuse existing Vault secret (must match Vercel CRON_SECRET)
```

Example schedule (every 6 hours UTC): `0 */6 * * *`

## Manual trigger

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  "https://YOUR_PRODUCTION_DOMAIN/api/cron/generate-recurring-occurrences"
```

## Expected response shape

```json
{
  "ok": true,
  "runId": "uuid",
  "startedAt": "2026-05-21T12:00:00.000Z",
  "completedAt": "2026-05-21T12:00:01.234Z",
  "durationMs": 1234,
  "status": "success",
  "seriesScanned": 3,
  "created": 2,
  "skippedExisting": 5,
  "skippedAnchor": 0,
  "skippedPaused": 0,
  "skippedCancelled": 0,
  "errors": 0,
  "errorMessages": []
}
```

| Field | Meaning |
|-------|---------|
| `seriesScanned` | Active series processed this run |
| `created` | New child bookings created |
| `skippedExisting` | Duplicate slot skipped (idempotent) |
| `skippedPaused` / `skippedCancelled` | Non-active series skipped when targeted by id |
| `status` | `success` \| `partial` \| `failed` |

## Safety properties

- Requires `CRON_SECRET` (401 without valid secret)
- Only `booking_series.status = active` are scanned in batch mode
- Paused/cancelled series never generate children
- Recurrence dates use Africa/Johannesburg wall-clock (`recurrenceDateEngine.ts`)
- Horizon capped by `RECURRING_GENERATION_HORIZON_DAYS` (45)
- Run logging is append-only; insert failures do not block generation

## Verification

```sql
select id, run_id, status, children_generated, duplicates_skipped, failures_count, completed_at
from recurring_generation_runs
order by completed_at desc
limit 10;
```

```bash
npm run ops:audit:recurring-bookings
npm run ops:soak:recurring-bookings
```

Admin UI: `/admin/recurring/health`

## Related

- Production soak plan: `docs/recurring-production-soak-plan.md`
- Recurring management UI: `/admin/recurring`
