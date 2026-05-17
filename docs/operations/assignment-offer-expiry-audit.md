# Assignment offer expiry audit (Stage 5K-1a / 5K-2a)

Per-offer `booking_state_audit` rows are written when the offer expiry cron expires an assignment offer.

**Related:** [expire-assignment-offers-cron.md](./expire-assignment-offers-cron.md), [assignment-decline-redispatch.md](./assignment-decline-redispatch.md), [stage-5k-assignment-expiry-audit-convergence-design.md](../architecture/stage-5k-assignment-expiry-audit-convergence-design.md), [stage-5k-2-command-owned-assignment-offer-expiry-design.md](../architecture/stage-5k-2-command-owned-assignment-offer-expiry-design.md)

## What ships in 5K-2a (cron path)

| Topic | Behavior |
|-------|----------|
| Cron scan | Read-only `assignment_offers` SELECT in `expireOffers.ts` |
| Expiry command | `EXPIRE_ASSIGNMENT_OFFER` — guarded `offered` → `expired` + audit |
| Actor | `service` for cron |
| Idempotency | `cron:expire-offer:{offerId}` |
| Fail-soft | If the command fails, offer stays `offered`; batch continues; `assignment_offer_expire_command_failed` log |
| Booking follow-up | `processBookingAfterOfferExpiry` unchanged (after successful command per offer) |
| Admin UI | State audit shows **Cleaner offer expired** for `EXPIRE_ASSIGNMENT_OFFER` and legacy `RECORD_ASSIGNMENT_OFFER_EXPIRED` |

## `RECORD_ASSIGNMENT_OFFER_EXPIRED` (retained)

Audit-only command for **non-cron** paths where the offer row is already `expired` before audit (accept/decline reject, dispatch sweep — see 5K-1c). Cron no longer calls it.

## Deferred

- **5K-2b** — `booking_expire_assignment_offer` RPC (transactional offer + audit)
- **5K-1c** — audit on accept/decline inline expiry paths
- **5K-3** — audit on `OFFER_TO_CLEANER` auto-redispatch

## Idempotency

```
cron:expire-offer:{offerId}
```

Re-running the cron for the same offer does not duplicate audit rows (command returns idempotent success when the key already exists).

## Audit metadata (allowlisted)

| Field | Example |
|-------|---------|
| `offerId` | UUID |
| `cleanerId` | UUID |
| `expiredAt` | ISO timestamp |
| `expirySource` | `cron` |
| `previousOfferStatus` | `offered` |

No recipient email or admin free-text in metadata.

## Failure handling

If `EXPIRE_ASSIGNMENT_OFFER` fails:

1. Offer remains `offered` when persistence rolls back (in-memory and Supabase backends attempt rollback after failed audit append).
2. `processBookingAfterOfferExpiry` is **not** run for that offer's booking in the same batch pass.
3. Logs include `event: assignment_offer_expire_command_failed` with `bookingId`, `offerId`, and error code/message.

**Note:** Without DB RPC (5K-2b), a crash between offer update and audit append is still a rare ops edge case; monitor logs and expired offers table.
