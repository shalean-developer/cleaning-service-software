# Move In/Out Cleaning — UX optimization report

**Date:** 2026-05-20  
**Scope:** Presentation-only UX for `moving-cleaning` (Move In/Out Cleaning)  
**Baseline:** `docs/audits/moving-cleaning-end-to-end-audit.md`  
**Status:** Complete — no pricing, payment, dispatch, lifecycle, or earnings logic changed.

---

## Summary

Move In/Out Cleaning now uses centralized display helpers (`movingCleaningDisplay.ts`, `movingCustomerDisplay.ts`, `movingOperationalDisplay.ts`) wired through the same router pattern as Airbnb Cleaning. The experience emphasizes move-ready preparation, inspection/handover, and vacant-property context instead of generic residential or turnover language.

---

## Before vs after (examples)

| Surface | Before | After |
|---------|--------|-------|
| Step 1 mobile | "Move-in or move-out reset" | "Move-ready property preparation" |
| Step 1 desktop | Generic floors/surfaces | Handover, inspection, vacant home reset |
| Step 1 card title | "Moving Cleaning" | **"Move In/Out Cleaning"** (wizard only) |
| Step 4 intro | "Your home & options" | "Property & move preparation" |
| Step 4 add-ons | Default order; laundry mid-list | Inspection-first order; **"Most requested for move-out…"** hint |
| Step 4 notes | Gate code / pets | Move-in/out, keys, inspection, utilities |
| Step 5 cleaner | Generic cleaner copy | Move preparation / vacant property / handover |
| Review hero | Service · beds · frequency · time | **Time · location · beds · extras · frequency** |
| Checkout | Generic confirmation steps | "Move cleaning scheduled" + handover note |
| Customer status | "Matching a cleaner…" | "Preparing cleaner assignment for handover" |
| Cleaner job | Generic review/start/complete | Access, inspection areas, handover-ready |
| Admin list | No service badge | **Move clean** (+ Handover day when same-day) |

---

## Files changed

**New**
- `src/features/booking-wizard/movingCleaningDisplay.ts`
- `src/features/booking-wizard/movingCleaningDisplay.test.ts`
- `src/features/booking-wizard/movingCleaning.launchReadiness.test.ts`
- `src/features/dashboards/movingCustomerDisplay.ts`
- `src/features/dashboards/movingCustomerDisplay.test.ts`
- `src/features/dashboards/movingOperationalDisplay.ts`
- `src/features/dashboards/movingOperationalDisplay.test.ts`
- `docs/audits/moving-cleaning-ux-optimization.md`

**Wizard / routing**
- `airbnbCleaningDisplay.ts` (moving delegation routers)
- `constants.ts`, `addonStepDisplay.ts`, `recurringDisplay.ts`, `wizardBookingSummaryDisplay.ts`
- `DetailsStepPanel` via `AddonsStepPanel`, `ReviewStepPanel`, `CheckoutStepPanel`

**Dashboards / payment**
- `customerBookingDetailDisplay.ts`, `customerBookingListCardDisplay.ts`, `cleanerJobDetailDisplay.ts`
- `adminBookingDetailDisplay.ts`, `adminBookingListBadges.ts`, `adminBookingListDisplay.ts`
- Customer/cleaner/admin components and app pages (bookings, jobs, admin home, assignments)
- `PaymentReturnPanels.tsx`, `paymentFailedPage.ts`, `PaymentIssuePanel.tsx`, `airbnbCustomerDisplay.ts` (payment slug parse)

---

## Tests added / run

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass |
| `npx vitest run moving` | 25 passed |
| `npx vitest run src/features/booking-wizard` (+ moving dashboard tests) | 219 passed |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Catalog label still "Moving Cleaning" in DB/admin raw labels | Low | Wizard shows "Move In/Out Cleaning"; admin badges say "Move clean" |
| Recurring frequency still available (pricing unchanged) | Product | Softer labels only; document if once-off should hide UI later |
| Laundry add-on still bookable | Product | Reordered last; subtitle notes "if on site" |
| Dual Airbnb + moving badges impossible on one booking | None | Mutual exclusive slugs |

---

## Product recommendations (no code)

1. Consider hiding recurring frequency for move cleans if product is once-off only (would be a deliberate product change).
2. Marketing links should use `/customer/book/moving-cleaning` (not `move-in-out-cleaning`).
3. Optional redirect from legacy marketing slug — display/routing only.

---

## Future ideas (document only — not implemented)

- Move-out inspection checklist (customer + cleaner)
- Inventory / photo verification at handover
- Key handover workflow (collect/return)
- Landlord / property manager booking mode
- Vacant-property priority routing for same-day handover
- Appliance reset checklist (oven/fridge/cabinets)
- Move-day urgency scoring in admin queue sort

---

## Confirmation

- **Pricing:** `calculateQuote()` untouched  
- **Earnings:** Fixed R250 model unchanged  
- **Dispatch / assignment:** No behavior changes  
- **Paystack / payment:** Amount and callbacks unchanged  
- **Lifecycle statuses:** Unchanged  
- **Airbnb / Regular:** No turnover or regular-only leakage in moving tests; existing suites green
