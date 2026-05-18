# Customer booking flow — post UI polish regression audit

**Date:** 2026-05-18  
**Scope:** Customer booking wizard (Steps 1–7), Paystack handoff, payment verification, customer booking detail/dashboard UI polish.  
**Status:** Audit only — **no production code changes**.

**Prior audits:** `docs/audits/customer-booking-flow-ui-polish-safety-audit.md`, `docs/audits/step1-horizontal-service-ui-redesign-safety-audit.md`

---

## Executive summary

| Area | Verdict |
|------|---------|
| Frozen booking/payment/assignment logic | **PASS** — no diffs in boundary files |
| Wizard state, validation, lock, checkout orchestration | **PASS** — unchanged contracts |
| Automated tests (recommended suites) | **PASS** — 294 tests across 8 suites |
| TypeScript `npm run typecheck` | **FAIL** — 2 errors in new `scheduleStepDisplay.ts` |
| Step 1 Service | **PASS** — slugs, selection handler, office/residential defaults preserved |
| Step 2 Schedule | **PASS with caveats** — same `date`/`time` state; preset UI + hidden native fallbacks; discoverability reduced for non-preset times/dates |
| Steps 3–7 + payment verify | **PASS** — logic unchanged; presentation refactored |
| Customer dashboard/detail | **PASS** — read models unchanged; display-only refactor |
| Copy/encoding polish defects | **WARN** — `?` substituted for em dash / star in a few strings |

**Overall regression risk:** **Low** for booking creation, payment finalization, assignment, and server authority. **Medium-low** for schedule UX edge cases (times outside 08:00–17:00 presets, dates beyond the 7-day card window without using hidden inputs). **CI risk:** typecheck currently fails on uncommitted schedule display module.

**Recommendation:** Safe to proceed with manual QA on schedule presets and payment E2E; fix typecheck before merge; fix character-encoding copy glitches when polishing.

---

## 1. Changed files review

Sources: `git status`, `git diff HEAD` on booking/customer/payment paths (uncommitted working tree as of audit date).

### Modified (tracked)

| File | Classification | Notes |
|------|----------------|-------|
| `src/features/booking-wizard/components/BookingWizard.tsx` | UI with possible logic impact | Extracted step panels; `handleSelectService` preserved; checkout/lock flow identical; fixed mobile Continue on service step |
| `src/features/booking-wizard/components/WizardStepper.tsx` | UI-only safe | Mobile progress bar + desktop chip labels; `WIZARD_STEP_LABELS` only |
| `src/features/booking-wizard/components/WizardStepper.test.tsx` | UI-only safe | Tests updated for new stepper markup |
| `src/features/booking-wizard/components/WizardNav.tsx` | UI-only safe | Optional `className` prop for layout |
| `src/features/booking-wizard/constants.ts` | UI-only safe | Display copy, `FREQUENCY_STEP_OPTIONS`, `ADDON_STEP_*`, step label "Schedule"; **service slugs unchanged** |
| `src/features/booking-wizard/format.ts` | UI-only safe | Added `formatAddonPrice` (display) |
| `src/app/payment/success/PaymentSuccessVerifier.tsx` | UI-only safe | `runVerify` logic unchanged; shell/panel presentation |
| `src/app/payment/success/page.tsx` | UI-only safe | Suspense fallback component swap |
| `src/app/(customer)/customer/page.tsx` | UI-only safe | Uses new dashboard components; same `listCustomerBookings` read model |
| `src/app/(customer)/customer/bookings/[bookingId]/page.tsx` | UI-only safe | Same `getCustomerBookingDetail`; presentation components |

### Added (untracked)

