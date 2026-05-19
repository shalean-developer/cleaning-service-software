# Team assignment foundation (NF-7C)

## Purpose

NF-7C prepares the platform for true multi-cleaner Regular Cleaning jobs by introducing **`booking_cleaners`** — a roster table that can represent multiple cleaners per booking — without changing live assignment, payout, completion, or dispatch behavior.

## What shipped

### Database: `booking_cleaners`

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | Primary key |
| `booking_id` | `uuid` | FK → `bookings` |
| `cleaner_id` | `uuid` | FK → `cleaners` |
| `role` | `booking_cleaner_role` | `primary` \| `support` |
| `status` | `booking_cleaner_status` | `planned` → `offered` → `accepted` / `declined` → `completed` / `removed` |
| `assigned_by_profile_id` | `uuid` nullable | Admin who recorded the row |
| `created_at` / `updated_at` | `timestamptz` | Audit timestamps |

**Constraints**

- Unique `(booking_id, cleaner_id)` — one row per cleaner per booking.
- Partial unique index `idx_booking_cleaners_one_active_primary` — at most one non-removed/declined **primary** per booking.

**Migration:** `supabase/migrations/20260523120000_booking_cleaners_team_foundation.sql`

### RLS

| Role | Access |
|------|--------|
| Admin | SELECT + ALL (read/write for foundation seeding and diagnostics) |
| Cleaner | SELECT own rows (`cleaner_id = auth_cleaner_id()`) |
| Customer | **No policy** — customers do not read `booking_cleaners` directly |

Verification: `supabase/tests/booking_cleaners_rls_nf7c_checks.sql`

### Read models (display-only)

- `src/features/dashboards/server/bookingCleanersReadModel.ts`
  - `listTeamRosterFoundationForBooking` — optional roster for admin detail
  - Label helpers for role/status

### Admin diagnostics

On **Admin → Booking detail**, when `booking_cleaners` rows exist:

- Collapsible section **“Team roster foundation”**
- Shows role, status, cleaner label, updated time
- Copy states NF-7C is display-only; `bookings.cleaner_id` remains live assignment

No customer or cleaner UI promises in this phase.

## Source of truth (unchanged)

| Concern | Authority in NF-7C |
|---------|-------------------|
| Who is assigned to the job | `bookings.cleaner_id` |
| Offers / dispatch | `assignment_offers` + assignment engine |
| Payout / earnings | `earning_lines` + existing calculation |
| Completion / lifecycle | Booking command layer + status transitions |

`booking_cleaners` is **not** active dispatch. Rows may be empty for all production bookings until NF-7D connects the engine.

## Backward compatibility

- Existing bookings are unchanged; no backfill required.
- Single-cleaner flows continue to use `bookings.cleaner_id` only.
- Dashboards and APIs that do not call `listTeamRosterFoundationForBooking` behave as before.
- `cleaner_can_access_booking` is **not** expanded in NF-7C (avoids implicit behavior change).

## Follow-on phases

### NF-7D — Dispatch connection (recommended next)

1. Extend `cleaner_can_access_booking` to include accepted `booking_cleaners` membership (and/or open roster offers).
2. Introduce slot-aware `assignment_offers` uniqueness (`booking_id` + slot) and relax `idx_assignment_offers_one_open_per_booking` where appropriate.
3. On accept/assign commands, sync `booking_cleaners` status with offers and optionally mirror primary into `bookings.cleaner_id` for legacy reads.
4. Update `loadAssignmentContext` `teamSize` from metadata when team dispatch is enabled.
5. Wire assignment engine to create primary + support offers without double-assigning via `cleaner_id` alone.

### NF-7E — Payout & completion

1. Split or attribute `earning_lines` per roster member.
2. Completion rules when multiple cleaners must mark done (or primary completes for team).
3. Customer/cleaner dashboards show roster labels from `booking_cleaners` when active.

## Tests

| Layer | File |
|-------|------|
| Migration structure | `src/tests/database/booking-cleaners-team-foundation.migration.test.ts` |
| RLS catalog (psql) | `supabase/tests/booking_cleaners_rls_nf7c_checks.sql` |
| Read model | `src/features/dashboards/server/bookingCleanersReadModel.test.ts` |
| No behavior drift | `src/tests/nf7c-team-foundation-behavior-safeguards.test.ts` |

## Explicit non-goals (NF-7C)

- No automatic multi-offer creation
- No multi-cleaner auto-assignment
- No `bookings.cleaner_id` semantics change
- No payout or earnings calculation change
- No completion or lifecycle transition change
