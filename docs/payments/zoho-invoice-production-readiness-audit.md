# Zoho invoice payments — production readiness audit (Phase 6)

Audit date: 2026-05-22  
Scope: Full Zoho invoice payment system before live use  
Test run: **236 targeted tests passed** (Zoho, Paystack webhook/initialize, reconciliation cron, admin diagnostics, booking Paystack guards, security registry)

---

## Executive summary

The Zoho invoice payment system is **code-ready for live launch** once production environment, Paystack live webhook, Zoho OAuth, and reconcile cron scheduling are configured correctly.

**No booking payment regressions** were found in the targeted test suite. Webhook routing, idempotency, verify-before-Zoho, failed-charge isolation, RLS deny-by-default, and admin diagnostics redaction are implemented and tested.

**Blocking issues are operational**, not missing application logic: production env vars, live Paystack keys + webhook, Zoho production org credentials, scheduled reconcile cron, and one real-money QA pass.

---

## 1. Environment safety

### Findings

| Check | Status | Notes |
|-------|--------|-------|
| Local / preview / production separation | **Ops** | Vercel env scopes must differ; preview uses `sk_test_…`, production uses `sk_live_…` (documented in `docs/launch/production-readiness-checklist.md`) |
| Exposed secrets rotated | **Verify manually** | Cannot confirm from repo; rotate if any secret was committed or shared |
| Production live Paystack keys | **Ops** | No runtime `sk_live` guard in code — checklist requires live keys in production |
| Zoho production org ID | **Ops** | `ZOHO_BOOKS_ORGANIZATION_ID` + OAuth vars in `src/lib/zoho/zohoEnv.ts` |
| `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` | **Hardened** | `.env.example` updated with canonical `https://www.shalean.com`; Paystack callback now uses `resolveNotificationAppBaseUrl()` (skips localhost on deployed runtimes) |
| E2E passwords / test IDs in production | **Documented** | Checklist: remove `E2E_TEST_*` from production; do not run `e2e:seed` |

### Environment variable matrix

| Variable | Production | Preview / local |
|----------|------------|-----------------|
| `APP_BASE_URL` | `https://www.shalean.com` (canonical) | `http://localhost:3000` |
| `PAYSTACK_SECRET_KEY` | `sk_live_…` | `sk_test_…` |
| `PAYSTACK_WEBHOOK_SECRET` | Live webhook secret | Test webhook secret |
| `PAYSTACK_ENABLED` | `true` | `true` (test mode) |
| `ZOHO_BOOKS_ORGANIZATION_ID` | Production org | Staging/test org |
| `ZOHO_CLIENT_ID` / `SECRET` / `REFRESH_TOKEN` | Production OAuth | Staging OAuth |
| `CRON_SECRET` | Strong random secret | Same pattern locally |
| `E2E_TEST_*` | **Unset** | OK on local/staging |

### Already good

- Zoho credentials are server-only (no `NEXT_PUBLIC_*` Zoho vars)
- `resolveNotificationAppBaseUrl()` skips localhost for admin payment links on deployed runtimes
- `.env.example` now documents full Zoho + canonical URL requirements

---

## 2. Paystack live readiness

### Findings

| Check | Status | Evidence |
|-------|--------|----------|
| Webhook URL `/api/paystack/webhook` | **Pass** | `src/app/api/paystack/webhook/route.ts` |
| Webhook secret validation (HMAC) | **Pass** | `verifyPaystackWebhookSignature` + timing-safe compare; invalid → 401 |
| `charge.success` → booking | **Pass** | `metadata.source: "booking"` or `bk_` prefix → `processPaystackChargeSuccess` |
| `charge.success` → Zoho | **Pass** | `metadata.source: "zoho_invoice"` or `zi_` prefix → `processZohoInvoiceChargeSuccess` |
| Duplicate webhook idempotency | **Pass** | `zoho_invoice_payment_events.provider_event_id` unique; paid + `zoho_payment_id` short-circuit |
| Failed charge never marks Zoho paid | **Pass** | `processZohoInvoiceChargeFailure` — local `failed` only, no Zoho API |

