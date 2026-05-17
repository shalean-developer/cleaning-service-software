# Notification outbox worker (Stage 5C-1a / 5C-1b-a)

Delivers **customer `payment_confirmed` and `payment_failed` emails** from `notification_outbox`. All other templates remain `pending` until later stages.

Design: [stage-5c-1b-payment-failed-email-design.md](../architecture/stage-5c-1b-payment-failed-email-design.md)

Enqueue rules: [notification-outbox.md](./notification-outbox.md)  
Audit: [stage-5c-notification-system-operational-messaging-audit.md](../audits/stage-5c-notification-system-operational-messaging-audit.md)

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ENABLE_NOTIFICATION_DELIVERY` | Yes (to send) | off | Must be `true` to process rows |
| `RESEND_API_KEY` | Yes (with Resend) | — | Resend API key |
| `NOTIFICATION_FROM_EMAIL` | Yes | — | Verified sender, e.g. `bookings@yourdomain.com` |
| `NOTIFICATION_SUPPORT_EMAIL` | No | — | Shown in email footer |
| `APP_BASE_URL` or `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Booking detail links |
| `CRON_SECRET` | Yes (cron route) | — | Same as other cron routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Worker reads outbox, bookings, auth |

Optional future: `POSTMARK_SERVER_TOKEN` (not wired in 5C-1a; Resend is the active provider).

## Flag behavior

| State | Worker behavior |
|-------|-----------------|
| `ENABLE_NOTIFICATION_DELIVERY` not `true` | **No-op** — returns `deliveryEnabled: false`, does not query or mutate outbox |
| Flag on, missing `RESEND_API_KEY` or `NOTIFICATION_FROM_EMAIL` | **No-op** — same as disabled |
| Flag on, provider configured | Processes up to **25** deliverable email rows per run (`payment_confirmed`, `payment_failed`) |

Rows are **never** marked `sent` when delivery is disabled.

## Supported templates

| Template | Delivered? |
|----------|------------|
| `payment_confirmed` | **Yes** (email) |
| `payment_failed` | **Yes** (email, Stage 5C-1b-a) |
| `payment_pending` | No |
| `pending_assignment` | No |
| `cleaner_assigned` | No |
| `assignment_offer` (push) | No |
| `booking_draft_created` | No |

### `payment_failed` delivery (5C-1b-a)

| Topic | Behavior |
|-------|----------|
| **Failure reason** | Loaded from latest `booking_state_audit` where `command = MARK_PAYMENT_FAILED` and `metadata.failure_reason` is set (`checkout_expired`, `paystack_declined`, or generic fallback). **Not** from outbox payload or Paystack events. |
| **Copy** | `checkout_expired` → subject “Your Shalean payment link expired”; other reasons → “Payment was not completed for your Shalean booking”. Calm body; no admin/dispatch/gateway details. |
| **Retry guidance** | If `assessPaymentRetryEligibility()` is true, email mentions retry from booking detail; otherwise suggests starting a new booking from the booking page. |
| **Primary link** | `{APP_BASE_URL}/customer/bookings/{bookingId}` |
| **Stale-row guard** | If booking is no longer `payment_failed` when the worker runs, row is marked `failed` (non-retryable) and **no email** is sent. |
| **Delivery dedupe** | If another `payment_failed` row for the same booking is already `sent`, the current row is marked `sent` without a second email. |
| **Enqueue** | Unchanged — still one row per first `MARK_PAYMENT_FAILED` (idempotent command replays do not enqueue). |

## Cron route

`GET` or `POST` `/api/cron/process-notification-outbox`

Headers (either):

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

Response (no email addresses):

```json
{
  "ok": true,
  "deliveryEnabled": true,
  "reclaimed": 0,
  "scanned": 3,
  "sent": 2,
  "skipped": 0,
  "failed": 1,
  "errors": [{ "outboxId": "…", "code": "PROCESS_FAILED", "message": "…" }]
}
```

### Schedule recommendation

- **Production:** every **2–5 minutes** via Supabase `pg_cron` + `pg_net` (mirror [expire-pending-payments-cron.md](./expire-pending-payments-cron.md))
- **Staging:** manual invoke or same schedule with Resend sandbox domain

