# Stage RC-1 — Regular Cleaning visual optimization audit

**Date:** 2026-05-18  
**Scope:** Presentation and UX quality for the **Regular Cleaning** booking path from Step 1 (service) through checkout.  
**Out of scope:** Pricing, assignment, lifecycle, metadata, lock payloads, payment logic, status transitions, booking commands, server actions.  
**Status:** Audit only — **no code changes**.

**Baseline:** `docs/audits/regular-cleaning-end-to-end-system-audit.md` (system flow). This document covers **premium UX refinement only**.

---

## 1. Executive summary

| Area | Grade | Summary |
|------|-------|---------|
| Step 1 (Regular Cleaning card) | **B-** | Desktop cards feel premium; mobile list is dense, truncates copy, and **drops brand color when selected** |
| Steps 2–5 (shared wizard) | **B** | Schedule/details panels are polished; location/cleaner/review feel like an older inline tier |
| Review | **C+** | Functional but **thin** for Regular Cleaning — omits beds/baths/frequency/add-ons |
| Checkout trust | **B-** | Honest copy is strong; **no visual trust anchors** (lock icon, Paystack mark, summary card) |
| Cross-step consistency | **C** | **Two visual languages**: zinc-900 pickers vs blue accents on frequency/add-ons |
| Mobile rhythm | **B-** | Service step sticky CTA is good; long details step lacks sticky footer; six stacked service cards = scroll fatigue |
| Desktop responsiveness | **A-** | `max-w-3xl` grid works; Regular Cleaning sits top-left in 3-column grid |
| Visual noise | **C+** | Duplicate headings, encoding glitches (`?`), mixed accent colors |

**Overall:** Safe to pursue **presentation-only** RC-1 work. Highest ROI: fix **character encoding**, unify **step headers**, enrich **review summary** for residential services (display only), strengthen **checkout trust chrome**, and polish **Regular Cleaning mobile card** (desktop-first improvements already exist).

**Regression risk for UI-only work:** **Low** if `handleSelectService`, validation keys, and checkout handlers are untouched.

---

## 2. Step-by-step audit

### Step 1 — Service (Regular Cleaning entry)

| # | Issue | Why it hurts UX | Severity | Presentation-only fix | File | Safe? |
|---|-------|-----------------|----------|----------------------|------|-------|
| 1.1 | Mobile description **truncates** (`truncate` on subtitle) | “Routine upkeep for your home” clips on small screens; users miss value prop for Regular Cleaning | **Medium** | Remove `truncate` on mobile; allow 2-line clamp (`line-clamp-2`) like desktop | `ServiceStepPanel.tsx` `ServiceCardMobile` | **Yes** (mobile marked frozen — treat as approved micro-copy layout change) |
| 1.2 | Selected mobile icon uses **neutral zinc** instead of sky brand | Regular Cleaning loses recognizable sky identity when selected; feels generic | **Medium** | When selected, keep `serviceIconSurfaceClass` + `serviceIconColorClass` for slug | `ServiceStepPanel.tsx` L66–69 | **Yes** |
| 1.3 | **Six equal-weight cards** — no hierarchy for default/popular service | Regular Cleaning is first but not visually “recommended”; cognitive load before Continue | **Low** | Optional subtle “Most booked” pill on `regular-cleaning` only (CSS pseudo-label, no logic) | `ServiceStepPanel.tsx` / `constants.ts` copy | **Yes** |
| 1.4 | Step header competes with page title + stepper | Three labels (“Book a clean”, “Step 1 Service”, “Choose a service”) dilute focus | **Low** | Shorten mobile helper; keep single in-card `h2` as primary | `BookingWizard.tsx`, `ServiceStepPanel.tsx` | **Yes** |
| 1.5 | Mobile card density (`gap-2`, `py-2.5`) | Long scroll before sticky Continue; thumb fatigue on first step | **Medium** | Slightly increase `gap-3` and `py-3` on mobile only | `ServiceStepPanel.tsx` | **Caution** — file notes mobile frozen |
| 1.6 | Desktop Regular Cleaning card is strong | Icon 44px, 2-line description, shadow on select — **good premium baseline** | — | Use as reference for other steps | `ServiceCardDesktop` | — |

**Regular Cleaning-specific note:** Desktop uses `SERVICE_STEP_DESCRIPTIONS_DESKTOP["regular-cleaning"]` (full sentence). Mobile uses shorter `SERVICE_STEP_DESCRIPTIONS` — intentional split, but truncation undermines the mobile line.

