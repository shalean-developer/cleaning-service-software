# Step 1 — Horizontal service UI redesign safety audit

**Date:** 2026-05-18  
**Scope:** Wizard step `service` only (`/customer/book`, first panel).  
**Status:** Audit only — **no production code changes**.

**Goal:** Determine whether Step 1 can be visually redesigned (horizontal selectable service cards / carousel-style layout, premium spacing, mobile scroll) **without** changing booking logic, validation, pricing, navigation, backend behavior, or Shalean branding.

**Related:** Broader flow audit in `docs/audits/customer-booking-flow-ui-polish-safety-audit.md`.

---

## Executive summary

| Question | Verdict |
|----------|---------|
| Is Step 1 safe to redesign visually? | **Yes** — with strict boundaries |
| Is horizontal card layout safe? | **Yes** — CSS layout + same `button` + `patch` contract |
| Is swipeable mobile service selection safe? | **Mostly yes** — prefer **native horizontal scroll + scroll-snap**; custom swipe-to-select libraries are **risky** |
| Safest implementation strategy | Extract a **presentation-only** service picker; keep **one** `onSelect(slug)` handler in `BookingWizard` that preserves office/residential room reset |

Step 1 is **not** a separate route or component today. All behavior lives in a ~40-line inline block inside `BookingWizard.tsx`. Business rules are thin but **critical** on select: `serviceSlug` plus bedroom/bathroom defaults. Everything else is Tailwind and markup.

**No analytics events** were found in the booking wizard feature — visual redesign does not affect tracking because none exists today.

---

## 1. Current Step 1 architecture

### 1.1 Rendering files

| Role | Path | Notes |
|------|------|-------|
| Page entry | `src/app/(customer)/customer/book/page.tsx` | Auth via `requireCustomerReady`; renders `<BookingWizard />` |
| Wizard shell | `src/features/booking-wizard/components/BookingWizard.tsx` | **Step 1 UI is inline** (`state.step === "service"`) |
| Stepper | `src/features/booking-wizard/components/WizardStepper.tsx` | Shared; already `overflow-x-auto` on mobile |
| Navigation CTA | `src/features/booking-wizard/components/WizardNav.tsx` | `goNext` / `goBack`; step 1 hides Back |
| Field helper | `src/features/booking-wizard/components/Field.tsx` | **Not used** on step 1 |
| Service catalog source | `src/features/booking-wizard/constants.ts` | `WIZARD_SERVICE_OPTIONS` |
| Pricing labels/rules | `src/features/pricing/server/catalog.ts` | `SERVICE_CATALOG` (labels, pricing rules) |
| State shape | `src/features/booking-wizard/types.ts` | `serviceSlug: ServiceSlug \| null` |
| Validation | `src/features/booking-wizard/validation.ts` | `validateServiceStep` |
| Persistence | `src/features/booking-wizard/storage.ts` | `serviceSlug` in `PERSIST_KEYS` |
| Navigation order | `src/features/booking-wizard/navigation.ts` | `service` → `datetime` |

There is **no** `ServiceStep.tsx`, **no** shared `ServiceCard` component, and **no** React context.

### 1.2 Service card rendering logic (current)

Step 1 renders a vertical `<ul className="space-y-2">` of full-width `<button type="button">` elements.

- **Data:** `WIZARD_SERVICE_OPTIONS.filter((s) => s.enabled)`
- **Display:** `service.label`, `service.description` from `constants.ts` (labels from `SERVICE_CATALOG`)
- **Selected state:** `state.serviceSlug === service.slug` toggles border/background classes (inverted zinc-900)
- **Error:** `stepErrors.serviceSlug` below the list

