# Zoho invoice payments (Phase 1 + 1.5)

Read-only foundation for manual Zoho Books invoices paid via future Shalean `/pay/{invoiceNumber}` pages. Booking Paystack checkout is unchanged.

## Routes

| Route | Method | Auth | Responsibility |
|-------|--------|------|----------------|
| `/api/payments/zoho-invoice/[invoiceNumber]` | GET | Public | Safe invoice DTO or safe error envelope |
| `POST /api/paystack/initialize-zoho-invoice` | POST | Public | Start Paystack checkout for payable Zoho invoice |
| `/pay/[invoiceNumber]` | GET | Public | Branded invoice view with Paystack pay button |
| `/pay/[invoiceNumber]/success` | GET | Public | Paystack return placeholder (no reconciliation yet) |

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `ZOHO_BOOKS_ENABLED` | No | Set `false` to disable; when unset, enabled if OAuth vars present |
| `ZOHO_BOOKS_ORGANIZATION_ID` | Yes (when enabled) | Zoho Books organization ID |
| `ZOHO_CLIENT_ID` | Yes (when enabled) | OAuth client ID |
| `ZOHO_CLIENT_SECRET` | Yes (when enabled) | Server-only |
| `ZOHO_REFRESH_TOKEN` | Yes (when enabled) | Server-only long-lived refresh token |
| `ZOHO_INVOICE_PAYMENTS_ENABLED` | No | Default `true`; set `false` to disable `/pay` and initialize |
| `ZOHO_SAVED_METHODS_ENABLED` | No | Default `true`; set `false` to hide save-card consent and customer methods |
| `ZOHO_ADMIN_CARD_CHARGES_ENABLED` | No | Default `false`; set `true` after sign-off for admin saved-card charges |
| `ZOHO_ACCOUNTS_SERVER` | No | Defaults to `https://accounts.zoho.com` |
| `ZOHO_BOOKS_API_BASE_URL` | No | Defaults to `https://www.zohoapis.com/books/v3` |

Never expose Zoho credentials with `NEXT_PUBLIC_*` or client bundles.

## Public DTO

```ts
{
  invoiceNumber: string;
  customerName: string | null;
  amountDueCents: number;
  currency: string;
  dueDate: string | null;
  lineItems: Array<{
    name: string;
    quantity: number | null;
    rateCents: number | null;
    totalCents: number | null;
  }>;
  status: "payable" | "paid" | "void" | "not_found" | "error" | "not_configured";
}
```

Amounts are derived from Zoho `balance` (major units → cents). Status rules:

- **void** — Zoho status `void`, `cancelled`, or `canceled`
- **paid** — Zoho status `paid` or `balance <= 0`
- **payable** — positive balance and not void
- **not_found** — no matching invoice (generic copy to customers)
- **not_configured** — Zoho env missing/disabled
- **error** — Zoho API failure (logged server-side only)

## Invoice number validation

Accepted: ASCII letters, digits, hyphen, underscore; max 32 chars; normalized to uppercase (e.g. `inv-001602` → `INV-001602`).

Rejected: path traversal, spaces, non-ASCII, other symbols, empty/oversized values.

## Public status rules (Phase 1.5)

All customer-facing responses use `mapZohoInvoiceToPublicStatus`:

| Status | When |
|--------|------|
| `not_configured` | Zoho env disabled or missing |
| `not_found` | Zoho returned no matching invoice |
| `void` | Zoho status `void`, `cancelled`, or `canceled` |
| `paid` | Zoho status `paid` or `balanceCents <= 0` |
| `payable` | `balanceCents > 0` and invoice is not void/cancelled |
| `error` | Zoho API/system failure (generic public message only) |

Successful API responses return `{ ok: true, invoice }` with `payable`, `paid`, or `void`.

Failure API responses return `{ ok: false, status, message }` with safe copy only:

- `not_configured` → HTTP 503 — “Online invoice payments are not available yet.”
- `not_found` → HTTP 404 — “We could not find this invoice.”
- `error` → HTTP 502 — “Invoice payment details are temporarily unavailable.”

Invalid invoice numbers return HTTP 400 with `{ ok: false, error: "INVALID_INVOICE_NUMBER", message }`.

## Observability (Phase 1.5)

Structured logs use namespace **`payments:zoho-invoice`** (`src/lib/zoho/zohoInvoicePaymentLogger.ts`).

| Event | Level | When |
|-------|-------|------|
| `invoice_number_invalid` | warn | Validation rejected input |
| `zoho_not_configured` | warn | Zoho disabled or env missing |
| `zoho_invoice_fetch_started` | info | Before Zoho Books fetch |
| `zoho_invoice_fetch_succeeded` | info | Invoice mapped successfully |
| `zoho_invoice_fetch_failed` | warn | Zoho/API failure |
| `zoho_invoice_not_found` | warn | Empty invoice list |
| `zoho_invoice_status_mapped` | info | Public status derived from Zoho fields |
| `zoho_token_refresh_failed` | warn | OAuth refresh failed |
| `zoho_api_latency_warning` | warn | Fetch exceeded 1500ms |
| `zoho_invoice_initialize_started` | info | Paystack initialize requested |
| `zoho_invoice_initialize_reused_pending` | info | Reused existing pending checkout |
| `zoho_invoice_initialize_blocked_not_payable` | warn | Paid/void/missing email/zero balance |
| `zoho_invoice_payment_attempt_created` | info | New `zoho_invoice_payments` row |
| `zoho_invoice_paystack_initialize_started` | info | Before Paystack API call |
| `zoho_invoice_paystack_initialize_succeeded` | info | Paystack checkout URL stored |
| `zoho_invoice_paystack_initialize_failed` | warn | Paystack initialize failed |

### Safe logging rules

Never log:

- Zoho access or refresh tokens
- Client secret
- Full customer email (masked as `j***@domain.com`)
- Full raw Zoho payload
- Paystack authorization URLs

Allowed diagnostics (non-sensitive):

- `invoiceNumber` (normalized)
- `durationMs`, `operation`
- `publicStatus`, `zohoStatus` (status string only)
- `balanceCents`, `failureCode`, `httpStatus`, `retryable`

## Code map

| Module | Role |
|--------|------|
| `src/lib/zoho/zohoEnv.ts` | Feature flag and env validation |
| `src/lib/zoho/zohoClient.ts` | OAuth refresh + Books API fetch |
| `src/lib/zoho/invoices.ts` | Fetch invoice by number |
| `src/lib/zoho/zohoInvoicePaymentLogger.ts` | Structured observability |
| `src/features/zoho-invoice-payments/server/mapZohoInvoiceToPublicStatus.ts` | Public status mapper |
| `src/features/zoho-invoice-payments/server/invoiceNumberValidation.ts` | Input validation |
| `src/features/zoho-invoice-payments/server/fetchZohoInvoicePaymentDetails.ts` | Public DTO orchestration |
| `src/features/zoho-invoice-payments/server/initializeZohoInvoicePayment.ts` | Paystack initialize for Zoho invoices |
| `src/features/zoho-invoice-payments/server/zohoInvoicePaymentRepository.ts` | `zoho_invoice_payments` persistence |
| `src/app/api/payments/zoho-invoice/[invoiceNumber]/route.ts` | Invoice read API |
| `src/app/api/paystack/initialize-zoho-invoice/route.ts` | Paystack initialize API |
| `src/app/pay/[invoiceNumber]/page.tsx` | Payment page UI |
| `src/features/zoho-invoice-payments/server/processZohoInvoiceChargeSuccess.ts` | Paystack success webhook reconcile |
| `src/features/zoho-invoice-payments/server/processZohoInvoiceChargeFailure.ts` | Paystack failed webhook handler |
| `src/features/zoho-invoice-payments/server/fetchZohoInvoicePaymentStatusByReference.ts` | Public payment status lookup |
| `src/features/payments/server/routePaystackWebhookEvent.ts` | Webhook router (booking vs Zoho) |
| `src/lib/zoho/customerPayments.ts` | Zoho customer payment creation |
| `src/app/pay/[invoiceNumber]/success/page.tsx` | Paystack return + status display |

## Phase 2 — Paystack initialize (current)

Payable Zoho invoices can start Paystack hosted checkout. Amount and customer email always come from a **live Zoho fetch** at initialize time.

### Table: `zoho_invoice_payments`

Migration: `supabase/migrations/20260701140000_zoho_invoice_payments.sql`

