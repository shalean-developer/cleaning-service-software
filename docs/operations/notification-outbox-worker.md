# Notification outbox worker (Stage 5C-1a / 5C-1b-a / 5C-2a / 5C-2b)

Delivers **customer `payment_confirmed` and `payment_failed` emails** and **cleaner `assignment_offer` emails** from `notification_outbox`. Other templates remain `pending` until later stages.

Design: [stage-5c-1b-payment-failed-email-design.md](../architecture/stage-5c-1b-payment-failed-email-design.md), [stage-5c-2-cleaner-offer-notification-design.md](../architecture/stage-5c-2-cleaner-offer-notification-design.md), [stage-5c-2b-notification-worker-queue-reachability-design.md](../architecture/stage-5c-2b-notification-worker-queue-reachability-design.md)

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
| Flag on, provider configured | Processes up to **25** deliverable rows per run (`payment_confirmed`, `payment_failed`, `assignment_offer`) |

Rows are **never** marked `sent` when delivery is disabled.

## Supported-template polling (Stage 5C-2b)

The worker **does not** load the oldest `pending` rows of any template. It polls only rows that match the supported template/channel allowlist in SQL, then applies `isDeliverableOutboxRow` as a safety net.

| Template | Channel (poll + enqueue) |
|----------|--------------------------|
| `payment_confirmed` | `email` |
| `payment_failed` | `email` |
| `assignment_offer` | `push` (delivered as email placeholder) |

### Unsupported-template pending policy

Templates such as `booking_draft_created`, `payment_pending`, `cleaner_assigned`, and unknown templates:

- Stay **`pending`**
- Are **not** selected by the poll query
- Are **not** marked `sent` or `failed` by the worker
- Do **not** block supported rows (no head-of-line blocking)

`scanned` in the cron response counts **deliverable** rows only. `scanned: 0` is normal when the deliverable queue is empty, even if many unsupported `pending` rows exist.

### Deployment note (5C-2a + 5C-2b)

Deploy **5C-2a** (assignment offer email handler) and **5C-2b** (template-scoped polling) **together** before rerunning the cleaner offer staging soak. Either slice alone can leave `assignment_offer` rows undelivered.

## Supported templates

| Template | Delivered? |
|----------|------------|
| `payment_confirmed` | **Yes** (email) |
| `payment_failed` | **Yes** (email, Stage 5C-1b-a) |

### `payment_confirmed` delivery dedupe (5C hotfix)

| Topic | Behavior |
|-------|----------|
| **Delivery dedupe** | If another `payment_confirmed` row for the same `bookingId` is already `sent`, the current row is marked `sent` without a second email (same pattern as `payment_failed`). |
| **Enqueue** | Unchanged — command idempotency still controls how many rows are inserted. |
| **Historical duplicates** | Extra pending/duplicate rows may be drained as `skipped` (no Resend call) when a prior send exists. |
| `payment_pending` | No |
| `pending_assignment` | No |
| `cleaner_assigned` | No |
| `assignment_offer` | **Yes** (email — rows enqueued as `channel: push` until real push ships) |
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

### `assignment_offer` delivery (5C-2a)

| Topic | Behavior |
|-------|----------|
| **Channel note** | Enqueued as `channel: push` from `OFFER_TO_CLEANER`; worker delivers as **email** in this slice (push placeholder). |
| **Recipient** | `cleaners.id` → `profile_id` → auth email |
| **Hydration** | Service label, schedule, suburb/city area (no street line), estimated earnings when preview exists, offer expiry |
| **Primary link** | `{APP_BASE_URL}/cleaner/offers` — accept/decline only in authenticated dashboard |
| **Stale-row guard** | Skip send (mark `sent`) if offer not `offered`, past `expires_at`, booking not `pending_assignment`, or `cleaner_id` already set |
| **Delivery dedupe** | One email per `offerId` — skip if another `assignment_offer` row for same `offerId` is already `sent` |
| **Enqueue** | Unchanged — one row per new offer from `OFFER_TO_CLEANER` |

