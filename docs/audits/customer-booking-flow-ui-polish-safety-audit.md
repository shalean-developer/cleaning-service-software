# Customer booking flow — UI polish safety audit

**Date:** 2026-05-18  
**Scope:** Steps 1–7 of `/customer/book`, Paystack handoff, payment return states, and post-payment customer booking detail.  
**Status:** Audit only — **no production code changes**.

**Goal:** Identify what can be polished visually without touching booking creation, payment finalization, Paystack, webhooks, verify, assignment dispatch, or lifecycle status logic.

---

## Executive summary

The customer booking journey is a **single-route, seven-step client wizard** (`/customer/book`) with all step panels rendered inline in `BookingWizard.tsx`. Business rules live in `validation.ts`, pricing/lock payloads in `buildMetadata.ts` / `lockPayload.ts` / `checkout.ts`, and server-side recalculation at lock/initialize/verify. **The flow is safe to polish visually** if changes stay in presentation layers and avoid field names, validation predicates, API payloads, and payment orchestration.

| Area | Polish safety |
|------|----------------|
| `WizardStepper`, `WizardNav`, `Field` | **Safest** — pure presentation |
| Tailwind/layout/copy inside step panels | **Safe now** — if handlers and `patch` keys unchanged |
| `validation.ts` error **copy** only | **Safe now** |
| `validation.ts` rules / field keys | **Frozen** |
| `checkout.ts`, `lockPayload.ts`, `api.ts`, `buildMetadata.ts` | **Frozen** |
| Paystack + lock + verify + webhook server | **Frozen** |
| Status/lifecycle labels from read models | **Safe with tests** (display only; semantics from server) |

---

## 1. Current flow map

### Journey overview

```mermaid
flowchart TD
  S1[Step 1 Service] --> S2[Step 2 Date and time]
  S2 --> S3[Step 3 Location]
  S3 --> S4[Step 4 Details and add-ons]
  S4 --> S5[Step 5 Cleaner preference]
  S5 --> S6[Step 6 Review + quote API]
  S6 --> S7[Step 7 Checkout]
  S7 --> L[POST /api/bookings/lock]
  L --> I[POST /api/paystack/initialize]
  I --> PS[Paystack hosted checkout]
  PS --> SU[/payment/success]
  SU --> V[GET /api/paystack/verify]
  V --> BD[/customer/bookings/:id]
  PS -.->|failure/cancel| PF[/payment/failed]
```

**Entry:** `src/app/(customer)/customer/book/page.tsx` → `requireCustomerReady` → `<BookingWizard customerEmail={...} />`  
**State:** `useState<BookingWizardState>` in `BookingWizard.tsx`; persist via `localStorage` key `shalean-booking-wizard-v1` (`storage.ts`).  
**No React context, no `useBookingWizard`, no Zod** — validation is hand-written TypeScript in `validation.ts`.

---

### Step 1 — Service selection

| Item | Detail |
|------|--------|
| **Route** | `/customer/book` (wizard step `service`) |
| **Component files** | `BookingWizard.tsx` (inline panel), `WizardStepper.tsx`, `WizardNav.tsx`, `Field.tsx` |
| **Form fields** | `serviceSlug` (button selection) |
| **Validation** | `validateServiceStep` — `serviceSlug` required; must be in `WIZARD_SERVICE_OPTIONS` with `enabled: true` |
| **Validation trigger** | `goNext` → `validateWizardStep("service", state)` |
| **Data read** | `WIZARD_SERVICE_OPTIONS` from `constants.ts` (labels/descriptions from `SERVICE_CATALOG`) |
| **Data written** | Client state only; on select also resets `bedrooms`/`bathrooms` for `office-cleaning` vs residential defaults |
| **Business logic deps** | `SERVICE_CATALOG`, enabled slugs; office vs residential room defaults on select |
| **UI-only** | Card/button styling, service descriptions, header copy, stepper |

**Side effect on select (risky if changed):** Choosing `office-cleaning` sets `bedrooms: 0`, `bathrooms: 0`; other services set `2` / `1`.

---

### Step 2 — Date & time