Tracks manual invoice checkout attempts separately from `public.payments` (bookings). RLS enabled with **no public policies** — service role only.

Key fields: `invoice_number`, `zoho_invoice_id`, `customer_email`, `amount_cents`, `paystack_reference`, `paystack_authorization_url`, `status`.

Active checkout constraint: at most one row per invoice in `initialized`, `pending_paystack`, or `zoho_reconcile_pending`.

### Initialize flow

1. Customer opens `/pay/{invoiceNumber}` and clicks **Pay securely with Paystack**.
2. Browser `POST`s `{ invoiceNumber }` only to `/api/paystack/initialize-zoho-invoice`.
3. Server re-fetches invoice from Zoho, validates payable balance and customer email.
4. Server creates or reuses `zoho_invoice_payments` row.
5. Server calls shared `paystackInitializeTransaction` with amount from Zoho.
6. Browser redirects to Paystack `authorization_url`.
7. Paystack returns to `/pay/{invoiceNumber}/success?reference=...` (placeholder only).

### Paystack metadata (Zoho invoices)

```json
{
  "source": "zoho_invoice",
  "invoice_number": "INV-001602",
  "zoho_invoice_id": "...",
  "zoho_invoice_payment_id": "..."
}
```

Paystack reference prefix: `zi_` (see `buildZohoInvoicePaystackReference.ts`).

Callback URL:

`${APP_BASE_URL}/pay/{invoiceNumber}/success?reference={reference}`

### Phase 2 security rules

- Browser sends **invoice number only** — never amount or email.
- Amount always from live Zoho balance at initialize time.
- Public API returns safe error messages only; internal details are logged under `payments:zoho-invoice`.
- Booking Paystack routes (`/api/paystack/initialize`, verify, webhook, finalize) are unchanged.

### Phase 2 scope (historical)

Phase 2 intentionally excluded webhook routing, Zoho mark-paid, reconciliation, cron retry, and success-page verification. Those items were delivered in Phase 3.

### Manual QA (Phase 2)

1. Configure Zoho and Paystack env vars (`APP_BASE_URL`, `PAYSTACK_SECRET_KEY`, Zoho OAuth).
2. Create an unpaid Zoho invoice with customer email and note the invoice number.
3. Visit `/pay/{invoiceNumber}` — status should be payable.
4. Click **Pay securely with Paystack** — confirm redirect to Paystack checkout.
5. Complete or cancel Paystack payment — Zoho invoice must **not** be marked paid yet.
6. Return URL should land on `/pay/{invoiceNumber}/success` placeholder.
7. Confirm a `zoho_invoice_payments` row exists with `status = pending_paystack` and Paystack reference.

## Booking Paystack metadata (Phase 1)

Booking initialize includes `metadata.source: "booking"`. Zoho initialize includes `metadata.source: "zoho_invoice"`.

## Phase 3 — Webhook routing + Zoho reconciliation (current)

When Paystack sends `charge.success` for a Zoho invoice payment, the webhook verifies the transaction, reconciles into Zoho, and marks the local row paid — idempotently under duplicate webhooks.

### Webhook routing model

After signature verification, `routePaystackWebhookEvent` dispatches by:

1. `metadata.source === "zoho_invoice"` → Zoho handler
2. `metadata.source === "booking"` → existing booking handler
3. Reference prefix `zi_` → Zoho handler
4. Reference prefix `bk_` → booking handler
5. Legacy fallback → booking handler (unchanged behavior)

Booking handlers still call `processPaystackChargeSuccess` / `processPaystackChargeFailure` unchanged.

### Table: `zoho_invoice_payment_events`

Migration: `supabase/migrations/20260701150000_zoho_invoice_payment_events.sql`

Stores webhook events with unique `provider_event_id` (e.g. `paystack:charge.success:{transactionId}`) for idempotency. RLS enabled, no public policies.

### Idempotency model

1. Insert `zoho_invoice_payment_events` — duplicate `provider_event_id` returns idempotent signal without failing webhook HTTP response.
2. If row is already `paid` with `zoho_payment_id`, skip Zoho payment creation.
3. Duplicate webhooks for the same Paystack transaction do not create duplicate Zoho customer payments.

### Amount / currency verification

Before calling Zoho:

1. `paystackVerifyTransaction(reference)` must return `status: success`.
2. Verified amount must equal `zoho_invoice_payments.amount_cents`.
3. Verified currency must match row currency (default `ZAR`).

Mismatch or definitive verify failure marks the row `zoho_reconcile_failed` or `zoho_reconcile_pending` (network/temporary verify errors) and **never** marks Zoho paid.

### Zoho customer payment creation

`createZohoCustomerPaymentForInvoice` in `src/lib/zoho/customerPayments.ts`:

- Creates Zoho Books customer payment with `payment_mode: "Paystack"`.
- Applies payment to the invoice via `invoices[]`.
- Uses Paystack reference as `reference_number`.
- On Zoho API failure after Paystack success, local row becomes `zoho_reconcile_pending` (recoverable on webhook replay).

### Success page + status API

- `GET /api/payments/zoho-invoice/status/{reference}` returns safe public status only.
- `/pay/{invoiceNumber}/success?reference=...` reads status and shows customer-safe messages:
  - **paid**: invoice marked paid
  - **zoho_reconcile_pending**: payment received, finalising receipt
  - **pending_paystack**: payment being confirmed
  - **failed**: payment not successful

No internal metadata, emails, or raw provider payloads are exposed.

### Phase 3 failure modes

| Condition | Local status | Zoho called? |
|-----------|--------------|--------------|
| Paystack verify network/API error | `zoho_reconcile_pending` | No |
| Verified status not success | `zoho_reconcile_failed` | No |
| Amount mismatch | `zoho_reconcile_failed` | No |
| Currency mismatch | `zoho_reconcile_failed` | No |
| Zoho API failure after verify success | `zoho_reconcile_pending` | Attempted |
| Paystack `charge.failed` | `failed` | No |

### Manual QA (Phase 3)

1. Apply migrations (`zoho_invoice_payments` + `zoho_invoice_payment_events`).
2. Configure Zoho + Paystack test env.
3. Create unpaid Zoho invoice with customer email.
4. Visit `/pay/{invoiceNumber}` and complete Paystack test payment.
5. Confirm webhook receives `charge.success`.
6. Confirm `zoho_invoice_payments` row becomes `paid` with `zoho_payment_id`.
7. Confirm `zoho_invoice_payment_events` row exists.
8. Confirm Zoho invoice/customer payment is created in Zoho Books.
9. Refresh `/pay/{invoiceNumber}/success?reference=...` — should show paid message.
10. Replay the same webhook — no duplicate Zoho payment should be created.
11. Test failed Paystack payment — Zoho must not be touched.

## Phase 4 — Reconciliation retry cron + admin diagnostics (current)

Recovers `zoho_reconcile_pending` rows after Paystack success and provides read-only admin visibility.

### Retry state machine

1. Row enters `zoho_reconcile_pending` (webhook or verify temporary failure / Zoho API failure).
2. Cron loads eligible rows (`next_reconcile_attempt_at` null or due, attempts &lt; 5).
3. Cron re-verifies Paystack, checks amount/currency, retries Zoho customer payment.
4. Success → `paid` with `zoho_payment_id`.
5. Temporary failure → increment `reconcile_attempts`, schedule `next_reconcile_attempt_at`.
6. Amount/currency mismatch → immediate `zoho_reconcile_failed`.
7. Attempt 5 failure → `zoho_reconcile_failed` (exhausted).

### Backoff schedule

| Attempt after failure | Next retry |
|-----------------------|------------|
| 1 | +5 minutes |
| 2 | +15 minutes |
| 3 | +1 hour |
| 4 | +6 hours |
| 5+ | Mark `zoho_reconcile_failed` |

Constants: `MAX_ZOHO_RECONCILE_ATTEMPTS = 5`, batch limit 25.

### Database retry fields

Migration: `supabase/migrations/20260701160000_zoho_invoice_reconciliation_retry_fields.sql`

- `reconcile_attempts`, `last_reconcile_attempt_at`, `next_reconcile_attempt_at`, `last_reconcile_error`
- Partial index on `zoho_reconcile_pending` for cron scans

### Cron route

`POST/GET /api/cron/reconcile-zoho-invoice-payments`

- Requires `Authorization: Bearer $CRON_SECRET` or `x-cron-secret` header (same as other crons).
- Calls `retryZohoInvoiceReconciliation`.
- Returns safe summary: `{ ok, scanned, retried, paid, pending, failed, skipped, errors }`.

