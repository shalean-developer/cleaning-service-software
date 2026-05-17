# Stage 6F — Cleaner Mobile Polish Design

**Date:** 2026-05-18  
**Status:** **6F-1a + 6F-1b implemented** (nav, cleaner job labels, offers/jobs empty vs fetch error). Layout, sticky actions, bottom nav, and deeper polish remain design-only until later phases.  
**Depends on:** [stage-6-safe-ux-ui-improvements-design.md](./stage-6-safe-ux-ui-improvements-design.md), [stage-6-ui-polish.md](../operations/stage-6-ui-polish.md) (6A-1 skeletons + humanized timelines already shipped), [customer-cleaner-admin-dashboards.md](../dashboards/customer-cleaner-admin-dashboards.md)

**Goal:** Improve cleaner mobile usability (layout, copy, navigation, empty states, badge labels, expiry visibility) **without** changing assignment, accept/decline, completion, earnings, or notification behavior.

**Non-goals:** New commands, API contract changes, RLS, worker/cron, offer TTL logic (`buildOfferExpiry` / `ASSIGNMENT_OFFER_TTL_HOURS`), earnings formulas, `resolveCleanerEarningsDisplay`, notification templates, pull-to-refresh (defer), native app shell.

---

## Executive summary

| Decision | Recommendation |
|----------|----------------|
| Priority order | **6F-1** Nav + badge labels → **6F-2** Offers layout + expiry → **6F-3** Jobs sections + active visibility → **6F-4** Sticky actions (with safety) → **6F-5** Home + earnings polish |
| Safest first slice | **6F-1a** — unified cleaner nav (include Earnings everywhere) + `labelForCleanerJobStatus` display mapping (no layout/sticky changes) |
| Sticky actions | Only on **offer detail context** (expanded card or future offer anchor) and **job detail** when `canRespond` / `assigned` / `in_progress`; never on list scroll with multiple actionable cards |
| Accidental taps | Decline = secondary + confirm sheet; Accept = primary but not full-width adjacent to Decline without 8px+ separation; disable double-submit (existing loading state) |
| Active jobs | UI partition: **Today / Upcoming** (`assigned`), **In progress**, **Completed & paid** (`completed`, `payout_ready`, `paid_out`) — sort within sections unchanged (server `scheduled_start` asc) |
| Desktop | Cleaner routes stay responsive; bottom nav and sticky bars apply at `max-sm` only; `md+` keeps current top nav and inline actions |
| Read-model changes | **Display-only** partitioning/sorting in page components or thin helpers; optional `expiresInLabel` derived string — no new DB columns |

---

## Current cleaner mobile pain points

Evidence from `src/app/(cleaner)/`, `DashboardShell.tsx`, `OfferActions.tsx`, `JobCompletionActions.tsx`, `cleanerJobReadModel.ts`, and `statusLabels.ts`.

### Navigation and shell

| Pain point | Evidence | Mobile impact |
|------------|----------|---------------|
| **Inconsistent nav** | Home includes Earnings; `/cleaner/offers`, `/cleaner/jobs`, `/cleaner/jobs/[bookingId]` omit it | Extra taps; cleaners lose earnings context during triage |
| **Top horizontal nav only** | `DashboardShell` — `flex-wrap` text links in header, `py-1.5` tap targets | Hard to reach one-handed; active route not obvious |
| **No cleaner-specific shell** | Same shell as customer/admin | No bottom nav, no safe-area padding for home-indicator devices |
| **Wide max width** | `max-w-5xl` on all roles | Cards feel sparse on phone but actions sit far below fold on detail |

### Offers (`/cleaner/offers`)

| Pain point | Evidence | Mobile impact |
|------------|----------|---------------|
| **Flat undifferentiated list** | All offers in one `<ul>`; expired/declined mixed with open | Hard to find “needs response” quickly |
| **Actions inline in scroll** | `OfferActions` inside each card; not sticky | Accept/decline fall below location + earnings on small screens |
| **Small action buttons** | `px-4 py-2 text-sm`; side-by-side Accept + Decline | Below 44×44px effective target; mis-tap risk |
| **Expiry easy to miss** | `text-xs text-zinc-500` at card bottom after earnings | Time pressure not visible until scroll |
| **No offer deep link** | Home preview links to `/cleaner/offers` only | Cannot share/bookmark a specific offer card |
| **Fetch errors look empty** | `offers = result.ok ? result.offers : []` | Auth/read failures indistinguishable from “no offers” |
| **Weak empty state** | “No offers” without CTA to jobs | Missed guidance when between assignments |