| Item | Detail |
|------|--------|
| **Component files** | `BookingWizard.tsx`, `Field.tsx`, `slot.ts` (`minBookableDateString`, `buildWizardSlot`, `isSlotInPast`) |
| **Form fields** | `date` (`type="date"`), `time` (`type="time"`) |
| **Validation** | `validateDateTimeStep` — both required; valid slot; not in past (`Africa/Johannesburg`) |
| **Validation trigger** | `goNext` on `datetime` step |
| **Data read** | `minDate` from `minBookableDateString()` |
| **Data written** | Client state only |
| **Business logic deps** | `WIZARD_TIMEZONE`, `WIZARD_JOB_DURATION_MINUTES` (used later for slot end), `buildWizardSlot` |
| **UI-only** | Timezone help text, input layout, date/time field grouping |

---

### Step 3 — Location

| Item | Detail |
|------|--------|
| **Component files** | `BookingWizard.tsx`, `Field.tsx` |
| **Form fields** | `addressLine1`, `suburb`, `city`, `locationNotes` (optional) |
| **Validation** | `validateLocationStep` — address/suburb/city required; `normalizeAreaSlug(suburb)` must succeed |
| **Validation trigger** | `goNext` on `location` step |
| **Data read** | — |
| **Data written** | Client state; `areaSlug` derived at lock/quote/cleaners via `normalizeAreaSlug(state.suburb)` |
| **Business logic deps** | `normalizeAreaSlug` (cleaner eligibility + lock payload) |
| **UI-only** | Labels, optional notes helper, autocomplete attributes, section layout |

---

### Step 4 — Details & add-ons

| Item | Detail |
|------|--------|
| **Component files** | `BookingWizard.tsx`, `Field.tsx`, `ADDON_CATALOG` / `PRICING_FREQUENCIES` imports |
| **Form fields** | `bedrooms`, `bathrooms` (hidden for office); `propertySizeSqm` (office only); `frequency`; `addons[]`; `specialInstructions` |
| **Validation** | `validateDetailsStep` — per-`SERVICE_CATALOG` room rules; office requires `propertySizeSqm > 0` |
| **Validation trigger** | `goNext` on `details` step |
| **Data read** | `SERVICE_CATALOG[state.serviceSlug]` for `allowZeroRooms` |
| **Data written** | Client state |
| **Business logic deps** | Catalog rules, addon slugs, frequency enum → pricing input |
| **API prefetch** | On successful validation, `goNext` may call `fetchAvailableCleaners` and jump to `cleaner` step |
| **UI-only** | Add-on list layout, checkbox styling, frequency select presentation, instructions textarea |

---

### Step 5 — Cleaner preference

| Item | Detail |
|------|--------|
| **Component files** | `BookingWizard.tsx` |
| **Form fields** | `cleanerPreferenceMode` (`best_available` \| `selected`), `selectedCleanerId`, `selectedCleanerDisplayName`, `availableCleaners` (API result) |
| **Validation** | `validateCleanerStep` — best available always OK; selected requires eligible card in `availableCleaners` |
| **Validation trigger** | `goNext` on `cleaner` step; also re-validated at checkout via `validateCheckoutStep` |
| **Data read** | `POST /api/cleaners/available` (`api.ts` → `fetchAvailableCleaners`) — uses slot, service, suburb/areaSlug, room counts |
| **Data written** | Client state; server has no booking row yet |
| **Business logic deps** | Eligibility status on `CleanerPublicCard`; lock re-validates on server |
| **UI-only** | Card list scroll, rating display, disabled styling, “Best available” copy, loading text |

---

### Step 6 — Review

| Item | Detail |
|------|--------|
| **Component files** | `BookingWizard.tsx`, `format.ts` |
| **Form fields** | `reviewConfirmed` (checkbox); display-only summary from state + `quote` |
| **Validation** | `validateReviewStep` — `quote` required; `reviewConfirmed` must be true |
| **Validation trigger** | `goNext` to checkout; `validateCheckoutStep` includes review |
| **Data read** | `POST /api/pricing/quote` via `fetchPricingQuote` / `wizardStateToPricingInput` (`buildMetadata.ts`) |
| **Data written** | `quote: PricingBreakdown` in client state (not persisted to localStorage) |
| **Business logic deps** | Server quote is source of truth for line items; `clientQuoteTotalCents` sent at lock |
| **UI-only** | Summary `<dl>` layout, line-item list, total typography, confirmation checkbox label |