### Admin diagnostics

- API: `GET /api/admin/zoho-invoice-payments/diagnostics` (admin session required).
- UI: `/admin/operations/zoho-payments` (read-only).
- Shows status counts, problematic payments, retry timing, masked customer email, safe last error.
- Does **not** expose metadata, access codes, authorization URLs, or raw provider payloads.

### Operational runbook

1. Check `/admin/operations/zoho-payments` for `zoho_reconcile_pending` / `zoho_reconcile_failed` counts.
2. For pending rows, confirm cron job is scheduled and `CRON_SECRET` is configured.
3. Invoke cron manually with valid secret if needed.
4. If Zoho API was down, restore service and wait for next retry window (or invoke cron).
5. If row is `zoho_reconcile_failed` with amount/currency mismatch, investigate Paystack vs Zoho invoice balance manually.
6. Customer success page at `/pay/{invoiceNumber}/success?reference=...` reflects final status.

### Manual QA (Phase 4)

1. Force Zoho API failure after Paystack success → row becomes `zoho_reconcile_pending`.
2. Run cron with valid auth → `reconcile_attempts` increments, `next_reconcile_attempt_at` set.
3. Restore Zoho API, run cron again → row becomes `paid`.
4. Confirm Zoho customer payment exists (no duplicate on replay).
5. Confirm `/admin/operations/zoho-payments` shows correct counts.
6. Confirm customer success page moves from pending to paid.

## Phase 5 — Admin workflow polish + payment link helper (current)

Improves the manual admin workflow after Zoho invoice Paystack checkout and reconciliation are live. No customer payment behavior changes, no Zoho write automation, and no booking checkout changes.

### Manual admin workflow

1. Create invoice in Zoho Books.
2. Copy the invoice number (for example `INV-001602`).
3. Open `/admin/operations/zoho-payments`.
4. Paste the invoice number into **Payment link helper** and click **Generate payment link**.
5. Copy the generated link (for example `https://www.shalean.com/pay/INV-001602`).
6. Paste the link into the Zoho invoice note or a customer email/WhatsApp message (use the copyable templates on the same page).
7. Customer pays through the Shalean `/pay/{invoiceNumber}` page.
8. Monitor payment health in the diagnostics table on the same admin page.

Optional: click **Check invoice** before sending the link to confirm customer name, amount due, status, due date, and whether the invoice can be paid now.

### Payment link format

```
{APP_BASE_URL}/pay/{normalizedInvoiceNumber}
```

- Uses `resolveNotificationAppBaseUrl()` (prefers canonical production origin when deployed).
- Invoice numbers are validated and normalized to uppercase (for example `inv-001602` → `INV-001602`).
- No Zoho fetch is required to generate the link.

### Admin routes

| Route | Method | Auth | Responsibility |
|-------|--------|------|----------------|
| `/admin/operations/zoho-payments` | GET | Admin session | Link helper, templates, diagnostics UI |
| `/api/admin/zoho-invoice-payments/link-helper` | GET | Admin API | Generate payment link from invoice number |
| `/api/admin/zoho-invoice-payments/check-invoice` | GET | Admin API | Safe read-only Zoho invoice summary |
| `/api/admin/zoho-invoice-payments/diagnostics` | GET | Admin API | Read-only payment health JSON |

Link helper response:

```json
{
  "ok": true,
  "invoiceNumber": "inv-001602",
  "normalizedInvoiceNumber": "INV-001602",
  "paymentLink": "https://www.shalean.com/pay/INV-001602"
}
```

Check invoice response (safe fields only — no raw Zoho payload or full customer email):

```json
{
  "ok": true,
  "invoiceNumber": "INV-001602",
  "customerName": "Jane Doe",
  "amountDueDisplay": "R100.00",
  "currency": "ZAR",
  "dueDate": "2026-06-01",
  "status": "payable",
  "canPayNow": true
}
```

### Zoho invoice note template

```
Pay securely online:
{{payment_link}}

Please use your invoice number as reference.
```

### Customer email template

**Subject:** Invoice payment link from Shalean Cleaning Services

**Message:**

```
Hello {{customer_name}},

Thank you for choosing Shalean Cleaning Services.

You can pay your invoice securely online using the link below:

{{payment_link}}

Invoice number: {{invoice_number}}
Amount due: {{amount_due}}

Once payment is complete, your invoice will be updated automatically.

Kind regards,
Shalean Cleaning Services
```

Shalean does **not** send these emails or write to Zoho automatically in Phase 5. Admins copy the templates from the admin page.

### Diagnostics polish

Each payment row includes:

- **Copy payment link** — copies `{APP_BASE_URL}/pay/{invoiceNumber}` for customer follow-up.
- **Open customer page** — opens the public payment page in a new tab.
- Status helper text:
  - `pending_paystack` — Customer started checkout but payment is not confirmed yet.
  - `paid` — Payment confirmed and Zoho reconciliation completed.
  - `failed` — Paystack payment failed.
  - `zoho_reconcile_pending` — Paystack payment succeeded; Zoho reconciliation is retrying.
  - `zoho_reconcile_failed` — Paystack payment succeeded but Zoho reconciliation needs admin review.

Empty state: **No Zoho invoice payment issues found.**

No mutation buttons (no manual retry, mark-paid, or force reconcile on this page).

### What admins should do in Zoho

- Create and send the invoice as usual.
- Add the Shalean payment link to invoice notes or customer messages.
- Confirm the invoice balance and status match what **Check invoice** shows in Shalean before sharing the link.

### What admins should check in Shalean

- Payment link helper generates the expected `/pay/{invoiceNumber}` URL.
- Optional **Check invoice** shows payable status and correct amount due.
- Diagnostics table shows no stuck `zoho_reconcile_failed` rows after customer payment.
- Customer success page reflects final paid status.

### Troubleshooting

| Symptom | Likely cause | Admin action |
|---------|--------------|--------------|
| Invalid invoice number | Format rejected by validation | Use Zoho invoice number exactly (letters, digits, hyphen, underscore) |
| Check invoice → not configured | Zoho env missing/disabled | Fix Zoho OAuth env vars |
| Check invoice → not found | Wrong invoice number or deleted invoice | Verify number in Zoho Books |
| Customer paid but Zoho still unpaid | Reconciliation pending/failed | Check diagnostics; wait for cron or investigate safe last error |
| Link helper base URL missing | `APP_BASE_URL` / site origin not configured | Fix deployment env |

### Observability (Phase 5)

Logger namespace: `payments:zoho-invoice`

New events:

- `zoho_invoice_admin_link_generated`
- `zoho_invoice_admin_link_invalid`
- `zoho_invoice_admin_invoice_checked`
- `zoho_invoice_admin_invoice_check_failed`

Same redaction rules as earlier phases (no tokens, no raw Zoho payloads, masked emails).

### Future phase: Zoho invoice note automation

Not implemented in Phase 5. A later phase could update admin-created Zoho invoices through the Zoho API to append the Shalean payment link automatically. That requires:

- A safe Zoho invoice update utility (scoped field writes only).
- Audit logging for every write.
- Idempotency (do not append duplicate links on retry).

Until then, admins copy links and templates manually from `/admin/operations/zoho-payments`.

### Manual QA (Phase 5)

1. Open `/admin/operations/zoho-payments` as admin.
2. Enter a valid Zoho invoice number → generate link → copy and open in new tab.
3. Confirm `/pay/{invoiceNumber}` loads for that invoice.
4. Click **Check invoice** → confirm safe summary (no raw Zoho JSON).
5. Copy Zoho note and email templates with populated placeholders after link generation.
6. Confirm diagnostics rows show copy/open actions and status helper text.
7. Confirm no retry or mark-paid buttons exist on the page.
8. Confirm existing Paystack initialize, webhook, reconciliation, and booking tests still pass.

## Phase 6 — Production readiness audit

See [Zoho invoice production readiness audit](./zoho-invoice-production-readiness-audit.md) for:

- Environment, Paystack, Zoho, cron, admin, and security findings
- Blocking vs non-blocking issues
- Live-mode QA checklist
- Rollback plan and monitoring checklist

## Phase 7 — Customer consent + reusable authorization capture

Captures reusable Paystack authorization details after successful Zoho invoice payment when the customer explicitly opts in.

### Consent model

