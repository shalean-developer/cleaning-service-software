# Office Cleaning (`office-cleaning`) — end-to-end audit

**Date:** 2026-05-20  
**Scope:** `office-cleaning` only — booking wizard (steps 1–7) through pricing, payment, dispatch, cleaner/customer/admin dashboards, earnings/payout, and slug safety.  
**Product name:** Office Cleaning  
**Canonical slug:** `office-cleaning`  
**Baseline:** `docs/audits/moving-cleaning-end-to-end-audit.md`, `docs/audits/airbnb-cleaning-end-to-end-audit.md`, `docs/audits/regular-cleaning-end-to-end-system-audit.md`  
**Status:** Audit complete — **no blocking code defects**; commercial UX copy is thin (residential defaults); optional presentation follow-ups only.

---

## Executive summary

| Question | Answer |
|----------|--------|
| Canonical slug | **`office-cleaning`** — in `SERVICE_SLUGS`, `SERVICE_CATALOG`, wizard, lock column, cleaner capabilities, E2E constants |
| Legacy / alternate slugs | **None accepted** — `commercial-cleaning`, `office_cleaning`, etc. rejected by `isServiceSlug` / `resolveBookPageServiceSlug` |
| Book path | `/customer/book/office-cleaning` |
| Pricing model | R600 base + R2/sqm over 50 sqm free threshold (`allowZeroRooms`) |
| Earnings model | **Percent with min/max** (same as regular/Airbnb) — **not** fixed R250 (deep/moving/carpet) |
| Size input | **Sqm only** in step 4; bedrooms/bathrooms zeroed on service select |
| Regular-only UI | **Correctly hidden** — no intensity, equipment, extra rooms, or team support |
| Airbnb / move / deep UI | **Not shown** — no turnover, move-prep, or deep-restoration modules for office |
| Payment / dispatch | **Service-agnostic** — lock recalc, Paystack amount, eligibility use `pricingInput.serviceSlug` |
| Commercial UX copy | **Thin** — step 1 is commercial; steps 4–7 largely use generic residential helpers |
| Launch verdict | **Launch-ready** for technical flow — product should plan `officeCleaningDisplay.ts` before UX polish |

---

## Pass / fail matrix

| # | Area | Result | Risk | Notes |
|---|------|--------|------|-------|
| 1 | Service slug, route, catalog, book path | **Pass** | Low | Single slug; registry alignment tested |
| 2 | Step 1 — service card | **Pass** | Low | Building icon, zinc palette, commercial step-1 copy |
| 2 | Step 2 — schedule | **Pass** | Low | Service-agnostic JHB / 180 min (same as other services) |
| 2 | Step 3 — location | **Pass** | Med (UX) | Standard residential address/contact; no business-name field |
| 2 | Step 4 — details | **Pass** | Med (UX) | Sqm required; frequency + add-ons; **no** bed/bath; intro says "Your home & options" |
| 2 | Step 5 — cleaner | **Pass** | Low | Requires `office-cleaning` capability; generic cleaner copy |
| 2 | Step 6 — review | **Pass** | Low | Property size row; generic "Property details" section |
| 2 | Step 7 — checkout | **Pass** | Low | Lock + Paystack; generic confirmation (not Airbnb turnover) |
| 3 | Quote vs Paystack | **Pass** | Low | Server `calculateQuote`; `QUOTE_MISMATCH` on drift |
| 4 | Lock + metadata `serviceSlug` | **Pass** | Low | Regular-only fields stripped in lock/metadata |
| 5 | Payment success / failure | **Pass** | Low | Airbnb panels gated by `isAirbnbCleaningSlug` only |
| 6 | Customer list / detail | **Pass** | Med (UX) | Label "Office Cleaning"; home size shows sqm; generic notes/frequency |
| 7 | Cleaner offers / jobs / complete | **Pass** | Med (UX) | Generic lifecycle; percent earnings display |
| 8 | Admin list / detail / ops | **Pass** | Med (UX) | Catalog label; team-support ops **skipped** (regular-only) |
| 9 | Earnings preview + completed | **Pass** | Low | Included in R0 sweep; percent min R250 |
| 10 | No R0 cleaner display | **Pass** | Low | `calculateQuote.test.ts` includes `office-cleaning` |
| 11 | No regular UI leakage | **Pass** | Low | `=== "regular-cleaning"` gates verified |
| 12 | No Airbnb / move / deep UI leakage | **Pass** | Low | Service-specific modules slug-gated |
| 13 | Other services stable | **Pass** | Low | 293 tests in booking/pricing/dashboard/earnings scope |

---

## 1. Slug, route, and catalog

