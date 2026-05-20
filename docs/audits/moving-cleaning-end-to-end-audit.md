# Move In/Out Cleaning (`moving-cleaning`) — end-to-end audit

**Date:** 2026-05-20  
**Scope:** `moving-cleaning` only — booking wizard (steps 1–7) through pricing, payment, dispatch, cleaner/customer/admin dashboards, earnings/payout, and slug safety.  
**Product name:** Move-in / move-out (marketing); **canonical slug:** `moving-cleaning`; **catalog label:** Moving Cleaning  
**Baseline:** `docs/audits/airbnb-cleaning-end-to-end-audit.md`, `docs/audits/regular-cleaning-end-to-end-system-audit.md`  
**Status:** Audit complete — no blocking code defects; optional UX/product follow-ups only.

---

## Executive summary

| Question | Answer |
|----------|--------|
| Canonical slug | **`moving-cleaning`** — in `SERVICE_SLUGS`, `SERVICE_CATALOG`, wizard, lock column, cleaner capabilities, E2E constants |
| Legacy slug `move-in-out-cleaning` | **Rejected** by `resolveBookPageServiceSlug` (tested in `serviceSlugRegistry.test.ts`) |
| Book path | `/customer/book/moving-cleaning` |
| Pricing model | R1200 base + R200/extra bedroom + R150/extra bathroom (`fixedCleanerPayout: true`) |
| Earnings model | **Fixed R250/cleaner** (`fixed_per_cleaner_deep_moving_carpet`) — same family as deep/carpet, **not** regular percent |
| Regular-only UI | **Correctly hidden** — no intensity, equipment, extra rooms, or team support in details/review/dashboards |
| Airbnb-only UI | **Not shown** — no turnover cadence, host notes, or Airbnb payment/dashboard copy |
| Deep-cleaning confusion | **Pricing and earnings align with deep** (fixed payout); **customer price differs** (higher moving base). **Not** treated as regular. |
| Payment / dispatch | **Service-agnostic** — lock recalc, Paystack amount, assignment eligibility use `pricingInput.serviceSlug` |
| Move-specific UX copy | **Thin** — uses generic residential copy (same as deep); no dedicated module like `airbnbCleaningDisplay.ts` |
| Launch verdict | **Launch-ready** for technical flow — product may want move-ready copy and marketing slug alignment |

---

## Pass / fail matrix

| # | Area | Result | Risk | Notes |
|---|------|--------|------|-------|
| 1 | Service slug, route, catalog, book path | **Pass** | Low | `moving-cleaning`; `/customer/book/moving-cleaning`; label "Moving Cleaning" |
| 2 | Step 1 — service card | **Pass** | Low | Move-in/out copy; amber `IconBox`; enabled in wizard |
| 2 | Step 2 — schedule | **Pass** | Low | Service-agnostic JHB / 180 min |
| 2 | Step 3 — location | **Pass** | Low | Standard address + suburb + ZA phone |
| 2 | Step 4 — details / add-ons | **Pass** | Med (product) | Beds/baths, frequency, full add-on list (incl. laundry); **no** regular-only blocks |
| 2 | Step 5 — cleaner | **Pass** | Low | Capability `moving-cleaning` required; generic cleaner copy (not Airbnb) |
| 2 | Step 6 — review | **Pass** | Low | Hero: service, bed/bath, frequency, schedule; no regular-only rows |
| 2 | Step 7 — checkout | **Pass** | Low | Lock + Paystack; callback `?service=moving-cleaning` |
| 3 | Quote vs Paystack | **Pass** | Low | Server `calculateQuote`; `QUOTE_MISMATCH` on client/server drift |
| 4 | Lock + metadata `serviceSlug` | **Pass** | Low | `lockPayload` / lock API strip regular-only fields; nested `quote.input.serviceSlug` |
| 5 | Payment success / failure | **Pass** | Low | Generic panels; Airbnb copy gated by `isAirbnbCleaningSlug` only |
| 6 | Customer list / detail | **Pass** | Med (UX) | Correct label, home size, frequency, add-ons; **no** move-ready guidance |
| 7 | Cleaner offers / jobs / complete | **Pass** | Med (UX) | Generic lifecycle copy; fixed earnings display; **no** empty-property prep copy |
| 8 | Admin list / detail / ops | **Pass** | Med (UX) | "Moving Cleaning"; team-support ops **skipped**; **no** move urgency badges |
| 9 | Earnings preview + completed | **Pass** | Low | R25 000/cleaner preview; never R0 in quote test sweep |
| 10 | No R0 cleaner display | **Pass** | Low | `calculateQuote.test.ts` includes `moving-cleaning` |
| 11 | No regular UI leakage | **Pass** | Low | All `=== "regular-cleaning"` gates verified |
| 12 | No Airbnb UI leakage | **Pass** | Low | Airbnb helpers require `airbnb-cleaning` slug |
| 13 | Other services stable | **Pass** | Low | 265 tests in booking/pricing/dashboard/earnings scope |

