# Stage 1G — Hosted staging signup verification

**Date:** 2026-05-16  
**Scope:** Signup soak against the **deployed** Vercel environment (not localhost)  
**Type:** Verification after Stage 1G-Fix deploy  
**Production signup:** **Not enabled** (public launch still blocked)

---

## Previous failure reason (Stage 1G initial)

| Issue | Cause |
|-------|--------|
| `/sign-up` **404** | Stage 1D not deployed; Vercel served commit `fce7fd8` (pre-signup) |
| No “Create one” on sign-in | Same — no signup UI in build |
| Hosted soak **11/14** | UI routes missing; backend/Supabase checks still passed |

---

## Stage 1G-Fix actions completed

| Task | Status | Detail |
|------|--------|--------|
| 1. Commit Stage 1D (+ 1C deps) | **Done** | `228a7bbc86fc3eacaedf916ab6c30c412610166b` |
| 2. Remote migrations applied | **Done** | `stage1c_harden_handle_new_user`, `stage1c_customer_auto_provisioning` on `jdmumbvednevkrctkiwd` |
| 3. Push to `main` | **Done** | `fce7fd8..228a7bb` → `origin/main` |
| 4. `ENABLE_CUSTOMER_SIGNUP=true` on staging/preview | **Blocked** | No Vercel CLI/MCP credentials in agent session |
| 5. Keep production signup disabled | **Done** | Vercel Production env var **not** set by agent |
| 6. Wait for Vercel deploy | **Done** | GitHub deployment **success** |
| 7. Verify deployed commit includes 1D | **Done** | See below |
| 8–10. Full hosted UI + manual book/lock | **Partial** | Blocked on step 4 for enabled signup UX |

---

## Hosted URL tested

| URL | Role | Notes |
|-----|------|--------|
| **`https://cleaning-service-software.vercel.app`** | Vercel production alias (`main`) | Primary soak target |
| `https://cleaning-service-software-jpmvj8ni7-shaleans-projects.vercel.app` | Deployment for `228a7bb` | **401** — deployment protection |
| `http://localhost:3000` | Local (Stage 1F) | Passed earlier; not a substitute for hosted |

**Supabase project:** `shalean-software` (`jdmumbvednevkrctkiwd`)

---

## New deployment commit

| Field | Value |
|-------|--------|
| **Commit** | `228a7bbc86fc3eacaedf916ab6c30c412610166b` |
| **Message** | `feat(auth): add customer signup UI behind ENABLE_CUSTOMER_SIGNUP` |
| **GitHub deployment** | `4713881102` — state **success** (2026-05-16T20:58:11Z) |
| **Stage 1D in build** | Yes — `/sign-up` returns **200** (no longer 404) |

---

## Vercel env status

| Variable | Preview | Production (Vercel) | Local `.env.local` |
|----------|---------|---------------------|-------------------|
| `ENABLE_CUSTOMER_SIGNUP` | **Not set** (agent) | **Not set** (agent) | `true` (dev only) |

**Observed hosted behavior (confirms Production env unset):**

- `/sign-up` → **“Signup is not available yet”** (`SignUpUnavailable`)
- `/sign-in` → no **“Create one”** link
- `/sign-up/check-email` → **redirects to `/sign-in`** (flag-off guard)

**Agent could not set Vercel env:** Vercel CLI requires login; Vercel MCP auth was declined. **Manual step required** (see below).

### Required manual step (to complete hosted soak)