**Auto-fetch:** `useEffect` loads quote when `step === "review"` and `!state.quote`.

---

### Step 7 — Checkout / Paystack handoff

| Item | Detail |
|------|--------|
| **Component files** | `BookingWizard.tsx`, `checkout.ts`, `lockPayload.ts`, `api.ts` |
| **Form fields** | None new — uses accumulated state + `customerEmail` prop |
| **Validation** | `validateCheckoutStep` (review + cleaner + `!checkoutSubmitting`) |
| **Validation trigger** | `handleCheckout` on “Pay with Paystack” |
| **Data read** | `state.quote`, email from page |
| **Data written** | `checkoutIdempotencyKey`, `checkoutSubmitting`, lock ids; then `clearWizardStorage()` + redirect |
| **API sequence** | 1) `buildLockRequestPayload` → `POST /api/bookings/lock` 2) `buildInitializeCheckoutPayload` → `POST /api/paystack/initialize` 3) `window.location.href = authorization_url` |
| **Business logic deps** | Lock recalculates price; `QUOTE_MISMATCH` / `LOCK_EXPIRED` → forced return to review; amount from lock only (no client price to Paystack) |
| **UI-only** | Checkout copy, total display, email display, loading/disabled on pay button |

**Frozen boundary files:** `checkout.ts`, `lockPayload.ts`, `api.ts`, `src/app/api/bookings/lock/route.ts`, `src/app/api/paystack/initialize/route.ts`, all `src/features/payments/server/*`, `src/features/bookings/server/lock/*`.

---

### Payment verification / loading / success

| Item | Detail |
|------|--------|
| **Routes** | `/payment/success` (`page.tsx` + `PaymentSuccessVerifier.tsx`), `/payment/failed` (`page.tsx` + `PaymentFailedPageContent.tsx`) |
| **Flow** | Paystack redirects to `/payment/success?reference=…` → client `GET /api/paystack/verify?reference=…` → redirect to `/customer/bookings/:id` after 1.5s |
| **Client logic** | `resolvePaystackReference`, `parseVerifyPaymentResponse`, `customerBookingDetailPath` (`paymentReturn.ts`) |
| **Server** | `verifyPayment.ts`, `upsertBookingFromPaystack.ts`, `finalizePaidBooking.ts`; webhook parallel path |
| **UI-only** | Spinner, success/error copy, retry button layout, link styling |
| **Frozen** | Verify URL, response parsing contract, redirect target, no client-side booking mutation (guarded by `PaymentSuccessVerifier.test.ts`) |

---

### Post-payment — Customer booking detail / dashboard

| Item | Detail |
|------|--------|
| **Routes** | `/customer/bookings`, `/customer/bookings/[bookingId]`, `/customer` (home with recent bookings) |
| **Page files** | `bookings/page.tsx`, `bookings/[bookingId]/page.tsx` |
| **Read model** | `getCustomerBookingDetail`, `listCustomerBookings` (`customerBookingReadModel.ts`) |
| **Display helpers** | `parseBookingDisplay.ts`, `paymentFailureDisplay.ts`, `statusLabels.ts`, `lifecycleTimeline.ts` |
| **Shared UI** | `DashboardShell`, `StatusBadge`, `LifecycleTimeline`, `PaymentIssuePanel`, `RetryPaymentButton`, `EmptyState` |
| **Data shown** | Status badges (booking + payment), schedule, total, location, cleaner preference, assignment message, payments list, lifecycle timeline |
| **Business logic deps** | Status strings and labels from DB + audit; `canRetryPayment`; assignment messages from read model |
| **UI-only** | Section order, grid layout, typography, card borders — **not** label functions without checking tests |

---

## 2. Safe-to-edit UI areas

### Safest files (touch first)

