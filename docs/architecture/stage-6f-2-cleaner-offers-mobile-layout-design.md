# Stage 6F-2 — Cleaner Offers Mobile Layout + Expiry Visibility

**Date:** 2026-05-18  
**Status:** **6F-2a implemented** (expiry display, card hierarchy, sections, mobile action spacing). Decline confirmation (6F-2c) and home preview expiry (6F-2b) deferred.  
**Depends on:** [stage-6f-cleaner-mobile-polish-design.md](./stage-6f-cleaner-mobile-polish-design.md) (6F-1a nav/labels, 6F-1b empty/error shipped), [stage-6-ui-polish.md](../operations/stage-6-ui-polish.md)

**Goal:** Improve cleaner offer cards on mobile so cleaners can quickly understand job value, expiry urgency, and next action **without** changing accept/decline behavior, APIs, offer TTL logic, assignment, earnings formulas, or notifications.

**Non-goals:** Sticky action bars, bottom nav, new offer detail route, pull-to-refresh, cron/TTL changes, `buildOfferExpiry` / `ASSIGNMENT_OFFER_TTL_HOURS` changes, notification template changes, home “active jobs” heuristic (6F-3).

---

## Executive summary

| Decision | Recommendation |
|----------|----------------|
| Card priority | **Respond-by time** → **schedule** → **earnings** → **location** → **actions** |
| Expiry | Header **relative chip** + footer **absolute** backup; warning tone when &lt; 1h |
| Grouping | **Two sections:** “Needs your response” + “Past offers”; **no** third “expiring soon” section — urgency via chip + sort |
| Decline confirm | **Separate slice (6F-2c)** after layout/expiry ship; not in first 6F-2 PR |
| Mobile actions | Stack on `max-sm`: Accept full-width primary, Decline below outline; `min-h-11`, `gap-3` |
| Earnings | More prominent on mobile (`text-lg` amount, label de-emphasized) |
| Desktop | Current density acceptable; relative expiry chip optional at `md+` |
| Safest first slice | **6F-2a** — `formatOfferExpiryDisplay` + card hierarchy + expiry chip + sort within open offers (no sections, no decline sheet, no `OfferActions` refactor beyond spacing classes) |

---

## Current offer card pain points

Evidence from `src/app/(cleaner)/cleaner/offers/page.tsx`, `OfferActions.tsx`, `cleanerJobReadModel.ts`, `buildOfferExpiry.ts`, and parent 6F design.

| Pain point | Evidence | Mobile impact |
|------------|----------|---------------|
| **Expiry buried** | `text-xs text-zinc-500` after earnings; absolute `toLocaleString` only | Cleaners scroll past money/location before seeing time pressure |
| **No relative urgency** | No “Respond within …” chip | Hard to compare which offer to open first |
| **Flat list** | Single `<ul>`; expired/declined/accepted mixed with open | “Needs response” cards not scannable |
| **Weak earnings hierarchy** | `Your earnings ·` same weight as amount (`text-sm`) | Job value not obvious when triaging multiple offers |
| **Cramped actions** | `OfferActions`: side-by-side `px-4 py-2` (~36px height) | Below 44×44px targets; Accept/Decline mis-tap risk |
| **Actions below fold** | Order: badge → service → schedule → location → earnings → expiry → actions | Accept/Decline often off-screen on 375px devices |
| **Badge row underused** | Only status badge in header | No second chip for expiry |
| **Sort not urgency-based** | Server/list order unchanged in page | Soonest-expiring offer may not appear first |

**Already fixed (do not re-solve in 6F-2):**

| Item | Stage |
|------|-------|
| Fetch failure shown as empty | 6F-1b — `DashboardFetchError` |
| Missing Earnings in nav | 6F-1a — `CLEANER_NAV_ITEMS` |
| Route loading flash | 6A-1 — `offers/loading.tsx` |

---

## Design question answers

### 1. What information should be highest priority on offer cards?

For **actionable** offers (`status === "offered" && !isExpired`), optimize for: *“Do I want this job, and do I have time to decide?”*