| File | Classification | Notes |
|------|----------------|-------|
| `src/features/booking-wizard/components/ServiceStepPanel.tsx` | UI-only safe | Presentation; `onSelect(slug)` contract |
| `src/features/booking-wizard/components/ServiceStepPanel.test.tsx` | UI-only safe | Static markup tests |
| `src/features/booking-wizard/components/serviceStepIcons.tsx` | UI-only safe | Icons/colors per slug |
| `src/features/booking-wizard/components/ScheduleStepPanel.tsx` | UI with possible logic impact | Card/slot UI over `date`/`time`; hidden `type="date"`/`type="time"` fallbacks |
| `src/features/booking-wizard/components/ScheduleStepPanel.test.tsx` | UI-only safe | |
| `src/features/booking-wizard/scheduleStepDisplay.ts` | UI with possible logic impact | Display helpers; uses `isSlotInPast` for disabled slots; **typecheck errors** |
| `src/features/booking-wizard/scheduleStepDisplay.test.ts` | UI-only safe | |
| `src/features/booking-wizard/components/FrequencyStepPanel.tsx` | UI-only safe | Same frequency **values** as `PRICING_FREQUENCIES` |
| `src/features/booking-wizard/components/FrequencyStepPanel.test.tsx` | UI-only safe | |
| `src/features/booking-wizard/components/AddonsStepPanel.tsx` | UI-only safe | Same addon **slugs**; order from `ADDON_STEP_DISPLAY_ORDER` |
| `src/features/booking-wizard/components/AddonsStepPanel.test.tsx` | UI-only safe | |
| `src/features/booking-wizard/wizardLayout.ts` | UI-only safe | Shared `max-w-3xl` shell across Steps 1–7 |
| `src/features/booking-wizard/wizardLayout.test.ts` | UI-only safe | |
| `src/features/booking-wizard/format.test.ts` | UI-only safe | |
| `src/app/payment/success/PaymentVerificationShell.tsx` | UI-only safe | Reuses wizard shell/stepper for visual parity |
| `src/app/payment/success/PaymentVerificationShell.test.ts` | UI-only safe | |
| `src/features/dashboards/customerBookingDetailDisplay.ts` | UI-only safe | Status hero copy/tone mapping (display) |
| `src/features/dashboards/customerBookingDetailDisplay.test.ts` | UI-only safe | |
| `src/features/dashboards/customerBookingsDashboardDisplay.ts` | UI-only safe | Tab filter presentation using existing fields |
| `src/features/dashboards/customerBookingsDashboardDisplay.test.ts` | UI-only safe | |
| `src/components/dashboard/customer/*.tsx` (10 files) | UI-only safe | Presentation components for list/detail |

### Unchanged (frozen boundary — verified `git diff HEAD` empty)

`validation.ts`, `types.ts`, `storage.ts`, `buildMetadata.ts`, `lockPayload.ts`, `checkout.ts`, `api.ts`, `slot.ts`, `navigation.ts`, `src/features/pricing/server/*` (no wizard-related diffs), `src/features/payments/server/*`, `src/features/bookings/server/lock/*`, `src/app/api/paystack/*`, `src/app/api/bookings/lock/*`, `src/features/dashboards/server/customerBookingReadModel.ts`, assignment/finalize command paths.

---

## 2. Frozen boundary verification

| Boundary file / area | Changed? | Explanation |
|---------------------|----------|-------------|
| `validation.ts` | **No** | All step validators intact |
| `types.ts` | **No** | `BookingWizardState` keys unchanged |
| `storage.ts` | **No** | `PERSIST_KEYS` unchanged |
| `buildMetadata.ts` | **No** | Quote/lock metadata mapping unchanged |
| `lockPayload.ts` | **No** | Lock body shape unchanged |
| `checkout.ts` | **No** | Initialize payload + `canProceedToCheckout` guard unchanged |
| `api.ts` | **No** | Quote/cleaners/lock/initialize fetch unchanged |
| `slot.ts` | **No** | `buildWizardSlot`, `isSlotInPast`, `minBookableDateString` unchanged |
| Pricing server | **No** | Catalog/calculate unchanged in this polish |
| Payment server | **No** | verify/finalize/webhook unchanged |
| Paystack routes | **No** | No diff under `src/app/api/paystack` |
| Booking lock routes | **No** | No diff under `src/app/api/bookings/lock` |
| Assignment/finalize | **No** | No changes in assignment command paths from this polish |
| Customer booking read models | **No** | `customerBookingReadModel.ts` unchanged |

