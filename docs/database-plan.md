# Database plan

**Status:** foundation migration added locally (`supabase/migrations`). Row shapes and enums are mirrored in TypeScript at `src/lib/database/types.ts`. Auth wiring and RLS are **not** enabled yet.

## Migration

| File | Purpose |
|------|---------|
| `supabase/migrations/20260515201500_core_foundation.sql` | First schema: enums, core tables, indexes, idempotency constraints, append-only audit trigger |
| `supabase/migrations/20260515203000_booking_command_layer.sql` | Audit columns (`actor_type`, `reason`, `idempotency_key`, `metadata`), partial unique idempotency index, atomic `booking_*` RPCs |

Run locally after [Supabase CLI](https://supabase.com/docs/guides/cli) / `npm install`: `npm run db:start` then `npm run db:reset` (requires Docker).

## Postgres enums (public schema)

| Enum | Values |
|------|--------|
| `user_role` | `customer`, `cleaner`, `admin` |
| `booking_status` | `draft`, `pending_payment`, `confirmed`, `pending_assignment`, `assigned`, `in_progress`, `completed`, `cancelled`, `payment_failed` — aligned with `BookingStatus` in `src/features/bookings/server/types.ts` |
| `payment_status` | `initialized`, `pending`, `paid`, `failed`, `refunded` |
| `assignment_offer_status` | `offered`, `accepted`, `declined`, `expired`, `cancelled` |
| `notification_outbox_status` | `pending`, `processing`, `sent`, `failed` |

## Tables (created in first migration)

| Table | Notes |
|-------|--------|
| `profiles` | `id` → `auth.users(id)`; `role`; RLS deferred (comment on table). |
| `customers` | `profile_id` unique → `profiles`. |
| `cleaners` | `profile_id` unique → `profiles`; `active`. |
| `services` | Catalog: name, duration, `base_price_cents`, `currency`, `active`. |
| `bookings` | `customer_id`, nullable `cleaner_id`, optional `service_id`, `status` (`booking_status` enum), schedule, `price_cents`, optional `series_id`, `metadata` jsonb. **Comments:** status must change only via `executeBookingCommand()` + audit/RPC persistence — see `docs/architecture/booking-command-execution-layer.md`. |
| `payments` | `booking_id`, `payment_status`, provider fields, **`idempotency_key` UNIQUE**, amounts. |
| `payment_events` | Webhook/event log; **`provider_event_id` UNIQUE**; optional `payment_id`. |
| `assignment_offers` | `booking_id`, `cleaner_id`, `assignment_offer_status`, timestamps. |
| `earning_lines` | Per-cleaner lines; optional `booking_id`; `amount_cents`, `line_type`. |
| `notification_outbox` | Outbound queue: `status`, `next_retry_at`, `attempts`, payload. |
| `booking_state_audit` | Append-only lifecycle log: `booking_id`, `from_status`, `to_status`, `command`, `actor_profile_id`, `actor_type`, `reason`, `idempotency_key`, `metadata`, `payload`, `created_at`. **Trigger** blocks `UPDATE`/`DELETE`. Partial unique index on `(booking_id, idempotency_key)` when key set. |

## Indexes

- `bookings (status, scheduled_start)`
- `bookings (customer_id, created_at desc)`
- `bookings (cleaner_id, scheduled_start)` where `cleaner_id is not null`
- `payments (booking_id)`
- `payments (provider_ref)` partial where `provider_ref is not null`
- `payment_events`: unique on `provider_event_id` (implicit btree index)
- `assignment_offers (booking_id, cleaner_id)`
- `earning_lines (cleaner_id, created_at desc)`
- `notification_outbox (status, next_retry_at)`

## Idempotency

- `payments.idempotency_key` — **unique** constraint.
- `payment_events.provider_event_id` — **unique** constraint.

## Security (later phases)

- Row Level Security on user-facing tables; no `service_role` in browser bundles.
- Admin overrides should still go through the same lifecycle / audit path where possible.

## Recurring (future)

- `booking_series` — RRULE + timezone + `customer_id`.
- `bookings.series_id` — already reserved as nullable uuid.

## Typed planning (TypeScript)

- `src/lib/database/types.ts` — `Database`, row types, and enum string unions aligned with the migration.
- When a Supabase project is linked, replace or merge with `supabase gen types typescript --linked`.
