# Deferred assignment — staging verification checklist

Use with `DEFERRED_ASSIGNMENT_ENABLED=true` on **staging only** until production enablement is approved.

## A. Flag off behavior

- [ ] Near-term booking (inside 14 days): dispatches immediately after payment (`confirmed` → `pending_assignment` or offer path).
- [ ] Far-future booking (if creatable): still dispatches immediately when flag is off.

## B. Flag on behavior

- [ ] Same-day booking: dispatches immediately after payment.
- [ ] Booking inside 14-day window: dispatches immediately.
- [ ] Booking outside 14-day window: stays `confirmed` with `assignment_dispatch_at` set.
- [ ] No `assignment_offers` row while deferred.
- [ ] No `pending_assignment` notification / customer “finding cleaner” copy while deferred.
- [ ] Customer sees: “Your booking is confirmed. We'll assign your cleaner closer to the service date.”

## C. Cron behavior

- [ ] Set `assignment_dispatch_at` in the past (or wait for window); manual cron dispatches booking.
- [ ] Second cron run on same booking: skipped or idempotent (no duplicate open offers).
- [ ] Force one booking to fail engine (e.g. no eligible cleaners); other bookings in batch still process.
- [ ] Batch limit: more than 50 eligible bookings → only 50 attempted per run (spot-check counts in response).

## D. Recovery behavior

- [ ] Future `assignment_dispatch_at`: **not** in recovery queue / no `dispatch_not_started` badge.
- [ ] Past `assignment_dispatch_at` + overdue grace: appears as overdue / recovery eligible if still `confirmed` without offers.
- [ ] `dispatch_not_started` does not appear before `assignment_dispatch_at`.

## E. Dashboard behavior

- [ ] Admin booking detail: **Awaiting dispatch window** with dispatch timestamp and hours/days until dispatch.
- [ ] Admin: **Ready for dispatch** after window opens (within overdue grace).
- [ ] Admin: **Dispatch overdue** after grace with ops attention flag.
- [ ] Customer list + detail: calm deferred copy only (no failure / urgent wording).
- [ ] Cleaner offers/jobs: **empty** for deferred booking until dispatch runs.

## F. Manual dispatch

- [ ] **Dispatch now** on booking detail runs engine; booking reaches `pending_assignment` or offer path.
- [ ] Second click: idempotent / already dispatched message.
- [ ] Audit row: `deferred_dispatch_now` in `admin_operational_audit`.
- [ ] Does not set `bookings.cleaner_id` directly.

## Diagnostics

- [ ] `/admin/assignments` shows deferred diagnostics card with counts and last cron run.
- [ ] `GET /api/admin/assignments/deferred-diagnostics` returns JSON for admins only.