---

### Step 2 — Schedule

| # | Issue | Why it hurts UX | Severity | Fix | File | Safe? |
|---|-------|-----------------|----------|-----|------|-------|
| 2.1 | Strong panel pattern (subtitle, section `h3`s) | Sets expectation of premium flow after Step 1 | — | Mirror in later steps | `ScheduleStepPanel.tsx` | — |
| 2.2 | Time grid `md:grid-cols-2` inside `max-w-3xl` | On tablet, time chips feel wide and sparse | **Low** | Tune to `md:grid-cols-3` for rhythm | `ScheduleStepPanel.tsx` | **Yes** |
| 2.3 | Hidden date/time inputs (`sr-only`) | Power users may not discover fallback | **Low** | Add discreet “Enter manually” text button toggling visible input | `ScheduleStepPanel.tsx` | **Yes** (no state shape change) |
| 2.4 | No **service context** chip | After picking Regular Cleaning, schedule step doesn’t remind user what they booked | **Medium** | Read-only pill: “Regular Cleaning” from `serviceLabel` (display prop) | `BookingWizard.tsx` or shared `WizardContextStrip` | **Yes** |

---

### Step 3 — Location

| # | Issue | Why it hurts UX | Severity | Fix | File | Safe? |
|---|-------|-----------------|----------|-----|------|-------|
| 3.1 | Inline `h2` uses `font-medium` vs Step 1 `font-semibold` | Feels like a different product tier | **Medium** | Extract `LocationStepPanel` matching Schedule header pattern | `BookingWizard.tsx` | **Yes** |
| 3.2 | Plain stacked inputs, no section grouping | Address feels like a form dump, not a guided step | **Medium** | Card grouping: “Address” / “Notes” with `rounded-2xl` borders | New panel component | **Yes** |
| 3.3 | No service context | Same as 2.4 | **Low** | Context strip | Shared component | **Yes** |

---

### Step 4 — Details (Regular Cleaning: bedrooms / bathrooms / frequency / add-ons)

| # | Issue | Why it hurts UX | Severity | Fix | File | Safe? |
|---|-------|-----------------|----------|-----|------|-------|
| 4.1 | **No visual link** between “Regular Cleaning” and room fields | Users may not connect bed/bath pricing to service choice | **Medium** | Subhead: “Home size for your regular clean” (copy only) | `BookingWizard.tsx` details block | **Yes** |
| 4.2 | **Blue accent** on frequency/add-ons vs **zinc** on service/schedule | Breaks single design system; Regular Cleaning path feels stitched | **High** | Standardize selected state to zinc-900 **or** introduce one brand accent token document-wide | `FrequencyStepPanel.tsx`, `AddonsStepPanel.tsx` | **Yes** |
| 4.3 | `h2` “Details & add-ons” + frequency label “Frequency” + addons label | Three competing section titles in one card | **Medium** | One step title + subsections with `text-sm font-medium` only | `BookingWizard.tsx`, panels | **Yes** |
| 4.4 | Bedroom/bathroom inputs are bare number fields | No steppers, no “included in base” hint for 2/1 default | **Medium** | Stepper UI wrapping same `patch` values; helper text “Base price includes 1 bed + 1 bath” | `BookingWizard.tsx` | **Yes** (values unchanged) |
| 4.5 | Add-ons list is polished | Good density, price column, toggles | — | Keep | `AddonsStepPanel.tsx` | — |
| 4.6 | Long vertical stack without progress within step | Overwhelming on mobile before Continue | **Medium** | Collapse “Special instructions” behind optional expander | `BookingWizard.tsx` | **Yes** |

---

### Step 5 — Cleaner preference

| # | Issue | Why it hurts UX | Severity | Fix | File | Safe? |
|---|-------|-----------------|----------|-----|------|-------|
| 5.1 | **Encoding bug:** `? {rating}` instead of star | Looks broken/unprofessional at trust-critical step | **High** | Replace with `★` or SVG star icon | `BookingWizard.tsx` L438 | **Yes** |
| 5.2 | **Encoding bug:** `Loading cleaners?` | Same | **High** | `Loading cleaners…` | `BookingWizard.tsx` L408 | **Yes** |
| 5.3 | Selected cleaner = **inverted dark card**; service cards = light selected | Inconsistent selection metaphor | **Medium** | Align selected cleaner card to Step 1 pattern (border + zinc-50 bg) | `BookingWizard.tsx` | **Yes** |
| 5.4 | `max-h-64` scroll list without sticky “Best available” | Best-available option scrolls away when many cleaners | **Medium** | Pin best-available block; scroll only cleaner list | `BookingWizard.tsx` | **Yes** |
| 5.5 | No earnings preview formatting on card | `estimatedEarningsPreviewCents` may exist but not shown in markup reviewed | **Low** | If present in API card, show formatted ZAR sublabel | `BookingWizard.tsx` / `toPublicCard.ts` | **Yes** (display only) |

