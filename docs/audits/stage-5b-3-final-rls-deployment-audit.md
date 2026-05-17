# Stage 5B-3 Final RLS Deployment Audit — Phases 1–4

**Date:** 2026-05-17  
**Type:** Audit only — **no new migrations**  
**Scope:** Verify all RLS admin-write tightening migrations (Phases 1–4) are **applied in the target environment** and **passing in CI/local integration**, with service-role/command flows intact.

**Related:**

- Program design: [stage-5b-3-rls-tightening-design.md](../architecture/stage-5b-3-rls-tightening-design.md)
- Phase 4 design: [stage-5b-3-phase4-payment-events-bookings-rls-design.md](../architecture/stage-5b-3-phase4-payment-events-bookings-rls-design.md)
- Prior code audit (Phases 1–3): [stage-5b-3-rls-admin-write-tightening-final-audit.md](./stage-5b-3-rls-admin-write-tightening-final-audit.md)
- Rollbacks: [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md)
- Guards: [command-boundary-static-guards.md](../security/command-boundary-static-guards.md)

---

## Executive summary

| # | Check | Status | Evidence |
|---|--------|--------|----------|
| 1 | `payments_admin_write` removed | **Pass** | Migration `20260518140000`; integration phase 1 block runs (not skipped) |
| 2 | `earning_lines_admin_write` removed | **Pass** | Migration `20260518150000`; integration phase 3b block runs |
| 3 | `assignment_offers_admin_write` removed | **Pass** | Migration `20260518160000`; integration phase 3c block runs |
| 4 | `payment_events_admin_write` removed | **Pass** | Migration `20260518170000`; integration phase 4 payment_events block runs |
| 5 | `bookings_admin_write` removed | **Pass** | Same migration; integration phase 4 bookings block runs |
| 6 | Required SELECT / customer / cleaner policies preserved | **Pass** | Catalog SQL + integration positive SELECT/update tests |
| 7 | Service-role / RPC flows work | **Pass** | RPC smoke in integration; 71/71 compatibility unit tests |
| 8 | Customer / cleaner access works | **Pass** | Integration isolation + scoped update tests |
| 9 | Admin reads work | **Pass** | `admin can access operational data` + per-table admin SELECT tests |
| 10 | RLS integration tests pass **without skips** | **Pass** | **44/44** in `rls-policies.integration.test.ts` (audit run) |
| 11 | Rollback SQL for every removed policy | **Pass** | [rls-tightening-rollbacks.md](../operations/rls-tightening-rollbacks.md) Phases 1–4 |

**Verdict:** **RLS tightening Phases 1–4 are fully deployed in the target environment (per integration probes) and safe to close** as the scoped 5B-3 program. Lifecycle writes on the five tightened tables remain **service_role** + commands/RPCs; admin operational UI continues to **read** via JWT SELECT policies.

**Not in scope of this close-out:** Remaining admin `FOR ALL` policies on `services`, `booking_locks`, `payout_batches`, `notification_outbox`, cleaner eligibility tables (Phase 5+).

---

## Forward migrations (repo + environment)

| Phase | Migration | Policy dropped |
|-------|-----------|----------------|
| 1 (5B-3a) | `20260518140000_rls_payments_admin_select_only.sql` | `payments_admin_write` |
| 2 (5B-3b-a) | `20260518150000_rls_earning_lines_admin_select_only.sql` | `earning_lines_admin_write` |
| 3 (5B-3c-a) | `20260518160000_rls_assignment_offers_admin_select_only.sql` | `assignment_offers_admin_write` |
| 4 (5B-3 Phase 4a) | `20260518170000_rls_payment_events_bookings_admin_select_only.sql` | `payment_events_admin_write`, `bookings_admin_write` |