| Priority | Field | Rationale |
|----------|-------|-----------|
| **P0** | Respond-by / expiry | Time-sensitive; drives sort order |
| **P1** | Schedule | When the work happens |
| **P2** | Earnings (`earningsLabel`) | Primary value question for cleaners |
| **P3** | Service label | Context for job type |
| **P4** | Location | Often long; support decision but not first scan |
| **P5** | Status badge | “Offered” confirms state; expiry chip carries urgency |
| **P6** | Actions | Visible without excessive scroll; after value summary |

For **past** offers (accepted, declined, expired offered, cancelled): status + schedule + service; hide expiry chip and actions; muted card (`opacity-90`, neutral border).

### 2. How should expiry be displayed?

Use existing `expiresAt` and `isExpired` from `CleanerOfferListItem` — **no TTL, cron, or `isOfferPastExpiry` logic changes.**

| Layer | Placement | Content | When |
|-------|-----------|---------|------|
| **Chip (header)** | Badge row next to “Offered” | Relative: “Respond within 2h 15m” | `canRespond` && `expiresAt` |
| **Chip tone** | `StatusBadge` or `OfferExpiryChip` | `warning` if &lt; 1h remaining; `danger` if expired offered | Presentation only |
| **Footer (backup)** | Below earnings, above actions | Absolute: “Expires Sat 19 May, 15:30” (`en-ZA`) | `canRespond` && `expiresAt` |
| **Accessibility** | `aria-label` on chip | Include ISO/local absolute time | Always when chip shown |
| **Expired offered** | Status badge “Expired” (existing) | Hide actions; optional `border-zinc-300` + muted body | `isExpired && status === offered` |
| **Past non-open** | No expiry lines | Status only | accepted / declined / cancelled |

**Formatter (new, display-only):**

```ts
// src/features/dashboards/server/formatOfferExpiryDisplay.ts (sketch)
formatOfferExpiryDisplay({ expiresAt, now }): {
  relativeLabel: string | null;   // "Respond within 2h 15m" | "Expired"
  absoluteLabel: string | null;   // en-ZA formatted
  isUrgent: boolean;              // < 1 hour
  isExpired: boolean;
}
```

Reuse locale patterns from `formatOfferExpiryLabel` in `loadAssignmentOfferNotificationContext.ts` where sensible; do not change email copy or enqueue.

**Home preview (`/cleaner`):** Show relative chip line under schedule for top open offers (same formatter); defer if 6F-2 scope is offers page only.

### 3. Should offers be grouped into active / expiring soon / expired?

**Recommendation: two sections, not three.**

| Section | Include | Sort | Title |
|---------|---------|------|-------|
| **Needs your response** | `canRespond` (`offered && !isExpired`) | `expiresAt` ascending (soonest first) | “Needs your response (N)” |
| **Past offers** | Everything else | `offeredAt` or `expiresAt` descending | “Past offers” |

**“Expiring soon”** is a **visual urgency tier**, not a separate section:

- Chip uses `warning` tone when &lt; 1h.
- Optional micro-copy on section: “Offers expiring within an hour are highlighted.”
- Avoid a third accordion — reduces scan cost and empty-section edge cases.

**Expired offered rows** live in **Past offers** (already non-actionable). Do not duplicate in “Needs response.”

**Empty section behavior (6F-1b aligned):**

- Global empty only when `offers.length === 0`.
- If `needsResponse.length === 0` but `past.length > 0`: show section header “No offers need a response right now” + Past list (not global empty).

### 4. Should decline confirmation be included in this slice or separate?

**Separate slice — 6F-2c (or 6F-2b if layout stable).**

| Approach | Rationale |
|----------|-----------|
| **Defer decline sheet from 6F-2a** | Adds client state, focus trap, and regression risk to mutation UX; layout/expiry deliver most triage value |
| **Include in 6F-2c** | After card hierarchy and button spacing proven on devices |
| **Accept path** | Unchanged — single tap, navigate to job on success (existing `OfferActions`) |

Decline sheet spec (for 6F-2c): bottom sheet on `max-sm`, centered dialog on `md+`; “Decline this job?” + Cancel + confirm Decline; confirm calls same `respond("decline")`; `prefers-reduced-motion` respected.

### 5. How should accept/decline buttons be spaced on mobile?

