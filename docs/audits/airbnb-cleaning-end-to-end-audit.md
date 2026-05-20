# Airbnb Cleaning — end-to-end launch readiness audit

**Date:** 2026-05-19  
**Scope:** `airbnb-cleaning` only — booking wizard (steps 1–7) through pricing, payment, dispatch, cleaner/customer/admin dashboards, earnings/payout, and database/API safety.  
**Baseline:** `docs/audits/regular-cleaning-end-to-end-system-audit.md`  
**Status:** Audit complete; targeted tests added; one display-only sidebar fix applied.

---

## Executive summary

| Question | Answer |
|----------|--------|
| Canonical slug | **`airbnb-cleaning`** — in `SERVICE_SLUGS`, `SERVICE_CATALOG`, wizard, lock column, cleaner capabilities, E2E constants |
| Book path | `/customer/book/airbnb-cleaning` via `resolveBookPageServiceSlug` |
| Pricing model | Residential base + extras (R550 + R90/bed + R70/bath); **percent-based cleaner earnings** (same family as regular, not fixed R250) |
| Regular-only UI | **Correctly hidden** — no intensity, equipment, extra rooms, or team support in details/review |
| Payment / dispatch | **Service-agnostic** — lock recalc, Paystack amount, assignment eligibility use `pricingInput.serviceSlug` |
| Biggest gaps | Thin **Airbnb-specific test coverage** (fixed in this audit); **sidebar recap** omitted frequency/add-ons for non-regular residential (fixed); **frequency UI** shown for Airbnb (product decision — discounts apply in engine) |
| Launch verdict | **Launch-ready** with noted product/UX follow-ups — no blocking code defects found |

---

## Pass / fail matrix

| Area | Result | Risk | Notes |
|------|--------|------|-------|
| 1. Booking Step 1 — service card | **Pass** | Low | Label, slug, descriptions, icon (`IconKey`, rose accent), enabled |
| 1. Booking Step 2 — schedule | **Pass** | Low | Same JHB window / 180 min job as other residential |
| 1. Booking Step 3 — location | **Pass** | Low | Standard address + suburb + ZA phone |
| 1. Booking Step 4 — details | **Pass** | Low | Beds/baths, frequency, add-ons (incl. balcony), notes; **no** regular-only sections |
| 1. Booking Step 5 — cleaner | **Pass** | Low | Best available + selected; capability `airbnb-cleaning` required |
| 1. Booking Step 6 — review | **Pass** | Low | Hero shows service, beds/baths, frequency, schedule; line items + total; no regular-only rows |
| 1. Booking Step 7 — checkout | **Pass** | Low | Lock + Paystack use server `calculateQuote` total |
| 2. Pricing / quote | **Pass** | Low | Catalog cents; addons stack; frequency discount applies (all services) |
| 2. Paystack amount match | **Pass** | Low | `createBookingPaymentLock` rejects client/server mismatch |
| 3. Payment / finalization | **Pass** | Low | No service branches in payment routes |
| 4. Assignment / dispatch | **Pass** | Low | Eligibility filters by slug from metadata/lock |
| 5. Cleaner dashboard | **Pass** | Low | `serviceLabel` → "Airbnb Cleaning"; earnings from preview/compute (not R0) |
| 6. Admin dashboard | **Pass** | Low | `parseBookingDisplay` + read models; no regular team-support noise |
| 7. Customer dashboard | **Pass** | Low | Service details, frequency, addons; no admin wording |
| 8. Earnings / payout | **Pass** | Low | `regular_percent_with_min_max` clamp R250–R300 |
| 9. DB / API safety | **Pass** | Med | Lock route strips regular-only fields; fallback slug `regular-cleaning` if metadata missing (legacy) |
| 10. Tests | **Pass** (after add) | Low | Was thin; `airbnbCleaning.launchReadiness.test.ts` added |
| Sidebar recap (steps 4–5) | **Pass** (fixed) | Low | Was regular-only; now shows frequency + add-ons for Airbnb |

---

## 1. Booking flow (steps 1–7)

### Step 1 — Service