### Jobs (`/cleaner/jobs`, `/cleaner/jobs/[bookingId]`)

| Pain point | Evidence | Mobile impact |
|------------|----------|---------------|
| **No active vs past sections** | Single list ordered by `scheduled_start` | `payout_ready` / `paid_out` jobs look “active” alongside today’s work |
| **Misleading “Active” on home** | `status !== "completed"` includes payout substates | Home count and preview overstate urgent work |
| **Start/complete not sticky** | `JobCompletionActions` inline in card after instructions | Primary job actions require scroll on long instruction text |
| **Ops-oriented status labels** | `labelForBookingStatus` → “Payout ready”, “Cleaner assigned” | Confusing on cleaner-owned jobs (`assigned` reads like someone else) |
| **Earnings clarity** | List cards omit earnings; detail shows lines or fallback `earningsLabel` | Inconsistent “what will I earn?” between list and detail |
| **No job detail skeleton** | `loading.tsx` on list only | Detail navigation still flashes blank |

### Earnings (`/cleaner/earnings`)

| Pain point | Evidence | Mobile impact |
|------------|----------|---------------|
| **Nav order differs** | Jobs before Offers missing; only Home, Jobs, Earnings | Different mental model from other cleaner pages |
| **Payout status jargon** | `labelForPayoutStatus` — “Ready for payout” | Fine on desktop; dense on narrow cards |
| **Amount hierarchy** | Badge above service; amount below schedule | Scan path unclear when comparing jobs |

### Cross-cutting (partially addressed in 6A-1)

| Pain point | Status |
|------------|--------|
| Timeline command leakage | **Fixed** — `audience: "cleaner"` in `buildLifecycleTimeline` |
| List skeletons for offers/jobs | **Fixed** — `loading.tsx` |
| Payment milestone on cleaner timeline | **Still weak** — `payments: []` in `getCleanerJobDetail` (display-only enrichment deferred) |

---

## Design question answers

### 1. Which cleaner pages need polish first?

| Priority | Route | Rationale |
|----------|-------|-----------|
| **P0** | `/cleaner/offers` | Time-sensitive accept/decline; highest mis-tap and expiry risk |
| **P0** | `/cleaner/jobs/[bookingId]` | Start/complete are day-of-work actions |
| **P1** | `/cleaner/jobs` | Sectioning reduces wrong-job opens |
| **P1** | `/cleaner` (home) | Align “active” heuristic with jobs page sections |
| **P2** | `/cleaner/earnings` | Read-mostly; lower incident rate |
| **Defer** | New `/cleaner/offers/[offerId]` | Optional read-only route; not required for first slices |

### 2. Where should sticky actions appear?

| Surface | Sticky? | Condition |
|---------|---------|-----------|
| **Job detail** `/cleaner/jobs/[bookingId]` | **Yes** (`max-sm`) | `status === "assigned"` or `in_progress` |
| **Offers list** | **No** (multi-card) | Sticky per-row would stack/conflict |
| **Single expanded offer** | **Optional** | If using `#offer-{id}` anchor + one open card, sticky bar for that card only |
| **Offer card (default list)** | **No** | Keep actions in card footer with larger targets |
| **Home previews** | **No** | Link to offers/job detail for actions |
| **Earnings** | **No** | No mutations |

**Layout pattern (job detail, mobile):**

```
┌─────────────────────────────┐
│ Header + back               │
│ Status + schedule + location│
│ Instructions                │
│ Timeline (scrollable)       │
│ Earnings summary            │
├─────────────────────────────┤
│ [ Start job ]  or [ Complete ]│  ← sticky, safe-area inset
└─────────────────────────────┘
```

Main content gets `padding-bottom` equal to sticky bar height so nothing is hidden.

