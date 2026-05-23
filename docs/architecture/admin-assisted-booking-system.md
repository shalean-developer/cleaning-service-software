# Admin-assisted booking system — architecture

**Status:** Phase 4D — payment request notifications (email queue, WhatsApp copy)  
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

| Phase | Scope | Mutations |
|-------|--------|-----------|
| **1** | Read-only wizard, docs, flag, nav fixes | None |
| **2** | `adminCreateBookingDraftFacade`, audit + idempotency tables, `POST /api/admin/bookings/draft` | Draft only (shipped) |
| **3** | Full wizard wiring | Create pending |
| **4** | Payment links | Paystack init (shipped) |
| **4C** | Payment request visibility | List filters, assist audit timeline, regenerate/supersede (shipped) |
| **4D** | Payment request notifications | Email outbox, WhatsApp copy-only, resend, audit (shipped) |
| **5** | Offline payments | → `finalizePaidBooking` |
| **6** | Parity QA | — |
| **7** | Notifications / analytics | — |
| **8** | Rollout checklist | — |

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

## Routes (target)

| Route | Phase |
|-------|-------|
| `GET /admin/bookings/create` | 1 (UI) |
| `POST /api/admin/bookings/draft` | 2 |
| `POST /api/admin/bookings` | 2–3 |
| `POST /api/admin/bookings/[id]/payment-link` | 4 |
| `POST /api/admin/bookings/[id]/payment-request/send` | 4D |
| `POST /api/admin/bookings/[id]/offline-payment` | 5 |

Customer routes (`/api/bookings/lock`, `/api/paystack/*`) remain **unchanged**.

## Wizard steps (8)

1. Customer — search, inline create, duplicates, notes  
2. Service — type, extras, team, frequency, duration  
3. Schedule — date, time, recurring, availability  
4. Address — suburb, city, access, geo  
5. Pricing — `calculateQuote()`, discounts (audited), invoice preview  
6. Payment — rail selection  
7. Review — lifecycle, assignment, notification preview  
8. Confirmation — draft / unpaid / paid / payment request (disabled until Phase 2+)

## Commands (planned)

| Facade command | Underlying commands |
|----------------|---------------------|
| `ADMIN_CREATE_BOOKING_DRAFT` | `CREATE_BOOKING_DRAFT` |
| `ADMIN_CREATE_BOOKING` | draft + payment rail |
| `ADMIN_GENERATE_PAYMENT_LINK` | `MARK_PAYMENT_PENDING` + Paystack |
| `ADMIN_RECORD_OFFLINE_PAYMENT` | payment row + `finalizePaidBooking` |
| `ADMIN_CONVERT_QUOTE_TO_BOOKING` | create from saved quote |
| `ADMIN_CREATE_CORPORATE_BOOKING` | draft + billing metadata |

## Payment rails

All **paid** rails → `finalizePaidBooking()` → `FINALIZE_PAYMENT_SUCCESS` → `confirmed`.

| Rail | Pending | Paid |
|------|---------|------|
| Paystack link | `pending_payment` | `confirmed` |
| EFT / cash / card machine | `pending_payment` | `confirmed` via offline adapter |
| Corporate invoice | `pending_payment` / `draft` | when recorded |
| Unpaid | `pending_payment` | no finalize until paid |

**Zoho invoice rail** (`zoho_invoice_payments`) stays separate; optional metadata link only.

## Security

- No direct DB writes from UI  
- No `ADMIN_OVERRIDE_STATUS` in wizard  
- Service role only inside facades  
- Idempotency keys on every mutation  
- CI: `mutationRouteBoundaryGuard`, `facadeCommandBoundaryManifest`

## Database (proposed — not migrated in Phase 1)

- `admin_booking_assist_audit`  
- `admin_booking_assist_idempotency`  
- `admin_booking_quotes` (optional)  
- `bookings.metadata.adminAssist`  

## Feature flag

```bash
# .env — server only
ADMIN_ASSISTED_BOOKING_ENABLED=false
ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED=false
```

Payment links require both flags. Phase 4D queues **email** via `notification_outbox` (`admin_assisted_payment_request_sent`); WhatsApp is **copy-only** until a provider exists. Resend reuses the active link (new idempotency key); expired links require regenerate first.

## UI (Phase 1)

- **Path:** `/admin/bookings/create`  
- **Module:** `src/features/admin-booking-wizard/`  
- Desktop: stepper + sticky summary sidebar  
- Mobile: progress bar + summary sheet  
- Design-mode banner; all mutation buttons disabled  

## Related docs

- [admin-manual-booking-creation-audit.md](../audits/admin-manual-booking-creation-audit.md)  
- [booking-command-execution-layer.md](./booking-command-execution-layer.md)  
- [booking-lock-before-payment.md](../booking/booking-lock-before-payment.md)  
- [customer-booking-wizard.md](../booking/customer-booking-wizard.md)  
