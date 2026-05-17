# Notification retention dry-run cron (Stage 5I-α soak)

Daily eligibility counts for notification operational tables. **This route never deletes or updates rows** (`dryRun: true`, `deleted: 0`).

Use this cron for a **soak period** (minimum **3–5 consecutive daily runs**) before enabling any destructive cleanup in Stage 5I-β+.

**App route:** `POST /api/cron/cleanup-notification-retention`  
**Scheduler:** Supabase Cron (`pg_cron` + `pg_net`) — job `notification-retention-dry-run-daily` at **03:15 UTC**  
**Design:** [stage-5i-notification-retention-cleanup-design.md](../architecture/stage-5i-notification-retention-cleanup-design.md)

---

## What this cron does (and does not do)

| Does | Does not |
|------|----------|
| Count eligible rows per retention category | `DELETE` or `UPDATE` any table |
| Count protected outbox rows | Touch `admin_operational_audit` or `booking_state_audit` |
| Log structured JSON to Vercel (`notification_retention_dry_run`) | Change worker, requeue, or RLS |
| Mirror counts on `/admin/notifications` (Retention dry-run section) | Enable destructive purge |

---

## Environment and Vault

| Secret / variable | Where | Purpose |
|-------------------|--------|---------|
| `CRON_SECRET` | Vercel + `.env.local` | Bearer token for the Next.js route |
| Vault `cron_secret` | Supabase Vault | **Must match** `CRON_SECRET` (shared with other crons) |
| Vault `cleanup_notification_retention_cron_url` | Supabase Vault | Full URL, e.g. `https://your-app.vercel.app/api/cron/cleanup-notification-retention` |

After migration `20260519103000_notification_retention_dry_run_cron.sql`, create the URL secret once (reuse existing `cron_secret` if already set):

```sql
select vault.create_secret(
  'https://YOUR_PRODUCTION_DOMAIN/api/cron/cleanup-notification-retention',
  'cleanup_notification_retention_cron_url',
  'Daily dry-run URL for notification retention eligibility (5I-α soak)'
);
```

---

## Manual trigger

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source":"manual"}' \
  "https://YOUR_PRODUCTION_DOMAIN/api/cron/cleanup-notification-retention" | jq .
```

**From SQL (same as scheduled job):**

```sql
select public.invoke_notification_retention_dry_run_http();
```

**Verify job registered:**

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'notification-retention-dry-run-daily';
```

Expected schedule: `15 3 * * *` (03:15 UTC daily).

---

## Soak procedure (before 5I-β destructive cleanup)

### 1. Prerequisites

- [ ] Stage **5I-α** deployed (dry-run route + admin Retention dry-run panel).
- [ ] Migration `20260519103000_notification_retention_dry_run_cron.sql` applied.
- [ ] Vault `cleanup_notification_retention_cron_url` + `cron_secret` configured.
- [ ] Hourly metrics rollup cron healthy (worker runs need buckets for “rollup-covered” counts).

### 2. Run daily for 3–5 days

Let **pg_cron** invoke the route automatically, or run the manual `curl` once per day at a consistent time.

Record each run in the table below (from JSON response, Vercel logs, or admin UI).

### 3. Comparison table (copy per environment)

| Date (UTC) | `asOf` | Live sent eligible | Dry-run sent eligible | Failed expired eligible | Unsupported pending eligible | Worker runs eligible (rollup) | Worker runs protected (no rollup) | Metrics hourly eligible | Pending deliverable (protected) | Processing (protected) | Failed within retention (protected) | Requeue shield (protected) |
|------------|--------|--------------------|-----------------------|-------------------------|------------------------------|-------------------------------|-------------------------------------|-------------------------|--------------------------------|------------------------|--------------------------------------|---------------------------|
| Day 1 | | | | | | | | | | | | |
| Day 2 | | | | | | | | | | | | |
| Day 3 | | | | | | | | | | | | |
| Day 4 | | | | | | | | | | | | |
| Day 5 | | | | | | | | | | | | |

