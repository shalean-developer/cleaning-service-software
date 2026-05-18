# Stage 7P — Full App UX/UI Polish Audit

**Date:** 2026-05-18  
**Type:** Audit only — no code changes  
**Scope:** All dashboard surfaces (customer, cleaner, admin), booking wizard, payment return pages, shared dashboard components  
**Out of scope:** Business logic, lifecycle, payment, assignment, notification, RLS, cron, command behavior, routes, APIs, branding redesign

**Related:** [stage-6-stabilization-audit.md](./stage-6-stabilization-audit.md), [stage-6f-cleaner-mobile-polish-mini-audit.md](./stage-6f-cleaner-mobile-polish-mini-audit.md), [stage-7a-operational-queue-intelligence-final-audit.md](./stage-7a-operational-queue-intelligence-final-audit.md), [stage-7b-assignment-analytics-consolidation-final-audit.md](./stage-7b-assignment-analytics-consolidation-final-audit.md)

---

## 1. Executive summary

The app is **functionally coherent** and shares a consistent visual language (`zinc` palette, `rounded-xl` cards, `StatusBadge`, `DashboardShell`). Stage 6 and 7A–7B added operational intelligence and analytics that are **correct but visually heavy** — especially admin surfaces.

| Area | Verdict |
|------|---------|
| Customer core flows | **Good structure** — list/detail patterns work; copy stacks on list cards |
| Booking wizard | **Usable** — clear steps; 7-step stepper and checkout safety copy feel heavy on mobile |
| Cleaner surfaces | **Strongest mobile polish** (6F) — offers/jobs are reference quality; home still has duplicate error UX |
| Admin home + bookings | **Highest density** — queue strip + explain grid + guidance duplicates Stage 7A content |
| Admin booking detail | **Longest page** — 9+ stacked sections; ops panel repeats queue guidance |
| Admin notifications + analytics | **Ops/dev audience** — appropriate content but needs collapsible sections and shared metric primitives |
| Shared components | **Small set, inconsistent use** — `EmptyState`/`DashboardFetchError` padding; admin payouts still uses raw error `<p>` |
| Badge vocabulary | **Mostly centralized** in `statusLabels.ts` — customer list shows redundant badge + message pairs |

**Overall:** Safe to polish without touching business logic. Highest ROI is **reducing duplicate explanatory layers** on admin home/bookings and **compacting customer list cards**, not rebuilding components.

**Recommendation:** Start with **7P-1 (dashboard density + copy reduction)** on customer bookings list + admin home queue explain grid collapse — visible wins, low regression risk.

---

## 2. Top 10 UX issues

| # | Issue | Surfaces | Severity | Primary fix type |
|---|--------|----------|----------|------------------|
| 1 | **Admin home triple-explains queues** — strip labels + 5-card “Queue guide” grid + preview footnote repeat the same concepts | Admin home | High | Layout simplification + copy reduction |
| 2 | **Admin booking detail scroll fatigue** — 9+ full-width `p-6` cards (payments, events, audit, ops, notifications, lifecycle) | Admin booking detail | High | Layout simplification (collapse / tabs) |
| 3 | **Customer bookings list over-messages** — up to 3 badges + sky message + payment-failed line + cleaner line per card | Customer bookings | High | Copy reduction + card density |
| 4 | **Admin notifications page stacks 7+ panels** before the outbox table | Admin notifications | High | Layout simplification |
| 5 | **Assignment analytics repeats methodology** in every section header | Admin assignment analytics | Medium | Copy reduction |
| 6 | **Booking wizard 7-step stepper** truncates on narrow screens; details step is long | Booking wizard | Medium | Mobile polish + layout |
| 7 | **Duplicate CTAs** — “Book a clean” on customer home above list + empty state CTA; payment failed has 3 links | Customer home, payment failed | Medium | Copy reduction |
| 8 | **Cleaner home duplicate fetch errors** — summary card hint + full `DashboardFetchError` block for same failure | Cleaner home | Medium | Layout simplification |
| 9 | **Admin nav wraps 6 items** with no active state — hard to scan on mobile | Dashboard shell (admin) | Medium | Mobile polish |
| 10 | **Inconsistent error presentation** — `DashboardFetchError` on most pages; admin payouts uses plain red `<p>` | Admin payouts | Low | Component standardization |