| Item | Value |
|------|-------|
| Slug | `airbnb-cleaning` |
| Path | `/customer/book/airbnb-cleaning` |
| Label | `SERVICE_CATALOG` → **Airbnb Cleaning** |
| Mobile copy | "Guest-ready turnaround" |
| Desktop copy | "Guest-ready clean for kitchens, baths, and key spaces." |
| Pricing source | `catalog.ts` — `baseCents: 55_000`, `extraBedroomCents: 9_000`, `extraBathroomCents: 7_000` |
| On select | `bedrooms: 2`, `bathrooms: 1` (same as deep/moving/regular) |

**Files:** `constants.ts`, `ServiceStepPanel.tsx`, `serviceStepIcons.tsx`, `bookServiceRoute.ts`, `[serviceSlug]/page.tsx`

### Step 2 — Schedule

Service-agnostic: `validateDateTimeStep`, `WIZARD_JOB_DURATION_MINUTES` (180), Africa/Johannesburg.

### Step 3 — Location

Service-agnostic: address, suburb → `areaSlug`, contact phone.

### Step 4 — Details

| UI block | Airbnb |
|----------|--------|
| Visit frequency | **Shown** — all services use `FrequencyStepPanel` |
| Home size (bed/bath) | **Shown** |
| Cleaning intensity | **Hidden** (`isRegular` only) |
| Add-ons | **Shown** — full `ADDON_STEP_DISPLAY_ORDER` (includes **balcony**, unlike regular) |
| Supplies & support (extra rooms, equipment, team) | **Hidden** |
| Notes | **Shown** |

**Validation:** `validateDetailsStep` — min 1 bed/bath; no regular-only field checks.

### Step 5 — Cleaner

`validateCleanerStep` + `matchesServiceCapability(..., "airbnb-cleaning")`. Cleaners need capability row in `cleaner_service_capabilities`.

### Step 6 — Review

- Hero: service label, bed/bath compact, **frequency label**, schedule.
- Price breakdown: all `quote.lineItems` including `frequency_discount` when not `once`.
- Collapsed details: add-ons list; **no** intensity / equipment / team / extra rooms rows.
- Recurring copy: `getRecurringScheduleReviewNote` when frequency ≠ `once`.

### Step 7 — Checkout

`buildLockRequestPayload` / `lockPayload.ts` zeroes `extraRooms`, forces `standard` intensity, `customer` equipment, `requestedTeamSize: 1` for non-regular.

---

## 2. Pricing and quote logic

### Example totals (verified in tests)

| Input | Expected `totalCents` |
|-------|----------------------|
| 2 bed, 1 bath, once | **64_000** (55k + 9k) |
| + `inside-oven` addon | 64_000 + 18_000 = **82_000** |
| weekly frequency | subtotal × 0.9 → discount line item |

### Cleaner earnings preview

- **Not** `fixedCleanerPayout` → uses `regular_percent_with_min_max` (60–70%, clamped R250–R300 per cleaner).
- 64_000 × 0.6 = 38_400 → **30_000** (max clamp) — never R0.

### Regular Cleaning pricing **not** reused

Distinct `baseCents` / extra room rates in `SERVICE_CATALOG["airbnb-cleaning"]`.

---

## 3. Payment / finalization

| Step | Service-specific? |
|------|-------------------|
| `POST /api/bookings/lock` | Strips regular-only pricing fields for Airbnb |
| `createBookingPaymentLock` | Recalculates via `calculateQuote(pricingInput)` |
| Paystack initialize | Uses `lockedPriceCents` / `bookings.price_cents` |
| Verify / webhook | Status transitions — no slug branches |
| Metadata | `metadata.quote.input.serviceSlug: "airbnb-cleaning"` |

---

## 4. Assignment and dispatch

- `assignmentContext.ts` reads slug from lock or `metadata.quote.input`.
- `listEligibleCleaners` requires `airbnb-cleaning` capability.
- Offers, expiry, accept/decline — slug-agnostic orchestration.
- **Risk (medium, legacy):** missing slug falls back to `"regular-cleaning"` in `assignmentContext.ts` / `requestedTeamSizeFromBooking.ts` — wizard bookings always set nested slug.

---

## 5–7. Dashboards

| Surface | Airbnb behavior |
|---------|-----------------|
| Cleaner offers/jobs | `serviceLabelFromSlug` → "Airbnb Cleaning"; `resolveCleanerEarningsDisplay` > 0 |
| Admin bookings / ops | Correct label; team-support observation **skipped** (`slug !== "regular-cleaning"`) |
| Customer list/detail | `parseCustomerBookingServiceDetails` — home size, frequency, addons; no intensity/equipment/team |