---

## 1. Slug, route, and catalog

| Item | Value |
|------|-------|
| Canonical slug | `moving-cleaning` |
| Rejected legacy | `move-in-out-cleaning` → `resolveBookPageServiceSlug` returns `null` |
| Customer book URL | `/customer/book/moving-cleaning` |
| Catalog label | **Moving Cleaning** (`SERVICE_CATALOG`) |
| Seed / marketing text | `Move-in / move-out clean` (`supabase/seed.sql`) |
| Step 1 mobile | "Move-in or move-out reset" |
| Step 1 desktop | "Move-in or move-out clean for floors and surfaces." |

**Files:** `types.ts`, `catalog.ts`, `constants.ts`, `bookServiceRoute.ts`, `serviceSlugRegistry.test.ts`, `[serviceSlug]/page.tsx`

---

## 2. Booking flow (steps 1–7)

### Step 4 — Details (Move In/Out specific)

| UI block | Moving cleaning |
|----------|-----------------|
| Intro | Generic **"Your home & options"** (not move-specific) |
| Visit frequency | **Shown** — default `FREQUENCY_STEP_OPTIONS` (not Airbnb turnover labels) |
| Home size | **Shown** — bed/bath steppers |
| Cleaning intensity | **Hidden** (`isRegular` only) |
| Add-ons | **Shown** — default `ADDON_STEP_DISPLAY_ORDER` (includes **laundry**, **balcony**) |
| Supplies & support | **Hidden** (extra rooms, equipment, team support) |
| Notes | **Shown** — generic placeholder (gate code / pets), not empty-property / key handover |

**Validation:** Min 1 bed + 1 bath; `validatePricingInput` rejects `extraRooms`, non-standard intensity, shalean equipment, `requestedTeamSize: 2` for non-regular.

### Step 5 — Cleaner / team

- No team support request UI or surcharge (regular-only).
- `teamSize` / dispatch default **1** in lock and `wizardStateToPricingInput`.
- Cleaners need `moving-cleaning` in `cleaner_service_capabilities`.

### Sidebar recap (steps 4–5)

- `isResidentialSummarySlug` includes `moving-cleaning` → frequency + add-ons in secondary rows (same fix family as Airbnb audit).

### Compared to Deep Cleaning

| Aspect | Deep | Moving |
|--------|------|--------|
| Pricing base | R850 | R1200 |
| Extra bed/bath | R150 / R120 | R200 / R150 |
| Earnings rule | Fixed R250 | Fixed R250 |
| Step 4 UI | Same residential pattern | Same residential pattern |
| Step 1 branding | Violet / sparkles | Amber / box |

**Correct:** Moving is **not** priced or earned like regular/Airbnb.  
**Product note:** Moving shares **deep’s residential UI shell** without move-ready copy.

---

## 3. Pricing and quote

### Example totals (tested)

