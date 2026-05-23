# Production readiness checklist

Use before promoting staging to production or onboarding real customers.

## Infrastructure

- [ ] **Supabase project** — production project separate from staging
- [ ] **Migrations** — `npx supabase db push` on production; verify through Phase 10
- [ ] **RLS enabled** — all public tables; spot-check `docs/security/rls-role-security.md`
- [ ] **Service role** — only on server/Vercel env; never `NEXT_PUBLIC_*`
- [ ] **Auth** — `handle_new_user` trigger active; email provider configured

## Environment variables

| Variable | Production |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production URL (browser-safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon key (browser-safe) |
| `SUPABASE_URL` | Same project URL (server scripts; may match `NEXT_PUBLIC_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only — never `NEXT_PUBLIC_*`, never client imports |
| `PAYSTACK_SECRET_KEY` | **Live** `sk_live_…` (not test) |
| `PAYSTACK_WEBHOOK_SECRET` | Live webhook secret |
| `PAYSTACK_ENABLED` | `true` |
| `BOOKING_COMMAND_BACKEND` | `supabase` |

Remove or unset E2E-only vars (`E2E_TEST_*`) in production.

### Zoho invoice payments (manual invoices)

| Variable | Production |
|----------|------------|
| `APP_BASE_URL` | Canonical HTTPS origin, e.g. `https://www.shalean.com` (required for payment links + Paystack callbacks) |
| `ZOHO_BOOKS_ENABLED` | `true` |
| `ZOHO_BOOKS_ORGANIZATION_ID` | Production Zoho Books org ID |
| `ZOHO_CLIENT_ID` | Production OAuth client ID |
| `ZOHO_CLIENT_SECRET` | Server-only |
| `ZOHO_REFRESH_TOKEN` | Server-only long-lived token |
| `CRON_SECRET` | Required for `/api/cron/reconcile-zoho-invoice-payments` |

Apply migrations: `20260701140000`, `20260701150000`, `20260701160000`.

See [Zoho production readiness audit](../payments/zoho-invoice-production-readiness-audit.md).

## Paystack

- [ ] Live keys in production environment
- [ ] Webhook URL: `https://<production-domain>/api/paystack/webhook`
- [ ] Webhook events: **`charge.success`** and **`charge.failed`**
- [ ] Zoho invoice webhook routing: same endpoint; `metadata.source: zoho_invoice` or `zi_` reference prefix
- [ ] Verify redirect URL allowed in Paystack dashboard
- [ ] Test one **live** small transaction in controlled window (optional)

## Seed data

- [ ] **Do not** run `npm run e2e:seed` on production
- [ ] Real `services` rows match pricing catalog (or rely on code-first slugs)
- [ ] At least one real cleaner with areas, capabilities, availability
- [ ] Admin profile(s) with `profiles.role = admin`

## Auth & roles

- [ ] **`/sign-in`** — email/password login works for each role
- [ ] Unauthenticated dashboard access redirects to `/sign-in` (not marketing home)
- [ ] Cross-role paths redirect to the user’s home dashboard (customer ≠ `/admin`)
- [ ] Sign out clears session and returns to `/sign-in`
- [ ] Customer signup → `profiles.role = customer` + `customers` row
- [ ] Cleaner onboarding → `cleaner` role + `cleaners` row
- [ ] Admin users created only via controlled process
- [ ] RLS: customer cannot read other bookings
- [ ] RLS: cleaner cannot read other cleaners’ earnings
- [ ] RLS: customer cannot read `earning_lines`

## Flows tested on staging

- [ ] **Customer** — full wizard → lock → Paystack **test** → confirmed ([live E2E doc](../testing/live-e2e-smoke-test.md))
- [ ] **Cleaner** — accept offer → start → complete
- [ ] **Admin** — assignment queue, payout-ready, paid-out
- [ ] **Earnings** — positive amounts; no R0 lines; payout ≤ booking total
- [ ] **Idempotency** — duplicate webhook does not double-charge status

## Command layer

- [ ] No direct `bookings.status` updates in app code (`bookingStatusMutationGuard` test passes)
- [ ] All lifecycle changes via `executeBookingCommand`
- [ ] Integration tests pass against staging (`executeBookingCommand.integration.test.ts`) when configured

## Dashboards

- [ ] `/sign-in` — production auth entry
- [ ] `/customer` — own bookings only
- [ ] `/customer/book` — booking wizard (authenticated customer)
- [ ] `/cleaner` — offers + jobs + earnings
- [ ] `/cleaner/offers` — accept/decline offers
- [ ] `/admin` — all bookings, assignments, payouts
- [ ] `/admin/payouts` — payout queue
- [ ] `/admin/operations/zoho-payments` — Zoho invoice payment link helper + diagnostics (admin only)

## Zoho invoice payments (live QA)

- [ ] One low-value live Zoho invoice → payment link → Paystack live payment → Zoho marked paid
- [ ] Reconcile cron scheduled (`docs/operations/reconcile-zoho-invoice-payments-cron.md`)
- [ ] Duplicate webhook replay does not duplicate Zoho customer payment
- [ ] Declined card does not update Zoho invoice balance

## Observability & errors

- [ ] Structured logs for booking commands (`bookingId`, `command`, `idempotent`)
- [ ] Paystack webhook failures alert (dashboard or log drain)
- [ ] Stuck bookings monitor: `pending_payment` > 1h, `pending_assignment` > 24h
- [ ] Error tracking tool configured (Sentry, Datadog, etc.) — **plan documented**
- [ ] PII not logged in payment payloads

## Security

- [ ] HTTPS only on production domain
- [ ] CSP / security headers reviewed (Next.js config)
- [ ] Rate limiting on auth and payment routes (if applicable)
- [ ] `.env.local` / secrets not committed

## Deployment

- [ ] `npm run typecheck` clean
- [ ] `npm test` clean
- [ ] `npm run build` clean
- [ ] Vercel (or host) env vars set per environment
- [ ] Preview deployments use **test** Paystack keys only

## Sign-off

| Area | Owner | Date |
|------|-------|------|
| Engineering | | |
| Operations | | |
| Finance (payout process) | | |

---

*E2E test users (`test_e2e_*`) are for staging/local only. See [live E2E smoke test](../testing/live-e2e-smoke-test.md).*
