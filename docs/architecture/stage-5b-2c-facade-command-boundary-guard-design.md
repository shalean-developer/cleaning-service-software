# Stage 5B-2c — Facade Internal Command Boundary Guard (Design)

**Date:** 2026-05-17  
**Status:** Design only — **no implementation**  
**Depends on:** [stage-5b-2b-mutation-route-command-boundary-design.md](./stage-5b-2b-mutation-route-command-boundary-design.md), [command-boundary-static-guards.md](../security/command-boundary-static-guards.md) (5B-2a/2b)

**Goal:** Design static tests that verify **approved route facades** (and tightly coupled one-hop helpers) use command/backend boundaries internally — not direct lifecycle table writes — without changing production behavior.

**Constraints:** No facade refactors, no RLS, no payment finalize / accept semantics / earnings formula changes, no `ADMIN_OVERRIDE_STATUS` exposure.

---

## Executive summary

| Decision | Recommendation |
|----------|----------------|
| Scope | **Facade entry modules** referenced by `mutationRouteBoundaryManifest.ts` (17 lifecycle) + **one-hop payment/assignment helpers** called only from those facades |
| Test style | Static source scan (same family as 5B-2a/2b) |
| Primary assertion | Lifecycle-mutating facades must **`executeBookingCommand(`** or delegate to an **allowlisted orchestrator** that does |
| Service role | Reuse 5B-2a registry; facades may import service role only if on registry |
| Direct DML | Forbid `bookings`/`payments`/`earning_lines` status writes; **`expireOffers.ts`** remains documented exception for `assignment_offers` |
| Read-only facades | `calculateQuote`, `getAvailableCleaners` / `getBookingCleaners` — no commands, no service role |
| Server Actions | **Defer** to 5B-2d (separate manifest; only provisioning RPC today) |
| Smallest slice (5B-2c) | Facade manifest + guard test for **command-required** and **forbidden DML** tiers; defer one-hop helper expansion |

---

## Relationship to prior slices

```text
5B-2a  table-level guards     (no direct payments/offers.status in random src/)
5B-2b  route-level guards     (routes import approved facades only)
5B-2c  facade-level guards    (facades call executeBookingCommand / allowed orchestrators)
5B-2d+ server actions, DB triggers, RLS narrowing
```

5B-2c closes: “route imports `initializePayment` → but someone adds `.from('payments').update({ status: 'paid' })` inside `initializePayment.ts`.”

---

## 1. Approved facade inventory (from 5B-2b manifest)

Unique **route entry** symbols and their source modules:

| Route facade symbol | Source file | Category |
|-------------------|-------------|----------|
| `createBookingPaymentLock` | `features/bookings/server/lock/createBookingPaymentLock.ts` | customer |
| `createPaymentRetryLock` | `features/bookings/server/lock/createPaymentRetryLock.ts` | customer |
| `initializePayment` | `features/payments/server/initializePayment.ts` | paystack |
| `verifyPayment` | `features/payments/server/verifyPayment.ts` | paystack |
| `handlePaystackWebhook` | `features/payments/server/handlePaystackWebhook.ts` | paystack |
| `acceptCleanerOffer` | `features/assignments/server/respondToOffer.ts` | cleaner |
| `declineCleanerOffer` | `features/assignments/server/respondToOffer.ts` | cleaner |
| `handleOfferDeclinedFollowUp` | `features/assignments/server/handleOfferDeclinedFollowUp.ts` | cleaner |
| `startCleanerJob` | `features/earnings/server/completionActions.ts` | cleaner |
| `completeCleanerJob` | `features/earnings/server/completionActions.ts` | cleaner |
| `markBookingPayoutReadyAdmin` | `features/earnings/server/completionActions.ts` | admin |
| `markBookingPaidOutAdmin` | `features/earnings/server/completionActions.ts` | admin |
| `runAdminManualDispatchOffer` | `features/assignments/server/adminManualDispatchOffer.ts` | admin |
| `runAdminReplaceOpenOffer` | `features/assignments/server/adminReplaceOpenOffer.ts` | admin |
| `runAdminSingleBookingAssignmentRecovery` | `features/assignments/server/adminAssignmentRecovery.ts` | admin |
| `expireStalePendingPayments` | `features/payments/server/expirePendingPayments.ts` | cron |
| `expireStaleAssignmentOffers` | `features/assignments/server/expireOffers.ts` | cron |
| `runAssignmentRecoveryBatch` | `features/assignments/server/runAssignmentRecovery.ts` | cron |

