# Stage 1C — Customer provisioning final audit

**Date:** 2026-05-17  
**Scope:** Stage 1C-1 (role hardening), 1C-2 (DB auto-provisioning), 1C-3 (app readiness gates)  
**Type:** Audit only — no new features implemented in this pass.

---

## Executive summary

Stage 1C closes the **customer identity/provisioning gap** identified in Stage 1A/1B: auth users now get a safe default profile role, customer profiles get a `customers` row automatically (with repair paths), and the app blocks booking flows until `actingCustomerId` resolves.

| # | Check | Verdict |
|---|--------|---------|
| 1 | `handle_new_user` always defaults to `customer` | **Pass** |
| 2 | Signup metadata cannot create `admin`/`cleaner` | **Pass** |
| 3 | Customer profiles auto-create `customers` row | **Pass** |
| 4 | `ensure_customer_provisioned` safe and idempotent | **Pass** |
| 5 | Orphan customers repaired or sent to `/customer/setup` | **Pass** |
| 6 | `/customer/book` unusable without `actingCustomerId` | **Pass** |
| 7 | Customer APIs return `PROVISIONING_INCOMPLETE` consistently | **Pass** (see §7 notes) |
| 8 | Admin/cleaner not provisioned as customers | **Pass** |
| 9 | E2E seed / admin role flows still work | **Pass** |
| 10 | RLS still passes | **Pass** (8/8 integration) |
| 11 | Payment/booking/assignment/earnings logic unchanged unsafely | **Pass** |

**Final verdict:** Customer provisioning is **production-safe enough to proceed to signup UI behind a feature flag**, after the rollout checklist below. Public signup must remain **off** until UI, Auth settings, and ops monitoring are in place.

---

## Files changed across Stage 1C

### Database (migrations)

| Migration | Purpose |
|-----------|---------|
| `supabase/migrations/20260517_stage1c_harden_handle_new_user.sql` | `handle_new_user`: always `role = customer`; ignore metadata role |
| `supabase/migrations/20260517160000_stage1c_customer_auto_provisioning.sql` | `provision_customer_for_profile`, profile INSERT trigger, `ensure_customer_provisioned`, backfill |

> **Note:** Supabase records version `20260517` for the harden migration. Customer provisioning uses `20260517160000` to avoid version collision.

### Tests (security / integration)

| File | Stage |
|------|-------|
| `src/tests/security/handleNewUserTestSupport.ts` | 1C-1, 1C-2 |
| `src/tests/security/handle-new-user.migration.test.ts` | 1C-1 |
| `src/tests/security/handle-new-user.integration.test.ts` | 1C-1 |
| `src/tests/security/customer-provisioning.migration.test.ts` | 1C-2 |
| `src/tests/security/customer-provisioning.integration.test.ts` | 1C-2 |
| `src/tests/security/rlsTestSupport.ts` (`ensurePhase2CustomerRow`) | 1C-2 |
| `src/tests/security/rls-policies.integration.test.ts` | 1C-2 |

### App (readiness gates)

| File | Stage |
|------|-------|
| `src/lib/auth/customerReadiness.ts` | 1C-3 |
| `src/lib/auth/requireCustomerReady.ts` | 1C-3 |
| `src/lib/auth/redirects.ts` (`buildCustomerSetupRedirectPath`) | 1C-3 |
| `src/lib/auth/index.ts` | 1C-3 |
| `src/lib/auth/customerReadiness.test.ts` | 1C-3 |
| `src/lib/auth/redirects.test.ts` | 1C-3 |
| `src/app/(customer)/layout.tsx` | 1C-3 |
| `src/app/(customer)/layout.test.ts` | 1C-3 |
| `src/app/(customer)/customer/setup/page.tsx` | 1C-3 |
| `src/app/(customer)/customer/setup/actions.ts` | 1C-3 |
| `src/app/(customer)/customer/setup/CustomerSetupRetryForm.tsx` | 1C-3 |
| `src/app/(customer)/customer/setup/page.test.ts` | 1C-3 |
| `src/app/(customer)/customer/book/page.tsx` | 1C-3 |

### App (API error standardization)

| File | Change |
|------|--------|
| `src/features/dashboards/server/customerBookingReadModel.ts` | `PROVISIONING_INCOMPLETE` |
| `src/features/bookings/server/lock/createBookingPaymentLock.ts` | `PROVISIONING_INCOMPLETE` |
| `src/features/bookings/server/lock/types.ts` | Added error code to union |
| `src/features/payments/server/initializePayment.ts` | `PROVISIONING_INCOMPLETE` |
| `src/features/cleaners/server/getAvailableCleaners.ts` | `PROVISIONING_INCOMPLETE` (customer path) |
| `src/features/dashboards/server/dashboardReadModels.test.ts` | Coverage |
| `src/features/bookings/server/lock/createBookingPaymentLock.test.ts` | Coverage |
| `src/lib/database/types.ts` | `ensure_customer_provisioned` RPC type |

### Explicitly not changed (per scope)

