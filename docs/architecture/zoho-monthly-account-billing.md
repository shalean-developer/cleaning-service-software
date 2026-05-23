# Zoho monthly account billing — architecture

**Status:** Phase 10 — Governance workflow polish (manual UX)  
**Last updated:** 2026-05-23

## Purpose

Customer **monthly account billing eligibility** is managed by admins. Phase 3B adds **service authorization**; Phase 4 **accrues completed visits** into draft monthly invoice batches; Phase 5 lets admins **generate one consolidated Zoho invoice** per draft batch.

Accrual is **not payment**. Invoice generation is **not payment sync**.

## Phase map

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Schema, read repositories, read models, admin GET APIs, read-only UI | Shipped |
| **2** | Feature flag, enable/disable, terms update, Zoho customer link/create, audit + idempotency | Shipped |
| **3A** | Admin wizard billing mode metadata on drafts | Shipped |
| **3B** | Service authorization (`CONFIRM_SERVICE_AUTHORIZED`), assignment dispatch, completion guard | Shipped |
| **4** | Post-completion invoice accrual into `monthly_invoice_batch_items` | Shipped |
| **5** | Zoho consolidated invoice generation from draft batches | Shipped |
| **6** | Payment sync from Zoho / Shalean pay page into batch status | Shipped |
| **7** | Month-end operations: send invoice, reminders, overdue, customer portal | Shipped |
| **8** | Delivery automation, reminder cadence, collections dashboard, risk scoring | **This PR** |

## Feature flags

```bash
ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED=false
ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED=false
ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED=false
ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED=false
ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED=false
ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED=false
ZOHO_MONTHLY_INVOICE_AUTOMATION_ENABLED=false
ZOHO_MONTHLY_COLLECTIONS_ENABLED=false
```

- **Monthly billing flag:** customer eligibility setup (Phase 2).
- **Service authorization flag:** requires monthly billing flag. Enables authorize-service without payment.
- **Invoice accrual flag:** requires billing + authorization + accrual flags.
- **Invoice generation flag:** requires billing + accrual + generation flags. When off, dashboard shows “Zoho invoice generation is disabled.”
- **Payment sync flag:** requires billing + generation + payment sync flags. When off, dashboard shows “Monthly invoice payment sync is disabled.”
- **Invoice operations flag:** requires billing + generation + payment sync + operations flags. When off, dashboard shows “Monthly invoice operations are disabled.”
- **Invoice automation flag:** requires billing through operations + automation flags. Enables auto-send after generation and cron reminder cadence.
- **Collections flag:** requires billing flag. Enables `/admin/operations/monthly-collections`, risk scoring, and finance workflow tooling (read-only when automation off).

## Service authorization model

Dedicated table `monthly_service_authorizations` — **not a payment row**.

| Field | Purpose |
|-------|---------|
| `booking_id` (unique) | One authorization per booking |
| `monthly_account_id` | Links to approved customer billing account |
| `amount_cents` | Booking quote total at authorization time |
| `status` | `authorized` / `revoked` |
| `idempotency_key` | Admin retry dedupe |

Audit actions: `monthly_service_authorized`, `monthly_invoice_item_accrued`, `monthly_invoice_generated`, `monthly_invoice_generation_failed`, `monthly_invoice_payment_sync_checked`, `monthly_invoice_paid`, `monthly_invoice_overdue`, `monthly_invoice_void`, `monthly_invoice_payment_sync_failed`, `monthly_invoice_sent`, `monthly_invoice_reminder_sent`, `monthly_invoice_marked_overdue`.

## Lifecycle (Phase 6)

```
monthly_invoice_batch.status = generated/sent/overdue
  → invoice paid via /pay/{invoiceNumber} OR externally in Zoho
  → sync (manual, cron, or webhook_reconcile)
  → batch.status = paid, items.status = paid, paid_at stored
```

Terminal batch states: `paid`, `void` (no further sync mutations).

## Payment sync (Phase 6)

Sync sources (checked in order):

