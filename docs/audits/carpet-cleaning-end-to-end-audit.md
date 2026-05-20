# Carpet Cleaning (`carpet-cleaning`) — end-to-end audit

**Date:** 2026-05-20  
**Scope:** `carpet-cleaning` only — booking wizard (steps 1–7) through pricing, payment, dispatch, cleaner/customer/admin dashboards, earnings/payout, and slug safety.  
**Baseline:** `docs/audits/moving-cleaning-end-to-end-audit.md`, `docs/audits/regular-cleaning-end-to-end-system-audit.md`  
**Status:** Audit complete — **no blocking code defects**; UX/product gaps and weak test coverage documented for pre-optimization work.

---

## Executive summary

| Question | Answer |
|----------|--------|
| Canonical slug | **`carpet-cleaning`** — in `SERVICE_SLUGS`, `SERVICE_CATALOG`, wizard, lock payload, cleaner capabilities, registry tests |
| Book path | `/customer/book/carpet-cleaning` |
| Catalog label | **Carpet Cleaning** |
| Pricing model | R400 base + **R150 per bedroom zone** (`perBedroomCents`; bedrooms = zones, bathrooms not priced) |
| Earnings model | **Fixed R250/cleaner** (`fixed_per_cleaner_deep_moving_carpet`) — same family as deep/moving |
| Dedicated UX module | **None** — falls through to generic residential copy (like pre-optimization moving/deep shell) |
| Regular-only UI | **Correctly hidden** — intensity, equipment, extra rooms, team support gated on `regular-cleaning` |
| Airbnb / move / office copy | **Not shown** — helpers require their respective slugs |
| Payment / dispatch | **Service-agnostic** — lock recalc, Paystack amount, eligibility use `pricingInput.serviceSlug` |
| Launch verdict (technical) | **Launch-ready** for booking → pay → assign → complete → earn |
| Launch verdict (product UX) | **Thin** — zone labeling, add-ons, and dashboard guidance need a carpet-specific pass before UX optimization |

---

## Pass / fail matrix

| # | Area | Result | Risk | Notes |
|---|------|--------|------|-------|
| 1 | Service slug, route, catalog, book path | **Pass** | Low | Registry test aligns catalog, wizard, capabilities |
| 2 | Step 1 — service card | **Pass** | Low | Teal rug icon; “Carpet zones per room” / desktop rug copy |
| 2 | Step 2 — schedule | **Pass** | Med (product) | Same 180 min window as all services; seed says 90 min |
| 2 | Step 3 — location | **Pass** | Low | Standard address; generic access notes |
| 2 | Step 4 — details | **Pass** | **Med–High (UX)** | Frequency + **full residential add-ons**; labels still **Bedrooms/Bathrooms** not zones |
| 2 | Step 5 — cleaner | **Pass** | Med (UX) | Generic cleaner copy; capability `carpet-cleaning` required |
| 2 | Step 6 — review | **Pass** | Med (UX) | Default hero (service · bed/bath · frequency · schedule); no carpet-specific sections |
| 2 | Step 7 — checkout | **Pass** | Low | Lock strips regular-only fields; Paystack callback `?service=carpet-cleaning` |
| 3 | Quote vs Paystack | **Pass** | Low | `calculateQuote`; `QUOTE_MISMATCH` on drift; dedicated zone test |
| 4 | Lock + metadata `serviceSlug` | **Pass** | Low | `lockPayload` zeros regular-only fields; nested `quote.input.serviceSlug` |
| 5 | Payment success / failure | **Pass** | Low | Generic panels; Airbnb copy gated by `isAirbnbCleaningSlug` only |
| 6 | Customer list / detail | **Pass** | Med (UX) | Label “Carpet Cleaning”; home size shows **bedrooms/bathrooms** not zones |
| 7 | Cleaner offers / jobs / complete | **Pass** | Med (UX) | Generic lifecycle hero/guidance; fixed earnings display |
| 8 | Admin list / detail / ops | **Pass** | Med (UX) | Correct label; no carpet operational badges; team-support ops skipped |
| 9 | Earnings preview + completed | **Pass** | Low | R25 000/cleaner; included in “never R0” sweep |
| 10 | No R0 cleaner display | **Pass** | Low | `calculateQuote.test.ts` |
| 11 | No regular UI leakage | **Pass** | Low | `=== "regular-cleaning"` gates verified |
| 12 | No Airbnb UI leakage | **Pass** | Low | `isAirbnbCleaningSlug` only |
| 13 | No wrong deep/move/office copy | **Pass** | Low | Service-specific modules exclude carpet |
| 14 | Other services stable | **Pass** | Low | 292 tests in pricing/booking/dashboard/lock scope (this run) |
| 15 | Test coverage / launch readiness | **Fail** (coverage) | Med | No `carpetCleaning.launchReadiness.test.ts`; thin dashboard E2E |

