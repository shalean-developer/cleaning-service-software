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

- **Fleet diagnostics:** `/admin/operations/production-rollout` (read-only panel)
- **API:** `GET /api/admin/bookings/assist-diagnostics`
- **Per booking:** Admin booking detail assist payment timeline
- **List filters:** Admin-assisted, awaiting payment, link sent/expired, paid via offline/Paystack link

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
