# Local dashboard route access audit

**Date:** 2026-05-16  
**Scope:** Why protected dashboard routes are unreachable on `http://localhost:3000` during local development.  
**Status:** Audit only — no fixes applied.

---

## Executive summary

Protected dashboard routes **exist and compile**. They are not 404s. Every tested path returns **HTTP 307 → `/`** (marketing home).

**Root cause (current local environment):** `.env.local` is missing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. That makes `getSupabasePublicEnv()` return `null`, which:

1. **Disables middleware auth** (`x-auth-enforcement: disabled`).
2. **Prevents server session resolution** (`createSupabaseServerClient()` → `null` → `getCurrentUser()` → `null`).
3. **Triggers layout redirects** via `requireProfileRole()` → `redirect("/")`.

**Secondary architectural cause (still true after env is fixed):** There is **no login route**, **no auth callback route**, and **no browser Supabase client** in `src/`. Seeded E2E users exist in Supabase but cannot establish a session through the app UI. Dev logs show attempted `/sign-in` and `/cleaner/login` returning **404**.

| Question | Answer |
|----------|--------|
| Are routes missing? | **No** — pages exist under route groups. |
| Is it 404 vs redirect? | **Redirect (307)** to `/`, not 404 (except guessed login URLs). |
| Is middleware the current blocker? | **No** — middleware is intentionally bypassed when public env is missing. |
| Are layouts the current blocker? | **Yes** — `requireProfileRole` redirects unauthenticated users. |
| Is missing login flow the issue? | **Yes** — even with correct env, there is no way to sign in via the app. |
| Is auth intentionally disabled? | **Partially** — middleware disables enforcement when public env is absent; layouts still enforce via redirect. |
| Is `getCurrentUser()` always null locally? | **Yes** (with current `.env.local`) — no anon client, no session cookies. |

This is **architectural** (auth/session/login not wired for browser use), compounded by a **local configuration gap** (missing `NEXT_PUBLIC_*` vars).

---

## Verification (local, 2026-05-16)

Dev server: `npm run dev` on port 3000.

### HTTP status matrix

| Path | Status | Redirect target | Notes |
|------|--------|-----------------|-------|
| `/` | 200 | — | Marketing home loads |
| `/customer` | 307 | `/` | |
| `/customer/book` | 307 | `/` | |
| `/customer/bookings` | 307 | `/` | |
| `/cleaner` | 307 | `/` | |
| `/cleaner/offers` | 307 | `/` | |
| `/cleaner/jobs` | 307 | `/` | |
| `/admin` | 307 | `/` | |
| `/admin/bookings` | 307 | `/` | |
| `/admin/payouts` | 307 | `/` | |

### Response headers (protected routes)

```
HTTP/1.1 307 Temporary Redirect
x-auth-enforcement: disabled
location: /
```

`x-auth-enforcement: disabled` is set only when middleware cannot load public Supabase env (see `src/middleware.ts` lines 10–12). Confirms **middleware is not performing session checks** in the current setup; the redirect is applied later in the request (layout / RSC).

### Dev server log excerpts

```
GET /customer 307 … (proxy.ts … application-code …)
GET /sign-in 404 …
GET /cleaner/login 404 …
```

Users naturally try login URLs that do not exist.

---

## Route inventory (physical files)

Route groups do not affect the URL path. All listed paths map to real `page.tsx` files.

### Customer — `src/app/(customer)/`

| URL | File |
|-----|------|
| `/customer` | `customer/page.tsx` |
| `/customer/book` | `customer/book/page.tsx` |
| `/customer/bookings` | `customer/bookings/page.tsx` |
| `/customer/bookings/[bookingId]` | `customer/bookings/[bookingId]/page.tsx` |

Layout: `(customer)/layout.tsx` → `requireProfileRole(["customer"])`.

### Cleaner — `src/app/(cleaner)/`

