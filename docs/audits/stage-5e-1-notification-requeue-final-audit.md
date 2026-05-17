# Stage 5E-1 — Notification Requeue Final Audit

**Date:** 2026-05-17  
**Type:** Audit only — no code changes  
**Scope:** Failed notification requeue across booking detail and global `/admin/notifications` (5E-1a helper/API + 5E-1b-α global UI)  
**Related:** [stage-5e-1-failed-notification-requeue-final-audit.md](./stage-5e-1-failed-notification-requeue-final-audit.md), [stage-5e-1b-global-requeue-dry-run-design.md](../architecture/stage-5e-1b-global-requeue-dry-run-design.md), [notification-outbox-worker.md](../operations/notification-outbox-worker.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Failed row requeue (booking detail + global) | **Pass** |
| Non-failed statuses blocked (pending / processing / sent) | **Pass** |
| Dry-run rows blocked (sent + pending preview) | **Pass** (by design until 5E-1b-β) |
| Unsupported templates blocked | **Pass** |
| Admin auth + reason 8–500 chars | **Pass** |
| Service-role write path only | **Pass** |
| `admin_operational_audit` (`notification_requeue`) | **Pass** |
| No send-in-request / cron from UI | **Pass** |
| Worker dedupe unchanged | **Pass** |
| No new POST routes in 5E-1b-α | **Pass** |
| No worker / RLS / payment / assignment / earnings regression | **Pass** (static + diff) |
| Tests & typecheck | **Pass** |

**Overall:** Stage **5E-1 (failed requeue + 5E-1b-α global UI)** is **safe to deploy** after applying migration `20260518190000_admin_operational_audit_notification_requeue.sql`. **5E-1b-β** (dry-run `sent` requeue) is correctly **not** started — helper and eligibility still gate on `status === 'failed'` only.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Booking detail failed rows can be requeued | **Pass** | `listNotificationsForBooking` maps with `{ requeueActionsEnabled: true }`; `AdminBookingNotificationsSection` passes `showRequeueActions`; `AdminNotificationRequeueAction` POSTs to requeue API when `canRequeue`; test `shows Requeue for eligible failed rows` |
| 2 | Global failed rows can be requeued | **Pass** | `app/(admin)/admin/notifications/page.tsx` passes `showRequeueActions`; `notificationAdminReadModel` maps rows with `{ requeueActionsEnabled: true }`; table test `shows Requeue on global table when showRequeueActions and canRequeue` |
| 3 | Pending rows cannot be requeued | **Pass** | `computeNotificationRequeueEligibility` → `PENDING`; helper `row.status !== "failed"` → 409 `INVALID_STATUS` + audit; `adminRequeueNotificationOutbox.test.ts` `rejects pending` |
| 4 | Processing rows cannot be requeued | **Pass** | Eligibility → `PROCESSING`; helper rejects; test `rejects processing` |
| 5 | Sent rows cannot be requeued | **Pass** | Eligibility → `LIVE_ALREADY_SENT`; helper rejects live `sent`; table/section tests hide Requeue for `status: sent` |
| 6 | Dry-run sent rows cannot be requeued yet | **Pass** | Dry-run `sent` (`last_error` starts with `dry_run_sent`, `status: sent`) → `LIVE_ALREADY_SENT`; dry-run preview (`status: pending`, `dry_run_sent` metadata) → `PENDING`; helper still requires `status === 'failed'`; test `blocks dry-run sent rows (5E-1b-β deferred)` |
| 7 | Unsupported templates cannot be requeued | **Pass** | `isDeliverableNotificationRow` in helper → `UNSUPPORTED_TEMPLATE`; eligibility → `UNSUPPORTED_TEMPLATE`; tests for `payment_pending` |
| 8 | Requeue requires admin auth | **Pass** | Route `requireApiUser(["admin"])`; helper `user.role !== "admin"` → 403; route test 401 unauthenticated |
| 9 | Requeue requires reason 8–500 chars | **Pass** | `validateAdminRecoveryReason` (`ADMIN_RECOVERY_REASON_MIN_LENGTH = 8`, max 500); UI `minLength={8}`, submit disabled until 8 chars; helper test `requires reason 8-500 chars` |
| 10 | Requeue uses service-role helper only | **Pass** | `adminRequeueNotificationOutbox` → `createServiceRoleClient()`; `server-only`; UI uses `fetch` to API only; `serviceRoleLifecycleWriteRegistry.test.ts` lists `adminRequeueNotificationOutbox.ts` |
| 11 | Requeue writes `admin_operational_audit` | **Pass** | `auditAdminNotificationRequeue` → `recordAdminOperationalAudit` with `action: "notification_requeue"`; migration adds action to check constraint; success uses idempotency key |
| 12 | Requeue does not send email immediately | **Pass** | No `sendEmail` / `processNotificationOutbox` import in requeue path; update sets `pending` only; UI copy states worker/cron delivers later |
| 13 | Worker dedupe still applies after requeue | **Pass** | `computeDeliveryDedupeWouldBlock` uses same `hasSent*` helpers as worker; `processNotificationOutbox.ts` unchanged for requeue; API/UI surface `deliveryDedupeWouldBlock` warning |
| 14 | No new POST routes in 5E-1b-α | **Pass** | `adminApiRoutes.test.ts`: allowlist unchanged — 6 intentional admin POST routes including existing `notifications/[outboxId]/requeue/route.ts`; 5E-1b-α only enables UI on global page |
| 15 | No worker / RLS / payment / assignment / earnings changes | **Pass** | Uncommitted 5E-1b-α diff: notification admin UI/read-model/docs only; no `processNotificationOutbox.ts`, no new RLS migrations beyond audit action check, no payment/assignment/earnings files |

---

## Implementation map

| Capability | Primary files |
|------------|----------------|
| Migration | `supabase/migrations/20260518190000_admin_operational_audit_notification_requeue.sql` |
| Requeue helper | `adminRequeueNotificationOutbox.ts` |
| Dedupe preflight | `computeDeliveryDedupeWouldBlock.ts` |
| Audit sidecar | `auditAdminNotificationRequeue.ts` |
| API | `POST /api/admin/notifications/[outboxId]/requeue/route.ts` |
| Eligibility | `computeNotificationRequeueEligibility.ts`, `mapNotificationOutboxRowForAdmin.ts` |
| Booking read model | `listNotificationsForBooking.ts` |
| Global read model | `notificationAdminReadModel.ts` |
| UI | `AdminNotificationOutboxTable.tsx`, `AdminNotificationRequeueAction.tsx`, `AdminBookingNotificationsSection.tsx`, `app/(admin)/admin/notifications/page.tsx` |

---

## Surfaces compared

| Surface | Requeue UI | Eligibility flag | Same API |
|---------|------------|------------------|----------|
| Booking detail | `showRequeueActions` via `AdminBookingNotificationsSection` | `requeueActionsEnabled: true` in `listNotificationsForBooking` | Yes |
| Global `/admin/notifications` | `showRequeueActions` on page (5E-1b-α) | `requeueActionsEnabled: true` in `notificationAdminReadModel` | Yes |

Both surfaces use the same `canRequeue` computation and the same `POST /api/admin/notifications/[outboxId]/requeue` route.

---

## Security & safety review

### Intended controls

- **Single write gateway:** Outbox mutations from admin requeue go through `adminRequeueNotificationOutbox` + service role.
- **Optimistic concurrency:** `UPDATE … WHERE id = ? AND status = 'failed'`.
- **No PII in audit metadata:** Allowlisted keys only (`outboxId`, `template`, `oldStatus`, `newStatus`, `deliveryDedupeWouldBlock`).
- **Rejected attempts audited** when `booking_id` is known (wrong status, unsupported template, conflict).

### Known limitations (accepted)

| Limitation | Risk | Mitigation / next slice |
|------------|------|-------------------------|
| Admin JWT may still have broad `notification_outbox` RLS (pre-existing) | Direct client mutation | UI/API use service role; **5E-4** RLS tightening deferred |
| API is outbox-scoped, not booking-scoped | Requeue without opening booking | Same server guards + audit |
| Rows missing `payload.bookingId` | No DB audit row | `MISSING_BOOKING_ID`; console log only |
| Dry-run `sent` / preview not requeueable | Staging ops blocked until 5E-1b-β | By design; design doc defines β scope |
| `deliveryDedupeWouldBlock` is warning-only | Requeue may not produce email | Documented in API message + UI |
| Migration not applied → audit insert fails | Silent audit loss | Deploy migration first |

### Dry-run row shapes (why check #6 passes today)

| Worker outcome | `status` | `last_error` | Requeue today |
|----------------|----------|--------------|---------------|
| Dry-run preview (`NOTIFICATION_DRY_RUN_MARK_SENT=false`) | `pending` | `dry_run_sent;…` | **Blocked** (`PENDING`) |
| Dry-run marked sent (`shouldMarkDryRunSent` / resend path) | `sent` | `dry_run_sent;…` | **Blocked** (`LIVE_ALREADY_SENT`) |

5E-1b-β must extend helper + eligibility for dry-run `sent` only; live `sent` must remain blocked.

---

## Test results

| Command / suite | Result |
|-----------------|--------|
| `npm run typecheck` | **Pass** |
| `adminRequeueNotificationOutbox.test.ts` | **Pass** (11 tests) |
| `requeue/route.test.ts` | **Pass** (2 tests) |
| `AdminNotificationOutboxTable.test.tsx` | **Pass** (5 tests) |
| `AdminBookingNotificationsSection.test.tsx` | **Pass** (4 tests) |
| `computeNotificationRequeueEligibility.test.ts` | **Pass** (5 tests) |
| `mapNotificationOutboxRowForAdmin.test.ts` | **Pass** |
| `notificationAdminReadModel.test.ts` | **Pass** |
| `serviceRoleLifecycleWriteRegistry.test.ts` | **Pass** (2 tests) |
| `adminApiRoutes.test.ts` | **Pass** (1 test) |
| `admin-operational-audit-notification-requeue.migration.test.ts` | **Pass** (2 tests) |
| `recordAdminOperationalAudit.test.ts` | **Pass** (6 tests) |

**Combined audit run:** 10 files, **57 tests** — all passed (2026-05-17).

---

## Working tree note (5E-1b-α)

The following uncommitted changes enable **global failed requeue UI** without new API routes or helper behavior changes:

- `app/(admin)/admin/notifications/page.tsx` — `showRequeueActions`
- `notificationAdminReadModel.ts` — `requeueActionsEnabled: true` (replaces prior `bookingDetailContext` pattern)
- `computeNotificationRequeueEligibility.ts` — `requeueActionsEnabled` option
- Related tests and ops docs

Committed baseline: `cc7818f` (notification delivery foundation + audited admin requeue).

---

## Deploy prerequisites

1. Apply `20260518190000_admin_operational_audit_notification_requeue.sql` before or with app deploy.
2. Commit/deploy 5E-1b-α global UI changes if not already on the release branch.
3. Smoke: requeue one **failed** row from booking detail and one from `/admin/notifications` (reason ≥ 8 chars).
4. Confirm `admin_operational_audit`: `action = notification_requeue`, `outcome = success`.
5. Run notification cron; verify dedupe skip or send per existing worker rules.
6. Confirm dry-run `sent` row still has no Requeue button (β not shipped).

---

## Explicitly out of scope (still)

- Dry-run `sent` requeue (**5E-1b-β**)
- Live `sent` force resend
- `retry_now` for pending (**5E-2a**)
- Stale `processing` admin reclaim (**5E-2b**)
- `notification_outbox` RLS SELECT-only for admin (**5E-4**)
- Bulk requeue

---

## Final answer

### Is Stage 5E-1 complete and safe enough to move to Stage 5E-1b-β (dry-run sent requeue)?

**Yes.**

| Criterion | Status |
|-----------|--------|
| Failed requeue helper + API | **Complete** (committed) |
| Booking + global failed UI | **Complete** (global in working tree / 5E-1b-α) |
| Safety gates (auth, reason, service role, audit, no immediate send, dedupe) | **Verified** |
| Dry-run / live `sent` blocked | **Correct** — ready for β to narrow the exception |
| Worker / RLS / payments / assignments / earnings | **Unchanged** in this slice |

**Proceed to 5E-1b-β** with these constraints:

1. Deploy migration + merge **5E-1b-α** (global failed requeue) before β.
2. In β, extend **only** `adminRequeueNotificationOutbox` + `computeNotificationRequeueEligibility` to allow `status === 'sent'` when `isDryRunLastError(last_error)` — keep live `sent` blocked.
3. Reuse the same POST route; add tests for dry-run `sent` accept/reject matrix.
4. Keep optimistic update guard aligned (e.g. `WHERE status = 'sent' AND last_error LIKE 'dry_run_sent%'`).

Requeue remains **ops-safe**: it resets queue state for the worker; it does **not** guarantee a second email when delivery dedupe applies.

---

## Sign-off

| Role | Status |
|------|--------|
| Stage 5E-1a (failed requeue + API + audit) | **Complete — Pass** |
| Stage 5E-1b-α (global failed UI) | **Complete in tree — Pass** |
| Stage 5E-1b-β (dry-run sent requeue) | **Not started — safe to begin** |
| Stage 5E-1 final audit | **Pass — deploy after migration** |
