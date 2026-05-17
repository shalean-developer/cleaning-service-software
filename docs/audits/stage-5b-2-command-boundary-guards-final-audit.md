# Stage 5B-2 Final Audit — Command Boundary Guard Coverage

**Date:** 2026-05-17  
**Type:** Audit only — **no implementation**  
**Scope:** Verify static command-boundary governance (5B-2a, 5B-2b, 5B-2c-min) is sufficient before **RLS tightening design** (Stage 5B-3+ / Stage 5A follow-on).

**Related:**

- Original findings: [stage-5b-2-command-boundary-guard-audit.md](./stage-5b-2-command-boundary-guard-audit.md)
- Operator guide: [command-boundary-static-guards.md](../security/command-boundary-static-guards.md)
- Route design: [stage-5b-2b-mutation-route-command-boundary-design.md](../architecture/stage-5b-2b-mutation-route-command-boundary-design.md)
- Facade design: [stage-5b-2c-facade-command-boundary-guard-design.md](../architecture/stage-5b-2c-facade-command-boundary-guard-design.md)

---

## Executive summary

| Question | Answer |
|----------|--------|
| Are all 15 checklist items covered by CI? | **Yes** (detection-only; see §Checklist) |
| Did tests pass at audit time? | **Yes** — `npm run typecheck`; 11 test files, **164** tests |
| Production runtime changed? | **No** — guards are static scans + allowlists only |
| Is Stage 5B-2 **complete** as scoped? | **Yes** (5B-2a + 5B-2b + 5B-2c-min shipped) |
| Safe to **start RLS tightening design**? | **Yes**, with explicit residual risks in §Deferred gaps |

**Verdict:** Stage 5B-2 delivers a **layered, CI-enforced perimeter** (table → route → facade) that makes new lifecycle bypasses visible before merge. It does **not** remove latent **admin PostgREST** or **service-role key** bypass at the database. RLS tightening design should treat 5B-2 guards as **necessary but not sufficient** for runtime enforcement.

---

## Before vs after

| Layer | Before Stage 5B-2 (May 2026 audit) | After Stage 5B-2 (now) |
|-------|-----------------------------------|-------------------------|
| `bookings.status` in app TS | Static guard + DB trigger | Unchanged; guard retained |
| `payments.status` in app TS | Convention / discipline only | **Global static guard** + migration scan |
| `assignment_offers.status` in app TS | Convention + documented `expireOffers` | **Global static guard** + explicit allowlist |
| `earning_lines` / `cleaner_payouts` | No TS guard | **Facade + route** forbidden patterns; **no global** earning_lines guard |
| Service role imports | Ad hoc review | **19-path registry** + CI fail on new importers |
| Customer POST mutations | Undocumented | **4-route allowlist** + manifest sync |
| Cleaner POST mutations | Undocumented | **4-route allowlist** + manifest sync |
| Admin POST mutations | **5-route allowlist** (pre-existing) | **5-route allowlist** + manifest sync |
| Cron POST mutations | Undocumented | **3-route allowlist** + service role required in route |
| Paystack POST mutations | Partial (customer init/verify) | **3-route allowlist** (init, verify, webhook) |
| Route → facade wiring | Not enforced | **17 lifecycle routes** must import approved facades |
| Route direct DML | Possible in new routes | **Forbidden patterns** in `route.ts` |
| Route service role | Possible outside cron | **Blocked** except 3 cron routes |
| Facade command boundaries | Not enforced | **16 modules**, tiered manifest + guard |
| `ADMIN_OVERRIDE_STATUS` in routes/facades | Documented “do not expose” | **Blocked by pattern** in route + facade guards |
| Operator docs | Scattered | **Single runbook**: `command-boundary-static-guards.md` |

---