### 3. How to avoid accidental accept/decline taps?

| Control | Implementation (UI only) |
|---------|---------------------------|
| **Decline confirmation** | Tapping Decline opens a bottom sheet / dialog: “Decline this job?” with Cancel + confirm Decline (destructive). Accept does not require two steps. |
| **Button separation** | Decline: outline, left or below Accept on `max-sm`; minimum `gap-3` (12px). |
| **Touch targets** | `min-h-11` (44px) on mobile primary/secondary actions. |
| **Loading guard** | Keep existing `loading !== null` disable on both buttons (no API change). |
| **No swipe-to-accept** | Defer gesture shortcuts — high false-positive rate. |
| **Expired / non-offered** | Do not render `OfferActions` (already gated by `canRespond`). |
| **Sticky bar** | Only one offer’s actions visible at a time; never duplicate Accept in header and sticky. |

**Explicit non-change:** `POST /api/cleaner/offers/[offerId]/accept|decline` handlers, idempotency, and command paths stay untouched.

### 4. What offer expiry information should be visible?

Use existing `expiresAt` + `isExpired` from `CleanerOfferListItem` — **no TTL or cron changes**.

| Context | Display | Notes |
|---------|---------|-------|
| **Open offer card (header)** | Badge row: `Offered` + **time remaining** | e.g. “Respond within 2h 15m” via client-safe relative formatter from `expiresAt` |
| **Open offer card (footer)** | Absolute backup: “Expires Mon 19 May, 14:30” | Keep `en-ZA` locale; consider `aria-label` with ISO time |
| **&lt; 1 hour remaining** | Warning tone on expiry chip (`warning` / amber) | Presentation only |
| **Expired (`isExpired && status === offered`)** | Badge **Expired** (already); hide actions; grey card border | Matches current logic |
| **Accepted / declined** | No expiry chip | Show status only |
| **Home preview (top 3 open)** | Show relative expiry under schedule | Same formatter as offers list |

**Formatter location:** `formatOfferExpiryDisplay({ expiresAt, now })` in `src/features/dashboards/server/` or `src/lib/format/` — pure function, unit-tested.

### 5. How should active jobs be prioritized?

**Display partitioning only** — same `listCleanerJobs` query and sort (`scheduled_start` ascending).

| Section | Include statuses | Sort | Section title |
|---------|------------------|------|---------------|
| **In progress** | `in_progress` | `scheduled_start` asc | “In progress” |
| **Upcoming** | `assigned` | `scheduled_start` asc | “Upcoming” |
| **Completed** | `completed`, `payout_ready`, `paid_out` | `scheduled_start` desc (most recent first) | “Completed” |

**Home dashboard (`/cleaner`):**

- **Needs response** — unchanged: `offered && !isExpired`
- **Active jobs** count + preview → only `assigned` + `in_progress` (fix heuristic)
- Optional fourth block: “Recently completed” — max 2 rows from completed section

**Visual priority:** In progress cards get accent left border (`border-l-4 border-emerald-600`); upcoming neutral; completed muted (`opacity-90`, collapsed by default on mobile if &gt; 3 items).

### 6. How should completed/past jobs be separated?

| Approach | Recommendation |
|----------|----------------|
| **Jobs list** | Three sections as above; completed collapsed behind “Show N completed jobs” when N &gt; 5 |
| **Offers list** | Two sections: **Needs your response** (`canRespond`) then **Past offers** (everything else) |
| **No tabs in v1** | Sections reduce tap depth vs tab state |
| **No server filter** | Partition in page from existing array |

### 7. What empty states are needed?

| Location | Current | Proposed |
|----------|---------|----------|
| `/cleaner/offers` (none) | “No offers” | **“No job offers right now”** — dispatch sends offers here; CTA **View my jobs** |
| `/cleaner/offers` (no open, has past) | N/A | Section “Needs response” empty + past section visible — avoid global empty |
| `/cleaner/jobs` (none) | Good CTA to offers | Add one line: “Accept an offer to get scheduled jobs.” |
| `/cleaner/jobs` (only completed) | N/A | Upcoming empty: “No upcoming jobs” + completed section still listed |
| `/cleaner` home (no offers, no active) | Silent sections | Single `EmptyState`: “You’re all caught up” + links to offers + jobs |
| `/cleaner/earnings` | Adequate | Add “Earnings appear after you complete a job” + link to jobs |
| **Fetch error** (all cleaner lists) | Hidden as empty | Reuse `DashboardFetchError` (6A pattern) when `!result.ok` |