| Item | Value |
|------|-------|
| Canonical slug | `office-cleaning` |
| Rejected variants | `office_cleaning`, `commercial-cleaning`, `Office-Cleaning` → not in catalog / `resolveBookPageServiceSlug` null |
| Customer book URL | `/customer/book/office-cleaning` |
| Catalog label | **Office Cleaning** (`SERVICE_CATALOG`) |
| Seed | `supabase/seed.sql` — "Office Cleaning", 120 min, R60000 base |
| Step 1 mobile | "Commercial spaces — size may apply" |
| Step 1 desktop | "Commercial office clean; workspace size may apply." |

**Registry alignment:** `serviceSlugRegistry.test.ts` asserts `SERVICE_SLUGS`, `SERVICE_CATALOG`, enabled `WIZARD_SERVICE_OPTIONS`, and `CLEANER_CAPABILITY_OPTIONS` are identical sorted sets.

**Files:** `types.ts`, `catalog.ts`, `constants.ts`, `bookServiceRoute.ts`, `serviceSlugRegistry.test.ts`, `cleanerCapabilityOptions.ts`, `[serviceSlug]/page.tsx`

---

## 2. Booking flow (steps 1–7)

### Step 1 — Service

| Check | Office |
|-------|--------|
| Enabled in wizard | Yes |
| Icon / color | `IconBuilding`, zinc-700 / zinc-100 |
| Wording | Commercial (not home/Airbnb/move/deep) |

### Step 2 — Schedule

Same booking window, timezone, and duration as other services (`WIZARD_JOB_DURATION_MINUTES = 180`). No after-hours / business-hours gate — **product gap**, not a bug.

### Step 3 — Location

Standard street / suburb / city / ZA mobile. Access notes use **generic residential** placeholder ("Gate code, pets…") via `getAccessNotesFieldCopy` — not Airbnb host copy.

### Step 4 — Details

| UI block | Office cleaning |
|----------|-----------------|
| Intro title | **"Your home & options"** (residential default — no `officeCleaningDisplay`) |
| Intro description | "Tell us what affects time, supplies, and support." |
| Visit frequency | Generic `FREQUENCY_STEP_OPTIONS` ("Best for routine upkeep") — **not** commercial cadence copy |
| Home size | **Hidden** bed/bath; **required** property size (sqm) |
| Cleaning intensity | **Hidden** |
| Add-ons | Full residential add-on list (oven, fridge, laundry, etc.) |
| Supplies / team | **Hidden** (regular-only) |
| Notes section | Title **"Notes"**; placeholder gate/pets (not "business access") |

**Validation:** `validateDetailsStep` requires `propertySizeSqm > 0` for office.

### Step 5 — Cleaner

Eligibility: `matchesServiceCapability(capabilities, "office-cleaning")`. No office-specific cleaner footnote (unlike deep/move/Airbnb display modules).

### Step 6 — Review

| Element | Office |
|---------|--------|
| Hero / context strip | Service + `120 sqm` (no bed/bath) |
| Property section | "Property details"; row label **Property size** |
| Regular-only rows | Hidden |

### Step 7 — Checkout

Generic Paystack flow; `buildLockRequestPayload` zeros regular-only fields. Callback uses `?service=office-cleaning` pattern (service-agnostic payment return).

**Wording leak check:** No Airbnb turnover, move handover, or deep-restoration strings in office-gated paths.

---

## 3. Pricing and quote logic

### Catalog rule

```text
baseCents: 60_000 (R600)
allowZeroRooms: true
propertySizeFreeSqm: 50
propertySizePerSqmCents: 200 (R2/sqm billable over free threshold)
extraBedroomCents / extraBathroomCents: 0 (unused when allowZeroRooms)
fixedCleanerPayout: false
```

### Example (tested)

120 sqm once-off: `60_000 + (120 - 50) * 200 = 74_000` cents.

### Line items

| Item | Office |
|------|--------|
| `service_base` | Office Cleaning |
| `property_size` | Billable sqm over 50 |
| `extra_bedrooms` / `extra_bathrooms` | **Not emitted** (`allowZeroRooms`) |
| Intensity / equipment / team request | **Not emitted** |
| Add-ons | Priced if selected |
| `frequency_discount` | **Applied** for weekly/biweekly/monthly (all services) |

### Earnings

- Model: `regular_percent_with_min_max` (60–70% by tenure, clamped R250–R300 per cleaner)
- Team jobs: N/A at booking (teamSize 1); admin assignment team uses fixed per cleaner when `teamSize > 1`

### Server validation gap (non-blocking)

`validatePricingInput` does **not** require `propertySizeSqm` for office; wizard does. Direct API quote could return base-only R600 without sqm — **low risk** if all bookings go through wizard + lock.

**Files:** `calculateQuote.ts`, `computeLineItems.ts`, `computeCleanerEarnings.ts`, `validateInput.ts`, `calculateQuote.test.ts`

---

## 4. Payment and finalization

