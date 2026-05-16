# Stage 1F — Signup staging soak & production enable checklist

**Date:** 2026-05-16  
**Scope:** Verify customer signup after real browser testing and automated soak against the configured Supabase project  
**Type:** Audit / soak verification — no production signup enable in this pass

---

## Environment under test

| Item | Value |
|------|--------|
| App | `http://localhost:3000` (Next.js dev, active during soak) |
| Supabase | Remote project `jdmumbvednevkrctkiwd` (same as local `.env.local`) |
| `ENABLE_CUSTOMER_SIGNUP` | `true` (local/staging-style config) |
| `BOOKING_COMMAND_RUN_REMOTE_INTEGRATION` | `true` |
| Email confirmations (Supabase) | **Disabled** — `signUp` returned a session immediately (no check-email step required) |

> **Note:** This soak used **local app + remote Supabase**, which matches the team’s staging-style integration setup. A separate **hosted staging URL** (e.g. Vercel preview) was not exercised in this pass; repeat the manual browser checklist there before production if deploy URLs differ.

---

## Executive summary

| # | Check | Result |
|---|--------|--------|
| 1 | New user can sign up | **Pass** |
| 2 | Email confirmation works if enabled | **N/A** (disabled on project); code path present |
| 3 | Profile row is created | **Pass** |
| 4 | Customer row is created | **Pass** |
| 5 | User can access `/customer` | **Pass** (browser + redirect semantics) |
| 6 | User can access `/customer/book` | **Pass** (browser) |
| 7 | Booking lock no `PROVISIONING_INCOMPLETE` | **Pass** |
| 8 | Admin/cleaner cannot be created from signup | **Pass** |
| 9 | RLS tests still pass | **Pass** (8/8) |
| 10 | No payment/assignment/earnings signup changes | **Pass** |

**Staging soak verdict:** **PASS** — signup, provisioning, customer routes, and booking lock are verified for this environment.

**Production signup:** **DO NOT ENABLE** until the production enable checklist below is completed on the **production** Supabase project and hosted app. This report does not authorize flipping `ENABLE_CUSTOMER_SIGNUP` in production.

---

## Manual test results

### Automated soak (anon `signUp`, DB verification, page fetch)

Command: `node scripts/ops/stage-1f-signup-soak.mjs`  
Result: **14/14 checks passed**

| Step | Result | Notes |
|------|--------|-------|
| `auth.signUp` with `{ full_name, role: "admin" }` | Pass | User created |
| Session vs check-email | Pass | Session returned → confirmations off |
| `profiles` row | Pass | `role=customer`, `full_name` set |
| `customers` row | Pass | Auto-provisioned |
| Sign-in after signup | Pass | |
| `actingCustomerId` / lock gate | Pass | Customer row linked |
| `GET /sign-up` | Pass | 200, contains “Create account” |
| `GET /sign-in` | Pass | 200, contains “Create one” |
| `GET /customer`, `/customer/book` | Pass | 307 → sign-in when unauthenticated (expected) |
| Cleanup test user | Pass | |

### Browser / dev-server evidence (same session)

Observed in the active `npm run dev` terminal during the soak window:

| Request | Status | Implication |
|---------|--------|-------------|
| `GET /sign-up` | 200 | Signup UI served with flag on |
| `GET /sign-in` | 200 | Signup link visible |
| `GET /customer` | 200 | Authenticated customer dashboard |
| `GET /customer/book` | 200 | Book page reachable when provisioned |
| `POST /api/bookings/lock` | 200 | No `PROVISIONING_INCOMPLETE` for active customer |
| `POST /api/paystack/initialize` | 200 | Checkout path continued |
| `GET /customer/bookings/...` | 200 | Post-payment customer flow |

These lines confirm an end-to-end **book → lock → pay** path for a provisioned customer in the same environment; they are consistent with checks 5–7.

### Email confirmation (if enabled)

| Test | Result |
|------|--------|
| Full confirm-email → callback → dashboard | **Not run** — project has confirmations **disabled** |
| `/sign-up/check-email` UI | Present in codebase; not triggered in this soak |
| `emailRedirectTo` | Set to `{APP_URL}/auth/callback` in `SignUpForm` |

**Action before production (if confirmations enabled):** Run one manual signup on staging with confirmations **on**; confirm email link lands on `/auth/callback` and user reaches `/customer` or `/customer/setup`.

---

## Database verification

Soak user (created and deleted in same run):

| Table | Expected | Observed |
|-------|----------|----------|
| `auth.users` | 1 row | Created |
| `profiles` | `role = customer`, `full_name` from metadata | Confirmed |
| `customers` | 1 row for `profile_id` | Confirmed (`company_name` from name) |
| `cleaners` | None for signup user | Not created (role guard + no cleaner provision) |