1. **Shalean pay page:** `zoho_invoice_payments` row with `status = paid` for matching invoice id/number
2. **Zoho Books:** read-only invoice lookup via `getZohoInvoiceById` / `getZohoInvoiceByNumber`

Status mapping:

| Zoho / signal | Batch status |
|---------------|--------------|
| `paid` or balance ≤ 0 | `paid` |
| `sent`, `open`, `partially_paid` | `sent` |
| `overdue` | `overdue` |
| `void` / `voided` | `void` |
| `draft` | `generated` (unchanged) |

Webhook hook: after `processZohoInvoiceChargeSuccess` marks a payment row paid, `runPostZohoInvoicePaymentMonthlyBatchSync` runs best-effort (`.catch(() => undefined)`). Does **not** alter Zoho invoice payment processing or booking lifecycle.

Hard boundaries — **not implemented in Phase 6:**

- No booking lifecycle / `finalizePaidBooking` changes
- No new Paystack booking webhook behavior
- No Zoho customer payment creation from monthly sync
- No cleaner earnings / payout changes

## Lifecycle (Phase 5)

```
monthly_account draft → authorized → completed
  → monthly_invoice_batch (draft) + accrued items
  → admin reviews batch on /admin/operations/monthly-billing
  → POST generate-zoho-invoice (idempotent)
  → Zoho invoice created (reference SHALEAN-MIB-{batchId})
  → batch.status = generated
  → items.status = invoiced
  → payment sync deferred to Phase 6
```

Hard boundaries — **not implemented in Phase 5:**

- No Zoho payment sync or customer payments
- No batch `paid` / `sent` automation (except Zoho draft invoice create)
- No Paystack / booking lifecycle / payout changes
- No duplicate Zoho invoices (reference lookup + batch `zoho_invoice_id` guard)

## Accrual rules (Phase 4)

Accrual runs **after successful** `MARK_BOOKING_COMPLETED` (including idempotent re-completion) and **after** `recordEarningsForBooking` succeeds.

Gates (all required):

1. `ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED=true` (and parent flags)
2. `metadata.billing.mode === monthly_account`
3. `status === completed`
4. Active `monthly_service_authorizations` row (`status = authorized`)
5. Positive `price_cents` on booking

Behavior:

- **Billing month:** Africa/Johannesburg local date from `scheduled_start` (fallback `updated_at`), stored as first-of-month `YYYY-MM-01`
- **Batch:** find or create draft batch for `(customer_id, billing_month)`; unique constraint enforced
- **Item:** insert with unique `booking_id`; duplicate accrual returns `already_accrued`
- **Total:** batch `total_cents` recalculated from non-excluded items
- **Locked batch:** if batch status is `generated`, `sent`, `paid`, `overdue`, or `void`, accrual is blocked and an operational alert is recorded

Completion **must not fail** if accrual logging fails for non-critical issues; accrual hook is best-effort (`.catch(() => undefined)`).

## Batch / item lifecycle

| Entity | Status | Meaning |
|--------|--------|---------|
| `monthly_invoice_batches` | `draft` | Accrual allowed; ready for invoice generation when items > 0 |
| | `generated` / `sent` / `paid` / `overdue` / `void` | Locked — no further accrual |
| `monthly_invoice_batch_items` | `accrued` | Visit completed; awaiting Zoho invoice |
| | `invoiced` | Included on generated Zoho invoice (Phase 5) |
| | `paid` | Batch invoice paid (Phase 6) |

Duplicate prevention:

- Unique `booking_id` on items
- Unique `(customer_id, billing_month)` on batches

## Completion guard

`hasFinancialClearanceForCompletion(bookingId)` returns true when:

- a **paid** payment exists, **or**
- an active `monthly_service_authorizations` row exists (`status = authorized`)

## Invoice generation rules (Phase 5)

Gates:

1. `ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED=true` (and parent flags)
2. Batch `status = draft` with accrued items and `total_cents > 0`
3. Customer billing account enabled with `zoho_customer_id`
4. No existing `zoho_invoice_id` on batch
5. Admin confirms batch review (`confirmReviewed: true`)

Behavior:

