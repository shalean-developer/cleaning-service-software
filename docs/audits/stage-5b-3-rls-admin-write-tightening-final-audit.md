# Stage 5B-3 Final Audit — RLS Admin Write Tightening (Phases 1–3)

**Date:** 2026-05-17  
**Type:** Audit only — **no new migrations**  
**Scope:** Verify Phases **5B-3a**, **5B-3b-a**, and **5B-3c-a** safely removed admin JWT/PostgREST write access on `payments`, `earning_lines`, and `assignment_offers` without breaking production command/service-role flows.

**Related:**

- Design: [stage-5b-3-rls-tightening-design.md](../architecture/stage-5b-3-rls-tightening-design.md)
- Slice designs: [stage-5b-3b-earning-lines-rls-tightening-design.md](../architecture/stage-5b-3b-earning-lines-rls-tightening-design.md), [stage-5b-3c-assignment-offers-rls-tightening-design.md](../architecture/stage-5b-3c-assignment-offers-rls-tightening-design.md)
- Preconditions: [stage-5b-2-command-boundary-guards-final-audit.md](./stage-5b-2-command-boundary-guards-final-audit.md)
- Rollbacks: [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md)
- Guards: [command-boundary-static-guards.md](../security/command-boundary-static-guards.md)

---

## Executive summary

| Question | Answer |
|----------|--------|
| Are all three admin write policies removed (migrations shipped)? | **Yes** — forward migrations drop only the three `*_admin_write` policies |
| Are admin/customer/cleaner SELECT (and cleaner offer UPDATE) preserved? | **Yes** — unchanged in base RLS migration; forward migrations do not touch them |
| Do production writes still use service role + commands/RPC? | **Yes** — no admin route uses user JWT for lifecycle DML on these tables |
| Did targeted tests pass at audit time? | **Yes** — `typecheck`; **130/131** targeted vitest tests (one static-guard gap; see §Residual gaps) |
| RLS integration with migrations applied? | **Yes** — **41/41** in `rls-policies.integration.test.ts` (local Supabase with all three forward migrations) |
| Rollback SQL documented for all three drops? | **Yes** — [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md) Phases 1–3 |
| Is Stage 5B-3 (Phases 1–3) safe to deploy? | **Yes**, with staging apply + smoke and one minor CI allowlist follow-up |
| Next highest-value governance slice? | **Phase 4 (design):** drop `payment_events_admin_write` and `bookings_admin_write` — closes remaining high-impact PostgREST bypass on payment audit trail and booking metadata |

**Verdict:** Stage 5B-3 Phases **1–3** are **complete and safe to deploy** as a bundle. Admin JWT can no longer forge payment status, earnings payout state, or offer lifecycle on the three tightened tables; operational admin UIs and APIs continue to read via SELECT policies and mutate via **service_role** + `executeBookingCommand` / booking RPCs.

---

## Before vs after

| Dimension | Before 5B-3 (base `20260516160000`) | After 5B-3 Phases 1–3 |
|-----------|--------------------------------------|------------------------|
| Admin JWT on `payments` | `FOR ALL` (`payments_admin_write`) + SELECT | **SELECT only** (`payments_select_admin`, `payments_select_customer`) |
| Admin JWT on `earning_lines` | `FOR ALL` (`earning_lines_admin_write`) + SELECT | **SELECT only** (`earning_lines_select_admin`, `earning_lines_select_cleaner`) |
| Admin JWT on `assignment_offers` | `FOR ALL` (`assignment_offers_admin_write`) + SELECT | **SELECT only** + cleaner UPDATE unchanged |
| Compromised admin + PostgREST | Could set `payments.status`, `earning_lines.payout_status`, `assignment_offers.status` without Paystack/commands | **Blocked** at RLS for `authenticated` admin role |
| Production payment finalize | Service role + `booking_finalize_payment_success` | **Unchanged** |
| Paystack failure path | Service role + `booking_record_payment_failure` | **Unchanged** |
| Job completion → earnings | Service role + command backend | **Unchanged** |
| Payout-ready / paid-out | Admin API → `executeBookingCommand` (service role backend) | **Unchanged** |
| Manual dispatch / replace offer | Admin API → assignment facades → commands | **Unchanged** |
| Offer expiry cron | Service role client → `expireStaleAssignmentOffers` | **Unchanged** |
| Cleaner accept/decline | Cleaner JWT read + command path; cleaner RLS UPDATE for response fields | **Unchanged** |
| Static command-boundary guards (5B-2) | Unchanged scope | Still required; RLS adds **runtime** enforcement |

---

## Policies removed

