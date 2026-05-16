# Booking command execution layer

## Purpose

All booking lifecycle mutations, payment state transitions that affect bookings, cleaner assignment transitions, audit rows, notification outbox rows, and guarded earnings snapshots must flow through **`executeBookingCommand()`** (`src/features/bookings/server/commands/executeBookingCommand.ts`).

Persistence is delegated to a **`BookingCommandBackend`** port:

| Backend | When used |
|---------|-----------|
| `InMemoryBookingCommandBackend` | Unit tests; local dev when `BOOKING_COMMAND_BACKEND=memory` and no service role key |
| `SupabaseBookingCommandBackend` | Production and integration tests when `SUPABASE_SERVICE_ROLE_KEY` is set |

Use **`runBookingCommand()`** (`runBookingCommand.ts`) from server code to pick the backend automatically.

## Guard ordering (unchanged)

1. `assertActorAuthorizedForCommand`
2. Ownership context (`actingCustomerId` / `actingCleanerId` from `resolveActorScope.ts`)
3. `assertTransitionShape`
4. Backend persist (RPC or DML)

## Who may mutate `bookings.status`

| Allowed | Mechanism |
|---------|-----------|
| Yes | `booking_apply_transition`, `booking_finalize_payment_success`, `booking_record_payment_failure` (Postgres RPCs) |
| Yes | `SupabaseBookingCommandBackend` calling those RPCs only |
| Yes | `InMemoryBookingCommandBackend` (tests) |
| No | Direct `supabase.from('bookings').update({ status })` in app code |
| No | Patches that include `status` — blocked by `forbidBookingStatusInPatch()` |

A static Vitest scan (`bookingStatusMutationGuard.test.ts`) fails CI if application code introduces direct booking status updates outside the approved adapters.

## Command → persistence mapping

| Command | Booking status effect | Persistence |
|--------|------------------------|-------------|
| `CREATE_BOOKING_DRAFT` | → `draft` | Insert `bookings` + audit |
| `MARK_PAYMENT_PENDING` | → `pending_payment` | Insert `payments` + `booking_apply_transition` |
| `FINALIZE_PAYMENT_SUCCESS` | → `confirmed` | `booking_finalize_payment_success` |
| `MARK_PAYMENT_FAILED` | → `payment_failed` | `booking_record_payment_failure` |
| `MOVE_TO_PENDING_ASSIGNMENT` | → `pending_assignment` | `booking_apply_transition` (requires paid payment) |
| `OFFER_TO_CLEANER` | (none) | Insert `assignment_offers` |
| `DECLINE_CLEANER_ASSIGNMENT` | (none) | Update offer |
| `ACCEPT_CLEANER_ASSIGNMENT` | → `assigned` | `booking_apply_transition` + offer update |
| `MARK_IN_PROGRESS` | → `in_progress` | `booking_apply_transition` |
| `MARK_COMPLETED` | → `completed` | `booking_apply_transition` + optional `earning_lines` |
| `CANCEL_BOOKING` | → `cancelled` | `booking_apply_transition` |
| `ADMIN_OVERRIDE_STATUS` | arbitrary | `booking_apply_transition` from current status |

## Server-only clients

- **User session:** `src/lib/supabase/server.ts` (anon key + cookies)
- **Commands / webhooks:** `src/lib/supabase/serviceRole.ts` — never import from client bundles (`import "server-only"`)

## Actor scope

`src/lib/auth/resolveActorScope.ts` maps `profiles.id` + role to `customers.id` / `cleaners.id` for `BookingCommandRunContext`.

## Environment

| Variable | Effect |
|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Enables Supabase backend when `BOOKING_COMMAND_BACKEND` is unset |
| `BOOKING_COMMAND_BACKEND` | `memory` \| `supabase` (explicit override) |
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | API URL for service role client |
| `BOOKING_COMMAND_RUN_REMOTE_INTEGRATION` | Must be `true` to run integration tests against remote Supabase |

## Integration tests

See [booking-command-integration-tests.md](../testing/booking-command-integration-tests.md) for local vs remote setup, opt-in rules, and cleanup behavior.

## Blocked until later phases

| Concern | Phase |
|---------|-------|
| Row Level Security on user-facing tables | Phase 2 |
| Deny `authenticated` direct `bookings.status` updates | Phase 2 |
| Paystack initialize / webhook / verify | Implemented — see [paystack-foundation.md](../payments/paystack-foundation.md) |
| Unified `execute_booking_command(jsonb)` RPC | Optional follow-up |
| Profile bootstrap trigger on signup | Phase 2 |

## Related migrations

- `20260515201500_core_foundation.sql` — core tables + append-only audit trigger  
- `20260515203000_booking_command_layer.sql` — audit columns, idempotency index, atomic RPCs (service_role execute only)
