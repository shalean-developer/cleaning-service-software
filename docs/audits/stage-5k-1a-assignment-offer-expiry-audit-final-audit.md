# Stage 5K-1a Final Audit — Assignment Offer Expiry Audit Rows

**Date:** 2026-05-17  
**Auditor:** Automated code + test verification  
**Scope:** Per-offer `booking_state_audit` on cron offer expiry (5K-1a)  
**Design reference:** [stage-5k-assignment-expiry-audit-convergence-design.md](../architecture/stage-5k-assignment-expiry-audit-convergence-design.md)

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Is 5K-1a complete? | **Yes** |
| Durable, idempotent audit on cron expiry? | **Yes** — `RECORD_ASSIGNMENT_OFFER_EXPIRED` + `cron:expire-offer:{offerId}` |
| Assignment behavior unchanged? | **Yes** — tier-D DML, redispatch policy, and `processBookingAfterOfferExpiry` unchanged |
| Should 5K-2 move DML into `EXPIRE_ASSIGNMENT_OFFER`? | **Yes** — recommended next step per master 5K plan; not required to close 5K-1a |

---

## Audit checklist

| # | Check | Result | Evidence |
|---|--------|--------|----------|
| 1 | `RECORD_ASSIGNMENT_OFFER_EXPIRED` exists | **Pass** | `types.ts` L33, L177–183; `executeBookingCommand.ts` L763–804 |
| 2 | Command is audit-only | **Pass** | Only `appendAudit`; no `updateBookingMetadata`, `applyTransition`, or `updateOffer` |
| 3 | Requires `idempotencyKey` | **Pass** | Returns `IDEMPOTENCY_REQUIRED` when missing (`executeBookingCommand.ts` L764–768) |
| 4 | Key format `cron:expire-offer:{offerId}` | **Pass** | `buildCronExpireOfferAuditIdempotencyKey` in `recordAssignmentOfferExpiredAudit.ts` L9–11 |
| 5 | Verifies offer exists and is `expired` | **Pass** | `getOffer`; `OFFER_NOT_FOUND` / `OFFER_NOT_OPEN` if not expired (L777–783) |
| 6 | Does not mutate booking status | **Pass** | `appendAudit(..., booking.status, booking.status)`; tests assert status unchanged |
| 7 | Does not enqueue notifications | **Pass** | No `enqueueNotification` call in command path; test asserts notification count unchanged |
| 8 | Cron calls audit after successful DML | **Pass** | `expireOffers.ts` L53–85 after `updated?.length`; before booking loop |
| 9 | Audit failure fail-soft | **Pass** | `try/catch` + `console.warn` `assignment_offer_expired_audit_failed`; no rollback |
| 10 | `processBookingAfterOfferExpiry` unchanged | **Pass** | Still thin wrapper → `processBookingAfterOfferEnded`; same booking loop L91–98 |
| 11 | Admin friendly audit label | **Pass** | `describeBookingStateAuditDisplay`; admin booking page uses `displayTitle` |
| 12 | `selected_expired_admin` visibility | **Pass** | `resolveAssignmentVisibility.ts` L151–166; unit test |
| 13 | Static offer mutation guard | **Pass** | `assignmentOfferStatusMutationGuard.test.ts` — `expireOffers.ts` still sole tier-D exception |
| 14 | No RLS/payment/earnings/notification change | **Pass** | No migrations; no changes under `payments/`, `earnings/`, `notifications/` for 5K-1a |
| 15 | Tests pass | **Pass** | See § Test run |

---

## Command behavior (verified)

```763:804:src/features/bookings/server/commands/executeBookingCommand.ts
    case "RECORD_ASSIGNMENT_OFFER_EXPIRED": {
      if (!cmd.idempotencyKey?.trim()) {
        return fail(
          "IDEMPOTENCY_REQUIRED",
          "RECORD_ASSIGNMENT_OFFER_EXPIRED requires idempotencyKey.",
        );
      }
      const booking = await backend.getBooking(cmd.bookingId);
      // ... idempotent short-circuit via findAuditsByBookingAndKey ...
      const offer = await backend.getOffer(cmd.offerId);
      // ... OFFER_NOT_FOUND, OFFER_NOT_OPEN if not expired ...
      await backend.appendAudit(auditCmd, booking.id, booking.status, booking.status);
      return ok(booking.id, booking.status, false);
    }
```

| Property | Value |
|----------|--------|
| Actor (cron) | `service` (`recordAssignmentOfferExpiredAudit.ts` L7) |
| Audit metadata | `offerId`, `cleanerId`, `expiredAt`, `expirySource: "cron"`, `previousOfferStatus: "offered"` |
| `admin_operational_audit` | **Not used** (correct) |

---

## Cron integration (verified)

```45:98:src/features/assignments/server/expireOffers.ts
  for (const offer of data ?? []) {
    // tier-D DML: offered → expired (unchanged)
    // ...
    try {
      const auditResult = await recordAssignmentOfferExpiredAudit(backend, { ... });
      if (!auditResult.ok) { console.warn(JSON.stringify({ event: "assignment_offer_expired_audit_failed", ... })); }
    } catch (err) { console.warn(...); }
  }

  for (const bookingId of bookingIds) {
    const outcome = await processBookingAfterOfferExpiry(client, backend, bookingId, now);
    // ...
  }
```

