# Command boundary static guards (Stage 5B-2a)

**Type:** Detection-only CI governance — **no runtime behavior change.**

**Audit:** [stage-5b-2-command-boundary-guard-audit.md](../audits/stage-5b-2-command-boundary-guard-audit.md)  
**Route boundaries (5B-2b):** [stage-5b-2b-mutation-route-command-boundary-design.md](../architecture/stage-5b-2b-mutation-route-command-boundary-design.md)

---

## What these guards protect

| Guard | Prevents |
|-------|----------|
| `bookingStatusMutationGuard.test.ts` | Direct `bookings.status` patches outside command backends |
| `paymentStatusMutationGuard.test.ts` | Direct `payments.status` updates / assignments outside approved adapters |
| `assignmentOfferStatusMutationGuard.test.ts` | Direct `assignment_offers.status` updates outside command backends + documented cron exception |
| `serviceRoleLifecycleWriteRegistry.test.ts` | New modules importing service role without security review |
| `adminApiRoutes.test.ts` | Accidental new admin POST mutation routes |
| `customerMutationRoutes.test.ts` | Accidental new customer checkout/payment POST routes |
| `cleanerMutationRoutes.test.ts` | Accidental new cleaner POST mutation routes |
| `cronMutationRoutes.test.ts` | Accidental new cron POST mutation routes |
| **`mutationRouteBoundaryGuard.test.ts`** | Mutation routes that skip approved facades, import service role incorrectly, or contain direct lifecycle DML in `route.ts` |
| **`facadeCommandBoundaryGuard.test.ts`** | Route facades that bypass `executeBookingCommand`, payment processors, or lifecycle DML internally |
| **`paystackMutationRoutes.test.ts`** | Unreviewed new Paystack POST handlers |

These guards **do not** replace RLS, DB triggers, or `executeBookingCommand` guards. They catch **new accidental code paths** in CI before merge.

---

## Mutation route boundary guard (Stage 5B-2b)

**Manifest:** `src/tests/security/mutationRouteBoundaryManifest.ts`  
**Test:** `src/tests/security/mutationRouteBoundaryGuard.test.ts`

### What it checks

| Check | Applies to |
|-------|------------|
| Required facade import (e.g. `initializePayment`, `runAdminManualDispatchOffer`) | 17 lifecycle POST routes |
| No `createServiceRoleClient` import | Customer, cleaner, admin, paystack routes |
| Service role import **required** | Cron routes only (3) |
| No `.from("bookings\|payments\|…").update/insert` in `route.ts` | Lifecycle routes |
| No `executeBookingCommand(` or `ADMIN_OVERRIDE_STATUS` in `route.ts` | Lifecycle routes |
| Read-only POST routes use quote/eligibility facades only | `pricing/quote`, `cleaners/available`, `booking/cleaners` |
| Manifest ↔ 5B-2a allowlists stay in sync | All categories |

### Webhook policy

| Route | Required facade | Service role in route |
|-------|-----------------|------------------------|
| `paystack/webhook/route.ts` | `handlePaystackWebhook` | **Forbidden** (finalize/failure modules own service role) |

### Cron policy

| Requirement | Detail |
|-------------|--------|
| Auth | `verifyCronSecret` in route source |
| Service role | Allowed in `route.ts`; passed into batch orchestrator |
| Facade | `expireStalePendingPayments`, `expireStaleAssignmentOffers`, or `runAssignmentRecoveryBatch` |
| Direct offer expiry DML | Stays in `expireOffers.ts`, not in `route.ts` |

### How to add a new mutation route safely

1. Implement a **feature facade** in `src/features/*` that calls `executeBookingCommand` (or documented cron exception).
2. Add a thin `route.ts` that imports only the facade (not service role, unless cron).
3. Update **`mutationRouteBoundaryManifest.ts`** — add a `MUTATION_ROUTE_RULES` row.
4. Update the matching **5B-2a allowlist** test (`customer`, `cleaner`, `admin`, `cron`, or `paystackMutationRoutes.test.ts`).
5. If the facade module imports service role, add it to **`serviceRoleLifecycleWriteRegistry.test.ts`**.
6. Run:

```bash
npm run typecheck
npx vitest run src/tests/security/mutationRouteBoundaryGuard.test.ts
npx vitest run src/app/api/paystack/paystackMutationRoutes.test.ts
```

### Read-only POST routes

`POST` used as a GET alias for JSON bodies — **not** lifecycle mutations. Listed in `READ_ONLY_POST_ROUTE_RULES`; must not import command backends or service role.

---

## Facade command boundary guard (Stage 5B-2c-min)