| URL | File |
|-----|------|
| `/cleaner` | `cleaner/page.tsx` |
| `/cleaner/offers` | `cleaner/offers/page.tsx` |
| `/cleaner/jobs` | `cleaner/jobs/page.tsx` |
| `/cleaner/jobs/[bookingId]` | `cleaner/jobs/[bookingId]/page.tsx` |
| `/cleaner/earnings` | `cleaner/earnings/page.tsx` |

Layout: `(cleaner)/layout.tsx` → `requireProfileRole(["cleaner"])`.

### Admin — `src/app/(admin)/`

| URL | File |
|-----|------|
| `/admin` | `admin/page.tsx` |
| `/admin/bookings` | `admin/bookings/page.tsx` |
| `/admin/bookings/[bookingId]` | `admin/bookings/[bookingId]/page.tsx` |
| `/admin/payouts` | `admin/payouts/page.tsx` |
| `/admin/assignments` | `admin/assignments/page.tsx` |

Layout: `(admin)/layout.tsx` → `requireProfileRole(["admin"])`.

### Marketing (accessible)

| URL | File |
|-----|------|
| `/` | `(marketing)/page.tsx` |

### Auth / login routes

**None.** No `src/app/**/login/**`, `sign-in/**`, or `auth/callback/**`.

---

## Environment configuration

### Present in `.env.local` (verified)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BOOKING_COMMAND_RUN_REMOTE_INTEGRATION`
- `E2E_TEST_*` IDs, emails, password (from `npm run e2e:seed`)

### Missing from `.env.local` (verified)

- `NEXT_PUBLIC_SUPABASE_URL` — **not set**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **not set**

`.env.example` documents both as required for browser/session auth. `docs/testing/live-e2e-smoke-test.md` also lists them as prerequisites.

### Misleading file

`.next/.env.local` contains a **template** with example `NEXT_PUBLIC_*` values. Next.js does **not** load this file for the app; only project-root `.env.local` is used. Do not treat `.next/.env.local` as active configuration.

### Effect on auth stack

| Component | When `NEXT_PUBLIC_*` missing | When `NEXT_PUBLIC_*` present, no session |
|-----------|------------------------------|------------------------------------------|
| `getSupabasePublicEnv()` | `null` | `{ url, anonKey }` |
| Middleware | Pass-through, `x-auth-enforcement: disabled` | Redirect 307 → `/?redirectedFrom=…` |
| `createSupabaseServerClient()` | `null` | Client created, no user cookie |
| `getCurrentUser()` | Always `null` | `null` (no sign-in) |
| `requireProfileRole()` | `redirect("/")` | `redirect("/")` |
| API `requireApiUser()` | 401 JSON | 401 JSON |

**Current failure mode:** middleware pass-through + layout redirect (no `redirectedFrom` query param).

**After adding public env only:** middleware redirect + layout redirect (still no session; `redirectedFrom` set by middleware but **not read anywhere** in the app).

---

## Auth / session infrastructure

### `getCurrentUser()` — `src/lib/auth/getCurrentUser.ts`

1. `createSupabaseServerClient()` — requires `NEXT_PUBLIC_SUPABASE_URL` + anon key.
2. `supabase.auth.getUser()` — needs valid session cookies.
3. Load `profiles` row — returns `null` if profile missing.

With current env: step 1 fails → **always `null`**.

### `requireProfileRole()` — `src/lib/auth/requireProfileRole.ts`

- No user → `redirect("/")` (no message, no login target).
- Wrong role → throws `ForbiddenError` (403) — only reachable if user is authenticated with a mismatched role and middleware did not already redirect.

### Role resolution

- Authoritative role: `profiles.role` (`customer` | `cleaner` | `admin`).
- Middleware compares `profile?.role` to path prefix.
- If `profile` is `null`, `profile?.role !== "customer"` is **true** → middleware would redirect to `/` once public env exists.

### Supabase clients in repo

