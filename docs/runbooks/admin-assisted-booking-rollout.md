# Admin-assisted booking — production rollout runbook

**Status:** Phase 10 — production learning + incident review  
**Last updated:** 2026-05-23

## Supported flows (when flags enabled)

| Step | Action | Result |
|------|--------|--------|
| 1 | Admin creates draft | `draft` + `metadata.adminAssist` |
| 2 | Move to pending payment | `pending_payment` |
| 3a | Generate Paystack link | Link metadata + pending payment row |
| 3b | Record offline payment (EFT/cash/card) | `finalizePaidBooking(source=offline)` |
| 4 | Customer pays (Paystack) or admin records offline | `confirmed` via **only** `finalizePaidBooking` |
| 5 | Assignment | `runPostPaymentAssignmentDispatch` inside finalize |

## Disabled / out of scope

- Direct `bookings.status = confirmed` from admin routes
- `ADMIN_OVERRIDE_STATUS`
- Manual assignment offers from admin payment paths
- Earnings/payout mutation from admin assist paths
- Recurring generation changes
- Corporate invoice rail (separate Zoho flow)
- Customer booking wizard changes
- **Monthly account billing (Phase 3A):** admins may tag admin-assisted **drafts** with `metadata.billing.mode=monthly_account` when the customer is eligible. This does **not** confirm bookings, start assignment, or create invoices. **Only save draft** for `monthly_account` until Phase 3B service authorization. Do not promise month-end billing to customers until later phases.

## Feature flags (staged order)

| Step | `ADMIN_ASSISTED_BOOKING_ENABLED` | `ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED` | `ADMIN_ASSISTED_OFFLINE_PAYMENTS_ENABLED` | Notes |
|------|----------------------------------|----------------------------------------|-------------------------------------------|-------|
| 1 | `true` | `false` | `false` | Draft + pending payment only |
| 2 | `true` | `true` (internal) | `false` | Paystack links for staff QA |
| 3 | `true` | `true` | `false` | Enable payment request emails |
| 4 | `true` | `true` | EFT only (ops procedure) | Reconcile bank refs before cash/card |
| 5 | `true` | `true` | `true` | Cash/card after reconciliation SOP signed |

Payment request emails require payment links flag. Offline requires booking + offline flags.

## Rollback plan

1. Set `ADMIN_ASSISTED_OFFLINE_PAYMENTS_ENABLED=false`
2. Set `ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED=false`
3. Set `ADMIN_ASSISTED_BOOKING_ENABLED=false`
4. Leave diagnostics and finance pages online for reconciliation
5. Do **not** delete `admin_booking_assist_audit`, `admin_offline_payment_events`, or paid bookings
6. Re-enable only after checklist items and parity tests pass

## Production checklist keys

Category `admin_assisted_booking` on `/admin/operations/production-rollout`:

- `admin_assisted_booking_draft_tested`
- `admin_assisted_pending_payment_tested`
- `admin_assisted_payment_link_tested`
- `admin_assisted_payment_request_email_tested`
- `admin_assisted_offline_payment_eft_tested`
- `admin_assisted_offline_payment_cash_tested`
- `admin_assisted_offline_payment_card_machine_tested`
- `admin_assisted_assignment_parity_verified`
- `admin_assisted_customer_visibility_verified`
- `admin_assisted_cleaner_visibility_verified`
- `admin_assisted_payout_safety_verified`
- `admin_assisted_webhook_parity_verified`
- `admin_assisted_feature_flags_verified`

## Rollout stages (Phase 8)

Derived by `resolveAdminAssistedBookingRolloutStage()` from existing env flags + checklist — **does not replace flags**.

| Stage | Meaning |
|-------|---------|
| `disabled` | `ADMIN_ASSISTED_BOOKING_ENABLED=false` |
| `draft_only` | Booking on; payment links off |
| `payment_links` | Paystack links + notifications on; offline off |
| `offline_eft` | Offline on; cash/card checklist items incomplete |
| `offline_full` | All offline rails enabled per checklist |

