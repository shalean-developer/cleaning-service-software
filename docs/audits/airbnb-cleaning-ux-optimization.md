# Airbnb Cleaning UX optimization — audit & delivery

**Date:** 2026-05-19  
**Phase:** Presentation-only UX polish for hosts and turnover operations  
**Canonical slug:** `airbnb-cleaning` (unchanged)  
**Constraint:** No lifecycle, payment, dispatch, or pricing engine changes

---

## Executive summary

Airbnb Cleaning now reads as a **host turnover product** across the booking wizard, customer/cleaner dashboards, and admin list badges. All changes flow through a single display module (`airbnbCleaningDisplay.ts`) keyed by `serviceSlug`. Pricing, lock payloads, Paystack, and assignment logic are untouched.

| Area | Status |
|------|--------|
| Service positioning (step 1) | Done — host-focused mobile/desktop copy |
| Scheduling (step 2) | Done — turnover + same-day helper text |
| Property access (step 3) | Done — host access label, hint, placeholder |
| Details & add-ons (step 4) | Done — turnover cadence, property size, turnover extras, host instructions |
| Cleaner preference (step 5) | Done — property familiarity messaging |
| Review summary (step 6) | Done — operational hero order (schedule → location → beds → extras) |
| Checkout (step 7) | Done — guest-ready note, turnover “what happens next” |
| Customer dashboard | Done — turnover status lines when `serviceSlug` is Airbnb |
| Cleaner dashboard | Done — turnover job hero via `serviceLabel` / slug |
| Admin list | Done — Turnover + Same-day turnover badges |
| Tests | Added/updated — `airbnbCleaningDisplay.test.ts`, launch readiness, summary tests |
| Screenshots | Not captured in this session (run dev + `/customer/book/airbnb-cleaning` locally) |

---

## Before vs after (copy)

| Surface | Before | After |
|---------|--------|-------|
| Step 1 mobile | Guest-ready turnaround | Guest-ready turnover |
| Step 1 desktop | Guest-ready clean for kitchens… | Fast, detail-focused property preparation before next check-in |
| Frequency section | Visit frequency / Once-off | Turnover cadence / Single turnover |
| Access field | Access notes (optional) | Property access (optional) + lockbox/parking hints |
| Details intro | Your home & options | Property & turnover options |
| Add-ons | Generic residential subtitles | Host-oriented labels (e.g. Linen & towel refresh, Balcony reset) |
| Review hero | Service · beds · frequency · date | Date · location · beds · extras · cadence |
| Checkout | Generic next steps | Guest-ready reassurance + turnover confirmation steps |
| Customer hero (assigned) | Your cleaner is confirmed | Your turnover cleaner is confirmed |
| Cleaner hero (assigned) | You're scheduled for this clean | Turnover scheduled — review access and host instructions |

---

## Files changed

### New
- `src/features/booking-wizard/airbnbCleaningDisplay.ts` — centralized Airbnb copy/helpers
- `src/features/booking-wizard/airbnbCleaningDisplay.test.ts`
- `docs/audits/airbnb-cleaning-ux-optimization.md` (this document)

### Booking wizard
- `constants.ts` — step 1 Airbnb descriptions
- `addonStepDisplay.ts` — Airbnb order, labels, descriptions
- `reviewDisplay.ts`, `recurringDisplay.ts` — slug-aware frequency/recurring copy
- `wizardBookingSummaryDisplay.ts` — property row, turnover labels
- `components/DetailsStepIntro.tsx`, `FrequencyStepPanel.tsx`, `DetailsStepPanel.tsx`, `AddonsStepPanel.tsx`
- `components/ScheduleStepPanel.tsx`, `BookingWizard.tsx`, `CleanerStepPanel.tsx`
- `components/ReviewStepPanel.tsx`, `CheckoutStepPanel.tsx`
- `components/ServiceStepPanel.test.tsx`
- `airbnbCleaning.launchReadiness.test.ts`, `wizardBookingSummaryDisplay.test.ts`

### Dashboards
- `customerBookingDetailDisplay.ts`, `CustomerBookingStatusHero.tsx`
- `cleanerJobDetailDisplay.ts`, `CleanerJobStatusHero.tsx`
- `adminBookingListBadges.ts`
- `app/(customer)/customer/bookings/[bookingId]/page.tsx`

---

## Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Copy drift vs `FREQUENCY_STEP_OPTIONS` values | Low | Frequency **values** unchanged; only labels/descriptions differ |
| Admin badge noise on every Airbnb row | Low | Only “Turnover” + optional “Same-day turnover” |
| `serviceLabel === "Airbnb Cleaning"` fallback on cleaner hero | Low | Matches catalog label; slug passed on customer detail |
| Pre-existing unrelated dashboard test failures | N/A | `customerBookingServiceDetailsDisplay` / `lifecycleTimeline` failures not introduced by this work |

---

## Tests added/updated

- `airbnbCleaningDisplay.test.ts` — slug, frequency labels, hero order, access copy
- `airbnbCleaning.launchReadiness.test.ts` — sidebar turnover labels + property row
- `wizardBookingSummaryDisplay.test.ts` — Airbnb vs regular label separation
- `ServiceStepPanel.test.tsx` — updated desktop Airbnb copy assertion

Run: `npm test -- --run src/features/booking-wizard/airbnbCleaning`

---

## Product recommendations (near term)

1. **Hide or simplify frequency for pure turnover hosts** — engine supports discounts; product may want once-off default UI for Airbnb only.
2. **Marketing landing** — `/customer/book/airbnb-cleaning` deep link exists; public marketing page is still a placeholder.
3. **Payment success page** — add guest-ready line when `serviceSlug` is Airbnb (same pattern as checkout).
4. **Returning cleaner badge** — requires metadata (selected cleaner history), not just `cleanerLabel`.

---

## Future-ready opportunities (not implemented)

Documented for later phases only:

- Airbnb calendar sync and automated turnovers
- Multi-property host accounts
- Recurring turnover automation
- Cleaner continuity programs
- Linen inventory and consumable restocking SKUs (with pricing)
- Photo verification and guest-ready checklist **enforcement**
- Property manager dashboards
- Optional add-on SKUs: dedicated linen change, restock check, guest-ready finishing (need `ADDON_CATALOG` + `calculateQuote` rules first)

Placeholder checklist labels exist in `AIRBNB_CLEANER_CHECKLIST_PLACEHOLDERS` for future cleaner UI only — **no workflow enforcement**.

---

## Acceptance criteria check

| Criterion | Met |
|-----------|-----|
| Feels specialized for hosts | Yes |
| UX cleaner / operational | Yes |
| No Regular Cleaning UI leakage on Airbnb | Yes (intensity/team/equipment still hidden) |
| No lifecycle regressions | Yes (display-only) |
| No pricing/payment regressions | Yes |
| Shared booking core intact | Yes |
| Mobile polish | Yes (same components; copy density improved) |
| Existing services stable | Yes |