**Design:** [stage-5b-2c-facade-command-boundary-guard-design.md](../architecture/stage-5b-2c-facade-command-boundary-guard-design.md)  
**Manifest:** `src/tests/security/facadeCommandBoundaryManifest.ts`  
**Test:** `src/tests/security/facadeCommandBoundaryGuard.test.ts`

5B-2b proves routes import approved facades. **5B-2c-min** proves those facade modules do not bypass command/payment boundaries **inside the facade file**.

### Boundary tiers

| Tier | Facades | Guard expects |
|------|---------|---------------|
| `command_required` | Locks (create), payment init, offers, jobs, admin dispatch/recovery, crons (payment expire, assignment batch) | `executeBookingCommand(` **or** approved orchestrator symbol (e.g. `createAdminDispatchOffer`, `recoverAssignmentForBooking`) |
| `payment_orchestrator` | `verifyPayment`, `handlePaystackWebhook` | `processPaystackChargeSuccess` / `Failure` only — no `executeBookingCommand` or `finalizePaidBooking` in facade |
| `lock_infra` | `createPaymentRetryLock` | No `executeBookingCommand` (pending payment via `initializePayment`); service role for locks only |
| `offer_expiry` | `expireOffers.ts` (`expireStaleAssignmentOffers`) | Explicit exception file; `processBookingAfterOfferExpiry`; direct `assignment_offers` expiry DML allowed |
| `read_only` | `calculateQuote`, `getAvailableCleaners` | No command backends or payment/assignment mutation helpers; `getAvailableCleaners` may import service role (registry) for schedule reads |

### What it checks

| Check | Detail |
|-------|--------|
| File exists | Every `FACADE_BOUNDARY_RULES` path under `src/` |
| Command boundary | Tier A + offer_expiry orchestrator follow-up |
| Payment delegation | Tier B processors only |
| No `ADMIN_OVERRIDE_STATUS` | All route facades |
| Lifecycle DML | No direct `bookings.status` / `payments.status` / `earning_lines` / `cleaner_payouts` writes; no `assignment_offers.update` except `expireOffers.ts` |
| Service role | `allowedServiceRoleImport` must match `ALLOWED_SERVICE_ROLE_LIFECYCLE_IMPORTERS` |
| Route symbol coverage | Every `requiredFacadeImports` symbol maps to a manifest row |

### How to add or update a facade safely

1. Implement lifecycle changes via **`executeBookingCommand`** or an existing orchestrator (`createAdminDispatchOffer`, `processBookingAfterOfferEnded`, etc.).
2. Add or update a row in **`facadeCommandBoundaryManifest.ts`** (tier, orchestrators, service-role flag).
3. If the facade imports service role, add the path to **`serviceRoleLifecycleWriteRegistry.test.ts`**.
4. Update **`mutationRouteBoundaryManifest.ts`** and route allowlist tests if the HTTP surface changed (5B-2b).
5. Run:

```bash
npm run typecheck
npx vitest run src/tests/security/facadeCommandBoundaryGuard.test.ts
npx vitest run src/tests/security/mutationRouteBoundaryGuard.test.ts
```

### Approved facade exceptions (5B-2c)

| Exception | Module | Why |
|-----------|--------|-----|
| Offer cron expiry DML | `expireOffers.ts` | Documented `offered` → `expired` before `processBookingAfterOfferExpiry` |
| Payment link metadata | `initializePayment.ts` | `payments.update` with `payment_link_expires_at` only (no `status`) |
| Retry lock without command | `createPaymentRetryLock.ts` | Lock infra; `MARK_PAYMENT_PENDING` on `initializePayment` |
| Read-only service role | `getAvailableCleaners.ts` | Cross-booking schedule eligibility reads |

### Deferred (not 5B-2c-min)

- One-hop helpers (`finalizePaidBooking.ts`, `runAssignmentAfterPayment.ts`, `createAdminDispatchOffer.ts`, …)
- Server Action boundary scan (`app/**/actions.ts`)
- Call-graph / command-type string assertions
- Actor-policy tightening, DB triggers, RLS narrowing

---

## Approved exceptions

### `payments.status`

| Location | Why allowed |
|----------|-------------|
| `supabaseBookingCommandBackend.ts` | Inserts `pending` rows; paid/failed only via RPC |
| `inMemoryBookingCommandBackend.ts` | Test backend mirroring RPC behavior |
| `20260515203000_booking_command_layer.sql` | `booking_finalize_payment_success` / `booking_record_payment_failure` |

**Not allowed in app code:** `.from("payments").update({ status: ... })` — use `FINALIZE_PAYMENT_SUCCESS` / `MARK_PAYMENT_FAILED`.

### `assignment_offers.status`