| Input | `totalCents` |
|-------|----------------|
| 3 bed, 2 bath, once | **175 000** (120k + 40k + 15k) |
| + add-ons | Stacks per `ADDON_CATALOG` |
| weekly frequency | Subtotal × 0.9 + `frequency_discount` line (all services) |

### Cleaner earnings preview

- `fixedCleanerPayout: true` → **25 000** per cleaner (`FIXED_CLEANER_PAYOUT_CENTS`).
- `ruleApplied`: `fixed_per_cleaner_deep_moving_carpet`.
- 175 000 total → payout well below customer total (safe).

### Paystack alignment

- `createBookingPaymentLock` → `calculateQuote(pricingInput)` → `lockedPriceCents`.
- Client `clientQuoteTotalCents` must match or lock fails.

---

## 4. Payment and finalization

| Step | Moving-specific? |
|------|------------------|
| Lock API | Strips regular-only pricing fields; validates slug |
| Paystack initialize | `buildPaymentSuccessCallbackUrl(..., "moving-cleaning")` |
| Verify / webhook | Slug-agnostic |
| Failed page | Generic copy unless `airbnb-cleaning` in query |

---

## 5. Assignment and dispatch

- `loadAssignmentContext` uses `locked_service_slug` / `quote.input.serviceSlug`.
- Eligibility: `matchesServiceCapability(..., "moving-cleaning")`.
- `requestedTeamSize` from metadata **does not** create 2-cleaner dispatch for moving (regular-only path in assignment).
- **Legacy risk:** missing slug may fall back in some paths — wizard always sets nested slug.

---

## 6–8. Dashboards

| Surface | Moving behavior |
|---------|-----------------|
| Customer list/detail | `serviceLabel` → "Moving Cleaning"; frequency + addons from metadata; generic status/guidance |
| Cleaner offers/jobs | Generic hero + "What happens next"; earnings via fixed preview / lines |
| Admin bookings / ops | Correct label; **no** team-support observation rows; **no** Airbnb turnover badges |

---

## 9. Hardcoded assumptions scan

| Pattern | Moving impact |
|---------|---------------|
| `serviceSlug === "regular-cleaning"` | Gates regular-only UI/API — **moving excluded** ✓ |
| `isAirbnbCleaningSlug` | Airbnb copy only — **moving excluded** ✓ |
| `fixedCleanerPayout` | **Set** on moving — fixed earnings ✓ |
| `isResidentialSummarySlug` | Includes moving — frequency/add-ons in sidebar ✓ |
| Frequency discount | **Applies** (not regular-only) — product decision |
| Fallback `"regular-cleaning"` | Only when metadata incomplete (legacy) |

---

## Blocking bugs

**None identified.** End-to-end path is consistent: slug registry → wizard → quote → lock → payment → dashboards → fixed earnings.

---

## Non-blocking risks

| ID | Severity | Issue | Recommendation |
|----|----------|-------|----------------|
| M1 | **Product / SEO** | Marketing says "Move In/Out"; slug is `moving-cleaning`; legacy `move-in-out-cleaning` 404s | Document canonical slug in marketing links; optional redirect alias (display-only route) |
| M2 | **UX** | No move-ready customer guidance (keys, empty property, inspection expectations) | Optional `movingCleaningDisplay.ts` (presentation only), mirroring Airbnb pattern |
| M3 | **UX** | Cleaner guidance is generic ("Review details / Start on site") | Add move-prep steps (empty home, appliances, access) — display only |
| M4 | **UX** | Admin has no move urgency badge (e.g. handover date / vacant property) | Optional ops badges — display only |
| M5 | **Product** | Full add-on list including **laundry** on empty-property cleans | Curate move-specific add-on order/labels or hide laundry — product decision |
| M6 | **Product** | Recurring frequency + discount on move cleans | Confirm intentional; hide frequency UI if move is always once-off |
| M7 | **Low** | Sparse dedicated tests vs Airbnb `launchReadiness` suite | Add `movingCleaning.launchReadiness.test.ts` (optional) |
| M8 | **Med (legacy)** | Assignment/metadata fallback to `regular-cleaning` if slug missing | Monitor paid bookings; same as other services |

