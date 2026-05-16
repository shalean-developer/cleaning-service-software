# Stage 1E — Customer signup production readiness audit

**Date:** 2026-05-16  
**Scope:** Stage 1D customer signup UI behind `ENABLE_CUSTOMER_SIGNUP`, plus Stage 1C provisioning dependencies  
**Type:** Audit only — no new features implemented in this pass.

---

## Executive summary

Stage 1D adds a **customer-only** signup UI gated by `ENABLE_CUSTOMER_SIGNUP` (default **off**). Provisioning, readiness gates, and RLS behavior remain those established in Stage 1C. Automated checks (typecheck, signup unit tests, Stage 1C integration tests, RLS integration) **all passed** against the configured Supabase project.

| # | Check | Verdict |
|---|--------|---------|
| 1 | Feature flag default is off | **Pass** |
| 2 | `/sign-up` blocked when flag is off | **Pass** (UI); see §2 residual risk |
| 3 | `/sign-in` link only when flag is on | **Pass** |
| 4 | Signup sends no role metadata | **Pass** |
| 5 | Signup cannot create cleaner/admin | **Pass** (DB + client guard) |
| 6 | `full_name` metadata is safe | **Pass** |
| 7 | `handle_new_user` still forces customer | **Pass** |
| 8 | Customer row auto-provisions | **Pass** |
| 9 | Email confirmation path works | **Pass** (code); **Verify in staging** (Auth settings) |
| 10 | Session signup path when confirmations off | **Pass** (code); **Verify in staging** |
| 11 | `/customer/setup` handles delay/failure | **Pass** |
| 12 | `/customer/book` blocked without `actingCustomerId` | **Pass** |
| 13 | Customer APIs return `PROVISIONING_INCOMPLETE` | **Pass** |
| 14 | RLS tests still pass | **Pass** (8/8) |
| 15 | No payment/booking/assignment/earnings changes from 1D | **Pass** |

**Final verdict (staging):** **`ENABLE_CUSTOMER_SIGNUP` is safe to enable in staging** after the rollout checklist below, with manual smoke tests and Supabase Auth redirect/confirmation settings confirmed for the staging project.

**Final verdict (production):** **Not yet** — enable only after a successful staging soak (recommended ≥24h), production Auth configuration, and the production enable checklist.

---

## Before vs after

| Area | Before Stage 1D | After Stage 1D |
|------|-----------------|----------------|
| Public customer signup UI | None | `/sign-up` + `/sign-up/check-email` (flag-gated) |
| Sign-in page | Sign-in only | Optional “Create one” link when flag on |
| Env control | N/A | `ENABLE_CUSTOMER_SIGNUP` (server env, default off) |
| Auth `signUp` from app | Not exposed | Client `signUp` with `{ full_name }` only |
| Provisioning / RLS / booking gates | Stage 1C | Unchanged by 1D |
| Admin/cleaner creation | Service-role / seed only | Unchanged |

---

## Files changed since Stage 1D

### New (Stage 1D)

| File | Purpose |
|------|---------|
| `src/lib/auth/customerSignupFlag.ts` | `isCustomerSignupEnabled()` |
| `src/lib/auth/customerSignupFlag.test.ts` | Flag default/enabled values |
| `src/lib/auth/customerSignup.ts` | Paths, metadata builder, post-signup redirect helper |
| `src/lib/auth/customerSignup.test.ts` | Metadata + redirect tests |
| `src/app/sign-up/page.tsx` | Signup page (flag gate) |
| `src/app/sign-up/SignUpForm.tsx` | Client `signUp` flow |
| `src/app/sign-up/SignUpUnavailable.tsx` | Flag-off UX |
| `src/app/sign-up/check-email/page.tsx` | Post-signup email confirmation UX |
| `src/app/sign-up/page.test.ts` | Flag + customer-only static tests |
| `src/app/sign-up/SignUpForm.test.ts` | No role metadata, flow static tests |

### Modified (Stage 1D)

| File | Change |
|------|--------|
| `src/app/sign-in/page.tsx` | Conditional signup link |
| `src/app/sign-in/SignInForm.test.ts` | Signup link gating test |
| `src/lib/auth/index.ts` | Re-exports signup helpers |
| `src/lib/auth/clientBundleSafety.test.ts` | Includes `src/app/sign-up` in client safety scan |
| `.env.example` | Documents `ENABLE_CUSTOMER_SIGNUP` (commented) |

### Unchanged by Stage 1D (still relevant)

Stage 1C migrations, readiness gates, and API error codes — see [stage-1c-customer-provisioning-final-audit.md](./stage-1c-customer-provisioning-final-audit.md).

**Note:** The working tree may also contain **Stage 1C** edits to `createBookingPaymentLock.ts`, `initializePayment.ts`, `customerBookingReadModel.ts`, etc. Those changes are **provisioning gates**, not signup UI. Grep shows **no** references to `sign-up`, `signUp`, or `customerSignup` under `src/features/payments`, `bookings`, `assignments`, or `earnings`.

---

## Test execution (this audit)