---

## 1. Service registry & routing

| Item | Value |
|------|-------|
| Canonical slug | `carpet-cleaning` |
| Customer book URL | `/customer/book/carpet-cleaning` |
| Catalog label | **Carpet Cleaning** (`SERVICE_CATALOG`) |
| Wizard order | Last card in `WIZARD_SERVICE_OPTIONS` (enabled) |
| Cleaner capability | `{ slug: "carpet-cleaning", label: "Carpet Cleaning" }` |
| DB seed | `('Carpet Cleaning', 'Carpet zones per room', 90, 40000, ...)` (`supabase/seed.sql`) |

**Confirmations**

- `serviceSlugRegistry.test.ts` — catalog keys = `SERVICE_SLUGS` = wizard enabled slugs = capability slugs.
- `bookServiceRoute.test.ts` — `["carpet-cleaning", "/customer/book/carpet-cleaning"]`.
- `resolveBookPageServiceSlug` accepts only catalog slugs; legacy variants rejected.
- Lock column / metadata: `serviceSlug` on lock payload; wizard `buildWizardBookingMetadata` nests slug under `quote.input`.

**Files:** `types.ts`, `catalog.ts`, `constants.ts`, `bookServiceRoute.ts`, `cleanerCapabilityOptions.ts`, `serviceSlugRegistry.test.ts`, `[serviceSlug]/page.tsx`

---

## 2. Booking flow (steps 1–7)

### Step 1 — Service

| Element | Carpet cleaning |
|---------|-----------------|
| Label | Carpet Cleaning (`SERVICE_CATALOG`) |
| Mobile description | “Carpet zones per room” |
| Desktop description | “Carpet and rug clean by room or zone you choose.” |
| Icon / color | `IconRug`, teal (`serviceStepIcons.tsx`) |
| On select defaults | `bedrooms: 2`, `bathrooms: 1` (`wizardPatchForServiceSelection`) |

### Step 2 — Schedule

| Concern | Carpet impact |
|---------|---------------|
| Duration | **180 min** slot (`WIZARD_JOB_DURATION_MINUTES`) — all services |
| Same-day | Service-agnostic JHB booking window |
| Seed mismatch | DB `default_duration_minutes: 90` — display/scheduling uses wizard 180 |

### Step 3 — Location

Standard street / suburb / city / ZA mobile; access notes use generic placeholder (not host/move/office).

### Step 4 — Details

| UI block | Carpet cleaning |
|----------|-----------------|
| Intro | Generic **“Your home & options”** (`getDetailsStepIntro` — no carpet module) |
| Visit frequency | **Shown** — default `FREQUENCY_STEP_OPTIONS` |
| Size inputs | **Bedrooms** + **Bathrooms** labels (`DetailsStepPanel`) — pricing uses **bedrooms as zones only** |
| Cleaning intensity | **Hidden** (`isRegular` only) |
| Equipment / team | **Hidden** |
| Add-ons | **Full default list** (`ADDON_STEP_DISPLAY_ORDER`) — oven, cabinets, walls, etc. |
| Notes | Generic “Notes” / gate code placeholder |

**Wording leak check:** No Airbnb turnover, move/handover, office workspace, or regular-only intensity/equipment copy.

**Product gaps:** Step 1 says “zones” but step 4 says “bedrooms”; bathrooms are **required** (validation) but **not priced**.

### Step 5 — Cleaner

`getCleanerStepCopy` → generic residential titles (not turnover/move/deep/office). Eligibility filters cleaners with `carpet-cleaning` in `serviceSlugs`.

### Step 6 — Review

Hero for carpet (no dedicated builder):

`[serviceLabel, bedBathSummary, frequencyLabel, scheduleLabel]` — e.g. “Carpet Cleaning · 2 beds · 1 bath · Once-off · …”

Regular-only rows (intensity, equipment, team) omitted.

### Step 7 — Checkout

- `buildLockRequestPayload` — `serviceSlug: "carpet-cleaning"`; strips `extraRooms`, non-standard intensity, shalean equipment, `requestedTeamSize > 1`.
- Paystack return: `buildPaymentSuccessCallbackUrl(..., serviceSlug)` → `?service=carpet-cleaning` (pattern from `checkout.test.ts` for regular; same builder).