**JSON paths** (cron response):

- `eligible.outbox.liveSentOlderThanPolicy`
- `eligible.outbox.dryRunSentOlderThanPolicy`
- `eligible.outbox.failedOlderThanPolicy`
- `eligible.outbox.unsupportedPendingOlderThanPolicy`
- `eligible.workerRuns.eligibleWithRollupCoverage`
- `eligible.workerRuns.protectedMissingRollup`
- `eligible.metricsHourly.olderThanPolicy`
- `protected.outbox.pendingDeliverable`
- `protected.outbox.processing`
- `protected.outbox.failedWithinRetention`
- `protected.outbox.requeueShieldRecent`

**Vercel log filter:** `notification_retention_dry_run` (structured `console.warn` from the cron route).

### 4. Expected trends (normal)

| Category | Typical soak behavior |
|----------|------------------------|
| Live / dry-run sent eligible | Stable or **slow increase** as terminal rows age past 60–90d |
| Unsupported pending eligible | Stable or slow increase if old enqueue-only rows accumulate |
| Failed expired eligible | Often **0** until rows are older than 365d |
| Worker runs eligible | Grows with cron history; **protected (no rollup)** should trend **down** as hourly backfill completes |
| Metrics hourly eligible | **0** until buckets are older than 13 months |
| Protected pending deliverable / processing | Track current queue — should match ops intuition, not crash to 0 without explanation |
| Requeue shield | Small; spikes after admin requeue activity |

### 5. Red flags — stop and investigate before 5I-β

| Signal | Likely issue |
|--------|----------------|
| `deleted` ≠ `0` or `dryRun` ≠ `true` | Wrong route/version deployed — **do not proceed** |
| Protected **pending deliverable** drops sharply day-over-day | Classification bug or accidental data change |
| **Failed within retention** drops while failed queue on UI is unchanged | Count/query mismatch |
| Worker **eligible** ≫ **olderThanPolicy** | Logic bug |
| Large **worker runs protected (no rollup)** for many days | Rollup cron failing — fix 5H-b before purging runs later |
| Unsupported pending eligible jumps without old backlog | Template filter wrong |
| Admin UI counts ≠ cron JSON for same `asOf` window | Read-model drift — fix before destructive slice |

### 6. Sign-off checklist (soak complete)

- [ ] At least **3** daily runs captured and compared.
- [ ] Every response has `"dryRun": true` and `"deleted": 0`.
- [ ] No red flags above.
- [ ] Protected counts align with `/admin/notifications` queue health.
- [ ] Team agrees eligible categories match policy (90d / 60d / 365d / 180d / 90d+rollup / 13mo).
- [ ] Explicit decision logged: **proceed to 5I-β** (metrics-only purge first) or extend soak.

**Do not enable destructive cleanup** until this sign-off is complete.

---

## Response shape (reference)

```json
{
  "ok": true,
  "dryRun": true,
  "deleted": 0,
  "asOf": "2026-05-17T03:15:01.234Z",
  "policy": {
    "outboxLiveSentDays": 90,
    "outboxDryRunSentDays": 60,
    "outboxFailedMaxDays": 365,
    "outboxUnsupportedPendingDays": 180,
    "workerRunsDays": 90,
    "metricsMonths": 13,
    "requeueShieldDays": 30
  },
  "eligible": { "outbox": { ... }, "workerRuns": { ... }, "metricsHourly": { ... } },
  "protected": { "outbox": { ... } },
  "oldestEligible": { ... }
}
```

---

## Rollback / disable soak cron

**Disable scheduling only** (keeps function; stops daily HTTP):

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = 'notification-retention-dry-run-daily';
```

Manual dry-run via `curl` remains available. No data is mutated by this route.

---

## Related docs

- [notification-outbox-worker.md](./notification-outbox-worker.md) — worker + retention overview
- [admin-operational-dashboard.md](./admin-operational-dashboard.md) — `/admin/notifications`