**Read-only route facades (3)** — not lifecycle mutators:

| Symbol | File |
|--------|------|
| `calculateQuote` | `features/pricing/server/calculateQuote.ts` |
| `getAvailableCleaners` | `features/cleaners/server/getAvailableCleaners.ts` |
| `getBookingCleaners` | `features/cleaners/server/getAvailableCleaners.ts` (same module) |

### One-hop helpers (recommended for 5B-2c extended slice, optional in minimal slice)

Called only from route facades; should inherit same rules:

| Helper | Called from | Role |
|--------|-------------|------|
| `finalizePaidBooking` | `processPaystackChargeSuccess` ← verify/webhook | `FINALIZE_PAYMENT_SUCCESS` |
| `processPaystackChargeSuccess` | `verifyPayment`, `handlePaystackWebhook` | Paystack success path |
| `processPaystackChargeFailure` | `handlePaystackWebhook` | `MARK_PAYMENT_FAILED` |
| `createAdminDispatchOffer` | `runAdminManualDispatchOffer` | `OFFER_TO_CLEANER` |
| `createAdminCancelOpenOffer` | `runAdminReplaceOpenOffer` | `CANCEL_OPEN_ASSIGNMENT_OFFER` |
| `recoverAssignmentForBooking` | `runAdminSingleBookingAssignmentRecovery` | `runAssignmentAfterPayment` |
| `runAssignmentAfterPayment` | recovery, cron batch, post-payment | Assignment engine |
| `processBookingAfterOfferEnded` | decline follow-up, offer expiry | Redispatch / attention |
| `createDispatchOffer` | assignment engine | `OFFER_TO_CLEANER` |
| `recordAssignmentOutcome` | engine / offer-ended | `RECORD_ASSIGNMENT_ATTENTION` |

---

## 2. Expected command / service boundary per facade

### Boundary tiers

| Tier | Meaning | Assertion |
|------|---------|-----------|
| **A — command_required** | Must call `executeBookingCommand(` in file OR import/call allowlisted orchestrator that does | Regex + optional orchestrator list |
| **B — payment_orchestrator** | Thin router; must call `processPaystackChargeSuccess` / `processPaystackChargeFailure` (not raw finalize in route-facing file) | Import/call check |
| **C — lock_infra** | Service role for `booking_locks` only; reads booking via backend; **no** `executeBookingCommand` in retry lock | Forbidden status DML only |
| **D — offer_expiry_exception** | `expireStaleAssignmentOffers` may call direct `assignment_offers` update inside `expireOffers.ts` | Allow file in 5B-2a exception set |
| **E — read_only** | No lifecycle commands, no service role | Negative assertions |

### Per-facade map