---

## 3. Page-by-page audit table

Classification key: **G** Good as-is · **SP** Small polish · **LS** Layout simplification · **CR** Copy reduction · **MP** Mobile polish · **R** Risky to touch

| # | Surface | Classifications | Notes |
|---|---------|---------------|-------|
| 1 | Customer dashboard (`/customer`) | SP, CR | Duplicate “Book a clean” CTA (header area + empty state). Recent cards omit assignment message (good) but show booking + payment badges. Subtitle repeats nav purpose. |
| 2 | Customer bookings list | LS, CR, MP | Richest copy stack: badges + `assignmentCustomerMessage` + payment-failed line. Cards are list links — keep compact. |
| 3 | Customer booking detail | LS, CR | Main card + `PaymentIssuePanel` + Payments section + Lifecycle — payments list redundant with badges for customers. Lifecycle useful but low in scroll order. |
| 4 | Booking wizard (`/customer/book`) | LS, MP, CR | Standalone layout (no shell) — good. Checkout safety copy necessary but verbose. Details step long (addons checklist). |
| 5 | Payment success | G, SP | Minimal verifier UI; auto-redirect. Error state adequate. |
| 6 | Payment failed | CR | Four text blocks + 3 CTAs + support footer in one card — compact safely. |
| 7 | Cleaner home | LS, SP | Summary grid good. Duplicate error UX (inline + `DashboardFetchError`). Preview lists mirror offers/jobs pages. |
| 8 | Cleaner offers | G, SP | `CleanerOfferCard` + sections — 6F reference. Past offers could collapse by default at scale. |
| 9 | Cleaner jobs list | G | Clean list cards; consistent badges. |
| 10 | Cleaner job detail | LS, SP | Earnings + lifecycle cards — lifecycle uses admin-style labels per 6F partial note. `JobCompletionActions` — R adjacent. |
| 11 | Cleaner earnings | G, SP | Matches jobs pattern. Duplicate payout badge + amount styling. |
| 12 | Admin home | LS, CR | Queue strip + explain grid + preview text + two lists — densest page. |
| 13 | Admin bookings list | LS, CR, MP | Queue strip (+ context card when filtered). Up to 4 badges per row. Filters card is large but functional. |
| 14 | Admin booking detail | LS, CR, R | Ops panel + many audit sections — **R** for action components (`AdminRecoverAssignmentAction`, etc.). |
| 15 | Admin assignments | LS, CR | Queue strip again + per-item `AdminAssignmentQueueGuidance` (repeats detail ops). Cards use `p-5`. |
| 16 | Admin notifications | LS, CR | Very long; retention dry-run + analytics before operational table. |
| 17 | Admin assignment analytics | LS, CR | Four sections, duplicated `MetricCard` pattern, long footnotes. Read-only — safe to collapse. |
| 18 | Dashboard shell / nav | MP, SP | `max-w-5xl`, `py-8` main, no active nav, admin 6-link wrap. Booking wizard intentionally separate. |
| 19 | Shared: cards, badges, alerts | SP | `EmptyState`/`DashboardFetchError` use `py-12` — large for inline list context. |
| 20 | Shared: skeletons | G | `DashboardPageSkeleton` matches shell; good coverage on key routes. |

---

## 4. Booking flow detailed audit

### Structure (7 steps)

`service → datetime → location → details → cleaner → review → checkout`

| Step | Weight | Issues | Recommendations |
|------|--------|--------|-----------------|
| **Service** | Light | Service descriptions on every option add height | Keep descriptions; consider single-line subtitle on mobile |
| **Date & time** | Light | SAST note is helpful, always visible | Keep; optional tooltip on desktop |
| **Location** | Medium | 4 fields + optional notes — standard | Good |
| **Details** | **Heavy** | Bedrooms/bathrooms OR sqm + frequency + 6 addon checkboxes + instructions | Collapse addons behind “Add extras”; default frequency less prominent |
| **Cleaner** | Medium | Long list in `max-h-64` scroll; eligibility reason per row | Show top 3 + “See all”; shorten `eligibilityReason` display strings |
| **Review** | Medium | Full DL + line items + checkbox | Sticky mini-summary on mobile; line items collapsible if >4 |
| **Checkout** | Medium | **Important safety copy** (pending payment, browser never confirms) — do not remove meaning | Compress to 2 lines + link “How payment works”; keep `reviewConfirmed` gate |

