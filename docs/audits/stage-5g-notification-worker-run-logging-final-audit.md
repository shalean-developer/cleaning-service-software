# Stage 5G — Notification Worker Run Logging & Cron Health Final Audit

**Date:** 2026-05-17  
**Type:** Audit only — no code changes  
**Scope:** Stage 5G (5G-a + 5G-b) — `notification_worker_runs`, cron instrumentation, last-run health card, recent runs table  
**Related:** [stage-5g-notification-worker-run-logging-cron-health-design.md](../architecture/stage-5g-notification-worker-run-logging-cron-health-design.md), [stage-5g-a-notification-worker-run-logging-final-audit.md](./stage-5g-a-notification-worker-run-logging-final-audit.md), [notification-outbox-worker.md](../operations/notification-outbox-worker.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md), [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| `notification_worker_runs` table (migration) | **Pass** (static) |
| RLS admin SELECT only | **Pass** (static + SQL catalog) |
| Service role INSERT only | **Pass** (static) |
| Append-only protection | **Pass** (static) |
| Cron records worker run | **Pass** (route + unit tests) |
| Cron response survives logging failure | **Pass** (fail-soft + route try/catch) |
| Last-run health card | **Pass** |
| Health states (unknown / healthy / warning / critical) | **Pass** (unit tests) |
| Recent runs table (15, newest first) | **Pass** |
| Admin read model / UI omit raw errors & PII | **Pass** |
| No cron trigger from admin UI | **Pass** |
| Worker delivery unchanged | **Pass** |
| Docs (logging, thresholds, read-only policy) | **Pass** |
| Typecheck & targeted tests | **Pass** (39/39 Stage 5G bundles) |

**Overall:** Stage **5G is complete and safe** for production use **after** migration `20260518210000_notification_worker_runs.sql` is applied on every environment. Admin observability is read-only; writes remain cron-only via service role. **Safe to proceed to Stage 5H** (notification analytics/metrics design) — 5H should treat `notification_worker_runs` as a read-only metrics source and must not widen admin exposure of stored `errors` JSON without a new sanitization review.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | `notification_worker_runs` table exists | **Pass** | `supabase/migrations/20260518210000_notification_worker_runs.sql`; `notification-worker-runs.migration.test.ts` (6 tests) |
| 2 | RLS admin SELECT only | **Pass** | `notification_worker_runs_select_admin` — `FOR SELECT TO authenticated` + `auth_is_admin()`; no other policies; `notificationWorkerRunsRlsPhase5gPolicy.test.ts` |
| 3 | Service role INSERT only | **Pass** | `grant insert on public.notification_worker_runs to service_role`; no `grant insert` to `authenticated`; migration test |
| 4 | Append-only protection | **Pass** | `notification_worker_runs_append_only` → `forbid_admin_operational_audit_mutation()`; `notification_worker_runs_rls_phase5g_checks.sql` |
| 5 | Cron records worker run result | **Pass** | `route.ts` calls `recordNotificationWorkerRun` after success and on worker throw; `route.test.ts` — `ok: true` / `ok: false` paths; **401/503 do not insert** |
| 6 | Cron response works if logging fails | **Pass** | `recordNotificationWorkerRun` never throws; route wraps persist in try/catch; `route.test.ts` — rejected mock → HTTP 200 + `sent: 1` |
| 7 | Last-run health card works | **Pass** | `AdminNotificationWorkerHealthCard` on `/admin/notifications`; `loadLatestNotificationWorkerHealth`; `notificationAdminReadModel.test.ts` |
| 8 | Health states: unknown / healthy / warning / critical | **Pass** | `computeWorkerRunHealth` — null → unknown; ≤10m healthy; 10–15m warning; >15m critical; `computeWorkerRunHealth.test.ts` (4 tests) |
| 9 | Recent runs table shows latest 15 | **Pass** | `RECENT_WORKER_RUNS_LIMIT = 15`; `loadRecentNotificationWorkerRuns`; read-model test asserts `limit(15)` |
| 10 | Recent runs sorted newest first | **Pass** | `.order("completed_at", { ascending: false })`; read-model test asserts order call |
| 11 | Raw errors not exposed in UI/read model | **Pass** | `WORKER_RUN_SELECT` omits `errors`; `mapNotificationWorkerRunForAdmin` has no errors field; component tests assert no `errors` / `@` in HTML |
| 12 | Emails / provider payloads not exposed | **Pass** | No recipient columns in table; insert row excludes `dryRunPreviews`; admin DTOs counters + provider enum only; `sanitizeWorkerRunErrors` strips emails before DB persist |
| 13 | No cron trigger button | **Pass** | No `<button` in worker health or recent-runs components; admin dashboard docs state “do not trigger cron from UI”; grep clean on notification admin components |
| 14 | Worker behavior unchanged | **Pass** | `processNotificationOutbox.ts` has no `notification_worker_runs` / `recordNotificationWorkerRun` imports; instrumentation isolated to cron route |
| 15 | Docs explain logging and thresholds | **Pass** | `notification-outbox-worker.md` § Worker run logging — write path, 10/15 min freshness, 5G-b recent table, deferred retention; `admin-operational-dashboard.md` rows for 5G-a/5G-b |

---

## Schema and RLS

**Migration:** `supabase/migrations/20260518210000_notification_worker_runs.sql`

| Property | Value |
|----------|--------|
| Table | `public.notification_worker_runs` |
| RLS | Enabled |
| Policies | `notification_worker_runs_select_admin` only |
| Grants | `SELECT` → `authenticated`, `service_role`; `INSERT` → `service_role` only |
| Append-only | `notification_worker_runs_append_only` trigger |
| Stored PII risk | `errors` jsonb (sanitized at write); never selected for admin UI |

**Post-deploy verification (manual):**

```bash
psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f supabase/tests/notification_worker_runs_rls_phase5g_checks.sql
```

**Gap (non-blocking):** `rls-policies.integration.test.ts` does not yet include live JWT block tests for `notification_worker_runs` (same gap noted in 5G-a audit). Static migration + SQL catalog tests cover policy shape.

---

## Cron instrumentation

| Path | Run row inserted? | Response |
|------|-------------------|----------|
| `401` invalid secret | No | `{ ok: false, error: "UNAUTHORIZED" }` |
| `503` no service role | No | `{ ok: false, error: "AUTH_NOT_CONFIGURED" }` |
| `200` worker success | Yes (`ok: true`, counters) | Same JSON as pre-5G (`errors`, `dryRunPreviews` still in **cron** body for secret holders — not admin UI) |
| `500` worker throw | Yes (`ok: false`) | `{ ok: false, error: "INTERNAL_ERROR" }` |
| Logging disabled | No (`NOTIFICATION_WORKER_RUN_LOGGING=false`) | Worker JSON unchanged |
| Insert / persist failure | No (logged) | Worker JSON unchanged |

**Write surface:** Only `recordNotificationWorkerRun.ts` (called from cron route). No admin API, requeue path, or `processNotificationOutbox` writes.

---

## Admin observability (read-only)

| Surface | Data loaded | Mutations |
|---------|-------------|-----------|
| Last worker run card | Latest row by `completed_at`; freshness from `computeWorkerRunHealth` | None |
| Recent worker runs table | Up to 15 rows, `completed_at DESC`; status badge OK / Partial / Failed | None |
| Outbox table (5D/5E) | Unchanged; requeue only on outbox | Requeue only — not worker runs |

**`WORKER_RUN_SELECT` (shared):**

`id, started_at, completed_at, ok, delivery_enabled, email_provider, trigger_source, reclaimed, scanned, sent, skipped, failed, dry_run, error_count, created_at` — **`errors` excluded**.

---

## Test results (this audit run)

| Suite | Result |
|-------|--------|
| `npm run typecheck` | **Pass** |
| `recordNotificationWorkerRun.test.ts` | **8/8** |
| `notificationAdminReadModel.test.ts` | **6/6** |
| `mapNotificationWorkerRunForAdmin.test.ts` | **4/4** |
| `computeWorkerRunHealth.test.ts` | **4/4** |
| `AdminNotificationWorkerHealthCard.test.tsx` | **2/2** |
| `AdminNotificationRecentWorkerRunsTable.test.tsx` | **2/2** |
| `route.test.ts` (cron) | **4/4** |
| `notification-worker-runs.migration.test.ts` | **6/6** |
| `notificationWorkerRunsRlsPhase5gPolicy.test.ts` | **3/3** |
| **Stage 5G total** | **39/39** |

Unrelated timeout failures in other suites were not run or fixed (per audit instructions).

---

## Remaining risks and deferred work

| Risk | Severity | Mitigation / note |
|------|----------|-------------------|
| Migration not applied before app deploy | **High** | `/admin/notifications` queries `notification_worker_runs` — page errors without table. Apply migration first. |
| `errors` JSON in DB (admin-selectable via SQL) | **Low** | RLS limits to admins; UI/read model never loads column. 5H analytics must not expose raw JSON to browsers without review. |
| Cron HTTP body still returns `errors` / `dryRunPreviews` | **Low** (by design) | Requires `CRON_SECRET`; not shown on admin pages. |
| No retention / unbounded table growth | **Low** (ops) | Documented deferred; periodic SQL cleanup or future job. |
| Fixed 15-row UI cap | **Low** | Pagination deferred. |
| No live RLS integration tests for worker runs | **Low** | Add in a future hardening slice (mirror 5F). |

---

## Stage 5G vs Stage 5H boundary

**Shipped in 5G:**

- Durable append-only run log
- Cron fail-soft persistence
- Admin last-run freshness (10 / 15 min policy)
- Read-only recent-run history (15 rows)

**Explicitly deferred (do not block 5H design):**

- Pagination, retention job, per-run error drill-down in UI
- `notification_worker_runs` RLS integration tests
- Metrics dashboards / time-series aggregates (5H scope)

**5H design guidance:** Use `notification_worker_runs` for aggregate metrics (run frequency, failure rates, counter trends). Keep admin-facing surfaces sanitized; prefer server-side aggregation over exposing `errors` jsonb.

---

## Final verdict

### Is Stage 5G complete?

**Yes.** 5G-a (table, cron hook, last-run card) and 5G-b (recent runs table, read model extension) match the design scope. All 15 audit checks pass on static review and automated tests.

### Is Stage 5G safe enough to move to Stage 5H?

**Yes.** Worker delivery logic is unchanged; admin UI is read-only; RLS and grants follow the same posture as other ops audit tables. Proceed to **Stage 5H — notification analytics/metrics design** with the caveats above (especially: do not widen raw `errors` exposure in new surfaces without a sanitization pass).

**Pre-production checklist:**

1. Apply `20260518210000_notification_worker_runs.sql` on target Supabase.
2. Run `supabase/tests/notification_worker_runs_rls_phase5g_checks.sql`.
3. Invoke cron once; confirm last-run card and recent table populate on `/admin/notifications`.
4. Keep `NOTIFICATION_WORKER_RUN_LOGGING` enabled (default) unless rolling back per `rls-tightening-rollbacks.md`.