- `executeBookingCommand.ts` — still `FORBIDDEN` if `actingCustomerId` missing (gate prevents reach in normal UX)
- RLS policies (`20260516160000_rls_role_security.sql`)
- Assignment / earnings engines
- Paystack webhook handler
- Sign-up UI / feature flag (not built)

---

## Before vs after

| Area | Before Stage 1C | After Stage 1C |
|------|-----------------|----------------|
| Auth insert → `profiles.role` | Could follow `raw_user_meta_data.role` (`admin`/`cleaner` escalation) | Always `customer` on auth insert |
| Auth insert → `customers` row | Manual / scripts only | Auto via `AFTER INSERT` on `profiles` when `role = customer` |
| Orphan `profiles` (customer, no `customers`) | Silent failure at checkout | Backfill + `/customer/setup` + `ensure_customer_provisioned` |
| `/customer/book` | Wizard could load; failure at lock/payment | Redirect to setup if no `actingCustomerId` |
| Customer booking APIs | `FORBIDDEN` / "Customer profile not linked." | `PROVISIONING_INCOMPLETE` (403) |
| Admin E2E seed | `createUser` + `profiles.upsert(role)` | Unchanged; service-role upsert still sets final role |
| RLS | Enforced | Unchanged; tests pass with auto-provisioned rows |

---

## Security improvements

1. **Role escalation via signup metadata removed** — `handle_new_user` ignores `raw_user_meta_data.role`; integration tests prove `admin`/`cleaner` metadata still yields `profiles.role = customer`.
2. **Database-primary provisioning** — `SECURITY DEFINER` functions with role guard; `provision_customer_for_profile` not granted to `public`.
3. **Repair RPC scoped** — `ensure_customer_provisioned` returns `null` when caller is another user (unless `auth_is_admin()`).
4. **Defense in depth at app layer** — layout gate + `/customer/book` gate + standardized API codes; orphans get UX recovery instead of opaque checkout errors.
5. **ON CONFLICT preserves profile role** — auth trigger conflict path never overwrites `profiles.role` (1C-1).

---

## Checkpoint evidence

### 1–2. `handle_new_user` / metadata role

```sql
-- 20260517_stage1c_harden_handle_new_user.sql (effective via CREATE OR REPLACE)
insert into public.profiles (id, role, full_name)
values (new.id, 'customer', nullif(trim(new.raw_user_meta_data->>'full_name'), ''))
```

- No read of `raw_user_meta_data->>'role'`.
- Supersedes vulnerable logic in `20260516150000_auth_profile_bootstrap.sql` at runtime.
- **Tests:** `handle-new-user.integration.test.ts` (admin/cleaner metadata → customer profile).

### 3–4. Auto-provision + RPC

- `on_profile_customer_provision` → `provision_customer_for_profile` when `NEW.role = customer`.
- `ON CONFLICT (profile_id) DO NOTHING` + SELECT existing id → idempotent.
- `ensure_customer_provisioned` delegates to same function with auth guard.
- **Tests:** `customer-provisioning.integration.test.ts` (7 cases).

### 5. Orphan handling

| Path | Mechanism |
|------|-----------|
| Deploy-time | Backfill `DO` block in 1C-2 migration |
| Runtime repair | `/customer/setup` → `retryCustomerProvisioning()` → RPC |
| UX gate | `requireCustomerReadyForPath` → `/customer/setup?redirectedFrom=…` |

### 6. `/customer/book` protection

- `(customer)/layout.tsx`: all routes except `/customer/setup` call `requireCustomerReadyForPath`.
- `customer/book/page.tsx`: explicit `requireCustomerReady("/customer/book")`.
- **Tests:** `customerReadiness.test.ts` redirects orphan to setup with `redirectedFrom`.

### 7. `PROVISIONING_INCOMPLETE` coverage

| Surface | Code |
|---------|------|
| `listCustomerBookings` / `getCustomerBookingDetail` | Yes |
| `POST /api/bookings/lock` | Yes |
| `initializePayment` | Yes |
| `getAvailableCleaners` (customer + bookingId path) | Yes |
| `executeBookingCommand` | No — still `FORBIDDEN` (intentional; not in 1C-3 scope) |
| `verifyPayment` | No — uses `FORBIDDEN` for ownership mismatch (orphan gets “another customer’s payment”, not provisioning code) |

**Assessment:** Customer-facing **booking entry** paths are standardized. Deep command layer unchanged; gates make orphan reach unlikely.

### 8. Admin/cleaner not provisioned

- SQL: `v_profile.role is distinct from 'customer'` → return `null`.
- Trigger: only runs when `new.role = customer`.
- **Tests:** admin/cleaner profile insert + RPC return `null`.

### 9. E2E / admin flows

- `scripts/e2e/lib/auth.mjs`: still `createUser` + `profiles.upsert({ role })` via service role.
- 1C-1 hardened trigger creates customer profile first; upsert overwrites role to `admin`/`cleaner`.
- **Test:** `customer-provisioning.integration.test.ts` “matches E2E seed”.
- **Known:** Admin/cleaner auth users may retain a `customers` row from the brief customer profile on first insert; harmless for admin/cleaner RLS paths, not a security issue.

### 10. RLS