| Phase | Migration | Policy dropped | Effect |
|-------|-----------|----------------|--------|
| **5B-3a** | `20260518140000_rls_payments_admin_select_only.sql` | `payments_admin_write` | Admin cannot INSERT/UPDATE/DELETE `payments` via PostgREST |
| **5B-3b-a** | `20260518150000_rls_earning_lines_admin_select_only.sql` | `earning_lines_admin_write` | Admin cannot INSERT/UPDATE/DELETE `earning_lines` via PostgREST |
| **5B-3c-a** | `20260518160000_rls_assignment_offers_admin_select_only.sql` | `assignment_offers_admin_write` | Admin cannot INSERT/UPDATE/DELETE `assignment_offers` via PostgREST |

Each forward migration contains **only** `DROP POLICY IF EXISTS …` plus a table comment. No new policies, triggers, or RPC changes.

---

## Policies preserved

| Table | Policy | Cmd | Role / scope |
|-------|--------|-----|----------------|
| `payments` | `payments_select_admin` | SELECT | `authenticated`, `auth_is_admin()` |
| `payments` | `payments_select_customer` | SELECT | Own booking via `customer_owns_booking` |
| `earning_lines` | `earning_lines_select_admin` | SELECT | Admin |
| `earning_lines` | `earning_lines_select_cleaner` | SELECT | Own cleaner rows |
| `assignment_offers` | `assignment_offers_select_admin` | SELECT | Admin |
| `assignment_offers` | `assignment_offers_select_cleaner` | SELECT | Own offers |
| `assignment_offers` | `assignment_offers_select_customer` | SELECT | Own booking |
| `assignment_offers` | `assignment_offers_update_cleaner` | UPDATE | Cleaner response fields (trigger guard unchanged) |

**RLS enabled** on all three tables (verified in SQL catalog checks and integration gate).

---

## Checklist (15 items)

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | `payments_admin_write` removed | **Pass** | Migration `20260518140000`; `payments_rls_phase1_checks.sql`; static test file |
| 2 | `earning_lines_admin_write` removed | **Pass** | Migration `20260518150000`; `earning_lines_rls_phase3b_checks.sql` |
| 3 | `assignment_offers_admin_write` removed | **Pass** | Migration `20260518160000`; `assignment_offers_rls_phase3c_checks.sql` |
| 4 | Admin SELECT policies preserved | **Pass** | Base migration + catalog checks; integration admin SELECT tests |
| 5 | Customer/cleaner SELECT preserved | **Pass** | Integration tests per table; no forward migration touched them |
| 6 | `assignment_offers_update_cleaner` preserved | **Pass** | Catalog check; integration “cleaner can update offer response fields only” |
| 7 | Payment finalize still works | **Pass** | `finalizePaidBookingAssignment.test.ts`, `verifyPayment.test.ts`, `paymentFinalizeRecovery.test.ts` |
| 8 | Paystack failure handling still works | **Pass** | `processPaystackChargeFailure.test.ts` |
| 9 | Job completion still creates earnings | **Pass** | `earningsAndCompletion.test.ts` (completion + `recordEarningsForBooking`) |
| 10 | Payout_ready / paid_out still works | **Pass** | `earningsAndCompletion.test.ts` — admin command flow, not JWT DML |
| 11 | Manual dispatch still works | **Pass** | `adminManualDispatchOffer.test.ts`, `dispatch-offer/route` tests |
| 12 | Replace open offer still works | **Pass** | `adminReplaceOpenOffer.test.ts`, `replace-open-offer/route` tests |
| 13 | Assignment expiry still works | **Pass** | `expireOffers.test.ts` |
| 14 | One-open-offer constraint still works | **Pass** | `assignment-offer-one-open-per-booking.migration.test.ts`, `executeBookingCommand.test.ts` |
| 15 | Rollback SQL for all three drops | **Pass** | `docs/operations/rls-tightening-rollbacks.md` Phases 1–3 |

---

## Service-role compatibility

`service_role` **bypasses RLS** in Supabase. All production lifecycle writes on the three tables already use service role or SECURITY DEFINER RPCs executed as service role.

| Flow | Entry | Write path | RLS impact |
|------|-------|------------|------------|
| Payment success | Paystack verify/webhook, finalize helpers | `requireServiceRoleClient` → `booking_finalize_payment_success` | None |
| Payment failure | Webhook / failure processor | `booking_record_payment_failure` | None |
| OFFER_TO_CLEANER / cancel offer | Admin APIs, assignment recovery | `executeBookingCommand` → `SupabaseBookingCommandBackend` | None |
| Accept / decline | Cleaner API | Command backend (SR); cleaner JWT may UPDATE response fields only | Cleaner path unchanged |
| Expire offers | Cron route | SR client passed to `expireStaleAssignmentOffers` | None |
| Earnings on complete | Cleaner complete job | Command backend inserts `earning_lines` | None |
| Payout-ready / paid-out | Admin API | `MARK_BOOKING_PAYOUT_READY` / `MARK_BOOKING_PAID_OUT` via command backend | None |