### Ops requirements (blocking)

1. Paystack dashboard → **Live mode** webhook: `https://www.shalean.com/api/paystack/webhook`
2. Subscribe to **`charge.success`** and **`charge.failed`**
3. Confirm live `PAYSTACK_WEBHOOK_SECRET` matches dashboard (falls back to secret key if unset — prefer explicit webhook secret)

### Non-blocking

- `docs/payments/paystack-foundation.md` may still mention `charge.success` only — update to include Zoho routing and `charge.failed`

---

## 3. Zoho readiness

### Findings

| Check | Status | Evidence |
|-------|--------|----------|
| OAuth refresh token | **Pass** | `src/lib/zoho/zohoClient.ts` — refresh, cache, single-flight |
| Invoice lookup by number | **Pass** | `getZohoInvoiceByNumber()` used by initialize + public page |
| Customer payment creation | **Pass** | `createZohoCustomerPaymentForInvoice()` after Paystack verify |
| Already-paid blocked from checkout | **Pass** | `mapZohoInvoiceToPublicStatus` + initialize `NOT_PAYABLE` (409) |
| Void/cancelled blocked | **Pass** | Maps to `void`; initialize blocked |
| Amount/email from Zoho only | **Pass** | Initialize accepts `invoiceNumber` only |

### Non-blocking

- `verifyZohoInvoiceBalanceForPayment()` exists but is not called before reconcile — relies on Zoho API if invoice paid elsewhere
- OAuth 401 clears cache but does not retry same request inline

---

## 4. Cron readiness

### Findings

| Check | Status | Evidence |
|-------|--------|----------|
| `CRON_SECRET` required | **Pass** | `verifyCronSecret()` → 401 if missing/wrong |
| Vercel cron configured | **Ops blocker** | No `vercel.json` in repo — schedule externally |
| Retry backoff | **Pass** | 5m → 15m → 1h → 6h; max 5 attempts |
| Exhausted retries in admin | **Pass** | `zoho_reconcile_failed` in summary + table with retries/error |

### Recommended cron schedule

```
GET https://www.shalean.com/api/cron/reconcile-zoho-invoice-payments
Authorization: Bearer $CRON_SECRET
```

Every **5–15 minutes** while any `zoho_reconcile_pending` rows exist.

See `docs/operations/reconcile-zoho-invoice-payments-cron.md` for setup options.

---

## 5. Admin diagnostics

### Findings

| Check | Status | Evidence |
|-------|--------|----------|
| Admin-only page | **Pass** | Layout + page role check + API `requireApiUser(["admin"])` |
| No secrets in UI/API | **Pass** | No metadata, access codes, authorization URLs, raw payloads in DTO |
| Link helper production URLs | **Pass** | `resolveNotificationAppBaseUrl()` + `/pay/{invoiceNumber}` |
| Copy/open actions | **Pass** | `AdminZohoCopyLinkButton`, `AdminZohoOpenLinkButton` |
| No mutation buttons | **Pass** | Tests assert no retry/mark-paid |

---

## 6. Customer UX

### Findings

| Check | Status | Evidence |
|-------|--------|----------|
| Mobile-responsive `/pay` | **Pass** | `PayInvoiceShell`, `sm:` breakpoints, full-width pay button |
| Payable / paid / void / not found / error | **Pass** | `page.tsx` + `publicMessageForZohoInvoiceStatus` |
| Success page safe status | **Pass** | `fetchZohoInvoicePaymentStatusByReference` — public messages only |
| No raw Zoho/Paystack errors | **Pass** | Generic customer copy; internals logged server-side |

### Hardened in Phase 6

- Public initialize response no longer includes `accessCode` (client uses `authorizationUrl` only)

### Non-blocking

- No rate limiting on public initialize route (abuse surface for Zoho/Paystack API calls)
- Error JSON may include machine codes (`ZOHO_API_ERROR`) in network tab — not shown in UI

---

## 7. Security audit

### RLS

| Table | RLS | Public policies | Access |
|-------|-----|-----------------|--------|
| `zoho_invoice_payments` | Enabled | **None** | Service role server modules only |
| `zoho_invoice_payment_events` | Enabled | **None** | Service role server modules only |