| File | Safe changes |
|------|----------------|
| `src/features/booking-wizard/components/Field.tsx` | Label typography, spacing, error color, `inputClass` border/radius/focus ring |
| `src/features/booking-wizard/components/WizardStepper.tsx` | Chip colors, sizes, truncation, mobile scroll, optional step numbers/icons |
| `src/features/booking-wizard/components/WizardNav.tsx` | Button layout, loading text, sticky footer (if added without changing callbacks) |
| `src/app/payment/success/PaymentSuccessVerifier.tsx` | Spinner, card layout, success/error messaging (keep verify URL and redirect logic) |
| `src/app/payment/failed/PaymentFailedPageContent.tsx` | Layout, button hierarchy, spacing (model/copy from server helpers unchanged) |
| `src/components/dashboard/StatusBadge.tsx` | Badge visual styles (not label strings) |
| `src/components/dashboard/DashboardShell.tsx` | Nav chrome, title area, max-width |
| `src/components/dashboard/EmptyState.tsx` | Empty list presentation |

### Safe within `BookingWizard.tsx` (presentation only)

- Page shell: `max-w-lg`, `bg-zinc-50`, header “Book a clean”
- Step card: `rounded-2xl border`, padding, shadow
- Service/cleaner selection button **classes** (keep `onClick` → `patch` keys identical)
- `apiError` alert styling
- Review summary `<dl>` / line-item list layout
- Checkout reassurance paragraph wording (not legal/flow claims that contradict server behavior)
- Loading strings (“Calculating price…”, “Loading cleaners…”)

### Safe with tests (display tied to read models)

| File | Caution |
|------|---------|
| `src/app/(customer)/customer/bookings/[bookingId]/page.tsx` | Layout OK; changing which fields render is OK; **do not** change status label functions inline |
| `src/features/bookings/server/statusLabels.ts` | Visual tone mapping OK; changing label text may break snapshot/copy tests |
| `src/features/bookings/server/paymentFailureDisplay.ts` | Copy changes need `paymentFailureDisplay.test.ts` |
| `src/components/dashboard/PaymentIssuePanel.tsx` | Layout OK; copy comes from `paymentIssuePanelCopy` |

### Do not edit for UI polish alone

- `validation.ts` — rule changes
- `buildMetadata.ts`, `lockPayload.ts`, `checkout.ts`, `api.ts`, `storage.ts` (persist keys)
- `types.ts` — state shape / field names
- Any `src/features/payments/server/*`, `src/features/bookings/server/lock/*`, `src/app/api/paystack/*`, `src/app/api/bookings/lock/*`
- `customerBookingReadModel.ts` (except purely presentational helpers if split later)

---

## 3. Risky areas (must not change without deeper tests)

| Risk | Why | Key files |
|------|-----|-----------|
| **Form field names / state keys** | Lock payload, metadata, pricing input, localStorage persistence | `types.ts`, `storage.ts` `PERSIST_KEYS`, `lockPayload.ts`, `buildMetadata.ts` |
| **Validation predicates** | Blocks navigation and checkout; tied to catalog/office rules | `validation.ts` |
| **Suburb → areaSlug** | Cleaner eligibility and lock | `normalizeAreaSlug`, location validation |
| **Service select side effects** | Office vs residential room defaults | `BookingWizard.tsx` service `onClick` |
| **Pricing boundaries** | Quote at review; server recalc at lock; `clientQuoteTotalCents` | `wizardStateToPricingInput`, `/api/pricing/quote`, `createBookingPaymentLock` |
| **Cleaner preference semantics** | `best_available` vs `selected` + `preferred_cleaner_id` in metadata | `buildWizardBookingMetadata`, `validateCleanerStep`, lock validation |
| **Checkout idempotency** | `checkoutIdempotencyKey` in localStorage | `storage.ts`, `handleCheckout` |
| **Lock → initialize order** | Must lock before Paystack | `api.test.ts`, `handleCheckout` |
| **Paystack initialize payload** | `bookingId`, `lockId`, `paymentIdempotencyKey`, `callbackUrl` | `checkout.ts`, `initializePayment.ts` |
| **Verify / webhook finalize** | Booking status transitions, assignment dispatch | `verifyPayment.ts`, `finalizePaidBooking.ts`, `handlePaystackWebhook.ts` |
| **`shouldReturnToReview` errors** | Forces step + clears quote/confirmation | `lockPayload.ts`, `handleCheckout` |
| **Status / lifecycle labels** | Derived from DB status + audit, not free text | `paymentFailureDisplay.ts`, `statusLabels.ts`, read model |
| **Payment retry flow** | Separate lock path on detail page | `retryPaymentFlow.ts`, `PaymentIssuePanel` |