| Module | Purpose |
|--------|---------|
| `src/lib/supabase/publicEnv.ts` | Reads `NEXT_PUBLIC_*` |
| `src/lib/supabase/server.ts` | Cookie-based server client (session) |
| `src/lib/supabase/serviceRole.ts` | Service role (commands, scripts, tests) |

**No** `src/lib/supabase/browser.ts` or `createBrowserClient` usage in app code. Session cookies cannot be set from a UI flow.

### Seeded E2E users

`npm run e2e:seed` creates real Supabase auth users and profiles:

| Role | Email | Password (in `.env.local`) |
|------|-------|----------------------------|
| Customer | `test_e2e_customer@shalean.co.za` | `TestE2e!2026Shalean` |
| Cleaner | `test_e2e_cleaner@shalean.co.za` | same |
| Admin | `test_e2e_admin@shalean.co.za` | same |

Seed writes `E2E_TEST_*` to `.env.local` but **does not** write `NEXT_PUBLIC_*`.

Sign-in exists only in test helpers (`src/tests/security/rlsTestSupport.ts` → `signInWithPassword`), not in the product.

---

## Middleware — `src/middleware.ts`

**Matcher:** `/customer/:path*`, `/admin/:path*`, `/cleaner/:path*`

**Logic:**

1. If no public env → `NextResponse.next()` + `x-auth-enforcement: disabled`.
2. Else create cookie-aware Supabase client, `getUser()`.
3. No user → redirect `/` with `redirectedFrom` query param.
4. Load profile; if role does not match path prefix → redirect `/`.
5. Else allow request.

**Current local behavior:** Branch 1 only (env missing).

**Not incorrect** for the configured env — it is working as coded. The hazard is the **asymmetric** disable: middleware skips checks while layouts still redirect, which obscures whether the failure is “no env” vs “no session”.

---

## Layouts and page-level gates

All three route-group layouts call `requireProfileRole` before rendering children.

Additional page-level redirect:

- `src/app/(customer)/customer/book/page.tsx` — `if (!user) redirect("/")` (redundant with layout when layout runs first; same outcome).

`notFound()` is used only on detail pages when a booking ID cannot be loaded **after** auth succeeds — not the cause of list/dashboard inaccessibility.

Marketing layout has **no** auth checks.

---

## Failure chain (exact condition)

```
Request: GET /customer
  → middleware: getSupabasePublicEnv() === null
  → middleware: return next (x-auth-enforcement: disabled)
  → CustomerLayout: requireProfileRole(["customer"])
  → getCurrentUser(): createSupabaseServerClient() === null
  → redirect("/")
Response: 307 Location: /
```

