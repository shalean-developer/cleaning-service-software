# Stage 5B-3 Phase 4 — payment_events + bookings RLS Tightening (Design)

**Date:** 2026-05-17  
**Status:** Design — **Phase 5B-3 Phase 4a implemented** in `20260518170000_rls_payment_events_bookings_admin_select_only.sql`  
**Depends on:** [stage-5b-3-rls-tightening-design.md](./stage-5b-3-rls-tightening-design.md), [stage-5b-3-rls-admin-write-tightening-final-audit.md](../audits/stage-5b-3-rls-admin-write-tightening-final-audit.md) (Phases 1–3 shipped), [command-boundary-static-guards.md](../security/command-boundary-static-guards.md)

**Goal:** Design removal of admin JWT/PostgREST **`FOR ALL`** write access on `payment_events` and `bookings` — the next highest-risk remaining admin write policies after Phases 1–3 (`payments`, `earning_lines`, `assignment_offers`).

**Hard constraints (this stage):**

- Do **not** implement migrations or change RLS in this document.
- Do **not** change `booking_finalize_payment_success`, `booking_record_payment_failure`, or `booking_apply_transition`.
- Do **not** change assignment commands, accept/decline, `expireOffers`, or earnings formulas.
- Do **not** expose `ADMIN_OVERRIDE_STATUS` via new policies or APIs.

---

## Executive summary

| Question | Answer |
|----------|--------|
| Drop together or separately? | **One logical slice (Phase 4), one migration file with two `DROP POLICY` statements** — same PR, same integration test block, same deploy window. Optional: two timestamped migration files if rollback per table is required (see §Migration recommendation). |
| Policies to drop | `payment_events_admin_write`, `bookings_admin_write` only |
| Policies to preserve | All existing `SELECT` policies; `bookings_update_customer`; triggers unchanged |
| Admin UI needs JWT writes? | **No** — admin dashboards/APIs are read-only on these tables at PostgREST |
| Paystack idempotency affected? | **No** — `payment_events` inserts use **service_role**; dedupe is `provider_event_id` UNIQUE |
| Payout / dispatch affected? | **No** — admin payout and assignment actions use **service_role** + `executeBookingCommand` / RPCs |
| Safe after Phases 1–3? | **Yes**, same pattern as 5B-3a–c |

---

## 1. Current policy map

**Source:** `supabase/migrations/20260516160000_rls_role_security.sql`  
**Phases 1–3 (already applied in target env):** `payments_admin_write`, `earning_lines_admin_write`, `assignment_offers_admin_write` dropped.

### 1.1 `payment_events`

| Policy | Cmd | Role | Predicate |
|--------|-----|------|-----------|
| `payment_events_select_customer` | `SELECT` | `authenticated` | Payment’s booking owned by customer (`customer_owns_booking` via join) |
| `payment_events_select_admin` | `SELECT` | `authenticated` | `auth_is_admin()` |
| **`payment_events_admin_write`** | **`ALL`** | **`authenticated`** | **`auth_is_admin()`** (USING + WITH CHECK) |

**RLS:** Enabled on `public.payment_events`.  
**Schema:** `provider_event_id` **UNIQUE** (`payment_events_provider_event_id_unique`) — application dedupe for webhook/verify replay.

**No cleaner policy.** No customer INSERT/UPDATE policy (writes are not exposed to customer JWT).

### 1.2 `bookings`

| Policy | Cmd | Role | Predicate |
|--------|-----|------|-----------|
| `bookings_select_customer` | `SELECT` | `authenticated` | `customer_id = auth_customer_id()` |
| `bookings_select_cleaner` | `SELECT` | `authenticated` | `cleaner_can_access_booking(id)` |
| `bookings_select_admin` | `SELECT` | `authenticated` | `auth_is_admin()` |
| `bookings_update_customer` | `UPDATE` | `authenticated` | Own row (USING + WITH CHECK) |
| **`bookings_admin_write`** | **`ALL`** | **`authenticated`** | **`auth_is_admin()`** (USING + WITH CHECK) |

**RLS:** Enabled on `public.bookings`.  
**Trigger:** `guard_booking_status_change` — blocks **authenticated** sessions from changing `bookings.status` on INSERT/UPDATE (`BOOKING_STATUS_MUTATION_FORBIDDEN`). **Does not run** for `service_role` (`auth.uid()` null in typical SR JWT context).

**Important nuance:** Admin JWT **cannot** change `status` via PostgREST today because of the trigger, but **`bookings_admin_write` `FOR ALL`** still allows admin JWT to INSERT/DELETE rows and UPDATE **non-status** columns (`price_cents`, `cleaner_id`, `metadata`, `customer_id`, schedule fields).