---

## 3. Step 1 Service regression check

| Check | Result |
|-------|--------|
| `serviceSlug` values unchanged | **PASS** — same six slugs in `WIZARD_SERVICE_OPTIONS` / `SERVICE_SLUGS` |
| Selection updates same state field | **PASS** — `handleSelectService` → `patch({ serviceSlug, bedrooms, bathrooms })` |
| Office Cleaning → 0/0 bedrooms/bathrooms | **PASS** — `slug === "office-cleaning" ? 0 : 2` / `0 : 1` |
| Residential → 2/1 defaults | **PASS** |
| Continue blocks if no service | **PASS** — `goNext` → `validateServiceStep` |
| Continue → Schedule after valid selection | **PASS** — `nextStep("service")` → `"datetime"` |
| No slug rename/remap | **PASS** |
| No pricing/catalog contract change | **PASS** — labels still from `SERVICE_CATALOG`; descriptions are display-only |

**Evidence:** `handleSelectService` in `BookingWizard.tsx` lines 62–70; `ServiceStepPanel` calls `onSelect(service.slug)` only.

---

## 4. Step 2 Schedule regression check

| Check | Result |
|-------|--------|
| Date writes to `date` state | **PASS** — `onDateChange={(date) => patch({ date })}` |
| Time writes to `time` state | **PASS** — `onTimeChange={(time) => patch({ time })}` |
| Stored format unchanged | **PASS** — `YYYY-MM-DD` and `HH:mm` (native input values) |
| Timezone behavior unchanged | **PASS** — validation/slot still use `WIZARD_TIMEZONE` / `+02:00` in `slot.ts` |
| Min bookable date unchanged | **PASS** — `minBookableDateString()` still drives `minDate` |
| Past date/time validation unchanged | **PASS** — `validateDateTimeStep` + `isSlotInPast` untouched |
| Continue blocks invalid date/time | **PASS** — same `goNext` validation |
| Cards/slots are presentation over state | **PASS** — `ScheduleStepPanel` is controlled component |
| No backend availability engine added | **PASS** — `scheduleStepDisplay.ts` is client display only |

**Caveats (UX, not server logic):**

1. **Visible date cards** show 7 days from `minDate` (`SCHEDULE_DATE_OPTION_COUNT = 7`). Dates outside that window are still valid if set via the **sr-only** `<input type="date" min={minDate}>` or restored from `localStorage`; UI shows a hint when selected date is not in the card list.
2. **Visible time slots** are presets `08:00`–`17:00` hourly. Non-preset times (e.g. `07:30`) appear in the grid only if already selected (`resolveScheduleTimeSlots`). New users cannot easily pick arbitrary minutes without the hidden `type="time"` input (`tabIndex={-1}`).
3. **Disabled slots** use `isScheduleTimeSlotDisabled` → `isSlotInPast` — aligns with validation, does not bypass it.

---

## 5. Step 3 Location regression check

| Check | Result |
|-------|--------|
| Field keys unchanged | **PASS** — `addressLine1`, `suburb`, `city`, `locationNotes` |
| `normalizeAreaSlug` at lock/quote | **PASS** — still in `lockPayload.ts` / `api.ts` |
| `validateLocationStep` unchanged | **PASS** |
| Continue blocks incomplete fields | **PASS** — inline fields + same `goNext` |

Location step markup remains inline in `BookingWizard.tsx` (layout/classes only).

---

## 6. Step 4 Details / Add-ons regression check