### Chrome

| Element | File | Assessment |
|---------|------|------------|
| `WizardStepper` | `WizardStepper.tsx` | 7 equal-width chips — crowded &lt;360px; labels truncate (“Date & time”) |
| `WizardNav` | `WizardNav.tsx` | Fixed bottom area with `pb-24` on container — good thumb reach |
| Error alert | `BookingWizard.tsx` | Red banner — consistent |
| No dashboard nav | `book/page.tsx` | Correct — reduces distraction |

### Confusing / heavy moments

1. **Review → Checkout** is a separate step but review already shows total — users may wonder why checkout exists (payment explanation step).
2. **Cleaner fetch** on `details → cleaner` and `cleaner` step can show loading twice — feels slow, not confusing.
3. **Quote refresh** errors return user to review — message is long; shorten in 7P-2.

### Booking flow classifications

- **Good as-is:** Step order, Paystack redirect, validation, storage hydration
- **Needs layout simplification:** Details addons, review line items
- **Needs copy reduction:** Checkout pending-payment paragraph (compact, not remove)
- **Needs mobile polish:** Stepper (progress dots or “Step 3 of 7” text), details/addons
- **Risky to touch:** `handleCheckout`, lock/idempotency, `validateWizardStep`, API payloads

---

## 5. Dashboard density audit

### Padding and card size patterns

| Pattern | Typical classes | Where overused |
|---------|-----------------|----------------|
| List link card | `p-4`, `rounded-xl` | All roles — appropriate |
| Detail section card | `p-6`, `mt-6` | Customer/cleaner/admin detail — stacks vertically |
| Empty / error | `px-6 py-12` | `EmptyState`, `DashboardFetchError` — tall when nested |
| Admin ops card | `p-5`–`p-6` | Assignments queue items, explain cards |
| Metric card | `p-3` | Analytics — appropriate |

### Pages ranked by vertical density (worst first)

1. **Admin booking detail** — ~10 sections × (`mt-6` + `p-6`)
2. **Admin notifications** — banner + 5 panels + filters + table
3. **Admin home** — strip + 5 explain cards (3-col grid) + lists
4. **Admin assignment analytics** — 4 section blocks with grids
5. **Customer bookings list** — verbose cards, not tall page but noisy
6. **Admin assignments** — strip + footnote + large queue cards with guidance embed

### Density recommendations (no logic change)

| Change | Effect |
|--------|--------|
| Collapse admin explain grid by default (“Show queue guide”) | −40% admin home height |
| Use `p-4` on admin detail secondary sections | Tighter scroll |
| `<details>` for State audit, Payment events, Admin operations on detail | Ops-only content hidden until needed |
| Compact `EmptyState` variant (`py-8`) for list pages | Less whitespace when empty |
| Customer list: single status line instead of 3 badges | Major visual quiet |

---

## 6. Copy reduction opportunities

| Location | Current problem | Suggested compact form | Safety |
|----------|-----------------|------------------------|--------|
| `DashboardShell` subtitles | Repeat page purpose (“payments, assignment…”) | Drop subtitle on list pages; keep on detail only | Safe |
| Customer bookings card | Badge “Needs assignment” + sky paragraph | Keep message only, or badge only | Safe — same data |
| Customer bookings card | “Payment incomplete — no cleaner assigned…” | Only when no badge already says payment failed | Safe |
| `PaymentIssuePanel` | Title + body + third line about cleaner | Merge body + assignment into one sentence | Keep retry CTA |
| Payment failed page | `body` + `assignmentNote` + `retryGuidance` | Single body + bullet list (2 items) | Keep support note shorter |
| Checkout step | 3-sentence Paystack explanation | “Pay via Paystack. Booking stays **awaiting payment** until confirmed.” | **Must** retain pending-payment meaning |
| Admin queue strip | Title + subtitle lines | Single line: “Queues (read-only) — tap to filter” | Safe |
| Admin explain cards | whyHere bullets (3) + recommendedAction paragraph | Collapsed: summary + one action line; expand for why | Safe |
| `AdminOperationalStatusPanel` | Intro + 6-row DL + 4 bullet flags | Collapse bullets; show only `nextSuggestedAction` + actions | Safe for ops if runbook link kept |
| `AdminAssignmentQueueGuidance` | Repeats ops flags on every queue row | Link “View ops on booking” only | Safe |
| Analytics section intros | Repeated “read-only / does not change behavior” | Once at page top | Safe |
| Admin booking detail notifications | Preamble about no email / no retry | Move to page-level footnote | Safe |