---

### Step 6 — Review

| # | Issue | Why it hurts UX | Severity | Fix | File | Safe? |
|---|-------|-----------------|----------|-----|------|-------|
| 6.1 | **Missing Regular Cleaning details:** beds, baths, frequency, add-ons | User cannot verify home size or recurring discount before pay | **High** | Add read-only rows to `<dl>` from wizard state (no API change) | `BookingWizard.tsx` review block | **Yes** |
| 6.2 | Plain `<dl>` without grouping | Hard to scan; receipt feels unfinished | **Medium** | Two cards: “Booking” + “Price breakdown” | `BookingWizard.tsx` or `ReviewStepPanel.tsx` | **Yes** |
| 6.3 | Line items use `item.label` — includes “Regular Cleaning” base | Good; discount line may be negative — ensure minus visible | **Low** | Style `frequency_discount` in muted green | Review panel | **Yes** |
| 6.4 | Total `text-lg` vs checkout `text-2xl` | Total doesn’t feel like hero on review | **Medium** | `text-2xl` + sticky subtotal bar on mobile | Review panel | **Yes** |
| 6.5 | Checkbox default styling | Small hit target; easy to miss before continue | **Medium** | Larger custom checkbox row, full-width tap target | `BookingWizard.tsx` | **Yes** |
| 6.6 | `Calculating price?` encoding | Unprofessional loading state | **High** | `Calculating price…` | `BookingWizard.tsx` L463 | **Yes** |
| 6.7 | No edit affordances | User must Back multiple times to fix suburb | **Medium** | “Edit” text buttons jumping to step (set `patch({ step })` only) | Review panel | **Yes** (navigation only) |

---

### Step 7 — Checkout

| # | Issue | Why it hurts UX | Severity | Fix | File | Safe? |
|---|-------|-----------------|----------|-----|------|-------|
| 7.1 | Trust copy is **text-only** | Pay moment needs visual reassurance | **High** | Add lock icon row + “Secured by Paystack” + card brand strip (static assets) | `BookingWizard.tsx` checkout block | **Yes** |
| 7.2 | Amount shown without **mini summary** | User sees price but not “Regular Cleaning · 2 bed · date” | **Medium** | Compact summary card above CTA | Checkout block | **Yes** |
| 7.3 | `pending payment` in `<strong>` | Correct legally; slightly alarming tone | **Low** | Softer typography: normal weight + muted explainer | Checkout block | **Yes** |
| 7.4 | Duplicate total (review + checkout) | OK if checkout reinforces; currently checkout total floats without context | **Low** | Label “Amount due today” | Checkout block | **Yes** |
| 7.5 | Pay CTA same style as Continue | Primary payment action should feel heavier | **Medium** | Checkout-only button: full width, optional icon | `WizardNav.tsx` variant prop | **Yes** |
| 7.6 | Error string `refreshed ? please` | Broken punctuation hurts trust | **High** | Em dash or “— please” | `BookingWizard.tsx` L183, L224 | **Yes** |

---

## 3. Mobile-specific issues

| Issue | Impact on Regular Cleaning path | Severity |
|-------|--------------------------------|----------|
| Fixed bottom **Continue** only on service step | Good for Step 1; other steps rely on `pb-24` — long details step may hide CTA below fold | **Medium** |
| Six stacked service cards before CTA | Regular Cleaning is card 1 but user still scrolls 5 more | **Medium** |
| `truncate` on Regular Cleaning subtitle | Core service message lost | **High** |
| Stepper shows segment bars only — no step names on chips | Less orientation than desktop chips | **Low** |
| Service card `active:scale-[0.99]` | Nice tactile feedback | Positive |
| Safe area on sticky footer | `env(safe-area-inset-bottom)` — good | Positive |
| Cleaner list `max-h-64` in short viewport | Cramped after details scroll | **Medium** |
| Review/checkout lack sticky **total + CTA** bar | Easy to miss total on small screens | **High** |

