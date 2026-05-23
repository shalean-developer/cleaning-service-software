# Admin manual booking creation — audit

**Date:** 2026-05-23  
**Scope:** Readiness for admin-assisted booking (create on behalf of customer)  
**Phase 1 status:** Read-only UI shell shipped; mutations deferred.

## Executive summary

Admin booking creation readiness is **2/10** for production mutations. The canonical lifecycle engine, payment finalize path, and assignment/earnings stacks are mature. What is missing is a **safe admin façade** with explicit `onBehalfOfCustomerId`, HTTP entry points, and payment rails that converge on `finalizePaidBooking()`.

Phase 1 adds `/admin/bookings/create` as a **design preview only** — no commands, no API mutations, feature flag off by default.

## Findings

### Routes and UI

| Item | Status |
|------|--------|
| `/admin/bookings` (list/ops) | Exists |
| `/admin/bookings/create` | **Added Phase 1** (read-only wizard) |
| `/admin/customers/[id]/bookings/create` | Not yet (Phase 3+) |
| Customer `/customer/book` | Exists; unchanged |

### Command layer

| Command | Production HTTP |
|---------|-----------------|
| `CREATE_BOOKING_DRAFT` | Customer lock only (`/api/bookings/lock`) |
| `ADMIN_CREATE_BOOKING` | **Does not exist** |
| `FINALIZE_PAYMENT_SUCCESS` | Paystack webhook/verify only |
| `ADMIN_OVERRIDE_STATUS` | No HTTP route (intentional) |

`bookingCommandGuards.ts` allows `admin` on `CREATE_BOOKING_DRAFT` in tests; production admin actors have **no** `actingCustomerId` from `resolveActorScope.ts`.

### Payment and ownership gates

- `createBookingPaymentLock.ts` — requires `role === "customer"` and `actingCustomerId`
- `initializePayment.ts` — same
- `finalizePaidBooking.ts` — service role; not callable from admin UI

### Payment rails gap

| Rail | Status |
|------|--------|
| Paystack online (customer) | Production |
| Zoho invoice Paystack link | Production (separate table) |
| EFT / cash / card machine | **Missing** |
| Admin payment link for booking | **Missing** |
| Corporate monthly invoice → booking | **Missing** |

### Audit and flags

- `ADMIN_CUSTOMER_ASSISTED_BOOKING_SUPPORTED = false` in `adminCustomerBookingAssist.ts`
- `ADMIN_ASSISTED_BOOKING_ENABLED` env flag — **false by default** (Phase 1)
- `admin_booking_assist_audit` table — **not yet** (Phase 2+)

### Misleading labels (fixed Phase 1)

- “New booking” on customer registry → **New customer**
- “Quick booking” sidebar → **New customer**
- “Booking flow” → **Customer booking flow**

## Risks if built without architecture

1. Direct `bookings` inserts from admin UI  
2. `ADMIN_OVERRIDE_STATUS` to skip payment  
3. Assignment without `finalizePaidBooking`  
4. Earnings without `metadata.quote` snapshot  
5. Dual payment authority (Zoho + booking) without boundary  

## Recommended implementation order

See [admin-assisted-booking-system.md](../architecture/admin-assisted-booking-system.md).

## Phase 1 deliverables (this audit cycle)

- [x] Architecture document  
- [x] Read-only wizard at `/admin/bookings/create`  
- [x] Feature flag `ADMIN_ASSISTED_BOOKING_ENABLED=false`  
- [x] Nav label corrections  

## Phase 2 deliverables

- [x] `admin_booking_assist_audit` + `admin_booking_assist_idempotency` migrations  
- [x] `adminCreateBookingDraftFacade` → `CREATE_BOOKING_DRAFT` only  
- [x] `POST /api/admin/bookings/draft` (no `POST /api/admin/bookings`)  
- [x] Wizard “Save draft” when `ADMIN_ASSISTED_BOOKING_ENABLED=true`  
- [ ] Payment links / offline record (Phase 4–5)  
- [ ] `ADMIN_CREATE_BOOKING` full create (Phase 3+)  

## Related code

- `src/features/customers/server/admin/adminCustomerBookingAssist.ts`
- `src/features/bookings/server/commands/executeBookingCommand.ts`
- `src/features/payments/server/finalizePaidBooking.ts`
- `src/features/admin-booking-wizard/`
- `docs/architecture/booking-command-execution-layer.md`