---

## 3. Pricing & quote logic

### Catalog rule

```82:90:src/features/pricing/server/catalog.ts
  "carpet-cleaning": {
    slug: "carpet-cleaning",
    label: "Carpet Cleaning",
    baseCents: 40_000,
    extraBedroomCents: 0,
    extraBathroomCents: 0,
    perBedroomCents: 15_000,
    fixedCleanerPayout: true,
  },
```

### Line items

- `service_base` — Carpet Cleaning R400  
- `carpet_zones` — quantity = `bedrooms`, R150/unit (`computeLineItems`)  
- Add-ons — stacked from `ADDON_CATALOG` if selected  
- **No** intensity / equipment / team lines  
- **Frequency discount** — `buildFrequencyLineItem` applies to **all** services when frequency ≠ `once` (same as moving audit)

### Example totals (tested)

| Input | `totalCents` |
|-------|----------------|
| 3 zones (bedrooms), 1 bath, once | **85 000** (40k + 3×15k) — `calculateQuote.test.ts` |
| + weekly frequency | Subtotal × 0.9 + `frequency_discount` line |

### Cleaner earnings

- `fixedCleanerPayout: true` → **25 000** per cleaner  
- `ruleApplied`: `fixed_per_cleaner_deep_moving_carpet`  
- Included in “never R0 earnings preview” multi-slug sweep  

### Paystack alignment

`createBookingPaymentLock` → server `calculateQuote(pricingInput)` → `lockedPriceCents`; client total must match.

**Inspect:** `calculateQuote`, `computeLineItems`, `computeCleanerEarnings`, `validatePricingInput`, `createBookingPaymentLock` — all slug-driven; no carpet-specific bugs found.

---

## 4. Payment & finalization

| Step | Carpet-specific? |
|------|------------------|
| Lock API | Validates slug; strips regular-only pricing fields |
| Paystack initialize | Callback includes `service=carpet-cleaning` |
| Verify / webhook | Slug-agnostic |
| Failed page | Generic unless `airbnb-cleaning` query |

Booking status transitions unchanged; `serviceSlug` preserved in metadata for post-payment assignment.

---

## 5. Assignment & dispatch

- Context loads `metadata.serviceSlug` (fallback `"regular-cleaning"` only if missing — wizard always sets slug).  
- Eligibility: `matchesServiceCapability(capabilities, "carpet-cleaning")`.  
- `requestedTeamSize` / team dispatch paths are **regular-only** — carpet stays single-cleaner assignment.  
- Offers created through standard post-payment assignment flow.

**Confirm:** Carpet routes to cleaners with `carpet-cleaning` capability, not residential-only pool by mistake.

---

## 6. Customer dashboard

| Surface | Carpet behavior |
|---------|-----------------|
| List card | `serviceLabel` → “Carpet Cleaning” (`parseBookingDisplay.test.ts`) |
| Home size | `formatBedroomBathroomSummary` → “N bedrooms · M bathrooms” — **not** “carpet zones” |
| Frequency / add-ons | Shown from metadata when present |
| Status / guidance | **Generic** residential lifecycle (no `carpetCustomerDisplay.ts`) |
| Payment panels | Generic; Airbnb panels gated |

**Leaks:** None for Airbnb/move/office/deep-specific **modules**; generic “home” language is expected gap.

---

## 7. Cleaner dashboard

| Surface | Carpet behavior |
|---------|-----------------|
| Offers / jobs | Standard cards; service label from catalog |
| Hero / next steps | **Generic** (`cleanerJobDetailDisplay` — no carpet branch) |
| Earnings on offer | Fixed preview when pricing input present |
| Completion | Service-agnostic; payout not blocked for carpet |

No R0 display when quote/assignment metadata includes earnings breakdown.

---

## 8. Admin dashboard

| Surface | Carpet behavior |
|---------|-----------------|
| Bookings list / detail | Label “Carpet Cleaning” |
| Ops queue | Standard rows; **no** carpet floor-care badges |
| Team support observation | **Skipped** (not `regular-cleaning`) |
| Assignment controls | Slug-aware eligibility list |

Admin hero row mapping has no `isCarpetOperationalBooking` — uses default residential field labels.

---

## 9. Earnings & payouts

| Check | Result |
|-------|--------|
| Quote preview | R25 000/cleaner, `fixed_per_cleaner_deep_moving_carpet` |
| Completed job display | `resolveCleanerEarningsDisplay` tests use same rule id |
| Payout readiness | No carpet-specific blockers; total payout &lt; customer total |

---