| Facade | Tier | Must use | Commands / flow (downstream) |
|--------|------|----------|------------------------------|
| `createBookingPaymentLock` | A | `executeBookingCommand` | `CREATE_BOOKING_DRAFT` |
| `createPaymentRetryLock` | C | `createBookingCommandBackend` (read) + lock repo | Lock only; `MARK_PAYMENT_PENDING` happens in `initializePayment` after retry |
| `initializePayment` | A | `executeBookingCommand` | `MARK_PAYMENT_PENDING`; infra patch `payment_link_expires_at` only |
| `verifyPayment` | B | `processPaystackChargeSuccess` | → `finalizePaidBooking` → `FINALIZE_PAYMENT_SUCCESS` |
| `handlePaystackWebhook` | B | `processPaystackChargeSuccess` / `processPaystackChargeFailure` | No direct `executeBookingCommand` in webhook file (delegation) |
| `acceptCleanerOffer` / `declineCleanerOffer` | A | `executeBookingCommand` | `ACCEPT_*` / `DECLINE_*` |
| `handleOfferDeclinedFollowUp` | A | via `processBookingAfterOfferEnded` → commands | No direct offer status patch in follow-up file |
| `startCleanerJob` / `completeCleanerJob` | A | `executeBookingCommand` | `MARK_BOOKING_IN_PROGRESS` / `MARK_BOOKING_COMPLETED` |
| `markBookingPayoutReadyAdmin` / `markBookingPaidOutAdmin` | A | `executeBookingCommand` | `MARK_BOOKING_PAYOUT_READY` / `MARK_BOOKING_PAID_OUT` |
| `runAdminManualDispatchOffer` | A | via `createAdminDispatchOffer` | `OFFER_TO_CLEANER`; service-role **reads** preflight |
| `runAdminReplaceOpenOffer` | A | `createAdminCancelOpenOffer` + `createAdminDispatchOffer` | Cancel + offer commands |
| `runAdminSingleBookingAssignmentRecovery` | A | `recoverAssignmentForBooking` → `runAssignmentAfterPayment` | Engine commands |
| `expireStalePendingPayments` | A | `executeBookingCommand` per row | `MARK_PAYMENT_FAILED`; service-role **read** scan |
| `expireStaleAssignmentOffers` | D | `expireOffers` + `processBookingAfterOfferExpiry` | Direct offer expiry + command follow-up |
| `runAssignmentRecoveryBatch` | A | `runAssignmentAfterPayment` | Engine; service-role **read** candidates |
| `calculateQuote` | E | — | Pure pricing math |
| `getAvailableCleaners` / `getBookingCleaners` | E | — | Eligibility reads (service role for cross-customer schedule read) |

---

## 3. Payment finalize / failure RPC helpers

**Rule:** Only modules on the payment spine may call `finalizePaidBooking`, `processPaystackChargeSuccess`, or `processPaystackChargeFailure`.

| Module | May call finalize/failure helpers | Must call `executeBookingCommand` |
|--------|-----------------------------------|----------------------------------|
| `finalizePaidBooking.ts` | Defines finalize path | **Yes** (`FINALIZE_PAYMENT_SUCCESS`) |
| `upsertBookingFromPaystack.ts` (`processPaystackChargeSuccess`) | Yes | Via `finalizePaidBookingWithDeps` |
| `processPaystackChargeFailure.ts` | Yes | **Yes** (`MARK_PAYMENT_FAILED`) |
| `verifyPayment.ts` | Via `processPaystackChargeSuccess` only | No (orchestrator B) |
| `handlePaystackWebhook.ts` | Via process* only | No (orchestrator B) |
| `initializePayment.ts` | **No** | Yes (`MARK_PAYMENT_PENDING` only) |

**Do not touch** `finalizePaidBooking` or RPC bodies in 5B-2c — tests only **reference** these modules, no behavior change.

**Forbidden in non-payment facades:** `finalizePaidBooking`, `booking_finalize_payment_success` string in assignment/admin facades.

---

## 4. Service-role policy (facades)

Align with [serviceRoleLifecycleWriteRegistry.test.ts](../../src/tests/security/serviceRoleLifecycleWriteRegistry.test.ts).

### Facades that **may** import service role (today)

| Facade / helper | Why |
|-----------------|-----|
| `createBookingPaymentLock` | Lock insert/consume |
| `createPaymentRetryLock` | Lock insert/expiry |
| `initializePayment` | Payment row + link expiry patch |
| `verifyPayment` | Payment lookup + ownership check |
| `finalizePaidBooking`, `processPaystackCharge*` | Payment commands |
| `expirePendingPayments` | Batch read scan (client passed in) |
| `adminManualDispatchOffer`, `adminReplaceOpenOffer`, `adminAssignmentRecovery` | Admin preflight reads |
| `runAssignmentRecovery` | Candidate query reads |
| `getAvailableCleaners` | Read-only eligibility (schedule overlap) |

### Facades that **must not** import service role

