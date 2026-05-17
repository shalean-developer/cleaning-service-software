# Stage 6 stabilization audit

Presentation-only review of dashboard surfaces after Stage 6 feature work (6A–6F). No lifecycle, payment, assignment, notification, RLS, or API semantics were in scope for fixes.

**Audit date:** 2026-05-18  
**Fix pack:** Phase 1 (highest-value consistency) — implemented

---

## Findings (pre-fix)

| Area | Issue | Severity |
|------|--------|----------|
| Customer home | Fetch failure showed “No bookings yet” empty state | High |
| Admin bookings list | Fetch failure used plain red `<p>` instead of `DashboardFetchError` | Medium |
| Cleaner earnings | Fetch failure conflated with empty earnings | Medium |
| Admin search `q` | 1–2 character queries ignored server-side with no UI hint | Low |
| Admin `payment_failed` rows | Duplicate payment badges (status + payment status + attention) | Low |
| Admin booking detail | Assignment badge used `assignmentAttention` only; list uses `assignmentVisibilityKey` | Low |
| Loading UX | Missing `loading.tsx` on `/customer` and `/cleaner/jobs/[bookingId]` | Low |

---

## Phase 1 fixes (implemented)

| # | Fix | Module(s) |
|---|-----|-----------|
| 1 | Customer home: `DashboardFetchError` on failed fetch; `EmptyState` only when `result.ok` and empty | `src/app/(customer)/customer/page.tsx` |
| 2 | Admin bookings: `DashboardFetchError` replaces red paragraph | `src/app/(admin)/admin/bookings/page.tsx` |
| 3 | Cleaner earnings: separate fetch error vs empty (matches offers/jobs) | `src/app/(cleaner)/cleaner/earnings/page.tsx` |
| 4 | Admin `q` &lt; 3: helper “Search uses 3 or more characters.” (input not cleared) | `AdminBookingsFilters.tsx`, `isAdminBookingSearchIgnored` |
| 5 | Admin list/detail: hide generic payment status badge when `status === payment_failed` | Admin bookings list + detail pages |
| 6 | Admin detail: assignment badge uses `assignmentVisibilityKey` with list tone parity | `src/app/(admin)/admin/bookings/[bookingId]/page.tsx` |
| 7 | `loading.tsx` for customer home + cleaner job detail | `customer/loading.tsx`, `cleaner/jobs/[bookingId]/loading.tsx` |

### Explicitly unchanged

- Booking lifecycle and status values
- Payment commands, retry eligibility, Paystack
- Assignment dispatch/recovery
- Notification worker and outbox
- RLS policies
- Admin filter/search SQL semantics (`MIN_ADMIN_BOOKING_SEARCH_LENGTH` still 3)
- APIs and command routes

---

## Deferred (post Phase 1)

| Item | Notes |
|------|--------|
| Merge overlapping admin filter presets in UI | Presentation/IA; no SQL change in Phase 1 |
| Customer email in admin search | Already deferred in 6C |
| Cleaner sticky action bars / bottom nav | 6F-4 / 6F-5 |
| Admin home summary `matchTotal` beyond cap | Out of 6C scope |
| Cursor pagination / export cap increase | 6E-3 |

---

## Verification

```bash
npm run typecheck
npm run test -- src/app/stage6StabilizationPhase1.test.ts src/features/dashboards/server/adminBookingsListQuery.test.ts src/components/dashboard/AdminBookingsFilters.test.tsx
```