```245:278:src/features/booking-wizard/components/BookingWizard.tsx
        {state.step === "service" ? (
          <div>
            <h2 className="mb-3 text-lg font-medium">Choose a service</h2>
            <ul className="space-y-2">
              {WIZARD_SERVICE_OPTIONS.filter((s) => s.enabled).map((service) => (
                <li key={service.slug}>
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        serviceSlug: service.slug,
                        bedrooms: service.slug === "office-cleaning" ? 0 : 2,
                        bathrooms: service.slug === "office-cleaning" ? 0 : 1,
                      })
                    }
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      state.serviceSlug === service.slug
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
                    }`}
                  >
                    <span className="block font-medium">{service.label}</span>
                    ...
                  </button>
                </li>
              ))}
            </ul>
```

*(Abbreviated; full block includes description spans and `stepErrors.serviceSlug`.)*

### 1.3 Click handlers and state updates

| Action | Handler | Effect |
|--------|---------|--------|
| Select service | `onClick` on each button | `patch({ serviceSlug, bedrooms, bathrooms })` |
| Continue | `WizardNav` → `goNext` | `validateWizardStep("service", state)` then `patch({ step: "datetime" })` |
| Hydrate | `useEffect` on mount | `loadWizardState()` restores `serviceSlug` from localStorage |
| Persist | `useEffect` on `state` | `saveWizardState(state)` includes `serviceSlug` |

`patch` clears `stepErrors` and `apiError` on every update — selection clears validation error immediately (same as today).

### 1.4 Validation dependencies

`validateServiceStep` (`validation.ts`):

1. `state.serviceSlug` must be non-null → error key **`serviceSlug`** (required for error display)
2. Slug must appear in `WIZARD_SERVICE_OPTIONS` with `enabled: true`

Triggered only when user taps **Continue** (`goNext`), not on select.

Downstream steps also depend on `serviceSlug`:

- `validateDetailsStep` — `SERVICE_CATALOG[state.serviceSlug]` room rules; office requires `propertySizeSqm`
- `wizardStateToPricingInput` — returns `null` without `serviceSlug`
- `fetchAvailableCleaners` — requires `state.serviceSlug`
- `buildLockRequestPayload` — requires `state.serviceSlug`

### 1.5 Side effects on service select (must preserve)

| Condition | `bedrooms` | `bathrooms` | Why |
|-----------|------------|-------------|-----|
| `office-cleaning` | `0` | `0` | `allowZeroRooms` in catalog; step 4 hides room fields |
| Any other enabled service | `2` | `1` | Matches `INITIAL_WIZARD_STATE` residential defaults |

**Risk:** Re-selecting the same service still resets rooms to defaults (current behavior). Changing to “no-op if already selected” would alter persisted/hydrated room counts — **do not change** without explicit product decision.

**Not reset on select:** `propertySizeSqm`, `addons`, `frequency`, `quote`, step index.

### 1.6 Mobile responsiveness (current)

| Element | Behavior |
|---------|----------|
| Page shell | `max-w-lg`, `px-4`, `py-6`, `pb-24`, `min-h-screen` |
| Service list | Vertical stack; full-width tap targets (~48px+ height with padding) |
| Stepper | Horizontal scroll (`overflow-x-auto`), 7 compact chips |
| WizardNav | Below white card, not sticky/fixed |
| Step 1 | No horizontal overflow; 6 services scroll vertically |

### 1.7 Shared components used by Step 1

| Component | Used on step 1? |
|-----------|----------------|
| `WizardStepper` | Yes |
| `WizardNav` | Yes (`showBack={false}`) |
| `Field` | No |
| `apiError` alert | Yes (global, rare on step 1) |

---

## 2. Safety of layout patterns

| Pattern | Verdict | Notes |
|---------|---------|-------|
| Horizontal scrollable cards | **Safe now** | `flex` + `overflow-x-auto` + `scroll-snap`; keep `<button type="button">` per card |
| Scroll-snap on mobile | **Safe now** | Pure CSS; no new selection semantics |
| Grid on desktop (`md:grid-cols-2` / `3`) | **Safe now** | Responsive layout only; same buttons |
| Visual tiles with icons/images | **Safe now** | Decorative; do not encode slug in image URLs required for logic |
| Active/selected emphasis (ring, checkmark, scale) | **Safe now** | ClassName on `state.serviceSlug === slug` |
| Wider step 1 container only | **Safe with tests** | May affect stepper alignment; prefer inner carousel width, not global shell break |
| Sticky bottom CTA on step 1 | **Safe with tests** | `WizardNav` + `pb-24` interaction; manual mobile QA |
| Custom swipe-to-select (Embla, gesture library) | **Risky** | Scroll vs tap ambiguity; not needed for parity |
| Auto-advance to step 2 on select | **Risky** | Changes UX and validation timing |
| Radio `<input>` instead of buttons | **Safe with tests** | Must keep same `patch` payload; test keyboard selection |
| Reordering or hiding services in UI | **Safe with tests** | Must stay aligned with `WIZARD_SERVICE_OPTIONS` / `enabled` |
| Adding/removing services in UI only | **Risky** | Slugs are contract with pricing DB/catalog |
| Changing office/residential reset rules | **Risky** | Breaks step 4 validation and quotes |

---

## 3. Risky coupling audit

### 3.1 `serviceSlug` values (frozen set)

Canonical slugs (`src/features/pricing/server/types.ts` → `SERVICE_SLUGS`):

- `regular-cleaning`
- `deep-cleaning`
- `moving-cleaning`
- `airbnb-cleaning`
- `office-cleaning`
- `carpet-cleaning`

Wizard exposes exactly these via `WIZARD_SERVICE_OPTIONS` in `constants.ts`. **Do not rename, alias, or map to different strings in UI.**

### 3.2 Catalog IDs and pricing

| Consumer | Coupling |
|----------|----------|
| `SERVICE_CATALOG[slug]` | Base/extra room pricing, office sqm, carpet per-bedroom |
| `calculateQuote` / `/api/pricing/quote` | `wizardStateToPricingInput(state).serviceSlug` |
| Lock payload | `serviceSlug: state.serviceSlug` in `lockPayload.ts` |
| Server lock recalc | Server validates slug against catalog |
| Review summary | `serviceLabel` from `WIZARD_SERVICE_OPTIONS.find(...)` |

Displaying “from R…” prices on cards is **optional UI**; showing wrong amounts is a **copy/trust** issue, not a logic break, unless it replaces server quote.

### 3.3 Validation

- Error field key: **`serviceSlug`** (must remain for `stepErrors.serviceSlug` display)
- Messages can be reworded in `validation.ts` without layout risk
- `enabled: false` options: filtered from UI today; validation rejects disabled slugs if somehow set

### 3.4 Room reset behavior

Selecting `office-cleaning` → `bedrooms: 0`, `bathrooms: 0`.  
Selecting anything else → `2` / `1`.

Step 4 (`BookingWizard.tsx`) hides bedroom/bathroom when `state.serviceSlug === "office-cleaning"`.  
Mismatch between select reset and step 4 visibility breaks office flow.

### 3.5 localStorage persistence

`storage.ts` persists `serviceSlug` under key `shalean-booking-wizard-v1`.  
Hydration merges into `INITIAL_WIZARD_STATE` and clears `quote` / checkout fields.

**Safe:** Card layout does not change stored JSON shape.  
**Risky:** Changing persist keys or slug type in `types.ts`.

### 3.6 Analytics tracking

**None found** in `src/features/booking-wizard/**`. Step 1 redesign has **no event contract** to preserve.

### 3.7 Step navigation

- `goNext` after valid step 1 → `datetime` via `nextStep("service")`
- `WizardNav` `showBack={state.step !== "service"}` — unchanged by horizontal UI
- Stepper `current={state.step}` — independent of service layout

### 3.8 Quote generation and downstream steps

| Step | Depends on `serviceSlug` |
|------|---------------------------|
| 4 Details | Catalog rules, office sqm field |
| 5 Cleaner | API body `serviceSlug` |
| 6 Review | Quote fetch via `wizardStateToPricingInput` |
| 7 Checkout | Lock payload |

Changing service on step 1 after completing later steps does **not** auto-clear `quote` today (user would need to reach review again). Horizontal UI should **not** add silent quote invalidation unless product asks — same as current.

---

## 4. UI-only boundaries (exactly what may change)

### Safe now

- Card container structure (`ul` → horizontal scroller, grid wrapper)
- Typography (title, description, hierarchy)
- Spacing, padding, gap, border radius, shadows
- Hover/focus/active/selected visual states
- Icons/illustrations per service (Shalean assets, not reference brand)
- Card width, aspect ratio, `scroll-snap-align`
- Optional “selected” checkmark badge
- Section heading/subtitle copy (“Choose a service”)
- `WIZARD_SERVICE_OPTIONS[].description` strings in `constants.ts` (display only)
- Progress bar / stepper **appearance** in `WizardStepper.tsx` (keep step keys and labels)
- Micro-interactions (CSS transitions; respect `prefers-reduced-motion`)
- `aria-pressed`, `aria-current` on selected card (accessibility **improvement**)
- Inner max-width for carousel while keeping page `max-w-lg` or modest bump to `max-w-xl` on step 1 only

### Safe with tests / manual QA

- Sticky `WizardNav` footer on mobile
- Slightly wider page shell for all steps
- Disabled (greyed) vs hidden for `enabled: false` services
- Showing list price hints from `SERVICE_CATALOG` (display math tests optional)
- Component snapshot tests for new `ServiceStepPanel`

### Not UI-only (out of scope)

- `patch` keys and values on select
- `validateServiceStep` rules
- `WIZARD_SERVICE_OPTIONS` slug list membership
- `SERVICE_CATALOG` / pricing server
- `storage.ts` persist keys
- `types.ts` `BookingWizardState` fields
- Auto-advance, new steps, marketing sections, referrals, app download banners

---

## 5. Frozen logic boundaries

### Files — do not change for Step 1 visual redesign

| File | Reason |
|------|--------|
| `src/features/booking-wizard/validation.ts` | Step 1 validation rules and error keys |
| `src/features/booking-wizard/types.ts` | State shape |
| `src/features/booking-wizard/storage.ts` | Persisted keys and hydration |
| `src/features/booking-wizard/buildMetadata.ts` | Pricing input mapping |
| `src/features/booking-wizard/lockPayload.ts` | Lock API body |
| `src/features/booking-wizard/checkout.ts` | Paystack init payload |
| `src/features/booking-wizard/api.ts` | Quote/cleaner/lock/initialize clients |
| `src/features/booking-wizard/navigation.ts` | Step order |
| `src/features/pricing/server/**` | Catalog and quote engine |
| `src/app/api/pricing/quote/**` | Server quote |
| `src/app/api/bookings/lock/**` | Server lock |
| `src/app/api/paystack/**` | Payment |

### Functions / logic blocks — freeze inside `BookingWizard.tsx`

| Block | Freeze |
|-------|--------|
| `patch` implementation | Keys cleared, merge behavior |
| `goNext` / `goBack` | Validation + step transitions |
| Service `onClick` body | `serviceSlug` + office/residential `bedrooms`/`bathrooms` |
| `handleCheckout` | Entire checkout pipeline |

### `constants.ts` — partial freeze

| Field | Freeze? |
|-------|---------|
| `slug` values | **Yes** |
| `enabled` semantics | **Yes** (must match validation) |
| `label` | Display (from catalog; changing is copy-only) |
| `description` | **No** (UI copy) |

---

## 6. Current Step 1 vs inspiration direction

### Can safely match (Shalean-adapted)

- Horizontal row of selectable service **cards** with clear selected state
- Premium spacing, softer surfaces, rounded cards, subtle shadows
- One-line title + short subtitle per service (existing `label` + `description`)
- Mobile-first horizontal scroll with visible peek of next card
- Desktop: grid or multi-column layout instead of single column
- Visual hierarchy: page title → stepper → service section → primary CTA
- App-like density and touch-friendly card sizes (min ~44×44px tap target)

### Should NOT copy from reference

- Competitor logos, color palette, typography, or brand name
- Marketing hero blocks, rewards, referrals, app store badges
- Fake “starting at” pricing that disagrees with server quote
- Extra steps (category → subcategory) not in Shalean’s 7-step machine
- Social proof carousels, testimonials, or unrelated content on step 1
- Map/location widgets (belongs to step 3)

### Recommended Shalean adaptations

1. **Keep** “Book a clean” / Shalean header; refine typography only.
2. **Use** zinc/neutral Shalean tokens already in wizard (`zinc-900` primary) — evolve, don’t import foreign brand colors.
3. **Assign** simple line icons per slug (home, sparkles, box, key, building, rug) — decorative only.
4. **Retain** office vs residential hint in `description` (already differentiated in `constants.ts`).
5. **Optional:** Small “Selected” chip or checkmark on active card — improves scanability vs full invert fill.
6. **Prefer** CSS scroll-snap over swipe libraries for “carousel feel.”

---

## 7. Mobile UX audit

| Topic | Current | Redesign guidance |
|-------|---------|-------------------|
| Horizontal scroll performance | N/A (vertical list) | Use `overflow-x-auto`, `-webkit-overflow-scrolling: touch`, avoid heavy blur/filters on 6 cards |
| Card tap targets | Full-width rows, adequate height | Min card height ~88–120px; full card clickable; avoid nested buttons |
| Overflow | Page vertical scroll only | Prevent double scroll: carousel scrolls X, page scrolls Y; no `overflow-hidden` on `body` |
| Scroll vs tap | N/A | `scroll-snap-type: x mandatory` + `touch-action: pan-x`; avoid drag handlers on same element as select |
| Stepper | Already scrolls horizontally | Ensure step 1 card row doesn’t visually compete; keep `aria-label="Booking progress"` |
| CTA position | Below card, `pb-24` | If sticky nav added, increase bottom padding and test iOS safe-area |
| Viewport height | `min-h-screen` | Tall stepper + header + carousel + nav — test iPhone SE; consider slightly compact stepper on step 1 only (presentation) |
| Spacing rhythm | `mb-3` heading, `space-y-2` list | Use consistent 4/8/12/16px scale between header, scroller, error, nav |

### Swipeable mobile selection

| Approach | Safety |
|----------|--------|
| Native horizontal scroll + snap | **Recommended** |
| CSS-only “peek” next card (`min-w-[85vw]` per card) | **Safe** |
| Third-party swipe carousel with `onSlideChange` selecting service | **Risky** — accidental selection, a11y |
| Swipe without tap (gesture = select) | **Do not** — changes interaction contract |

---

## 8. Testing impact audit

### Existing tests that touch Step 1 logic (not UI)

| File | What it protects |
|------|------------------|
| `validation.test.ts` | `serviceSlug` required; enabled slug |
| `wizardFlow.test.ts` | Step order starts at `service` |
| `api.test.ts` | Quote/lock need valid state (`filledState` uses `regular-cleaning`) |
| `checkout.test.ts` | Payload includes `serviceSlug` |
| `WizardStepper.test.tsx` | Stepper layout classes only |

**Gap:** No render test for Step 1 service buttons, office reset on click, or horizontal layout.

### Recommended tests before / with redesign

| Test | Priority | Assert |
|------|----------|--------|
| `selectServicePatch(slug)` unit or handler test | High | Office → `0/0` rooms; residential → `2/1` |
| `ServiceStepPanel.test.tsx` (new) | High | Renders N enabled options; calls `onSelect(slug)`; shows error prop |
| `validateServiceStep` (existing) | Keep green | No change |
| Optional a11y test | Medium | Selected card has `aria-pressed="true"` |

### Manual regression checklist (Step 1 + handoff)

1. Load `/customer/book` — no service → Continue shows error.
2. Select each slug → Continue → step 2; refresh → `serviceSlug` restored.
3. Select office → step 4 shows sqm, not bedrooms.
4. Select residential after office → bedrooms return to 2/1.
5. Complete flow to review — quote line items match service.
6. Lock/checkout still succeeds for office and carpet paths.
7. Mobile: scroll carousel without toggling selection unintentionally.
8. Keyboard: Tab to card, Enter/Space selects.

### Commands

```bash
npm test -- src/features/booking-wizard
```

---

## 9. Final verdict

### Is Step 1 safe to redesign visually?

**Yes.** Step 1 is presentation-heavy with a **small frozen handler**: the `patch({ serviceSlug, bedrooms, bathrooms })` call.

### Is horizontal card layout safe?

**Yes**, as a CSS-only change with the same button-per-service pattern and slug values.

### Is swipeable mobile service selection safe?

- **Safe:** horizontal scroll + scroll-snap (user taps to select).
- **Risky:** gesture libraries that conflate swipe with selection or auto-advance.

### Safest implementation strategy

1. **Phase 1 — Extract presentation**  
   Add `src/features/booking-wizard/components/ServiceStepPanel.tsx` (or `ServiceOptionList.tsx`) with props:
   - `options: WizardServiceOption[]`
   - `selectedSlug: ServiceSlug | null`
   - `onSelect: (slug: ServiceSlug) => void`
   - `error?: string`  
   No imports from `api`, `validation`, or `storage` inside this file.

2. **Phase 2 — Layout**  
   Implement horizontal scroller (mobile) + responsive grid (desktop) inside the panel only.  
   Keep **one** `onSelect` implementation in `BookingWizard.tsx`:

   ```ts
   const handleSelectService = (slug: ServiceSlug) => {
     patch({
       serviceSlug: slug,
       bedrooms: slug === "office-cleaning" ? 0 : 2,
       bathrooms: slug === "office-cleaning" ? 0 : 1,
     });
   };
   ```

3. **Phase 3 — Polish**  
   Icons, motion (subtle), sticky nav if desired; add component tests.

4. **Do not** change step machine, validation, catalog slugs, or checkout in the same PR.

### Presentation-only wrappers (recommended)

| File | Role |
|------|------|
| `components/ServiceStepPanel.tsx` | **New** — cards, scroll, grid, icons |
| `components/WizardStepper.tsx` | Stepper visuals |
| `components/WizardNav.tsx` | CTA layout/sticky |
| `BookingWizard.tsx` | Wire panel; **frozen** `handleSelectService` + `goNext` |

### Files that remain frozen

`validation.ts`, `types.ts`, `storage.ts`, `buildMetadata.ts`, `lockPayload.ts`, `checkout.ts`, `api.ts`, `navigation.ts`, `slot.ts`, all pricing/payment/lock server paths, and the **body** of `handleSelectService` / `goNext` / `handleCheckout` in `BookingWizard.tsx`.

---

## Appendix A — Step 1 data flow

```mermaid
flowchart LR
  subgraph ui [Step 1 UI - safe to redesign]
    Cards[Service cards / carousel]
  end
  subgraph frozen [Frozen handler]
    Patch["patch({ serviceSlug, bedrooms, bathrooms })"]
  end
  subgraph state [Client state]
    LS[(localStorage)]
    S[BookingWizardState]
  end
  subgraph later [Downstream - unchanged]
    V[validateServiceStep on Continue]
    P[wizardStateToPricingInput]
    Q[/api/pricing/quote]
    L[/api/bookings/lock]
  end
  Cards -->|onSelect slug| Patch --> S
  S --> LS
  S --> V
  V -->|goNext| datetime[Step 2 datetime]
  S --> P --> Q --> L
```

---

## Appendix B — File index (Step 1)

| Layer | Path |
|-------|------|
| Step 1 UI (today) | `src/features/booking-wizard/components/BookingWizard.tsx` (lines ~245–283) |
| Service options | `src/features/booking-wizard/constants.ts` |
| Catalog / pricing | `src/features/pricing/server/catalog.ts`, `types.ts` |
| Validation | `src/features/booking-wizard/validation.ts` → `validateServiceStep` |
| State | `src/features/booking-wizard/types.ts` |
| Persist | `src/features/booking-wizard/storage.ts` |