Apply to `OfferActions` (presentation only; same POST URLs).

| Rule | Mobile (`max-sm`) | Desktop (`md+`) |
|------|-------------------|------------------|
| Layout | Column: Accept full width, Decline full width below | Row: Accept + Decline side-by-side (current) |
| Gap | `gap-3` (12px) minimum | `gap-2` acceptable |
| Height | `min-h-11` (44px) both buttons | `min-h-10` minimum |
| Width | Accept `w-full`; Decline `w-full` | Auto width |
| Order | Accept first (primary top) | Accept left |
| Disabled | Existing `loading !== null` on both | Unchanged |
| Error | Full-width below buttons | Unchanged |

**Do not:** swipe gestures, duplicate Accept in card header, sticky bars on list.

### 6. Should earnings estimate be more prominent?

**Yes, on mobile only** for actionable cards.

| Element | Current | Proposed (`max-sm`) |
|---------|---------|---------------------|
| Amount | `text-sm` inline with label | `text-lg font-semibold text-zinc-900` |
| Label | “Your earnings ·” inline | `text-xs text-zinc-500` above amount: “Your earnings” |
| Position | After location | After schedule, before location (P2 in hierarchy) |

Desktop: keep inline `Your earnings · R …` or subtle bump to `text-base` — avoid layout jump on wide cards.

**Data:** Continue using `earningsLabel` / `resolveCleanerEarningsDisplay` — no formula or API field changes.

### 7. What should desktop preserve?

| Element | Mobile change | Desktop (`md+`) |
|---------|---------------|-----------------|
| Section headers | Needs response / Past | Same (benefits all breakpoints) |
| Expiry chip | Header + footer | Chip optional; footer absolute still fine |
| Earnings block | Stacked prominent | Current inline or mild emphasis |
| Action buttons | Stacked full-width | Side-by-side inline (current) |
| Card density | Slightly more vertical padding on open cards | Current `p-5` acceptable |
| Shell / nav | Unchanged | Unchanged (no bottom nav in 6F-2) |

No change to admin/customer offer UIs.

### 8. What tests are required?

#### Unit tests (new)

| Module | Cases |
|--------|-------|
| `formatOfferExpiryDisplay` | Relative string; expired; null `expiresAt`; &lt;1h `isUrgent`; boundary at exactly 0 |
| `partitionCleanerOffers` (helper) | `needsResponse` vs `past`; sort by `expiresAt` asc; empty needs + non-empty past |

#### Component tests

| Component | Cases |
|-----------|-------|
| `OfferExpiryChip` (new) | Warning/danger/neutral tones; `aria-label` includes absolute time |
| `CleanerOfferCard` (extracted, recommended) | Renders hierarchy; hides actions when `!canRespond` |
| `OfferActions` | Mobile classes present; buttons disabled while loading (existing behavior) |

#### Page / static wiring

| File | Cases |
|------|-------|
| `offers/page.tsx` | Uses partition helper; `formatOfferExpiryDisplay`; section headings; no revert to flat-only empty |
| `cleanerPagesStage6f2.test.ts` (new) | Wiring guards similar to 6F-1a/1b |

#### Regression (unchanged expectations)

```bash
npm run test -- src/app/api/cleaner/cleanerMutationRoutes.test.ts src/features/dashboards/server/cleanerApiRoutes.test.ts
```

#### Manual QA (375×667)

1. Open offer with &gt;1h left — relative chip visible without scrolling; absolute in footer.
2. Offer &lt;1h — chip warning tone.
3. Expired offered — in Past section, no actions, Expired badge.
4. Accept still navigates to job detail.
5. Decline still works (until 6F-2c adds confirm).
6. Desktop: buttons side-by-side; layout not broken at `md`.
7. Screen reader: expiry chip `aria-label` readable.

### 9. What should remain out of scope?