In [Vercel Dashboard](https://vercel.com) → project **cleaning-service-software** → **Settings** → **Environment Variables**:

1. Add `ENABLE_CUSTOMER_SIGNUP` = `true`
2. Enable for **Preview** (PR/branch deploys)
3. For soak on `https://cleaning-service-software.vercel.app` ( **`main` → Vercel Production environment** ), also enable for **Production** on this project **only while this hostname is your staging host**
4. **Redeploy** Production after saving (or wait for next deploy)
5. **Do not** treat this as permission for public production launch — keep customer-facing production domain flag **off** when you go live

> **Naming note:** Vercel “Production” environment powers `cleaning-service-software.vercel.app`. That is separate from “public production signup” for real customers.

---

## Hosted UI verification (after deploy, flag off)

| Check | Expected (flag on) | Observed (flag off) | Pass? |
|-------|-------------------|---------------------|-------|
| `/sign-in` shows “Create one” | Yes | No | **Fail** (env) |
| `/sign-up` loads | Form or unavailable | **200** unavailable message | **Partial** — route exists |
| `/sign-up/check-email` | Check-email copy | Redirect to sign-in | **Fail** (env) |
| Deploy includes 1D | Yes | Unavailable page (not 404) | **Pass** |

---

## Script results

```bash
HOSTED_STAGING_URL=https://cleaning-service-software.vercel.app node scripts/ops/stage-1g-hosted-signup-soak.mjs
npx vitest run src/tests/security/rls-policies.integration.test.ts
```

### Hosted soak (`stage-1g-hosted-signup-soak.mjs`)

**13/14 passed** (improved from **11/14** pre-deploy)

| Check | Result |
|-------|--------|
| `/sign-in` “Create one” | **Fail** — flag off on Vercel |
| `/sign-in` loads | Pass |
| `/sign-up` loads (form or unavailable) | Pass |
| `/sign-up` not 404 | Pass |
| Supabase signUp + hosted callback | Pass |
| Profile + customer rows | Pass |
| Role escalation → customer | Pass |
| Booking lock gate (DB) | Pass |
| Cleanup test user | Pass |

### RLS

`rls-policies.integration.test.ts`: **8/8 passed**

---

## Manual browser results

| Step | Status | Notes |
|------|--------|-------|
| Hosted sign-up form | **Not run** | Flag off → unavailable page only |
| Customer dashboard after hosted signup | **Not run** | Requires enabled signup + session |
| `/customer/book` | **Not run** | Requires authenticated provisioned customer |
| Booking lock on hosted origin | **Not run** | Requires session + `POST /api/bookings/lock` |

**Prior dev-session evidence (localhost + same Supabase, flag on):** `GET /customer` 200, `GET /customer/book` 200, `POST /api/bookings/lock` 200 — provisioning path works; not re-validated on Vercel in this pass.

---

## Pass/fail checklist

| # | Item | Pass/Fail | Notes |
|---|------|-----------|-------|
| 1 | Flag on staging/preview only | **Incomplete** | Not set in Vercel; manual step pending |
| 2 | Auth redirect URLs | **Pass** | Hosted `/auth/callback` accepted on `signUp` |
| 3 | Sign-in “Create one” | **Fail** | Env |
| 4 | `/sign-up` loads | **Pass** | 200 unavailable (1D deployed) |
| 5 | New user signup (API) | **Pass** | Supabase |
| 6 | Profile row | **Pass** | |
| 7 | Customer row | **Pass** | |
| 8 | `/customer` (authenticated) | **Not tested** | Blocked on env |
| 9 | `/customer/book` | **Not tested** | Blocked on env |
| 10 | Booking lock (hosted API) | **Not tested** | DB gate pass only |
| 11 | Role escalation | **Pass** | |
| 12 | RLS | **Pass** | |
| 13 | No payment/assignment/earnings signup changes | **Pass** | |

---

## Production enable recommendation

**Do not enable public production signup yet.**

| Gate | Status |
|------|--------|
| Code on Vercel | **Done** (`228a7bb`) |
| Migrations on Supabase | **Done** |
| `ENABLE_CUSTOMER_SIGNUP` on hosted staging | **Pending** — set in Vercel, redeploy |
| Hosted sign-up → book → lock E2E | **Pending** — after env + redeploy |
| 24h staging soak | **Pending** | |

After setting the env var and redeploying, re-run:

```bash
HOSTED_STAGING_URL=https://cleaning-service-software.vercel.app node scripts/ops/stage-1g-hosted-signup-soak.mjs
```

Then manually: sign up on hosted → `/customer` → `/customer/book` → one successful lock.

---

## Rollback plan

| Step | Action |
|------|--------|
| 1 | Remove or set `ENABLE_CUSTOMER_SIGNUP=false` in Vercel; redeploy |
| 2 | Hosted `/sign-up` shows unavailable; sign-in hides link |
| 3 | Revert git deploy optional — flag off is sufficient |
| 4 | No DB migration rollback for flag toggle |

---

## Final verdict

| Question | Answer |
|----------|--------|
| Is Stage 1G-Fix deploy successful? | **Yes** — signup UI is on Vercel; `/sign-up` no longer 404 |
| Is hosted staging signup fully verified? | **No** — **conditional pass**; set `ENABLE_CUSTOMER_SIGNUP` on Vercel and re-run soak + manual book/lock |
| Is public production signup approved? | **No** |

**Summary:** Deploy and database path are ready. **One blocker remains:** set `ENABLE_CUSTOMER_SIGNUP=true` in Vercel (Preview + Production for the `vercel.app` staging host), redeploy, then re-run Stage 1G soak and manual hosted booking test.

---

## Related documents

- [stage-1f-signup-staging-soak.md](./stage-1f-signup-staging-soak.md)
- [stage-1e-customer-signup-readiness-audit.md](./stage-1e-customer-signup-readiness-audit.md)
- [stage-1c-customer-provisioning-final-audit.md](./stage-1c-customer-provisioning-final-audit.md)
