# Stage 5G-a — Notification Worker Run Logging Final Audit

**Date:** 2026-05-17  
**Type:** Audit only — no code changes  
**Scope:** Stage 5G-a — durable `notification_worker_runs` log, cron instrumentation, admin last-run health card  
**Related:** [stage-5g-notification-worker-run-logging-cron-health-design.md](../architecture/stage-5g-notification-worker-run-logging-cron-health-design.md), [notification-outbox-worker.md](../operations/notification-outbox-worker.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md), [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| `notification_worker_runs` table (migration) | **Pass** (static) |
| RLS admin SELECT only | **Pass** (static + SQL catalog) |
| Service role INSERT only | **Pass** (static) |
| Authenticated admin write blocked | **Pass** (static; no JWT integration block yet) |
| Append-only trigger | **Pass** (static) |
| Cron records run on success | **Pass** (route test) |
| Cron returns worker JSON if logging fails | **Pass** (fail-soft helper + route try/catch + route test) |
| `dryRunPreviews` not persisted | **Pass** (helper + unit test) |
| Errors sanitized/capped | **Pass** (helper + unit test) |
| Manual trigger header → `manual` | **Pass** (helper + route test) |
| `/admin/notifications` last-run card | **Pass** (page + read model test) |
| Health states unknown/healthy/warning/critical | **Pass** (unit tests) |
| Worker delivery unchanged | **Pass** (`processNotificationOutbox` unmodified; 28/28 tests) |
| Docs: freshness thresholds | **Pass** |
| Rollback documented | **Pass** |
| `notification_outbox` RLS unchanged | **Pass** |
| Typecheck & targeted tests | **Pass** (58/58 bundled 5G + worker) |

**Overall:** Stage **5G-a** is **safe to deploy and close** provided migration `20260518210000_notification_worker_runs.sql` is applied **before or with** the app deploy. Apply the migration on every environment; re-run `notification_worker_runs_rls_phase5g_checks.sql` after promotion. Optional follow-up: add RLS integration cases for `notification_worker_runs` (mirrors 5F).

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | `notification_worker_runs` table exists | **Pass** (migration) | `supabase/migrations/20260518210000_notification_worker_runs.sql` — columns, indexes, comments; `notification-worker-runs.migration.test.ts` (6 tests) |
| 2 | RLS admin SELECT only | **Pass** | `notification_worker_runs_select_admin` `FOR SELECT TO authenticated` + `auth_is_admin()`; no other policies; `notificationWorkerRunsRlsPhase5gPolicy.test.ts` |
| 3 | Service role INSERT only | **Pass** | `grant insert … to service_role`; no `grant insert` to `authenticated`; migration test |
| 4 | Authenticated admin cannot INSERT/UPDATE/DELETE | **Pass** (static) | No write/`ALL` policies for `authenticated`; SQL catalog `notification_worker_runs_rls_phase5g_checks.sql` asserts no authenticated write policies. **Not** covered by `rls-policies.integration.test.ts` yet |
| 5 | Append-only trigger blocks UPDATE/DELETE | **Pass** | `notification_worker_runs_append_only` → `forbid_admin_operational_audit_mutation()`; SQL catalog + migration test |
| 6 | Cron route records run on success | **Pass** | `route.ts` calls `recordNotificationWorkerRun` after `processNotificationOutbox`; `route.test.ts` asserts `recordWorkerRunMock` called with `ok: true` |
| 7 | Cron still returns worker result if logging fails | **Pass** | `recordNotificationWorkerRun` never throws (try/catch inside); route wraps persist in try/catch; `route.test.ts` — `recordWorkerRunMock.mockRejectedValue` → HTTP 200 + `sent: 1` |
| 8 | `dryRunPreviews` not persisted | **Pass** | Insert row built from typed counters only — no `dryRunPreviews` key; `recordNotificationWorkerRun.test.ts` |
| 9 | Errors sanitized/capped | **Pass** | Max 10 entries, message ≤200 chars, email regex stripped; only `outboxId`, `code`, `message`; `sanitizeWorkerRunErrors` tests |
| 10 | Manual header → `trigger_source = manual` | **Pass** | `parseNotificationWorkerTriggerSource` — `x-cron-invoke-source: manual`; unit + route tests |
| 11 | `/admin/notifications` shows last-run card | **Pass** | `AdminNotificationWorkerHealthCard` on `page.tsx`; `getAdminNotificationHealthPage` loads `workerHealth` |
| 12 | Health states work | **Pass** | `computeWorkerRunHealth` — unknown (no row), healthy ≤10m, warning ≤15m, critical >15m; `computeWorkerRunHealth.test.ts` (4 tests); read model maps to `AdminNotificationWorkerHealthModel` |
| 13 | Worker delivery unchanged | **Pass** | No edits to `processNotificationOutbox.ts` (no `recordNotificationWorkerRun` import); `processNotificationOutbox.test.ts` **28/28** |
| 14 | Docs include cron freshness thresholds | **Pass** | `notification-outbox-worker.md` § Worker run logging — 10/15 min table; `admin-operational-dashboard.md` worker health row |
| 15 | Rollback documented | **Pass** | `rls-tightening-rollbacks.md` Phase 5G-a — drop table/policies/trigger; `NOTIFICATION_WORKER_RUN_LOGGING=false` note |

---

## Schema and RLS (migration artifact)

**Migration:** `supabase/migrations/20260518210000_notification_worker_runs.sql`

| Property | Value |
|----------|--------|
| Table | `public.notification_worker_runs` |
| RLS | Enabled |
| Policies | `notification_worker_runs_select_admin` (`SELECT`, `authenticated`, `auth_is_admin()`) |
| Grants | `SELECT` → `authenticated`, `service_role`; `INSERT` → `service_role` only |
| Append-only | `notification_worker_runs_append_only` (shared forbid function) |
| Indexes | `completed_at desc`, `(ok, completed_at desc)`, `(trigger_source, completed_at desc)` |

**Admin read model** selects counters and metadata only — **`errors` jsonb is not loaded** into the UI DTO (`WORKER_RUN_SELECT` omits `errors`), so raw error payloads never reach the browser.

---

## Cron instrumentation

| Path | Behavior | Delivery impact |
|------|----------|-----------------|
| `GET/POST /api/cron/process-notification-outbox` | After worker: persist one row; return same JSON as pre-5G | **None** — worker called first; response shape unchanged |
| `401` / `503` | No run row inserted | None |
| Worker throw (`500`) | Inserts `ok: false` row then returns 500 | Delivery failed as before; logging is additive |
| `NOTIFICATION_WORKER_RUN_LOGGING=false` | Skip insert | None |

**Write surface:** Only `recordNotificationWorkerRun.ts` inserts into `notification_worker_runs` (cron route). No worker/enqueue/requeue paths touch the table.

---

## Admin UI

| Element | Implementation |
|---------|----------------|
| Route | `/admin/notifications` |
| Component | `AdminNotificationWorkerHealthCard` |
| Data | `loadLatestNotificationWorkerHealth` — latest row by `completed_at desc` |
| Shown | Time, health badge, counters, delivery snapshot, trigger source |
| Hidden | `errors` jsonb, emails, `dryRunPreviews` |
| Not implemented (by design) | Recent runs table, cron trigger button |

---

## Security and data minimization

| Data | Persisted? | Shown in UI? |
|------|------------|--------------|
| Aggregate counters | Yes | Yes |
| `email_provider`, `delivery_enabled` snapshot | Yes | Yes |
| Capped `errors` jsonb | Yes (DB only) | No |
| Email addresses | Stripped before insert | No |
| `dryRunPreviews` | No | No |
| Outbox `payload` / recipient | No | No |

**Residual risk:** Compromised admin JWT can `SELECT` capped `errors` via PostgREST directly (same class as outbox `last_error`). Acceptable for ops-only table.

---

## Test execution summary

| Command / suite | Result |
|-----------------|--------|
| `npm run typecheck` | **Pass** |
| `recordNotificationWorkerRun.test.ts` | **8/8** |
| `computeWorkerRunHealth.test.ts` | **4/4** |
| `process-notification-outbox/route.test.ts` | **4/4** |
| `notificationAdminReadModel.test.ts` | **5/5** |
| `processNotificationOutbox.test.ts` | **28/28** |
| `notification-worker-runs.migration.test.ts` | **6/6** |
| `notificationWorkerRunsRlsPhase5gPolicy.test.ts` | **2/2** |
| **Bundled 5G + worker (7 files)** | **58/58** |
| `rls-policies.integration.test.ts` | **51/51** — no `notification_worker_runs` cases (pre-existing suite; not a regression) |

**Catalog SQL (post-migration):**

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/notification_worker_runs_rls_phase5g_checks.sql
```

---

## Deploy prerequisites and risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| App deployed before migration | **High** | `/admin/notifications` calls `from("notification_worker_runs")` — missing table fails the page. **Apply migration first** |
| Migration applied, no cron yet | Low | Card shows **unknown** — expected until first cron |
| Persist fails (DB/permissions) | Low | Cron delivery continues; log `notification_worker_run_persist_failed` |
| No RLS JWT integration tests for new table | Low | Static migration + SQL catalog; add integration block in 5G-b if desired |
| `ok=true` on success path even when `failed > 0` | Info | `ok` means route completed, not zero row failures — use counters + outbox filters |

**Out of scope (correctly deferred):** Recent runs table, retention job, env-tunable stale minutes, cron-from-UI.

---

## Behavior inventory (unchanged)

| Path | 5G-a change |
|------|-------------|
| `processNotificationOutbox` | **None** |
| `reclaimStaleProcessingNotifications` | **None** |
| Enqueue (`supabaseBookingCommandBackend`) | **None** |
| Admin requeue (`adminRequeueNotificationOutbox`) | **None** |
| `notification_outbox` RLS (5F) | **None** |
| Cron HTTP response body | **Unchanged** (still includes `dryRunPreviews` in response only) |

---

## Final question: Is Stage 5G-a safe to deploy and close?

**Yes**, with one hard gate:

1. **Apply** `20260518210000_notification_worker_runs.sql` on the target Supabase project before enabling the app build that includes 5G-a.
2. **Verify** with `supabase/tests/notification_worker_runs_rls_phase5g_checks.sql`.
3. **Smoke:** One manual cron (`curl` + `CRON_SECRET`); confirm a row appears and `/admin/notifications` shows healthy/unknown appropriately.

After migration + smoke, Stage 5G-a is **complete and safe to close**. Optional 5G-b (recent runs table, RLS integration block, read-model fail-soft if table missing) is not required for closure.
