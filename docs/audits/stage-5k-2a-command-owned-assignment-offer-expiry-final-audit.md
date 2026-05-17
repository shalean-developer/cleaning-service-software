# Stage 5K-2a Final Audit — Command-Owned Assignment Offer Expiry

**Date:** 2026-05-17  
**Auditor:** Automated code + test verification  
**Scope:** Cron offer expiry via `EXPIRE_ASSIGNMENT_OFFER` (5K-2a)  
**Design reference:** [stage-5k-2-command-owned-assignment-offer-expiry-design.md](../architecture/stage-5k-2-command-owned-assignment-offer-expiry-design.md)  
**Prior slice:** [stage-5k-1a-assignment-offer-expiry-audit-final-audit.md](./stage-5k-1a-assignment-offer-expiry-audit-final-audit.md)

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Is 5K-2a complete? | **Yes** |
| Cron free of direct `assignment_offers.status` DML? | **Yes** — `expireOffers.ts` is SELECT-only |
| Command owns `offered` → `expired` + audit? | **Yes** — `EXPIRE_ASSIGNMENT_OFFER` + `backend.expireAssignmentOffer` |
| Safe to close **cron** Stage 5K convergence scope? | **Yes** — cron path matches payment-expiry pattern |
| Full Stage 5K program closed? | **No** — 5K-1c / 5K-3 / 5K-2b remain optional follow-ups |

---

## Audit checklist

| # | Check | Result | Evidence |
|---|--------|--------|----------|
| 1 | `EXPIRE_ASSIGNMENT_OFFER` exists | **Pass** | `types.ts` L34, L187–193; `BOOKING_COMMAND_TYPES` |
| 2 | Command owns `offered` → `expired` | **Pass** | `inMemoryBookingCommandBackend.expireAssignmentOffer` L251–293; `supabaseBookingCommandBackend.expireAssignmentOffer` L244–249 guarded `UPDATE` |
| 3 | Command writes `booking_state_audit` | **Pass** | `appendAudit` in both backends; audit `command` = `EXPIRE_ASSIGNMENT_OFFER` via `buildAuditEnvelope` |
| 4 | Idempotency `cron:expire-offer:{offerId}` | **Pass** | `buildCronExpireOfferAuditIdempotencyKey` in `recordAssignmentOfferExpiredAudit.ts` L9–11; used in `expireOffers.ts` L55 |
| 5 | Already `expired` → idempotent success | **Pass** | `executeBookingCommand.ts` L792–793; test `returns idempotent success when offer is already expired` |
| 6 | Not-yet-expired → rejected | **Pass** | `isOfferPastExpiryAt` L798–799 → `OFFER_NOT_OPEN`; dedicated test |
| 7 | `accepted` / `declined` / `cancelled` rejected | **Pass** | L795–796 `OFFER_NOT_OPEN`; `it.each` in `expireAssignmentOfferCommand.test.ts` |
| 8 | No booking status mutation | **Pass** | `appendAudit(..., booking.status, booking.status)`; `ok(booking.id, r.status, …)` — no `applyTransition` |
| 9 | No notification enqueue | **Pass** | No `enqueueNotificationWhenNotIdempotent` in `EXPIRE_ASSIGNMENT_OFFER` case; test asserts notification count unchanged |
| 10 | `expireOffers.ts` read-only scan | **Pass** | Only `.select()` chain L33–40; **no** `.update(` in file |
| 11 | `expireOffers.ts` calls `executeBookingCommand` | **Pass** | L48–64 per stale row |
| 12 | Not on direct status allowlist | **Pass** | `assignmentOfferStatusMutationGuard.test.ts` — allowlist = backends + `rlsTestSupport` only (no `expireOffers.ts`) |
| 13 | `processBookingAfterOfferExpiry` unchanged | **Pass** | Still thin wrapper → `processBookingAfterOfferEnded` with `outcome: "expired"`; regression tests pass |
| 14 | Admin labels friendly | **Pass** | `describeBookingStateAuditDisplay` maps `EXPIRE_ASSIGNMENT_OFFER` → **Cleaner offer expired** |
| 15 | No RLS/payment/earnings/notification change | **Pass** | No new migrations; no edits under `payments/`, `earnings/`, `notifications/` for 5K-2a; RLS policies unchanged |

---

## Command behavior (verified)

