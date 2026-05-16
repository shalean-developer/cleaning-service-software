# Assignment engine (Phase 8)

Connects **paid** bookings to cleaners via assignment offers. Payment success is never rolled back when assignment fails.

## Trigger

After `finalizePaidBooking` runs `FINALIZE_PAYMENT_SUCCESS` (`confirmed`), `runAssignmentAfterPayment()`:

1. `MOVE_TO_PENDING_ASSIGNMENT` (idempotent)
2. Loads assignment context from `booking_locks` (preferred) or `bookings.metadata`
3. Dispatches an offer or records admin attention metadata

## MVP policy: offer-based acceptance

Both **selected** and **best available** paths create an `assignment_offers` row with status `offered`. Cleaners must **accept** via API before the booking becomes `assigned`.

**Why not direct auto-assign?** MVP keeps a single acceptance path, audit trail, and decline/expiry handling without skipping cleaner consent.

| Path | Behavior |
|------|----------|
| Selected cleaner | Re-check eligibility → offer to selected cleaner |
| Selected ineligible | Fallback offer to best eligible cleaner if policy allows |
| Best available | Rank eligible cleaners (Phase 5) → offer to top pick |
| No eligible cleaner | `metadata.assignment.status = attention_required`; booking stays `pending_assignment` |

## Lifecycle

| Booking status | Offer status | Meaning |
|----------------|--------------|---------|
| `confirmed` | — | Paid; assignment not started yet |
| `pending_assignment` | `offered` | Awaiting cleaner accept |
| `pending_assignment` | `declined` / `expired` | Needs redispatch (attention metadata) |
| `assigned` | `accepted` | Cleaner linked on booking |

Booking status does **not** include `offered`; offer state lives on `assignment_offers`.

## Cleaner APIs

| Route | Purpose |
|-------|---------|
| `GET /api/cleaner/offers` | List open offers for signed-in cleaner |
| `POST /api/cleaner/offers/[offerId]/accept` | `ACCEPT_CLEANER_ASSIGNMENT` |
| `POST /api/cleaner/offers/[offerId]/decline` | `DECLINE_CLEANER_ASSIGNMENT` + attention metadata |

Rules: own offers only; expired offers rejected; duplicate accept idempotent; accepting cancels other open offers on the same booking.

## Expiry and redispatch

- Default offer TTL: **48 hours** (`ASSIGNMENT_OFFER_TTL_HOURS`)
- `expireStaleAssignmentOffers()` — safe to run manually or from future cron
- Expired/declined bookings remain visible with `metadata.assignment` for admin ops

## Data integrity

- Unique partial index: one `offered` row per `(booking_id, cleaner_id)`
- Commands only: no direct `bookings.status` updates from clients
- `RECORD_ASSIGNMENT_ATTENTION` writes metadata + audit without changing status

## Deferred

- Customer/cleaner/admin dashboards (Phase 9)
- Payouts and earning lines on completion (Phase 10)
- Automated cron for offer expiry (manual function provided)

## Related

- [Paystack foundation](../payments/paystack-foundation.md)
- [Booking lock](../booking/booking-lock-before-payment.md)
- [Cleaner eligibility](../cleaners/cleaner-availability-eligibility.md)