**Failing condition:** `getCurrentUser() === null` because `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset (and no session cookies exist regardless).

---

## Auth / login gap analysis

| Capability | Status |
|------------|--------|
| Login page (`/login`, `/sign-in`, etc.) | **Missing** (404 if guessed) |
| Sign-up page | **Missing** |
| OAuth / magic link callback | **Missing** |
| Browser Supabase client | **Missing** |
| Server session reader | **Implemented** (needs public env + cookies) |
| Middleware path protection | **Implemented** (disabled without public env) |
| Layout role enforcement | **Implemented** |
| E2E seed users | **Present in DB**, not reachable via UI |
| `redirectedFrom` handling on `/` | **Not implemented** (param set but unused) |
| Dev-only auth bypass | **None** |

**Conclusion:** Missing login flow is a **real, separate blocker** from the env gap. Fixing env alone moves failure from “layout-only redirect” to “middleware + layout redirect without a sign-in path.”

---

## Affected files

| File | Role in failure |
|------|-----------------|
| `.env.local` | Missing `NEXT_PUBLIC_*` (primary local trigger) |
| `src/lib/supabase/publicEnv.ts` | Returns `null` without public vars |
| `src/lib/supabase/server.ts` | Cannot create session client |
| `src/middleware.ts` | Disables enforcement when env missing; will block unauthenticated users when env present |
| `src/lib/auth/getCurrentUser.ts` | Always `null` without client/session/profile |
| `src/lib/auth/requireProfileRole.ts` | `redirect("/")` when no user |
| `src/app/(customer)/layout.tsx` | Customer gate |
| `src/app/(cleaner)/layout.tsx` | Cleaner gate |
| `src/app/(admin)/layout.tsx` | Admin gate |
| `src/app/(customer)/customer/book/page.tsx` | Extra redirect |
| `src/app/(marketing)/page.tsx` | Landing only — no auth entry |
| `scripts/e2e/seed.mjs` | Seeds users but not `NEXT_PUBLIC_*` |

---

## Architectural vs temporary

| Issue | Type |
|-------|------|
| Missing `NEXT_PUBLIC_*` in `.env.local` | **Temporary / config** — copy from Supabase dashboard or `.env.example` |
| No login UI or browser auth client | **Architectural** — required for any real dashboard access |
| Middleware disabled when env missing | **Intentional scaffold** — documented in `docs/security/auth-enforcement-gap-map.md` |
| Double middleware + layout auth queries | **Architectural** (acceptable for foundation; not cause of total block) |
| RLS not enabled on tables | **Security gap** — separate from route reachability |

---

## Recommended next implementation phase

Do **not** weaken production auth. Implement in order:

### Phase A — Local env unblock (config only)

1. Add to project-root `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` (same project as `SUPABASE_URL`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon/public key from Supabase dashboard)
2. Restart `npm run dev`.
3. Expect: `x-auth-enforcement` header absent on protected routes; still **307 → `/`** until signed in.

### Phase B — Minimal login/session flow (product)

1. `src/lib/supabase/browser.ts` — `createBrowserClient` from `@supabase/ssr`.
2. `src/app/(auth)/login/page.tsx` (or `/sign-in`) — email/password form using `signInWithPassword`.
3. `src/app/auth/callback/route.ts` — exchange code for session (future OAuth/magic link).
4. On marketing home (`/`): link to login; read `redirectedFrom` and send users back after sign-in.
5. Optional: role-aware post-login redirect (`/customer`, `/cleaner`, `/admin`) based on `profiles.role`.

### Phase C — Local dev ergonomics (optional, non-production)

- Document “sign in as E2E customer” in `docs/testing/live-e2e-smoke-test.md` using Phase B login + seeded credentials.
- Avoid permanent auth bypass in middleware for production paths.

### Phase D — Hardening (follow-on)

- Fail fast at startup if dashboards are built but `NEXT_PUBLIC_*` missing (dev warning).
- Align middleware behavior when env missing (either block with clear error page or match layout message).
- Profile bootstrap on first login (see gap map: missing `profiles` row).
- RLS per `docs/security/rls-plan.md` before exposing data APIs to anon key.

---

## Production-safe vs local-dev recommendations

### Production-safe

- Require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in deployment env (e.g. Vercel).
- Ship login + callback routes before linking dashboards in marketing/nav.
- Keep service role server-only; never add to `NEXT_PUBLIC_*`.
- Do not disable middleware enforcement in production (ensure public env is always set).

### Local development

1. Copy `NEXT_PUBLIC_*` into `.env.local` (not `.next/.env.local`).
2. Run `npm run e2e:seed` if test users are missing.
3. Implement Phase B, then sign in with seeded emails/password.
4. Use curl or browser DevTools: expect **200** on dashboards after login, not 307.

---

## Acceptance checklist (audit)

- [x] Explain exactly why protected routes fail — **307 redirect: no public Supabase env → no session → layout `requireProfileRole` redirect.**
- [x] Missing login flow is an issue — **yes; no route or browser client to create a session.**
- [x] Identify middleware vs auth vs layouts — **currently layouts (middleware disabled); after env fix, middleware + layouts + no login.**
- [x] Recommended next phase — **Phase A env, then Phase B login/session (see above).**

---

## References

- `docs/security/auth-enforcement-gap-map.md`
- `docs/testing/live-e2e-smoke-test.md`
- `.env.example`