---

## 2. App read / write inventory

### 2.1 Admin reads (JWT — must keep SELECT)

| Consumer | Module | Tables | Pattern |
|----------|--------|--------|---------|
| Admin bookings list | `adminOperationsReadModel.listAdminBookings` | `bookings` | `createSupabaseServerClient()` — SELECT |
| Admin booking detail | `getAdminBookingDetail` | `bookings`, `payments`, `assignment_offers`, `booking_state_audit`, `admin_operational_audit`, `earning_lines`, **`payment_events`** | Admin JWT SELECT |
| Admin ops summary | `getAdminOperationsSummary` | Via list + assignment queue | SELECT `bookings` |
| Admin assignment queue | `listAdminAssignmentQueue` | `bookings` (+ related reads) | SELECT |
| Admin pages | `(admin)/admin/bookings/*`, dashboard | Via read models | No direct DML in `src/app/(admin)` |

**`payment_events` admin read:** `getAdminBookingDetail` loads events for timeline/debug:

```431:435:src/features/dashboards/server/adminOperationsReadModel.ts
    const { data: events } = await client
      .from("payment_events")
      .select("id, event_type, received_at, payment_id")
      .in("payment_id", paymentIds)
```

**Verified:** No `.insert` / `.update` / `.delete` on `bookings` or `payment_events` in `src/features/dashboards` or `src/app/(admin)`.

### 2.2 Admin writes (production)

| Action | Path | Client | Touches |
|--------|------|--------|---------|
| Payout-ready / paid-out | `POST .../payout-ready`, `mark-paid-out` | **Service role** via `createBookingCommandBackend()` | `bookings` status via **RPC**; `earning_lines` via backend |
| Dispatch / replace / recovery | Admin assignment APIs | **Service role** for preflight + commands | `bookings` metadata via `updateBookingMetadata` (SR); offers via SR |
| All other booking lifecycle | Commands | **Service role** + `booking_*` RPCs | `bookings` |

Admin **JWT is used for auth** on API routes; **not** for lifecycle DML on `bookings` / `payment_events`.

### 2.3 Customer / cleaner reads

| Role | `bookings` | `payment_events` |
|------|------------|------------------|
| Customer | `customerBookingReadModel` — SELECT own | Policy exists; **no app read path today** |
| Cleaner | `cleanerJobReadModel`, offers — SELECT via assignment | — |

### 2.4 Customer writes (`bookings` only)

| Policy | Usage |
|--------|--------|
| `bookings_update_customer` | Reserved for customer-owned row updates; **status** blocked by trigger |

**App layer:** No `src/app` routes patch `bookings` directly; draft/checkout flows use **commands (SR)**. Preserving `bookings_update_customer` is required for Phase 4; do not drop or narrow in this slice.

### 2.5 Production writes — `payment_events`

| Writer | Module | Client | Operation |
|--------|--------|--------|-----------|
| Paystack success | `finalizePaidBooking.ts` | `requireServiceRoleClient()` | `recordPaymentEvent` → INSERT |
| Paystack failure | `processPaystackChargeFailure.ts` | `requireServiceRoleClient()` | `recordPaymentEvent` → INSERT |
| Webhook router | `handlePaystackWebhook.ts` | Delegates to above (SR) | INSERT |

**Single adapter:** `recordPaymentEvent.ts` — INSERT only; treats `23505` as `duplicate` for idempotency.

### 2.6 Production writes — `bookings`

| Writer | Module | Client | Operation |
|--------|--------|--------|-----------|
| Draft create | `SupabaseBookingCommandBackend.insertBooking` | Service role | INSERT (`status` typically `draft`) |
| Status lifecycle | `applyTransition`, `finalizePaymentSuccess`, `recordPaymentFailure`, etc. | Service role | **`booking_*` RPCs** (not JWT UPDATE) |
| Assignment metadata | `updateBookingMetadata` | Service role | UPDATE `metadata`, `updated_at` |
| Cron expire payments | `expirePendingPayments.ts` | Service role | Commands / RPC |
| Assignment / recovery facades | `adminManualDispatchOffer`, `adminReplaceOpenOffer`, `runAssignmentRecovery`, etc. | Service role for reads + commands | No admin JWT booking writes |

**No production path** uses admin JWT to INSERT/UPDATE/DELETE `bookings`.

---

## 3. Service-role / RPC compatibility analysis

### 3.1 Must keep working (unchanged by Phase 4)