```771:806:src/features/bookings/server/commands/executeBookingCommand.ts
    case "EXPIRE_ASSIGNMENT_OFFER": {
      if (!cmd.idempotencyKey?.trim()) {
        return fail("IDEMPOTENCY_REQUIRED", ...);
      }
      const booking = await backend.getBooking(cmd.bookingId);
      if ((await backend.findAuditsByBookingAndKey(...)).length > 0) {
        return ok(booking.id, booking.status, true);
      }
      const offer = await backend.getOffer(cmd.offerId);
      // OFFER_NOT_FOUND, INVALID_PAYLOAD, expired → idempotent, non-offered → OFFER_NOT_OPEN
      // not past expires_at → OFFER_NOT_OPEN
      const r = await backend.expireAssignmentOffer(cmd, booking.id, cmd.offerId);
      return ok(booking.id, r.status, r.idempotent);
    }
```

| Property | Value |
|----------|--------|
| Actor (cron) | `service` (`expireOffers.ts` L12) |
| Audit metadata | `offerId`, `cleanerId`, `expiredAt`, `expirySource: "cron"`, `previousOfferStatus: "offered"` |
| `responded_at` | **Not set** on expiry (unchanged from prior cron DML — only `status` + `updated_at`) |
| `RECORD_ASSIGNMENT_OFFER_EXPIRED` | **Retained** for non-cron audit-after-DML paths; cron no longer calls it |
| `admin_operational_audit` | **Not used** (correct) |

---

## Cron integration (verified)

```33:103:src/features/assignments/server/expireOffers.ts
  // SELECT stale offered rows only
  for (const offer of data ?? []) {
    const cmdResult = await executeBookingCommand(backend, {
      type: "EXPIRE_ASSIGNMENT_OFFER",
      ...
      idempotencyKey: buildCronExpireOfferAuditIdempotencyKey(offer.id),
    });
    if (!cmdResult.ok) { console.warn(... assignment_offer_expire_command_failed ...); continue; }
    if (!cmdResult.idempotent) { expiredCount += 1; }
    bookingIds.add(offer.booking_id);
  }
  for (const bookingId of bookingIds) {
    await processBookingAfterOfferExpiry(client, backend, bookingId, now);
  }
```

| Invariant | Status |
|-----------|--------|
| No direct offer DML in facade | **Yes** |
| Command failure → no booking follow-up for that offer | **Yes** — failed commands `continue` without `bookingIds.add` |
| Command success (incl. idempotent) → follow-up | **Yes** |
| Fail-soft at batch level | **Yes** — `assignment_offer_expire_command_failed` (replaces 5K-1a audit-only fail-soft) |
| Cron JSON shape | **Unchanged** (`expiredCount`, `bookingIds`, `redispatchedBookingIds`, `attentionBookingIds`) |

---

## Static guards & facade tier (verified)

| Guard | 5K-1a | 5K-2a |
|-------|-------|-------|
| `assignmentOfferStatusMutationGuard` | Allowed `expireOffers.ts` | **`expireOffers.ts` removed** |
| `facadeCommandBoundaryManifest` | Tier D `offer_expiry` | Tier **`command_required`**, `allowedDirectWriteException: false` |

Facade tests for `features/assignments/server/expireOffers.ts`: **5 passed** (includes `executeBookingCommand` boundary).

---

## Admin UI (verified)

| Surface | Behavior |
|---------|----------|
| `describeBookingStateAuditDisplay` | `EXPIRE_ASSIGNMENT_OFFER` and `RECORD_ASSIGNMENT_OFFER_EXPIRED` → same title/description |
| Tests | `adminOperationalHelpers.test.ts` — both command names covered |

---

## Negative checks

| Item | Result |
|------|--------|
| `expireOffers.ts` contains `.update(` on `assignment_offers` | **Absent** (ripgrep) |
| Cron calls `recordAssignmentOfferExpiredAudit` | **Absent** |
| `enqueueNotification` in `EXPIRE_ASSIGNMENT_OFFER` path | **Absent** |
| New RLS migrations | **None** |
| DB RPC `booking_expire_assignment_offer` | **Not implemented** (deferred 5K-2b) |

---

## Test run

Commands executed during audit:

