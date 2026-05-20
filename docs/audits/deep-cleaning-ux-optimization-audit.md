# Deep Cleaning UX Optimization — Audit Report

**Date:** 2026-05-20  
**Scope:** Presentation and metadata-only copy across booking wizard, customer/cleaner/admin dashboards, and payment return surfaces.  
**Out of scope:** `calculateQuote()`, cleaner earnings, dispatch/assignment, lifecycle/payment/finalization.

---

## Executive summary

Deep Cleaning now has dedicated display modules (`deepCleaningDisplay.ts`, `deepCustomerDisplay.ts`, `deepOperationalDisplay.ts`) wired through the same router pattern as Move In/Out and Airbnb Cleaning. Copy emphasizes **intensive restoration**, **neglected-space recovery**, **seasonal resets**, and **detailed extras** — without turnover, handover, or routine housekeeping language.

---

## 1. Centralized display helpers

| Module | Path | Key exports |
|--------|------|-------------|
| Wizard + shared status | `src/features/booking-wizard/deepCleaningDisplay.ts` | `isDeepCleaningSlug`, `getDeepCleaningStepCopy`, review/checkout/summary helpers, customer/cleaner/admin status lines |
| Customer dashboards | `src/features/dashboards/deepCustomerDisplay.ts` | Payment success/failure, list/detail copy, compact guidance |
| Cleaner + admin ops | `src/features/dashboards/deepOperationalDisplay.ts` | Offer/job/admin list/detail/queue copy, guidance steps |

Routing: `airbnbCleaningDisplay.ts` checks **moving → deep → airbnb → generic** for all shared step helpers.

---

## 2. Before vs after (selected examples)

### Step 1 — Service card

| | Before | After |
|---|--------|-------|
| Mobile | Detailed top-to-bottom clean | Intensive home restoration cleaning |
| Desktop | Deep clean for buildup, corners, and high-traffic areas. | Detailed deep cleaning for neglected buildup — ideal for seasonal resets and full-home refreshes. |

### Step 2 — Schedule helper

| Before | After |
|--------|-------|
| Choose your preferred service date. Future bookings are assigned closer to the service date. | Deep cleans may require more detailed preparation time. Ideal before holidays, events, or seasonal resets — allow enough cleaning time on your chosen date. |

### Step 4 — Details

| Before | After |
|--------|-------|
| Your home & options | Home restoration details |
| Add-ons | Detailed cleaning extras |
| Notes | Attention areas |
| (no hint) | Most requested for deep cleaning — ideal for buildup and detailed restoration. |

### Step 6 — Review

| Before | After |
|--------|-------|
| Property details | Deep-clean priorities |
| Add-ons | Detailed cleaning extras |

### Step 7 — Checkout

| Before | After |
|--------|-------|
| Booking confirmation | Your deep cleaning is scheduled |
| (generic) | Your home will receive detailed restoration-focused cleaning |

### Customer dashboard (confirmed)

| Before | After |
|--------|-------|
| Matching a cleaner to your booking. | Preparing cleaner assignment for your home restoration clean. |
| Deep-clean preparation scheduled (list badge) | |

---

## 3. Files changed

### New files
- `src/features/booking-wizard/deepCleaningDisplay.ts`
- `src/features/booking-wizard/deepCleaningDisplay.test.ts`
- `src/features/dashboards/deepCustomerDisplay.ts`
- `src/features/dashboards/deepCustomerDisplay.test.ts`
- `src/features/dashboards/deepOperationalDisplay.ts`
- `src/features/dashboards/deepOperationalDisplay.test.ts`
- `docs/audits/deep-cleaning-ux-optimization-audit.md`

### Updated (routing / wiring)
- `src/features/booking-wizard/airbnbCleaningDisplay.ts`
- `src/features/booking-wizard/constants.ts`
- `src/features/booking-wizard/addonStepDisplay.ts`
- `src/features/booking-wizard/addonStepDisplay.test.ts`
- `src/features/booking-wizard/wizardBookingSummaryDisplay.ts`
- `src/features/booking-wizard/components/ReviewStepPanel.tsx`
- `src/features/dashboards/customerBookingListCardDisplay.ts`
- `src/features/dashboards/customerBookingDetailDisplay.ts`
- `src/features/dashboards/cleanerJobDetailDisplay.ts`
- `src/features/dashboards/adminBookingListDisplay.ts`
- `src/features/dashboards/adminBookingDetailDisplay.ts`
- `src/features/dashboards/adminBookingListBadges.ts`
- `src/features/dashboards/airbnbCustomerDisplay.ts`
- Customer/cleaner/admin components and pages (payment return, booking detail, job detail, admin queue)

---

## 4. Tests added

- `deepCleaningDisplay.test.ts` — slug guards, step/review/checkout copy, addon order, no Airbnb/Move leakage
- `deepCustomerDisplay.test.ts` — list/success/guidance, no turnover wording
- `deepOperationalDisplay.test.ts` — cleaner/admin copy, guidance steps
- `addonStepDisplay.test.ts` — deep restoration add-on order
- `movingCleaningDisplay.test.ts` — confirms deep does not receive moving copy

---

## 5. Risks

| Risk | Mitigation |
|------|------------|
| Copy router order regression | Tests assert deep/moving/airbnb isolation; moving tests unchanged |
| Accidental service bleed in UI | Forbidden-regex tests for turnover/handover/guest-ready in deep modules |
| Admin badge duplication | Badges only emit when `serviceLabel === "Deep Cleaning"` (same pattern as Airbnb/Moving) |
| Mobile density | Short mobile lines; hints on add-ons section only |

**Not changed:** pricing, `calculateQuote()`, addon IDs, assignment, lifecycle, payment callbacks, earnings.

---

## 6. Product recommendations (future — not implemented)

- Deep-clean checklist (customer + cleaner)
- Buildup severity scoring on attention areas
- Before/after photo capture on completion
- Room-by-room restoration guidance in cleaner app
- Seasonal cleaning mode (spring reset / pre-holiday preset)
- Appliance restoration workflows (oven/fridge deep-dive steps)

---

## 7. Confirmation — logic unchanged

- `calculateQuote()` — not modified
- Cleaner earnings rules — not modified
- Dispatch/assignment logic — not modified
- Lifecycle/payment/finalization — not modified
- Regular Cleaning, Airbnb, Move In/Out flows — preserved via slug guards and existing modules

---

## 8. Terminology guide (preferred)

| Use | Avoid for Deep Cleaning |
|-----|-------------------------|
| Deep Cleaning | Turnover |
| Detailed restoration | Guest-ready |
| Intensive cleaning | Move handover |
| Home refresh | Inspection-ready |
| Attention areas | Host instructions (unless access context) |
| Detailed extras | Routine upkeep |