Shown on: operations dashboard, pilot QA panel, wizard banner, production rollout page.

Invalid flag combinations (e.g. links on without booking) surface as rollout blockers on `/admin/operations/production-rollout`.

## Production readiness (Phase 8)

- **Checklist progress:** Section E on production rollout dashboard
- **Critical blockers:** 11 required items before `productionReady=true`
- **Soft warning banner:** Shown when critical checklist incomplete
- **Last verified:** Most recent checklist completion timestamp + operator

## Operational alerts (read-only)

Fleet alerts on `/admin/operations/admin-assisted-bookings` and pilot export:

- Stale pending payments (>72h)
- Failed payment request emails
- Repeated link regenerations
- Assignment dispatch failures / orphan confirmed
- Recurring materialization failures
- Offline payment anomalies
- Expired links with pending payment (late Paystack settlement note)

See [admin-assisted-alert-interpretation.md](./admin-assisted-alert-interpretation.md).

## Test commands

```powershell
npx vitest run src/features/bookings/server/admin/adminAssistedPaymentFlow.integration.test.ts
npx vitest run src/features/bookings/server/admin/adminAssistedOfflinePaymentFlow.integration.test.ts
npx vitest run src/features/bookings/server/admin/customerBookingFlow.regression.test.ts
npx vitest run src/features/bookings/server/admin/adminAssistedBooking.phase6.test.ts
npx vitest run src/features/bookings/server/admin/resolveAdminAssistPaidVia.test.ts
npx vitest run src/features/bookings/server/admin/buildAdminBookingAssistTimeline.test.ts
npx vitest run src/lib/app/resolveAdminAssistedBookingRolloutStage.test.ts
npx vitest run src/features/bookings/server/admin/adminAssistedRolloutReadiness.test.ts
npx vitest run src/features/bookings/server/admin/adminAssistedBookingAlerts.test.ts
npx vitest run src/app/api/admin/bookings/assist-pilot/export/route.test.ts
```

## Observability

- **Fleet diagnostics:** `/admin/operations/admin-assisted-bookings`
- **Pilot QA panel:** `/admin/operations/admin-assisted-pilot`
- **Production dashboard:** `/admin/operations/admin-assisted-production` (live metrics + **production learning**)
- **Weekly export:** `/api/admin/bookings/assist-production/weekly-export`
- **Learning exports:** `/api/admin/bookings/assist-production/learning-export?export=weekly|incidents|lessons|backlog`
- **Per booking:** Assist timeline, QA checklist, operator feedback (with lesson category/tags), dry-run banner
- **List filters:** Admin-assisted, awaiting payment, link sent/expired, paid via offline/Paystack link

## Weekly review process (Phase 10)

1. Open production dashboard → **Production learning** section.
2. Review weekly metrics and advisory rollout recommendation.
3. Triage **Incident review queue** — document root cause and resolution; never auto-close.
4. Scan **Operator lessons** and **Improvement backlog** for repeated themes.
5. Export CSV/JSON for ops records (`learning-export` endpoints).
6. Decide next stage manually (see decision criteria below).

## Rollout decision criteria

| Signal | Advisory action |
|--------|-----------------|
| Health ≥ 85, low incidents, strong assignment/payment | Continue or enable next stage |
| `draft_only` stable | Expand payment links |
| `payment_links` + checklist ready | Enable EFT |
| Critical incidents, recurring failures, offline anomalies | Hold rollout |
| Health band critical | Consider rollback |

Decision helper on dashboard is **advisory only** — update env flags per staged order above.

## Operator feedback review

- Submit on booking detail after each assist run (optional).
- Tag UX, payment, customer, cleaner, recurring, finance, training, or bug.
- Repeated tags (≥2) appear in generated backlog for weekly triage.

See [admin-assisted-incident-response-sop.md](./admin-assisted-incident-response-sop.md).

## Operator dry-run SOP (Phase 7B)