### 8. What status badge labels should be improved?

Add **`labelForCleanerJobStatus`** and **`toneForCleanerJobStatus`** in `statusLabels.ts` (display-only wrappers, same pattern as `labelForCustomerBookingStatus`).

| DB / raw status | Current (`labelForBookingStatus`) | Cleaner label | Tone |
|-----------------|-----------------------------------|---------------|------|
| `assigned` | Cleaner assigned | **Scheduled** | info |
| `in_progress` | In progress | **In progress** | info |
| `completed` | Completed | **Completed** | success |
| `payout_ready` | Payout ready | **Completed** | success |
| `paid_out` | Paid out | **Paid** | success |

**Offers** — keep `labelForOfferStatus`; expired offered row keeps **Expired** override (existing).

**Earnings cards** — optional `labelForCleanerPayoutStatus`:

| `payout_status` | Cleaner label |
|-----------------|---------------|
| `pending` | Pending |
| `payout_ready` | Processing payout |
| `paid` | Paid |

**Badge budget:** Max **2** badges per cleaner list row (status + optional expiry chip, not a second status).

### 9. What should remain desktop unchanged?

| Element | Mobile (`max-sm`) | Desktop (`md+`) |
|---------|-------------------|-----------------|
| `DashboardShell` nav | Bottom tab bar (4 items) | Existing top header links |
| Sticky job actions | Fixed bottom bar | Inline `JobCompletionActions` in card (current) |
| Decline confirmation sheet | Full-width sheet | Modal centered (same component, responsive) |
| Offer card layout | Single column, larger type for schedule | Current card density acceptable |
| Jobs section collapse | “Show completed” expander | All sections expanded by default |
| Home grid | Single column stack | Keep `sm:grid-cols-2` summary cards |

**No change to:** admin/customer shells, API routes, booking status values in DB, offer expiry computation.

### 10. What tests are required?

#### Unit tests (new / extended)

| Area | Tests |
|------|-------|
| `labelForCleanerJobStatus` | Maps `assigned` → Scheduled; `payout_ready` / `paid_out` → Completed / Paid |
| `labelForCleanerPayoutStatus` | Optional payout copy |
| `formatOfferExpiryDisplay` | Relative string, expired, null `expiresAt`, &lt;1h warning flag |
| `partitionCleanerJobs` (helper) | Sections correct for mixed statuses; completed sort desc |
| `partitionCleanerOffers` | Open vs past; `canRespond` edge cases |

#### Component tests

| Component | Tests |
|-----------|-------|
| `CleanerMobileActionBar` (new wrapper) | Renders only when `showActions`; safe-area class present |
| `OfferActions` | Decline opens confirm; confirm calls same handler; buttons disabled while loading |
| `DeclineOfferConfirmSheet` | Cancel does not POST |
| `DashboardShell` (cleaner variant) | Bottom nav renders 4 items at mobile breakpoint |

#### Page / integration (lightweight)

| Area | Tests |
|------|-------|
| Offers page | `!result.ok` → `DashboardFetchError`, not `EmptyState` |
| Jobs page | Sections render headings; in_progress before assigned |
| Home page | Active count excludes `payout_ready` |

#### Manual QA (375×667 and iOS safe area)

1. Open offer near expiry — relative time visible without scrolling.
2. Decline requires confirmation; Accept does not.
3. Accept still navigates to job detail on success (existing behavior).
4. Job detail: Start/Complete visible without scrolling past timeline.
5. Sticky bar does not cover location or instructions when scrolled to top.
6. Completed jobs collapsed/sectioned; home “Active” matches jobs list.
7. Earnings link present in nav on every cleaner route.
8. Desktop: no bottom nav; inline buttons unchanged.
9. Screen reader: expiry `aria-label` includes absolute time.