### Duplicate CTAs to dedupe

| Page | CTAs | Suggestion |
|------|------|------------|
| Customer home | “Book a clean” button + empty state button | One primary in header OR in empty state only |
| Payment failed | View booking + My bookings + New booking | Primary + one secondary link |
| Customer payment issue | Retry + Start new booking | Keep both; style secondary as link only |

---

## 7. Mobile polish opportunities

| Area | Issue | Recommendation | Files |
|------|-------|----------------|-------|
| **Admin nav** | 6 links wrap; no active route | `overflow-x-auto` nav row; optional `aria-current="page"` | `DashboardShell.tsx`, layouts |
| **Wizard stepper** | 7 chips truncate | Mobile: “Step N of 7” + current label; desktop: full stepper | `WizardStepper.tsx` |
| **Wizard details** | Addon list long scroll | Accordion “Add-ons (optional)” | `BookingWizard.tsx` |
| **Admin queue strip** | Horizontal scroll exists — good | Slightly narrower chips (`min-w-[8.5rem]`) | `AdminOperationalQueueStrip.tsx` |
| **Admin filters** | Form wraps but tall | Stack submit row full-width on `sm` | `AdminBookingsFilters.tsx` |
| **Cleaner offers** | Already `min-h-11` actions (6F) | Past offers: default collapsed section | `offers/page.tsx` |
| **Touch targets** | Shell nav `min-h-10` — OK | Keep ≥44px on primary CTAs | `DashboardShell.tsx` |
| **Main padding** | `py-8` generous on small screens | `py-6 sm:py-8` | `DashboardShell.tsx` |
| **Booking wizard** | `max-w-lg` good | Ensure inputs `text-base` (iOS zoom) — verify `Field.tsx` | `Field.tsx` |

### Loading coverage gaps (polish, not blockers)

Missing `loading.tsx`: admin home, assignments, notifications, analytics, cleaner home/earnings, customer book. Existing skeletons on high-traffic routes are good.

---

## 8. Badge/status consistency findings

### Centralization (good)

- `StatusBadge` + `statusLabels.ts` — single tone map
- Customer-specific: `labelForCustomerBookingStatus` (payment_failed variants, maps `payout_ready`/`paid_out` → “Completed”)
- Cleaner jobs: `labelForCleanerJobStatus` (“Scheduled”, “Paid”, etc.)
- Admin assignment: `labelForAssignmentAttention` + `assignmentVisibilityKey` on list/detail (aligned since Stage 6)

### Inconsistencies

| Finding | Where | Recommendation |
|---------|-------|----------------|
| Customer home shows **booking + payment** badges; list adds **assignment** badge | home vs bookings | Align: home preview uses same rules as list OR list drops redundant payment badge when status implies it |
| **Payment failed** hides payment badge on list/detail (good) but customer may still see “Awaiting payment” on old rows | edge cases | Keep current rule |
| Cleaner **lifecycle** may show `labelForBookingStatus` for some audit rows | job detail timeline | Use `humanAuditStatusTitle` with cleaner audience consistently (6F partial) |
| Operational queue cards use **severity badge** + queue tone border — two systems | explain cards | OK for ops; don’t mix into customer/cleaner |
| `OfferExpiryChip` vs `StatusBadge` for expiry | offers | Good separation |
| Admin notifications uses **custom rounded pills** for pressure/dry-run | analytics panel | Extract `OpsChip` or extend `StatusBadge` variants for visual parity |