| Flow | Mechanism | RLS impact |
|------|-----------|------------|
| Payment finalize | `booking_finalize_payment_success` + `recordPaymentEvent` (SR) | None — SR bypasses RLS |
| Paystack failure | `booking_record_payment_failure` + `recordPaymentEvent` (SR) | None |
| Payment init / verify | `initializePayment`, `verifyPayment` (SR) | None |
| All `executeBookingCommand` types | `createBookingCommandBackend()` → SR | None |
| Cleaner accept/decline / job | Commands + RPC | None |
| Admin dispatch / replace / recovery | SR commands | None |
| Cron (`expire-pending-payments`, `expire-assignment-offers`, `recover-assignment`) | SR | None |
| `expireOffers` | SR client passed from cron | None |
| Earnings on complete / payout | SR `earning_lines` + RPC | None (Phase 2 already tightened) |

### 3.2 `payment_events` idempotency (audit question 11)

**Design:**

1. `recordPaymentEvent` INSERT with `provider_event_id` from Paystack charge.
2. Unique violation (`23505`) → `{ outcome: "duplicate" }` — caller continues or short-circuits appropriately.
3. `finalizePaidBooking` records event **before** `FINALIZE_PAYMENT_SUCCESS` command (SR client).

**Effect of dropping `payment_events_admin_write`:**

| Concern | Impact |
|---------|--------|
| Production webhook/verify dedupe | **Unchanged** — still SR inserts |
| Admin forging duplicate `provider_event_id` | **Prevented** — closes latent “poison idempotency key” via PostgREST |
| Admin deleting events | **Prevented** — today possible via `FOR ALL` |

**Conclusion:** Phase 4 **improves** idempotency safety; does not break Paystack paths.

### 3.3 Admin payout / assignment (audit question 10)

| Action | Writes `bookings` how? | Needs `bookings_admin_write`? |
|--------|------------------------|-------------------------------|
| Payout-ready / paid-out | RPC `booking_apply_transition` (SR) | **No** |
| OFFER_TO_CLEANER / cancel offer | SR metadata + offers; booking status via commands when applicable | **No** |
| Recover assignment | SR `runAssignmentAfterPayment` | **No** |
| Admin dashboard read | JWT SELECT | **SELECT only** |

**Conclusion:** Dropping `bookings_admin_write` does **not** block admin payout or assignment operations.

### 3.4 `ADMIN_OVERRIDE_STATUS` (audit constraint)

- Exists only in `executeBookingCommand` + backends; **no API/UI**.
- Uses SR `booking_apply_transition` RPC.
- Phase 4 must **not** add any admin policy that restores override via PostgREST.
- RLS drop does **not** remove command-layer override (still reachable only with service role key).

---

## 4. Audit question index

| # | Question | Answer |
|---|----------|--------|
| 1 | RLS on `payment_events`? | §1.1 — 2 SELECT + 1 admin `FOR ALL` |
| 2 | RLS on `bookings`? | §1.2 — 3 SELECT + customer UPDATE + admin `FOR ALL` |
| 3 | Admin paths read `payment_events`? | `getAdminBookingDetail` only (§2.1) |
| 4 | Admin paths read `bookings`? | Admin read model + queue (§2.1) |
| 5 | Production writes `payment_events`? | `recordPaymentEvent` via SR only (§2.5) |
| 6 | Production writes `bookings`? | SR insert + RPC + `updateBookingMetadata` (§2.6) |
| 7 | Command/RPC paths to preserve? | §3.1 |
| 8 | Admin UI need I/U/D? | **No** (§2.2) |
| 9 | Admin keep SELECT only? | **Yes** — target state |
| 10 | `bookings_admin_write` vs payout/assignment? | **No impact** (§3.3) |
| 11 | `payment_events_admin_write` vs Paystack idempotency? | **No negative impact** (§3.2) |
| 12 | Integration tests needed? | §7 |
| 13 | Rollback SQL? | §9 |
| 14 | One migration or two? | §6 |

---

## 5. Proposed target policy

| Table | Drop | Admin (`authenticated`) | Customer | Cleaner | Writes |
|-------|------|-------------------------|----------|---------|--------|
| `payment_events` | `payment_events_admin_write` | **SELECT** (`payment_events_select_admin`) | **SELECT** (unchanged) | — | **SR only** (`recordPaymentEvent`) |
| `bookings` | `bookings_admin_write` | **SELECT** (`bookings_select_admin`) | **SELECT** + **UPDATE** own (unchanged) | **SELECT** (unchanged) | Status: **RPC**; insert/metadata: **SR** / commands |

**Do not add** replacement admin UPDATE policies (same lesson as Phases 1–3: drop `FOR ALL` only).

---

## 6. Phased migration recommendation

### 6.1 Recommended shipping unit

