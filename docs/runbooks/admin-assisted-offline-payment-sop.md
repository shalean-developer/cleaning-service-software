# Admin-assisted booking — offline payment SOP

**Last updated:** 2026-05-23

## Before recording

1. Confirm booking is admin-assisted and in `pending_payment`.
2. Verify amount matches booking `price_cents` exactly.
3. Reconcile against the correct source:
   - **EFT:** bank statement / deposit reference
   - **Cash:** till receipt / cash book
   - **Card machine:** terminal batch report
4. If an active Paystack link exists, confirm with the customer whether they already paid online before superseding.

## Recording (UI)

1. Open booking detail → Offline payment panel.
2. Enter rail-specific reference (bank / receipt / terminal).
3. Enter evidence reference and reason.
4. Check **“I verified this payment against bank/cash/terminal records before recording.”**
5. Submit — audit stores `sopConfirmed: true`.

## After recording

- Booking finalizes via `finalizePaidBooking(source=offline)` only.
- Assignment dispatch runs post-confirmation — never record offline before verification.
- Do not manual-assign if dispatch appears stuck; escalate per production escalation guide.

## Rollback / dispute

- Do not delete `admin_offline_payment_events` or assist audit rows.
- Disable `ADMIN_ASSISTED_OFFLINE_PAYMENTS_ENABLED` if systemic issues appear.
- Finance reviews evidence reference + provider reference before any reversal workflow.