1. Enable `ADMIN_ASSISTED_BOOKING_PILOT_MODE=true` — this shows the pilot banner **and** auto-labels new drafts with `metadata.adminAssist.pilotDryRun=true` (same effect as `ADMIN_ASSISTED_BOOKING_DRY_RUN_LABEL=true`).
2. Create booking via `/admin/bookings/create` — use real customer and real payment paths.
3. Complete the **Dry-run QA checklist** on booking detail after each run.
4. Submit **operator feedback** (optional) — no payment card data.
5. Review friction on `/admin/operations/admin-assisted-pilot`; export CSV for weekly review.
6. Escalate stuck flows via booking detail support summary + `#admin-assist-pilot`.

## Escalation procedure

Capture: booking ID, payment reference, last operator action, friction flags, feedback text.  
Do not bypass payment confirmation or assignment. Use recovery CTAs (regenerate link, resend email, WhatsApp copy).

## Offline payment SOP (unchanged)

- EFT first in pilot; cash/card only after reconciliation SOP signed.
- Require evidence reference; amount must match `price_cents` exactly.
- **SOP checkbox required:** operator must confirm `sopConfirmed: true` — “I verified this payment against bank/cash/terminal records.”
- Active Paystack link requires explicit supersede confirmation.

## Recovery flows

| Situation | Action |
|-----------|--------|
| Expired payment link | Link expired in UI; **late Paystack payment may still settle**. Regenerate only if customer confirms payment not completed |
| Failed email | Resend payment request email |
| No customer email | Copy WhatsApp message |
| Stale pending (>72h) | Follow up customer; review friction dashboard |
| Payment confirmed, no assignment | Normal post-payment flow — do not manual-assign |

## Recommended rollout order

1. Pilot mode + dry-run labeling ON; payment links OFF → draft/pending QA only  
2. Payment links ON (internal) → real Paystack dry-runs  
3. Payment request emails ON  
4. Offline EFT ON after checklist  
5. Review pilot export + feedback before wider enablement  

## Support troubleshooting

- **Wizard not refreshing:** assist-summary endpoint; check 30s poll + tab visible.
- **Missing pilot badge:** verify draft created after pilot flag enabled.
- **Feedback not saving:** booking must be admin-assisted; check API 404.
- **Export empty:** no flagged bookings in 500-row scan window.

See [admin-assisted-booking-pilot-performance.md](../architecture/admin-assisted-booking-pilot-performance.md) for scale limits.

## Payment reconciliation notes

- **Paystack link:** Match `payments.provider_ref` to Paystack dashboard; webhook/verify is canonical confirm path.
- **Offline EFT:** Require `bankReference` + `evidenceReference`; store in `admin_offline_payment_events`.
- **Cash:** Require `receiptNumber`; reconcile against till records.
- **Card machine:** Require `terminalReference`; reconcile against terminal batch.
- Active Paystack link blocks offline record unless `confirmSupersedesActivePaymentLink: true`.
- Amount must equal booking `price_cents` exactly.

## Launch recommendation

**Ready for Step 1 production** (draft + pending payment only) after checklist draft/pending items are signed and customer regression tests pass.

**Do not enable offline cash/card** until EFT reconciliation SOP is documented and at least one live EFT test is recorded on the checklist.

## Monthly account service authorization (Phase 3B)

Requires `ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED=true` **and** `ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED=true`.

### Approval checklist (before authorize)

1. Customer billing account enabled with approval metadata and Zoho customer link.
2. Booking is `monthly_account` draft with valid quote total.
3. Admin confirms month-end billing terms with customer (checkbox in UI).
4. Document reason (PO, contract ref, or finance approval id).

### Finance risk warning

Service authorization **does not record payment**. The customer balance accrues toward a future monthly invoice batch. Unauthorized service on suspended accounts creates collection risk — verify account still enabled before authorizing.

### SOP

1. Create admin-assisted draft with billing mode **Monthly account**.
2. From wizard confirmation or booking detail, click **Authorize service**.
3. Confirm checkbox + enter reason → submit (idempotent).
4. Verify booking moves to `confirmed` / assignment dispatch starts.
5. Booking detail shows **Service authorized** badge and **Not invoiced yet**.