On `/pay/{invoiceNumber}` (payable state), customers see an optional checkbox (unchecked by default):

> I authorise Shalean Cleaning Services to securely save my payment method and charge it for future approved invoices or recurring cleaning services.

- Payment works with or without the checkbox.
- Consent text version: `2026-05-22` (`ZOHO_INVOICE_SAVE_PAYMENT_METHOD_CONSENT_VERSION`).
- Consent is stored on `zoho_invoice_payments.metadata` only when checked.
- Paystack initialize metadata includes `save_payment_method_requested` and `consent_text_version` when checked.

Initialize request body:

```json
{
  "invoiceNumber": "INV-001602",
  "savePaymentMethodConsent": true
}
```

Amount and email still come from Zoho/server only.

### Authorization capture flow

After Paystack verify succeeds in `processZohoInvoiceChargeSuccess`:

1. If `metadata.save_payment_method_requested !== true` → skip.
2. Read verified Paystack `authorization` object.
3. Require `authorization.reusable === true` and `authorization_code`.
4. Insert into `zoho_invoice_payment_methods` (idempotent by `authorization_code`).
5. Set as default if customer has no active default.
6. **Capture failure never fails invoice payment** — Zoho reconciliation continues.

Outcomes stored on payment metadata as `authorization_capture_outcome`:
`not_requested` | `saved` | `not_reusable` | `missing_authorization_code` | `failed`

### Database: `zoho_invoice_payment_methods`

Migration: `supabase/migrations/20260701170000_zoho_invoice_payment_methods.sql`

Stores:
- `authorization_code`, `authorization_signature`, `paystack_customer_code`
- Safe card metadata: `card_type`, `bank`, `last4`, `exp_month`, `exp_year`
- Consent audit: `consent_text_version`, `consented_at`
- Source linkage: `source_invoice_number`, `source_zoho_invoice_payment_id`

Never stores: full card number, CVV.

RLS enabled, no public policies, service-role only.

### Customer success page

When payment is `paid`:
- Saved: “Your payment method was saved for future approved Shalean invoices.”
- Not reusable: “Payment successful. This card could not be saved for future use.”

### Admin diagnostics

`/admin/operations/zoho-payments` includes read-only **Saved payment methods** summary:
- Active count, latest consent date
- Masked card display (e.g. Visa ending 1234)
- Active/revoked status

Optional API: `GET /api/admin/zoho-invoice-payments/payment-methods?customerEmail=...`

Safe DTO only — **no `authorization_code`**.

### Observability

New logger events:
- `zoho_invoice_save_method_consent_requested`
- `zoho_invoice_authorization_capture_started` / `_succeeded` / `_failed`
- `zoho_invoice_authorization_capture_skipped_not_requested` / `_skipped_not_reusable`
- `zoho_invoice_payment_method_saved` / `_duplicate`

Redacts: `authorization_code`, emails, raw Paystack authorization payloads.

## Phase 8 — Admin-initiated saved-card invoice charges

Allows admins to charge a customer’s saved reusable Paystack authorization for an unpaid Zoho invoice balance.

**Not included:** automatic recurring billing, subscription billing, customer card self-management, arbitrary custom amounts, admin force-mark-paid, charging without a Zoho invoice, booking checkout changes.

### Workflow

1. Customer pays an invoice and opts in to save their card (Phase 7).
2. Admin opens `/admin/operations/zoho-payments`, enters invoice number, clicks **Check invoice**.
3. If the invoice is payable and matching saved methods exist, the **Charge saved card** section appears.
4. Admin selects a saved method, enters a required reason, clicks **Review charge**.
5. Confirmation modal shows invoice, customer, Zoho amount, card ending, and reason.
6. Admin types `CHARGE INVOICE` and submits.
7. Server calls Paystack `POST /transaction/charge_authorization` with live Zoho balance only.
8. Webhook verifies Paystack, creates Zoho customer payment, marks charge paid.

### Consent and safety

- Only reusable methods saved with explicit customer consent may be charged.
- Customer email on the saved method must match the invoice customer email (normalized).
- No custom amount field — amount always comes from live Zoho balance.
- `authorization_code` never exposed to browser or admin API responses.
- Admin must provide reason (≥10 chars) and exact confirmation phrase `CHARGE INVOICE`.

### Database

- `zoho_invoice_authorization_charges` — charge attempts with partial unique index preventing multiple active charges per invoice.
- `zoho_invoice_authorization_charge_events` — webhook idempotency log.
- Paystack references use `zia_` prefix.

### APIs

- `GET /api/admin/zoho-invoice-payments/eligible-payment-methods?invoiceNumber=...`
- `POST /api/admin/zoho-invoice-payments/charge-saved-card`

### Webhook routing

- `metadata.source === "zoho_invoice_authorization_charge"` or reference prefix `zia_` → authorization charge handlers.
- `zia_` is checked **before** `zi_` because `zia_` starts with `zi_`.

### Failure handling

- Paystack failure → charge marked `failed`, Zoho never called.
- Paystack success + Zoho failure → `zoho_reconcile_pending` with cron retry (same backoff as customer checkout).
- Duplicate webhook → idempotent; no duplicate Zoho payment if `zoho_payment_id` already set.

### Observability events

- `zoho_invoice_admin_charge_started` / `_blocked` / `_submitted` / `_failed`
- `zoho_invoice_authorization_charge_webhook_routed`
- `zoho_invoice_authorization_charge_verify_succeeded` / `_failed`
- `zoho_invoice_authorization_charge_reconciled` / `_reconcile_failed`

Redacts: `authorization_code`, customer email, raw Paystack/Zoho payloads.

### Manual QA (Phase 8)

1. Customer pays invoice and saves method.
2. Create new unpaid invoice for same customer.
3. Admin checks invoice on Zoho payments page.
4. Admin selects saved method, enters reason, types `CHARGE INVOICE`, submits.
5. Confirm Paystack charge succeeds.
6. Confirm webhook marks charge paid.
7. Confirm Zoho customer payment is created.
8. Confirm duplicate webhook does not duplicate Zoho payment.
9. Confirm failed card does not mark Zoho paid.

## Phase 9 — Customer and admin payment method management (current)

Customers and admins can view and revoke saved payment methods. Revoked methods cannot be charged.

**Not included:** automatic recurring billing, subscription billing, customer-initiated charges, custom amounts, force-mark-paid, booking checkout changes.

### Customer experience

- Page: `/customer/payment-methods`
- API: `GET /api/customer/payment-methods`
- Revoke: `POST /api/customer/payment-methods/[paymentMethodId]/revoke` with optional `reason`
- Scoped to the signed-in customer’s normalized auth email
- Safe DTO only (no `authorization_code`, full card number, or CVV)

**Revoke confirmation copy:** Removing a method means Shalean can no longer charge it for approved invoices or recurring services; a new method can be saved during a future payment.

### Admin experience

- Section on `/admin/operations/zoho-payments`: search by customer email, filter active/revoked/all
- `GET /api/admin/zoho-invoice-payments/payment-methods?customerEmail=&status=&limit=`
- Revoke: `POST /api/admin/zoho-invoice-payments/payment-methods/[paymentMethodId]/revoke`
  - Required `reason` (≥10 chars)
  - Required confirmation phrase: `REVOKE PAYMENT METHOD`

**Admin revoke warning:** Revoking only removes Shalean’s ability to charge the saved authorization; it does not refund or cancel existing invoices.

### Database

Migration: `supabase/migrations/20260701190000_zoho_invoice_payment_method_management.sql`

**Added columns on `zoho_invoice_payment_methods`:**
- `revoke_reason`, `revoked_by_user_id`, `revoked_by_admin_id`
- `revocation_source` (`customer` | `admin` | `system`)
- `last_used_at`, `last_used_invoice_number`

**Audit table:** `zoho_invoice_payment_method_audit` — action, actor_type, actor_id, reason, metadata.

### Revocation rules

- Sets `revoked_at` and clears `is_default`
- Promotes another active reusable method to default, or leaves none
- Idempotent if already revoked
- Records audit row for every revocation

### Charge safety (Phase 8 integration)

- Admin charge blocks `revoked_at`, non-reusable, expired cards, and email mismatch
- `last_used_at` / `last_used_invoice_number` updated after successful admin charge submit and when webhook marks charge paid

### Observability

- `zoho_invoice_payment_methods_listed`
- `zoho_invoice_payment_method_revoke_started` / `_revoked` / `_revoke_failed`
- `zoho_invoice_payment_method_audit_recorded`
- `zoho_invoice_payment_method_last_used_updated`