Static tests: `zohoInvoicePaymentsMigration.test.ts`, `zohoInvoicePaymentEventsMigration.test.ts`

### Log redaction

**Pass** — `zohoInvoicePaymentLogger.ts` redacts tokens, authorization URLs, raw payloads; masks emails.

### Service role registry

**Pass** — Zoho payment writers listed in `serviceRoleLifecycleWriteRegistry.test.ts`

---

## 8. Test run results

```
236 tests passed across 36 files:
- Zoho invoice payment (initialize, webhook, reconcile, admin, link helper)
- Paystack webhook routing (booking + Zoho)
- Reconcile cron auth
- Admin diagnostics
- Security guards (mutation boundary, service role registry, RLS migrations)
- Booking Paystack foundation / verify / charge failure
```

Command used:

```bash
npx vitest run src/features/zoho-invoice-payments \
  src/features/payments/server/routePaystackWebhookEvent.test.ts \
  src/features/payments/server/detectPaystackWebhookPaymentSource.test.ts \
  src/app/api/paystack/initialize-zoho-invoice \
  src/app/api/paystack/webhook \
  src/app/api/cron/reconcile-zoho-invoice-payments \
  src/app/api/admin/zoho-invoice-payments \
  src/components/dashboard/admin/AdminZoho \
  src/tests/security/zohoInvoice \
  src/tests/security/mutationRouteBoundaryGuard.test.ts \
  src/tests/security/serviceRoleLifecycleWriteRegistry.test.ts \
  src/features/payments/server/paystackFoundation.test.ts \
  src/app/api/paystack/paystackMutationRoutes.test.ts
```

---

## Blocking issues (must fix before live)

| # | Issue | Owner | Action |
|---|-------|-------|--------|
| B1 | Production migrations not applied | Ops | Run `20260701140000`, `20260701150000`, `20260701160000` on production Supabase |
| B2 | Live Paystack webhook not configured | Ops | Live webhook URL + `charge.success` + `charge.failed` + matching secrets |
| B3 | Zoho production OAuth not set | Ops | All vars from `zohoEnv.ts` on Vercel production |
| B4 | Reconcile cron not scheduled | Ops | Schedule `/api/cron/reconcile-zoho-invoice-payments` with `CRON_SECRET` |
| B5 | `APP_BASE_URL` not canonical in production | Ops | Set `https://www.shalean.com` on Vercel production |
| B6 | Live-mode QA not completed | Ops/Finance | One low-value real invoice end-to-end (checklist below) |

---

## Non-blocking issues (recommended)

| # | Issue | Recommendation |
|---|-------|----------------|
| NB1 | No runtime `sk_live` vs `sk_test` guard | Add startup warning or deploy checklist sign-off |
| NB2 | Reconcile skips Zoho balance pre-check | Call `verifyZohoInvoiceBalanceForPayment` before create in future phase |
| NB3 | No rate limit on initialize-zoho-invoice | Add edge rate limit if abuse observed |
| NB4 | Production checklist missing Zoho section | Updated in `docs/launch/production-readiness-checklist.md` |
| NB5 | Doc drift on `charge.failed` | Update `paystack-foundation.md` |

---

## Recommended fixes (applied in Phase 6)

1. **Paystack callback URL** — `buildZohoInvoicePaystackCallbackUrl` now uses `resolveNotificationAppBaseUrl()` (skips localhost on deployed runtimes)
2. **`.env.example`** — Full Zoho vars + canonical production URL guidance
3. **Initialize response** — Removed `accessCode` from public JSON
4. **Callback URL test** — `buildZohoInvoicePaystackCallbackUrl.test.ts`

---

## Final go-live checklist

### Pre-launch (engineering + ops)