**Registry:** `serviceRoleLifecycleWriteRegistry.test.ts` (5B-2) still governs new service-role importers; unchanged by 5B-3.

---

## Command compatibility

| Command / behavior | Test evidence |
|------------------|---------------|
| `OFFER_TO_CLEANER` | `executeBookingCommand.test.ts`, `adminManualDispatchOffer.test.ts`, `runAssignmentAfterPayment.openOffer.test.ts` |
| `CANCEL_OPEN_ASSIGNMENT_OFFER` | `executeBookingCommand.test.ts`, `adminReplaceOpenOffer.test.ts` |
| `FINALIZE_PAYMENT_SUCCESS` | `finalizePaidBookingAssignment.test.ts`, `earningsAndCompletion.test.ts` setup |
| `MARK_BOOKING_PAYOUT_READY` / paid-out | `earningsAndCompletion.test.ts` |
| Post-offer-ended processing | `processBookingAfterOfferEnded.test.ts` |
| Cleaner routes (accept/decline) | `cleanerMutationRoutes.test.ts` |
| Admin mutation allowlist (5 routes) | `adminApiRoutes.test.ts` |

No assignment command semantics, `expireOffers` logic, or payment RPC bodies were modified in 5B-3.

---

## RLS test evidence

### Audit run (2026-05-17)

| Suite | Result |
|-------|--------|
| `npm run typecheck` | **Pass** |
| `paymentsRlsPhase1Policy.test.ts` | **4/4** |
| `earningLinesRlsPhase3bPolicy.test.ts` | **4/4** |
| `assignmentOffersRlsPhase3cPolicy.test.ts` | **4/4** |
| `rls-policies.integration.test.ts` | **41/41** (includes phase blocks when migrations applied) |
| Payment / Paystack / finalize | **68/68** (12 files) |
| `executeBookingCommand.test.ts` + offer guard | **21/22** (`paymentStatusMutationGuard` — see below) |

### SQL catalog checks (run after migrate)

```bash
psql "$DATABASE_URL" -f supabase/tests/payments_rls_phase1_checks.sql
psql "$DATABASE_URL" -f supabase/tests/earning_lines_rls_phase3b_checks.sql
psql "$DATABASE_URL" -f supabase/tests/assignment_offers_rls_phase3c_checks.sql
```

### Integration coverage by phase

**Payments (5B-3a):** admin SELECT; admin denied INSERT / UPDATE `status` / DELETE; customer SELECT own vs other.

**Earning lines (5B-3b-a):** admin SELECT; admin denied INSERT / UPDATE `payout_status` / DELETE; cleaner SELECT own vs other; customer denied SELECT.

**Assignment offers (5B-3c-a):** admin SELECT; admin denied INSERT / UPDATE `status` / DELETE; cleaner SELECT own vs other; customer SELECT own booking vs other; legacy test validates cleaner UPDATE + field tamper guard.

**Phase probes:** `rlsTestSupport.ts` — `isPaymentsRlsPhase1Applied`, `isEarningLinesRlsPhase3bApplied`, `isAssignmentOffersRlsPhase3cApplied` skip phase blocks when forward migrations are not applied.

---

## Remaining admin `FOR ALL` policies

After Phases 1–3, these **`authenticated` admin `FOR ALL`** policies remain in the schema (from base + later migrations):

| # | Table | Policy | Risk if admin JWT leaked |
|---|-------|--------|---------------------------|
| 1 | `services` | `services_admin_write` | Catalog tamper |
| 2 | `bookings` | `bookings_admin_write` | Metadata/price tamper (`status` blocked by trigger) |
| 3 | `payment_events` | `payment_events_admin_write` | Forge audit / replay confusion |
| 4 | `notification_outbox` | `notification_outbox_admin` | Ops notification tamper |
| 5 | `booking_locks` | `booking_locks_admin_write` | Lock bypass |
| 6 | `payout_batches` | `payout_batches_admin` | Batch tamper |
| 7–10 | Cleaner eligibility tables | `*_admin_write` | Dispatch eligibility tamper |

**Removed from this list:** `payments_admin_write`, `earning_lines_admin_write`, `assignment_offers_admin_write`.

---

## Next RLS candidates (Phase 4+)

Recommended order from [stage-5b-3-rls-tightening-design.md](../architecture/stage-5b-3-rls-tightening-design.md):