### Manual QA (Phase 9)

1. Customer saves payment method (Phase 7).
2. Customer opens `/customer/payment-methods`.
3. Customer revokes method via confirmation modal.
4. Admin tries Phase 8 charge with revoked method → blocked.
5. Customer saves new method on a future invoice payment.
6. Admin searches by email, sees active method, charges invoice (Phase 8).
7. Admin revokes method with reason + `REVOKE PAYMENT METHOD`.
8. Confirm `zoho_invoice_payment_method_audit` row exists.

## Phase 10: Payment governance + launch lock

Production hardening before using saved-card and admin-charge flows at scale.

### Feature flags (server-only)

| Variable | Default | Production recommendation |
|----------|---------|---------------------------|
| `ZOHO_INVOICE_PAYMENTS_ENABLED` | `true` | `true` after Zoho/Paystack QA |
| `ZOHO_SAVED_METHODS_ENABLED` | `true` | `true` only after save-card QA |
| `ZOHO_ADMIN_CARD_CHARGES_ENABLED` | `false` | `true` only after final sign-off |

**When `ZOHO_INVOICE_PAYMENTS_ENABLED=false`:**

- `/pay/[invoiceNumber]` shows a safe unavailable state
- `POST /api/paystack/initialize-zoho-invoice` is blocked
- Admin link helper may still generate URLs (no Zoho charge)

**When `ZOHO_SAVED_METHODS_ENABLED=false`:**

- Save-card consent checkbox is hidden on `/pay`
- Reusable authorization capture is skipped after Paystack verify
- `/customer/payment-methods` shows unavailable (admin view/revoke still works)

**When `ZOHO_ADMIN_CARD_CHARGES_ENABLED=false`:**

- Admin “Charge saved card” UI is disabled with explanation
- `POST /api/admin/zoho-invoice-payments/charge-saved-card` returns HTTP 403
- Stored methods remain viewable and revocable

Implementation: `src/features/zoho-invoice-payments/server/zohoPaymentLaunchGuard.ts`

### Recommended production rollout

1. Enable invoice payments (`ZOHO_INVOICE_PAYMENTS_ENABLED=true`) — manual Paystack checkout only
2. QA save-card consent + capture; enable `ZOHO_SAVED_METHODS_ENABLED=true`
3. QA admin charge flow with reason + `CHARGE INVOICE`; enable `ZOHO_ADMIN_CARD_CHARGES_ENABLED=true`
4. Monitor daily checks on `/admin/operations/zoho-payments`

### Admin launch status panel

`/admin/operations/zoho-payments` shows:

- Feature flag states (invoice payments, saved methods, admin charges)
- Paystack mode (test/live from `sk_test_` / `sk_live_` prefix only — no keys exposed)
- Zoho configured, cron secret, webhook checklist
- Last reconcile cron run (from `zoho_invoice_payment_cron_runs`)

### Payment audit export

`GET /api/admin/zoho-invoice-payments/audit-export?format=csv|json`

Admin-only. Safe fields only: invoice number, status, amounts, timestamps, admin id, action, reason, masked card, Paystack reference. **Never** includes `authorization_code`, `access_code`, `authorization_url`, or raw metadata.

### Daily payment checks

Read-only counts on the admin page:

- Reconciliation failed / pending (invoice payments)
- Failed admin card charges
- Failed invoice payments
- Revoked methods (audit)

### Cron run tracking

Migration: `supabase/migrations/20260701200000_zoho_invoice_payment_cron_runs.sql`

`reconcile-zoho-invoice-payments` cron records `started` / `completed` / `failed` with a safe JSON summary (no secrets or raw errors).

### Emergency disable procedure

**Stop invoice payments:**

```bash
ZOHO_INVOICE_PAYMENTS_ENABLED=false
```

**Stop saved methods (consent + capture + customer page):**

```bash
ZOHO_SAVED_METHODS_ENABLED=false
```

**Stop admin saved-card charges:**

```bash
ZOHO_ADMIN_CARD_CHARGES_ENABLED=false
```

Redeploy or restart the app so server env is picked up. Existing saved methods and payment history remain in the database.

**Paystack-side (only if needed):** disable the webhook endpoint or rotate keys — use only when Paystack itself must be halted independently of Shalean flags.

## Phase 11: Customer payment history

Read-only customer view of booking payments, manual Zoho invoice checkout payments, and admin-approved saved-card invoice charges.

### Route

| Route | Method | Auth | Responsibility |
|-------|--------|------|----------------|
| `/customer/payments` | GET | Customer | Payment history page |
| `/api/customer/payment-history` | GET | Customer | Safe union read model with filters + cursor pagination |

### Data sources

| Source | Table(s) | Customer scope |
|--------|----------|------------------|
| Booking | `bookings` → `payments` | Bookings owned by authenticated customer (`actingCustomerId` + RLS) |
| Zoho invoice checkout | `zoho_invoice_payments` | Rows where `customer_email` matches authenticated email (normalized) |
| Saved-card invoice charge | `zoho_invoice_authorization_charges` + masked method join | Rows where `customer_email` matches authenticated email (normalized) |

Implementation: `src/features/customer-payments/server/customerPaymentHistory.ts`

### Safe status mapping

Internal statuses are mapped to customer-facing values only:

| Customer status | Booking | Zoho invoice checkout | Saved-card charge |
|-----------------|---------|----------------------|-------------------|
| **paid** | `paid` | `paid` | `paid` |
| **pending** | `pending`, `initialized` | `pending_paystack`, `zoho_reconcile_pending`, `initialized` | `initialized`, `submitted`, `pending_webhook`, `zoho_reconcile_pending` |
| **failed** | `failed`, `refunded` | `failed`, `zoho_reconcile_failed`, `cancelled` | `failed`, `zoho_reconcile_failed` |

Mapper: `src/features/customer-payments/server/mapCustomerPaymentStatus.ts`

Labels (`Paid`, `Pending`, `Failed`) match admin diagnostics wording for consistency.

### Privacy rules — customers can see

- Payment title, amount, currency, normalized status
- Invoice number or booking reference (Paystack reference where applicable)
- Paid date or created date
- Safe payment method label:
  - Booking: `Online payment`
  - Zoho checkout: `Paystack checkout`
  - Saved-card charge: masked card label only (e.g. `Visa ending 1234`)
- Action links:
  - Booking → `/customer/bookings/{bookingId}`
  - Invoice / saved-card charge → `/pay/{invoiceNumber}`

### Privacy rules — customers cannot see

- `authorization_code`, `access_code`, `authorization_url`
- Admin charge/revoke reasons
- Raw metadata or provider payloads
- Internal reconciliation errors or retry fields
- Other customers’ payment rows

### API query params

- `source`: `all` | `booking` | `zoho_invoice` | `saved_card_invoice` (default `all`)
- `status`: `all` | `paid` | `pending` | `failed` (default `all`)
- `limit`: 1–50 (default 20)
- `cursor`: opaque pagination token

Response: `{ ok: true, items: CustomerPaymentHistoryItem[], nextCursor?: string | null }`

### Not implemented (Phase 11)

- Refunds display
- Downloadable PDF receipts
- Customer-initiated saved-card charges
- Any payment mutations from the history view

### Future: receipts / downloads

A later phase may add read-only PDF receipt downloads per payment row, generated from the same safe DTO (no secrets). Until then, customers use action links to view booking or invoice context.

## Phase 12: Shalean sales → Zoho accounting sync

Shalean remains the operational system; Zoho Books is the accounting record.

### Architecture

| Layer | Role |
|-------|------|
| Shalean bookings / payments | Operational truth — checkout, dispatch, customer UX |
| `zoho_sales_sync` | Idempotent sync queue + Zoho IDs |
| Zoho Books | Invoice + customer payment for accounting |

### Feature flag

| Variable | Default | Notes |
|----------|---------|-------|
| `ZOHO_SALES_SYNC_ENABLED` | `false` | Enable only after Zoho Books QA |

When disabled:
- Booking payment finalization is unchanged
- Manual Zoho invoice Paystack checkout is unchanged
- Cron returns empty summary

Implementation: `src/features/zoho-sales-sync/server/zohoSalesSyncLaunchGuard.ts`

### Sales sources

