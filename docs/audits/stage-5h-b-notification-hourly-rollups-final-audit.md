# Stage 5H-b — Notification Hourly Rollups & 7-Day Trends Final Audit

**Date:** 2026-05-17  
**Type:** Audit only — no code changes  
**Scope:** Stage **5H-b-α/β** — `notification_metrics_hourly`, rollup cron, backfill, 7-day text trends on `/admin/notifications`  
**Related:** [stage-5h-b-notification-hourly-rollups-7-day-trends-design.md](../architecture/stage-5h-b-notification-hourly-rollups-7-day-trends-design.md), [stage-5h-a-notification-analytics-mvp-final-audit.md](./stage-5h-a-notification-analytics-mvp-final-audit.md), [notification-outbox-worker.md](../operations/notification-outbox-worker.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Migration `notification_metrics_hourly` | **Pass** |
| RLS admin SELECT only | **Pass** (static + SQL catalog) |
| Service role insert/update only | **Pass** |
| UTC one-row-per-hour buckets | **Pass** |
| Rollup excludes raw errors / PII | **Pass** |
| Live vs dry-run separation | **Pass** |
| Cron auth + default closed hour | **Pass** |
| Backfill capped + idempotent | **Pass** |
| 7d read model (current vs prior) | **Pass** |
| Text-only trends UI | **Pass** |
| Partial coverage / stale notes | **Pass** |
| Worker / requeue / existing RLS unchanged | **Pass** |
| Ops docs | **Pass** |
| Typecheck & targeted tests | **Pass** (31/31) |

**Overall:** Stage **5H-b is complete and safe** for production use **after** migrations `20260518210000_notification_worker_runs.sql` (5G) and `20260518220000_notification_metrics_hourly.sql` (5H-b) are applied, the hourly rollup cron is scheduled, and backfill has been run (`npm run ops:backfill:notification-metrics`). **Safe to proceed to Stage 5H-c** (sparkline charts from hourly buckets) or **Stage 5I** (retention purge design) as separate slices — each needs its own design review and must preserve the sanitization contract below.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | `notification_metrics_hourly` migration exists | **Pass** | `supabase/migrations/20260518220000_notification_metrics_hourly.sql`; `notification-metrics-hourly.migration.test.ts` (4 tests) |
| 2 | RLS admin SELECT only | **Pass** | `notification_metrics_hourly_select_admin` — `FOR SELECT TO authenticated` + `auth_is_admin()`; no authenticated write policies; `notification_metrics_hourly_rls_phase5h_checks.sql` |
| 3 | Service role insert/update only | **Pass** | `grant insert, update … to service_role`; no `grant insert/update` to `authenticated`; migration test |
| 4 | Hourly buckets UTC, one row per hour | **Pass** | `floorToUtcHour()` / `previousClosedUtcHour()` use `Date.UTC`; `bucket_start` PK; window `[bucket_start, bucket_start + 1h)`; rejects current partial hour |
| 5 | Rollup excludes raw errors / emails / payloads | **Pass** | `WORKER_RUN_ROLLUP_SELECT` omits `errors`; table has no payload/recipient/template columns; cron JSON has counts only; tests assert no `errors` / `@` / `payload` |
| 6 | Live metrics = `delivery_enabled` + `resend` only | **Pass** | `aggregateWorkerRunsToHourlyRow()` lines 91–94; stored as `live_sent_count` / `live_failed_count`; rollup + trends tests |
| 7 | Dry-run metrics separate | **Pass** | `dry_run_count`, `dry_run_provider_run_count`; 7d UI line “separate from live success rate”; 24h dry-run unchanged (5H-a) |
| 8 | Cron requires `CRON_SECRET` | **Pass** | `verifyCronSecret(request)` → 401; `route.test.ts` |
| 9 | Cron defaults to previous closed UTC hour | **Pass** | `resolveRollupBucketStart(null)` → `previousClosedUtcHour()`; test asserts default call with `null` bucket |
| 10 | Backfill capped and idempotent | **Pass** | Max **168** hours (`NOTIFICATION_METRICS_MAX_BACKFILL_HOURS`); cron `backfillHours` capped at **24**/request; upsert `onConflict: bucket_start`; parallel batches of 8 |
| 11 | Read model: current 7d vs prior 7d | **Pass** | `loadNotificationTrends7d()` — 14d bucket query; `partitionMetricsBucketsByTrendWindow()` + `computeTrends7dFromHourlyBuckets()`; read-model tests |
| 12 | UI text-only trends, no charts | **Pass** | `AdminNotificationAnalyticsPanel` — `<ul>` text lines only; no chart libs; `AdminNotificationAnalyticsPanel.test.tsx` |
| 13 | Partial coverage / stale rollup notes | **Pass** | `partialCoverageNote` when coverage &lt; 90% of 168h; `rollupStale` when `rollupAsOf` &gt; 2h old; UI renders both; unit tests |
| 14 | No worker / requeue / existing RLS changed | **Pass** | 5H-b adds new table + cron + read/UI only; no edits to `processNotificationOutbox.ts`, requeue modules, or `notification_outbox` / `notification_worker_runs` RLS migrations |
| 15 | Docs explain cron / backfill / trends | **Pass** | `notification-outbox-worker.md` § Hourly metrics rollup; `admin-operational-dashboard.md` § 5H-b rows |

---

## Schema and RLS

**Migration:** `supabase/migrations/20260518220000_notification_metrics_hourly.sql`

| Property | Value |
|----------|--------|
| Table | `public.notification_metrics_hourly` |
| Primary key | `bucket_start timestamptz` (one row per UTC hour) |
| Columns | Integer counters only — no `errors`, `payload`, `recipient`, `template` |
| RLS | Enabled; `notification_metrics_hourly_select_admin` only |
| Grants | `SELECT` → `authenticated`, `service_role`; `INSERT`, `UPDATE` → `service_role` only |
| Mutability | Upsert by `service_role` (recomputable buckets — **not** append-only) |

**Post-deploy verification (manual):**

```bash
psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f supabase/tests/notification_metrics_hourly_rls_phase5h_checks.sql
```

**Gap (non-blocking):** No live JWT integration test for `notification_metrics_hourly` (same posture as 5G / 5H-a). Static migration + SQL catalog tests cover policy shape.

---

## Rollup pipeline

```text
notification_worker_runs (completed_at in hour window)
  → SELECT ok, delivery_enabled, email_provider, counters (no errors)
  → aggregateWorkerRunsToHourlyRow()
  → UPSERT notification_metrics_hourly ON bucket_start
```

| Rule | Implementation |
|------|----------------|
| Closed hour only | Default bucket = `previousClosedUtcHour(now)`; explicit `bucketStart` rejected if current partial hour |
| Live subset | `live_sent_count` / `live_failed_count` only when `delivery_enabled && email_provider === 'resend'` |
| Dry-run | `dry_run_count` + `dry_run_provider_run_count` separate |
| Idempotent | Same `bucket_start` upsert replaces row |

**Cron route:** `GET/POST /api/cron/rollup-notification-metrics`

| Response field | Safe? |
|----------------|-------|
| `bucketStart`, `runCount`, `liveSent`, `liveFailed`, `dryRun`, `upserted` | Yes |
| Raw errors / emails | **Absent** |

---

## 7-day trends (read model + UI)

**Query:** `METRICS_HOURLY_TRENDS_SELECT` — seven counter columns + `bucket_start` only (14-day window).

**Computed fields (`AdminNotificationTrends7d`):**

| Field | Definition |
|-------|------------|
| `sent7dTotal` / `sent7dPriorTotal` | Sum `sent_count` in current vs prior 7d windows |
| `failed7dTotal` / `failed7dPriorTotal` | Sum `failed_count` (row failures in batches) |
| `liveSuccessRate7dPercent` | `sum(live_sent) / (sum(live_sent) + sum(live_failed))` per window |
| `dryRun7dTotal` | Sum `dry_run_count` (current 7d only) |
| `runCount7dTotal` | Sum `run_count` |
| Deltas | % change vs prior week (null if prior = 0); live rate as **points** delta |
| `rollupAsOf` | Latest `bucket_start` in loaded set |
| `coverageHours7d` | Count of buckets in current 7d window |
| `partialCoverageNote` | Shown when coverage &lt; 151 of 168 hours (~90%) |
| `rollupStale` | Latest bucket older than 2 hours |

**5H-a preserved:** 24h worker cards still computed **live** from `notification_worker_runs` (not from rollups) — avoids drift at hour boundaries during the transition.

---

## Backfill

| Mechanism | Cap | Idempotent |
|-----------|-----|------------|
| `npm run ops:backfill:notification-metrics` | 168 hours (env `NOTIFICATION_METRICS_BACKFILL_HOURS`) | Yes (upsert) |
| Cron `?backfillHours=N` or POST body | 24 per request | Yes |
| Concurrency | 8 (env `NOTIFICATION_METRICS_BACKFILL_CONCURRENCY`) | — |

CLI test timeout **180s** for full 168-hour backfill (fixed from 5s default).

---

## Security posture (unchanged boundaries)

| Asset | 5H-b change |
|-------|-------------|
| `notification_outbox` | **None** |
| `notification_worker_runs` | **None** (read-only for rollup) |
| `notification_metrics_hourly` | **New** — admin SELECT, service_role upsert |
| Worker delivery | **None** |
| Admin requeue | **None** |
| Browser surfaces | Server read model only; trends DTO is numeric + ISO timestamps |

---

## Test execution

Commands run on **2026-05-17**:

```bash
npm run typecheck
# exit 0

npx vitest run \
  src/tests/database/notification-metrics-hourly.migration.test.ts \
  src/tests/security/notificationMetricsHourlyRlsPhase5hPolicy.test.ts \
  src/features/notifications/server/rollupNotificationMetricsHourly.test.ts \
  src/features/notifications/server/notificationTrends7d.test.ts \
  src/app/api/cron/rollup-notification-metrics/route.test.ts \
  src/features/notifications/server/notificationAdminReadModel.test.ts \
  src/components/dashboard/AdminNotificationAnalyticsPanel.test.tsx \
  src/app/api/cron/cronMutationRoutes.test.ts
# 8 files, 31 tests passed
```

| Bundle | Tests |
|--------|-------|
| Migration + RLS catalog | 6 |
| Rollup aggregates + backfill | 6 |
| 7d trends pure functions | 5 |
| Cron route | 4 |
| Admin read model (incl. trends) | 7 |
| Analytics panel UI | 2 |
| Cron route allowlist | 1 |
| **Total** | **31 passed** |

---

## Production checklist

1. Apply `20260518210000_notification_worker_runs.sql` (5G) if not already applied.
2. Apply `20260518220000_notification_metrics_hourly.sql` (5H-b).
3. Run `notification_metrics_hourly_rls_phase5h_checks.sql` on the target database.
4. Schedule hourly cron: `POST /api/cron/rollup-notification-metrics` at **:05** UTC.
5. Run `npm run ops:backfill:notification-metrics` once after deploy.
6. Confirm `/admin/notifications` shows 7-day trends without persistent partial-coverage note (after backfill + a few cron cycles).

---

## Stage 5H-b vs next stages

| Stage | Scope | Ready after 5H-b? |
|-------|--------|-------------------|
| **5H-c** | Sparkline charts from `notification_metrics_hourly` | **Yes** — design/implement with same DTO rules (no raw series with PII) |
| **5H-b-γ** (optional) | Hourly outbox queue snapshots | Deferred — not in 5H-b |
| **5I** | Retention purge (`notification_metrics_hourly`, worker_runs, outbox) | **Yes** for **design** — purge job not implemented; 13-month rollup retention documented in parent 5H design |

---

## Final question

### Is Stage 5H-b complete and safe enough to move to Stage 5H-c charts or Stage 5I retention design?

**Yes.**

- Hourly rollups and 7-day text trends meet the design slice: persisted worker counters, sanitized cron/read/UI paths, live vs dry-run separation, and no regression to worker delivery, requeue, or existing RLS.
- Automated tests and typecheck pass for the 5H-b bundle.
- Ops docs cover migration, cron, backfill, and trend definitions.

**Choose next work by priority:**

- **5H-c** when operators need visual trends — reuse `notification_metrics_hourly`; do not expose hourly arrays with forbidden fields to the client; add chart-specific audit.
- **5I** when storage growth matters — design `service_role` purge for rollups (and optionally worker_runs/outbox) without touching admin SELECT policies.

Neither 5H-c nor 5I should ship without the production checklist above on each environment.
