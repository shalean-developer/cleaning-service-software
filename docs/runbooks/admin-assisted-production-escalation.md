# Admin-assisted booking — production escalation guide

**Last updated:** 2026-05-23

## Severity levels

| Level | Examples | Response |
|-------|----------|----------|
| **Critical** | Stale pending >72h at scale; confirmed without assignment; repeated orphan confirmed | Ops lead within 1 business hour |
| **Warning** | Failed payment emails; offline payment failures; recurring without group | Operator + ops channel same day |
| **Info** | Expired link UI with pending; high regenerate rate | Operator follow-up; no emergency |

## Incident handling

1. Capture booking ID, customer label, payment reference, rollout stage.
2. Open booking detail → support summary + assist timeline.
3. Check operational alerts on `/admin/operations/admin-assisted-bookings`.
4. Export pilot CSV/JSON if multiple bookings affected.
5. Do **not** bypass `finalizePaidBooking` or manual-assign without payment audit.

## Rollback procedure

1. `ADMIN_ASSISTED_OFFLINE_PAYMENTS_ENABLED=false`
2. `ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED=false`
3. `ADMIN_ASSISTED_BOOKING_ENABLED=false` (if needed)
4. Keep diagnostics and finance pages online.
5. Re-enable only after checklist blockers cleared.

## Payment disputes

- **Paystack link:** Check Paystack dashboard + webhook logs; late settlement may confirm after UI expiry.
- **Offline:** Match `admin_offline_payment_events` evidence to bank/cash records; verify `sopConfirmed` audit.

## Recurring failures

- Check booking recurring panel and `/admin/recurring`.
- Alert `paid_without_recurring_group` or `recurring_materialization_failed` — escalate to engineering if materialization logs show errors.

## Contacts

- Ops channel: `#admin-assist-pilot`
- Runbook: [admin-assisted-booking-rollout.md](./admin-assisted-booking-rollout.md)