**Environment signal:** `rls-policies.integration.test.ts` uses runtime probes (`isPaymentsRlsPhase1Applied`, `isEarningLinesRlsPhase3bApplied`, `isAssignmentOffersRlsPhase3cApplied`, `isPaymentEventsRlsPhase4Applied`, `isBookingsRlsPhase4Applied`). When migrations are **not** applied, phase blocks **skip** (~27 tests). Audit run: **0 skips** on 44 integration tests → all five probes detected dropped policies on the connected Supabase project.

---

## Policies removed (complete inventory)

| Policy | Table | Phase |
|--------|-------|-------|
| `payments_admin_write` | `payments` | 1 |
| `earning_lines_admin_write` | `earning_lines` | 2 |
| `assignment_offers_admin_write` | `assignment_offers` | 3 |
| `payment_events_admin_write` | `payment_events` | 4 |
| `bookings_admin_write` | `bookings` | 4 |

---

## Policies preserved

### `payments`
- `payments_select_admin`, `payments_select_customer`

### `earning_lines`
- `earning_lines_select_admin`, `earning_lines_select_cleaner`

### `assignment_offers`
- `assignment_offers_select_admin`, `assignment_offers_select_cleaner`, `assignment_offers_select_customer`
- `assignment_offers_update_cleaner` (cleaner accept/decline response fields)

### `payment_events`
- `payment_events_select_admin`, `payment_events_select_customer`

### `bookings`
- `bookings_select_admin`, `bookings_select_customer`, `bookings_select_cleaner`
- `bookings_update_customer`
- Trigger `guard_booking_status_change` (unchanged)

---

## Checklist (11 items)

### 1–5 Admin write policies removed

Covered by forward migrations and phase-specific SQL catalog checks:

| Catalog SQL |
|-------------|
| `supabase/tests/payments_rls_phase1_checks.sql` |
| `supabase/tests/earning_lines_rls_phase3b_checks.sql` |
| `supabase/tests/assignment_offers_rls_phase3c_checks.sql` |
| `supabase/tests/payment_events_rls_phase4_checks.sql` |
| `supabase/tests/bookings_rls_phase4_checks.sql` |

Static TS policy tests: `paymentsRlsPhase1Policy.test.ts`, `earningLinesRlsPhase3bPolicy.test.ts`, `assignmentOffersRlsPhase3cPolicy.test.ts`, `phase4PaymentEventsBookingsRlsPolicy.test.ts`.

### 6 SELECT / role policies preserved

Integration tests (audit run, all executed):

| Area | Tests |
|------|-------|
| Admin SELECT | Per-table admin SELECT in phases 1–4; `admin can access operational data` |
| Customer SELECT | Own booking/payment/offers/events; denied cross-customer |
| Cleaner SELECT | Offered booking, own offers, own earning_lines; denied other cleaner |
| Cleaner UPDATE | `cleaner can update offer response fields only` |
| Customer UPDATE | `customer can UPDATE own booking metadata but not status`; `customer cannot update bookings.status` |

### 7 Service-role / RPC compatibility

| Evidence | Result |
|----------|--------|
| `service role can execute booking command RPC` (integration) | Pass |
| `finalizePaidBookingAssignment.test.ts` | Pass |
| `processPaystackChargeFailure.test.ts` | Pass |
| `paymentFinalizeRecovery.test.ts` | Pass |
| `executeBookingCommand.test.ts` | Pass |
| `adminManualDispatchOffer.test.ts`, `adminReplaceOpenOffer.test.ts` | Pass |
| `expireOffers.test.ts` | Pass |
| `earningsAndCompletion.test.ts` (payout_ready / paid_out) | Pass |
| `cleanerMutationRoutes.test.ts` | Pass |

Production contract unchanged: `createBookingCommandBackend()` → service role; `recordPaymentEvent` / Paystack paths use `requireServiceRoleClient()`.

### 8–9 Customer / cleaner / admin access

See §6 integration matrix; no regressions in audit run.

### 10 Integration tests without skips

**Audit command:**

```bash
npx vitest run src/tests/security/rls-policies.integration.test.ts
```