---

## 4. Desktop-specific issues

| Issue | Impact | Severity |
|-------|--------|----------|
| Regular Cleaning **top-left** in 3×2 grid (xl) | Good prominence | Positive |
| Desktop service panel subtitle visible; mobile hidden | Asymmetric guidance | **Low** |
| Stepper chips truncate long labels (“Checkout” ok) | Minor | **Low** |
| `max-w-3xl` (~768px) wide form — location/cleaner feel empty | Whitespace without secondary column | **Medium** |
| No sticky right-rail **summary** on review/checkout | Premium flows often show live summary sidebar | **Medium** (optional RC-2) |
| Frequency 4-column grid at `sm` | Works well on desktop | Positive |

---

## 5. Visual consistency issues

| Pattern | Where used | Problem |
|---------|------------|---------|
| **Zinc-900** selection | Service, schedule date/time | Primary interactive language |
| **Blue-500** selection | Frequency, addon toggles | Second accent — reads as different app |
| **`text-lg font-semibold tracking-tight`** | Service, Schedule headers | Modern |
| **`text-lg font-medium`** | Location, details, cleaner, review, checkout | Legacy tier |
| **Shadow recipes** | Multiple custom `shadow-[0_1px_2px_...]` | Copy-paste OK but should be tokens |
| **Encoding `?`** | Loading, rating, price copy | Broken typography — **must fix in RC-1** |
| **Card padding** | `p-3` service mobile vs `p-4` others | Slight rhythm jump step 1 → 2 |

### Typography scale (recommended target)

| Role | Target class | Current drift |
|------|--------------|---------------|
| Page title | `text-xl font-semibold` | Consistent |
| Step title | `text-lg font-semibold tracking-tight` | Split medium/semibold |
| Step subtitle | `text-sm text-zinc-500 leading-relaxed` | Missing on inline steps |
| Section label | `text-sm font-medium text-zinc-800` | Used in schedule/frequency |
| Body / inputs | `text-sm` | Consistent |
| Money hero | `text-2xl font-semibold tabular-nums` | Only checkout |

---

## 6. Safe implementation roadmap

### RC-1a — Quick wins (1–2 days, lowest risk)

1. Fix all `?` → proper ellipsis, em dash, star icon (encoding sweep in wizard strings).
2. Unify step `h2` headers to semibold + optional subtitle pattern.
3. Review step: add bedrooms, bathrooms, frequency, add-ons to `<dl>` (display from state).
4. Checkout: static trust row + mini summary card (service label, schedule, total).

### RC-1b — Regular Cleaning Step 1 polish (2–3 days)

1. Mobile: `line-clamp-2` instead of `truncate` for descriptions.
2. Mobile: preserve sky icon surface when Regular Cleaning selected.
3. Optional “Most booked” badge on regular-cleaning card only.
4. Desktop-only: minor gap/padding tune (avoid `ServiceCardMobile` unless approved).

### RC-1c — Consistency pass (3–5 days)

1. Extract `LocationStepPanel`, `CleanerStepPanel`, `ReviewStepPanel`, `CheckoutStepPanel` (presentation only).
2. Align frequency/add-on selected styles to zinc system (or document blue as “settings within step”).
3. Add `WizardContextStrip` (“Regular Cleaning”) on steps 2–7.
4. Review/edit links and grouped receipt cards.

### RC-1d — Mobile commerce polish (optional)

1. Sticky bottom bar on review + checkout (total + primary CTA).
2. Consider sticky Continue on details step (presentation/layout only).

**Explicitly out of scope for RC-1:** price amounts, slug, lock fields, Paystack API, assignment, metadata shape.

---

## 7. Components safe to refactor

| Component | Refactor allowed | Notes |
|-----------|------------------|-------|
| `ServiceStepPanel.tsx` | **Yes** (desktop + approved mobile tweaks) | Keep `onSelect(slug)` contract |
| `serviceStepIcons.tsx` | **Yes** | Colors/icons only |
| `ScheduleStepPanel.tsx` | **Yes** | Already isolated |
| `FrequencyStepPanel.tsx` | **Yes** | Accent alignment only |
| `AddonsStepPanel.tsx` | **Yes** | |
| `WizardStepper.tsx` | **Yes** | Presentation only |
| `WizardNav.tsx` | **Yes** | Optional variants for checkout CTA |
| `wizardLayout.ts` | **Yes** | Padding/class tokens only |
| `Field.tsx` | **Yes** | Input chrome |
| New: `ReviewStepPanel.tsx` | **Yes** | Extract from BookingWizard |
| New: `WizardContextStrip.tsx` | **Yes** | Display-only service label |
| `BookingWizard.tsx` | **Partial** | Extract markup; **do not** change `handleSelectService`, `handleCheckout`, `goNext` logic |