---

## 4. Step-by-step polish recommendations

### Step 1 — Service

| Recommendation | Tag |
|----------------|-----|
| Stronger selected state (checkmark icon, ring) | **Safe now** |
| Service icons or category grouping | **Safe now** |
| Sticky summary of selected service below list | **Safe now** |
| Disable vs hide unavailable services | **Safe with tests** (if `enabled` flags used) |
| Change office/residential default room reset on select | **Risky / do later** |

### Step 2 — Date & time

| Recommendation | Tag |
|----------------|-----|
| Group date + time in one visual card | **Safe now** |
| Clearer SAST timezone callout with example | **Safe now** |
| Inline calendar styling (native inputs) | **Safe now** |
| Preset time slots instead of free `time` input | **Risky / do later** (validation + slot builder) |

### Step 3 — Location

| Recommendation | Tag |
|----------------|-----|
| Suburb helper: “Used to match cleaners in your area” | **Safe now** |
| Collapse access notes behind “Add access notes” | **Safe now** |
| Suburb autocomplete | **Risky / do later** (areaSlug normalization) |

### Step 4 — Details & add-ons

| Recommendation | Tag |
|----------------|-----|
| Add-on cards instead of plain checkboxes | **Safe now** |
| Show frequency discount hint (display only from catalog) | **Safe with tests** |
| Bedroom/bathroom steppers instead of raw number inputs | **Safe now** (keep same numeric values) |
| Hide irrelevant add-ons per service | **Risky / do later** (pricing catalog rules) |

### Step 5 — Cleaner

| Recommendation | Tag |
|----------------|-----|
| Skeleton loaders instead of “Loading cleaners…” | **Safe now** |
| Highlight “Best available” as recommended | **Safe now** |
| Avatar placeholders, clearer ineligible reason styling | **Safe now** |
| Refresh cleaners button | **Safe with tests** (new API call timing) |
| Change eligibility rules display | **Risky / do later** (server-driven) |

### Step 6 — Review

| Recommendation | Tag |
|----------------|-----|
| Two-column summary on `sm+` | **Safe now** |
| Show bedrooms/bathrooms/add-ons in summary | **Safe now** |
| Editable “Change” links jumping to steps | **Safe with tests** (step navigation only) |
| Re-fetch quote button | **Safe with tests** |
| Change confirmation checkbox legal copy | **Safe now** |

### Step 7 — Checkout

| Recommendation | Tag |
|----------------|-----|
| Paystack lock icon / “Secure payment” strip | **Safe now** |
| Itemized mini-summary above total | **Safe now** |
| Progress indicator on `checkoutSubmitting` | **Safe now** |
| Change pay CTA copy | **Safe now** |
| Show client-computed price different from server | **Risky / do later** |

### Payment success / failed

| Recommendation | Tag |
|----------------|-----|
| Branded success illustration | **Safe now** |
| Progress steps: Verifying → Confirmed → Redirecting | **Safe now** |
| Shorter redirect delay (e.g. 800ms) | **Safe with tests** |
| Failed page: clearer primary CTA order | **Safe now** |
| Client-side finalize or skip verify | **Risky / do later** |

### Booking detail (post-payment)

| Recommendation | Tag |
|----------------|-----|
| Hero status + next steps at top | **Safe now** |
| Group “Booking” vs “Payment” vs “Timeline” cards | **Safe now** |
| Copy for assignment expectation after pay | **Safe with tests** (read model messages) |
| Change status badge labels without server alignment | **Risky / do later** |

---

## 5. Add/remove feature opportunities

