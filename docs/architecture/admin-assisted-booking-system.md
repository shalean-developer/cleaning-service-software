# Admin-assisted booking system — architecture

**Status:** Phase 10 — production learning + incident review  
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
| **7A** | Operator visibility, recovery UX, analytics, pilot banner | Shipped |
| **7B** | Dry-run labeling, feedback, QA checklist, friction, exports | Shipped |
| **8** | Controlled production rollout, alerts, SOP enforcement, checklist readiness | Shipped |
| **9** | Live production observability, health score, incidents, weekly reporting | Shipped |
| **10** | Incident review, operator lessons, weekly review, backlog, decision support, learning exports | Shipped |

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
| `GET /api/admin/bookings/[id]/assist-summary` | 7A (lightweight refresh) |
| `GET /api/admin/bookings/assist-pilot` | 7B (QA panel) |
| `GET /api/admin/bookings/assist-pilot/export` | 7B (CSV/JSON) |
| `POST /api/admin/bookings/[id]/assist-feedback` | 7B |
| `PUT /api/admin/bookings/[id]/assist-qa-checklist` | 7B |
| `GET /api/admin/bookings/assist-production/weekly-export` | 9 |
| `POST /api/admin/bookings/assist-incidents/review` | 10 |
| `GET /api/admin/bookings/assist-production/learning-export` | 10 |

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
ADMIN_ASSISTED_BOOKING_PILOT_MODE=false
ADMIN_ASSISTED_BOOKING_DRY_RUN_LABEL=false
```

When `ADMIN_ASSISTED_BOOKING_PILOT_MODE=true` or `ADMIN_ASSISTED_BOOKING_DRY_RUN_LABEL=true`, new drafts receive `metadata.adminAssist.pilotDryRun=true` (labeling only — real payment/assignment flows). Pilot mode alone enables both the operator banner and dry-run metadata stamping.

See [admin-assisted-booking-rollout.md](../runbooks/admin-assisted-booking-rollout.md) for staged production order.
See [admin-assisted-booking-pilot-performance.md](./admin-assisted-booking-pilot-performance.md) for pilot scale thresholds.

## Observability

- Production rollout page: admin-assisted diagnostics panel + checklist category `admin_assisted_booking`
- Production learning dashboard: incident review, weekly review, lessons, backlog, advisory rollout decision
- Per-booking assist timeline: draft, pending, link, offline, payment confirmed, assignment started

## Related docs

- [admin-assisted-booking-rollout.md](../runbooks/admin-assisted-booking-rollout.md)
- [admin-assisted-observability-handbook.md](../runbooks/admin-assisted-observability-handbook.md)
- [admin-assisted-incident-response-sop.md](../runbooks/admin-assisted-incident-response-sop.md)
- [admin-manual-booking-creation-audit.md](../audits/admin-manual-booking-creation-audit.md)
- [booking-command-execution-layer.md](./booking-command-execution-layer.md)