---

## 8. Components frozen / not safe

| Item | Reason |
|------|--------|
| `handleSelectService` in `BookingWizard.tsx` | Room defaults — business rule |
| `handleCheckout`, `goNext`, `goBack` | Flow orchestration |
| `buildLockRequestPayload`, `checkout.ts`, `lockPayload.ts` | Out of scope |
| `validation.ts`, `api.ts`, `buildMetadata.ts` | Logic |
| `constants.ts` **slug arrays** and pricing-linked copy if it implies price | Slugs/values frozen; **marketing descriptions OK** |
| `ServiceCardMobile` structure | Comment: frozen pending explicit mobile redesign — **changes require product sign-off** |
| Payment redirect / `clearWizardStorage` timing | Behavior |

---

## 9. Regression risk assessment

| Change type | Risk | Mitigation |
|-------------|------|------------|
| Copy / encoding fixes | **Very low** | Visual QA |
| CSS class / layout | **Low** | Snapshot tests (`ServiceStepPanel.test.tsx`, stepper tests) |
| Extract presentation components | **Low** | No prop changes to handlers |
| Review summary fields (display) | **Low** | Manual RC path: 2 bed, weekly, addon |
| Accent color unification | **Low** | Screenshot diff frequency/addons |
| Sticky footers | **Medium** | Test iOS safe area + keyboard overlap on inputs |
| Edit buttons on review | **Low** | Only `patch({ step })` |
| Accidental handler edits | **High** if touched | Code review checklist |

**Automated tests to run after RC-1:**

```bash
npx vitest run src/features/booking-wizard/components/
npx vitest run src/features/booking-wizard/wizardLayout.test.ts
npm run typecheck
```

**Manual smoke:** Select **Regular Cleaning** → 2/1 → weekly → one addon → review (verify new rows) → checkout (trust strip) → do not complete payment unless intended.

---

## 10. Recommended implementation order

| Order | Task | Rationale |
|-------|------|-----------|
| **1** | Encoding / punctuation sweep (`?` fixes) | Fast trust win across all services |
| **2** | Review panel: beds, baths, frequency, add-ons + grouped layout | Highest impact for Regular Cleaning confidence |
| **3** | Checkout trust chrome + mini summary | Pay-step reassurance |
| **4** | Unify step headers (extract or shared classes) | Cross-step consistency |
| **5** | Regular Cleaning mobile card: clamp-2 + sky icon when selected | Targets default service UX |
| **6** | Zinc vs blue accent alignment on frequency/add-ons | Design system coherence |
| **7** | `WizardContextStrip` on steps 2–7 | Reinforces service choice |
| **8** | Extract location/cleaner panels to match schedule quality | Broader polish |
| **9** | Sticky review/checkout footer (mobile) | Premium commerce pattern |
| **10** | Optional desktop review sidebar (RC-2) | Larger lift |

---

## Focus area checklist (10/10)

| # | Focus area | Status | Top action |
|---|------------|--------|------------|
| 1 | Step 1 visual hierarchy | Reviewed | Mobile truncate + selected icon brand |
| 2 | Typography scale consistency | Gap found | Standardize `h2` to semibold + subtitle |
| 3 | Card density and spacing | Reviewed | Ease mobile service list gaps (signed-off) |
| 4 | Mobile rhythm | Reviewed | Sticky bars on review/checkout |
| 5 | Desktop responsiveness | Good | Optional sidebar later |
| 6 | Sticky footer/header balance | Mixed | Service step good; extend to review |
| 7 | Step transition consistency | Gap found | Extract inline steps to panels |
| 8 | Review step readability | Weak | Add residential fields + grouping |
| 9 | Checkout trust presentation | Weak | Paystack/lock visual anchors |
| 10 | Visual noise reduction | Reviewed | Fix encoding; unify accents |

---

*End of RC-1 visual audit.*