### Badge count limits (recommended policy)

| Surface | Max badges visible | Priority order |
|---------|-------------------|----------------|
| Customer list card | 1–2 | Booking status → assignment (if warning) |
| Admin list card | 3 | Booking → assignment/payment attention → payment (if not failed) |
| Detail headers | 3 | Same as list + payment attention when failed |

---

## 9. Components to standardize

| Component | Current state | Standardization opportunity |
|-----------|---------------|----------------------------|
| `DashboardShell` | Title, optional subtitle, flat nav | Add `compact` prop (less padding), optional `activeHref`, mobile scroll nav |
| `EmptyState` | One size (`py-12`) | Variants: `compact` (lists), `hero` (standalone) |
| `DashboardFetchError` | Matches EmptyState size | Share compact variant; add optional retry slot (presentation only) |
| `StatusBadge` | Solid | Optional `size="sm"` for list cards |
| **MetricCard** | Duplicated in `AdminAssignmentAnalyticsPanel`, `AdminNotificationAnalyticsPanel`, retention panel | Extract `DashboardMetricCard` in `components/dashboard/` |
| **SectionCard** | Ad-hoc `rounded-xl border p-6` | `DashboardSection` with `title`, `description?`, `collapsible?`, `defaultOpen?` |
| **PageHeader** | Shell title + back link pattern repeated | `DashboardBackLink` + consistent `mt-6` first card |
| **ListCard** | Copy-pasted `Link` + badges block | `BookingListCard` / `DashboardListLink` for customer/admin/cleaner |
| Error states | Most use `DashboardFetchError` | Migrate admin payouts to same component |
| Ops banners | Red/amber/sky one-offs | `DashboardCallout` tone variants (payment, assignment, ops) |

### Components — risky to touch in polish

- `OfferActions`, `DeclineOfferConfirmSheet` — mutation wiring
- `RetryPaymentButton` — payment command
- `AdminRecoverAssignmentAction`, `AdminManualDispatchAction`, `AdminReplaceOpenOfferAction` — commands
- `JobCompletionActions` — completion command
- `AdminNotificationRequeueAction` — requeue governance

Polish **labels and layout around** these; do not change handlers or eligibility checks.

---

## 10. Safe phased roadmap

### 7P-1: Dashboard density + copy reduction

**Goal:** Remove duplicate explanatory layers; compact list cards.

| Item | Problem | Improvement | Files likely touched | Risk | Logic? | Tests |
|------|---------|-------------|----------------------|------|--------|-------|
| Admin home explain grid | Triple queue explanation | Default collapsed “Queue guide”; strip-only by default | `admin/page.tsx`, `AdminOperationalQueueExplainGrid.tsx` | Low | No | Visual/manual; optional snapshot |
| Customer bookings list | Badge + message redundancy | One status surface per card | `customer/bookings/page.tsx` | Low | No | Extend customer display tests if any |
| Shell subtitles | Noise | Remove or shorten subtitles on list pages | `*/page.tsx` using `DashboardShell` | Low | No | None |
| Compact EmptyState | Tall empty areas | `compact` variant | `EmptyState.tsx`, call sites | Low | No | `EmptyState` unit test |
| Admin payouts error | Inconsistent | Use `DashboardFetchError` | `admin/payouts/page.tsx` | Low | No | Existing pattern |

### 7P-2: Booking flow visual polish

| Item | Problem | Improvement | Files | Risk | Logic? | Tests |
|------|---------|-------------|-------|------|--------|-------|
| Stepper mobile | 7 cramped chips | Step N of 7 + label | `WizardStepper.tsx` | Low | No | Wizard navigation tests |
| Details addons | Long scroll | Accordion | `BookingWizard.tsx` | Low | No | Manual |
| Checkout copy | Verbose | Compact safe copy | `BookingWizard.tsx` | Med | No | Payment safety copy review |
| API error strings | Long | Shorter display strings only | `BookingWizard.tsx` | Low | No | Existing wizard tests |

### 7P-3: Customer dashboard polish