| Facade | Why |
|--------|-----|
| `respondToOffer.ts` | Uses user-scoped server client in route + backend |
| `completionActions.ts` | `createBookingCommandBackend()` only |
| `handlePaystackWebhook.ts` | Delegates to payment modules |
| `handleOfferDeclinedFollowUp.ts` | Receives client from route |
| `expireOffers.ts` | Receives client from cron route |
| `calculateQuote.ts` | Stateless |

**5B-2c test:** Facade file on mutation manifest → if not in service-role registry, must not import `@/lib/supabase/serviceRole`.

---

## 5. Facades that must never write lifecycle tables directly

| Table / field | Rule |
|---------------|------|
| `bookings.status` | **Never** in facades — only via `executeBookingCommand` → RPC |
| `payments.status` | **Never** in facades — only via finalize/fail RPCs inside payment modules |
| `earning_lines` | **Never** insert/update in facades — only `SupabaseBookingCommandBackend` via commands |
| `assignment_offers.status` | Only in **`expireOffers.ts`** (tier D) and command backend |

### Allowed non-status writes (infra)

| Pattern | Facade | Field |
|---------|--------|-------|
| `booking_locks` insert/update | lock facades | lock status |
| `payments` update without `status` | `initializePayment` | `payment_link_expires_at` |
| `paymentRepository.updatePaymentProviderRef` | payment stack | `provider_ref` |
| `payment_events` insert | `recordPaymentEvent` | — |
| `admin_operational_audit` insert | admin sidecar | — |

---

## 6. Forbidden internal direct-write patterns

Apply to **tier A/B/C** facade files (and one-hop helpers when included):

```ts
// Status and lifecycle DML
/\.from\s*\(\s*["']bookings["']\s*\)[\s\S]*?\.update\s*\(\s*\{[^}]*\bstatus\b/
/\.from\s*\(\s*["']payments["']\s*\)[\s\S]*?\.update\s*\(\s*\{[^}]*\bstatus\b/
/payment\.status\s*=(?!=)/  // assignment only, exclude ===

// Forbidden command bypass
/\bADMIN_OVERRIDE_STATUS\b/
/booking_finalize_payment_success\s*\(/   // RPC only via backend
/booking_apply_transition\s*\(/            // RPC only via backend (except supabaseBookingCommandBackend)

// Direct earning_lines mutation in facades
/\.from\s*\(\s*["']earning_lines["']\s*\)[\s\S]*?\.(update|insert)\s*\(/
```

**Tier D exception file:** `expireOffers.ts` — allow `assignment_offers` update pattern only in that path (already in 5B-2a).

**Tier C (`createPaymentRetryLock`):** forbid booking/payment status patterns; allow `booking_locks` via `lockRepository` (separate allowlist or exclude lock table from forbidden list).

---

## 7. Valid exceptions

| Exception | Location | 5B-2c treatment |
|---------|----------|-----------------|
| Offer cron expiry DML | `expireOffers.ts` | Tier D; skip forbidden offer-update pattern |
| `payment_link_expires_at` update | `initializePayment.ts` | Allow `payments` update without `status` key in same patch object (regex nuance) |
| `createPaymentRetryLock` no `executeBookingCommand` | Lock-only facade | Tier C — assert absence of status DML, not command call |
| Admin preflight reads | `admin*Offer.ts`, recovery | Service role `select` on bookings/payments — allowed |
| `expirePendingPayments` / recovery batch reads | Cron/orchestrator | Service role read before command loop |
| `getAvailableCleaners` booking read | Read-only facade | Service role for schedule conflict — tier E with read-only exception in registry |
| Command backend | `supabaseBookingCommandBackend.ts` | Out of facade scope (5B-2a table guards) |

---

## 8. Avoiding brittle tests