| Command | Result |
|---------|--------|
| `npm run typecheck` | **Pass** |
| Signup unit tests (`customerSignup*`, `src/app/sign-up`, `SignInForm.test.ts`, `clientBundleSafety`) | **25/25 pass** |
| Stage 1C (`handle-new-user*`, `customer-provisioning.integration`, `customer/setup/page.test`) | **16/16 pass** |
| RLS (`rls-policies.integration.test.ts`) | **8/8 pass** |

---

## Checkpoint evidence

### 1. Feature flag default is off

- `isCustomerSignupEnabled()` returns `false` when `ENABLE_CUSTOMER_SIGNUP` is unset, empty, `false`, or `0`.
- `.env.example` documents the variable as **commented** (not enabled by default).
- **Action:** Confirm staging/production env dashboards do **not** set the variable until intentional enable.

### 2. `/sign-up` blocked when flag is off

- `src/app/sign-up/page.tsx`: `if (!isCustomerSignupEnabled()) return <SignUpUnavailable />` — no `SignUpForm` rendered.
- `/sign-up/check-email`: `redirect(SIGN_IN_PATH)` when flag off.

**Residual risk:** The flag is **app-layer only**. Supabase Auth still has `enable_signup = true` in `supabase/config.toml`. A client could call `supabase.auth.signUp` directly with the anon key while the flag is off. That path still runs `handle_new_user` (customer only) and does **not** grant cleaner/admin. For product control, keep the flag off in staging until ready; for hard lockdown, coordinate Supabase Auth dashboard settings separately.

### 3. `/sign-in` link appears only when flag is on

- `src/app/sign-in/page.tsx`: `{signupEnabled ? (… Create one …) : null}` where `signupEnabled = isCustomerSignupEnabled()`.

### 4. Signup sends no role metadata

- `buildCustomerSignupMetadata()` returns `{ full_name }` only.
- `SignUpForm.tsx` uses `options: { data: buildCustomerSignupMetadata(trimmedName), … }` — no `role` key.
- Static tests enforce absence of `role` in form source and metadata builder.

### 5. Signup cannot create cleaner/admin

- **Database:** `handle_new_user` always inserts `role = 'customer'`; ignores `raw_user_meta_data.role` (migration + integration tests with `admin`/`cleaner` metadata).
- **Client:** After session signup, `SignUpForm` rejects `profileResult.role !== "customer"` and signs out.
- Cleaner/admin creation remains **service-role** flows only (E2E seed upsert unchanged).

### 6. `full_name` metadata is safe

- Only `full_name` is sent; trimmed via `buildCustomerSignupMetadata`.
- `handle_new_user` reads `nullif(trim(new.raw_user_meta_data->>'full_name'), '')` — no role or phone in metadata.
- Phone is **not** collected on signup (not provisioned from metadata today).

### 7. `handle_new_user` still forces customer

- Migration `20260517_stage1c_harden_handle_new_user.sql` unchanged.
- Integration: metadata `role: admin` / `role: cleaner` → `profiles.role = customer`.

### 8. Customer row auto-provisions

- `on_profile_customer_provision` trigger + `provision_customer_for_profile` (Stage 1C-2).
- Integration: auth user with customer profile → `customers` row exists.
- `ensure_customer_provisioned` idempotent; does not provision admin/cleaner profiles.

### 9. Email confirmation path works

**Code path (flag on):**

1. `signUp` → no `data.session` → navigate to `/sign-up/check-email?email=…`
2. User clicks link → `/auth/callback?code=…` → `exchangeCodeForSession` → `resolvePostSignInPath` → `/customer` (or allowed `redirectedFrom`)
3. Customer layout runs `requireCustomerReadyForPath` → `/customer/setup` if no `actingCustomerId`

**Staging verification required:**

- Confirm **Supabase Auth → URL configuration** includes staging `https://<staging-host>/auth/callback`.
- Confirm whether **`enable_confirmations`** is on in the **staging** project (local `config.toml` has `enable_confirmations = false`).
- Confirm SMTP / email delivery works in staging.

### 10. Session signup path (confirmations disabled)

- When `data.session` exists: load profile → must be `customer` → `resolvePostCustomerSignUpPath` → `/customer` (layout/setup gate applies).
- Matches local Supabase default (`enable_confirmations = false`).

### 11. `/customer/setup` handles provisioning delay/failure

- Setup page shown when `checkCustomerReadiness()` is `provisioning_incomplete`.
- `retryCustomerProvisioning()` calls `ensure_customer_provisioned` RPC (existing safe path).
- Layout exempts `/customer/setup` from readiness redirect.

### 12. `/customer/book` blocked until `actingCustomerId` exists

- `src/app/(customer)/customer/book/page.tsx`: `await requireCustomerReady("/customer/book")`.
- `(customer)/layout.tsx`: `requireCustomerReadyForPath` for all paths except setup.
- Unit test: unprovisioned customer → redirect to setup for `/customer/book`.

### 13. Customer APIs return `PROVISIONING_INCOMPLETE` if needed

