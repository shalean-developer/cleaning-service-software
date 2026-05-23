# Admin-assisted booking system — architecture

**Status:** Phase 6 — parity QA + rollout hardening  
**Last updated:** 2026-05-23

## Purpose

Allow Shalean admins to create bookings **on behalf of customers** without forking the canonical booking lifecycle. All paid paths must converge on `finalizePaidBooking()`; all status changes must flow through `executeBookingCommand()`.

## Canonical spine (unchanged)

```
Admin/customer facades
  → executeBookingCommand (CREATE_BOOKING_DRAFT, MARK_PAYMENT_PENDING, …)
  → finalizePaidBooking (paid only)
  → runPostPaymentAssignmentDispatch
  → runPostPaymentRecurringMaterialization / runPostPaymentZohoSalesSync
```

## Phase map

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Read-only wizard, docs, flag, nav fixes | Shipped |
| **2** | Draft facade, audit + idempotency, `POST /api/admin/bookings/draft` | Shipped |
| **3** | Full wizard wiring | Shipped |
| **4** | Payment links + pending payment | Shipped |
| **4C** | List filters, assist timeline, regenerate/supersede | Shipped |
| **4D** | Payment request notifications (email + WhatsApp copy) | Shipped |
| **5** | Offline payments → `finalizePaidBooking` | Shipped |
| **6** | Parity QA, rollout checklist, diagnostics, filters | Shipped |
| **7** | Notifications / analytics | Planned |
| **8** | Full production enablement | Planned |

## Admin actor model

```typescript
type AdminBookingAssistContext = {
  adminProfileId: string;
  onBehalfOfCustomerId: string; // required
  idempotencyKey: string;
};
```

- **Not** session impersonation: admin stays `role=admin`.
- Facades pass `actingCustomerId: onBehalfOfCustomerId` only inside server handlers.

## Routes

| Route | Phase |
|-------|-------|
| `GET /admin/bookings/create` | 1 |
| `POST /api/admin/bookings/draft` | 2 |
| `POST /api/admin/bookings/[id]/pending-payment` | 4 |
| `POST /api/admin/bookings/[id]/payment-link` | 4 |
| `POST /api/admin/bookings/[id]/payment-link/copy` | 4C |
| `POST /api/admin/bookings/[id]/payment-request/send` | 4D |
| `POST /api/admin/bookings/[id]/offline-payment` | 5 |
| `GET /api/admin/bookings/assist-diagnostics` | 6 (read-only) |

Customer routes (`/api/bookings/lock`, `/api/paystack/*`) remain **unchanged**.

## Payment rails

All **paid** rails → `finalizePaidBooking()` → `FINALIZE_PAYMENT_SUCCESS` → `confirmed`.

| Rail | Pending | Paid |
|------|---------|------|
| Paystack link | `pending_payment` | `confirmed` (webhook/verify) |
| EFT / cash / card machine | `pending_payment` | `confirmed` via offline adapter |
| Corporate invoice | separate Zoho flow | — |

## Parity guarantees (Phase 6)

- No assignment before payment confirmation (integration tests).
- Admin-assisted metadata preserved on booking after finalize.
- No earnings created at payment time (only after job completion).
- Customer Paystack webhook/verify path unchanged for non-assist bookings.
- Admin list filters: `paid_via_offline`, `paid_via_paystack_link` derived from payment `provider` + assist metadata (no new lifecycle statuses).

## Security

- No direct DB writes from UI
- No `ADMIN_OVERRIDE_STATUS`
- Service role only inside facades
- Idempotency keys on every mutation
- CI: `mutationRouteBoundaryGuard` (38 routes), `adminAssistedBooking.phase6.test.ts`

## Feature flags

```bash
ADMIN_ASSISTED_BOOKING_ENABLED=false
ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED=false
ADMIN_ASSISTED_OFFLINE_PAYMENTS_ENABLED=false
```

See [admin-assisted-booking-rollout.md](../runbooks/admin-assisted-booking-rollout.md) for staged production order.

## Observability

- Production rollout page: admin-assisted diagnostics panel + checklist category `admin_assisted_booking`
- Per-booking assist timeline: draft, pending, link, offline, payment confirmed, assignment started

## Related docs

- [admin-assisted-booking-rollout.md](../runbooks/admin-assisted-booking-rollout.md)
- [admin-manual-booking-creation-audit.md](../audits/admin-manual-booking-creation-audit.md)
- [booking-command-execution-layer.md](./booking-command-execution-layer.md)