---

## 8. Earnings and payout

- Preview at quote: `computeCleanerEarningsPreview` with percent model.
- Completion: `computeEarningsForBooking` reads `quote.input.serviceSlug`.
- Blocks completion if payout ≤ 0 or > `price_cents`.

---

## 9. Hardcoded assumptions scan

| Pattern | Airbnb impact |
|---------|----------------|
| `serviceSlug === "regular-cleaning"` | Correctly gates regular-only features |
| `fixedCleanerPayout` | **Not** set on Airbnb — percent earnings |
| `extraRooms` / `cleaningIntensity` / `equipmentSupply` / `requestedTeamSize` | Stripped at lock/metadata for Airbnb |
| Frequency discount | **Applies** to all services (not gated to regular) |
| Fallback `"regular-cleaning"` | Only when metadata incomplete |

---

## Broken areas / risks

| ID | Severity | Issue | Recommendation |
|----|----------|-------|----------------|
| A1 | **Low** (fixed) | Sidebar `buildSecondaryRows` hid frequency/add-ons for Airbnb | Fixed in `wizardBookingSummaryDisplay.ts` |
| A2 | **Product** | Frequency step + recurring discount available for Airbnb | Confirm with product: hide frequency UI for turnover-only, or keep for host subscriptions |
| A3 | **Low** | Sparse Airbnb fixtures in lock/payment tests | Added `airbnbCleaning.launchReadiness.test.ts` |
| A4 | **Med** (legacy) | Assignment fallback to `regular-cleaning` if slug missing | Do not rely on fallback; monitor metadata on paid bookings |

---

## Files inspected (representative)

**Booking:** `constants.ts`, `validation.ts`, `serviceSelection.ts`, `DetailsStepPanel.tsx`, `ReviewStepPanel.tsx`, `lockPayload.ts`, `buildMetadata.ts`, `wizardBookingSummaryDisplay.ts`, `addonStepDisplay.ts`, `bookServiceRoute.ts`

**Pricing:** `catalog.ts`, `types.ts`, `calculateQuote.ts`, `computeLineItems.ts`, `computeCleanerEarnings.ts`, `validateInput.ts`

**Payment:** `api/bookings/lock/route.ts`, `createBookingPaymentLock.ts`

**Assignment:** `assignmentContext.ts`, `eligibility/evaluate.ts`

**Dashboards:** `parseBookingDisplay.ts`, `customerBookingServiceDetailsDisplay.ts`, `resolveCleanerEarningsDisplay.ts`, `cleanerJobReadModel.ts`, `adminTeamSupportObservation.ts`

**Earnings:** `computeEarningsForBooking.ts`

**Tests:** `calculateQuote.test.ts`, `dashboardReadModels.test.ts`, `parseBookingDisplay.test.ts`, `bookServiceRoute.test.ts`

---

## Fix plan (grouped)

### Booking flow
- [x] **A1** — Show frequency + add-ons in wizard sidebar for Airbnb (and deep/moving residential).
- [ ] **A2** — Product decision: restrict frequency UI/discount to regular-only *if* required (would be a deliberate pricing change).

### Pricing / payment
- No code changes required — totals and lock validation are correct.

### Dispatch / assignment
- No change for launch; optional harden fallback slug logging.

### Dashboards
- No change required.

### Earnings / payout
- No change required.

### Tests
- [x] Add `airbnbCleaning.launchReadiness.test.ts` covering quote, validation, lock payload, metadata, earnings, sidebar, route.

---

## Acceptance criteria checklist

| Criterion | Status |
|-----------|--------|
| Book end-to-end | **Yes** |
| Payment matches quote | **Yes** |
| Customer dashboard after payment | **Yes** |
| Admin see/manage | **Yes** |
| Cleaner receive/accept/complete | **Yes** (with capability) |
| Earnings positive | **Yes** |
| No R0 cleaner display | **Yes** |
| No regular-only UI leaks | **Yes** |
| Other services tests pass | **Yes** (262 tests in booking/pricing/dashboard/earnings scope) |