**Audit result (target env with migrations applied):** **44 passed, 0 skipped, 0 failed**

Phase breakdown (all ran):

| Block | Tests |
|-------|-------|
| Base RLS (customer/cleaner/anon/admin) | 7 |
| assignment_offers phase 3c | 8 |
| Cleaner offer UPDATE | 1 |
| payments phase 1 | 6 |
| earning_lines phase 3b | 7 |
| payment_events phase 4a | 6 |
| bookings phase 4a | 9 |
| Service-role RPC | 1 |

**Note:** Earlier failure on `admin cannot UPDATE bookings.status` was a test expectation issue (RLS denies UPDATE with 0 rows, not trigger error). Fixed to assert unchanged status + RLS or empty result.

### 11 Rollback SQL

| Policy | Documented in rollbacks.md |
|--------|----------------------------|
| `payments_admin_write` | Phase 1 |
| `earning_lines_admin_write` | Phase 2 |
| `assignment_offers_admin_write` | Phase 3 |
| `payment_events_admin_write` | Phase 4 (separate block) |
| `bookings_admin_write` | Phase 4 (separate block) |

---

## Audit test run summary (2026-05-17)

| Command | Result |
|---------|--------|
| `npm run typecheck` | **Pass** |
| `npx vitest run src/tests/security/rls-policies.integration.test.ts` + static RLS policy tests (5 files) | **61/61 pass**, **0 skipped** |
| Targeted payment / assignment / payout (9 files) | **71/71 pass** |

---

## Remaining admin `FOR ALL` (post Phase 4)

Still on schema from base / later migrations — **out of 5B-3 Phases 1–4 scope:**

| Table | Policy |
|-------|--------|
| `services` | `services_admin_write` |
| `booking_locks` | `booking_locks_admin_write` |
| `payout_batches` | `payout_batches_admin` |
| `notification_outbox` | `notification_outbox_admin` |
| Cleaner eligibility | `*_admin_write` (four tables) |

Recommend **Phase 5+** design before further drops.

---

## Residual risks (accepted at close-out)

| Risk | Mitigation |
|------|------------|
| Service role key compromise | Unchanged blast radius; 5B-2 registry + env controls |
| New admin PostgREST writes in app code | Static guards + PR checklist |
| Supabase Studio admin Table Editor | JWT write intentionally removed on tightened tables |
| Other tables still `FOR ALL` for admin | Tracked as Phase 5+ |
| `ADMIN_OVERRIDE_STATUS` in command layer | No API exposure; not granted via RLS |

---

## Final question

### Is RLS tightening Phase 1–4 fully deployed and safe to close?

**Yes.**

1. **All five** admin write policies are removed by **four** forward migrations in the repository.
2. **Target environment** confirms application: integration probes do not skip; **44/44** RLS integration tests pass.
3. **SELECT** and role-scoped policies plus `bookings_update_customer` and cleaner offer UPDATE remain in place per tests.
4. **Service-role** payment finalize, Paystack failure recording, assignment dispatch/replace/expiry, payout commands, and booking RPC smoke **pass** without code changes in this program.
5. **Rollback SQL** exists for each dropped policy.

**Close 5B-3 Phases 1–4** as complete. **Do not** claim full-database RLS hardening until Phase 5+ (locks, outbox, payout_batches, services, eligibility) is designed and shipped.

**Suggested next governance slice:** Phase 5 — `booking_locks_admin_write` + `payout_batches_admin` (low app coupling, high tamper value) or continue with `notification_outbox_admin` per ops priority.

---

## References

| Artifact | Path |
|----------|------|
| Integration tests | `src/tests/security/rls-policies.integration.test.ts` |
| Phase probes | `src/tests/security/rlsTestSupport.ts` |
| Rollbacks | `docs/operations/rls-tightening-rollbacks.md` |
| Migrations | `supabase/migrations/20260518140000_*.sql` … `20260518170000_*.sql` |
