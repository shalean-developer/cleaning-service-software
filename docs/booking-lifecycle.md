# Booking lifecycle

Canonical statuses (TypeScript + Postgres enum `public.booking_status`):

| Status | Meaning (foundation) |
|--------|----------------------|
| `draft` | Booking created; not yet paid. |
| `pending_payment` | Payment initiated; awaiting confirmation. |
| `confirmed` | Payment succeeded; booking is firm before assignment pool. |
| `pending_assignment` | Paid; dispatch can offer cleaners / accept assignment. |
| `assigned` | Cleaner locked in. |
| `in_progress` | Job started by assigned cleaner. |
| `completed` | Job finished; earnings ledger line created. |
| `payout_ready` | Admin approved earnings for settlement. |
| `paid_out` | Admin marked paid (ledger only; terminal). |
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

## Completion and payouts (Phase 10)

After `assigned`, the assigned cleaner runs:

1. `MARK_BOOKING_IN_PROGRESS` (`assigned` → `in_progress`)
2. `MARK_BOOKING_COMPLETED` (`in_progress` → `completed`) — creates `earning_lines` via pricing snapshot

Admin settlement:

3. `MARK_BOOKING_PAYOUT_READY` (`completed` → `payout_ready`)
4. `MARK_BOOKING_PAID_OUT` (`payout_ready` → `paid_out`)

See [earnings and payouts](./earnings/earnings-and-payouts.md).

## Legacy note

Older placeholder command names (`CreateBooking`, `ConfirmPayment`, …) were removed in favor of the explicit command vocabulary above.
