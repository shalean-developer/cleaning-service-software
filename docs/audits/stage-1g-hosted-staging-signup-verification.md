# Stage 1G — Hosted staging signup verification

**Date:** 2026-05-16  
**Scope:** Signup soak against the **deployed** Vercel environment (not localhost)  
**Type:** Audit / verification — production signup **not** enabled

---

## Hosted URL tested

| URL | Role | Result |
|-----|------|--------|
| **`https://cleaning-service-software.vercel.app`** | Vercel production alias (public) | **Primary soak target** |
| `https://cleaning-service-software-ffzeaa89a-shaleans-projects.vercel.app` | Latest deployment target (GitHub/Vercel status) | **401** — deployment protection; not usable without Vercel auth |
| `http://localhost:3000` | Local dev (Stage 1F) | Passed in [stage-1f-signup-staging-soak.md](./stage-1f-signup-staging-soak.md); not a substitute for hosted |

**Deployed commit (GitHub):** `fce7fd8` — *chore(assignments): move offer expiration cron to Supabase*  
**Stage 1D signup UI:** Present in the **local working tree** but **not** in the deployed build (no `/sign-up` route on hosted).

**Supabase project:** `shalean-software` (`jdmumbvednevkrctkiwd`) — shared by local and hosted.

---

## Executive summary

| # | Check | Result |
|---|--------|--------|
| 1 | `ENABLE_CUSTOMER_SIGNUP=true` only on staging/preview | **Fail** — hosted sign-in has no “Create one”; implies flag off or 1D not deployed |
| 2 | Supabase Auth redirect URLs include hosted staging URL | **Pass** — `signUp` with `emailRedirectTo` to hosted `/auth/callback` succeeded |
| 3 | `/sign-in` shows “Create one” | **Fail** — not present on deployed HTML |
| 4 | `/sign-up` loads | **Fail** — **404** (route not in deployment) |
| 5 | New test user can sign up | **Pass** (Supabase API, same project) |
| 6 | Profile row created | **Pass** |
| 7 | Customer row created | **Pass** |
| 8 | User can access `/customer` | **Not tested authenticated** — unauthenticated **307** to sign-in (expected) |
| 9 | User can access `/customer/book` | **Not tested authenticated** — unauthenticated **307** (expected) |
| 10 | Booking lock succeeds | **Pass** (DB: `customers` row present); **not tested** via hosted `POST /api/bookings/lock` |
| 11 | Role escalation → customer | **Pass** |
| 12 | RLS tests pass | **Pass** (8/8) |
| 13 | No payment/assignment/earnings signup changes | **Pass** |

**Hosted staging signup verdict:** **FAIL** — deploy Stage 1D + set Vercel env, then re-run this soak.

**Production enable recommendation:** **Do not enable** `ENABLE_CUSTOMER_SIGNUP` in production until hosted staging passes all UI and E2E checks below.

---

## Commands run

```bash
HOSTED_STAGING_URL=https://cleaning-service-software.vercel.app node scripts/ops/stage-1g-hosted-signup-soak.mjs
npx vitest run src/tests/security/rls-policies.integration.test.ts
```

Hosted soak: **11/14** automated checks passed (3 UI failures).

---

## Manual / automated test results

### Hosted UI (production alias)

| Step | Expected | Observed |
|------|----------|----------|
| `GET /sign-in` | 200, optional “Create one” | 200, **no** “Create one” |
| `GET /sign-up` | 200 form or unavailable message | **404** Not Found |
| `GET /auth/callback` | Route exists | **307** (exists) |
| `GET /customer/setup` | Route exists | **307** (exists) |

### Supabase signup (hosted redirect, service-role DB verify)

Test user: `test_stage1g_hosted_9e7a4353@shalean.co.za` (created and deleted in soak)

| Step | Result |
|------|--------|
| `signUp` with `emailRedirectTo=https://cleaning-service-software.vercel.app/auth/callback` | Success |
| `profiles` row | `role=customer`, `full_name` set |
| `customers` row | Auto-created |
| Metadata `role: admin` | Ignored → `customer` |
| Session + sign-in | Success (confirmations off on project) |
| Cleanup | **Pass** — auth user + profile + customer removed |

### Authenticated hosted flows (not completed)

These require a **deployed** `/sign-up` (or manual session) on the hosted origin:

- Sign up through hosted form → land on `/customer` or `/customer/setup`
- `GET /customer` and `GET /customer/book` with session cookies on Vercel
- `POST /api/bookings/lock` on hosted origin without `PROVISIONING_INCOMPLETE`

**Blocker:** Stage 1D routes are not on the current Vercel deployment.

### RLS

`rls-policies.integration.test.ts`: **8/8 passed** (remote Supabase).

---

## Auth redirect URL status