**Regression guard:** Run existing `cleanerMutationRoutes.test.ts` and `cleanerApiRoutes.test.ts` — no changes expected.

---

## Proposed mobile layouts

### A. Cleaner shell (`DashboardShell` cleaner variant)

**New prop or wrapper:** `variant="cleaner"` on `DashboardShell` **or** `CleanerDashboardShell` composing it.

**Bottom nav (`max-sm` only):**

| Tab | href | Icon (optional) |
|-----|------|-----------------|
| Home | `/cleaner` | Home |
| Offers | `/cleaner/offers` | Inbox |
| Jobs | `/cleaner/jobs` | Calendar |
| Earnings | `/cleaner/earnings` | Wallet |

- Active state: `bg-zinc-100` + `font-semibold` + `aria-current="page"`
- Sign out: move to header kebab or footer “Account” on mobile (avoid 5th tab)
- `pb-safe` / `env(safe-area-inset-bottom)` on nav and sticky bars

**Shared nav constant:** `CLEANER_NAV_ITEMS` in `src/features/dashboards/cleanerNav.ts` — single source for all cleaner pages.

### B. Offers list (`/cleaner/offers`)

```
┌──────────────────────────────────────┐
│ Assignment offers                    │
│ Accept or decline jobs offered to you. │
├──────────────────────────────────────┤
│ NEEDS YOUR RESPONSE (2)              │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ [Offered] [Respond within 1h 20m]│ │
│ │ Standard clean · Sat 14:00–16:00   │ │
│ │ 📍 Sandton                         │ │
│ │ Your earnings · R 350.00           │ │
│ │ Expires Sat 19 May, 15:30          │ │
│ │ ┌────────────┐ ┌───────────────┐  │ │
│ │ │   Accept   │ │    Decline    │  │ │
│ │ └────────────┘ └───────────────┘  │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ PAST OFFERS                          │
│ (accepted / declined / expired)      │
└──────────────────────────────────────┘
```

- **Card tap** (optional 6F-3): row navigates to `#offer-{offerId}` scroll + highlight ring — no new server route required.
- **Earnings line:** bold amount; label “Your earnings” stays (formula unchanged).

### C. Jobs list (`/cleaner/jobs`)

```
┌──────────────────────────────────────┐
│ IN PROGRESS (1)                      │
│ [accent card → detail]               │
├──────────────────────────────────────┤
│ UPCOMING (2)                         │
│ [cards]                              │
├──────────────────────────────────────┤
│ COMPLETED (12)          [Show all ▼] │
│ [muted cards, recent first]          │
└──────────────────────────────────────┘
```

- List row adds **secondary line** `earningsLabel` (already on `CleanerJobListItem`) for scan consistency.
- Status badge uses `labelForCleanerJobStatus`.

### D. Job detail (`/cleaner/jobs/[bookingId]`)

- Header: cleaner job status badge + large schedule
- **Earnings block** moved above timeline on mobile (money question answered before history)
- Timeline: unchanged data; collapsible “Job activity” default **closed** on `max-sm` when job is `assigned`/`in_progress` (reduce scroll)
- **Sticky:** `CleanerJobActionBar` wrapping existing `JobCompletionActions` props

### E. Home (`/cleaner`)

- Summary cards: Open offers | **Active jobs** (redefined) | optional **Earnings this month** (defer — needs aggregation; **out of 6F-1**)
- Preview cards: show expiry on offers; deep link `href="/cleaner/offers#offer-{id}"` when hash supported
- Align nav with `CLEANER_NAV_ITEMS`

### F. Earnings (`/cleaner/earnings`)

- Unified nav
- Card layout: amount as primary (`text-xl`), status badge smaller (`size="sm"` if added to `StatusBadge`)
- Payout labels via `labelForCleanerPayoutStatus`

---

## Sticky action safety rules