| Invariant | Status |
|-----------|--------|
| DML before audit | Yes — offer must be `expired` before command guard passes |
| Audit before booking orchestration | Yes — per-offer loop completes before `processBookingAfterOfferExpiry` |
| Expiry not rolled back on audit failure | Yes — no `update` after failed audit |
| Cron JSON shape | Unchanged (`expiredCount`, `bookingIds`, `redispatchedBookingIds`, `attentionBookingIds`) |

---

## Admin UI (verified)

| Surface | Behavior |
|---------|----------|
| `describeBookingStateAuditDisplay` | Title: **Cleaner offer expired**; description: **An assignment offer expired before the cleaner accepted.** |
| Admin booking State audit | Renders `displayTitle` with monospace command line below |
| `selected_expired_admin` | **Selected cleaner offer expired — admin action needed** when `path=selected` + `lastOfferOutcome=expired` |

Policy behavior (redispatch vs attention) is unchanged; only labeling improved.

---

## Negative checks

| Item | Result |
|------|--------|
| `admin_operational_audit` for cron | **Absent** |
| Notification enqueue in expiry audit path | **Absent** |
| New `assignment_offers` status writes outside allowlist | **None** (static guard pass) |
| `EXPIRE_ASSIGNMENT_OFFER` / DML in command | **Not implemented** (deferred 5K-2) |

---

## Test run

Commands executed during audit:

```bash
npm run typecheck
npx vitest run \
  src/features/bookings/server/commands/recordAssignmentOfferExpiredCommand.test.ts \
  src/features/assignments/server/expireOffers.test.ts \
  src/features/assignments/server/expireOffers.auditFailSoft.test.ts \
  src/features/assignments/server/processBookingAfterOfferEnded.test.ts \
  src/features/assignments/server/resolveAssignmentVisibility.test.ts \
  src/features/dashboards/server/adminOperationalHelpers.test.ts \
  src/tests/security/assignmentOfferStatusMutationGuard.test.ts
```

| Suite | Result |
|-------|--------|
| Typecheck | **Pass** |
| Vitest (6 files) | **34 / 34 pass** |

Coverage highlights:

- Audit-only command + idempotent rerun + reject when offer still `offered`
- Cron writes `RECORD_ASSIGNMENT_OFFER_EXPIRED` audit; idempotent cron rerun → one audit row
- Fail-soft: expiry succeeds when audit mock returns failure
- `processBookingAfterOfferEnded` / expiry wrapper regression tests
- Admin `mapAuditRow` friendly labels
- `selected_expired_admin` visibility
- Static guard: no stray `assignment_offers.status` patches

---

## Intentional gaps (deferred — not 5K-1a regressions)

| Gap | Planned slice |
|-----|----------------|
| Accept/decline inline expiry → no audit | 5K-1c |
| `OFFER_TO_CLEANER` dispatch sweep → no audit | 5K-1c |
| Auto-redispatch invisible in state audit | 5K-3 |
| Tier-D DML still in `expireOffers.ts` | 5K-2 `EXPIRE_ASSIGNMENT_OFFER` |
| Audit fails after DML with no repair job | Ops runbook; optional future backfill |

---

## Final question

### Is 5K-1a complete?

**Yes.** Cron-expired offers now produce durable, idempotent `booking_state_audit` rows via `RECORD_ASSIGNMENT_OFFER_EXPIRED` without changing assignment redispatch policy, accept/decline, earnings, RLS, or notifications.

### Should 5K-2 move expiry DML fully into `EXPIRE_ASSIGNMENT_OFFER`?

**Yes — that is the right next step**, in this order:

1. **5K-2a — `EXPIRE_ASSIGNMENT_OFFER` command** — Single command performs guarded `offered` → `expired` via `backend.updateOffer` + audit append (atomic intent); retire tier-D patch in `expireOffers.ts`; update static guard allowlist.
2. **5K-2b — Outbox provider lineage** (if still on notification track) — Separate 5J track; do not block 5K-2a.
3. **5K-1c** (can parallelize after 5K-2a) — Wire same audit command for accept/decline/dispatch-sweep expiry paths with distinct idempotency keys.

**Why move DML in 5K-2:** 5K-1a deliberately kept the documented tier-D exception to minimize risk. Full convergence (payment-expiry pattern: one command owns transition + audit) reduces ordering bugs (audit without expiry / expiry without audit) and simplifies cron to `executeBookingCommand` only.

**Do not skip 5K-1a verification in production:** Confirm migration is N/A; deploy app code; spot-check `booking_state_audit` for `command = 'RECORD_ASSIGNMENT_OFFER_EXPIRED'` after hourly cron.

---

## References

| Doc | Path |
|-----|------|
| Ops runbook | [assignment-offer-expiry-audit.md](../operations/assignment-offer-expiry-audit.md) |
| Cron | [expire-assignment-offers-cron.md](../operations/expire-assignment-offers-cron.md) |
| Master design | [stage-5k-assignment-expiry-audit-convergence-design.md](../architecture/stage-5k-assignment-expiry-audit-convergence-design.md) |