| Idea | Type | Notes |
|------|------|-------|
| Selected service chip in header across steps | UI-only | |
| Step progress “Step 2 of 7” under stepper | UI-only | |
| Persist scroll position on cleaner list | UI-only | |
| “Save and continue later” banner (localStorage already exists) | UI-only | |
| Review step edit shortcuts | UI-only | `patch({ step: '...' })` only |
| Trust badges on checkout (Paystack, SSL) | UI-only | |
| Payment success confetti / check animation | UI-only | |
| Booking detail: map link from address | UI-only | Needs encoded address from read model |
| Add phone number field | **Requires form/schema changes** | Lock metadata + validation |
| Email override at checkout | **Requires form/schema changes** | Must match auth policy |
| Tip / gratuity line | **Requires backend/payment/assignment** | Pricing + Paystack amount |
| Promo codes | **Requires backend/payment** | Quote + lock |
| Real-time quote on details step | **Requires backend** | Extra API calls; quote invalidation |
| Split step 4 into property vs add-ons pages | **Requires form/schema changes** | Step machine change |
| Guest checkout | **Requires backend/payment** | Auth model |

---

## 6. Test coverage review

### Existing tests (Vitest)

| Area | Files | Coverage quality |
|------|-------|------------------|
| Step order / navigation | `wizardFlow.test.ts` | Good for `nextStep`/`previousStep`; **no** `BookingWizard` component tests |
| Per-step validation | `validation.test.ts` | Strong |
| Stepper UI | `WizardStepper.test.tsx` | Layout/classes |
| Quote math | `calculateQuote.test.ts` | Strong (pricing engine) |
| Checkout payload / callback | `checkout.test.ts` | Strong |
| API order lock→initialize | `api.test.ts` | Strong |
| Lock creation | `createBookingPaymentLock.test.ts` | Strong |
| Initialize + lock | `initializePayment.lock.test.ts` | Strong |
| Paystack foundation / webhook / verify | `paystackFoundation.test.ts`, `verifyPayment.test.ts`, `paystackSignature.test.ts` | Strong |
| Payment return parsing | `paymentReturn.test.ts` | Strong |
| Success verifier contract | `PaymentSuccessVerifier.test.ts` | Static — must call verify only |
| Failed page | `paymentFailedPage.test.ts`, `PaymentFailedPageContent.test.tsx` | Good |
| Customer read models | `dashboardReadModels.test.ts`, `customerBookingListCardDisplay.test.ts` | Good |
| Assignment after pay | `finalizePaidBookingAssignment.test.ts` | Server — payment not failed by assignment errors |
| Payment retry | `retryPaymentFlow.test.ts`, `createPaymentRetryLock.test.ts` | Good |

### Gaps

| Gap | Risk if polishing |
|-----|-------------------|
| No `BookingWizard.tsx` integration/render tests | Regressions in `goNext` prefetch, checkout, step panels |
| No Playwright e2e for full journey | Visual polish won’t catch payment regressions |
| No test for `GET /api/customer/bookings` | Low impact for UI polish |
| No component test for booking detail page layout | Layout changes need manual QA |

### Tests to run before and after any polish

```bash
npm test -- src/features/booking-wizard
npm test -- src/lib/app/paymentReturn.test.ts
npm test -- src/app/payment/success/PaymentSuccessVerifier.test.ts
npm test -- src/app/payment/failed
npm test -- src/features/dashboards
npm test -- src/features/payments/server/verifyPayment.test.ts
npm test -- src/features/bookings/server/lock
```

For Phase B+ copy on failure labels: also run `paymentFailureDisplay.test.ts`.

---

## 7. Recommended implementation phases

### Phase A — UI-only polish (no logic changes)

- `Field.tsx`, `WizardStepper.tsx`, `WizardNav.tsx`
- Tailwind and copy in `BookingWizard.tsx` step panels (no `patch` keys, no `onClick` logic)
- `PaymentSuccessVerifier.tsx` / `PaymentFailedPageContent.tsx` visuals
- `StatusBadge`, `DashboardShell`, booking list card hover/spacing

**Gate:** Wizard unit tests + payment return tests green.

### Phase B — Copy and layout with tests