| Priority | Policy drop | Rationale |
|----------|-------------|-----------|
| **1** | `payment_events_admin_write` | Forge payment audit trail; app writes events via service role only |
| **2** | `bookings_admin_write` | Admin metadata tamper; `status` already trigger-guarded but `FOR ALL` is broader than needed |
| **3** | `booking_locks_admin_write` | Align with lock repo service-role-only writes |
| **4** | `payout_batches_admin` | No admin JWT writes in API today |
| **5** | `notification_outbox_admin` | Lower lifecycle criticality |
| **6** | Cleaner eligibility `*_admin_write` | Config tables; separate ops slice |
| **Optional** | DB trigger on `payments.status` | Defense in depth (5B-2f); not required for PostgREST close |

**Not recommended next:** Re-tighten tables already shipped; optional `payments.status` trigger only after Phase 4 stabilizes.

---

## Rollback plan

| Phase | Forward migration | Rollback doc section | Restore |
|-------|-------------------|----------------------|---------|
| 1 | `20260518140000_rls_payments_admin_select_only.sql` | Phase 1 | `CREATE POLICY payments_admin_write … FOR ALL` |
| 2 | `20260518150000_rls_earning_lines_admin_select_only.sql` | Phase 2 | `CREATE POLICY earning_lines_admin_write … FOR ALL` |
| 3 | `20260518160000_rls_assignment_offers_admin_select_only.sql` | Phase 3 | `CREATE POLICY assignment_offers_admin_write … FOR ALL` |

**Procedure:** Apply rollback SQL from [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md) per phase; re-run matching `*_rls_phase*_checks.sql`; no application deploy rollback required if only RLS changed.

**Deploy order:** Apply all three forward migrations in timestamp order on staging → run integration + smoke → production.

---

## Residual gaps (non-blocking)

| Gap | Severity | Note |
|-----|----------|------|
| `paymentStatusMutationGuard.test.ts` flags `tests/security/rlsTestSupport.ts` | **Low** | RLS phase-1 probe updates `payments.status` for admin-write detection; mirror allowlist already added for offers in `assignmentOfferStatusMutationGuard.test.ts`. Add `tests/security/rlsTestSupport.ts` to `ALLOWED_PAYMENT_STATUS_WRITE_SRC` (and earning_lines guard if extended). |
| Remote integration gate | **Ops** | Set `BOOKING_COMMAND_RUN_REMOTE_INTEGRATION=true` only when running RLS integration against non-local Supabase. |
| Supabase Studio | **Intended** | Admins using Table Editor with their JWT lose write on tightened tables — use controlled service role for break-glass ops. |
| `bookings_admin_write` / `payment_events_admin_write` | **Latent** | Still open PostgREST paths; Phase 4 design |

---

## Final verdict

### Is Stage 5B-3 (Phases 1–3) safe to deploy?

**Yes.** Evidence:

1. Three minimal forward migrations drop only admin `FOR ALL` write policies.
2. SELECT and cleaner-offer UPDATE policies are intact.
3. Service-role and command paths are unchanged and covered by regression tests.
4. Integration tests prove admin JWT cannot mutate lifecycle columns on tightened tables when migrations are applied.
5. Rollback SQL is documented per phase.

**Deploy checklist:** `supabase db push` / migrate on staging → catalog SQL checks → `rls-policies.integration.test.ts` → payment + assignment + earnings smoke → production migrate.

### What is the next highest-value governance slice?

**Stage 5B-3 Phase 4 (implementation):** drop **`payment_events_admin_write`** and **`bookings_admin_write`**, with the same pattern (admin SELECT-only + integration tests + rollback doc). This closes the next-largest PostgREST bypass surface on the payment audit trail and booking row tampering, while leaving 5B-2 static guards and service-role command paths as the application contract.

Secondary: **`booking_locks_admin_write`** and **`payout_batches_admin`** for parity with lock/payout command-only writes.

---

## References

| Artifact | Path |
|----------|------|
| Forward migrations | `supabase/migrations/20260518140000_*.sql`, `20260518150000_*.sql`, `20260518160000_*.sql` |
| SQL catalog checks | `supabase/tests/payments_rls_phase1_checks.sql`, `earning_lines_rls_phase3b_checks.sql`, `assignment_offers_rls_phase3c_checks.sql` |
| Static policy tests | `src/tests/security/paymentsRlsPhase1Policy.test.ts`, `earningLinesRlsPhase3bPolicy.test.ts`, `assignmentOffersRlsPhase3cPolicy.test.ts` |
| Integration tests | `src/tests/security/rls-policies.integration.test.ts` |
| Rollbacks | `docs/operations/rls-tightening-rollbacks.md` |
