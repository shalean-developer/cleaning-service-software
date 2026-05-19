# Team earnings foundation (NF-7G)

Additive, reconciliation-first multi-cleaner earning lines. Does **not** replace lead-cleaner payout authority, payment flows, or booking lifecycle transitions.

## Feature flags

| Flag | Default | Purpose |
|------|---------|---------|
| `TEAM_OFFERS_ENABLED` | `false` | Roster + support participation (NF-7C–7F) |
| `TEAM_EARNINGS_ENABLED` | `false` | Multi-line earnings + equal split (NF-7G) |

When `TEAM_EARNINGS_ENABLED=false`, `recordEarningsForBooking` keeps legacy lead-only behavior (one `booking_completion` line, full per-cleaner pool).

## Split policy (MVP)

**Equal split** among expected participants:

- Divisor = `1` (lead) + count of support roster rows in `accepted` or `completed`
- Share = `floor(totalCleanerPayoutCents / divisor)`
- `totalCleanerPayoutCents` comes from the pricing engine (`perCleanerAmountCents × teamSize`)

Example (2-cleaner job, pool 60 000 cents): lead 30 000, support 30 000.

No weighted tiers or manual percentage configuration in this phase.

## Earning line types

| `line_type` | Cleaner | When created |
|-------------|---------|--------------|
| `booking_completion` | `bookings.cleaner_id` (lead) | Lead marks booking completed |
| `team_support_completion` | Support `cleaner_id` | After lead completed **and** support roster `status = completed` |

Metadata:

- `team_earning_role`: `primary` \| `support`
- `team_earning_source`: `legacy_primary` \| `team_split` \| `manual_adjustment` (reserved)

## Trigger rules

1. **Primary line** — on `MARK_BOOKING_COMPLETED` (unchanged hook), via `recordEarningsForBooking`.
   - No accepted support → full pool, `legacy_primary`.
   - Accepted support on roster → equal share, `team_split`.
2. **Support line** — only when:
   - `TEAM_EARNINGS_ENABLED=true`
   - Booking status ∈ `completed`, `payout_ready`, `paid_out`
   - Support roster row `role = support` and `status = completed`
   - Primary `booking_completion` line exists
3. Support may confirm participation before lead completion (NF-7F); earning line is deferred until lead completes, then backfilled from `recordEarningsForBooking` or `markSupportParticipationCompleted`.

Support cleaners who never confirm get **no** `team_support_completion` line.

## Payout batching

Unchanged orchestration: `markBookingEarningsPayoutReady` / `markBookingEarningsPaid` update **all** pending lines for the booking.

Read models:

- Admin payout queue sums `payout_amount_cents` across lines (`earningCount`).
- Cleaner earnings list is scoped by `cleaner_id` (support sees own lines after confirmation).

## Admin reconciliation

`reconcileTeamEarningsForBooking` (surfaced on admin booking detail as `teamEarningsReconciliation`) reports:

- Expected equal share and pool
- `MISSING_SUPPORT_CONFIRMATION` — accepted support, lead done, no support line
- `MISSING_SUPPORT_EARNING_LINE` — support completed roster, no line
- `ORPHAN_SUPPORT_EARNING_LINE` — line without confirmed roster
- `DUPLICATE_CLEANER_COMPLETION_LINES` — duplicate payout protection
- `PRIMARY_SPLIT_MISMATCH` / `SUPPORT_SPLIT_MISMATCH` / `PAYOUT_EXCEEDS_POOL`

## Authority preserved

- `bookings.cleaner_id` remains lifecycle and dispatch authority.
- Historical earning lines are not rewritten.
- No automatic retroactive split for old bookings.

## Migration path (NF-7H+)

- Primary line adjustment when support never confirms (manual_adjustment lines)
- Full team payout orchestration and transfer batching
- Automated pool true-up instead of reconciliation warnings only
