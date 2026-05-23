# Admin-assisted booking — operator handbook

**Last updated:** 2026-05-23

## Daily checklist

1. Check rollout stage on wizard banner or operations dashboard.
2. Review operational alerts (critical first).
3. Clear stale pending payments (>72h).
4. Complete pilot QA checklist items on production rollout page as flows are tested.

## Creating a booking

1. `/admin/bookings/create` — select customer, service, address, schedule.
2. Draft → pending payment when ready.
3. Send Paystack link or record offline (per rollout stage).

## Payment paths

| Stage | Allowed |
|-------|---------|
| draft_only | Draft + pending only |
| payment_links | + Paystack links + email/WhatsApp |
| offline_eft | + EFT recording with SOP checkbox |
| offline_full | + cash + card machine |

## SOP reminders

- **EFT:** verify bank reference before recording.
- **Cash:** verify receipt against till.
- **Regenerated links:** old customer instructions are invalid — send new link/message.
- **Assignment:** starts only after payment confirmation.

## Expired links

UI expiry does not always mean Paystack cannot settle late. Regenerate only if the customer confirms they did not pay.

## Where to get help

- Operations dashboard: `/admin/operations/admin-assisted-bookings`
- Pilot QA: `/admin/operations/admin-assisted-pilot`
- Alert meanings: [admin-assisted-alert-interpretation.md](./admin-assisted-alert-interpretation.md)