- Builds multi-line Zoho invoice (`SHALEAN-MIB-{batchId}` reference)
- Creates invoice via Zoho Books API (does **not** auto-mark paid)
- Stores `zoho_invoice_id`, `zoho_invoice_number`, `zoho_reference_number`
- Marks batch `generated`; items `invoiced` with `zoho_line_item_id` when returned
- Idempotent by `idempotencyKey` and existing batch invoice

On Zoho failure: batch stays `draft`; audit `monthly_invoice_generation_failed`.

## Admin surfaces

- `/admin/operations/monthly-billing` — accrual + generation diagnostics, generate button per ready draft batch
- Customer detail — current month accrued batch summary
- Booking detail — invoice accrual status for completed monthly_account bookings

Operational alerts (read-only, no auto-fix):

- Completed authorized monthly bookings not accrued
- Batch locked at completion time
- Missing amount skipped
- Accrual disabled while completions occur

## Recurring (v1)

**Blocked in Phase 3B.** Recurring monthly_account authorization deferred to Phase 3C. Phase 4 does not accrue future visits before completion.

## Migrations

- Phase 1: `20260710100000_zoho_monthly_account_billing_phase1.sql`
- Phase 2: `20260711100000_zoho_monthly_account_billing_phase2_idempotency.sql`
- Phase 3B: `20260712100000_zoho_monthly_account_billing_phase3b_service_authorization.sql`
- Phase 4: `20260713100000_zoho_monthly_account_billing_phase4_invoice_accrual.sql`
- Phase 5: `20260714100000_zoho_monthly_account_billing_phase5_invoice_generation.sql`
- Phase 6: `20260715100000_zoho_monthly_account_billing_phase6_payment_sync.sql`
- Phase 7: `20260716100000_zoho_monthly_account_billing_phase7_invoice_operations.sql`
- Phase 8: `20260717100000_zoho_monthly_account_billing_phase8_delivery_automation.sql`
- Phase 9: `20260718100000_zoho_monthly_account_billing_phase9_credit_governance.sql`
- Phase 10: `20260719100000_zoho_monthly_account_billing_phase10_governance_workflow_polish.sql`

## Month-end invoice operations (Phase 7)

After a batch is `generated`, admins send the consolidated invoice to the customer's billing email with a Shalean payment link (`/pay/{zohoInvoiceNumber}`). This phase does **not** create Zoho customer payments, mark invoices paid, or touch booking lifecycle.

### Send invoice workflow

Gates:

1. `ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED=true` (and parent flags)
2. Batch `status = generated` with `zoho_invoice_number`
3. Customer billing account has `billing_email`
4. Admin confirms send (`confirmSend: true`)

Behavior:

- Enqueues email notification (`monthly_invoice_sent` template)
- Updates batch `status = sent`, sets `sent_at`
- Stores due date and payment link in batch `metadata.invoiceOperations`
- Audit: `monthly_invoice_sent`

### Reminder workflow

- Allowed for `sent` or `overdue` batches only
- Reuses stored payment link; increments `metadata.invoiceOperations.reminderCount`
- Audit: `monthly_invoice_reminder_sent`
- Does not create new invoices or payments

### Overdue workflow

A batch is overdue when:

- `status = generated` or `sent`
- Due date has passed (from billing terms + invoice date)
- Not `paid` or `void`

Manual admin action or cron `POST /api/cron/mark-monthly-invoices-overdue` marks `status = overdue`. Audit: `monthly_invoice_marked_overdue`.

### Customer portal

- `/customer/invoices` — customer sees own batches only (generated / sent / overdue / paid)
- Shows invoice number, total, due date, payment link if unpaid, paid date if paid
- No admin audit details or internal notes

### What not to do manually in Zoho

- Do **not** email customers directly from Zoho for monthly batches — use Shalean send workflow for consistent payment links and audit
- Do **not** record customer payments manually in Zoho for Shalean pay-page invoices — use payment sync (Phase 6)
- Do **not** void or rewrite invoices in Zoho without coordinating batch status in Shalean

Hard boundaries — **not implemented in Phase 7:**