| Item | Problem | Improvement | Files | Risk | Logic? | Tests |
|------|---------|-------------|-------|------|--------|-------|
| Home CTA dup | Two “Book a clean” | Single primary CTA | `customer/page.tsx` | Low | No | None |
| Detail payments section | Redundant for users | Collapse or merge into main card | `bookings/[bookingId]/page.tsx` | Med | No | Manual |
| Payment failed page | 4 paragraphs | Compact layout | `PaymentFailedPageContent.tsx`, copy constants | Med | No | `PaymentFailedPageContent.test.tsx` |
| Payment issue panel | Repeated lines | Merge copy | `PaymentIssuePanel.tsx`, `paymentFailureDisplay.ts` | Med | No | payment failure display tests |

### 7P-4: Cleaner dashboard polish

| Item | Problem | Improvement | Files | Risk | Logic? | Tests |
|------|---------|-------------|-------|------|--------|-------|
| Home duplicate errors | Inline + full error | One error presentation | `cleaner/page.tsx` | Low | No | `cleanerPagesStage6f1b.test.ts` |
| Past offers always open | Scroll at volume | Collapsed past section | `offers/page.tsx` | Low | No | `cleanerPagesStage6f2a.test.ts` |
| Job detail lifecycle labels | Admin-ish wording | Cleaner audience titles | `lifecycleTimelinePresentation.ts` | Low | No | Timeline presentation tests |
| Earnings card density | Large amount + badge | Tighter row layout | `earnings/page.tsx` | Low | No | None |

### 7P-5: Admin dashboard polish

| Item | Problem | Improvement | Files | Risk | Logic? | Tests |
|------|---------|-------------|-------|------|--------|-------|
| Booking detail sections | 9+ cards | Collapsible audit/events/ops | `admin/bookings/[bookingId]/page.tsx` | Med | No | Admin page smoke |
| Ops panel verbosity | Repeats queue guidance | Compact summary + actions | `AdminOperationalStatusPanel.tsx` | Med | No | `AdminOperationalStatusPanel.test.tsx` |
| Assignments queue cards | Heavy per row | Shorter guidance block | `AdminAssignmentQueueGuidance.tsx`, `assignments/page.tsx` | Low | No | Existing assignment tests |
| Notifications stack | Overwhelming | Collapse analytics/dry-run | `notifications/page.tsx`, panel components | Med | No | Notification panel tests |
| Assignment analytics | Long page | Section `<details>` defaults | `AdminAssignmentAnalyticsPanel.tsx` | Low | No | `AdminAssignmentAnalyticsPanel.test.tsx` |

### 7P-6: Shared components standardization

| Item | Problem | Improvement | Files | Risk | Logic? | Tests |
|------|---------|-------------|-------|------|--------|-------|
| MetricCard DRY | 3 copies | `DashboardMetricCard` | New + analytics panels | Low | No | Existing panel tests |
| SectionCard | Repeated borders | `DashboardSection` collapsible | New + detail pages | Med | No | Component tests |
| ListCard | Duplicated markup | Shared list link card | New + list pages | Med | No | Snapshot/style tests |
| Shell nav active state | Wayfinding | `aria-current` | `DashboardShell.tsx` | Low | No | None |
| Callout component | Ad-hoc colored boxes | Unified callouts | Payment/ops panels | Low | No | None |

---

## Recommendations with full template (highest-impact subset)

### R1 — Collapse admin queue guide on home

| Field | Value |
|-------|-------|
| **Current problem** | Strip + 5 explain cards + preview text teach the same queues |
| **Suggested improvement** | Show strip + lists by default; “Queue guide (5)” expands explain grid |
| **Files likely touched** | `src/app/(admin)/admin/page.tsx`, `AdminOperationalQueueExplainGrid.tsx` |
| **Risk level** | Low |
| **Logic affected?** | No |
| **Tests required** | Manual admin home; optional component test for collapsed default |

### R2 — Customer bookings list single status surface