### Hold / revoke

If a customer account is suspended after authorization:

- Do **not** authorize new drafts while account disabled.
- For in-flight authorized bookings, coordinate with ops to cancel/reschedule before service date.
- Phase 3B schema supports `revoked` status on `monthly_service_authorizations`; manual DB/service-role revoke is interim until Phase 3C admin revoke API.

### What authorization does not do

- No Paystack link, offline payment, or paid payment row
- No Zoho invoice or payment sync
- No monthly invoice batch item accrual (Phase 4 — see below)

## Monthly invoice accrual (Phase 4)

Requires all three flags:

```bash
ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED=true
ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED=true
ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED=true
```

When accrual is disabled, authorized monthly bookings still complete normally; dashboard shows **Monthly invoice accrual is disabled.**

### Verify accrued visits

1. Complete an authorized `monthly_account` booking.
2. Open `/admin/operations/monthly-billing` — accrued item count and draft batch total should increase.
3. Booking detail shows **Invoice accrual: accrued** with billing month and batch id.
4. Customer detail shows **Current month accrued batch** when a draft batch exists for the Johannesburg billing month.
5. Re-trigger completion idempotently — no duplicate batch item.

### Detect missing accrual

- Dashboard **Completed not accrued** count and alert rows list authorized completions without batch items.
- Alerts also surface batch locked, missing amount, and accrual-disabled completions.

### Phase 5 — Zoho invoice generation

Requires all four flags:

```bash
ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED=true
ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED=true
ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED=true
ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED=true
```

### Month-end invoice generation SOP

1. Open `/admin/operations/monthly-billing` and review each draft batch (customer, month, item count, total).
2. Cross-check completed visits in booking detail / customer accrued batch summary.
3. Confirm customer billing account has a linked **Zoho customer id**.
4. Click **Generate Zoho invoice** and confirm the review checkbox.
5. Verify batch status becomes **generated** and Zoho invoice number appears.
6. Send invoice to customer using **Send invoice to customer** on `/admin/operations/monthly-billing` (Phase 7). Do not rely on Zoho's send-email for Shalean pay-page links.

### If Zoho generation fails

- Batch remains **draft** — accrued items are unchanged.
- Check dashboard **Generation failures** alerts and billing account audit for `monthly_invoice_generation_failed`.
- Fix root cause (missing Zoho customer, Zoho API outage, invalid line items) and retry with a **new idempotency key**.
- Do not manually mark batch paid in the app — use payment sync (Phase 6).

### Month-end invoice operations (Phase 7)

Requires all six flags through `ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED=true`.

**Month-end SOP:**

1. Review accrued items and generate Zoho invoices (Phases 4–5).
2. Send each generated batch to the customer billing email.
3. Monitor sent/unpaid and overdue sections on the monthly billing dashboard.
4. Send reminders for unpaid invoices after the due date.
5. Sync payment status when customers pay via `/pay/{invoiceNumber}`.
6. Optionally run `POST /api/cron/mark-monthly-invoices-overdue` daily after due dates.
7. Confirm customers see invoices at `/customer/invoices`.

**What not to do in Zoho manually:**

- Do not email pay links from Zoho — use Shalean send workflow for audit and consistent `/pay/{invoiceNumber}` URLs.
- Do not record customer payments in Zoho for invoices paid on the Shalean pay page — payment sync handles batch status.
- Do not void or recreate invoices without updating the matching batch in Shalean.

### Delivery automation & collections (Phase 8)

Requires flags through `ZOHO_MONTHLY_INVOICE_AUTOMATION_ENABLED=true` and `ZOHO_MONTHLY_COLLECTIONS_ENABLED=true`.

**Collections SOP:**

1. After generation, verify auto-send succeeded (batch `sent`, audit `monthly_invoice_auto_sent`).
2. Run `POST /api/cron/process-monthly-invoice-reminders` daily for unpaid sent/overdue batches.
3. Review `/admin/operations/monthly-collections` — overdue, escalation recommended, high risk.
4. Export aging/overdue CSVs for finance review.
5. Mark finance review or disputed when customers raise issues; add collections notes for follow-up calls.

