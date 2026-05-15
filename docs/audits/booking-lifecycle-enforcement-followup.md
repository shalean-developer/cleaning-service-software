# Booking lifecycle enforcement — follow-up audit

## Summary

This follow-up closes the foundation gap for a **central booking command execution layer**, lifecycle guards, payment/assignment invariants, audit metadata, idempotent payment success, auth/middleware scaffolding, Postgres RPCs for atomic transitions, and automated tests. UI and dashboards were intentionally not built.

## What was implemented

- **Command layer:** `executeBookingCommand()` with typed commands (`src/features/bookings/server/commands/`).
- **Guards:** centralized transition + actor policy (`bookingCommandGuards.ts`).
- **Audit:** structured metadata + idempotency fields on `booking_state_audit` (migration `20260515203000_booking_command_layer.sql`).
- **Payment:** `FINALIZE_PAYMENT_SUCCESS` idempotent (audit key + executor short-circuit); `MARK_PAYMENT_FAILED` reachable from `pending_payment`.
- **Assignment:** offers + accept/decline flows; accept blocked once booking leaves `pending_assignment`.
- **`pending_assignment` gate:** `MOVE_TO_PENDING_ASSIGNMENT` requires at least one **paid** payment for the booking.
- **Earnings:** only when `MARK_COMPLETED` sets `recordEarningsSnapshot` with explicit non-negative cents and `earningsCleanerId` (no implicit split).
- **Notifications:** outbox rows appended on key transitions (in-memory; production should reuse the same hooks after RPC wiring).
- **Security scaffolding:** `getCurrentUser()`, `requireProfileRole()`, `src/middleware.ts` (session + coarse role/path alignment), Supabase server client + public env helper.
- **DB atomicity:** RPCs `booking_apply_transition`, `booking_finalize_payment_success`, `booking_record_payment_failure` (executed by `service_role` only in migration grants).
- **Tests:** Vitest coverage for transitions, idempotency, payment gate, admin audit, double-accept guard, direct patch guard (`npm test`).

## Unsafe direct mutations search (repository scan)

Patterns searched: `from("bookings").update`, `.update({ status`, `UPDATE bookings`, `booking_status` writes.

| Location | Classification |
|----------|------------------|
| `supabase/migrations/*.sql` | **Migration/schema only** — defines tables, RPCs, enums |
| `docs/database-plan.md`, `docs/booking-lifecycle.md` | **Safe read-only** documentation (references updated to command layer) |
| `src/lib/database/types.ts`, `src/features/bookings/server/types.ts` | **Safe read-only** type definitions |
| Application TS/TSX under `src/` | **No matches** — no ad hoc booking status updates detected |

## Refactors

- Removed legacy `BOOKING_COMMAND_NAMES` / `applyBookingCommand` graph; lifecycle is now command-type driven.
- Deleted empty migration `20260515201042_core_foundation.sql`.
- Route-group layouts now call `requireProfileRole([...])` for customer/admin/cleaner shells.

## Remaining gaps

- **Supabase runtime adapter:** production code still needs a server-only module that maps each command to RPC / DML in the same order as `executeBookingCommand` (reuse guards; call `booking_*` functions).
- **RLS:** not enabled on `public.*` yet — see `docs/security/rls-plan.md`.
- **Middleware vs layouts:** middleware enforces “signed in” + profile role vs path prefix; layouts re-check role. Admin impersonation / cross-role support is not implemented.
- **Customer id resolution:** `actingCustomerId` in `BookingCommandRunContext` must be populated server-side from `customers.profile_id` — not wired here.
- **Transactional scope:** offer + status composite actions are not a single DB transaction yet.
- **Service role usage:** document and confine to Vercel/Node server routes; never expose to the client.

## Next recommended phase

1. Implement `createSupabaseBookingCommandBackend` using service-role client + RPCs.  
2. Enable RLS per `rls-plan.md` with `profiles.role` authoritative checks (never `user_metadata`).  
3. Add integration tests against `supabase db reset` local stack.  
4. Wire Paystack webhooks to `FINALIZE_PAYMENT_SUCCESS` / `MARK_PAYMENT_FAILED` with provider idempotency keys.