| Field | Value |
|-------|-------|
| **Current problem** | Up to 3 badges + colored paragraph per card |
| **Suggested improvement** | Primary `StatusBadge` + optional one line (`assignmentCustomerMessage` OR cleaner name) |
| **Files likely touched** | `src/app/(customer)/customer/bookings/page.tsx` |
| **Risk level** | Low |
| **Logic affected?** | No — display only |
| **Tests required** | Visual check; booking display unit tests if assertions on DOM |

### R3 — Compact payment-safety copy (wizard checkout)

| Field | Value |
|-------|-------|
| **Current problem** | Checkout step feels legalistic / long |
| **Suggested improvement** | 2 lines: Paystack redirect + pending until confirmed (bold status term) |
| **Files likely touched** | `src/features/booking-wizard/components/BookingWizard.tsx` |
| **Risk level** | Medium (wording review) |
| **Logic affected?** | No |
| **Tests required** | Product review; no API tests |

### R4 — Admin booking detail collapsible secondary sections

| Field | Value |
|-------|-------|
| **Current problem** | State audit + payment events + admin ops timeline rarely needed first |
| **Suggested improvement** | `<details>` closed by default with counts in summary |
| **Files likely touched** | `src/app/(admin)/admin/bookings/[bookingId]/page.tsx` |
| **Risk level** | Medium (ops workflow) |
| **Logic affected?** | No |
| **Tests required** | Manual ops smoke; ensure actions remain outside collapsed regions |

### R5 — Extract `DashboardMetricCard`

| Field | Value |
|-------|-------|
| **Current problem** | Metric card markup duplicated 3× |
| **Suggested improvement** | Shared component; same visuals |
| **Files likely touched** | New `DashboardMetricCard.tsx`, analytics panels |
| **Risk level** | Low |
| **Logic affected?** | No |
| **Tests required** | Existing `AdminAssignmentAnalyticsPanel.test.tsx`, notification panel tests |

---

## Final question: Safest first polish slice?

**Safest first slice with visible improvement:** **7P-1 subset — customer bookings list card compaction (R2) + admin home queue guide collapse (R1).**

Why this slice:

1. **Display-only** — no commands, APIs, or eligibility changes.
2. **High visibility** — every customer sees bookings list; admins see home daily.
3. **Low regression surface** — smaller diff than booking wizard or admin detail collapses.
4. **Aligns with Stage 6/7 work** — reduces duplication introduced by 7A explainability, not fighting it.
5. **Easy verification** — manual pass on mobile + existing `npm run typecheck` / targeted tests.

**Second quick win (same PR or follow-up):** `EmptyState` compact variant + admin payouts `DashboardFetchError` — completes error/empty consistency from Stage 6.

**Defer first:** Booking wizard checkout copy (needs product safety review) and admin booking detail collapsibles (ops workflow validation).

---

## Appendix: File inventory by surface

| Surface | Primary files |
|---------|----------------|
| Shell | `src/components/dashboard/DashboardShell.tsx` |
| Customer | `src/app/(customer)/customer/page.tsx`, `bookings/page.tsx`, `bookings/[bookingId]/page.tsx` |
| Wizard | `src/features/booking-wizard/components/BookingWizard.tsx`, `WizardStepper.tsx`, `WizardNav.tsx` |
| Payment | `src/app/payment/success/PaymentSuccessVerifier.tsx`, `payment/failed/PaymentFailedPageContent.tsx` |
| Cleaner | `src/app/(cleaner)/cleaner/page.tsx`, `offers/page.tsx`, `jobs/page.tsx`, `jobs/[bookingId]/page.tsx`, `earnings/page.tsx` |
| Admin | `src/app/(admin)/admin/page.tsx`, `bookings/page.tsx`, `bookings/[bookingId]/page.tsx`, `assignments/page.tsx`, `notifications/page.tsx`, `analytics/assignments/page.tsx` |
| Shared | `EmptyState.tsx`, `DashboardFetchError.tsx`, `StatusBadge.tsx`, `DashboardPageSkeleton.tsx`, `PaymentIssuePanel.tsx`, `LifecycleTimeline.tsx` |
| Labels | `src/features/bookings/server/statusLabels.ts`, `paymentFailureDisplay.ts` |

---

*End of audit — implementation not started per Stage 7P scope.*