| Check | Result |
|-------|--------|
| `bedrooms` / `bathrooms` unchanged | **PASS** |
| Office `propertySizeSqm` unchanged | **PASS** |
| Frequency values unchanged | **PASS** — `once`, `weekly`, `biweekly`, `monthly` match `PRICING_FREQUENCIES` |
| Add-on slugs unchanged | **PASS** — all five `ADDON_SLUGS` in `ADDON_STEP_DISPLAY_ORDER` |
| Prices from catalog | **PASS** — `ADDON_CATALOG[slug].amountCents` via `formatAddonPrice` (display only) |
| `specialInstructions` unchanged | **PASS** |
| Quote input path unchanged | **PASS** — `wizardStateToPricingInput` in `buildMetadata.ts` |
| Validation unchanged | **PASS** — `validateDetailsStep` |

**Note:** Add-on **display order** changed (was `Object.keys(ADDON_CATALOG)` order); selected slugs array semantics unchanged.

---

## 7. Step 5 Cleaner regression check

| Check | Result |
|-------|--------|
| `best_available` / selected modes | **PASS** — same `patch` handlers |
| `fetchAvailableCleaners` on enter | **PASS** — `goNext` from `cleaner` and pre-fetch from `details` |
| API payload unchanged | **PASS** — `api.ts` unchanged |
| Ineligible cleaner disabled + validation | **PASS** |
| `selectedCleanerId` / `selectedCleanerDisplayName` | **PASS** |
| `validateCleanerStep` | **PASS** |

Cleaner step is presentation-only diff (loading copy); logic block unchanged in `BookingWizard.tsx`.

---

## 8. Step 6 Review regression check

| Check | Result |
|-------|--------|
| `fetchPricingQuote` / `loadQuoteForReview` | **PASS** |
| Quote line items / total display | **PASS** — still `state.quote` from server |
| `reviewConfirmed` checkbox | **PASS** |
| Continue blocked until confirmed | **PASS** — `validateReviewStep` on `goNext` from review |
| No client-side price authority | **PASS** — totals from `state.quote.totalCents` |

---

## 9. Step 7 Checkout regression check

| Check | Result |
|-------|--------|
| Lock before Paystack initialize | **PASS** — `createPaymentLock` then `initializePaystackCheckout` |
| Lock payload | **PASS** — `buildLockRequestPayload` unchanged |
| Initialize payload | **PASS** — `buildInitializeCheckoutPayload` unchanged |
| Payment amount from server lock | **PASS** — not computed in UI |
| Checkout idempotency key | **PASS** — `checkoutIdempotencyKey` flow unchanged |
| Callback URL | **PASS** — `buildPaymentSuccessCallbackUrl` in `checkout.ts` |
| Quote mismatch / lock expiry | **PASS** — `shouldReturnToReview` + step/quote reset unchanged |

---

## 10. Payment verification regression check

| Check | Result |
|-------|--------|
| Paystack verify API call | **PASS** — `GET /api/paystack/verify?reference=...` unchanged in `PaymentSuccessVerifier` |
| Webhook/finalize path | **PASS** — server files unchanged |
| Success redirect | **PASS** — `router.replace(customerBookingDetailPath(bookingId))` after 1500ms |
| No client-side finalize | **PASS** |
| Loading screen presentation-only | **PASS** — `PaymentVerificationShell` / spinner |
| Success/failure behavior | **PASS** — phase machine + retry link unchanged |

---

## 11. Customer booking detail / dashboard regression check

| Check | Result |
|-------|--------|
| Read model logic | **PASS** — `getCustomerBookingDetail`, `listCustomerBookings` unchanged |
| Lifecycle events data | **PASS** — same `b.timeline` passed to `CustomerLifecycleTimeline` |
| Status labels display-only | **PASS** — `customerBookingDetailDisplay.ts` maps existing status fields |
| Payment references | **PASS** — `CustomerBookingPaymentsCard` renders `b.payments` |
| Booking ownership / visibility | **PASS** — pages still use `getCurrentUser` + server read models |
| Access control | **PASS** — no RLS/route auth changes |

**UX change (intentional polish):** Customer home previously showed **3 recent** bookings; now shows **all** bookings with filter tabs (`upcoming` / `completed` / `cancelled` / `unpaid`) using existing `status` and `isUpcoming` — presentation filter only, not a new server query.