| Out of scope | Notes |
|--------------|-------|
| `POST …/accept` / `decline` contract changes | Same handlers, idempotency |
| `buildOfferExpiresAt`, TTL constants, `expireOffers` cron | Read-only display of `expiresAt` |
| Assignment / dispatch / redispatch | No command changes |
| `resolveCleanerEarningsDisplay` formulas | Display hierarchy only |
| Notifications / email templates | May share locale helper read-only; no template edits required |
| Sticky action bars | 6F-4 |
| Bottom nav | 6F-5 |
| Jobs list sectioning | 6F-3 |
| New `/cleaner/offers/[offerId]` route | Defer |
| Offer hash deep links | Optional 6F-2d |
| Pull-to-refresh | Defer |

---

## Proposed card hierarchy

### Actionable offer card (mobile)

```
┌─────────────────────────────────────────┐
│ [Offered]  [Respond within 1h 20m]  ⚠  │  ← badge row (max 2 badges)
│ Standard clean                          │
│ Sat 19 May, 14:00–16:00                 │  ← schedule (font-medium)
│ Your earnings                           │
│ R 350.00                                │  ← text-lg semibold
│ Sandton, Gauteng                        │  ← location (muted, may truncate)
│ Expires Sat 19 May, 15:30               │  ← absolute backup (text-xs)
│ ┌─────────────────────────────────────┐ │
│ │            Accept                   │ │  ← min-h-11, full width
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │            Decline                  │ │  ← outline, full width
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Past offer card (mobile)

```
┌─────────────────────────────────────────┐
│ [Declined]                              │  ← muted card
│ Standard clean                          │
│ Sat 19 May, 14:00–16:00                 │
│ (no expiry, no actions)                 │
└─────────────────────────────────────────┘
```

### Page layout

```
┌──────────────────────────────────────┐
│ Assignment offers                    │
│ Accept or decline jobs offered to you. │
├──────────────────────────────────────┤
│ NEEDS YOUR RESPONSE (2)              │
│ [actionable cards, soonest expiry first] │
├──────────────────────────────────────┤
│ PAST OFFERS (5)                      │
│ [muted cards]                        │
└──────────────────────────────────────┘
```

---

## Expiry chip policy

| Condition | Chip label | Tone | Actions |
|-----------|------------|------|---------|
| `canRespond`, &gt;1h left | “Respond within Xh Ym” | `info` or `warning` (product choice: **warning** only if &lt;1h) | Show |
| `canRespond`, &lt;1h left | “Respond within Xm” | `warning` | Show |
| `canRespond`, &lt;1m / imminently | “Respond soon” | `warning` | Show |
| `isExpired && offered` | “Expired” (status badge, not chip) | `danger` | Hide |
| accepted / declined / cancelled | — | status badge only | Hide / View job link |

**Badge budget:** Max **2** badges per row (status + expiry chip).

**Null `expiresAt`:** Omit chip; show footer only if policy allows “No expiry shown” — prefer omit both unless ops guarantees `expires_at` on offered rows.

---

## Action spacing rules

| ID | Rule |
|----|------|
| A1 | Accept is visually primary (filled dark); Decline is secondary (outline) |
| A2 | `gap-3` minimum between stacked buttons on mobile |
| A3 | `min-h-11` touch targets on mobile for both actions |
| A4 | Do not place Accept and Decline on the same row on `max-sm` |
| A5 | Error text spans full width below button group |
| A6 | While `loading !== null`, both buttons disabled (existing) |
| A7 | No second Accept elsewhere on the card |
| A8 | Decline confirm (6F-2c) must run before POST — sheet cancel does not POST |

---

## Decline confirmation decision

| Phase | Include decline sheet? |
|-------|------------------------|
| **6F-2a** | **No** — layout, expiry, sections, earnings emphasis, button spacing |
| **6F-2c** | **Yes** — `DeclineOfferConfirmSheet` wrapping existing decline handler |

Rationale: 6F-2a is read-mostly presentation; decline confirm is the highest-risk accidental-tap control and deserves isolated QA.

---

## Mobile vs desktop behavior

| Feature | `max-sm` | `md+` |
|---------|----------|-------|
| Section headers | Yes | Yes |
| Expiry chip in header | Yes | Yes (optional smaller) |
| Earnings stacked prominent | Yes | Inline or mild |
| Actions stacked full-width | Yes | Side-by-side |
| Past cards muted | Yes | Yes |
| Sticky bars | **No** | **No** |

---

## Phased implementation plan

| Phase | ID | Deliverables | Risk | Depends |
|-------|-----|--------------|------|---------|
| **1** | **6F-2a** | `formatOfferExpiryDisplay`; `OfferExpiryChip`; `partitionCleanerOffers`; extract `CleanerOfferCard`; section headers; sort needs-response by `expiresAt`; mobile earnings hierarchy; `OfferActions` responsive spacing | **Low** — **shipped** | 6F-1b |
| **2** | **6F-2b** | Home preview expiry line; optional `#offer-{id}` scroll highlight | **Low** | 6F-2a |
| **3** | **6F-2c** | `DeclineOfferConfirmSheet` + tests | **Low–medium** | 6F-2a |
| **Defer** | 6F-4 | Sticky job actions | — | 6F-3 |