## 10. Hard-coded service assumptions scan

| Pattern | Carpet impact |
|---------|---------------|
| `serviceSlug === "regular-cleaning"` | Gates regular-only UI/API — **carpet excluded** ✓ |
| `isAirbnbCleaningSlug` | Airbnb copy only — **carpet excluded** ✓ |
| `isMovingCleaningSlug` / `isDeepCleaningSlug` / `isOfficeCleaningSlug` | **carpet excluded** ✓ |
| `fixedCleanerPayout` | **Set** on carpet — fixed earnings ✓ |
| `isResidentialSummarySlug` | **Does not include** `carpet-cleaning` — sidebar omits frequency/add-on secondary rows (unlike deep/moving/airbnb) |
| `perBedroomCents` branch | Carpet-only pricing path ✓ |
| Frequency discount | **Applies** to carpet — documented product behavior (not regular-only) |
| Fallback `"regular-cleaning"` | Assignment metadata only when slug missing (legacy) |

---

## Blocking bugs

**None identified.** Payment, quote, lock, slug registry, capability matching, and earnings paths behave correctly for `carpet-cleaning`.

---

## Non-blocking risks

| Risk | Severity | Detail |
|------|----------|--------|
| Zone vs bedroom labeling | **High (UX)** | Step 1/seed/pricing say zones; step 4/dashboard say bedrooms/bathrooms |
| Required bathrooms, not priced | **Med (UX)** | Users must enter ≥1 bathroom; no line item — confuses quote |
| Residential add-ons on carpet | **Med (product)** | Oven/cabinets/walls may not match floor-care scope |
| Recurring frequency on carpet | **Med (product)** | Weekly/monthly discounts apply; no carpet-specific recurring copy |
| No operational/customer modules | **Med (UX)** | No stain/floor-care guidance in cleaner/admin/customer dashboards |
| Sidebar recap gap | **Low–Med (UX)** | `isResidentialSummarySlug` excludes carpet — fewer secondary rows mid-wizard |
| Wizard 180 vs seed 90 min | **Low (ops)** | Scheduled end time may not match marketing DB duration |
| Missing launch-readiness tests | **Med (quality)** | No dedicated test file like moving/office/airbnb |
| Legacy slug fallback | **Low** | Missing metadata → `regular-cleaning` in assignment paths |

---

## Files inspected

**Pricing:** `catalog.ts`, `types.ts`, `calculateQuote.ts`, `computeLineItems.ts`, `computeCleanerEarnings.ts`, `validateInput.ts`, `calculateQuote.test.ts`, `serviceSlugRegistry.test.ts`  

**Wizard:** `constants.ts`, `bookServiceRoute.ts`, `serviceSelection.ts`, `lockPayload.ts`, `validation.ts`, `DetailsStepPanel.tsx`, `DetailsStepIntro.tsx`, `ReviewStepPanel.tsx`, `CleanerStepPanel.tsx`, `addonStepDisplay.ts`, `airbnbCleaningDisplay.ts`, `wizardBookingSummaryDisplay.ts`, `serviceStepIcons.tsx`  

**Bookings / payment:** `createBookingPaymentLock.ts`, `checkout.test.ts`  

**Dashboards:** `parseBookingDisplay.ts`, `customerBookingServiceDetailsDisplay.ts`, `customerBookingDetailDisplay.ts`, `customerBookingListCardDisplay.ts`, `cleanerJobDetailDisplay.ts`, `adminBookingDetailDisplay.ts`, `reviewDisplay.ts`  

**Cleaners / assignment:** `cleanerCapabilityOptions.ts`, `eligibility/evaluate.ts`, `assignmentContext.ts`  

**Data:** `supabase/seed.sql`  

**Docs:** `docs/pricing/pricing-engine.md`, `docs/audits/regular-cleaning-end-to-end-system-audit.md`, `docs/audits/moving-cleaning-end-to-end-audit.md`

---

## Tests run

```text
npx vitest run \
  src/features/pricing/server/calculateQuote.test.ts \
  src/features/pricing/server/serviceSlugRegistry.test.ts \
  src/features/booking-wizard/bookServiceRoute.test.ts \
  src/features/dashboards/server/parseBookingDisplay.test.ts \
  src/features/booking-wizard/wizardBookingSummaryDisplay.test.ts
→ 5 files, 65 tests passed

npx vitest run \
  src/features/pricing \
  src/features/booking-wizard \
  src/features/dashboards/server/parseBookingDisplay.test.ts \
  src/features/dashboards/server/resolveCleanerEarningsDisplay.test.ts \
  src/features/bookings/server/lock/createBookingPaymentLock.test.ts
→ 47 files, 292 tests passed
```