## Checklist (15 items)

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | `payments.status` direct writes guarded | **Pass** | `paymentStatusMutationGuard.test.ts` — repo-wide scan; allowlist: command backends + RPC migration |
| 2 | `assignment_offers.status` direct writes guarded | **Pass** | `assignmentOfferStatusMutationGuard.test.ts` — allowlist: backends + `expireOffers.ts` + backfill migration |
| 3 | Service-role lifecycle writers registered | **Pass** | `serviceRoleLifecycleWriteRegistry.test.ts` — 19 approved paths; fails on unexpected importers |
| 4 | Customer POST routes allowlisted | **Pass** | `customerMutationRoutes.test.ts` — 4 routes |
| 5 | Cleaner POST routes allowlisted | **Pass** | `cleanerMutationRoutes.test.ts` — 4 routes |
| 6 | Admin POST routes allowlisted | **Pass** | `adminApiRoutes.test.ts` — 5 routes |
| 7 | Cron POST routes allowlisted | **Pass** | `cronMutationRoutes.test.ts` — 3 routes |
| 8 | Paystack POST routes allowlisted | **Pass** | `paystackMutationRoutes.test.ts` — 3 routes |
| 9 | Mutation routes import approved facades | **Pass** | `mutationRouteBoundaryGuard.test.ts` — 17 lifecycle routes |
| 10 | Mutation routes: no service role except cron | **Pass** | Same guard — cron routes must import service role; others must not |
| 11 | Mutation routes: no direct lifecycle DML | **Pass** | `FORBIDDEN_ROUTE_LIFECYCLE_PATTERNS` in route guard |
| 12 | Facades use command/orchestrator boundaries | **Pass** | `facadeCommandBoundaryGuard.test.ts` — 16 modules, 5 tiers |
| 13 | Read-only facades: no mutation helpers | **Pass** | Facade guard `read_only` tier + route `FORBIDDEN_READ_ONLY_POST_PATTERNS` |
| 14 | `ADMIN_OVERRIDE_STATUS` blocked from route-facing layers | **Pass** | Forbidden in route + facade guards; remains in command layer only (no API) |
| 15 | Docs explain safe future mutations | **Pass** | `command-boundary-static-guards.md` — add route, facade, registry, test commands |

---

## Guard inventory

### Table-level (5B-2a) — whole `src/` + migrations

| Test file | What it scans | Allowlisted writers (app) |
|-----------|---------------|---------------------------|
| `bookingStatusMutationGuard.test.ts` | `bookings.status` patches | `supabaseBookingCommandBackend`, `inMemoryBookingCommandBackend`, `directMutationGuard` |
| `paymentStatusMutationGuard.test.ts` | `payments.status` updates/assignments | Command backends only |
| `paymentStatusMutationGuard.test.ts` | New SQL `UPDATE payments.status` | `20260515203000_booking_command_layer.sql` |
| `assignmentOfferStatusMutationGuard.test.ts` | `assignment_offers.status` patches | Command backends + **`expireOffers.ts`** |
| `assignmentOfferStatusMutationGuard.test.ts` | New SQL `UPDATE assignment_offers.status` | `20260517300000_assignment_offer_one_open_per_booking.sql` |

### Registry (5B-2a)

| Test file | Count | Policy |
|-----------|-------|--------|
| `serviceRoleLifecycleWriteRegistry.test.ts` | **19** paths | Any new `@/lib/supabase/serviceRole` import outside set fails CI |

### HTTP perimeter (5B-2b)

| Artifact | Lifecycle POST | Read-only POST |
|----------|----------------|----------------|
| `mutationRouteBoundaryManifest.ts` | **17** | **3** |
| `mutationRouteBoundaryGuard.test.ts` | Facade imports, no DML, service-role policy, sync with category allowlists | Quote/eligibility facades only |

### Facade layer (5B-2c-min)

| Artifact | Modules | Tiers |
|----------|---------|-------|
| `facadeCommandBoundaryManifest.ts` | **16** unique facade files (21 route symbols) | `command_required` (11), `payment_orchestrator` (2), `lock_infra` (1), `offer_expiry` (1), `read_only` (2) |
| `facadeCommandBoundaryGuard.test.ts` | Per-file: command/orchestrator, payment delegation, DML, service role, `ADMIN_OVERRIDE` |

---

## Allowlist inventory

### POST mutation routes (20 total)

| Category | Count | Routes |
|----------|-------|--------|
| Customer | 4 | `bookings/lock`, `bookings/[bookingId]/payment-retry-lock`, `paystack/initialize`, `paystack/verify` |
| Cleaner | 4 | `offers/[offerId]/accept`, `decline`, `jobs/[bookingId]/start`, `complete` |
| Admin | 5 | `payout-ready`, `mark-paid-out`, `recover-assignment`, `dispatch-offer`, `replace-open-offer` |
| Cron | 3 | `expire-pending-payments`, `expire-assignment-offers`, `recover-assignment-after-payment` |
| Paystack (infra) | 3 | `initialize`, `verify`, `webhook` |
| Read-only POST | 3 | `pricing/quote`, `cleaners/available`, `booking/cleaners` |

### Service-role lifecycle importers (19)

| Bucket | Paths |
|--------|-------|
| Core | `lib/supabase/serviceRole.ts`, `runBookingCommand.ts` |
| Payments | `finalizePaidBooking`, `processPaystackChargeFailure`, `upsertBookingFromPaystack`, `initializePayment`, `verifyPayment` |
| Locks | `createBookingPaymentLock`, `createPaymentRetryLock`, `assertActiveLock`, `validateCleanerPreference` |
| Admin ops reads | `adminManualDispatchOffer`, `adminAssignmentRecovery`, `adminReplaceOpenOffer` |
| Read eligibility | `getAvailableCleaners` |
| Cron routes | 3 `app/api/cron/*/route.ts` |
| Ops scripts | `recoverAssignmentAfterPayment.mjs`, `repairOrphanedAssignments.mjs` |