**Parallelization:** 6F-2a is one PR. 6F-2b and 6F-2c can follow in parallel after 6F-2a QA.

---

## Test strategy

| Layer | Command / path |
|-------|----------------|
| Unit | `formatOfferExpiryDisplay.test.ts`, `partitionCleanerOffers.test.ts` |
| Component | `OfferExpiryChip.test.tsx`, `OfferActions.test.tsx` (spacing + loading) |
| Page wiring | `cleanerPagesStage6f2.test.ts` |
| Regression | `cleanerMutationRoutes.test.ts`, `cleanerApiRoutes.test.ts` |
| Manual | 7-step checklist in §8 |

---

## Final recommendation

### Safest first 6F-2 implementation slice: **6F-2a — Expiry display + card hierarchy + two-section list + mobile button spacing**

| Deliverable | Why safest |
|-------------|------------|
| `formatOfferExpiryDisplay` + `OfferExpiryChip` | Pure functions; no API/RLS; fixes core visibility gap |
| `partitionCleanerOffers` + section headers | Display-only; same data from `listCleanerOffersForDashboard` |
| Sort needs-response by `expiresAt` asc | No server query change |
| Mobile earnings emphasis + action stack/`min-h-11` | CSS/layout only; same `OfferActions` POST |
| Extract `CleanerOfferCard` | Single component for tests and home reuse later |
| **Exclude** decline confirmation sheet | Reduces mutation UX risk in first PR |
| **Exclude** sticky bars, bottom nav, jobs sectioning | Per 6F parent scope |

**Second slice:** **6F-2c** — decline confirmation after layout QA on real devices.

**Third slice:** **6F-2b** — home preview expiry + optional hash scroll.

**Do not lead with decline sheet or sticky actions** — earn confidence with visibility and spacing first.

---

## Related files

| Area | Path |
|------|------|
| Offers page | `src/app/(cleaner)/cleaner/offers/page.tsx` |
| Offer actions | `src/components/dashboard/OfferActions.tsx` |
| Read model | `src/features/dashboards/server/cleanerJobReadModel.ts` |
| Offer types | `src/features/dashboards/server/types.ts` (`CleanerOfferListItem`) |
| Expiry helper (read-only) | `src/features/assignments/server/buildOfferExpiry.ts` |
| Parent 6F design | `docs/architecture/stage-6f-cleaner-mobile-polish-design.md` |
| Shipped 6F-1 | `docs/operations/stage-6-ui-polish.md` |

---

## Design checklist (requirements trace)

| Requirement | Section |
|-------------|---------|
| Current pain points | [Current offer card pain points](#current-offer-card-pain-points) |
| Card hierarchy | [Proposed card hierarchy](#proposed-card-hierarchy) |
| Expiry chip policy | [Expiry chip policy](#expiry-chip-policy) |
| Action spacing | [Action spacing rules](#action-spacing-rules) |
| Decline decision | [Decline confirmation decision](#decline-confirmation-decision) |
| Mobile vs desktop | [Mobile vs desktop behavior](#mobile-vs-desktop-behavior) |
| Phased plan | [Phased implementation plan](#phased-implementation-plan) |
| Tests | [Test strategy](#test-strategy) |
| Out of scope | [What should remain out of scope?](#9-what-should-remain-out-of-scope) |
| Safest first slice | [Final recommendation](#final-recommendation) |