```bash
npm run typecheck
npx vitest run \
  src/features/bookings/server/commands/expireAssignmentOfferCommand.test.ts \
  src/features/assignments/server/expireOffers.test.ts \
  src/features/assignments/server/expireOffers.auditFailSoft.test.ts \
  src/features/assignments/server/assignmentOfferStatusMutationGuard.test.ts \
  src/features/assignments/server/processBookingAfterOfferEnded.test.ts \
  src/features/dashboards/server/adminOperationalHelpers.test.ts
npx vitest run src/tests/security/facadeCommandBoundaryGuard.test.ts -t "features/assignments/server/expireOffers"
```

| Suite | Result |
|-------|--------|
| Typecheck | **Pass** |
| Vitest (6 core files) | **34 / 34 pass** |
| Facade `expireOffers` | **5 / 5 pass** |

Coverage highlights:

- `EXPIRE_ASSIGNMENT_OFFER` — expire + audit, idempotent rerun, already expired, not-yet-expired, terminal statuses, no notifications
- `expireOffers` — command-driven expiry, idempotent cron rerun, redispatch regression
- Fail-soft — command persistence failure leaves offer `offered`, `expiredCount` 0, no follow-up booking
- Static guard — no stray `assignment_offers.status` patches outside backends
- `processBookingAfterOfferEnded` / expiry wrapper — unchanged outcomes including auto-redispatch test

---

## Intentional gaps (deferred — not 5K-2a regressions)

| Gap | Planned slice |
|-----|----------------|
| Accept/decline/dispatch inline expiry → no `EXPIRE_ASSIGNMENT_OFFER` audit | **5K-1c** |
| `OFFER_TO_CLEANER` auto-redispatch invisible in state audit | **5K-3** |
| Non-transactional offer update + audit (crash window) | **5K-2b** RPC |
| Stale RLS migration comment (“cron expiry in expireOffers.ts”) | Cosmetic; no policy change |
| Remove `RECORD_ASSIGNMENT_OFFER_EXPIRED` type | After 5K-1c unification |

---

## Final question

### Is 5K-2a complete?

**Yes.** Cron assignment offer expiry is command-owned: `expireStaleAssignmentOffers` performs a read-only scan and invokes `EXPIRE_ASSIGNMENT_OFFER` per row. Offer status transitions and per-offer audit rows are written only through the command backend, with idempotency `cron:expire-offer:{offerId}`, unchanged booking follow-up policy, and static guards enforcing the boundary.

### Is it safe enough to close the original Stage 5 **cron / assignment audit convergence** scope?

**Yes, for the cron convergence goal** defined in [stage-5k-assignment-expiry-audit-convergence-design.md](../architecture/stage-5k-assignment-expiry-audit-convergence-design.md):

| Original gap | Status after 5K-1a + 5K-2a |
|--------------|----------------------------|
| No per-offer audit on cron expiry | **Closed** — durable `booking_state_audit` per offer |
| Cron DML outside command layer (tier-D) | **Closed** — `EXPIRE_ASSIGNMENT_OFFER` owns transition + audit |
| Idempotent cron reruns | **Closed** — key + status guards |
| Admin visibility for cron expiry | **Closed** — friendly labels for `EXPIRE_ASSIGNMENT_OFFER` |

**Do not treat the entire Stage 5K program as fully closed** if the organization also required:

- Forensic audit on **accept/decline/dispatch-sweep** expiry paths (5K-1c)
- Visibility of **auto-redispatch** (`OFFER_TO_CLEANER`) in state audit (5K-3)
- **Transactional** offer+audit in Postgres (5K-2b)

Those items were explicitly out of 5K-2a scope and do not block signing off **cron offer expiry convergence**.

**Production spot-check (recommended):** After deploy, confirm `booking_state_audit.command = 'EXPIRE_ASSIGNMENT_OFFER'` and `idempotency_key LIKE 'cron:expire-offer:%'` following an hourly cron run.

---

## References

| Doc | Path |
|-----|------|
| Design | [stage-5k-2-command-owned-assignment-offer-expiry-design.md](../architecture/stage-5k-2-command-owned-assignment-offer-expiry-design.md) |
| Master 5K | [stage-5k-assignment-expiry-audit-convergence-design.md](../architecture/stage-5k-assignment-expiry-audit-convergence-design.md) |
| Ops | [assignment-offer-expiry-audit.md](../operations/assignment-offer-expiry-audit.md) |
| Cron | [expire-assignment-offers-cron.md](../operations/expire-assignment-offers-cron.md) |
| 5K-1a audit | [stage-5k-1a-assignment-offer-expiry-audit-final-audit.md](./stage-5k-1a-assignment-offer-expiry-audit-final-audit.md) |