| Pitfall | Mitigation |
|---------|------------|
| Requiring `executeBookingCommand` in `handlePaystackWebhook.ts` | Tier B: require `processPaystackChargeSuccess` / `Failure` instead |
| Requiring command in `createPaymentRetryLock` | Tier C: explicit `commandRequired: false` in manifest |
| Matching comments / strings | Anchor on `import` and call expressions `executeBookingCommand(` |
| Duplicating route manifest | Derive facade file list from `mutationRouteBoundaryManifest` unique symbols → resolve to paths via convention table |
| Testing entire `features/` tree | Only manifest-listed facade files + optional `PAYMENT_ORCHESTRATOR_FILES` / `ASSIGNMENT_ORCHESTRATOR_FILES` |
| Transitive closure explosion | **Minimal slice:** route facades only; **extended:** + one-hop helpers |

**Orchestrator allowlist** (file may satisfy tier A without containing `executeBookingCommand` if it calls):

- `processPaystackChargeSuccess`, `processPaystackChargeFailure`
- `finalizePaidBooking` (helpers only, not webhook file)
- `runAssignmentAfterPayment`, `recoverAssignmentForBooking`
- `processBookingAfterOfferEnded`, `processBookingAfterOfferExpiry`
- `createAdminDispatchOffer`, `createAdminCancelOpenOffer`
- `createDispatchOffer`, `recordAssignmentOutcome`

---

## 9. Server Actions scope decision

| Entry | Lifecycle mutation? | Recommendation |
|-------|---------------------|----------------|
| `src/app/(customer)/customer/setup/actions.ts` | **No** — `ensure_customer_provisioned` RPC | **Out of 5B-2c** |
| Future server actions | Unknown | **5B-2d:** `serverActionBoundaryManifest` mirroring route rules |

**Rationale:** Only one Server Action exists; it does not touch booking/payment/offer/earning lifecycle. Adding scan scope now increases noise without coverage gain.

**5B-2d sketch:** Forbid `executeBookingCommand` / service role / lifecycle `.from()` in `src/app/**/actions.ts` unless allowlisted provisioning-only.

---

## 10. Proposed tests (detection-only)

### 10.1 `facadeCommandBoundaryManifest.ts`

Extends route manifest with per-file rules:

```ts
export type FacadeBoundaryTier = "command_required" | "payment_orchestrator" | "lock_infra" | "offer_expiry" | "read_only";

export type FacadeBoundaryRule = {
  /** Path under src/features/ or src/... */
  facadeFile: string;
  exportSymbol: string;
  tier: FacadeBoundaryTier;
  mayImportServiceRole?: boolean;
  allowedOrchestratorCalls?: string[];  // tier B/A delegation
  forbiddenPatterns?: RegExp[];         // default shared set
};
```

Build `FACADE_BOUNDARY_RULES` from unique `requiredFacadeImports` in `mutationRouteBoundaryManifest.ts` + read-only rules.

### 10.2 `facadeCommandBoundaryGuard.test.ts`

For each `FacadeBoundaryRule`:

1. File exists under `src/`.
2. **Tier A:** `executeBookingCommand(` present OR imports/calls one of `allowedOrchestratorCalls`.
3. **Tier B:** both payment processors referenced if webhook (or success-only for verify).
4. **Tier C:** no forbidden status DML; no `executeBookingCommand` required.
5. **Tier D:** file path is `expireOffers.ts`; may match offer update pattern.
6. **Tier E:** no service role, no `executeBookingCommand`, no lifecycle `.from(bookings|payments|...)`.
7. Service role: if `mayImportServiceRole` false, no serviceRole import.
8. Cross-check: every mutation facade file in manifest appears in `FACADE_BOUNDARY_RULES`.

### 10.3 Optional: one-hop helper guard (5B-2c extended)

`facadeHelperBoundaryGuard.test.ts` — same rules for `PAYMENT_SPINE_FILES` and `ASSIGNMENT_ENGINE_FILES` lists in §1.

### 10.4 What not to build in 5B-2c

- Runtime / HTTP tests
- `import()` graph analysis across whole repo
- Asserting specific command **types** (`FINALIZE_PAYMENT_SUCCESS`) in source (too brittle; type strings change)

---

## Cron / webhook facade policy (facade layer)

