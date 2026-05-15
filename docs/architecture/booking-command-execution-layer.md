# Booking command execution layer

## Purpose

All booking lifecycle mutations, payment state transitions that affect bookings, cleaner assignment transitions, audit rows, notification outbox rows, and guarded earnings snapshots must flow through **`executeBookingCommand()`** (`src/features/bookings/server/commands/executeBookingCommand.ts`).

The in-memory backend (`InMemoryBookingCommandBackend`) is the reference implementation used by unit tests. Production wiring should call the same guards, then persist using:

1. **Postgres RPCs** in `supabase/migrations/20260515203000_booking_command_layer.sql` (`booking_apply_transition`, `booking_finalize_payment_success`, `booking_record_payment_failure`) for atomic booking + payment + audit updates where applicable, and  
2. **Supabase server client** (`src/lib/supabase/server.ts`) with the **service role** only inside trusted server code (never in the browser).

## Command types

Typed discriminated unions live in `src/features/bookings/server/commands/types.ts`. Initial supported commands:

| Command | Booking status effect | Notes |
|--------|------------------------|--------|
| `CREATE_BOOKING_DRAFT` | → `draft` | Creates row + audit |
| `MARK_PAYMENT_PENDING` | `draft` / `payment_failed` → `pending_payment` | Creates `payments` row |
| `FINALIZE_PAYMENT_SUCCESS` | `pending_payment` → `confirmed` | **Idempotent** via `idempotency_key` on audit + executor short-circuit |
| `MARK_PAYMENT_FAILED` | `pending_payment` → `payment_failed` | Optional idempotency on audit |
| `MOVE_TO_PENDING_ASSIGNMENT` | `confirmed` → `pending_assignment` | Blocked unless a **paid** payment exists for the booking |
| `OFFER_TO_CLEANER` | (none) | Inserts `assignment_offers` only |
| `DECLINE_CLEANER_ASSIGNMENT` | (none) | Updates offer |
| `ACCEPT_CLEANER_ASSIGNMENT` | `pending_assignment` → `assigned` | Sets `cleaner_id` |
| `MARK_IN_PROGRESS` | `assigned` → `in_progress` | Cleaner-scoped when actor is cleaner |
| `MARK_COMPLETED` | `in_progress` → `completed` | Earnings only with explicit cents + cleaner id |
| `CANCEL_BOOKING` | → `cancelled` | Customer ownership enforced via run context |
| `ADMIN_OVERRIDE_STATUS` | arbitrary | Admin-only; requires `reason`; always audited |

## Guards & audit

- **Role / actor policy:** `bookingCommandGuards.ts` → `assertActorAuthorizedForCommand`  
- **Transition shape:** `assertTransitionShape` + `nextStatusForCommand`  
- **Audit envelope:** `bookingCommandAudit.ts` → `buildAuditEnvelope` (payload + metadata mirror for DB compatibility)

## Direct mutation guard

`forbidBookingStatusInPatch()` (`src/features/bookings/server/directMutationGuard.ts`) throws if application code attempts to patch `status` on booking-shaped objects. Wrap repository update payloads where helpful.

## Persistence gaps (intentional)

- `executeBookingCommand` ships with the **in-memory** backend; a thin Supabase adapter that calls the new RPCs and mirrors the same guard ordering is the next wiring step.  
- `OFFER_TO_CLEANER` / `DECLINE_*` / notification inserts are not yet inside the same Postgres RPC as status changes (documented trade-off until a single `execute_booking_command` RPC is justified).

## Related migrations

- `20260515201500_core_foundation.sql` — core tables + append-only audit trigger  
- `20260515203000_booking_command_layer.sql` — audit columns, idempotency index, atomic RPCs (service_role execute only)
