# Stage 5F — notification_outbox RLS Tightening Final Audit

**Date:** 2026-05-17  
**Type:** Audit only — no code changes  
**Scope:** Stage 5F-a — replace `notification_outbox_admin` (`FOR ALL`) with admin `SELECT`-only RLS  
**Related:** [stage-5f-notification-outbox-rls-tightening-design.md](../architecture/stage-5f-notification-outbox-rls-tightening-design.md), [stage-5e-notification-requeue-governance-final-audit.md](./stage-5e-notification-requeue-governance-final-audit.md), [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md), [notification-outbox-worker.md](../operations/notification-outbox-worker.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| `notification_outbox_admin` removed | **Pass** |
| `notification_outbox_select_admin` present | **Pass** |
| Admin JWT write blocked (INSERT/UPDATE/DELETE) | **Pass** (integration) |
| Admin JWT read preserved | **Pass** (integration + read-model tests) |
| Customer/cleaner read blocked | **Pass** (policy + inference; 2 integration tests deferred — auth rate limit) |
| Service-role INSERT/UPDATE | **Pass** (integration) |
| Worker delivery path | **Pass** (unit tests; SR cron unchanged) |
| Admin requeue (5E) | **Pass** (unit tests; SR helper unchanged) |
| `/admin/notifications` read model | **Pass** (unit tests) |
| Booking detail notification history | **Pass** (dashboard read-model tests) |
| Rollback SQL documented | **Pass** |
| No worker/enqueue/requeue/UI behavior change | **Pass** |
| Typecheck & targeted tests | **Pass** |

**Overall:** Stage **5F** is **complete and safe to close** for the linked Supabase project where migration `20260518200000_rls_notification_outbox_admin_select_only.sql` is applied. Re-run two RLS integration cases when Auth rate limits clear; apply the migration on any environment that has not yet received it.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | `notification_outbox_admin` policy removed | **Pass** | Forward migration drops policy; `pg_policies` on project `jdmumbvednevkrctkiwd` lists no `notification_outbox_admin`; `notification_outbox_rls_phase5f_checks.sql` asserts absence; static test `notificationOutboxRlsPhase5fPolicy.test.ts` |
| 2 | `notification_outbox_select_admin` exists | **Pass** | Migration `create policy notification_outbox_select_admin … for select`; live catalog: `cmd = SELECT`, `roles = {authenticated}`; SQL catalog checks + static test |
| 3 | Admin can SELECT `notification_outbox` | **Pass** | `rls-policies.integration.test.ts` → `admin can SELECT notification_outbox`; existing `admin can access operational data` still selects outbox |
| 4 | Admin cannot INSERT | **Pass** | Integration: `admin cannot INSERT notification_outbox` — `data` null, `error` set |
| 5 | Admin cannot UPDATE `status` | **Pass** | Integration: `admin cannot UPDATE notification_outbox.status` — row unchanged or RLS error; probe `isNotificationOutboxRlsPhase5fApplied` returns true |
| 6 | Admin cannot DELETE | **Pass** | Integration: `admin cannot DELETE notification_outbox` — probe row still present via service role |
| 7 | Customer cannot SELECT | **Pass** (inferred) | No customer policy on table (only `notification_outbox_select_admin`); integration test **not executed** this run — `signInAs` → `Request rate limit reached` |
| 8 | Cleaner cannot SELECT | **Pass** (inferred) | Same as #7 — no cleaner policy; integration blocked by Auth rate limit |
| 9 | Service role can INSERT/UPDATE | **Pass** | Integration: `service role can INSERT and UPDATE notification_outbox`; enqueue/worker/requeue use `createServiceRoleClient` / command backend SR client |
| 10 | Worker still processes rows | **Pass** | `processNotificationOutbox.test.ts` (no 5F edits); cron `process-notification-outbox/route.ts` uses `createServiceRoleClient()` → bypasses RLS; `reclaimStaleProcessingNotifications.test.ts` 4/4 |
| 11 | Admin requeue still works | **Pass** | `adminRequeueNotificationOutbox.ts` → `createServiceRoleClient()`; `adminRequeueNotificationOutbox.test.ts`; allowlisted in `serviceRoleLifecycleWriteRegistry.test.ts` |
| 12 | `/admin/notifications` still loads | **Pass** | `getAdminNotificationHealthPage` → `notificationAdminReadModel.ts` → admin JWT `createSupabaseServerClient()` + `SELECT` only; `notificationAdminReadModel.test.ts` |
| 13 | Booking detail notification history still loads | **Pass** | `adminOperationsReadModel.ts` → `listNotificationsForBooking(client, bookingId)` with server client; `dashboardReadModels.test.ts` mocks outbox reads |
| 14 | Rollback SQL documented | **Pass** | `docs/operations/rls-tightening-rollbacks.md` Phase 5F-a — drop `notification_outbox_select_admin`, restore `notification_outbox_admin` `FOR ALL` |
| 15 | No worker/enqueue/requeue/UI behavior changed | **Pass** | 5F diff is migration + tests + rollback doc only; production DML paths unchanged (see §Behavior inventory) |

---

## Policy state (applied database)

**Migration:** `supabase/migrations/20260518200000_rls_notification_outbox_admin_select_only.sql`

**Live catalog** (project `jdmumbvednevkrctkiwd`, 2026-05-17):

| Policy | Command | Roles |
|--------|---------|-------|
| `notification_outbox_select_admin` | `SELECT` | `authenticated` |

- `notification_outbox_admin`: **absent**
- RLS on `public.notification_outbox`: **enabled**
- Authenticated write/`ALL` policies on this table: **0**

---

## Test execution summary

| Command / suite | Result |
|-----------------|--------|
| `npm run typecheck` | **Pass** |
| `notificationOutboxRlsPhase5fPolicy.test.ts` | **4/4** |
| `processNotificationOutbox.test.ts` | **Pass** (included in bundled run) |
| `adminRequeueNotificationOutbox.test.ts` | **Pass** (included in bundled run) |
| `notificationAdminReadModel.test.ts` | **Pass** (included in bundled run) |
| `dashboardReadModels.test.ts` | **Pass** (included in bundled run) |
| `reclaimStaleProcessingNotifications.test.ts` | **4/4** |
| Bundled notification + 5F static (5 files) | **70/70** |
| `rls-policies.integration.test.ts` | **49/51** — 5F block **5/7** executed; **2 failures** = Auth `Request rate limit reached` on customer/cleaner `signInAs` (not RLS regression) |

**Deferred (re-run when rate limit clears):**

- `customer cannot SELECT notification_outbox`
- `cleaner cannot SELECT notification_outbox`

**Catalog SQL (manual promotion):**

```bash
psql "$DATABASE_URL" -f supabase/tests/notification_outbox_rls_phase5f_checks.sql
```

---

## Behavior inventory (unchanged by 5F)

| Path | Client | Operations | 5F impact |
|------|--------|------------|-----------|
| Booking command enqueue | Service role (`supabaseBookingCommandBackend`) | `INSERT` | None — SR bypasses RLS |
| Cron worker | Service role (`process-notification-outbox`) | `SELECT`, `UPDATE` | None |
| Stale reclaim | Service role | `UPDATE` | None |
| Admin requeue API | Service role (`adminRequeueNotificationOutbox`) | `SELECT`, `UPDATE` | None |
| Global admin health | Admin JWT (`createSupabaseServerClient`) | `SELECT` | Preserved via `notification_outbox_select_admin` |
| Booking detail notifications | Admin JWT | `SELECT` | Preserved |
| Customer/cleaner apps | — | No outbox access | Unchanged (no policies added) |

**Production code with `notification_outbox` DML (grep):**

- `INSERT`: `supabaseBookingCommandBackend.ts` (SR)
- `UPDATE`: `processNotificationOutbox.ts`, `dryRunDelivery.ts`, `reclaimStaleProcessingNotifications.ts`, `adminRequeueNotificationOutbox.ts` (all SR)
- `DELETE`: `phase1IntegrationTestSupport.ts` (test cleanup only)
- No admin JWT `insert`/`update`/`delete` outside tests

---

## Security outcome

| Risk (pre-5F) | Post-5F |
|---------------|---------|
| Compromised admin JWT could `UPDATE` outbox to `sent`, bypassing worker/audit | **Closed** — no authenticated write policy |
| Unaudited admin PostgREST `INSERT`/`DELETE` | **Closed** |
| Admin operational visibility | **Preserved** — `SELECT` via `notification_outbox_select_admin` |
| Governed requeue (5E) | **Unchanged** — still service role + `admin_operational_audit` |

**Residual (out of 5F scope):** Admin JWT `SELECT` still returns raw `recipient` and `payload` at the DB layer; app DTOs (`mapNotificationOutboxRowForAdmin`) continue to sanitize before UI. Column-level hardening deferred per design.

---

## Rollback

Documented in `docs/operations/rls-tightening-rollbacks.md` (Phase 5F-a). Restores `notification_outbox_admin` `FOR ALL`. Documentation only — not applied in this audit.

---

## Deploy / environment notes

| Item | Status |
|------|--------|
| Migration in repo | `20260518200000_rls_notification_outbox_admin_select_only.sql` |
| Linked remote project | Policy catalog matches 5F-a (verified via SQL) |
| `supabase db push` | May fail on history drift — apply migration per environment promotion checklist |
| Prerequisites | Stage **5E** requeue + audit migration should precede or coincide (requeue is SR-only; safe either way) |

---

## Final recommendation

### Is Stage 5F complete and safe to close?

**Yes.**

1. **Policy goal met:** Admin JWT/PostgREST **write** access to `notification_outbox` is removed; **read** access for admins is preserved.
2. **Operational paths safe:** Enqueue, cron worker, and 5E requeue remain on **service role** with passing unit tests and no application changes in those modules.
3. **Admin UX safe:** Read models for `/admin/notifications` and booking detail notifications use admin `SELECT` only; tests pass.
4. **Rollback documented** for emergency revert.
5. **Minor follow-up:** Re-run the two customer/cleaner RLS integration tests after Auth rate limits reset; confirm migration applied on every deployment target; run `notification_outbox_rls_phase5f_checks.sql` in staging/prod promotion.

No further 5F implementation work is required unless a new environment lacks the migration.

---

## References

| Resource | Path |
|----------|------|
| Design | `docs/architecture/stage-5f-notification-outbox-rls-tightening-design.md` |
| Forward migration | `supabase/migrations/20260518200000_rls_notification_outbox_admin_select_only.sql` |
| SQL catalog checks | `supabase/tests/notification_outbox_rls_phase5f_checks.sql` |
| Static policy test | `src/tests/security/notificationOutboxRlsPhase5fPolicy.test.ts` |
| RLS integration | `src/tests/security/rls-policies.integration.test.ts` |
| Rollbacks | `docs/operations/rls-tightening-rollbacks.md` |
| 5E audit | `docs/audits/stage-5e-notification-requeue-governance-final-audit.md` |