| Check | Result |
|-------|--------|
| Lock stores `serviceSlug` | Yes — top-level + nested `quote.input` |
| Paystack amount | Server recalc from lock `pricingInput` |
| Regular fields in lock | Stripped to defaults (extraRooms 0, standard intensity, customer equipment, team 1) |
| `propertySizeSqm` | Passed through in lock body and metadata |
| Payment panels | Generic unless `airbnb-cleaning` |

No office-specific payment regression observed.

---

## 5. Assignment and dispatch

| Check | Result |
|-------|--------|
| Capability match | Exact slug `office-cleaning` |
| Area match | Suburb → `areaSlug` (same as residential) |
| Team dispatch | No office team-request at booking; admin team-support ops are regular-only |
| Assignment context | No office-specific branches — **correct** (service-agnostic) |

Cleaners without `office-cleaning` capability are ineligible; empty capability list fails closed.

---

## 6. Customer dashboard

| Field | Office behavior |
|-------|-----------------|
| `serviceLabel` | Office Cleaning |
| `homeSizeSummary` | e.g. `120 sqm` via `formatBedroomBathroomSummary` |
| Frequency | Generic labels (not Airbnb turnover) |
| Team support | **Hidden** |
| Intensity / equipment | **Hidden** |
| Payment return | Generic panels |

**UX:** No commercial operational card (contrast: Airbnb/deep/move modules). List cards use generic assignment/lifecycle copy.

---

## 7. Cleaner dashboard

| Check | Result |
|-------|--------|
| Job label | Office Cleaning from catalog |
| Instructions | Generic + `specialInstructions`; no commercial playbook |
| Earnings display | Percent model from quote metadata |
| Completion | Service-agnostic; payout not blocked for office slug |

No `officeOperationalDisplay` — same pattern as pre-UX deep/move before display modules.

---

## 8. Admin dashboard

| Check | Result |
|-------|--------|
| List / detail label | Office Cleaning |
| Team support observation | **Skipped** (`isTwoCleanerRequest` regular-only) |
| Recurring office | Displays frequency from metadata; recurring discount in quote |
| Ops queue | Generic booking ops |

---

## 9. Earnings and payouts

| Scenario | Expected |
|----------|----------|
| Preview at quote time | `perCleanerAmountCents` ≥ R250 (min clamp) |
| Completed job | `computeEarningsForBooking` uses stored quote — percent for office |
| R0 display | Prevented by quote sweep test |
| Team payout on office | Only if admin assigns `teamSize > 1` → fixed per cleaner |

Office totals at MVP sizes stay within percent min/max clamps in tests.

---

## 10. Hard-coded service assumptions (search summary)

| Pattern | Office impact |
|---------|----------------|
| `=== "regular-cleaning"` | Office excluded from intensity, equipment, team, extra rooms |
| `isAirbnbCleaningSlug` | Office excluded from turnover copy |
| `isMovingCleaningSlug` / `isDeepCleaningSlug` | Office uses generic fallbacks |
| `office-cleaning` explicit | Details sqm UI, validation, review labels, context strip, service selection 0/0 rooms |

**Accidental exclusion:** Office is enabled in wizard and catalog — not disabled.

**Incorrect helpers:** Details/review use shared `airbnbCleaningDisplay` fallbacks → residential "home" wording for office.

---

## 11. Test coverage

### Present

| Test | Office coverage |
|------|-----------------|
| `serviceSlugRegistry.test.ts` | Full registry includes office |
| `bookServiceRoute.test.ts` | Resolve + canonical path |
| `serviceSelection.test.ts` | Zeros bedrooms/bathrooms |
| `calculateQuote.test.ts` | Dedicated office quote + R0 sweep |
| `reviewDisplay.test.ts` | Sqm summary formatting |
| `parseBookingDisplay.test.ts` | Slug + label |
| `WizardContextStrip.test.tsx` | Sqm context strip |
| `quoteInvalidation.test.ts` | Service switch invalidates quote |

### Missing (vs Airbnb / Move)

| Gap | Risk |
|-----|------|
| `officeCleaning.launchReadiness.test.ts` | Med — no lock payload / metadata / copy leakage bundle |
| `officeCleaningDisplay.ts` | Med — commercial copy not centralized |
| Dashboard display tests for office sqm | Low — covered indirectly via `reviewDisplay` / `parseBookingDisplay` |
| E2E dedicated office flow | Low — listed in `scripts/e2e/lib/constants.mjs` only |

---

## Blocking bugs

**None identified.** Payment, slug persistence, quoting, eligibility, and earnings paths are consistent for `office-cleaning`.

---

## Non-blocking risks