| Location | Why allowed |
|----------|-------------|
| Command backends | `updateOffer` / `insertOffer` inside `executeBookingCommand` |
| **`expireOffers.ts`** | Documented cron exception: `offered` → `expired` with row guard, then command follow-up |
| `20260517300000_assignment_offer_one_open_per_booking.sql` | One-time backfill (`offered` duplicates → `cancelled`) before unique index |

### Service role imports

See `ALLOWED_SERVICE_ROLE_LIFECYCLE_IMPORTERS` in `src/tests/security/serviceRoleLifecycleWriteRegistry.test.ts`.

`expireOffers.ts` does **not** import service role; cron routes pass the client in.

### Paystack POST routes

`paystackMutationRoutes.test.ts` allowlists: `initialize`, `verify`, `webhook`. The webhook route is **not** in the customer checkout allowlist (HMAC-gated infra).

---

## How to add a new allowed writer safely

1. **Prefer commands** — route new lifecycle changes through `executeBookingCommand` and existing backends.
2. **If a new exception is required** (e.g. new cron batch):
   - Document why in a PR and in this file.
   - Add the file path to the relevant `ALLOWED_*` set in the static test.
   - For service role: add to `ALLOWED_SERVICE_ROLE_LIFECYCLE_IMPORTERS` with a one-line comment in the PR.
3. **If adding a new POST API route** — update `mutationRouteBoundaryManifest.ts`, the matching allowlist test, and run `mutationRouteBoundaryGuard.test.ts`.
4. **Run locally:**
   ```bash
   npm run typecheck
   npx vitest run src/features/bookings/server/commands/bookingStatusMutationGuard.test.ts
   npx vitest run src/features/payments/server/paymentStatusMutationGuard.test.ts
   npx vitest run src/features/assignments/server/assignmentOfferStatusMutationGuard.test.ts
   npx vitest run src/tests/security/serviceRoleLifecycleWriteRegistry.test.ts
   npx vitest run src/app/api/admin/adminApiRoutes.test.ts
   npx vitest run src/app/api/customerMutationRoutes.test.ts
   npx vitest run src/app/api/cleaner/cleanerMutationRoutes.test.ts
   npx vitest run src/app/api/cron/cronMutationRoutes.test.ts
   npx vitest run src/tests/security/mutationRouteBoundaryGuard.test.ts
   npx vitest run src/tests/security/facadeCommandBoundaryGuard.test.ts
   npx vitest run src/app/api/paystack/paystackMutationRoutes.test.ts
   ```

---

## Why detection-only

Stage 5A deferred broad admin RLS narrowing. Stage 5B-2a adds **visibility** without changing:

- Payment finalize / Paystack RPCs
- Cleaner accept semantics
- Earnings formulas
- `expireOffers` runtime behavior
- `ADMIN_OVERRIDE_STATUS` exposure

**5B-2b (done):** mutation route boundary manifest + guard tests.  
**5B-2c-min (done):** facade command boundary manifest + guard tests (route-facing modules only).  
**Follow-on (5B-2c-ext / 5B-2d+):** one-hop helper facades, Server Actions, actor-policy tightening, offer audit keys, optional DB triggers — see the audit roadmap.

---

## Ops scripts

| Script | Confirmation env | Notes |
|--------|------------------|-------|
| `npm run ops:recover:assignments` | `CONFIRM_ASSIGNMENT_RECOVERY=yes` | See `scripts/recover-assignment-after-payment.mjs` |
| `npm run e2e:repair:assignments` | `CONFIRM_ASSIGNMENT_REPAIR=yes` | E2E customer prefix scope only |

Scripts are on the service-role registry; they call assignment orchestrators that use commands.

---

## RLS tightening (Stage 5B-3)

**Phase 1 (5B-3a):** Admin authenticated JWT can **SELECT** `payments` only; `payments_admin_write` dropped. Payment status changes remain **service_role** + `booking_finalize_payment_success` / `booking_record_payment_failure`. Rollback: [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md).

**Phase 2 (5B-3b-a):** Admin authenticated JWT can **SELECT** `earning_lines` only; `earning_lines_admin_write` dropped. Ledger writes remain **service_role** + payout/completion commands. Rollback: [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md).

**Phase 3 (5B-3c-a):** Admin authenticated JWT can **SELECT** `assignment_offers` only; `assignment_offers_admin_write` dropped. Cleaner `UPDATE` and customer/cleaner/admin `SELECT` unchanged; offer writes remain **service_role** + commands + `expireOffers`. Rollback: [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md).

**Phase 4 (5B-3 Phase 4a):** Admin authenticated JWT can **SELECT** `payment_events` and `bookings` only; `payment_events_admin_write` and `bookings_admin_write` dropped. Event inserts and booking lifecycle remain **service_role** + `recordPaymentEvent` / booking RPCs; `bookings_update_customer` and `guard_booking_status_change` unchanged. Rollback: [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md).