- No booking lifecycle / assignment / payout changes
- No new booking payment rows
- No Zoho customer payment API calls
- No auto-send on generation (send remains an explicit admin action)

## Delivery automation & collections (Phase 8)

Phase 8 adds operational delivery automation and collections visibility. It does **not** suspend customers, block bookings, void invoices, or write off debt.

### Delivery metadata

Batch `metadata.delivery` tracks:

- `autoSendEnabled`, `sentChannels`, `lastSentAt`, `lastReminderAt`, `reminderCount`
- `deliveryFailures`, `lastDeliveryStatus`, `nextReminderAt`, `escalationLevel`
- `collectionsState`: `healthy` | `reminder_due` | `overdue` | `escalation_recommended` | `finance_review` | `disputed` | `high_risk`

Collections states are **advisory** — no lifecycle enforcement.

### Auto-send after generation

When `ZOHO_MONTHLY_INVOICE_AUTOMATION_ENABLED=true` and batch becomes `generated` with `autoSendEnabled=true`:

1. Enqueue invoice email via notification outbox
2. Transition `generated → sent`, set `sent_at`
3. Audit: `monthly_invoice_auto_sent`

Idempotent: skips if already sent or billing email missing (`monthly_invoice_auto_send_failed` audit on failure).

### Reminder cadence

Cron: `POST /api/cron/process-monthly-invoice-reminders`

Suggested stages (relative to due date):

| Stage | Offset |
|-------|--------|
| Before due | −3 days |
| Due date | 0 |
| Overdue | +3, +7, +14 days |

`computeMonthlyInvoiceReminderState()` returns `no_action`, `reminder_due`, or `escalation_due`. Hard limits: max one reminder per stage; skips `paid`, `void`, `disputed`, `finance_review`.

### Collections dashboard

`/admin/operations/monthly-collections` — grouped by collections state with:

- Outstanding totals, aging buckets (current, 1–30, 31–60, 61–90, 90+)
- Account risk score (0–100) and advisory recommendations
- CSV exports: summary, overdue accounts, aging report

Admin actions (no suspension):

- Resend invoice / reminder, sync payment, mark finance review, mark disputed, add collections note

### Risk scoring model

`computeMonthlyAccountRiskScore()` signals:

- Overdue count, average days late, unpaid balance, reminder count
- Disputed invoices, failed deliveries
- Recent successful payments reduce risk

Output: score 0–100, level (`low`/`medium`/`high`/`critical`), recommendation (`continue_normal`, `monitor`, `finance_review`, `manual_followup`, `account_review_recommended`).

Recommendations are **advisory only**.

### Customer portal (Phase 8)

`/customer/invoices` shows aging, reminder notices, overdue warnings, payment confirmation, view/pay links, finance support contact, optional dispute request form.

Does **not** expose risk scores, collections notes, or internal collections state.

### Hard boundaries — not implemented in Phase 8

- No booking lifecycle / assignment / payout changes
- No auto-suspend, auto-block booking creation, auto-void, auto-write-off
- No booking payment rows or Paystack flow changes
- No WhatsApp/SMS invoice delivery (email only via existing notification outbox)

## Manual credit governance (Phase 9)

Phase 9 adds **manual** finance governance for monthly-account customers. It does **not** auto-suspend, auto-block bookings (except one explicit gate), auto-cancel services, or modify payouts/assignment dispatch.

### Feature flag chain

`ZOHO_MONTHLY_CREDIT_GOVERNANCE_ENABLED=true` requires:

- `ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED`
- accrual → generation → payment sync → operations flags
- `ZOHO_MONTHLY_COLLECTIONS_ENABLED`

### Governance states (`customer_billing_accounts.governance_state`)

| State | Meaning |
|-------|---------|
| `approved` | Default — normal advisory monitoring |
| `account_review_required` | Finance review in progress |
| `finance_hold` | Advisory hold — admin warned at authorization |
| `disputed` | Active dispute workflow |
| `suspended` | **Blocks NEW monthly service authorization only** |

Additional fields: `credit_limit_cents`, `manual_override_until`, suspension/review metadata.

### Exposure engine

`computeMonthlyAccountExposure()` aggregates:

- Unpaid `generated` / `sent` / `overdue` invoice batches
- Disputed invoice exposure
- Authorized bookings not yet invoiced (pending exposure)

Outputs: outstanding, pending, total exposure, credit limit %, exposure band (`healthy` → `exceeded`), advisory recommendation.

### Enforcement boundary (only one)

When `governance_state = suspended`:

- Block `CONFIRM_SERVICE_AUTHORIZED` / new monthly-account draft authorization
- Error: `ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION`

**Not blocked:** existing bookings, assignments, invoice sync, collections, payouts, Paystack, customer login, invoice payment.

### Temporary override

`manual_override_until` allows authorization despite finance hold / exceeded exposure warnings. **Does not bypass suspension.**

### Governance dashboard

`/admin/operations/monthly-governance` — sections for approved, review required, finance hold, disputed, suspended, exposure exceeded, high-risk collections, override active.

Manual admin actions (all audited, reason required):

- Start finance review, finance hold, disputed, suspend, unsuspend/approve
- Set credit limit, grant temporary override, add governance note

API:

- `GET /api/admin/monthly-billing/governance`
- `POST .../accounts/[customerId]/governance-state`
- `POST .../accounts/[customerId]/credit-limit`
- `POST .../accounts/[customerId]/temporary-override`

### Authorization warnings

Admin monthly authorization panel shows exposure snapshot, governance state, risk score, disputes, override status. Elevated/exceeded exposure requires extra confirmation checkbox. Suspension is hard-blocked.

### Customer portal

Does **not** expose governance state, risk score, suspension reason, collections notes, or internal recommendations.

### Hard boundaries — not implemented in Phase 9

- No auto-suspend / auto-cancel / auto-write-off / auto-void
- No booking lifecycle changes beyond suspended → new monthly auth block
- No assignment dispatch / payout / Paystack changes

## Governance workflow polish (Phase 10)

Phase 10 improves finance/admin usability around monthly account governance. **Polish only** — no new automatic enforcement.

### Finance review workflow fields

On `customer_billing_accounts`:

| Field | Purpose |
|-------|---------|
| `finance_review_status` | `open` / `resolved` / `dismissed` |
| `finance_review_owner_admin_id` | Assigned finance owner |
| `finance_review_follow_up_date` | Manual follow-up reminder date |
| `finance_review_resolution` | Resolution or dismiss reason |

Manual actions (audited, reason required):

- Assign finance owner and follow-up date
- Resolve review with resolution text
- Dismiss review with reason

### Governance timeline

Read-only customer-level timeline merges:

- Governance audit entries (state changes, limits, overrides, suspension)
- Collections/governance notes (disputes, finance review notes)

Surfaces on:

- `/admin/operations/monthly-governance` (per-account expandable timeline)
- Customer detail billing panel (`AdminCustomerGovernancePanel`)

### Override expiry visibility

- Active override badge with “expires in X days”
- Expired override state (date comparison only — no auto-removal)
- Override expiring soon filter on governance dashboard
- Override history in governance timeline

### Bulk review actions (safe only)

Allowed bulk actions (reason required):

- Mark for finance review
- Add governance note
- Assign review owner
- Export selected (CSV)

**Not allowed:** bulk suspend, unsuspend, override, or credit limit changes.

### Dashboard UX

`/admin/operations/monthly-governance` adds:

- Filters: governance state, exposure band, overdue count, override expiring soon, customer search
- Sort: exposure %, overdue, last review, risk score, name
- Section counts and clearer recommendation labels
- Credit utilization bar and missing-limit warnings (ZAR formatting)
- Internal admin-only alerts (override expiring, follow-up due, high-risk unresolved) — **no customer notifications**

### Exports

`GET /api/admin/monthly-billing/governance?export=csv|json`

Fields: customer, governance state, credit limit, outstanding/pending exposure, exposure %, risk score, recommendation, override status, review owner, follow-up date, last action, notes count.

Optional `customerIds` query param for selected export.

### APIs (Phase 10)