| Source | `source_type` | Zoho behavior |
|--------|---------------|---------------|
| Online booking payment | `booking` | Create Zoho customer (if needed), invoice, customer payment |
| Manual Zoho invoice checkout | `zoho_invoice_payment` | Registry row only — **no duplicate invoice** |
| Admin saved-card charge | `zoho_authorization_charge` | Registry row only — **no duplicate invoice** |

### Booking paid → Zoho sync

After successful `finalizePaidBooking`:
1. Best-effort `runPostPaymentZohoSalesSync` (try/catch — payment stays finalized)
2. Enqueue `zoho_sales_sync` row (`source_type=booking`, `source_id=booking_id`)
3. Attempt sync once inline; failures remain `pending` for cron retry

Zoho invoice flow:
1. Find/create customer by email (`src/lib/zoho/customers.ts`)
2. Create invoice with reference `SHALEAN-BKG-{bookingId}` (`src/lib/zoho/sales.ts`)
3. Mark invoice sent
4. Create Zoho customer payment (Paystack reference)

### Idempotency

- Unique `(source_type, source_id)` — one sync row per sale
- If `sync_status=synced`, skip
- If `zoho_invoice_id` exists on sync row, update/check instead of creating
- Lookup existing Zoho invoice by `reference_number` before create
- Manual Zoho invoice rows never call invoice create

### Retry strategy

Cron: `GET|POST /api/cron/sync-shalean-sales-to-zoho` (requires `CRON_SECRET`)

- Picks `pending` rows where `next_sync_attempt_at` is null or due
- Backoff: 5m → 15m → 1h → 6h (max 5 attempts)
- Exhausted rows → `sync_status=failed`
- Safe JSON summary only (counts, no secrets)

Also registers existing paid `zoho_invoice_payments` / `zoho_invoice_authorization_charges` for unified diagnostics.

### Admin diagnostics

`/admin/operations/zoho-sales-sync` — read-only:

- Pending / synced / failed counts
- Source type, booking or invoice reference, amount
- Sync attempts, next retry, safe last error
- Zoho invoice id when available

No destructive actions in Phase 12.

### Not synced yet (Phase 12)

- Refunds / credit notes
- Automatic recurring billing invoices
- Zoho write-back to Shalean booking records
- Customer-facing Zoho receipt downloads

### Future: refunds / credit notes

A later phase may create Zoho credit notes linked to original `zoho_sales_sync` rows when Shalean processes refunds.

## Phase 13: Refunds, cancellations, and Zoho credit notes

Accounting-safe handling for refunds and cancellations. Shalean remains the operational source of truth; Zoho Books receives credit notes (and optional refund records) for paid amounts that were reversed.

**Feature flag:** `ZOHO_REFUND_CREDIT_SYNC_ENABLED=false` (default off until QA). When disabled, no Zoho credit sync runs and booking cancellation/refund behavior is unchanged.

**Paystack money movement:** Phase 13A is Zoho accounting only. Paystack refunds remain manual from the Paystack dashboard. Shalean does not call Paystack refund APIs.

### Accounting model

| Event | `source_type` | Zoho action |
|-------|---------------|-------------|
| Paid booking cancelled | `booking_cancellation` | Credit note applied to original invoice |
| Booking refund registered | `booking_refund` | Credit note applied to original invoice |
| Manual Zoho invoice payment refunded | `zoho_invoice_refund` | Credit note on linked Zoho invoice |
| Admin saved-card charge refunded | `zoho_authorization_charge_refund` | Credit note on linked Zoho invoice |

Original invoices are **not** voided or deleted. Credit notes reduce the accounting balance.

### Queue table

`public.zoho_refund_credit_sync` — idempotent by `(source_type, source_id)`. Tracks amount, reason, Zoho credit note id, retry state, and safe errors. Service-role only (RLS, no public policies).

### Manual Paystack refund workflow

1. Admin processes refund in Paystack dashboard.
2. Admin registers credit in Shalean: `POST /api/admin/zoho-sales-sync/register-refund-credit` with `confirmPhrase: "REGISTER CREDIT"`.
3. Shalean enqueues `zoho_refund_credit_sync` and creates the Zoho credit note asynchronously.
4. Admin monitors `/admin/operations/zoho-refunds`.

Registration validates amount ≤ original paid total and requires a reason. It does **not** move money.

### Booking cancellation hook

After successful `CANCEL_BOOKING`, a best-effort non-blocking hook enqueues credit sync when:

- Booking had a paid payment
- A Zoho sales sync row exists (or `zoho_invoice_id` is known)
- Feature flag is enabled

Cancellation never depends on Zoho success.

### Zoho credit note API

`src/lib/zoho/creditNotes.ts`:

1. `createZohoCreditNoteForInvoice` — creates credit note with `SHALEAN-CR-{reference}` reference
2. `applyZohoCreditNoteToInvoice` — applies credit to the original invoice
3. `recordZohoRefundForCreditNote` — optional accounting refund record when Paystack reference is known

Amounts are converted from cents to decimal Rand.

### Retry cron

`GET|POST /api/cron/sync-zoho-refunds-credits` (requires `CRON_SECRET`)

- Retries `pending` rows where `next_sync_attempt_at` is null or due
- Backoff: 5m → 15m → 1h → 6h (max 5 attempts)
- Exhausted rows → `sync_status=failed`
- Safe JSON summary only

### Admin diagnostics

`/admin/operations/zoho-refunds` — read-only:

- Pending / synced / failed counts
- Source type, booking or invoice reference, amount, reason
- Sync attempts, next retry, safe last error
- Zoho credit note id when available

No destructive actions.

### Limitations (Phase 13)

- No automatic Paystack refunds
- No customer self-service refunds
- No invoice void/delete
- No changes to successful payment finalization
- Duplicate credit notes prevented by unique `(source_type, source_id)` only — partial refunds use distinct source ids

## Phase 14: Finance reconciliation dashboard

Read-only admin dashboard comparing Shalean operational payments, Paystack processor status, and Zoho accounting records in one place.

**Page:** `/admin/operations/finance-reconciliation`  
**API:** `GET /api/admin/finance/reconciliation`  
**Export:** `GET /api/admin/finance/reconciliation/export?format=csv`

### Purpose

Give finance/admin a single view to identify mismatches across:

1. Shalean operational payments (bookings, invoice checkouts, saved-card charges, refunds)
2. Paystack processor status
3. Zoho accounting records (sales sync, invoice payments, credit notes)

The dashboard does **not** mutate payments, force mark-paid, edit balances, or change booking lifecycle.

### Reconciliation sources

| Source | Tables | Matched when |
|--------|--------|--------------|
| Booking payments | `payments`, `zoho_sales_sync` | Paid + Zoho invoice & payment ids synced |
| Zoho invoice checkout | `zoho_invoice_payments` | Paid + `zoho_payment_id` |
| Saved-card charges | `zoho_invoice_authorization_charges` | Paid + `zoho_payment_id` |
| Refunds / credit notes | `zoho_refund_credit_sync` | Synced + `zoho_credit_note_id` |

### Reconciliation statuses

- **matched** — Shalean, Paystack, and Zoho align
- **pending** — Awaiting processor or sync (e.g. Paystack pending, Zoho sync pending)
- **mismatch** — Paid in Shalean but accounting record missing or amount differs
- **failed** — Processor or sync exhausted retries

### Issue codes

Defined in `src/features/finance-reconciliation/server/financeReconciliationIssueCodes.ts`:

`MATCHED`, `MISSING_ZOHO_SYNC`, `ZOHO_SYNC_PENDING`, `ZOHO_SYNC_FAILED`, `MISSING_ZOHO_PAYMENT_ID`, `PAYSTACK_PENDING`, `PAYSTACK_FAILED`, `AMOUNT_MISMATCH`, `CREDIT_NOTE_PENDING`, `CREDIT_NOTE_FAILED`, `CREDIT_NOTE_MISSING_ID`

Each code includes a label, severity, and action hint pointing to the correct diagnostics page or external system.

### Filters

- Date range (`from`, `to`)
- Source: all, booking, zoho_invoice, saved_card_invoice, refund_credit
- Status: all, matched, pending, mismatch, failed
- Pagination via `cursor` + `limit` (max 200)

### Export

CSV export uses the same filters. Safe fields only — no customer full email, authorization codes, access codes, raw metadata, or provider payloads.

### Daily finance workflow