| Item | Status |
|------|--------|
| Hosted callback tested | `https://cleaning-service-software.vercel.app/auth/callback` |
| `signUp` with `emailRedirectTo` above | **Accepted** (no redirect URL error) |
| Supabase Vault `expire_offers_cron_url` | Still placeholder `https://YOUR_PRODUCTION_DOMAIN/...` — unrelated to signup but update for ops |
| Vercel preview URL | Protected (**401**); add to Supabase allowlist if used for PR previews |

**Recommendation:** In Supabase Dashboard → Authentication → URL configuration, confirm **Site URL** and **Redirect URLs** explicitly list:

- `https://cleaning-service-software.vercel.app/**`
- Any preview/staging host you use after deployment protection is configured

---

## Pass/fail checklist

| # | Item | Pass/Fail | Notes |
|---|------|-----------|-------|
| 1 | Flag on staging only | **Fail** | Vercel env not verified via API; UI indicates off or not deployed |
| 2 | Auth redirect URLs | **Pass** | Hosted callback accepted on `signUp` |
| 3 | Sign-in “Create one” | **Fail** | Missing on deployed page |
| 4 | `/sign-up` loads | **Fail** | 404 |
| 5 | New user signup | **Pass** | Via Supabase (same DB) |
| 6 | Profile row | **Pass** | |
| 7 | Customer row | **Pass** | |
| 8 | `/customer` | **Incomplete** | 307 unauthenticated only |
| 9 | `/customer/book` | **Incomplete** | 307 unauthenticated only |
| 10 | Booking lock | **Partial** | Provisioned in DB; hosted API not exercised |
| 11 | Role escalation | **Pass** | |
| 12 | RLS | **Pass** | |
| 13 | No payment/assignment/earnings signup changes | **Pass** | No signup imports in those features |

---

## Errors found

| Issue | Severity | Action |
|-------|----------|--------|
| **Stage 1D not deployed to Vercel** | **Blocker** | Merge/commit signup UI; deploy to production alias or staging preview |
| **`/sign-up` 404 on hosted** | **Blocker** | Same as above |
| **No “Create one” on hosted sign-in** | **Blocker** | Deploy 1D + set `ENABLE_CUSTOMER_SIGNUP=true` on Vercel **Preview/Production** (staging), not production customer-facing until soak passes |
| Preview deployment URL returns 401 | Medium | Use public alias or disable protection for soak; add URL to Supabase redirects |
| Authenticated hosted book/lock not exercised | Medium | Re-test after deploy |
| `initializePayment.ts` uncommitted 1C diff | Info | Not signup-related |

---

## Production enable recommendation

**Do not enable production signup yet.**

Before production `ENABLE_CUSTOMER_SIGNUP=true`:

1. **Deploy** Stage 1D (signup pages, flag helper, sign-in link) to the hosted staging/preview URL.
2. Set **`ENABLE_CUSTOMER_SIGNUP=true`** on Vercel for **staging/preview only**; keep production env **unset/false**.
3. **Re-run** hosted soak:
   ```bash
   HOSTED_STAGING_URL=https://cleaning-service-software.vercel.app node scripts/ops/stage-1g-hosted-signup-soak.mjs
   ```
4. Complete **manual** hosted checklist: sign-up form → `/customer` or setup → `/customer/book` → one successful `POST /api/bookings/lock`.
5. Optional: 24h soak on staging alias with monitoring.
6. Then follow [stage-1f-signup-staging-soak.md](./stage-1f-signup-staging-soak.md) production checklist.

**What already works on hosted infrastructure:** Supabase accepts the Vercel callback URL; provisioning (profile + customer) and role hardening work for signups against the shared project.

---

## Rollback plan

| Step | Action |
|------|--------|
| 1 | Set `ENABLE_CUSTOMER_SIGNUP=false` or remove on Vercel staging; redeploy |
| 2 | Hosted `/sign-up` hidden/unavailable; sign-in link removed |
| 3 | No DB migration rollback required |
| 4 | Optional: disable email signup in Supabase Auth if API abuse |
| 5 | Production remains off until explicitly enabled after a **passing** re-run of this audit |

---

## Related documents

- [stage-1f-signup-staging-soak.md](./stage-1f-signup-staging-soak.md) — localhost + remote Supabase (passed)
- [stage-1e-customer-signup-readiness-audit.md](./stage-1e-customer-signup-readiness-audit.md) — code readiness
- [stage-1c-customer-provisioning-final-audit.md](./stage-1c-customer-provisioning-final-audit.md) — provisioning

---

## Final verdict

| Question | Answer |
|----------|--------|
| Is hosted staging signup verified? | **No** — UI not deployed; hosted soak **fails** checks 1, 3, 4, 8–10 (partial). |
| Is production signup approved? | **No** — blocked until hosted staging passes after deploy + env. |
| Can we enable production signup now? | **No.** |