| Rule | Rationale |
|------|-----------|
| **S1** | At most one sticky mutation bar per viewport | Prevents duplicate POST targets |
| **S2** | Sticky bar only on routes with **single** actionable entity (job detail) | List pages have N offers |
| **S3** | Sticky content mirrors inline actions — same `OfferActions` / `JobCompletionActions` children, not duplicate logic | Avoid behavior drift |
| **S4** | When sticky visible, hide duplicate inline primary buttons OR inline becomes screen-reader-only anchor | Pick one visible control set |
| **S5** | `padding-bottom` on `<main>` ≥ sticky height + safe area | No obscured content |
| **S6** | Focus order: main content → sticky bar → not focus-trapped | a11y |
| **S7** | Decline never in sticky without confirm path | Even on sticky, Decline opens sheet first |
| **S8** | No sticky on completed / terminal job statuses | `JobCompletionActions` already returns null |
| **S9** | Respect `prefers-reduced-motion` for sheet animations | a11y |
| **S10** | If keyboard open (mobile), sticky bar stays above keyboard — use `position: fixed` + visual viewport testing | UX polish |

---

## Status badge improvements

**Implementation shape:**

```ts
// statusLabels.ts (design sketch — not implemented)
export function labelForCleanerJobStatus(status: BookingStatus): string { ... }
export function toneForCleanerJobStatus(status: BookingStatus): StatusBadgeTone { ... }
```

**Replace on cleaner surfaces only:** `cleaner/page.tsx`, `cleaner/jobs/page.tsx`, `cleaner/jobs/[bookingId]/page.tsx`, home previews.

**Do not replace** on admin or customer pages.

**Expiry chip (offers):** New presentational component `OfferExpiryChip` — not a booking status; uses warning/danger tone based on `isExpired` and time remaining.

---

## Empty states