1. Open `/admin/operations/finance-reconciliation`.
2. Set date range to yesterday/today.
3. Review **failed** and **mismatch** items first.
4. Review **pending** items older than 30 minutes.
5. Export report if needed (`Export CSV` button).
6. Resolve issues in the correct source system:
   - Paystack dashboard for failed processor payments
   - Zoho Books / Zoho diagnostics for accounting sync failures
   - Shalean retry queues (`/admin/operations/zoho-sales-sync`, `/admin/operations/zoho-payments`, `/admin/operations/zoho-refunds`)

### What the dashboard does not do

- Automatic refunds
- Payment mutations or force mark-paid
- Manual balance edits
- Deleting payments
- Booking lifecycle changes

## Phase 15: Accounting period closing + settlement reports

Read-only weekly/monthly finance closing reports summarising booking payments, Zoho invoice payments, saved-card charges, refunds/credit notes, and reconciliation status for safe period-end close.

**Page:** `/admin/operations/accounting-close`  
**API:** `GET /api/admin/finance/accounting-close`  
**Detail export:** `GET /api/admin/finance/accounting-close/export?format=csv`  
**Summary export:** `GET /api/admin/finance/accounting-close/summary-export?format=csv`

### Purpose

Give admin/finance a period-closing dashboard and export so Shalean can close weekly/monthly finance periods safely. This phase does **not** mutate payments, automate refunds, force mark-paid, submit tax filings, or perform bank reconciliation.

### Period filters

- **periodType:** `weekly`, `monthly`, or `custom`
- **Date range:** `from`, `to` (for custom, or to anchor weekly/monthly bounds)
- **Source:** all, booking, zoho_invoice, saved_card_invoice, refund_credit
- **limit:** max line items returned (default 50, max 200)

Weekly periods run Monday–Sunday (UTC). Monthly periods use calendar month bounds (UTC).

### Summary metrics

| Metric | Meaning |
|--------|---------|
| Gross sales | Sum of booking + invoice + saved-card amounts (excludes refunds) |
| Refunds / credits | Sum of refund/credit note amounts |
| Net sales | Gross sales − refunds/credits |
| Matched / pending / failed / mismatch | Amounts by reconciliation status (signed) |
| Ready to close | `true` when no blocking issues |

Refunds/credits appear as **negative signed amounts** in detail exports.

### Close readiness rules

Defined in `src/features/accounting-close/server/accountingCloseReadiness.ts`. A period is **not** ready to close when:

- Any item has reconciliation status **mismatch**
- Any item has reconciliation status **failed**
- Any **pending** item is older than **30 minutes**
- Any refund/credit sync failed (`CREDIT_NOTE_FAILED`)
- Any Zoho sales sync failed (`ZOHO_SYNC_FAILED`)

Blocking issues are surfaced as human-readable messages (e.g. “2 reconciliation mismatches”, “1 refund credit failed”).

### Exports

**Detail CSV** columns: period, source, reference, invoice number, booking id, amount, signed amount, status, reconciliation status, issue code, created at, paid at, synced at.

**Summary CSV** columns: period bounds, gross/net/refund totals, reconciliation amounts, transaction counts, ready-to-close flag, blocking issues.

No secrets, customer emails, authorization codes, or raw metadata in exports.

### Daily / weekly / monthly workflow

1. Open `/admin/operations/accounting-close`.
2. Select period type and date range.
3. Review the ready / not-ready banner.
4. Resolve failed/mismatch items in `/admin/operations/finance-reconciliation`.
5. Export detail CSV for transaction-level records.
6. Export summary CSV for period totals.
7. Attach reports to finance records if needed.

### Future: immutable close records

Phase 15 is read-only reporting only. A future `accounting_period_closures` table could store immutable snapshots when finance formally locks a period. Not implemented in Phase 15.

## Phase 16: VAT / tax reporting exports

Read-only VAT and sales tax reporting for admin/finance, built on matched finance data from Phases 14–15.

**Page:** `/admin/operations/tax-reports`  
**API:** `GET /api/admin/finance/tax-reports`  
**Detail export:** `GET /api/admin/finance/tax-reports/export?format=csv`  
**Summary export:** `GET /api/admin/finance/tax-reports/summary-export?format=csv`

### Purpose

Provide safe VAT/tax export dashboards for accountants. This is **not** SARS submission automation, tax advice, or VAT registration workflow.

**Disclaimer (shown in UI and docs):** This report is for internal accounting support and should be reviewed by your accountant before tax filing.

### VAT configuration

| Variable | Default | Effect |
|----------|---------|--------|
| `SHALEAN_VAT_REGISTERED` | `false` | When false, UI shows “VAT not enabled”; exports show gross sales only with VAT columns as zero / not applicable |
| `SHALEAN_VAT_RATE` | `15` | VAT percentage used when registered |

Config module: `src/features/tax-reports/server/shaleanVatConfig.ts`

### Inclusive VAT formula

When VAT is registered, output VAT is estimated using the **inclusive** formula:

```
VAT = gross × rate / (100 + rate)
net excluding VAT = gross − VAT
```

Example: R115 gross at 15% → R15 VAT, R100 net excluding VAT.

Refunds/credits use **negative signed amounts**, producing negative VAT adjustments.

Calculator: `src/features/tax-reports/server/vatCalculator.ts`

### Data rules

- **Default:** only **matched** (paid/synced) finance items from booking payments, Zoho invoice checkout, saved-card charges, and refund/credit sync
- **`includeUnresolved=true`:** includes pending/failed/mismatch items with a UI warning
- No raw metadata, secrets, or customer-sensitive data in exports

### Period filters

- **periodType:** `monthly`, `quarterly`, or `custom`
- **source:** all, booking, zoho_invoice, saved_card_invoice, refund_credit
- Quarterly periods use calendar quarters (UTC)

### Exports

**Detail CSV:** period, source, reference, invoice number, booking id, gross amount, signed amount, estimated VAT, net excluding VAT, currency, paid at, created at

**Summary CSV:** period bounds, VAT registered flag, VAT rate, gross/refund/net totals, estimated output VAT, net excluding VAT, transaction counts

### Limitations

- Estimates output VAT from Shalean matched transactions; Zoho Books remains the accounting record of truth
- Not SARS-ready filing — accountant review required
- No automatic tax filing or bank reconciliation

## Phase 17: Corporate client monthly statements

Read-only monthly account statements for corporate / manual invoice clients.

**Page:** `/admin/operations/corporate-statements`  
**API:** `GET /api/admin/finance/corporate-statements`  
**Export:** `GET /api/admin/finance/corporate-statements/export?format=csv`

### Purpose

Allow admin/finance to generate monthly statements showing opening balance, invoices/charges, payments, saved-card charges, refunds/credits, closing balance, and outstanding items. **Read-only** — no statement emailing, PDF generation, or payment mutations in Phase 17.

### Data sources

| Source | Table | Customer match |
|--------|-------|----------------|
| Manual invoice checkout | `zoho_invoice_payments` | `customer_email`, `customer_name` |
| Saved-card charges | `zoho_invoice_authorization_charges` | `customer_email` |
| Booking sales | `payments` + `zoho_sales_sync` | `booking_id`, `zoho_customer_id` |
| Refunds / credits | `zoho_refund_credit_sync` | `booking_id`, `invoice_number` |

### Statement rules

- **Debit** = invoice/charge (customer owes)
- **Credit** = payment, saved-card payment, or refund/credit
- **Running balance** = opening balance + debits − credits (computed in date order)
- Unpaid Zoho invoices not stored locally are **excluded** (documented limitation)

### Opening balance limitation

Opening balance is calculated from Shalean-recorded activity **before** the selected period. It does **not** reflect the full Zoho Books ledger unless Zoho statement sync is added later. Do not fake Zoho ledger balances.

### Customer search

At least one identifier required:
- `customerEmail`
- `customerName` (partial match on invoice customer name)
- `zohoCustomerId`

### Period filters

- **periodType:** `monthly` or `custom`
- **from** / **to** date range

### Export and print

- **CSV** includes customer label, period, line items with debits/credits/running balance — no secrets
- **Print-friendly** browser layout with Shalean header and footer (use Print statement button)

### Monthly workflow

1. Open `/admin/operations/corporate-statements`.
2. Search customer by email, name, or Zoho customer ID.
3. Select month or custom range.
4. Click **Generate statement**.
5. Review opening/closing balance and outstanding items.
6. Export CSV or print.
7. Send manually to customer if required.

### Future automation

Phase 17 does not include automatic statement emailing or PDF generation. These may be added in a future phase.

## Phase 18: Executive finance analytics & profitability dashboard