**Not run:** Full E2E browser suite; live Paystack; Supabase RLS integration for carpet-only bookings.

---

## Product recommendations (pre-UX optimization)

1. **Introduce `carpetCleaningDisplay.ts`** (mirror `movingCleaningDisplay.ts`) for step 4/5/6/7 and dashboard labels: “Carpet zones”, optional stain notes, floor-care add-ons only.  
2. **Relabel or repurpose bathrooms** on carpet — hide, fixed to 1, or map to “stairs/hallway zones” if product needs a second dimension.  
3. **Curate add-ons** — e.g. stain treatment, furniture move, dry-time expectations; hide kitchen-centric add-ons.  
4. **Align duration** — decide 90 vs 180 minutes and sync seed + `WIZARD_JOB_DURATION_MINUTES` or service-specific duration.  
5. **Clarify recurring** — if carpet is once-off only, hide frequency; if recurring is allowed, add carpet-specific recurring copy.  
6. **Add `carpetCleaning.launchReadiness.test.ts`** — route, quote zones, lock strip, sidebar labels, dashboard parse.  
7. **Admin/cleaner ops** — optional “Floor care” badge and cleaner guidance (equipment, access, drying).

---

## Suggested UX optimization direction

| Phase | Focus |
|-------|--------|
| **A — Truth in labeling** | Zones everywhere customer enters size; dashboard shows “3 carpet zones” not “3 bedrooms”. |
| **B — Scoped options** | Carpet add-ons + notes; remove irrelevant residential controls. |
| **C — Service voice** | Cleaner/customer/admin copy for extraction, stains, furniture, drying — without changing pricing engine. |
| **D — Recap parity** | Include carpet in wizard sidebar summary (`isResidentialSummarySlug` or carpet-specific builder). |
| **E — Tests** | Launch-readiness file + one E2E happy path `carpet-cleaning` booking. |

Keep pricing/payment/lifecycle logic frozen until a deliberate product change; this audit found **no severe defect** requiring a hotfix.

---

## UX optimization (2026-05-20)

Presentation-only pass completed. **No changes** to `calculateQuote()`, carpet pricing rules, fixed payout, assignment, payment, or lifecycle.

### Before vs after (examples)

| Surface | Before | After |
|---------|--------|-------|
| Step 1 desktop | “Carpet and rug clean by room or zone you choose.” | “Restore freshness to carpets and high-traffic areas — stain treatment and fabric refresh.” |
| Step 4 size | Bedrooms + Bathrooms | **Carpet zones** only (bathrooms hidden; still stored as 1 for validation) |
| Review hero | “Carpet Cleaning · 2 beds · 1 bath · …” | Schedule · location · **2 carpet zones** · extras |
| Customer detail | Home size: “2 bedrooms · 1 bathroom” | **Carpet zones** |
| Payment success | Generic booking copy | “Your carpet cleaning is scheduled” + drying note |
| Cleaner guidance | Generic lifecycle | **Carpet & floor-care guidance** (stain, ventilation) |

### Files added

- `src/features/booking-wizard/carpetCleaningDisplay.ts`
- `src/features/dashboards/carpetCustomerDisplay.ts`
- `src/features/dashboards/carpetOperationalDisplay.ts`
- `src/features/booking-wizard/carpetCleaning.launchReadiness.test.ts`
- `src/features/booking-wizard/carpetCleaningDisplay.test.ts`
- `src/features/dashboards/carpetOperationalDisplay.test.ts`

### Future ideas (document only)

- Stain severity scoring
- Drying timers / post-clean reminders
- Before/after photos
- Upholstery add-on workflow
- Rug-specific workflows
- Commercial floor-care mode
- Fabric-safe product preferences

---

## Acceptance criteria (audit)

| Criterion | Met? |
|-----------|------|
| Carpet booking flow works end-to-end (technical) | **Yes** |
| Payment amount matches server quote | **Yes** |
| Booking appears in dashboards with correct label | **Yes** (generic detail copy) |
| Cleaner can accept and complete (capability + generic flow) | **Yes** |
| Earnings positive and safe | **Yes** |
| No wrong service-specific wording leaks (Airbnb/move/office/deep modules) | **Yes** |
| No lifecycle/payment regressions observed in code | **Yes** |
| Existing services remain stable (292 tests) | **Yes** |
| Risks classified | **Yes** — see non-blocking table |
| Ready for UX optimization without code hotfixes | **Yes** |
