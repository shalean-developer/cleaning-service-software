# Assignment offer race protection (Stage 3C-a)

Prevents more than one cleaner from having an **open** (`offered`) assignment offer on the same booking at the same time.

## One-open-offer rule

| Layer | Rule |
|-------|------|
| **Database** | Partial unique index `idx_assignment_offers_one_open_per_booking` on `(booking_id) WHERE status = 'offered'` |
| **Command** | `OFFER_TO_CLEANER` refuses a second open offer to a different cleaner (`OPEN_OFFER_EXISTS`) |
| **Orchestrator** | `hasOpenOffer` / `isOfferOpenForOps` before redispatch (unchanged from 3B) |

Historical rows (`declined`, `expired`, `cancelled`, `accepted`) are unchanged and do not block a new offer.

Per-cleaner partial unique index `idx_assignment_offers_one_open_per_cleaner` remains in place.

## Migration backfill

Migration: `20260517300000_assignment_offer_one_open_per_booking.sql`

If a booking had multiple `offered` rows before deploy:

1. Rows are **not deleted**.
2. The **newest** row (by `offered_at`, then `created_at`, then `id`) stays `offered`.
3. Older duplicates are set to **`cancelled`** with `responded_at` / `updated_at` set.

Verify after deploy:

```sql
select booking_id, count(*)
from public.assignment_offers
where status = 'offered'
group by booking_id
having count(*) > 1;
```

Should return zero rows.

## What admins should expect

| Situation | Expected behavior |
|-----------|-------------------|
| Normal dispatch | One open offer per booking in admin queue |
| Decline / expiry redispatch | New offer only after prior offer is terminal (`declined` / `expired` / `cancelled`) or past TTL (command may mark stale `offered` → `expired` before redispatch) |
| Two cleaners “seeing” the same job | Should not occur after 3C-a; if reported, check for pre-migration duplicates or cron backlog on expiry |
| Concurrent accept (rare) | Booking assignment still serializes via `booking_apply_transition`; loser gets conflict — accept semantics unchanged |
| Admin replace open offer (4C-a) | Cancel (`cancelled`) then new `offered` — never two open rows; `OPEN_OFFER_EXISTS` if race |

## Admin replace (4C-a)

`POST /api/admin/bookings/:bookingId/replace-open-offer` runs **cancel then offer** in one request:

1. `CANCEL_OPEN_ASSIGNMENT_OFFER` — admin-only command; terminal status `cancelled` (not `expired`).
2. Re-read offers — expect zero ops-open rows.
3. `OFFER_TO_CLEANER` — subject to the same one-open-offer index.

If step 3 races with cron/expiry, the API may return `OPEN_OFFER_EXISTS`; retry after verifying offer table.

## Team assignment caveat

Today’s constraint assumes **single-cleaner dispatch** (`teamSize` forced to `1` in the assignment engine). Future **team assignment** will need a slot-based partial unique index (e.g. per `team_slot`) and must **drop or replace** `idx_assignment_offers_one_open_per_booking`.

## Related docs

- [assignment-decline-redispatch.md](./assignment-decline-redispatch.md) — decline/expiry redispatch (3B)
- [assignment-recovery.md](./assignment-recovery.md) — post-payment recovery (3B-1)
- [stage-3c-offer-race-global-duplicate-protection-design.md](../architecture/stage-3c-offer-race-global-duplicate-protection-design.md) — full design

## Rollback

1. Drop index `idx_assignment_offers_one_open_per_booking`.
2. Redeploy previous app build (optional — command guard is defense in depth).

Cancelled duplicate rows from backfill do not need reversal.
