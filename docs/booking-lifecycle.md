# Booking lifecycle

Canonical statuses (TypeScript + Postgres enum `public.booking_status`):

| Status | Meaning (foundation) |
|--------|----------------------|
| `draft` | Booking created; not yet paid. |
| `pending_payment` | Payment initiated; awaiting confirmation. |
| `confirmed` | Payment succeeded; booking is firm before assignment pool. |
| `pending_assignment` | Paid; dispatch can offer cleaners / accept assignment. |
| `assigned` | Cleaner locked in. |
| `in_progress` | Job started. |
| `completed` | Job finished successfully (terminal). |
| `cancelled` | Cancelled from an allowed prior state (terminal). |
| `payment_failed` | Payment did not succeed; customer may retry to `pending_payment`. |

## Command execution (authoritative)

All lifecycle writes go through **`executeBookingCommand()`** and typed commands (`CREATE_BOOKING_DRAFT`, `FINALIZE_PAYMENT_SUCCESS`, …). See:

- `docs/architecture/booking-command-execution-layer.md`
- `src/features/bookings/server/commands/`

Pure helpers:

- `assertTransitionShape` / `nextStatusForCommand` in `bookingCommandGuards.ts`
- `forbidBookingStatusInPatch` to block accidental ORM status patches

## Payment → assignment invariant

`MOVE_TO_PENDING_ASSIGNMENT` is only valid from `confirmed` **and** requires at least one `payments` row in `paid` for the booking. Cleaner offers require `pending_assignment`.

## Legacy note

Older placeholder command names (`CreateBooking`, `ConfirmPayment`, …) were removed in favor of the explicit command vocabulary above.