---

## 12. Responsive / UI sanity check

| Check | Result |
|-------|--------|
| Mobile horizontal overflow | **LIKELY OK** — `min-w-0`, `overflow-x-auto` on date scroller; wide shell `max-w-3xl` with padding |
| Desktop width consistency Steps 1–7 | **PASS** — `getWizardShellClass` uses `WIZARD_SHELL_WIDE_CLASS` for all steps |
| Stepper active state | **PASS** — mobile bar + desktop chips tested |
| Back / Continue on every step | **PASS** — service step: fixed bottom Continue (mobile), no Back; other steps: `WizardNav` |
| Selected states visible | **PASS** — `aria-pressed` on service/date/time cards |
| Buttons remain buttons | **PASS** |
| Labels connected to inputs | **PASS** — location/details use `Field`; schedule has sr-only labeled fallbacks |
| Keyboard navigation | **PARTIAL** — primary interaction is buttons; hidden date/time inputs are `tabIndex={-1}` (screen-reader/fallback path) |

**Defect:** Several user-visible strings show `?` instead of intended punctuation (em dash `—`, star `★`, ellipsis `…`) in `BookingWizard.tsx` — encoding/copy issue, not logic.

---

## 13. Test suite

### Commands run

```bash
npm run typecheck                                    # FAIL (see below)
npm test -- src/features/booking-wizard              # PASS — 12 files, 36 tests
npm test -- src/lib/app/paymentReturn.test.ts        # PASS — 9 tests
npm test -- src/app/payment/success/PaymentSuccessVerifier.test.ts  # PASS — 1 test
npm test -- src/app/payment/failed                     # PASS — 4 tests
npm test -- src/features/bookings/server/lock          # PASS — 21 tests
npm test -- src/features/payments/server               # PASS — 47 tests
npm test -- src/features/dashboards                    # PASS — 176 tests
```

### Typecheck failure (blocks CI)

```
src/features/booking-wizard/scheduleStepDisplay.ts(102,41): error TS2345
src/features/booking-wizard/scheduleStepDisplay.ts(103,18): error TS2345
```

`resolveScheduleTimeSlots` pushes a `string` into a readonly preset tuple — fix required before merge (not fixed in this audit).

### Recommended additional manual QA

1. Book flow E2E: service → schedule (preset time) → location → details → cleaner → review → Paystack test → verify redirect.
2. Schedule edge: select date on day 7 card; attempt past time slot (should disable + block on Continue).
3. Restored wizard state: `localStorage` with `time: "07:30"` — slot appears and validates if future.
4. Office cleaning path: 0/0 rooms + sqm → quote → lock.
5. Customer dashboard tabs: upcoming vs unpaid filters match expectations.

---

## Findings summary

| ID | Severity | Area | Finding |
|----|----------|------|---------|
| F-1 | **High (CI)** | Build | `npm run typecheck` fails on `scheduleStepDisplay.ts` |
| F-2 | **Low** | Copy | `?` character corruption in loading/error strings (`BookingWizard.tsx`) |
| F-3 | **Low** | Schedule UX | Preset time grid 08:00–17:00; arbitrary times only via hidden input or persisted state |
| F-4 | **Low** | Schedule UX | Date cards show 7 days; other dates via hidden date input or persistence |
| F-5 | **Info** | Dashboard | Home page shows all bookings + tabs vs previous “3 recent” slice |

---

## Conclusion

**Booking, payment, validation, assignment, and dashboard data logic were not broken** by the UI polish, as evidenced by unchanged frozen modules and passing targeted test suites. The polish successfully confines behavioral risk to **presentation layers** (new step panels, layout shell, dashboard components) while preserving state keys, validators, API payloads, and server-side payment authority.

**Do not treat the branch as merge-ready until `npm run typecheck` passes.** After that, manual schedule and payment E2E checks are sufficient to sign off.

---

*Audit performed against uncommitted working tree; no code fixes applied per audit-only scope.*