| ID | Risk | Severity | Notes |
|----|------|----------|-------|
| O1 | Residential copy in details/review ("home", gate/pets, routine upkeep) | Med (UX) | Add `officeCleaningDisplay.ts` before UX polish |
| O2 | No `officeCleaning.launchReadiness.test.ts` | Med (process) | Mirror `movingCleaning.launchReadiness.test.ts` |
| O3 | API allows office quote without sqm | Low | Align `validatePricingInput` with wizard if hardening desired |
| O4 | Residential add-ons on commercial jobs | Low (product) | Optional office-specific add-on order/labels |
| O5 | No business-hours / access-type fields | Low (product) | Schedule step is generic |
| O6 | No admin/cleaner commercial ops panel | Low (UX) | Optional `officeOperationalDisplay.ts` |
| O7 | Frequency discount on commercial recurring | Low (product) | Documented behavior — confirm with product |

---

## Files inspected

**Booking:** `constants.ts`, `validation.ts`, `serviceSelection.ts`, `DetailsStepPanel.tsx`, `DetailsStepIntro.tsx`, `ReviewStepPanel.tsx`, `WizardContextStrip.tsx`, `lockPayload.ts`, `buildMetadata.ts`, `reviewDisplay.ts`, `addonStepDisplay.ts`, `bookServiceRoute.ts`, `airbnbCleaningDisplay.ts`, `serviceStepIcons.tsx`

**Pricing:** `catalog.ts`, `types.ts`, `calculateQuote.ts`, `computeCleanerEarnings.ts`, `validateInput.ts`, `computeLineItems.ts`

**Payment:** `createBookingPaymentLock.ts`, `PaymentReturnPanels.tsx`

**Assignment / cleaners:** `eligibility/evaluate.ts`, `cleanerCapabilityOptions.ts`, `parseRequests.ts`

**Dashboards:** `parseBookingDisplay.ts`, `customerBookingServiceDetailsDisplay.ts`, `adminBookingDetailDisplay.ts`

**Docs / seed:** `docs/pricing/pricing-engine.md`, `supabase/seed.sql`, `scripts/e2e/lib/constants.mjs`

---

## Tests run

```text
npx vitest run \
  src/features/pricing/server/calculateQuote.test.ts \
  src/features/pricing/server/serviceSlugRegistry.test.ts \
  src/features/booking-wizard/bookServiceRoute.test.ts \
  src/features/booking-wizard/reviewDisplay.test.ts \
  src/features/booking-wizard/serviceSelection.test.ts \
  src/features/dashboards/server/parseBookingDisplay.test.ts \
  src/features/booking-wizard/components/WizardContextStrip.test.tsx
→ 7 files, 80 tests passed

npx vitest run src/features/booking-wizard src/features/pricing/server \
  src/features/dashboards/server/parseBookingDisplay.test.ts \
  src/features/dashboards/server/resolveCleanerEarningsDisplay.test.ts \
  src/features/earnings/server
→ 47 files, 293 tests passed
```

---

## Product recommendations

1. **Treat office as a first-class commercial vertical in copy**, not a residential variant with sqm — business access, workspace areas, after-hours, consumables.
2. **Keep pricing/dispatch as-is** until product requests commercial-specific rules (per-desk, restrooms, team size).
3. **Add launch-readiness tests** before marketing push — prevents regression when adding `officeCleaningDisplay.ts`.
4. **Clarify add-ons** — hide or relabel residential add-ons (oven/fridge) for office if they confuse customers.
5. **Recurring commercial** — confirm frequency discounts and "routine upkeep" wording match B2B contracts.

---

## Suggested UX optimization direction (post-audit)

**Phase 2 — presentation only (no pricing/payment/lifecycle changes unless product signs off):**

1. Add `officeCleaningDisplay.ts` with:
   - Details intro: "Workspace & service options"
   - Home size title: "Workspace size"
   - Notes: business access, alarm, parking, after-hours
   - Frequency cards: "Service cadence" / contract-friendly labels
   - Review/checkout reassurance for commercial assignment
2. Add `officeCleaning.launchReadiness.test.ts` (quote, lock strip, metadata slug, no regular/Airbnb/move/deep copy hooks).
3. Optional `officeOperationalDisplay.ts` for cleaner/admin (restroom count, desk zones, key holder — display-only).
4. Optional location step: business name + floor/unit (metadata only).

**Do not change without product sign-off:**

- Sqm pricing formula (R600 + R2/sqm over 50)
- Percent earnings model (vs fixed R250 family)
- Frequency multipliers on office recurring

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Book end-to-end | **Yes** (`/customer/book/office-cleaning`) |
| Payment amount matches quote | **Yes** |
| Booking appears in all dashboards | **Yes** |
| Cleaner can accept and complete | **Yes** (with capability) |
| Earnings positive and safe | **Yes** (percent min R250) |
| No wrong service-specific UI leakage | **Yes** (no Airbnb/move/deep/regular-only leaks) |
| Airbnb / Move / Deep / Regular unaffected | **Yes** (293 tests in scope) |
| Risks classified | **Yes** (O1–O7 above) |