| Facade | Cron-specific rule |
|--------|-------------------|
| `expireStalePendingPayments` | Must contain `executeBookingCommand`; client is parameter (no `createServiceRoleClient` in file — OK) |
| `expireStaleAssignmentOffers` | Tier D file; must call `processBookingAfterOfferExpiry` or `processBookingAfterOfferEnded` |
| `runAssignmentRecoveryBatch` | Must call `runAssignmentAfterPayment`; reads only on bookings/payments |

| Facade | Webhook-specific rule |
|--------|----------------------|
| `handlePaystackWebhook` | Must **not** import service role; must reference `processPaystackChargeSuccess` and `processPaystackChargeFailure` |
| `verifyPayment` | Must call `processPaystackChargeSuccess`; may import service role (registry) |

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| `createPaymentRetryLock` fails “must have executeBookingCommand” | Tier C explicit flag |
| Duplicate rules vs 5B-2a | Facade rules are **narrower** (specific files); table guards remain global backstop |
| New logic added only in helper, not facade | Extended slice tests one-hop helpers; document in PR checklist |
| `initializePayment` payment_link patch triggers false positive | Forbidden pattern requires `status` key in update object |
| Facade file path drift | Single manifest; code review when renaming exports |

---

## Things not to touch

- `finalizePaidBooking`, Paystack RPC implementations, webhook mapping
- `ACCEPT_CLEANER_ASSIGNMENT` / `respondToOffer` semantics
- `recordEarningsForBooking` formulas
- `expireOffers.ts` behavior
- Route files (5B-2b already covers)
- RLS / migrations

---

## Audit question answers

| # | Answer |
|---|--------|
| 1 | 17 lifecycle facades + 3 read-only — §1 |
| 2 | Tier A facades must call `executeBookingCommand` or allowlisted orchestrator — §2 |
| 3 | Payment spine only: `finalizePaidBooking`, `processPaystackCharge*` — §3 |
| 4 | Per service-role registry; see §4 |
| 5 | No direct lifecycle status/earning writes except `expireOffers` — §5 |
| 6 | §6 forbidden patterns |
| 7 | §7 exceptions |
| 8 | §8 brittleness |
| 9 | Defer Server Actions to 5B-2d — §9 |
| 10 | Smallest slice below |

---

## Final recommendation: smallest safe implementation slice for Stage 5B-2c

### Slice 5B-2c-min (one PR, detection-only)

1. **`src/tests/security/facadeCommandBoundaryManifest.ts`**
   - One row per **route-referenced facade file** (20 files counting shared `respondToOffer` / `completionActions` / `getAvailableCleaners` once each)
   - Tiers A/B/C/D/E as in §2

2. **`src/tests/security/facadeCommandBoundaryGuard.test.ts`**
   - Tier A: `executeBookingCommand(` OR orchestrator call regex
   - Tier B: `processPaystackChargeSuccess` / `Failure` imports
   - Tier C/D/E rules
   - Shared forbidden DML patterns (reuse/extend 5B-2a patterns)
   - Service-role import check against existing registry

3. **Docs:** Add “Facade boundary guards (5B-2c)” section to [command-boundary-static-guards.md](../security/command-boundary-static-guards.md)

4. **No production code changes**

**Explicitly defer to 5B-2c-ext:**

- One-hop helper files (`finalizePaidBooking.ts`, `runAssignmentAfterPayment.ts`, …)
- Server Action scan
- Asserting specific `type: "FINALIZE_..."` strings
- Actor-policy tightening (5B-2d+)

**Why this slice:** It validates the **thin layer routes already trust** without refactoring facades or duplicating the whole features tree scan. Combined with 5B-2a table guards, a bypass requires both evading the global table guard **and** the facade manifest — defense in depth with minimal maintenance.

---

## References

- Route manifest: `src/tests/security/mutationRouteBoundaryManifest.ts`
- Route guard: `src/tests/security/mutationRouteBoundaryGuard.test.ts`
- Service role registry: `src/tests/security/serviceRoleLifecycleWriteRegistry.test.ts`
- Command executor: `src/features/bookings/server/commands/executeBookingCommand.ts`
- Design 5B-2b: [stage-5b-2b-mutation-route-command-boundary-design.md](./stage-5b-2b-mutation-route-command-boundary-design.md)