**Overdue handling:**

- Cron `POST /api/cron/mark-monthly-invoices-overdue` marks batches overdue after due date.
- Reminder cadence continues until paid or marked disputed/finance review.
- Escalation recommendations are advisory — manual follow-up required.

**Dispute workflow:**

- Customer may submit dispute request at `/customer/invoices` (audit: `monthly_invoice_dispute_requested`).
- Admin marks batch disputed or finance review from collections dashboard.
- Add collections note (`dispute`, `finance_review`, `payment_arrangement`, etc.).

**What remains manual (Phase 8):**

- Invoice void / debt write-off (not automated)
- Payment recording (Phase 6 sync only)
- WhatsApp/SMS reminders (email only)

See **Phase 9** for manual account suspension and credit governance.

### Manual credit governance (Phase 9)

Requires flags through `ZOHO_MONTHLY_CREDIT_GOVERNANCE_ENABLED=true` (billing + collections + operations chain).

**Finance governance SOP:**

1. Review `/admin/operations/monthly-governance` each business day.
2. Set credit limits for approved monthly accounts based on finance policy.
3. Monitor exposure exceeded and high-risk collections cross-references.
4. Start finance review (`account_review_required`) when exposure band is elevated or collections escalates.
5. Place **finance hold** for advisory warnings at authorization — does not block unless suspended.
6. Mark **disputed** when customer or batch dispute is confirmed; link collections notes.

**When to suspend:**

- Repeated unpaid overdue balance beyond policy AND finance lead approval
- Fraud or credit policy breach
- Customer unresponsive after documented escalation

Suspension blocks **NEW** monthly service authorization only. Existing bookings, assignments, invoice payment, and payouts continue.

**When to grant temporary override:**

- One-off service approval with documented business reason
- Exposure temporarily exceeds limit due to timing (invoice in transit)
- Override must have explicit `manual_override_until` date
- Override does **not** bypass suspension

**Collections escalation policy:**

- Low/medium risk: collections dashboard monitoring
- High/critical risk: governance review + finance hold consideration
- Disputed invoices: finance review before further authorization

**Dispute handling duplicate workflow:**

- Use governance notes (`governance_review`, `dispute_resolution`, `finance_hold`)
- Record review owner and follow-up date on collections notes
- Resolve dispute → return governance state to `approved` when finance clears account

**Customer experience:**

- Portal shows invoices and payment status only — no governance/risk/suspension internals
- Generic support path if internal authorization blocked while suspended

### Governance workflow polish (Phase 10)

Requires Phase 9 flag chain (`ZOHO_MONTHLY_CREDIT_GOVERNANCE_ENABLED`).

**Governance review SOP:**

1. Use `/admin/operations/monthly-governance` filters to prioritize high-risk, overdue, and override-expiring accounts.
2. Assign a finance review owner and follow-up date for each open review.
3. Resolve or dismiss reviews with documented resolution text — all actions are audited.
4. Use the customer governance timeline (dashboard or customer billing panel) for context before action.

**Override expiry process:**

1. Review accounts with override expiring within 7 days (filter or internal alerts).
2. Confirm whether override should be renewed manually or allowed to expire.
3. Expired overrides are reflected by date comparison only — no automatic account state change.

**Bulk review policy:**

- Allowed: mark finance review, add note, assign owner, export selected
- Forbidden: bulk suspend, unsuspend, override, credit limit changes
- Every bulk action requires a reason

**Finance follow-up workflow:**

1. Set `follow_up_date` when starting or assigning a review.
2. Internal dashboard alerts surface follow-ups due today or overdue.
3. Complete follow-up manually; update review status to resolved or dismissed.

**What remains manual:**

- Suspension and unsuspension (per account, reason required)
- Credit limit changes and temporary overrides
- Invoice void, debt write-off, payment recording
- Booking lifecycle, assignment dispatch, and payouts

### Payment sync (Phase 6)