**Safe detail policy:** No customer name/phone/email, payment details, admin dispatch metadata, or direct accept/decline API links in email body.

**Known limitations:** No email when offer cancelled/replaced before worker runs (row drained as skip); no “offer withdrawn” email; no real push; no per-offer deep link.

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
2. Select `pending` rows where retry is due (`next_retry_at` null or ≤ now) **and** template/channel is in the supported allowlist (5C-2b), oldest first, up to batch size.
3. Apply `isDeliverableOutboxRow` (payload guards, e.g. `offerId` + `bookingId` for offers).
4. Claim row: `pending` → `processing`.
5. Resolve recipient → auth email (`customers.id` or `cleaners.id`).
6. Load booking/offer context; apply stale/dedupe guards per template.
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
| Templates | `paymentConfirmed.ts`, `paymentFailed.ts`, `assignmentOffer.ts` |
| Failure context | `loadPaymentFailedNotificationContext.ts` |
| Offer context | `loadAssignmentOfferNotificationContext.ts` |
| Dedupe helpers | `hasSentPaymentFailedForBooking.ts`, `hasSentAssignmentOfferForOffer.ts` |
| Recipient resolvers | `resolveCustomerEmail.ts`, `resolveCleanerEmail.ts` |

## Staging rollout checklist (`payment_failed`)

1. Confirm `payment_confirmed` emails are stable on staging.
2. Set `ENABLE_NOTIFICATION_DELIVERY=true`, Resend sandbox key, verified sender, correct `APP_BASE_URL`.
3. Use test customers with known emails only.
4. Trigger `MARK_PAYMENT_FAILED` (abandon checkout cron or test decline) and run cron manually.
5. Verify: one email per booking, correct subject for `checkout_expired` vs generic, booking detail link works.
6. Retry payment on same booking → confirm **no second** failure email (stale guard + dedupe).
7. Enable production only after soak; monitor `notification_outbox` counts by template/status.

## Staging rollout checklist (`assignment_offer`)

1. Confirm customer payment emails are stable on staging.
2. `ENABLE_NOTIFICATION_DELIVERY=true`, Resend sandbox, verified sender, correct `APP_BASE_URL`.
3. Use test cleaners with known auth emails only.
4. Trigger `OFFER_TO_CLEANER` (dispatch after payment or admin manual dispatch).
5. Run cron manually; verify one email per offer with subject “New Shalean cleaning job offer”.
6. Confirm CTA opens `/cleaner/offers` (not direct accept URL).
7. Accept offer in dashboard → re-run cron → **no second** email for same `offerId`.
8. Replace/cancel offer before worker runs → confirm pending row is drained without send.
9. Enable production after soak; monitor `assignment_offer` `sent` / `failed` counts.

## Staging verification checklist (5C-2b queue reachability)

Run after **5C-2a + 5C-2b** are deployed to staging:

1. Confirm `ENABLE_NOTIFICATION_DELIVERY=true`, Resend sandbox, `APP_BASE_URL` correct.
2. Note pending counts: unsupported (`booking_draft_created`, `payment_pending`) vs deliverable (`assignment_offer`, payment emails).
3. Trigger `OFFER_TO_CLEANER` for a test cleaner with a known email.
4. Run cron **without** reordering `created_at` on outbox rows.
5. Expect `scanned` ≥ 1 and the new `assignment_offer` row → `sent`.
6. Confirm unsupported rows remain `pending` after the run.
7. Re-run cron → no duplicate offer email for the same `offerId`.
8. Optional SQL — deliverable backlog only:

```sql
select payload->>'template' as template, channel, count(*)
from notification_outbox
where status = 'pending'
  and (
    (channel = 'email' and payload->>'template' in ('payment_confirmed', 'payment_failed'))
    or (channel = 'push' and payload->>'template' = 'assignment_offer')
  )
group by 1, 2;
```
