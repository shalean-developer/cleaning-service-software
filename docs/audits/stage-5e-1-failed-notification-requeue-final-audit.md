# Stage 5E-1 — Failed Notification Requeue Final Audit

**Date:** 2026-05-17  
**Type:** Audit only — no code changes  
**Scope:** Stage 5E-1a — failed deliverable notification requeue (booking detail UI, audited API, service-role helper)  
**Related:** [stage-5e-notification-retry-resend-governance-design.md](../architecture/stage-5e-notification-retry-resend-governance-design.md), [notification-outbox-worker.md](../operations/notification-outbox-worker.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md), [stage-5d-notification-observability-final-audit.md](./stage-5d-notification-observability-final-audit.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Migration (`notification_requeue` action) | **Pass** (static) |
| Requeue preconditions (failed + deliverable only) | **Pass** |
| Admin auth + required reason | **Pass** |
| Service-role write path (no browser JWT mutation) | **Pass** |
| No send-in-request / cron from UI | **Pass** |
| Worker dedupe unchanged | **Pass** |
| Audit (`notification_requeue`, fail-soft) | **Pass** |
| Booking-detail UI gating | **Pass** |
| Global page read-only (no requeue) | **Pass** |
| No RLS / worker / payment / assignment / earnings regression | **Pass** (static) |
| Tests & typecheck | **Pass** |
| Service-role registry | **Pass** |

**Overall:** Stage **5E-1 is safe to deploy** after applying migration `20260518190000_admin_operational_audit_notification_requeue.sql` on the target Supabase project. Requeue remains **ops-safe** because delivery dedupe and worker behavior are unchanged; admins must understand that requeue does not guarantee a second email.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Migration adds `notification_requeue` to `admin_operational_audit` actions | **Pass** | `supabase/migrations/20260518190000_admin_operational_audit_notification_requeue.sql` alters `admin_operational_audit_action_check`; static test `admin-operational-audit-notification-requeue.migration.test.ts` |
| 2 | Failed deliverable rows can be requeued | **Pass** | `adminRequeueNotificationOutbox.ts`: `status === failed` + `isDeliverableNotificationRow`; updates to `pending`, `attempts = 0`, `next_retry_at = now()`, `last_error = admin_requeued`; tests for `payment_confirmed`, `payment_failed`, `assignment_offer` |
| 3 | Pending / processing / sent cannot be requeued | **Pass** | Helper rejects `row.status !== 'failed'` with `INVALID_STATUS` + audit; UI `computeNotificationRequeueEligibility` sets `PENDING` / `PROCESSING` / `LIVE_ALREADY_SENT`; tests `it.each(['pending','processing','sent'])` |
| 4 | Unsupported templates cannot be requeued | **Pass** | `isDeliverableNotificationRow` gate → `UNSUPPORTED_TEMPLATE`; mapper/UI `UNSUPPORTED_TEMPLATE` block reason |
| 5 | Admin reason required (8–500 chars) | **Pass** | `validateAdminRecoveryReason` in helper; UI `minLength={8}`, submit disabled until 8 chars; API returns `validation_error` / 400 |
| 6 | Admin auth required | **Pass** | Route `requireApiUser(['admin'])`; helper `user.role !== 'admin'` → 403; route test 401 for unauthenticated |
| 7 | Service-role helper, not browser/JWT mutation | **Pass** | `adminRequeueNotificationOutbox` uses `createServiceRoleClient()`; UI `fetch` to API only; `server-only` module; registry lists `adminRequeueNotificationOutbox.ts` |
| 8 | Requeue does not send email immediately | **Pass** | No import of `sendEmail` / `processNotificationOutbox` in requeue path; no cron call from UI/API |
| 9 | Worker dedupe still applies after requeue | **Pass** | `processNotificationOutbox.ts` still calls `hasSentPaymentConfirmedForBooking`, `hasSentPaymentFailedForBooking`, `hasSentAssignmentOfferForOffer`; preflight `computeDeliveryDedupeWouldBlock` warns API/UI; worker file unchanged for requeue |
| 10 | Audit row with `action = notification_requeue` | **Pass** | `auditAdminNotificationRequeue` → `recordAdminOperationalAudit` with `action: 'notification_requeue'`, sanitized metadata |
| 11 | Audit failure fail-soft | **Pass** | `recordAdminOperationalAudit` never throws; logs `admin_operational_audit_persist_failed`; requeue success not blocked |
| 12 | Booking detail UI shows Requeue only when eligible | **Pass** | `listNotificationsForBooking` passes `{ bookingDetailContext: true }`; `canRequeue` only for failed deliverable; table renders `AdminNotificationRequeueAction` only when `n.canRequeue` |
| 13 | Global `/admin/notifications` has no requeue | **Pass** | Page uses `AdminNotificationOutboxTable` without `showRequeueActions`; test asserts no Requeue on global table |
| 14 | No RLS / worker / payment / assignment / earnings behavior changed | **Pass** | Only new migration alters audit action check; no `notification_outbox` RLS migration; worker/payment/assignment paths untouched in 5E-1 diff |
| 15 | Service-role registry passes | **Pass** | `serviceRoleLifecycleWriteRegistry.test.ts` 2/2; stale `processNotificationOutbox` / `resolveCustomerEmail` entries removed |

---

## Implementation map

| Capability | Primary files |
|------------|----------------|
| Migration | `20260518190000_admin_operational_audit_notification_requeue.sql` |
| Requeue helper | `adminRequeueNotificationOutbox.ts` |
| Dedupe preflight | `computeDeliveryDedupeWouldBlock.ts` |
| Audit sidecar | `auditAdminNotificationRequeue.ts` |
| API | `POST /api/admin/notifications/[outboxId]/requeue` |
| DTO / eligibility | `computeNotificationRequeueEligibility.ts`, `mapNotificationOutboxRowForAdmin.ts`, `listNotificationsForBooking.ts` |
| Booking UI | `AdminBookingNotificationsSection.tsx`, `AdminNotificationOutboxTable.tsx`, `AdminNotificationRequeueAction.tsx` |
| Global health (read-only) | `app/(admin)/admin/notifications/page.tsx` |

---

## Security & safety review

### Intended controls

- **Single write gateway:** All outbox mutations from admin requeue go through `adminRequeueNotificationOutbox` + service role.
- **Optimistic concurrency:** `UPDATE … WHERE id = ? AND status = 'failed'` prevents racing a worker claim in most cases.
- **No PII in audit metadata:** Allowlisted keys only (`outboxId`, `template`, `oldStatus`, `newStatus`, `deliveryDedupeWouldBlock`); no raw payload or email.
- **Rejected attempts audited** when `booking_id` is known (wrong status, unsupported template, conflict).

### Known limitations (accepted for 5E-1)

| Limitation | Risk | Mitigation |
|------------|------|------------|
| Admin JWT still has `FOR ALL` on `notification_outbox` (pre-existing) | Direct Supabase client could mutate outbox | Document break-glass; 5E-1 UI/API use service role only; **5E-4** RLS tightening deferred |
| API is **outbox-scoped**, not booking-scoped | Admin with `outboxId` can requeue without opening booking detail | Same server guards + audit; optional booking-scoped route in later slice |
| Rows missing `payload.bookingId` | No DB audit row (console log only) | Rejected with `MISSING_BOOKING_ID`; deliverable enqueue always includes `bookingId` |
| Dry-run `sent` not requeueable | Staging ops must wait for 5E-1b | By design |
| `notification_requeue` not yet in booking **Admin operations** timeline UI | Forensics via `admin_operational_audit` table/SQL | Slice 2 polish per design |
| Migration not applied → audit insert fails | Silent audit loss (requeue may still succeed) | Deploy migration first; monitor `admin_operational_audit_persist_failed` |

### Dedupe behavior after requeue

Requeue sets row to `pending` but **does not** clear existing `sent` sibling rows. On next cron, worker `hasSent*` checks may mark the row `sent` **without** calling Resend. API returns `deliveryDedupeWouldBlock: true` when preflight detects this; UI copy warns ops.

---

## Test results

| Command / suite | Result |
|-----------------|--------|
| `npm run typecheck` | **Pass** |
| `adminRequeueNotificationOutbox.test.ts` | **Pass** (admin, reason, templates, statuses, dedupe flag, audit) |
| `requeue/route.test.ts` | **Pass** (401, 200 requeued) |
| `AdminBookingNotificationsSection.test.tsx` | **Pass** (Requeue only when `canRequeue`) |
| `AdminNotificationOutboxTable.test.tsx` | **Pass** (no Requeue on global) |
| `serviceRoleLifecycleWriteRegistry.test.ts` | **Pass** (2/2) |
| `processNotificationOutbox.test.ts` | **Pass** (worker unchanged) |
| `computeNotificationRequeueEligibility.test.ts` | **Pass** |
| `admin-operational-audit-notification-requeue.migration.test.ts` | **Pass** |
| `recordAdminOperationalAudit.test.ts` (metadata keys) | **Pass** |

**Combined audit run:** 6 files, 51 tests — all passed (2026-05-17).

---

## Deploy prerequisites

1. Apply `20260518190000_admin_operational_audit_notification_requeue.sql` to staging/production **before** or with app deploy.
2. Smoke: requeue one failed `payment_failed` row on booking detail with reason ≥ 8 chars; confirm row → `pending`, `last_error = admin_requeued`.
3. Confirm `admin_operational_audit` row: `action = notification_requeue`, `outcome = success`.
4. Run notification cron; verify dedupe skip or send per existing worker rules (no duplicate if sibling `sent` exists).
5. Monitor logs for `admin_operational_audit_persist_failed` (should be absent after migration).

---

## Explicitly out of scope (5E-1)

- Resend / force resend of live `sent` rows  
- Dry-run `sent` requeue (5E-1b)  
- Global `/admin/notifications` requeue button (5E-1b)  
- `retry_now` for pending rows (5E-2a)  
- Stale `processing` admin reclaim (5E-2b)  
- `notification_outbox` RLS `SELECT`-only for admin (5E-4)  
- Worker batch / Resend integration changes  

---

## Final recommendation

### Is Stage 5E-1 safe to deploy?

**Yes**, with migration applied first and ops briefed on dedupe behavior (requeue ≠ guaranteed email).

### What should Stage 5E-2 be — global requeue or RLS tightening?

Per [stage-5e-notification-retry-resend-governance-design.md](../architecture/stage-5e-notification-retry-resend-governance-design.md):

| Next slice | Recommendation |
|------------|----------------|
| **5E-1b** (recommended next) | **Global requeue UI** on `/admin/notifications` + dry-run `sent` requeue — same safe helper, broader ops reach, still no force resend |
| **5E-2a / 5E-2b** | `retry_now` for pending deliverable; admin stale `processing` reclaim — after 1b if backlog tuning is needed |
| **5E-4** | **`notification_outbox` RLS tightening** (`SELECT` only for admin JWT) — important for tamper resistance but **does not** fix failed-row ops; do after governed write paths (1a + 1b) are stable |

**Answer:** Prefer **global requeue (5E-1b)** before **RLS tightening (5E-4)**. RLS addresses break-glass JWT mutation risk; global requeue addresses the operational gap left by booking-detail-only UI while reusing the same audited service-role path. Both are valuable; order by ops impact first, governance hardening second.

---

## Sign-off

| Role | Status |
|------|--------|
| Stage 5E-1 implementation | **Complete** |
| Stage 5E-1 audit | **Pass — deploy after migration** |
| Stage 5E-1b (global + dry-run) | **Not started** |
| Stage 5E-4 (outbox RLS) | **Not started** |