| Approach | Recommendation |
|----------|----------------|
| **PR / release** | **Single Phase 4 PR** with both policy drops, catalog SQL, integration tests, rollback doc section |
| **Migration file** | **One file** e.g. `20260518170000_rls_payment_events_bookings_admin_select_only.sql` containing **both** `DROP POLICY` statements + table comments |
| **Alternative** | Two files (`..._payment_events_...`, `..._bookings_...`) in one PR if ops wants per-table `supabase migration repair` rollback — functionally equivalent |

**Rationale for one migration:**

- Same risk class (admin PostgREST bypass removal).
- Master design Phase 3 grouped these two policies.
- Admin booking detail reads both tables; one integration test `describe` block.
- Phases 1–3 used **one table per file** because they shipped incrementally; Phase 4 is intentionally paired.

**Rationale against splitting releases:**

- No production dependency on admin JWT writes for either table.
- No ordering dependency between the two drops.

### 6.2 Suggested migration shape (illustrative — do not apply from design doc)

```sql
-- Stage 5B-3d (Phase 4): admin SELECT-only on payment_events and bookings.

drop policy if exists payment_events_admin_write on public.payment_events;
drop policy if exists bookings_admin_write on public.bookings;

comment on table public.payment_events is
  'Raw provider webhook / event log. Inserts via service_role (recordPaymentEvent). Admin authenticated: SELECT only (5B-3d).';

comment on table public.bookings is
  'Booking aggregate. Status via booking_* RPCs (service_role); metadata via commands. Admin authenticated: SELECT only (5B-3d).';
```

---

## 7. SQL / catalog test plan

Add (mirror Phases 1–3):

| File | Asserts |
|------|---------|
| `supabase/tests/payment_events_rls_phase3d_checks.sql` | RLS enabled; `payment_events_admin_write` absent; `payment_events_select_admin` + `payment_events_select_customer` present; no unexpected authenticated `ALL` |
| `supabase/tests/bookings_rls_phase3d_checks.sql` | RLS enabled; `bookings_admin_write` absent; all three `bookings_select_*` + `bookings_update_customer` present |

Extend `supabase/tests/rls_role_security_checks.sql` header comment to reference both files after Phase 4.

**Static TS tests (mirror existing):**

- `src/tests/security/paymentEventsRlsPhase3dPolicy.test.ts`
- `src/tests/security/bookingsRlsPhase3dPolicy.test.ts`  
  Or single `phase4RlsPolicy.test.ts` with two describes.

Each asserts: forward migration drops only the intended policy; no touches to payments/earning_lines/assignment_offers migrations; rollback doc contains `CREATE POLICY`.

---

## 8. RLS integration test plan

Extend `src/tests/security/rls-policies.integration.test.ts` with phase probes in `rlsTestSupport.ts`:

- `isPaymentEventsRlsPhase3dApplied(serviceClient, adminProbeClient, eventId)`
- `isBookingsRlsPhase3dApplied(serviceClient, adminProbeClient, bookingId)`

### 8.1 `payment_events` block

| Test | Actor | Expect |
|------|-------|--------|
| Admin SELECT | Admin JWT | Success on fixture event |
| Admin INSERT | Admin JWT | Denied / 0 rows |
| Admin UPDATE | Admin JWT | Denied / unchanged |
| Admin DELETE | Admin JWT | Denied; row still exists (service role verify) |
| Customer SELECT own | Customer JWT | Success when payment on own booking (fixture) |
| Customer SELECT other | Customer JWT | 0 rows |
| Customer INSERT | Customer JWT | Denied |

### 8.2 `bookings` block

| Test | Actor | Expect |
|------|-------|--------|
| Admin SELECT | Admin JWT | Success |
| Admin INSERT | Admin JWT | Denied |
| Admin UPDATE `status` | Admin JWT | **Trigger error** `BOOKING_STATUS_MUTATION_FORBIDDEN` (unchanged behavior) |
| Admin UPDATE `price_cents` or `metadata` | Admin JWT | **Denied by RLS** (new — today allowed via `bookings_admin_write`) |
| Admin DELETE | Admin JWT | Denied |
| Customer UPDATE non-status field | Customer JWT | Success if app uses customer update path (or allowed column patch in test) |
| Customer UPDATE `status` | Customer JWT | Trigger forbidden (existing test) |
| Service role RPC smoke | Service role | `booking_apply_transition` or existing RPC test still passes |

Place Phase 4 `describe` blocks **after** Phases 1–3 blocks; reuse `beforeAll` fixtures (`bookingAId`, `paymentAId`, `payment_events` row from existing setup).

---

## 9. Application regression tests (no DB)