See [§7](#7-what-empty-states-are-needed). Use existing `EmptyState` + `DashboardFetchError` components.

**Offers-specific:** When `past.length > 0` but `open.length === 0`, show section header “No offers need a response right now” instead of global empty.

---

## Phased implementation plan

| Phase | ID | Deliverables | Risk | Depends |
|-------|-----|--------------|------|---------|
| **6F-1a** | Nav + labels | `CLEANER_NAV_ITEMS`; Earnings on all routes; `labelForCleanerJobStatus`; swap badges on cleaner pages | **Low** — **shipped** | 6A |
| **6F-1b** | Errors + empty copy | `DashboardFetchError` on offers/jobs/home previews; improved `EmptyState` copy/CTAs | **Low** — **shipped** | 6A |
| **6F-2** | Offers layout | Section open vs past; `formatOfferExpiryDisplay` + `OfferExpiryChip`; larger mobile buttons; decline confirm sheet | **Low–medium** | 6F-1a |
| **6F-3** | Jobs layout | `partitionCleanerJobs`; section headers; completed collapse; earnings on list row; home active fix | **Low–medium** | 6F-1a |
| **6F-4** | Sticky job actions | `CleanerJobActionBar` on detail `max-sm`; timeline/earnings reorder; detail `loading.tsx` | **Medium** | 6F-3 |
| **6F-5** | Earnings + shell | Bottom nav; `labelForCleanerPayoutStatus`; earnings card hierarchy | **Medium** | 6F-1a |
| **Defer** | Offer hash route / pull-to-refresh | — | — | — |

**Parallelization:** 6F-1a and 6F-1b can ship together. 6F-2 and 6F-3 parallel after 6F-1a. 6F-4 should follow 6F-3. 6F-5 can parallel 6F-2/3 but bottom nav touches all routes — schedule after 6F-1a or bundle with 6F-5 only.

**Explicitly not in 6F:**

- Joining `payments` into cleaner timeline (Stage 6 Tier 1 — separate small read-model display change if desired)
- `GET /api/cleaner/offers/[offerId]` new BFF
- Notification UI

---

## Tests

Consolidated from [§10](#10-what-tests-are-required).

| Layer | Command / path |
|-------|----------------|
| Unit | `statusLabels.test.ts` (extend), `formatOfferExpiryDisplay.test.ts`, `partitionCleanerJobs.test.ts` |
| Component | `OfferActions.test.tsx`, `CleanerJobActionBar.test.tsx`, `DashboardShell.test.tsx` |
| Existing regression | `npm run test -- src/app/api/cleaner/cleanerMutationRoutes.test.ts src/features/dashboards/server/cleanerApiRoutes.test.ts` |
| Manual | 9-step checklist in §10 |

---

## Risk classification

| ID | Change | Risk | Mitigation |
|----|--------|------|------------|
| R1 | Decline confirm sheet | Low | Extra tap only on decline; accept path unchanged |
| R2 | Sticky job bar | Medium | Visual QA on iOS Safari; padding-bottom; no new API |
| R3 | Bottom nav | Medium | Hide on `md+`; test all cleaner routes |
| R4 | Job section partition | Low | Pure display; same data |
| R5 | Cleaner status labels | Low | Cleaner routes only; unit tests |
| R6 | Home active count change | Low | Copy-only expectation; may reduce displayed count (correct) |

---

## Rollout strategy

| Step | Action |
|------|--------|
| 1 | Ship **6F-1a** — nav + labels (no sticky, no bottom nav) |
| 2 | Ship **6F-1b** — errors + empty states |
| 3 | Ship **6F-2** + **6F-3** in parallel PRs if desired |
| 4 | Ship **6F-4** after QA on real devices |
| 5 | Ship **6F-5** bottom nav last (broadest route touch) |

**Rollback:** Each phase is independently revertible; no migrations.

**Feature flags:** Not required; optional `ENABLE_CLEANER_BOTTOM_NAV` only if ops wants gradual enable — default off until 6F-5.

---

## Final recommendation

### Safest first 6F implementation slice: **6F-1a — Unified nav + cleaner job status labels**

| Deliverable | Why safest |
|-------------|------------|
| `CLEANER_NAV_ITEMS` shared across all cleaner pages | Fixes real inconsistency; zero mutation risk |
| `labelForCleanerJobStatus` / `toneForCleanerJobStatus` | Display-only; mirrors proven customer label pattern |
| Replace `labelForBookingStatus` on cleaner job surfaces only | No API, RLS, or assignment changes |
| **Exclude** sticky bars, decline sheet, bottom nav, section partitioning | Minimizes layout regression and accidental-tap surface area |

**Second slice:** **6F-1b** — fetch error vs empty on offers/jobs (copy customer bookings pattern).

**Third slice:** **6F-2** — offers sections + expiry visibility + decline confirmation (highest user value before sticky).

**Fourth slice:** **6F-3** — jobs sectioning + home active heuristic.

**Fifth slice:** **6F-4** — sticky job detail actions (after sectioning proves list UX stable).

**Do not lead with sticky actions or bottom nav** — both touch global shell and incident-sensitive controls; earn confidence with labels, expiry, and decline guard first.

---

## Related files

| Area | Path |
|------|------|
| Cleaner pages | `src/app/(cleaner)/cleaner/**/*.tsx` |
| Offer actions | `src/components/dashboard/OfferActions.tsx` |
| Job actions | `src/components/dashboard/JobCompletionActions.tsx` |
| Shell | `src/components/dashboard/DashboardShell.tsx` |
| Read model | `src/features/dashboards/server/cleanerJobReadModel.ts` |
| Status labels | `src/features/bookings/server/statusLabels.ts` |
| Offer expiry helper | `src/features/assignments/server/buildOfferExpiry.ts` |
| Stage 6 parent | `docs/architecture/stage-6-safe-ux-ui-improvements-design.md` |
| Implemented 6A | `docs/operations/stage-6-ui-polish.md` |
| Dashboard map | `docs/dashboards/customer-cleaner-admin-dashboards.md` |

---

## Design checklist (requirements trace)

| Requirement | Section |
|-------------|---------|
| Current pain points | [Current cleaner mobile pain points](#current-cleaner-mobile-pain-points) |
| Proposed layouts | [Proposed mobile layouts](#proposed-mobile-layouts) |
| Sticky safety rules | [Sticky action safety rules](#sticky-action-safety-rules) |
| Status badges | [Status badge improvements](#status-badge-improvements) |
| Empty states | [Empty states](#empty-states) |
| Phased plan | [Phased implementation plan](#phased-implementation-plan) |
| Tests | [Tests](#tests) |
| Final recommendation | [Final recommendation](#final-recommendation) |
| Design Q1–Q10 | [Design question answers](#design-question-answers) |
