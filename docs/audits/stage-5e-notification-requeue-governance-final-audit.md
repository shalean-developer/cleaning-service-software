# Stage 5E — Notification Requeue Governance Final Audit

**Date:** 2026-05-17  
**Type:** Audit only — no code changes  
**Scope:** Full Stage 5E notification requeue governance (5E-1a failed requeue, 5E-1b-α global UI, 5E-1b-β dry-run sent requeue)  
**Related:** [stage-5e-1-notification-requeue-final-audit.md](./stage-5e-1-notification-requeue-final-audit.md), [stage-5e-1-failed-notification-requeue-final-audit.md](./stage-5e-1-failed-notification-requeue-final-audit.md), [notification-outbox-worker.md](../operations/notification-outbox-worker.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Failed deliverable requeue | **Pass** |
| Dry-run sent deliverable requeue | **Pass** |
| Live sent / pending / processing blocked | **Pass** |
| Unsupported templates blocked | **Pass** |
| Admin auth + reason 8–500 chars | **Pass** |
| Service-role helper only (UI → API → helper) | **Pass** |
| `admin_operational_audit` (`notification_requeue`) | **Pass** |
| Dry-run audit metadata (`dryRunRequeue: true`) | **Pass** |
| No send-in-request / no cron from UI | **Pass** |
| Worker handles delivery later | **Pass** |
| Booking detail + global UI parity | **Pass** |
| Single POST route (no dry-run-specific route) | **Pass** |
| No worker / payment / assignment / earnings regression | **Pass** |
| No new `notification_outbox` RLS in 5E | **Pass** (pre-existing broad admin policy remains — **5F** scope) |
| Tests & typecheck | **Pass** |

**Overall:** Stage **5E** notification requeue governance is **complete and safe to deploy** after applying migration `20260518190000_admin_operational_audit_notification_requeue.sql`. The remaining security gap is **intentionally deferred**: admin JWT still has `FOR ALL` on `notification_outbox` via `notification_outbox_admin` (pre-5E). **Stage 5F** (`notification_outbox` RLS tightening design) is the correct next step.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Failed deliverable rows can be requeued | **Pass** | `computeNotificationRequeueEligibility`: `status === "failed"` + `isDeliverableNotificationRow` + `bookingId`; helper `isFailedRequeue`; tests `is true for failed deliverable`, `requeues failed payment_confirmed` / `payment_failed` / `assignment_offer` |
| 2 | Dry-run sent deliverable rows can be requeued | **Pass** | Eligibility: `status === "sent"` + `isDryRunLastError(last_error)` + deliverable + `bookingId`; helper `isDryRunSentRequeue`; update `WHERE status = 'sent'`; tests `allows dry-run sent *` (3 templates), `requeues dry-run sent *` |
| 3 | Live sent rows are blocked | **Pass** | Eligibility: `sent` without `dry_run_sent` → `LIVE_ALREADY_SENT`; helper: explicit message *"Live sent notifications cannot be requeued"*; tests `blocks live sent rows`, `rejects live sent status` |
| 4 | Pending rows are blocked | **Pass** | Eligibility → `PENDING`; helper rejects non-failed/non-dry-run-sent; test `rejects pending status` |
| 5 | Processing rows are blocked | **Pass** | Eligibility → `PROCESSING`; helper rejects; test `rejects processing status` |
| 6 | Unsupported templates are blocked | **Pass** | `isDeliverableNotificationRow` gates `payment_confirmed`, `payment_failed`, `assignment_offer` only; eligibility + helper → `UNSUPPORTED_TEMPLATE`; tests for failed and dry-run sent `payment_pending` |
| 7 | Admin reason is required | **Pass** | `validateAdminRecoveryReason` (min 8, max 500); route passes `reason` string; UI `required`, `minLength={8}`, submit disabled until 8 chars; helper test `requires reason 8-500 chars` |
| 8 | Admin auth is required | **Pass** | Route `requireApiUser(["admin"])`; helper `user.role !== "admin"` → 403 `FORBIDDEN`; route test 401 unauthenticated |
| 9 | Service-role helper is used | **Pass** | `adminRequeueNotificationOutbox` → `createServiceRoleClient()`; `import "server-only"`; no browser JWT update path; `serviceRoleLifecycleWriteRegistry.test.ts` allowlists `adminRequeueNotificationOutbox.ts` |
| 10 | Admin operational audit records `notification_requeue` | **Pass** | `auditAdminNotificationRequeue` → `recordAdminOperationalAudit` with `action: "notification_requeue"`; migration `20260518190000_*` extends action check; migration test passes |
| 11 | Dry-run requeue audit includes `dryRunRequeue: true` | **Pass** | Success path passes `dryRunRequeue: isDryRunSentRequeue` to audit; metadata allowlisted in `recordAdminOperationalAudit.ts`; `recordAdminOperationalAudit.test.ts` keeps `dryRunRequeue`; helper test asserts `dryRunRequeue: true` on dry-run requeue |
| 12 | No email is sent immediately | **Pass** | Helper performs DB `update` only — no `sendEmail`, Resend, or `processNotificationOutbox` import; UI copy states worker/cron delivers later |
| 13 | Cron/worker handles delivery later | **Pass** | Requeue sets `status: pending`, `next_retry_at: now()`, `last_error: admin_requeued`; worker unchanged (`processNotificationOutbox.ts` has no requeue references); docs state cron must run after requeue |
| 14 | Global and booking detail UI behave correctly | **Pass** | Booking: `listNotificationsForBooking` + `AdminBookingNotificationsSection` with `showRequeueActions`; Global: `/admin/notifications` + `notificationAdminReadModel` with `requeueActionsEnabled: true`; shared `AdminNotificationOutboxTable` + `AdminNotificationRequeueAction`; labels **Requeue** vs **Requeue dry-run** |
| 15 | No new POST route for dry-run | **Pass** | Single route `POST /api/admin/notifications/[outboxId]/requeue`; `adminApiRoutes.test.ts` allowlist unchanged (6 admin POST routes); dry-run uses same endpoint |
| 16 | No worker/RLS/payment/assignment/earnings changes | **Pass** | 5E migration only extends `admin_operational_audit` action check; no edits to `processNotificationOutbox.ts`, payment/assignment/earnings modules, or `notification_outbox` RLS policies in 5E migrations |

---

## Stage 5E slice map

| Slice | Deliverable | Status |
|-------|-------------|--------|
| **5E-1a** | Failed requeue helper, API, audit migration, booking UI | **Complete** |
| **5E-1b-α** | Global `/admin/notifications` requeue UI | **Complete** |
| **5E-1b-β** | Dry-run `sent` requeue (same route, extended eligibility/helper) | **Complete** |

---

## Implementation map

| Capability | Primary files |
|------------|----------------|
| Migration | `supabase/migrations/20260518190000_admin_operational_audit_notification_requeue.sql` |
| Eligibility | `computeNotificationRequeueEligibility.ts`, `notificationOutboxDeliverability.ts` (`isDryRunLastError`) |
| Requeue helper | `adminRequeueNotificationOutbox.ts` |
| Dedupe preflight | `computeDeliveryDedupeWouldBlock.ts` |
| Audit | `auditAdminNotificationRequeue.ts`, `recordAdminOperationalAudit.ts` |
| API | `POST /api/admin/notifications/[outboxId]/requeue/route.ts` |
| Admin mapper | `mapNotificationOutboxRowForAdmin.ts` |
| Booking read model | `listNotificationsForBooking.ts` |
| Global read model | `notificationAdminReadModel.ts` |
| UI | `AdminNotificationOutboxTable.tsx`, `AdminNotificationRequeueAction.tsx`, `AdminBookingNotificationsSection.tsx`, `app/(admin)/admin/notifications/page.tsx` |

---

## Eligibility matrix (authoritative)

| Row shape | `canRequeue` | Block reason (if not) |
|-----------|--------------|------------------------|
| `failed` + deliverable + `bookingId` | **Yes** | — |
| `sent` + `last_error` starts with `dry_run_sent` + deliverable + `bookingId` | **Yes** | — |
| `sent` (live — no dry-run prefix) | No | `LIVE_ALREADY_SENT` |
| `pending` | No | `PENDING` |
| `processing` | No | `PROCESSING` |
| Unsupported template (any eligible status) | No | `UNSUPPORTED_TEMPLATE` |
| Missing `payload.bookingId` | No | `MISSING_BOOKING_ID` |
| `requeueActionsEnabled: false` | No | `REQUEUE_ACTIONS_DISABLED` |

**Deliverable templates:** `payment_confirmed` (email), `payment_failed` (email), `assignment_offer` (push channel + `offerId` + `bookingId`).

---

## Requeue helper behavior

On success (failed or dry-run sent):

| Field | Value |
|-------|--------|
| `status` | `pending` |
| `attempts` | `0` |
| `next_retry_at` | `now()` |
| `last_error` | `admin_requeued` |
| `updated_at` | `now()` |

**Optimistic lock:** `WHERE id = ? AND status = 'failed'` (failed) or `status = 'sent'` (dry-run sent).

**Audit on success:** `action: notification_requeue`, `outcome: success`, idempotency key `notification_requeue:{outboxId}:{oldStatus}:{priorUpdatedAt}`, metadata includes `outboxId`, `template`, `oldStatus`, `newStatus`, `deliveryDedupeWouldBlock`, and `dryRunRequeue: true` when requeuing dry-run sent.

---

## UI surfaces

| Surface | Requeue enabled | Button labels | API |
|---------|-----------------|---------------|-----|
| Booking detail → Notifications | `showRequeueActions` | Requeue / Requeue dry-run | `POST …/requeue` |
| Global `/admin/notifications` | `showRequeueActions` | Same | Same |

Both surfaces compute `canRequeue` via `mapNotificationOutboxRowForAdmin(…, { requeueActionsEnabled: true })`. Requeue actions hidden when `canRequeue` is false (live sent, pending, processing, unsupported).

---

## Security & safety review

### Intended controls

- **Single write gateway:** Outbox mutations from admin requeue go through `adminRequeueNotificationOutbox` + service role only.
- **Dual-path optimistic concurrency:** Status guard on update prevents races with worker.
- **No PII in audit metadata:** Allowlisted primitives only; raw payload never stored.
- **Rejected attempts audited** when `booking_id` is known (wrong status, unsupported template, conflict).
- **Delivery dedupe preflight:** Warning-only; worker behavior unchanged.

### Known limitations (accepted; 5F+ scope)

| Limitation | Risk | Next step |
|------------|------|-----------|
| `notification_outbox_admin` is `FOR ALL` for authenticated admins | Admin browser client could `UPDATE` outbox directly, bypassing audit | **Stage 5F** — RLS tightening to admin `SELECT` only |
| API is outbox-scoped, not booking-scoped | Requeue without opening booking detail | Mitigated by server guards + audit |
| Rows missing `payload.bookingId` | No DB audit row on early reject | Console log via `logAdminNotificationRequeue` |
| `deliveryDedupeWouldBlock` is advisory | Requeue may not produce a second email | Documented in API message + UI |
| Dry-run preview rows (`pending` + `dry_run_sent` in `last_error`) | Not requeueable | By design — only dry-run **sent** rows |
| Migration must be applied | Audit insert fails if action check missing | Deploy `20260518190000_*` with app |

### Out of scope (still deferred)

- Live `sent` force resend
- Bulk requeue
- Cron trigger from admin UI
- `retry_now` for pending (5E-2a)
- Stale `processing` admin reclaim (5E-2b)

---

## Regression scope (check #16)

| Area | 5E changes? | Notes |
|------|-------------|-------|
| `processNotificationOutbox.ts` | **No** | Worker delivery logic unchanged |
| `notification_outbox` RLS | **No new migration** | Pre-existing `notification_outbox_admin` `FOR ALL` unchanged |
| Payments | **No** | Not in requeue path |
| Assignments | **No** | Only shared `validateAdminRecoveryReason` |
| Earnings | **No** | — |
| Payment/assignment/earnings RLS migrations (5B-3) | **No** | Separate stage |

---

## Test results

| Command / suite | Result |
|-----------------|--------|
| `npm run typecheck` | **Pass** |
| `computeNotificationRequeueEligibility.test.ts` | **Pass** |
| `adminRequeueNotificationOutbox.test.ts` | **Pass** |
| `requeue/route.test.ts` | **Pass** |
| `AdminNotificationOutboxTable.test.tsx` | **Pass** |
| `AdminBookingNotificationsSection.test.tsx` | **Pass** |
| `mapNotificationOutboxRowForAdmin.test.ts` | **Pass** |
| `notificationAdminReadModel.test.ts` | **Pass** |
| `recordAdminOperationalAudit.test.ts` | **Pass** |
| `serviceRoleLifecycleWriteRegistry.test.ts` | **Pass** |
| `adminApiRoutes.test.ts` | **Pass** |
| `admin-operational-audit-notification-requeue.migration.test.ts` | **Pass** |

**Combined audit run:** 10 files, **65 tests** — all passed (2026-05-17).

---

## Deploy prerequisites

1. Apply `20260518190000_admin_operational_audit_notification_requeue.sql` before or with app deploy.
2. Smoke: requeue one **failed** row and one **dry-run sent** row from booking detail and `/admin/notifications` (reason ≥ 8 chars).
3. Confirm `admin_operational_audit`: `action = notification_requeue`, `outcome = success`; dry-run row metadata includes `dryRunRequeue: true`.
4. Run notification cron; verify worker picks up `pending` rows (dry-run or Resend per `NOTIFICATION_EMAIL_PROVIDER`).
5. Confirm **live** `sent` row has no Requeue button and API returns 409.

---

## Final answer

### Is Stage 5E complete and safe enough to move to Stage 5F (`notification_outbox` RLS tightening design)?

**Yes.**

| Criterion | Status |
|-----------|--------|
| Failed + dry-run sent requeue (booking + global) | **Complete** |
| Live sent / pending / processing / unsupported blocked | **Verified** |
| Auth, reason, service role, audit, no immediate send | **Verified** |
| Single POST route; worker unchanged | **Verified** |
| Tests & typecheck | **Pass** |

Stage 5E delivers **governed, audited, service-role-mediated** requeue for ops. The deliberate gap for 5F is **database-level enforcement**: today an admin session could still mutate `notification_outbox` outside the helper because RLS grants `FOR ALL`. Tightening to **admin SELECT-only** (writes only via service role in approved modules) closes that bypass without changing requeue semantics.

**Proceed to Stage 5F** with:

1. Design admin `SELECT`-only (and service-role write) policies on `notification_outbox`.
2. Confirm no admin UI or API path relies on JWT `UPDATE`/`INSERT` on outbox.
3. Keep `adminRequeueNotificationOutbox` on the service-role lifecycle registry.
4. Re-run this audit’s test matrix after RLS migration lands.

Requeue remains **ops-safe**: it resets queue state for the worker; it does **not** guarantee a second email when delivery dedupe applies.

---

## Sign-off

| Role | Status |
|------|--------|
| Stage 5E-1a (failed requeue + API + audit) | **Complete — Pass** |
| Stage 5E-1b-α (global failed UI) | **Complete — Pass** |
| Stage 5E-1b-β (dry-run sent requeue) | **Complete — Pass** |
| Stage 5E governance final audit | **Pass — safe for 5F design** |