**Role injection:** `user_metadata.role = "admin"` on `signUp` → `profiles.role` remained **`customer`**.

**Integration tests (post-soak):**

| Suite | Result |
|-------|--------|
| `handle-new-user.integration.test.ts` | Pass |
| `customer-provisioning.integration.test.ts` | Pass |
| `rls-policies.integration.test.ts` | **8/8 pass** |

---

## Errors found

| Issue | Severity | Status |
|-------|----------|--------|
| None blocking staging signup | — | — |
| Email confirmation E2E not exercised | Low | Expected while confirmations disabled; retest if enabling |
| App flag does not block direct `auth.signUp` API | Low | Known from Stage 1E; DB still forces customer only |
| Hosted staging URL not tested | Medium | Repeat manual checklist on Vercel/preview if used |
| `initializePayment.ts` uncommitted diff (`FORBIDDEN` → `PROVISIONING_INCOMPLETE`) | Info | Stage **1C** gate wording, not signup; no signup imports in payments/assignments/earnings |

---

## Checkpoint detail

### 1. New user can sign up — **Pass**

Anon `signUp` and UI (`/sign-up` → “Create account”) both succeeded.

### 2. Email confirmation — **N/A (disabled)**

Session returned immediately. Check-email flow not exercised live.

### 3–4. Profile and customer rows — **Pass**

Created within seconds of `signUp`; no manual `customers` insert.

### 5–6. `/customer` and `/customer/book` — **Pass**

Authenticated session: dev log `GET /customer 200`, `GET /customer/book 200`.

### 7. Booking lock — **Pass**

Dev log `POST /api/bookings/lock 200`; soak script confirmed `customers` row present (no `PROVISIONING_INCOMPLETE`).

### 8. Admin/cleaner from signup — **Pass**

Metadata `role: admin` → `profiles.role = customer`; no cleaner row.

### 9. RLS — **Pass**

`rls-policies.integration.test.ts`: 8/8.

### 10. Payment / assignment / earnings — **Pass**

No signup-related changes under `src/features/payments`, `assignments`, or `earnings`. Only unrelated uncommitted payment diff is 1C error-code standardization in `initializePayment.ts`.

---

## Production enable checklist

**Do not set `ENABLE_CUSTOMER_SIGNUP=true` in production until every item is checked on the production project and app.**

- [ ] Stage 1C migrations applied on **production** database
- [ ] Stage 1D signup code deployed to **production** host
- [ ] Production Supabase Auth → URL configuration includes `https://<production-domain>/auth/callback`
- [ ] Confirm production `enable_confirmations` policy; run email test if enabled
- [ ] Production SMTP/email provider verified
- [ ] Set `ENABLE_CUSTOMER_SIGNUP=true` **only on production** env (staging/preview remain as intended)
- [ ] Manual signup on **hosted production or pre-prod** URL (not only localhost)
- [ ] Verify new user: profile + customer rows, `/customer/book`, one lock without `PROVISIONING_INCOMPLETE`
- [ ] 24h monitoring: auth errors, orphan customer profiles, failed locks
- [ ] Ops runbook: `/customer/setup` + `ensure_customer_provisioned` for support

---

## Rollback plan

| Step | Action |
|------|--------|
| 1 | Remove or set `ENABLE_CUSTOMER_SIGNUP=false` on the affected environment; redeploy |
| 2 | `/sign-up` shows unavailable; sign-in hides “Create one” |
| 3 | Existing users and data unchanged |
| 4 | Optional: disable email signup in Supabase Auth dashboard if API abuse |
| 5 | No migration rollback required |

---

## Repeat soak (optional)

```bash
node scripts/ops/stage-1f-signup-soak.mjs
npx vitest run src/tests/security/rls-policies.integration.test.ts
```

Requires `.env.local` with Supabase keys and dev server on `NEXT_PUBLIC_APP_URL` for page checks.

---

## Final verdict

| Environment | `ENABLE_CUSTOMER_SIGNUP` | Verdict |
|-------------|--------------------------|---------|
| Staging-style (local app + remote Supabase, this soak) | `true` | **PASS** — safe to keep enabled for continued staging use |
| Production | Must stay **off** | **Not approved** — complete production checklist above first |

**Related:** [stage-1e-customer-signup-readiness-audit.md](./stage-1e-customer-signup-readiness-audit.md), [stage-1c-customer-provisioning-final-audit.md](./stage-1c-customer-provisioning-final-audit.md)
