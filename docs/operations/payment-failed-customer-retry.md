# Payment failed & checkout expired — customer and admin UX

Stage **2B-2b+** surfaces abandoned checkout and payment failures in dashboards. Expiry cron behavior lives in `docs/operations/expire-pending-payments-cron.md`.

## What customers see

| Booking status | Label | Notes |
|----------------|-------|--------|
| `payment_failed` (generic) | **Payment failed** | No assignment copy; not sorted as an upcoming job on home |
| `payment_failed` + `failure_reason: checkout_expired` | **Checkout expired** | From `MARK_PAYMENT_FAILED` audit metadata (cron) |

**Booking list / home:** Failed bookings show the status badge above. Assignment-attention badges are hidden. A short line explains that no cleaner is assigned until payment succeeds.

**Booking detail:** A red **Payment not completed** panel includes reason-specific copy and states that no cleaner is assigned until payment succeeds.

## What admins see

| Signal | Where |
|--------|--------|
| Booking status badge | `Payment failed` (standard label) |
| Attention badge | **Checkout expired** or **Payment failed** from `paymentFailureReason` |
| Detail banner | Explains incomplete payment; notes no assignment/earnings until paid |

Admins have **read-only** visibility — no force-expire or status override controls were added in this slice.

## Production retry payment (Stage 2B-2c)

When `BOOKING_LOCK_REQUIRED=true` (default), eligible `payment_failed` bookings show **Retry payment** on the booking detail page.

### Eligibility (all required)

| Check | Reason if false |
|-------|-----------------|
| Customer owns booking | Detail page not shown |
| `booking.status = payment_failed` | No retry panel |
| `BOOKING_LOCK_REQUIRED=true` | Legacy dev-only path |
| No `paid` payment row | `RETRY_NOT_ELIGIBLE` |
| `metadata.quote.input` present | `RETRY_NOT_SUPPORTED` |
| Valid service area in metadata | `RETRY_NOT_SUPPORTED` |
| Schedule not in the past | `INVALID_SCHEDULE` |
| Server re-quote === `booking.price_cents` | `QUOTE_STALE` |
| Cleaner preference still eligible | `CLEANER_INELIGIBLE` |

### API sequence (browser)

1. **POST** `/api/bookings/{bookingId}/payment-retry-lock`  
   Body: `{ "checkoutIdempotencyKey": "retry:{bookingId}:{uuid}" }`  
   Returns: `lockId`, `paymentIdempotencyKey`, `expiresAt`, `lockedPriceCents`

2. **POST** `/api/paystack/initialize`  
   Body: `{ bookingId, lockId, paymentIdempotencyKey, email }`  
   Returns: `authorization_url`

3. Browser redirects to Paystack (same booking row — no new booking created).

### Fallback

- **Start a new booking** (`/customer/book`) is always available on the payment issue panel.
- If retry returns `QUOTE_STALE`, `RETRY_NOT_SUPPORTED`, `INVALID_SCHEDULE`, or `CLEANER_INELIGIBLE`, the UI shows a safe message directing the customer to start a new booking.

### Error messages (customer-facing)

| API code | Message |
|----------|---------|
| `QUOTE_STALE` | This booking price has changed. Please start a new booking. |
| `ACTIVE_LOCK_EXISTS` | A payment attempt is already open. Please continue or wait for it to expire. |
| `RETRY_NOT_ELIGIBLE` | This booking can no longer be retried. |
| `INVALID_SCHEDULE` | This booking time has passed. Please start a new booking. |
| `CLEANER_INELIGIBLE` | The selected cleaner is no longer available. Please start a new booking. |

## Development (`BOOKING_LOCK_REQUIRED=false`)

Retry button is **hidden** (locks disabled). Use full booking wizard for checkout tests.

## Support / admin guidance

1. Confirm booking status `payment_failed` and latest payment `failed` (not `paid`).
2. Check audit: `command = MARK_PAYMENT_FAILED`, `metadata.failure_reason = checkout_expired` for abandoned checkout.
3. If the customer paid but status is failed, use existing Paystack verify/support workflow (do not patch status in SQL).
4. For eligible bookings, ask the customer to open booking detail and tap **Retry payment**.
5. If retry fails with `QUOTE_STALE`, customer must **start a new booking** (catalog price changed).
6. Cron idempotency key `cron:expire-pending-payment:{paymentId}` prevents duplicate failure transitions.

## Verification queries

```sql
select b.id, b.status, a.metadata->>'failure_reason' as failure_reason, a.created_at
from bookings b
join booking_state_audit a on a.booking_id = b.id
where b.status = 'payment_failed'
  and a.command = 'MARK_PAYMENT_FAILED'
order by a.created_at desc
limit 20;
```

```sql
select booking_id, status, idempotency_key, locked_at, expires_at
from booking_locks
where booking_id = '<booking-uuid>'
order by locked_at desc;
```
