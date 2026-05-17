# Assignment decline redispatch (Stage 3B-2a / 3B-2b)

When a cleaner **declines** an assignment offer, follow-up behavior now matches **offer expiry** for auto-dispatch paths.

## Policy summary

| Assignment path | On decline | On expiry (unchanged) |
|-----------------|------------|------------------------|
| `best_available` | Auto-redispatch to next eligible cleaner (if attempts remain) | Same |
| `fallback_best_available` | Auto-redispatch | Same |
| `selected` | **Admin attention** — no silent fallback | Admin attention |

Shared orchestrator: `processBookingAfterOfferEnded()` (outcome `declined` | `expired`).

## Best_available decline

1. Cleaner calls `POST /api/cleaner/offers/[offerId]/decline`.
2. Offer → `declined`; booking stays `pending_assignment`.
3. `handleOfferDeclinedFollowUp()` runs when decline is not idempotent.
4. If path is redispatch-eligible and attempts &lt; 5:
   - Excludes cleaners with prior `declined`, `expired`, or `cancelled` offers on this booking.
   - Creates new `offered` row for next eligible cleaner.
   - Updates `metadata.assignment` → `status: offered`, **path preserved**.
5. Customer still sees “Finding cleaner” until someone accepts.

## Selected cleaner decline

1. Same decline command.
2. **No** auto-redispatch to another cleaner.
3. `metadata.assignment.path` stays `selected`.
4. `metadata.assignment.status` → `attention_required`.
5. Reason: *"Cleaner declined offer; selected cleaner requires admin redispatch."*
6. Admin assignment queue shows booking for manual handling.

## Max dispatch attempts

Cap: **5** total `assignment_offers` rows per booking (initial + redispatches).

When a decline would exceed the cap:

- No new offer created.
- `attention_required` with reason mentioning max attempts after decline.

## Idempotency

| Case | Behavior |
|------|----------|
| Duplicate decline POST | `DECLINE_CLEANER_ASSIGNMENT` idempotent; follow-up **not** run again |
| Open offer already exists | Orchestrator no-ops (`hasOpenOffer`) |
| Same cleaner re-offered | `assignment:offer:{bookingId}:{cleanerId}` idempotent |
| Second cleaner while first offer open | **Blocked** — DB partial unique + `OPEN_OFFER_EXISTS` on command (Stage 3C-a) |

## Admin interpretation (Stage 3B-2b)

Assignment queue and booking detail badges use **visibility keys** (not raw `metadata.assignment.status` alone):

| Badge | Meaning | System state |
|-------|---------|--------------|
| **Cleaner declined — redispatched** | Best-available decline; new offer out | Still searching — no admin action yet |
| **Offer sent — awaiting acceptance** | Open offer, no prior decline on this cycle | Still searching |
| **Finding cleaner** | Pending assignment, dispatch in progress | Still searching |
| **Selected cleaner declined — admin action needed** | Customer chose a cleaner who declined | Admin must re-offer or change path |
| **No cleaner accepted after dispatch attempts** | 5 offers exhausted | Admin must assign manually |
| **Paid — dispatch not started** | Post-payment recovery (3B-1) | Admin / recovery cron |
| **Needs assignment** | Generic attention (expiry, no eligible cleaner, etc.) | Review `assignmentReason` on detail |

**Still searching:** `decline_redispatched`, `finding_cleaner`, `offer_sent` — monitor; customer sees calm copy.

**Admin required:** `selected_declined_admin`, `max_attempts_admin`, `needs_assignment`, `dispatch_not_started`.

## Customer-facing language (Stage 3B-2b)

Customers must **not** see internal decline details or “booking failed” after payment.

| Situation | Customer copy |
|-----------|----------------|
| Redispatch in progress (`pending_assignment`, open offer after decline) | *We're finding another available cleaner.* |
| Selected cleaner declined / max attempts / generic attention | *We're reviewing cleaner availability for your booking.* |
| Confirmed / in progress | Normal booking status only |

Warning badge **“Needs assignment”** is suppressed during active redispatch (`showCustomerAssignmentWarning: false`).

## Support / admin guidance

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Badge: **Cleaner declined — redispatched** | Normal best_available flow | Wait for acceptance; no customer alarm needed |
| Badge: **Selected cleaner declined — admin action needed** | Expected — selected path | Booking detail → **Send offer to cleaner** (eligible cleaner + reason) |
| Badge: **No cleaner accepted after dispatch attempts** | Max 5 offers | Booking detail → **Send offer to cleaner** with max-attempts acknowledgement |
| Customer asks “did my booking fail?” after payment | Usually redispatch — show calm copy | Reassure: payment received; Shalean is matching a cleaner |
| Booking stuck after decline (best_available), no new offer | No eligible cleaners or max attempts | Check assignment queue reason; extend pool or assign manually |
| Two open offers | Should not happen after 3C-a | See [assignment-offer-race-protection.md](./assignment-offer-race-protection.md); run expiry cron; inspect offers table |
| Open offer to cleaner A, need cleaner B now | Cleaner not responding | Booking detail → **Replace open offer** (4C-a) |

## Admin manual dispatch (4B-3a)

When automation cannot finish (`selected_declined_admin`, `max_attempts_admin`, `needs_assignment`):

1. Open **Admin → Bookings → [booking]**.
2. Use **Send offer to cleaner** when the panel is visible (`pending_assignment`, no open offer to someone else).
3. Pick an **eligible** cleaner and enter a **reason** (8–500 characters).
4. If the booking already has **5+ offer rows**, check the max-attempts acknowledgement.

This calls `OFFER_TO_CLEANER` with an **admin** actor — it does **not** set `bookings.cleaner_id`. Assignment completes when the cleaner accepts.

**Customer copy** does not change: they still see calm “finding cleaner” / “reviewing availability” messaging — no “manual dispatch” wording.

## Admin replace open offer (4C-a)

When **exactly one** open offer exists and ops must offer a **different** eligible cleaner without waiting for decline/expiry:

1. Open **Admin → Bookings → [booking]**.
2. Use **Replace open offer** (shown instead of **Send offer** while an offer is open).
3. Pick a **new** eligible cleaner and enter a **reason** (8–500 characters).
4. Acknowledge max attempts if the booking already has **5+** offer rows.

**Flow:** `CANCEL_OPEN_ASSIGNMENT_OFFER` (offer → `cancelled`) then `OFFER_TO_CLEANER` to the new cleaner. **Does not** call auto-redispatch orchestration on cancel. **Does not** set `bookings.cleaner_id`.

**Customer copy:** unchanged — calm “finding cleaner” / “reviewing availability” only.

**Limitations:** No cancel-only API; no push to withdrawn cleaner; not on assignment queue inline.

## Operations

- **Expiry cron:** unchanged schedule — `expire-assignment-offers-hourly`.
- **Decline redispatch:** synchronous on decline API (no extra cron).
- **Post-payment recovery (3B-1):** separate — see [assignment-recovery.md](./assignment-recovery.md).

## Related

- [stage-3b-2-decline-redispatch-policy-design.md](../architecture/stage-3b-2-decline-redispatch-policy-design.md)
- [assignment-offer-race-protection.md](./assignment-offer-race-protection.md) — one open offer per booking (3C-a)
- [assignment-engine.md](../assignments/assignment-engine.md)
- [expire-assignment-offers-cron.md](./expire-assignment-offers-cron.md)
