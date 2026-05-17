# Stage 5I-α — Notification Retention Dry-Run Reporter Final Audit

**Date:** 2026-05-17  
**Type:** Audit only — **no code changes**, no destructive cleanup  
**Scope:** Stage **5I-α** — retention eligibility dry-run reporter, cron route, admin panel, soak pg_cron scheduler  
**Related:** [stage-5i-notification-retention-cleanup-design.md](../architecture/stage-5i-notification-retention-cleanup-design.md), [notification-retention-cleanup-cron.md](../operations/notification-retention-cleanup-cron.md), [notification-outbox-worker.md](../operations/notification-outbox-worker.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Cron auth (`CRON_SECRET`) | **Pass** |
| Response `dryRun: true`, `deleted: 0` | **Pass** (success + error paths) |
| No DELETE/UPDATE in reporter | **Pass** (static + tests) |
| Outbox eligibility categories | **Pass** (with documented unsupported-template scope) |
| Protected outbox categories | **Pass** |
| Requeue shield (30d) | **Pass** (with 500-audit cap) |
| Worker runs rollup prerequisite | **Pass** |
| Hourly metrics &gt;13 months count | **Pass** |
| Admin UI dry-run only, no buttons | **Pass** |
| Worker / requeue / RLS unchanged | **Pass** |
| Ops soak runbook + pg_cron | **Pass** |
| Typecheck & targeted tests | **Pass** (19/19) |

**Overall:** Stage **5I-α is complete and safe** as a **read-only** retention visibility slice. It is **appropriate to proceed to Stage 5I-β metrics-only purge design** (and implementation only after the **3–5 day dry-run soak** sign-off in [notification-retention-cleanup-cron.md](../operations/notification-retention-cleanup-cron.md)).

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Cleanup cron requires `CRON_SECRET` | **Pass** | `verifyCronSecret(request)` in `cleanup-notification-retention/route.ts` → 401 when missing/invalid; `route.test.ts`; shared helper `lib/cron/verifyCronSecret.ts` (Bearer or `x-cron-secret`) |
| 2 | Cron returns `dryRun: true` | **Pass** | `reportNotificationRetentionDryRun()` always sets `dryRun: true`; spread into JSON response; TypeScript type `NotificationRetentionDryRunReport` literal; error path also sets `dryRun: true` |
| 3 | Cron returns `deleted: 0` | **Pass** | Hard-coded `deleted: 0` in reporter + error JSON; `route.test.ts` asserts; structured log includes `deleted: 0` |
| 4 | No DELETE / UPDATE in reporter | **Pass** | `reportNotificationRetentionDryRun.ts` — only `select` with `{ count: 'exact', head: true }` or minimal columns; static test forbids `.delete(` / `.update(`; pg_cron migration has no DML on notification tables |
| 5 | `notification_outbox` categories correct | **Pass** | Tiered queries in `reportNotificationRetentionDryRun.ts`; deliverability via `buildDeliverableOutboxTemplateOrFilter()` (same as worker/admin) |
| 6 | Live sent older than 90d counted | **Pass** | `status=sent`, `updated_at < outboxLiveSentBefore` (default 90d), `last_error NOT ILIKE dry_run_sent%`; env `NOTIFICATION_RETENTION_OUTBOX_SENT_DAYS` |
| 7 | Dry-run sent older than 60d counted | **Pass** | `status=sent`, `updated_at < outboxDryRunSentBefore` (default 60d), `last_error ILIKE dry_run_sent%`; env `NOTIFICATION_RETENTION_OUTBOX_DRY_RUN_SENT_DAYS` |
| 8 | Failed older than 365d counted | **Pass** | `status=failed`, deliverable OR filter, `updated_at < outboxFailedExpiredBefore` (default 365d); env `NOTIFICATION_RETENTION_OUTBOX_FAILED_MAX_DAYS` |
| 9 | Unsupported pending older than 180d counted | **Pass** (scoped) | `status=pending`, `created_at < cutoff`, `template IN (booking_draft_created, payment_pending, pending_assignment, cleaner_assigned)`; see **Gap G1** |
| 10 | Pending deliverable / processing / recent failed protected | **Pass** | **Protected:** all deliverable `pending`; all `processing`; deliverable `failed` with `updated_at >=` 365d cutoff (`failedWithinRetention`). **Not** counted as eligible while inside window |
| 11 | Recent requeue shield works | **Pass** | Loads `admin_operational_audit` `notification_requeue` + `success`/`idempotent` + `created_at >=` 30d; `metadata.outboxId`; excludes IDs from live/dry-run sent + failed **eligible** counts; separate `requeueShieldRecent` = outbox rows still present with those IDs |
| 12 | Worker runs require rollup coverage | **Pass** | `loadMetricsHourlyBucketStarts` → `buildUtcHourCoverageSet`; paginated `completed_at` for runs &lt; 90d; `countWorkerRunsRollupEligibility()` — eligible only if UTC hour bucket exists; `protectedMissingRollup` otherwise; unit tests in `notificationRetentionEligibility.test.ts` |
| 13 | Hourly metrics older than 13 months counted | **Pass** | `bucket_start < metricsHourlyBefore` (`subtractMonths(now, 13)`); env `NOTIFICATION_RETENTION_METRICS_MONTHS` |
| 14 | Admin UI dry-run only, no buttons | **Pass** | `AdminNotificationRetentionDryRunPanel` — copy “Dry-run only — no data is deleted”; count cards only; `AdminNotificationRetentionDryRunPanel.test.tsx` — `queryByRole('button')` null |
| 15 | No RLS / worker / requeue behavior changed | **Pass** | No edits to `processNotificationOutbox.ts`, `adminRequeueNotificationOutbox.ts`, or RLS migrations `20260518200000_*` / `20260518210000_*` / `20260518220000_*`; only additive: read model calls reporter, admin page panel, new cron route, soak migration |

---

## Security and non-mutation posture

### Cron route (`/api/cron/cleanup-notification-retention`)

| Control | Implementation |
|---------|----------------|
| Auth | `verifyCronSecret` — fails closed if `CRON_SECRET` unset |
| Data path | `createServiceRoleClient()` → `reportNotificationRetentionDryRun()` only |
| Response | Counts + policy + `oldestEligible` timestamps — **no** row IDs, emails, payloads, `errors` |
| Logging | `notification_retention_dry_run` JSON — `eligible` / `protected` counts only |
| Failure | HTTP 500 still includes `dryRun: true`, `deleted: 0` |

### Reporter (`reportNotificationRetentionDryRun.ts`)

| Table | Operations | Columns touched |
|-------|------------|-----------------|
| `notification_outbox` | `SELECT` count / oldest timestamp | `updated_at`, `created_at` only in oldest helpers; head counts use `*` but no row body returned |
| `notification_worker_runs` | `SELECT` count / `completed_at` pagination | `completed_at` only |
| `notification_metrics_hourly` | `SELECT` `bucket_start` / count | `bucket_start` only |
| `admin_operational_audit` | `SELECT` `metadata` | Read-only; filter `notification_requeue`; **no** insert/update/delete |

**Explicit:** No code path sets `dryRun` or `deleted` from request body — constants only.

### Admin read model

- `getAdminNotificationHealthPage` calls `reportNotificationRetentionDryRun(client, now)` in parallel with existing loads.
- Uses **admin JWT** server client — same SELECT RLS as existing notification health (admin can read outbox, worker runs, metrics, audit).
- Does not expose reporter output on any customer/cleaner route.

### pg_cron soak migration (`20260519103000_notification_retention_dry_run_cron.sql`)

- HTTP POST only via `pg_net` — invokes app dry-run route.
- No SQL `DELETE`/`UPDATE` on notification tables.
- Job: `notification-retention-dry-run-daily` at `15 3 * * *` (03:15 UTC).

---

## Category logic reference

Aligned with [stage-5i-notification-retention-cleanup-design.md](../architecture/stage-5i-notification-retention-cleanup-design.md):

```text
Eligible (outbox)
  live sent      → sent, NOT dry_run_sent%, updated_at < now-90d, NOT in requeue shield
  dry-run sent   → sent, dry_run_sent%, updated_at < now-60d, NOT in requeue shield
  failed expired → failed, deliverable, updated_at < now-365d, NOT in requeue shield
  unsupported    → pending, listed unsupported templates, created_at < now-180d

Protected (outbox)
  pending deliverable → pending + deliverable OR (no age limit)
  processing          → all processing
  failed in window    → failed + deliverable + updated_at >= now-365d
  requeue shield      → outbox rows whose id still exists + recent success/idempotent requeue audit

Worker runs
  olderThanPolicy           → completed_at < now-90d (count)
  eligibleWithRollupCoverage → subset with hourly bucket present
  protectedMissingRollup    → older than 90d but missing bucket

Metrics hourly
  olderThanPolicy → bucket_start < now-13mo
```

**Mutual exclusion (intended):** Active deliverable `pending`/`processing` are never in eligible counts. Deliverable `failed` appears in either `failedOlderThanPolicy` **or** `failedWithinRetention`, not both, by `updated_at` vs 365d cutoff.

---

## Tests and static verification

| Command / suite | Result |
|-----------------|--------|
| `npm run typecheck` | **Pass** |
| `notificationRetentionEligibility.test.ts` | **4/4** — rollup hour coverage math |
| `reportNotificationRetentionDryRun.test.ts` | **2/2** — dry-run shape, no delete/update in source |
| `cleanup-notification-retention/route.test.ts` | **2/2** — 401 without secret; `dryRun`/`deleted`/log event |
| `AdminNotificationRetentionDryRunPanel.test.tsx` | **1/1** — copy, no buttons, no PII in HTML |
| `notificationAdminReadModel.test.ts` | **Pass** (includes `retentionDryRun` on health page) |
| `cronMutationRoutes.test.ts` | **Pass** — allowlists `cleanup-notification-retention/route.ts` |
| `notification-retention-dry-run-cron.migration.test.ts` | **2/2** — job + no notification DML |

**Total targeted:** **19/19** passed (2026-05-17 audit run).

**Gap (non-blocking):** No live-database integration test asserting count accuracy against seeded rows (same posture as 5G / 5H-b). Soak in staging/production validates real counts.

---

## Documentation and operations

| Artifact | Status |
|----------|--------|
| [notification-retention-cleanup-cron.md](../operations/notification-retention-cleanup-cron.md) | Soak table, red flags, sign-off, Vault setup |
| [notification-outbox-worker.md](../operations/notification-outbox-worker.md) | § Retention dry-run + soak pointer |
| [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md) | `/admin/notifications` + soak prerequisite |

---

## Documented gaps (non-blocking for 5I-α sign-off)

| ID | Gap | Risk | Mitigation before 5I-β purge |
|----|-----|------|------------------------------|
| **G1** | Unsupported pending eligible uses **fixed template list** only — unknown non-deliverable `pending` rows not counted | Under-count eligible unsupported backlog | Extend query in 5I-β or accept manual SQL review during soak |
| **G2** | Requeue shield loads max **500** recent audit rows | Rare under-shield if &gt;500 requeues/30d | Raise cap or add SQL subquery in later slice |
| **G3** | Worker rollup coverage loads **all** `bucket_start` rows into memory | Memory at very long history | Acceptable for 5I-α; optimize in purge slice if needed |
| **G4** | Route name `cleanup-notification-retention` sounds destructive | Ops confusion | Docs + response fields emphasize dry-run; rename optional |
| **G5** | No `NOTIFICATION_RETENTION_CLEANUP_ENABLED` kill-switch yet | N/A for 5I-α (always dry-run) | Add in **5I-β implementation**, not required for dry-run |

---

## What was explicitly not in 5I-α (correct)

- `DELETE` / `UPDATE` on any notification table  
- Append-only trigger changes on `notification_worker_runs`  
- RLS policy changes  
- `purgeNotificationRetention` or env-gated destructive mode  
- `notification_retention_runs` cleanup log table  
- Customer/cleaner exposure of retention counts  

---

## Final question: Is 5I-α complete? Safe for 5I-β?

### Is Stage 5I-α complete?

**Yes.** Deliverables for 5I-α are in place:

- Read-only reporter and policy config  
- Cron route (auth, dry-run constants, structured log)  
- Admin **Retention dry-run** section  
- Daily soak pg_cron + ops runbook  
- Tests and typecheck green  

### Safe enough to move to Stage 5I-β metrics-only purge **design**?

**Yes.** The dry-run reporter implements the intended classification rules with no mutation path. **5I-β design** can proceed using this audit and the Stage 5I design doc.

### Safe enough to **implement** 5I-β destructive purge?

**Not until:**

1. **Soak complete** — 3–5 daily dry-run runs, comparison table filled, no red flags ([notification-retention-cleanup-cron.md](../operations/notification-retention-cleanup-cron.md)).  
2. **5I-β implementation slice** — **metrics hourly only first** (13-month `DELETE` via service-role helper + kill-switch + batch limits + `notification_retention_runs` log), still no outbox/worker purge.  
3. **Design review** for purge function, grants, and rollback — separate from 5I-α.

**Recommendation:** Treat **5I-α as signed off for engineering** after migrations are applied and at least one manual/cron dry-run matches admin UI in the target environment. Treat **5I-β implementation** as blocked on **soak sign-off**, not on further 5I-α code work.

---

## Sign-off table

| Role | 5I-α dry-run reporter | 5I-β design | 5I-β metrics purge impl |
|------|----------------------|-------------|-------------------------|
| Engineering | **Ready** | **Proceed** | After soak + 5I-β design |
| Ops | Verify Vault + one dry-run | — | After soak checklist |
| Product | Admin copy acceptable | Review purge impact | After soak |