- `GET /api/admin/monthly-billing/governance?export=csv|json`
- `POST /api/admin/monthly-billing/governance/bulk`
- `POST .../accounts/[customerId]/finance-review`
- `GET .../accounts/[customerId]/governance-timeline`

### Hard boundaries — not implemented in Phase 10

- No auto-suspension, auto-block (except existing suspended guard), auto-cancel, auto-stop recurring
- No auto-void invoices, auto-write-off debt
- No assignment dispatch / cleaner payout / `finalizePaidBooking` changes
- No customer-facing governance notifications or portal leaks

## Admin verification (runbook)

**Accrual (Phase 4):**

1. Enable accrual flags in staging.
2. Complete an authorized `monthly_account` booking.
3. Confirm accrued batch item and draft batch total.

**Invoice generation (Phase 5):**

1. Enable all four flags including `ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED`.
2. Review draft batch on monthly billing dashboard.
3. Generate Zoho invoice with confirmation modal.
4. Confirm batch `generated`, items `invoiced`, Zoho invoice id/number stored.
5. Retry with same idempotency key — no duplicate Zoho invoice.
6. Retry with same idempotency key — no duplicate Zoho invoice.

**Payment sync (Phase 6):**

1. Enable all five flags including `ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED`.
2. Generate a batch invoice (Phase 5) or use an existing `generated` batch.
3. Pay via `/pay/{invoiceNumber}` or mark paid in Zoho externally.
4. Click **Sync payment status** on `/admin/operations/monthly-billing` or wait for cron.
5. Confirm batch `paid`, items `paid`, `paid_at` populated.
6. If sync fails, check batch metadata `paymentSync.lastError` and retry manually.

**Month-end operations (Phase 7):**

1. Enable all six flags including `ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED`.
2. Generate monthly invoices (Phase 5) for each draft batch.
3. **Send invoice** from `/admin/operations/monthly-billing` — confirm customer receives email with `/pay/{invoiceNumber}` link.
4. Monitor **Sent awaiting payment** and **Overdue** sections on the month-end review panel.
5. **Send reminder** for unpaid sent/overdue batches as needed.
6. **Sync payment status** when customers pay (Phase 6).
7. Optional cron: `POST /api/cron/mark-monthly-invoices-overdue` after due dates pass.
8. Confirm customers can view invoices at `/customer/invoices`.

**Delivery automation & collections (Phase 8):**

1. Enable all eight flags through `ZOHO_MONTHLY_INVOICE_AUTOMATION_ENABLED` and `ZOHO_MONTHLY_COLLECTIONS_ENABLED`.
2. Generate invoices — confirm auto-send when `metadata.delivery.autoSendEnabled=true`.
3. Run `POST /api/cron/process-monthly-invoice-reminders` daily.
4. Review `/admin/operations/monthly-collections` for overdue, escalation, and high-risk accounts.
5. Use finance review / disputed markers and collections notes for manual follow-up.
6. Confirm customers see aging and overdue warnings at `/customer/invoices` (no internal risk data).

**Manual credit governance (Phase 9):**

1. Enable all nine flags through `ZOHO_MONTHLY_CREDIT_GOVERNANCE_ENABLED`.
2. Set credit limits on high-volume monthly accounts from `/admin/operations/monthly-governance`.
3. Review exposure exceeded and high-risk collections sections daily.
4. Use **Start review** / **Finance hold** for advisory workflows; add governance notes with reason.
5. **Suspend** only when finance approves — blocks NEW monthly service authorization only.
6. Grant **temporary override** with explicit end date for one-off approvals (does not bypass suspension).
7. Confirm suspended customers can still pay open invoices and existing bookings continue.
8. Confirm customer portal does not show governance state or internal risk data.

**Month-end sync SOP:**

- Run cron `POST /api/cron/sync-monthly-invoice-payments` after month-end invoicing.
- Review overdue batches on the payment sync diagnostics panel.
- Reconcile paid invoices in Zoho against batch `paid` status before closing the month.

## Related docs

- [admin-assisted-booking-system.md](./admin-assisted-booking-system.md)
- [admin-assisted-booking-rollout.md](../runbooks/admin-assisted-booking-rollout.md)
