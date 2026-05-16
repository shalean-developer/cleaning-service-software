# Customer, cleaner, and admin dashboards (Phase 9)

Role-specific dashboards read booking lifecycle state through RLS-scoped Supabase clients and shaped read models. They do **not** mutate `bookings.status` directly.

## Route map

| Role | Route | Purpose |
|------|-------|---------|
| Customer | `/customer` | Home + recent bookings + “Book a clean” CTA |
| Customer | `/customer/bookings` | All own bookings |
| Customer | `/customer/bookings/[bookingId]` | Detail, payments, lifecycle timeline |
| Cleaner | `/cleaner` | Home summary |
| Cleaner | `/cleaner/offers` | Open/expired offers + accept/decline |
| Cleaner | `/cleaner/jobs` | Assigned jobs |
| Cleaner | `/cleaner/jobs/[bookingId]` | Job detail + lifecycle (completion deferred) |
| Admin | `/admin` | Operations home |
| Admin | `/admin/bookings` | All bookings |
| Admin | `/admin/bookings/[bookingId]` | Full ops view (audit, offers, payments) |
| Admin | `/admin/assignments` | Assignment attention queue |

Optional read-only BFF (same read models):

- `GET /api/customer/bookings`, `GET /api/customer/bookings/[bookingId]`
- `GET /api/cleaner/jobs`, `GET /api/cleaner/jobs/[bookingId]`
- `GET /api/admin/bookings`, `GET /api/admin/bookings/[bookingId]`, `GET /api/admin/assignments`

Offer actions reuse existing command-backed routes:

- `POST /api/cleaner/offers/[offerId]/accept`
- `POST /api/cleaner/offers/[offerId]/decline`

## Read-model design

| Module | Functions | Data source |
|--------|-----------|-------------|
| `customerBookingReadModel` | `listCustomerBookings`, `getCustomerBookingDetail` | `bookings` filtered by `actingCustomerId`, `payments`, `booking_state_audit` |
| `cleanerJobReadModel` | `listCleanerOffersForDashboard`, `listCleanerJobs`, `getCleanerJobDetail` | `getCleanerOffers` + `bookings` where `cleaner_id = actingCleanerId` |
| `adminOperationsReadModel` | `listAdminBookings`, `getAdminBookingDetail`, `listAdminAssignmentQueue` | Admin RLS on `bookings`, `assignment_offers`, `payments`, `payment_events`, audit |

Shared helpers: `parseBookingDisplay`, `buildLifecycleTimeline`, `statusLabels`.

UI types live in `src/features/dashboards/server/types.ts` and intentionally omit raw DB rows.

## Role access matrix

| Data | Customer | Cleaner | Admin |
|------|----------|---------|-------|
| Own bookings | Yes | Assigned only | All |
| Other customers’ bookings | No | No | Yes |
| Payment rows | Own booking | No | Yes |
| Assignment offers | No | Own offers | All for booking |
| Cleaner full name | Label only when assigned | Self | Yes |
| Customer company name | Self (via booking) | No | Yes |
| `booking_state_audit` | Own booking timeline | Own job timeline | Full list |
| Direct `bookings.status` update | No | No | No |

## Lifecycle display rules

- **Booking status** — labels from `statusLabels.ts` (`pending_payment`, `pending_assignment`, `assigned`, etc.).
- **Payment status** — from latest `payments.status`, not inferred from booking alone.
- **Assignment** — `metadata.assignment` drives admin attention; open `assignment_offers` shown on admin/cleaner surfaces.
- **Timeline** — merged booking creation, audit command transitions, and payment events.
- **Expired offers** — shown as expired on cleaner offers; accept/decline disabled.

## Admin attention states

Queue includes bookings where:

- `status` is `pending_assignment` or `confirmed`, and
- `metadata.assignment.status === "attention_required"`, or
- there are open offers (`assignment_offers.status === "offered"`).

Labels: “Needs assignment”, “Offer sent”, booking status badges.

## Phase 10 additions

- Cleaner job start/complete actions on `/cleaner/jobs/[bookingId]`
- Cleaner earnings at `/cleaner/earnings`
- Admin payout queue at `/admin/payouts` and actions on booking detail
- Customer does not see payout substates (`payout_ready`, `paid_out` shown as completed-style labels only)

## Deferred (post Phase 10)

- External bank / Paystack transfer automation
- Customer confirmation gate before completion

## Security notes

- No `service_role` in client components.
- All writes go through existing booking commands (offer accept/decline only on cleaner APIs).
- Static guard `bookingStatusMutationGuard.test.ts` ensures no new direct `bookings.status` patches in app code.