Run unchanged CI suites (no production code changes in Phase 4):

| Area | Tests |
|------|-------|
| Payment finalize | `finalizePaidBookingAssignment.test.ts`, `paymentFinalizeRecovery.test.ts`, `verifyPayment.test.ts` |
| Paystack failure | `processPaystackChargeFailure.test.ts`, `paystackFoundation.test.ts` |
| Commands | `executeBookingCommand.test.ts` |
| Admin ops | `adminManualDispatchOffer.test.ts`, `adminReplaceOpenOffer.test.ts`, `adminApiRoutes.test.ts` |
| Earnings / payout | `earningsAndCompletion.test.ts` |
| Static guards | Full 5B-2 suite; optional allowlist `rlsTestSupport.ts` in `bookingStatusMutationGuard` if probes patch `bookings` |

---

## 10. Rollback SQL

Document in `docs/operations/rls-tightening-rollbacks.md` as **Phase 4 (5B-3d)**.

### 10.1 `payment_events_admin_write`

```sql
drop policy if exists payment_events_admin_write on public.payment_events;

create policy payment_events_admin_write on public.payment_events
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
```

### 10.2 `bookings_admin_write`

```sql
drop policy if exists bookings_admin_write on public.bookings;

create policy bookings_admin_write on public.bookings
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
```

**Verify after rollback:** run both `*_rls_phase3d_checks.sql` files; expect admin `FOR ALL` policies to reappear.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Admin Table Editor break-glass | Document: admins lose JWT writes on these tables — intentional; use controlled service role |
| Hidden admin JWT write in new code | 5B-2 route/facade guards; PR checklist; grep `from("bookings")` / `from("payment_events")` in admin paths |
| Customer `bookings_update_customer` regression | Explicit integration test; do not touch customer policy |
| Confusion: status trigger vs RLS | Tests document: status already blocked for all authenticated; Phase 4 blocks **metadata/price** admin tamper |
| Poison `provider_event_id` before webhook | Already a latent risk with admin write; Phase 4 closes it |
| `rlsTestSupport` static guards | Allowlist test-only probes in `bookingStatusMutationGuard` / new payment_events insert guard if added |
| Split deploy partial Phase 4 | Ship single migration with both drops to avoid asymmetric policy state |

---

## 12. Final recommendation

### Should `payment_events_admin_write` and `bookings_admin_write` be dropped together or separately?

| Dimension | Recommendation |
|-----------|----------------|
| **Deploy** | **Together** in one Phase 4 release |
| **Migration file** | **One migration**, two `DROP POLICY` lines (simplest ops story) |
| **Rollback** | Document **two** `CREATE POLICY` blocks so either table can be restored independently if needed |
| **Tests** | One integration `describe` per table; one PR |

Dropping only one policy first adds little safety value because production does not use admin JWT writes on either table.

### Which exact policies should be preserved?

**`payment_events` — keep:**

- `payment_events_select_admin`
- `payment_events_select_customer`

**`bookings` — keep:**

- `bookings_select_admin`
- `bookings_select_customer`
- `bookings_select_cleaner`
- `bookings_update_customer`
- Trigger `guard_booking_status_change` (unchanged)

**Drop only:**

- `payment_events_admin_write`
- `bookings_admin_write`

**Explicitly out of Phase 4 scope:** `booking_locks_admin_write`, `payout_batches_admin`, `notification_outbox_admin`, `services_admin_write`, cleaner eligibility `*_admin_write`, optional `payments.status` DB trigger (5B-2f).

### Ready to implement?

**Yes**, after Phases 1–3 are applied in the target environment. Implementation slice = migration + SQL checks + static policy tests + `rls-policies.integration.test.ts` extensions + rollback doc + `command-boundary-static-guards.md` Phase 4 note — **no application or RPC changes**.

---

## References

| Artifact | Path |
|----------|------|
| Base RLS | `supabase/migrations/20260516160000_rls_role_security.sql` |
| Phase 1–3 migrations | `20260518140000_*`, `20260518150000_*`, `20260518160000_*` |
| Record events | `src/features/payments/server/recordPaymentEvent.ts` |
| Finalize / failure | `src/features/payments/server/finalizePaidBooking.ts`, `processPaystackChargeFailure.ts` |
| Admin reads | `src/features/dashboards/server/adminOperationsReadModel.ts` |
| Command backend | `src/features/bookings/server/commands/supabaseBookingCommandBackend.ts` |
| Phase 1–3 audit | `docs/audits/stage-5b-3-rls-admin-write-tightening-final-audit.md` |
| Rollbacks (extend) | `docs/operations/rls-tightening-rollbacks.md` |