- `rls-policies.integration.test.ts`: **8/8 passed** (2026-05-17 run).
- `ensurePhase2CustomerRow` avoids duplicate `customers` inserts after auto-provision.

### 11. No unsafe logic changes

- Booking command transitions, assignment engine, earnings recording: **no Stage 1C edits**.
- Payment: only **error code** on missing `actingCustomerId` in `initializePayment`; webhook/verify core logic unchanged.

---

## Remaining risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Profile `UPDATE` to `customer` does not fire INSERT trigger | Medium | Use `ensure_customer_provisioned` or ops backfill; consider `AFTER UPDATE OF role` in a future migration |
| Stray `customers` row if profile later promoted to admin | Low | Cosmetic; does not grant customer API access without `role = customer` |
| Trigger failure after profile insert | Low | Orphan possible; `/customer/setup` + RPC repair |
| `executeBookingCommand` / `verifyPayment` not using `PROVISIONING_INCOMPLETE` | Low | Page gates; rare API-only bypass |
| Migrations not applied on an environment | High | Rollout checklist; `supabase migration list` |
| No signup UI / feature flag yet | N/A | Block public signup until built |
| No ongoing orphan audit job | Medium | Add `scripts/ops/audit-identity-integrity.mjs` (planned in 1B, not in 1C) |

---

## Test coverage

### Automated (2026-05-17)

| Suite | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| Stage 1C targeted (`handle-new-user`, `customer-provisioning`, `customerReadiness`, `(customer)`, dashboard lock tests) | **61 passed** |
| `rls-policies.integration.test.ts` | **8 passed** |

### Coverage map

| Behavior | Unit | Integration |
|----------|------|-------------|
| Metadata role ignored | migration SQL test | auth `createUser` |
| Customer auto-provision | migration SQL test | profile insert |
| RPC idempotent / repair | — | yes |
| Readiness redirect | yes | — |
| `PROVISIONING_INCOMPLETE` | read model, lock | — |
| E2E seed pattern | — | yes |
| RLS | — | yes |

### Gaps (acceptable for 1C exit)

- No Playwright E2E for `/customer/setup` redirect loop
- No production orphan count verification in CI
- `verifyPayment` provisioning path not codified separately

---

## Production rollout checklist

### Before deploy

- [ ] `supabase db push` (or equivalent) applies `20260517` + `20260517160000` on staging, then production
- [ ] Confirm `handle_new_user` and `on_profile_customer_provision` exist (`pg_trigger` / `pg_proc` inspection)
- [ ] Run Stage 1C + RLS integration tests against staging (`BOOKING_COMMAND_RUN_REMOTE_INTEGRATION=true` if remote)
- [ ] Run `npm run e2e:seed` on staging; smoke admin + customer sign-in
- [ ] SQL audit: `SELECT count(*) FROM profiles p LEFT JOIN customers c ON c.profile_id = p.id WHERE p.role = 'customer' AND c.id IS NULL` → expect **0**

### After deploy (before public signup)

- [ ] Manual: new `auth.admin.createUser` with `user_metadata.role = admin` → profile `customer`, customers row exists
- [ ] Manual: delete `customers` row for test user → visit `/customer/book` → lands on `/customer/setup` → retry succeeds
- [ ] Monitor auth logs for trigger errors (24h)

### Before enabling public signup (not in Stage 1C)

- [ ] Implement `/sign-up` UI + email confirmation flow
- [ ] Add `ENABLE_CUSTOMER_SIGNUP` (or equivalent) feature flag — default **false**
- [ ] Supabase Auth: confirm email policy, rate limits, allowed domains
- [ ] Ops: orphan audit script on schedule
- [ ] Document support runbook for stuck users on `/customer/setup`

---

## Is Stage 1C safe to deploy?

**Yes**, for the **identity/provisioning stack** (migrations + app gates), assuming:

1. Both migrations are applied in order on every environment.
2. Public customer signup remains **disabled** until signup UI and Auth configuration are ready.
3. Post-deploy orphan SQL audit returns zero (or setup/repair clears stragglers).

Stage 1C does **not** include signup UI; deploying 1C alone improves safety for existing flows (admin-created users, integration tests, future signup) without opening anonymous registration.

---

## Proceed to signup UI behind feature flag?

**Yes — recommended next step**, with conditions:

| Prerequisite | Status |
|--------------|--------|
| DB migrations live | Required at deploy |
| Readiness gates live | Implemented (1C-3) |
| Signup UI | **Not built** — build next |
| Feature flag | **Not built** — add with signup UI |
| Email confirm / Auth settings | Ops task before flag = true |
| Orphan monitoring | Recommended before flag = true |

**Conclusion:** The **provisioning problem is solved** for the canonical path (`auth.users` → `profiles` → `customers`) with repair and gates. Building signup UI behind a default-off flag is the correct next increment; do not enable the flag in production until staging signup E2E passes and orphan audit is clean for 24h.

---

## Related documents

- `docs/architecture/stage-1b-identity-provisioning-architecture.md`
- `docs/audits/e2e-admin-login-profile-audit.md`
- `docs/security/rls-role-security.md`
- `docs/testing/booking-command-integration-tests.md`
