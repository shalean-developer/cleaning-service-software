# Notification outbox

Reliable outbound notifications are queued in `notification_outbox` when booking commands run. **Email delivery is not enabled yet** — there is no worker, Resend/Postmark integration, or template rendering in production.

## Enqueue rules (Stage 5C-0)

When `executeBookingCommand()` persists a lifecycle change, it may insert an outbox row via `enqueueNotificationWhenNotIdempotent()` (`src/features/bookings/server/commands/shouldEnqueueNotificationForCommandResult.ts`).

| Rule | Behavior |
|------|----------|
| **Idempotent command replay** | **Do not enqueue** — same audit/idempotency key or early-return idempotent path |
| **First successful command** | **Enqueue** — one row per template/channel/recipient for that transition |
| **`MARK_PAYMENT_PENDING` retry** | Same `paymentIdempotencyKey` while already `pending_payment` returns idempotent **before** transition shape (no duplicate `payment_pending` row) |
| **No delivery worker** | Rows stay `pending` until Stage 5C-1a+ |

Helper: `shouldEnqueueNotificationForCommandResult(idempotent)` returns `false` when `idempotent === true`. No template-specific exceptions today.

### Templates enqueued from commands

| Template | Channel | Command |
|----------|---------|---------|
| `booking_draft_created` | email | `CREATE_BOOKING_DRAFT` |
| `payment_pending` | email | `MARK_PAYMENT_PENDING` |
| `payment_confirmed` | email | `FINALIZE_PAYMENT_SUCCESS` |
| `payment_failed` | email | `MARK_PAYMENT_FAILED` |
| `pending_assignment` | email | `MOVE_TO_PENDING_ASSIGNMENT` |
| `assignment_offer` | push | `OFFER_TO_CLEANER` |
| `cleaner_assigned` | email | `ACCEPT_CLEANER_ASSIGNMENT` |

Commands without outbox enqueue today: `DECLINE_CLEANER_ASSIGNMENT`, completion/payout transitions, `CANCEL_BOOKING`, assignment attention metadata.

### Recipient field

`recipient` stores `customers.id` or `cleaners.id` (UUID), not an email address. A future worker must resolve profile → auth email before send.

## Delivery worker (Stage 5C-1a)

See **[notification-outbox-worker.md](./notification-outbox-worker.md)** for env vars, cron route, and `payment_confirmed`-only delivery.

| Capability | Status |
|------------|--------|
| Cron `/api/cron/process-notification-outbox` | **Implemented** |
| `payment_confirmed` email via Resend | **Implemented** (flag-gated) |
| `payment_failed` email via Resend | **Implemented** (flag-gated, 5C-1b-a) |
| `assignment_offer` email via Resend | **Implemented** (flag-gated, 5C-2a) |
| Other templates | **Not delivered** — remain `pending` |

## What is not implemented (later stages)

- Customer assignment emails (`pending_assignment`, `cleaner_assigned`)
- Real push (FCM/APNs) — `assignment_offer` rows use `channel: push` as an email placeholder until push ships
- Admin alert emails
- Outbox dedupe unique index (deferred)
- RLS tightening on `notification_outbox` (admin `FOR ALL` remains — see [stage-5c audit](../audits/stage-5c-notification-system-operational-messaging-audit.md))

## Related

- [stage-5c-notification-system-operational-messaging-audit.md](../audits/stage-5c-notification-system-operational-messaging-audit.md)
- [booking-command-execution-layer.md](../architecture/booking-command-execution-layer.md)