| Surface | Behavior |
|---------|----------|
| `createBookingPaymentLock` | `PROVISIONING_INCOMPLETE` 403 |
| `initializePayment` | `PROVISIONING_INCOMPLETE` |
| `customerBookingReadModel` | `PROVISIONING_INCOMPLETE` |
| `getAvailableCleaners` (customer) | `PROVISIONING_INCOMPLETE` |
| Setup retry action | `PROVISIONING_INCOMPLETE` when repair returns null |

### 14. RLS tests still pass

- `src/tests/security/rls-policies.integration.test.ts`: **8/8 passed** (remote Supabase).

### 15. No payment, booking, assignment, or earnings logic changed by 1D

- No signup imports under `features/payments`, `features/bookings`, `features/assignments`, `features/earnings`.
- Stage 1D diff is limited to auth UI + flag helpers listed above.

---

## Rollout checklist (staging)

- [ ] Stage 1C migrations applied on **staging** database (`handle_new_user` harden + customer auto-provision).
- [ ] Deploy app build containing Stage 1D signup files.
- [ ] Set **`ENABLE_CUSTOMER_SIGNUP=true`** on staging only (Vercel/host env).
- [ ] Leave production **without** the variable (or explicitly `false`).
- [ ] Supabase Auth: add staging site URL + redirect URL `{staging}/auth/callback`.
- [ ] Confirm email confirmation policy for staging; align UX expectations (check-email vs immediate session).
- [ ] Run manual staging test plan (below).
- [ ] Monitor auth errors, orphan customer profiles (SQL audit from 1C doc), and booking lock failures.

---

## Staging test plan (manual)

### Flag off (default)

1. Visit `/sign-up` → “Signup is not available yet”; no form fields.
2. Visit `/sign-in` → no “Create one” link.
3. Visit `/sign-up/check-email` → redirect to `/sign-in`.

### Flag on

4. Set `ENABLE_CUSTOMER_SIGNUP=true`; restart/redeploy.
5. `/sign-in` shows “Create one” → `/sign-up`.
6. Sign up with new email + full name + password (≥6 chars).
7. **If confirmations on:** land on check-email → confirm → callback → sign in → `/customer` or `/customer/setup`.
8. **If confirmations off:** land on `/customer`; if orphan, auto-redirect to `/customer/setup` → retry → book flow.
9. Attempt devtools `signUp` with `data: { role: 'admin', full_name: 'x' }` → profile role must remain `customer` in DB.
10. Confirm `/customer/book` loads only when booking wizard can resolve `actingCustomerId`.
11. Sign in with existing E2E customer/admin/cleaner — unchanged.

---

## Production enable checklist

- [ ] Staging soak complete; no spike in orphans or auth failures.
- [ ] Production DB has Stage 1C migrations.
- [ ] Production Auth URLs include production `/auth/callback`.
- [ ] SMTP / email provider production-ready if confirmations enabled.
- [ ] Set `ENABLE_CUSTOMER_SIGNUP=true` on **production** env only when product approves.
- [ ] Ops runbook: `ensure_customer_provisioned` / setup page for support.
- [ ] Optional: restrict Supabase Auth signup at dashboard level for non-customer domains if required by policy.

---

## Rollback plan

| Step | Action |
|------|--------|
| 1 | Set `ENABLE_CUSTOMER_SIGNUP=false` or remove env var on affected environment; redeploy (immediate UI lock). |
| 2 | Sign-in link and signup form hidden; `/sign-up` shows unavailable state. |
| 3 | Existing users unaffected; sessions and provisioning unchanged. |
| 4 | If abuse via direct Auth API: temporarily disable email signup in Supabase Auth dashboard. |
| 5 | No DB migration rollback required for flag toggle. |

---

## Risks and gaps

| Risk | Severity | Mitigation |
|------|----------|------------|
| App flag does not block direct `auth.signUp` API | Low (security) / Medium (product) | DB always customer; optional Supabase Auth restriction |
| Staging/production `enable_confirmations` differs from local | Medium (UX) | Manual test both paths in staging |
| Email redirect URL misconfigured | High (UX) | Supabase URL allowlist before enable |
| Orphan profile if trigger fails | Medium | `/customer/setup` + `ensure_customer_provisioned` (1C) |
| Stage 1D not yet committed to git | Low (process) | Commit/deploy 1D before staging flag enable |

---

## Final question

### Is `ENABLE_CUSTOMER_SIGNUP` safe to enable in staging?

**Yes — with conditions.**

Enable it on **staging only** after:

1. Stage 1C migrations are live on the staging database.  
2. Staging Supabase Auth redirect URLs (and email confirmation/SMTP, if used) are configured.  
3. The manual staging test plan above is executed once with the flag on.  

The implementation correctly gates the UI, avoids role metadata, relies on hardened `handle_new_user` and customer auto-provisioning, and preserves readiness gates and RLS. Production enable should wait for a clean staging soak and the production checklist.

---

## Related documents

- [stage-1c-customer-provisioning-final-audit.md](./stage-1c-customer-provisioning-final-audit.md)
- [stage-1b-identity-provisioning-architecture.md](../architecture/stage-1b-identity-provisioning-architecture.md)