---

## Files inspected (representative)

**Booking:** `constants.ts`, `validation.ts`, `serviceSelection.ts`, `DetailsStepPanel.tsx`, `DetailsStepIntro.tsx`, `ReviewStepPanel.tsx`, `lockPayload.ts`, `buildMetadata.ts`, `wizardBookingSummaryDisplay.ts`, `addonStepDisplay.ts`, `bookServiceRoute.ts`, `checkout.ts`, `recurringDisplay.ts`

**Pricing:** `catalog.ts`, `types.ts`, `calculateQuote.ts`, `computeCleanerEarnings.ts`, `validateInput.ts`, `computeLineItems.ts`

**Payment:** `src/app/api/bookings/lock/route.ts`, `createBookingPaymentLock.ts`, `paymentReturn.ts`, `paymentFailedPage.ts`, `PaymentReturnPanels.tsx`

**Assignment:** `assignmentContext.ts`, `cleaners/server/eligibility/evaluate.ts`

**Dashboards:** `parseBookingDisplay.ts`, `customerBookingServiceDetailsDisplay.ts`, `customerBookingDetailDisplay.ts`, `customerBookingListCardDisplay.ts`, `cleanerJobDetailDisplay.ts`, `adminBookingDetailDisplay.ts`, `adminTeamSupportObservation.ts`, `resolveCleanerEarningsDisplay.ts`

**Earnings:** `computeEarningsForBooking.ts`

**Tests:** `calculateQuote.test.ts`, `serviceSlugRegistry.test.ts`, `bookServiceRoute.test.ts`, `parseBookingDisplay.test.ts`, `wizardBookingSummaryDisplay.test.ts`, `checkout.test.ts`, `resolveCleanerEarningsDisplay.test.ts`

---

## Tests run

```text
npx vitest run \
  src/features/pricing/server/calculateQuote.test.ts \
  src/features/pricing/server/serviceSlugRegistry.test.ts \
  src/features/booking-wizard/bookServiceRoute.test.ts \
  src/features/dashboards/server/parseBookingDisplay.test.ts \
  src/features/booking-wizard/wizardBookingSummaryDisplay.test.ts \
  src/features/booking-wizard/checkout.test.ts \
  src/features/booking-wizard/buildMetadata.test.ts \
  src/features/dashboards/server/resolveCleanerEarningsDisplay.test.ts
→ 9 files, 78 tests passed

npx vitest run src/features/booking-wizard src/features/pricing/server \
  src/features/dashboards/server/parseBookingDisplay.test.ts \
  src/features/dashboards/server/resolveCleanerEarningsDisplay.test.ts \
  src/features/earnings/server
→ 44 files, 265 tests passed
```

---

## Fix plan (only if product wants UX hardening)

No pricing/payment/dispatch/lifecycle changes required for correctness.

### Optional — presentation only (no logic changes)

1. **M2 / M3** — Add `movingCleaningDisplay.ts` + dashboard hooks for move-ready customer/cleaner copy.
2. **M4** — Admin list badge e.g. "Move clean" / same-day handover (display-only).
3. **M5** — `MOVING_ADDON_STEP_DISPLAY_ORDER` (reorder or omit laundry).
4. **M7** — `movingCleaning.launchReadiness.test.ts` (quote, lock payload, metadata, earnings, no regular/Airbnb leakage).

### Do not change without product sign-off

- Frequency discounts on moving (M6) — pricing behavior change.
- Earnings model (already correct fixed R250).

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Book end-to-end | **Yes** (`/customer/book/moving-cleaning`) |
| Payment amount matches quote | **Yes** |
| Booking appears in all dashboards | **Yes** |
| Cleaner can accept and complete | **Yes** (with capability) |
| Earnings positive and safe | **Yes** (R250/cleaner) |
| No wrong service-specific UI leakage | **Yes** (no regular/Airbnb leaks) |
| Airbnb / Regular unaffected | **Yes** (265 tests in scope) |