### Manual trigger (local/staging)

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/process-notification-outbox"
```

## Stale `processing` reclaim (Stage 5C-1c)

If the worker crashes after claiming a row (`pending` → `processing`), reclaim returns it to the queue. **Reclaim does not send email.**

| Variable | Default | Purpose |
|----------|---------|---------|
| `NOTIFICATION_PROCESSING_STALE_MINUTES` | `15` | Stale threshold (10–15 min recommended) |

### Rows eligible for reclaim

| Condition | Required |
|-----------|----------|
| `status` | `processing` |
| `updated_at` | Older than stale threshold (claim time) |
| `attempts` | **&lt;** `NOTIFICATION_MAX_ATTEMPTS` (5) |

### Rows not reclaimed

| Status | Reason |
|--------|--------|
| `sent` | Terminal success |
| `failed` | Terminal failure |
| `pending` | Already queued |
| `processing` (fresh) | Still within stale window |
| `processing` + `attempts >= 5` | Exhausted — leave for ops / manual review |

### Fields set on reclaim

| Field | Value |
|-------|--------|
| `status` | `pending` |
| `next_retry_at` | `now()` |
| `last_error` | `Reclaimed stale processing notification` |
| `attempts` | Unchanged |

Reclaim runs at the **start of every cron invocation** (even when `ENABLE_NOTIFICATION_DELIVERY` is off), before the delivery batch.

Cron response includes `reclaimed` (count reset on that run).

## Worker behavior (summary)

1. Reclaim stale `processing` rows (see above).
2. Select `pending` email rows (retry due or no `next_retry_at`).
3. Filter to `payment_confirmed` or `payment_failed` (email channel only).
4. Claim row: `pending` → `processing`.
5. Resolve `recipient` (`customers.id`) → auth email via `profiles` + `auth.admin.getUserById`.
6. Load booking; for `payment_failed`, load audit reason + retry eligibility; apply stale/dedupe guards.
7. Build transactional template (no admin/dispatch fields).
8. Send via **Resend**.
9. Success → `sent`; retryable failure → `pending` + `next_retry_at`; permanent / max attempts → `failed`.
10. One bad row does not stop the batch.

## Provider setup (Resend)

1. Create a Resend account and verify your sending domain.
2. Add DNS records Resend provides (SPF/DKIM).
3. Set `NOTIFICATION_FROM_EMAIL` to an address on that domain.
4. Use a sandbox API key in non-production.

## Rollback / disable

1. Set `ENABLE_NOTIFICATION_DELIVERY=false` (or unset) in Vercel — **immediate no-op**.
2. Unschedule `pg_cron` job if configured.
3. Existing `pending` rows are safe; nothing is deleted.
4. To re-enable: set flag + env, redeploy, run cron manually once.

Do **not** mark rows `sent` in SQL without a provider send — that would block legitimate delivery.

## Code locations

| Piece | Path |
|-------|------|
| Worker | `src/features/notifications/server/processNotificationOutbox.ts` |
| Cron route | `src/app/api/cron/process-notification-outbox/route.ts` |
| Templates | `src/features/notifications/server/templates/paymentConfirmed.ts`, `paymentFailed.ts` |
| Failure context | `src/features/notifications/server/loadPaymentFailedNotificationContext.ts` |
| Dedupe helper | `src/features/notifications/server/hasSentPaymentFailedForBooking.ts` |
| Recipient resolver | `src/features/notifications/server/resolveCustomerEmail.ts` |

## Staging rollout checklist (`payment_failed`)

1. Confirm `payment_confirmed` emails are stable on staging.
2. Set `ENABLE_NOTIFICATION_DELIVERY=true`, Resend sandbox key, verified sender, correct `APP_BASE_URL`.
3. Use test customers with known emails only.
4. Trigger `MARK_PAYMENT_FAILED` (abandon checkout cron or test decline) and run cron manually.
5. Verify: one email per booking, correct subject for `checkout_expired` vs generic, booking detail link works.
6. Retry payment on same booking → confirm **no second** failure email (stale guard + dedupe).
7. Enable production only after soak; monitor `notification_outbox` counts by template/status.
