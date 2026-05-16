# Customer booking wizard (Phase 6)

Seven-step mobile-first flow for authenticated customers at `/customer/book`.

**UI:** `src/features/booking-wizard/`  
**Route:** `src/app/(customer)/customer/book/page.tsx`  
**Auth:** `(customer)` layout enforces `profiles.role = customer`

## Step flow

| # | Step | Collects | API (when applicable) |
|---|------|----------|------------------------|
| 1 | Service | `serviceSlug` | — |
| 2 | Date & time | `date`, `time` (Africa/Johannesburg, UTC+2) | — |
| 3 | Location | address, suburb → `areaSlug`, city, notes | — |
| 4 | Details | bedrooms, bathrooms, size, frequency, add-ons, instructions | — |
| 5 | Cleaner | best available or selected cleaner | `POST /api/cleaners/available` |
| 6 | Review | confirm checkbox, line-item total | `POST /api/pricing/quote` |
| 7 | Checkout | Paystack redirect | `POST /api/bookings/lock` then `POST /api/paystack/initialize` |

Progress is saved in `localStorage` (`shalean-booking-wizard-v1`). Quote and cleaner lists are refreshed when entering review / cleaner steps.

## APIs used

| Endpoint | When | Side effects |
|----------|------|----------------|
| `/api/cleaners/available` | After details (pre-load) and cleaner step | None — safe cards only |
| `/api/pricing/quote` | Review step | None |
| `/api/bookings/lock` | Checkout only | Server quote + eligibility; `CREATE_BOOKING_DRAFT` + `booking_locks` row |
| `/api/paystack/initialize` | After lock | `MARK_PAYMENT_PENDING` + Paystack initialize (amount from lock) |

The browser **never** sets `confirmed` or creates assignment offers.

## Validation rules

- **Service:** enabled catalog slug required  
- **Date/time:** future slot in Johannesburg timezone  
- **Location:** address, suburb, city; suburb normalized to `areaSlug`  
- **Details:** bedrooms/bathrooms per service rules; office requires `propertySizeSqm`  
- **Cleaner:** best available always allowed; selected cleaner must be `eligible`  
- **Review:** quote loaded + confirmation checkbox  
- **Checkout:** all above + `checkoutSubmitting` guard (double-submit prevention)

## Checkout behavior

1. Assign stable `checkoutIdempotencyKey` (persisted in wizard storage).  
2. `POST /api/bookings/lock` with quote snapshot (`buildLockRequestPayload`). Server recalculates price and revalidates cleaner eligibility.  
3. On `QUOTE_MISMATCH`, `LOCK_EXPIRED`, or `LOCK_INPUT_MISMATCH`, return to **Review**, clear quote, and show an error.  
4. `POST /api/paystack/initialize` with `bookingId`, `lockId`, `paymentIdempotencyKey`, and `callbackUrl` (`/payment/success`) — no client price.  
5. Server moves booking to `pending_payment` and returns `authorization_url`.  
6. Client redirects to Paystack. After payment, Paystack returns to `/payment/success`, which calls verify and redirects to the booking detail page. Production also uses webhook finalize.

## Security

- Customer session required (`getCurrentUser` on book page + API routes).  
- No `service_role` in client bundles.  
- Cleaner APIs return `CleanerPublicCard` only.  
- No direct `bookings.status` updates from the browser.

## Deferred

| Phase | Item |
|-------|------|
| **8** | Assignment offers, auto-assign, `assignBestCleaner` |
| **9** | Customer booking dashboard |
| **10** | Earnings lines on completion |

## Related

- [Pricing engine](../pricing/pricing-engine.md)  
- [Cleaner eligibility](../cleaners/cleaner-availability-eligibility.md)  
- [Booking lock before payment](./booking-lock-before-payment.md)  
- [Paystack foundation](../payments/paystack-foundation.md)
