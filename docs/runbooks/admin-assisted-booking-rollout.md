# Admin-assisted booking — production rollout runbook

**Status:** Phase 6 — parity QA and staged rollout  
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

## Test commands

```powershell
npx vitest run src/features/bookings/server/admin/adminAssistedPaymentFlow.integration.test.ts
npx vitest run src/features/bookings/server/admin/adminAssistedOfflinePaymentFlow.integration.test.ts
npx vitest run src/features/bookings/server/admin/customerBookingFlow.regression.test.ts
npx vitest run src/features/bookings/server/admin/adminAssistedBooking.phase6.test.ts
npx vitest run src/features/bookings/server/admin/resolveAdminAssistPaidVia.test.ts
npx vitest run src/features/bookings/server/admin/buildAdminBookingAssistTimeline.test.ts
npx vitest run src/tests/security/mutationRouteBoundaryGuard.test.ts
```

## Observability

- **Fleet diagnostics:** `/admin/operations/admin-assisted-bookings`
- **Pilot QA panel:** `/admin/operations/admin-assisted-pilot`
- **API:** `GET /api/admin/bookings/assist-diagnostics`, `GET /api/admin/bookings/assist-pilot/export`
- **Per booking:** Assist timeline, QA checklist, operator feedback, dry-run banner
- **List filters:** Admin-assisted, awaiting payment, link sent/expired, paid via offline/Paystack link

## Operator dry-run SOP (Phase 7B)

1. Enable `ADMIN_ASSISTED_BOOKING_PILOT_MODE=true` (auto-labels new drafts as pilot/dry-run).
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
- Active Paystack link requires explicit supersede confirmation.

## Recovery flows

| Situation | Action |
|-----------|--------|
| Expired payment link | Regenerate link (wizard recovery panel or booking detail) |
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