- Review/checkout/help copy in wizard and payment pages
- Booking detail section hierarchy (`bookings/[bookingId]/page.tsx`)
- Update/add tests if changing `paymentFailureDisplay` user strings
- Optional: `WizardStepper` accessibility (aria-current)

**Gate:** Phase A tests + `dashboardReadModels.test.ts` + manual smoke on `/customer/book` and `/payment/success`.

### Phase C — Small UX additions with tests

- Review “Change” links (step jumps only)
- Cleaner list refresh control
- Booking detail map link
- Component test for `WizardNav` disabled/loading states

**Gate:** Add targeted tests; full `npm test` on booking-wizard + dashboards + payments client.

### Phase D — Deeper features (separate technical audit)

- New form fields, step splits, suburb autocomplete, preset times
- Pricing/quote-on-each-step, promos, tips
- Any change to lock payload, Paystack amount, verify behavior, assignment rules

---

## 8. Final verdict

### Is this booking flow safe to polish now?

**Yes**, for **Phase A** work limited to styling, spacing, typography, icons, loading/empty presentation, and non-contract copy — provided engineers avoid `validation.ts` rules, state keys, API modules, and payment server code.

### Safest files to touch first

1. `src/features/booking-wizard/components/Field.tsx`
2. `src/features/booking-wizard/components/WizardStepper.tsx`
3. `src/features/booking-wizard/components/WizardNav.tsx`
4. `src/app/payment/success/PaymentSuccessVerifier.tsx` (visual only)
5. `src/app/payment/failed/PaymentFailedPageContent.tsx`
6. Presentation classes in `BookingWizard.tsx` (isolated per-step JSX blocks)

### Files to freeze during polish

| Category | Paths |
|----------|-------|
| Validation & payloads | `validation.ts`, `buildMetadata.ts`, `lockPayload.ts`, `checkout.ts`, `api.ts`, `storage.ts`, `types.ts`, `slot.ts` |
| Payment server | `src/features/payments/server/**`, `src/app/api/paystack/**` |
| Lock / booking commands | `src/features/bookings/server/lock/**`, `src/app/api/bookings/lock/**` |
| Pricing server | `src/features/pricing/server/**` (except display imports in wizard) |
| Read model logic | `customerBookingReadModel.ts`, `parseBookingDisplay.ts` (logic portions) |
| Assignment | `src/features/assignments/**` (post-finalize) |

### Tests that must pass before and after polish

- `src/features/booking-wizard/**/*.test.ts`
- `src/lib/app/paymentReturn.test.ts`
- `src/app/payment/success/PaymentSuccessVerifier.test.ts`
- `src/app/payment/failed/**/*.test.ts`
- `src/features/dashboards/**/*.test.ts` (if touching customer booking UI)
- Recommended full suite: `npm test` before merge

### Recommended next phase

**Start Phase A** on `Field`, `WizardStepper`, `WizardNav`, and payment return pages; then polish step panel **classes and copy** inside `BookingWizard.tsx` without altering handlers or state keys. Defer any new fields, step structure changes, or pricing/checkout behavior to **Phase D** with a dedicated payment/booking audit.

---

## Appendix — File index (booking journey)

| Layer | Path |
|-------|------|
| Book page | `src/app/(customer)/customer/book/page.tsx` |
| Wizard | `src/features/booking-wizard/components/BookingWizard.tsx` |
| Wizard support | `types.ts`, `constants.ts`, `navigation.ts`, `storage.ts`, `validation.ts`, `api.ts`, `checkout.ts`, `lockPayload.ts`, `buildMetadata.ts`, `slot.ts`, `format.ts` |
| Wizard UI | `WizardStepper.tsx`, `WizardNav.tsx`, `Field.tsx` |
| APIs | `api/pricing/quote`, `api/cleaners/available`, `api/bookings/lock`, `api/paystack/initialize`, `api/paystack/verify`, `api/paystack/webhook` |
| Payment UI | `src/app/payment/success/**`, `src/app/payment/failed/**` |
| Customer bookings | `src/app/(customer)/customer/bookings/**` |
| Dashboard components | `src/components/dashboard/**` |
| Docs | `docs/booking/customer-booking-wizard.md` |
