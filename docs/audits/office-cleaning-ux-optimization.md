# Office Cleaning UX optimization — deliverable

**Date:** 2026-05-20  
**Phase:** Presentation-only (no pricing, payment, dispatch, earnings, or lifecycle logic changes)  
**Baseline audit:** `docs/audits/office-cleaning-end-to-end-audit.md`

---

## Summary

Office Cleaning now uses centralized display modules (same pattern as Move In/Out, Deep, and Airbnb) so the flow reads as **commercial workspace maintenance** rather than residential home cleaning.

**Logic unchanged:** `calculateQuote`, sqm pricing, cleaner earnings, assignment, payment finalization, and booking lifecycle.

---

## Before vs after (examples)

| Surface | Before | After |
|---------|--------|-------|
| Step 1 mobile | "Commercial spaces — size may apply" | "Professional workspace cleaning" |
| Step 1 desktop | Short commercial line | "Reliable office and commercial cleaning — maintain a clean, productive work environment." |
| Step 2 helper | Generic future-booking copy | "Schedule around office hours or after-hours access…" |
| Step 3 access | "Gate code, pets…" | Reception, suite, parking, after-hours, alarm placeholder |
| Step 4 intro | "Your home & options" | "Workspace details" |
| Step 4 size | "Home size" / "Property size (sqm)" | "Workspace size" / "Workspace size (sqm)" |
| Step 4 add-ons | Generic order + labels | Commercial order (windows, walls, kitchenette first) + hint |
| Step 5 cleaner | Generic residential | "Experienced cleaners for commercial environments" |
| Step 6 review hero | `serviceLabel · sqm · frequency · schedule` mixed | Schedule → location → sqm → extras → cadence |
| Step 7 checkout | Generic 3 bullets | "Office cleaning scheduled" → email → workspace assignment |
| Payment success | Generic home booking | "Your office cleaning is scheduled" + workspace next steps |
| Customer status | "Your clean is in progress" | "Commercial cleaning in progress" |
| Cleaner guidance | Generic 3-step | Workspace access, common areas, active desks, professional finish |
| Admin badges | Lifecycle only | + "Office clean", "Recurring workspace", "Service today" |

---

## Files changed

### New modules

| File | Role |
|------|------|
| `src/features/booking-wizard/officeCleaningDisplay.ts` | Wizard copy, review/checkout, customer/cleaner status lines, admin badges |
| `src/features/dashboards/officeCustomerDisplay.ts` | Payment return, list, detail customer copy |
| `src/features/dashboards/officeOperationalDisplay.ts` | Cleaner/admin/ops queue copy |
| `src/features/booking-wizard/officeCleaning.launchReadiness.test.ts` | Launch guardrails |
| `src/features/booking-wizard/officeCleaningDisplay.test.ts` | Display unit tests |

### Integration (routing only)

| Area | Files |
|------|-------|
| Wizard router | `airbnbCleaningDisplay.ts`, `constants.ts`, `addonStepDisplay.ts`, `wizardBookingSummaryDisplay.ts`, `reviewDisplay.ts`, `DetailsStepPanel.tsx`, `ReviewStepPanel.tsx`, `WizardContextStrip.tsx` |
| Customer | `customerBookingDetailDisplay.ts`, `customerBookingListCardDisplay.ts`, `CustomerBookingDetailsCard.tsx`, `CustomerBookingStatusHero.tsx`, `PaymentReturnPanels.tsx`, `PaymentIssuePanel.tsx`, `paymentFailedPage.ts`, `airbnbCustomerDisplay.ts`, customer booking page |
| Cleaner | `cleanerJobDetailDisplay.ts`, `CleanerJobDetailsCard.tsx`, `CleanerJobStatusHero.tsx`, `CleanerOfferListCard.tsx`, `CleanerJobListCard.tsx`, `CleanerOfferCard.tsx`, cleaner job page |
| Admin | `adminBookingListBadges.ts`, `adminBookingListDisplay.ts`, `adminBookingDetailDisplay.ts`, `AdminBookingListRow.tsx`, `AdminCustomerBookingCard.tsx`, admin booking detail/home, `AdminAssignmentsQueueWorkbench.tsx` |

---

## Tests added

- `officeCleaning.launchReadiness.test.ts` — slug, quote 120 sqm, lock strip, metadata, validation, sidebar labels, forbidden wording guard
- `officeCleaningDisplay.test.ts` — slug guard, step/review/checkout bundles

**Run:**

```text
npm run typecheck → pass
npx vitest run src/features/booking-wizard/officeCleaning → 29 passed
npx vitest run src/features/booking-wizard src/features/pricing/server src/features/dashboards → 563 passed, 2 failed (pre-existing payment_failed label tests, unrelated to office)
```

---

## Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Residential add-ons still priced | Low | IDs unchanged; only order/labels/hints changed |
| No business-name field | Low | Documented future idea |
| Cleaner job `serviceSlug` from label on detail page | Low | Same pattern as Airbnb; metadata slug preferred later |
| Two unrelated dashboard test failures | Low | `lifecycleTimeline.test.ts`, `dashboardReadModels.test.ts` — not introduced by this PR |

---

## Product recommendations

1. Ship commercial copy to production — technical path unchanged.
2. Consider **hiding** oven/fridge/laundry add-ons for office in a future pass if customers find them confusing (would be display-only hide, not catalog removal).
3. Add **business name** and **after-hours flag** as optional metadata when product approves schema extension.

---

## Future ideas (document only — not implemented)

- Business accounts and multi-office management
- After-hours routing and dispatch windows
- Workspace zones (desks, meeting rooms, kitchenette)
- Office inventory / restocking line items
- Recurring contract mode with B2B invoicing
- Team scheduling windows for large offices

---

## Confirmation

| Constraint | Status |
|------------|--------|
| `calculateQuote()` unchanged | Yes |
| Sqm pricing unchanged | Yes |
| Cleaner earnings unchanged | Yes |
| Assignment/dispatch unchanged | Yes |
| Lifecycle/payment/finalization unchanged | Yes |
| Other services unaffected | Yes (routing checks office slug first; no changes to their modules) |