Read-only executive analytics dashboard for Shalean finance and operational profitability insights.

**Page:** `/admin/operations/finance-analytics`  
**API:** `GET /api/admin/finance/analytics`  
**Export:** `GET /api/admin/finance/analytics/export?format=csv`

Optional export sections via `section=revenue-trends|profitability|operational`.

### Purpose

Give admin/executives a high-level profitability and finance analytics view with trends, breakdowns, and operational health — **read-only**. Does not include payment mutations, forecasting, payroll automation, accounting edits, or refund automation.

### Operational estimates disclaimer

Analytics are operational estimates based on Shalean finance records and should be reviewed alongside formal accounting reports. Do **not** claim audited profit, tax-ready profitability, or final accounting truth.

### Metrics definitions

| Metric | Formula / source |
|--------|------------------|
| Gross revenue | Sum of matched sales sources (booking, Zoho invoice, saved-card) |
| Net revenue | Gross revenue − refunds/credits |
| Cleaner payouts | `earning_lines.payout_amount_cents` in period |
| Est. gross profit | Net revenue − cleaner payouts |
| Est. gross margin % | Gross profit / net revenue |
| Average booking value | Net revenue / paid bookings |
| Repeat customer rate | Repeat customers / total customers in period |
| Failed payment rate | Failed payment attempts / total attempts |
| Payout ratio | Cleaner payouts / net revenue |
| Refund rate | Refunds / gross revenue |
| Corporate revenue | Zoho invoice + saved-card charges |
| Residential revenue | Booking checkout payments |

### Revenue trends

Aggregated by daily, weekly, or monthly buckets:
- Gross/net revenue, refunds, paid bookings
- Saved-card charges, corporate vs residential split

### Customer insights

- Repeat customer rate and top customers (masked labels)
- Corporate vs residential revenue split
- Payment method usage and saved-card adoption
- Invoice vs booking revenue split

### Operational health monitoring

- Failed payment trends and refund rates
- Reconciliation failure counts
- Stale pending finance items (7+ days)
- Saved-card charge success rate
- Zoho booking sync and refund/credit sync health

### Export usage

Safe CSV fields only — no authorization codes, raw metadata, full emails, or provider payloads.

### Executive workflow

1. Open `/admin/operations/finance-analytics`.
2. Review revenue and margin trends.
3. Review refund and failed payment trends.
4. Review cleaner payout ratios.
5. Review operational health alerts.
6. Export reports if needed.

### Observability

Logger namespace: `finance:analytics`

| Event | When |
|-------|------|
| `finance_analytics_loaded` | Dashboard/API load success |
| `finance_analytics_exported` | CSV export success |
| `finance_analytics_failed` | Load or export failure |

## Phase 19: Production rollout checklist + staged enablement

Operational go-live control layer for progressive finance feature enablement.

**Page:** `/admin/operations/production-rollout`  
**API:** `GET /api/admin/production-rollout`  
**Checklist:** `GET /api/admin/production-rollout/checklist`, `POST /api/admin/production-rollout/checklist/[key]`  
**Export:** `GET /api/admin/production-rollout/export?format=csv`

### Purpose

Safe staged rollout for Shalean finance/payment features with environment checks, persisted QA checklist, monitoring counts, feature-flag recommendations, and read-only rollback guidance. **No payment mutations or flag changes from the UI.**

### Staged rollout philosophy

Enable features progressively via environment variables after operational sign-off:

1. Invoice payments (`ZOHO_INVOICE_PAYMENTS_ENABLED`)
2. Saved methods (`ZOHO_SAVED_METHODS_ENABLED`)
3. Sales sync (`ZOHO_SALES_SYNC_ENABLED`)
4. Refund/credit sync (`ZOHO_REFUND_CREDIT_SYNC_ENABLED`)
5. Admin card charges last (`ZOHO_ADMIN_CARD_CHARGES_ENABLED` — default OFF)

### Production checklist (`production_rollout_checklist`)

Persisted admin sign-off items with categories: `core_setup`, `live_qa`, `controlled_rollout`, `final_enablement`.

Default keys include: `webhook_configured`, `cron_configured`, `live_payment_test_completed`, `refund_test_completed`, `saved_method_test_completed`, `admin_charge_test_completed`, `finance_reconciliation_reviewed`, `accounting_close_reviewed`.

Checklist updates are admin-only, idempotent, audit-friendly (no deletes).

### Readiness rules (operational estimates)

| Feature | Ready when |
|---------|------------|
| Invoice payments | Paystack + Zoho configured, webhook checklist complete, no critical reconciliation failures |
| Saved methods | Invoice payments enabled, saved-method QA complete, low auth failure rate |
| Sales sync | Zoho configured, reconciliation healthy, no sync backlog |
| Refund sync | Sales sync enabled, no failed refund sync backlog |
| Admin charges | Saved methods stable, reconciliation clean, explicit sign-off (flag stays OFF by default) |

### Monitoring workflow

Dashboard surfaces failed reconciliation, stale pending items, failed syncs, and failed admin charges with links to:

- Finance reconciliation
- Accounting close
- Finance analytics
- Zoho payments / refunds

### Emergency rollback

1. Disable feature flags first (admin charges → refund sync → sales sync → saved methods → invoice payments).
2. Keep diagnostics online.
3. Never delete finance records.

### Observability

Logger namespace: `finance:production-rollout`

| Event | When |
|-------|------|
| `production_rollout_loaded` | Status load success |
| `production_rollout_checklist_updated` | Checklist item saved |
| `production_rollout_exported` | CSV export success |
| `production_rollout_failed` | Load/export failure |

## Phase 20: Zoho replacement feasibility audit

Read-only architectural audit evaluating whether Shalean can safely replace Zoho with a native invoicing/accounting layer in the future.

**Page:** `/admin/operations/zoho-replacement-audit`  
**API:** `GET /api/admin/finance/zoho-replacement-audit`  
**Export:** `GET /api/admin/finance/zoho-replacement-audit/export?format=csv|json|markdown`

### Purpose

Diagnostics, analysis, and planning only. **This phase does not remove Zoho, change payment flows, or migrate accounting data.**

Leadership uses the audit to decide:

- Whether to keep Zoho long-term
- What is still missing in Shalean
- What would be risky to replace
- Estimated migration readiness (0–100 score)

### Why Zoho still exists

Zoho Books remains the accounting authority for:

- Invoice numbering and ledger records
- Credit notes and accountant-grade tax
- General ledger, bank reconciliation, and regulatory exports

Shalean owns operational finance: bookings, Paystack payments, saved-card charges, refunds, reconciliation, accounting close summaries, VAT reports, corporate statements, finance analytics, and rollout controls.

### Migration readiness philosophy

The readiness score weights operational finance, accounting correctness, tax/legal support, auditability, reconciliation, and reporting. Missing native accounting capabilities (immutable ledger, double-entry, GL, bank reconciliation, tax filing) apply severity penalties.

| Score | Recommended decision |
|-------|---------------------|
| &lt;40 | Keep Zoho |
| 40–65 | Hybrid recommended |
| 65–80 | Partial migration possible |
| &gt;80 | Replacement feasible with accountant review |

### Missing accounting capabilities (examples)

- Immutable accounting ledger
- Double-entry accounting and chart of accounts
- Bank reconciliation
- Tax filing integration
- AR aging and journal entries
- Invoice sequencing governance
- Accountant review workflows

### Phased migration guidance (recommendations only)

1. **Phase A** — Keep Zoho as accounting authority
2. **Phase B** — Shalean invoice presentation layer
3. **Phase C** — Native immutable invoice ledger (parallel to Zoho)
4. **Phase D** — Double-entry accounting engine
5. **Phase E** — Replace Zoho only after accountant review

### Accountant review warning

**Zoho replacement should be reviewed with an accountant before implementation.** Exports are safe for leadership review and contain no secrets or raw payment metadata.

### Observability

Logger namespace: `finance:zoho-replacement-audit`

| Event | When |
|-------|------|
| `zoho_replacement_audit_loaded` | Audit load success |
| `zoho_replacement_audit_exported` | CSV/JSON/Markdown export success |
| `zoho_replacement_audit_failed` | Load or export failure |

## Phase 10+ (not implemented)

- Automatic recurring billing / subscription billing
- Zoho invoice note/link write-back automation
- Customer payment receipt downloads

## Related docs

- [Paystack payment foundation](./paystack-foundation.md)