### Route facades (manifest-driven)

See `FACADE_BOUNDARY_RULES` in `src/tests/security/facadeCommandBoundaryManifest.ts` — full list in [command-boundary-static-guards.md](../security/command-boundary-static-guards.md#facade-command-boundary-guard-stage-5b-2c-min).

---

## Approved exceptions (unchanged runtime)

| Exception | Location | Guard acknowledgment |
|-----------|----------|----------------------|
| Payment status via RPC | `supabaseBookingCommandBackend` → `booking_finalize_payment_success` / `booking_record_payment_failure` | Global payment guard allowlist |
| Offer cron expiry DML | `expireOffers.ts` | Global offer guard + facade `offer_expiry` tier |
| Payment link metadata | `initializePayment.ts` — `payment_link_expires_at` update (no `status`) | Facade guard allows non-status `payments.update` |
| Retry lock without command in facade | `createPaymentRetryLock.ts` | Facade `lock_infra` tier |
| Read-only schedule reads | `getAvailableCleaners.ts` + service role | Facade `read_only` + registry |
| One-time SQL backfills | Assignment offer + payment RPC migrations | Migration allowlists in table guards |

---

## Deferred gaps (not failures of 5B-2 scope)

These were **explicitly deferred** in design/implementation; they remain relevant for **RLS tightening** and optional 5B-2c-ext / 5B-2d:

| Gap | Risk if ignored in RLS design | Suggested owner stage |
|-----|------------------------------|------------------------|
| **Admin PostgREST** direct `payments` / `earning_lines` / `assignment_offers` writes | Compromised admin JWT bypasses app command layer | 5B-3+ RLS narrowing |
| **No DB trigger** on `payments.status` | Service role / SQL console can mutate status | 5B-2f (optional trigger) or RLS |
| **No global `earning_lines` / `cleaner_payouts` static guard** | New repo code could patch ledger outside facades | 5B-2c-ext or dedicated guard |
| **One-hop helpers** (`finalizePaidBooking`, `runAssignmentAfterPayment`, `createAdminDispatchOffer`, …) not in facade manifest | Bypass could be added inside helper, not route facade | 5B-2c-ext |
| **Server Actions** (`customer/setup/actions.ts` only today) | Future actions could mutate lifecycle | 5B-2d |
| **`ADMIN_OVERRIDE_STATUS`** still in command executor | Safe while no route exposes it; RLS must not grant equivalent | Policy + RLS |
| **Actor policy** (`admin` on accept/decline types) | Policy allows in theory; no route uses it | 5B-2b actor-policy slice (separate) |
| **Call-graph / command-type assertions** | Orchestrator rename could hollow facade | Optional hardening |
| **E2E / integration timeouts** | Unrelated to boundary guards | Out of scope |

---

## Test evidence

**Run date:** 2026-05-17 (audit execution)

```bash
npm run typecheck
# exit 0

npx vitest run \
  src/features/bookings/server/commands/bookingStatusMutationGuard.test.ts \
  src/features/payments/server/paymentStatusMutationGuard.test.ts \
  src/features/assignments/server/assignmentOfferStatusMutationGuard.test.ts \
  src/tests/security/serviceRoleLifecycleWriteRegistry.test.ts \
  src/tests/security/mutationRouteBoundaryGuard.test.ts \
  src/tests/security/facadeCommandBoundaryGuard.test.ts \
  src/app/api/admin/adminApiRoutes.test.ts \
  src/app/api/customerMutationRoutes.test.ts \
  src/app/api/cleaner/cleanerMutationRoutes.test.ts \
  src/app/api/cron/cronMutationRoutes.test.ts \
  src/app/api/paystack/paystackMutationRoutes.test.ts
```

| Result | Value |
|--------|-------|
| Typecheck | **Pass** |
| Test files | **11 passed** |
| Tests | **164 passed** |
| Duration | ~9.2s |
| Unrelated failures | **None observed** (no timeout fixes applied) |

### Test file → checklist mapping

| Test file | Tests (approx.) | Checklist items |
|-----------|-----------------|-----------------|
| `bookingStatusMutationGuard.test.ts` | 1 | (bookings baseline; supports overall boundary story) |
| `paymentStatusMutationGuard.test.ts` | 3 | 1 |
| `assignmentOfferStatusMutationGuard.test.ts` | 2 | 2 |
| `serviceRoleLifecycleWriteRegistry.test.ts` | 2 | 3 |
| `customerMutationRoutes.test.ts` | 1 | 4 |
| `cleanerMutationRoutes.test.ts` | 1 | 5 |
| `adminApiRoutes.test.ts` | 1 | 6 |
| `cronMutationRoutes.test.ts` | 1 | 7 |
| `paystackMutationRoutes.test.ts` | 1 | 8 |
| `mutationRouteBoundaryGuard.test.ts` | ~58 | 9, 10, 11, 14 (routes) |
| `facadeCommandBoundaryGuard.test.ts` | ~93 | 12, 13, 14 (facades) |

---

## Production impact

| Aspect | Impact |
|--------|--------|
| Runtime behavior | **None** — no changes to `executeBookingCommand`, Paystack finalize, accept/decline, earnings formulas, `expireOffers`, or RLS policies |
| Deploy risk | **Zero** from guards themselves (devDependency / test-only enforcement) |
| CI | New failures only when a PR introduces unreviewed routes, facades, service-role imports, or direct status patches |
| Operator workflow | Adding a mutation requires manifest + allowlist + optional registry updates (documented) |

---

## Defense-in-depth model (current)

```text
                    ┌─────────────────────────────────────┐
                    │  CI static guards (5B-2)            │
                    │  table → route → facade             │
                    └─────────────────┬───────────────────┘
                                      │ catches new app code
                                      ▼
┌──────────────┐    ┌──────────────────────────────┐    ┌─────────────────┐
│ HTTP routes  │───▶│ Feature facades              │───▶│ executeBooking  │
│ (allowlist)  │    │ (command / orchestrator)     │    │ Command + RPCs  │
└──────────────┘    └──────────────────────────────┘    └────────┬────────┘
                                                                 │
                    ┌────────────────────────────────────────────┘
                    ▼
         ┌──────────────────────┐     ┌─────────────────────────┐
         │ DB: booking status   │     │ DB: payments/offers/    │
         │ trigger (strong)     │     │ earnings RLS (latent)   │
         └──────────────────────┘     └─────────────────────────┘
                                      ▲ RLS tightening targets this
```

---

## Stage 5B-2 delivery status

| Slice | Status | Deliverable |
|-------|--------|-------------|
| **5B-2** (audit) | Done | [stage-5b-2-command-boundary-guard-audit.md](./stage-5b-2-command-boundary-guard-audit.md) |
| **5B-2a** | Done | Table guards, service-role registry, category POST allowlists |
| **5B-2b** | Done | `mutationRouteBoundaryManifest` + route guard |
| **5B-2c-min** | Done | `facadeCommandBoundaryManifest` + facade guard |
| **5B-2c-ext** | Deferred | One-hop helper facades |
| **5B-2d** | Deferred | Server Action boundary |
| **5B-2b (actor policy)** | Deferred | Separate from boundary guards |

---

## Final verdict

### Is Stage 5B-2 complete?

**Yes.** All planned detection slices for the Stage 5B-2 program (5B-2a, 5B-2b, 5B-2c-min) are implemented, documented, and passing CI-style tests. The original audit’s **5B-2a recommendation** and subsequent route/facade designs are satisfied.

### Is it safe enough to move to RLS tightening **design**?

**Yes — proceed to RLS tightening design**, with these conditions:

1. **Treat 5B-2 as merge-time governance**, not database enforcement. RLS design must address **admin `FOR ALL`** and **service_role** paths called out in the original audit.
2. **Do not assume** facade guards cover **helper modules** (`finalizePaidBooking`, `runAssignmentAfterPayment`, etc.) until 5B-2c-ext or equivalent.
3. **Preserve** documented exceptions (`expireOffers`, payment RPCs) when drafting policies — equivalent behavior must remain reachable via service role + commands.
4. **Keep** `ADMIN_OVERRIDE_STATUS` out of any new admin API or policy that would expose it via PostgREST.
5. **Optional parallel work:** global `earning_lines` guard and `payments.status` DB trigger can be designed alongside RLS but are **not blockers** for starting RLS **design**.

**Not recommended yet:** Production RLS migration without a written RLS design that maps each lifecycle table to roles (`customer`, `cleaner`, `admin`, `service_role`) and explicitly retires latent PostgREST bypass paths.

---

## References

| Resource | Path |
|----------|------|
| Static guards doc | `docs/security/command-boundary-static-guards.md` |
| Route manifest | `src/tests/security/mutationRouteBoundaryManifest.ts` |
| Facade manifest | `src/tests/security/facadeCommandBoundaryManifest.ts` |
| Service role registry | `src/tests/security/serviceRoleLifecycleWriteRegistry.test.ts` |