- [ ] Production Supabase: all Zoho migrations applied
- [ ] Vercel production env: `APP_BASE_URL=https://www.shalean.com`
- [ ] Vercel production: live `sk_live_…` Paystack keys
- [ ] Vercel production: `PAYSTACK_WEBHOOK_SECRET` (live)
- [ ] Vercel production: full Zoho OAuth + org ID
- [ ] Vercel production: `CRON_SECRET` set
- [ ] Vercel production: **no** `E2E_TEST_*` vars
- [ ] Paystack live webhook → `https://www.shalean.com/api/paystack/webhook`
- [ ] Cron scheduled every 5–15 min for reconcile route
- [ ] `npm test` + `npm run build` clean on release branch

### Manual live-mode QA (one low-value invoice)

1. [ ] Create real Zoho invoice (minimum amount, known customer email)
2. [ ] Open `/admin/operations/zoho-payments` → generate payment link
3. [ ] Optional: **Check invoice** — payable, correct amount
4. [ ] Open `/pay/{invoiceNumber}` on mobile viewport — professional layout
5. [ ] Pay with live Paystack (real card, small amount)
6. [ ] Confirm Paystack transaction success in dashboard
7. [ ] Confirm webhook received (Paystack dashboard or server logs)
8. [ ] Confirm `zoho_invoice_payments` row → `paid` with `zoho_payment_id`
9. [ ] Confirm `zoho_invoice_payment_events` row created
10. [ ] Confirm Zoho Books invoice/customer payment marked paid
11. [ ] Confirm `/pay/{invoiceNumber}/success?reference=…` shows paid
12. [ ] Confirm admin diagnostics show `paid` (or no row if only problematic filter)
13. [ ] Replay webhook — no duplicate Zoho customer payment
14. [ ] Test declined card on separate invoice — row `failed`, Zoho balance unchanged

### Post-launch sign-off

| Area | Owner | Date |
|------|-------|------|
| Engineering | | |
| Operations | | |
| Finance | | |

---

## Rollback plan

### Immediate (stop new Zoho checkout)

1. Set `PAYSTACK_ENABLED=false` on production → initialize returns 503
2. Or set `ZOHO_BOOKS_ENABLED=false` → invoice lookup disabled, safe “not available” message

### Partial (keep bookings, disable Zoho only)

- `ZOHO_BOOKS_ENABLED=false` — booking Paystack unaffected
- Remove Zoho webhook routing is **not** required; booking webhooks continue via same endpoint

### Data / reconciliation

- Existing `zoho_invoice_payments` rows remain; cron can be paused by removing schedule
- Do **not** delete rows mid-reconciliation without ops review
- If live payment succeeded but Zoho not updated: check `zoho_reconcile_pending` / `zoho_reconcile_failed` in admin diagnostics; fix Zoho API, run cron manually with `CRON_SECRET`

### Code rollback

- Redeploy previous Vercel deployment
- Migrations are additive — no down migration required for rollback

---

## Monitoring checklist

### Logs (`payments:zoho-invoice` namespace)

Watch for:

- `zoho_invoice_paystack_initialize_failed` — spike = Paystack or Zoho config issue
- `zoho_invoice_zoho_reconcile_failed` — needs admin review
- `zoho_invoice_reconcile_retry_exhausted` — terminal failure
- `zoho_invoice_amount_mismatch` / `zoho_invoice_currency_mismatch` — investigate invoice vs Paystack
- `zoho_token_refresh_failed` — Zoho OAuth broken
- `invoice_number_invalid` — abuse or bad links

### Admin dashboard

- Daily: `/admin/operations/zoho-payments` — any `zoho_reconcile_failed` count > 0
- Weekly: confirm cron last run (Vercel cron logs or manual invoke)

### Paystack dashboard

- Failed webhooks queue empty
- Live transaction success rate normal

### Alerts (recommended)

- Cron 401/5xx on reconcile route
- Webhook 401 spike (wrong secret)
- Rows in `zoho_reconcile_pending` older than 24h

---

## Related docs

- [Zoho invoice payments (Phases 1–5)](./zoho-invoice-payments.md)
- [Production readiness checklist](../launch/production-readiness-checklist.md)
- [Reconcile cron setup](../operations/reconcile-zoho-invoice-payments-cron.md)
- [Paystack foundation](./paystack-foundation.md)
