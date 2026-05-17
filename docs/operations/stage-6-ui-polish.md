# Stage 6 — UI polish (presentation-only)

Operational reference for Stage 6 UX improvements. Architecture design: [stage-6-safe-ux-ui-improvements-design.md](../architecture/stage-6-safe-ux-ui-improvements-design.md).

## Presentation-only guarantee

Stage 6 does **not** change:

- Booking lifecycle or status values in the database
- Payment commands, retry eligibility, or Paystack integration
- Assignment dispatch, recovery, or offer logic
- Notification worker, enqueue, or requeue
- RLS policies
- Earnings or cron behavior
- Command architecture or API mutation behavior

Changes are limited to UI components, copy, layout, `loading.tsx`, and read-model **display** shaping (timeline labels, customer status labels).

---

## Stage 6A-1 — Presentation primitives pack (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| `DashboardPageSkeleton` | List + detail variants; `role="status"`, `aria-busy`, sr-only loading text |
| Route `loading.tsx` | `/admin/bookings`, `/admin/bookings/[bookingId]`, `/customer`, `/customer/bookings`, `/customer/bookings/[bookingId]`, `/cleaner/offers`, `/cleaner/jobs`, `/cleaner/jobs/[bookingId]` |
| Humanized timelines | Customer/cleaner audiences hide raw `audit.command`; human payment/audit titles |
| Customer payout labels | `payout_ready` / `paid_out` → **Completed** (display only) |
| Empty / error states | Customer home + bookings empty; bookings fetch error vs empty; admin filtered empty + clear link |
| Payment failed badges | Customer booking detail hides duplicate payment status badge when `payment_failed`; `PaymentIssuePanel` unchanged |

### Routes touched

- `src/app/(admin)/admin/bookings/page.tsx`
- `src/app/(admin)/admin/bookings/loading.tsx`
- `src/app/(admin)/admin/bookings/[bookingId]/loading.tsx`
- `src/app/(customer)/customer/page.tsx`
- `src/app/(customer)/customer/bookings/page.tsx`
- `src/app/(customer)/customer/bookings/loading.tsx`
- `src/app/(customer)/customer/bookings/[bookingId]/page.tsx`
- `src/app/(customer)/customer/bookings/[bookingId]/loading.tsx`
- `src/app/(cleaner)/cleaner/offers/loading.tsx`
- `src/app/(cleaner)/cleaner/jobs/loading.tsx`
- `src/app/(cleaner)/cleaner/jobs/[bookingId]/loading.tsx`

### Key modules

| Module | Path |
|--------|------|
| Skeleton | `src/components/dashboard/DashboardPageSkeleton.tsx` |
| Fetch error | `src/components/dashboard/DashboardFetchError.tsx` |
| Timeline builder | `src/features/dashboards/server/lifecycleTimeline.ts` |
| Timeline presentation | `src/features/dashboards/server/lifecycleTimelinePresentation.ts` |
| Customer labels | `src/features/bookings/server/paymentFailureDisplay.ts` |

### Tests

- `lifecycleTimeline.test.ts` — audience presentation, no command leakage
- `lifecycleTimelinePresentation.test.ts` — human command/payment labels
- `paymentFailureDisplay.test.ts` — customer Completed labels
- `DashboardPageSkeleton.test.tsx` — accessible loading
- `DashboardFetchError.test.tsx` — distinct from empty state

---

## Stage 6D-1 — Mount operational status panel (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| Page wiring | `AdminOperationalStatusPanel` on `/admin/bookings/[bookingId]` immediately after summary card |
| Data | `bookingId={b.id}` and `operational={b.operational}` from existing `getAdminBookingDetail` |
| Actions | Recover / manual dispatch / replace use existing child components and eligibility flags only |
| Backend | No API, RLS, command, or read-model logic changes |

### Routes touched

- `src/app/(admin)/admin/bookings/[bookingId]/page.tsx`

### Tests

- `AdminOperationalStatusPanel.test.tsx` — panel shell and eligibility-gated actions
- `adminBookingDetailOperationalPanel.test.ts` — static mount guard on booking detail page

---

## Stage 6B — Payment failed page redesign (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| Layout | Calm red warning card aligned with booking-detail `PaymentIssuePanel` |
| Copy | Reuses `paymentIssuePanelCopy`, `normalizePaymentFailureReasonParam` — `checkout_expired`, `paystack_declined`, generic |
| Guidance | Assignment note, retry-on-detail guidance, support note — no new retry logic on this page |
| Booking link | `bookingId` / `booking` / UUID-shaped `reference` → **View booking to retry payment** → `/customer/bookings/[id]` |
| Fallback | **Go to my bookings** primary when no safe booking id; **Start a new booking** secondary |
| Safety | Unknown `reason` query values are ignored (never shown raw); no Paystack/API calls from page |

### Routes / modules

- `src/app/payment/failed/page.tsx`
- `src/app/payment/failed/PaymentFailedPageContent.tsx`
- `src/lib/app/paymentFailedPage.ts`
- `src/features/bookings/server/paymentFailureDisplay.ts` (paystack copy + reason normalizer)

### Tests

- `paymentFailedPage.test.ts`
- `PaymentFailedPageContent.test.tsx`
- `paymentFailedPage.static.test.ts`
- `paymentFailureDisplay.test.ts` (paystack + normalizer)

Retry eligibility and Paystack initialize/verify are **unchanged** — retry still runs only from booking detail when eligible.

---

## Stage 6C-1 — Server-side admin booking filters (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| SQL filters (before LIMIT 200) | `payment_failed`, `pending_assignment`, schedule `from` / `to` on `scheduled_start` (UTC inclusive end date) |
| Count contract | `matchTotal`, `returnedCount`, `capped`; `subsetFiltered` when assignment presets or `q` still refine in memory |
| API | `GET /api/admin/bookings` forwards `filter`, `from`, `to` (and accepts `q` — search still deferred) |
| Footer | Honest copy — e.g. “Showing 200 of 482 matching bookings (newest 200 by last update)” |
| Unchanged | Admin home summary cards, lifecycle/payment/assignment commands, RLS, mutations |

### Modules

| Module | Path |
|--------|------|
| SQL filter builder | `src/features/dashboards/server/adminBookingsListQuery.ts` |
| Read model | `src/features/dashboards/server/adminOperationsReadModel.ts` |
| Footer copy | `src/components/dashboard/AdminBookingsFilters.tsx` |
| List API | `src/app/api/admin/bookings/route.ts` |

## Stage 6C-2 — Server-side admin booking search (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| `q` search (min 3 chars) | Booking ID prefix, `customers.company_name`, `payments.provider_ref` |
| SQL before cap | Combined with 6C-1 `filter` + schedule `from`/`to` |
| Count contract | Honest `matchTotal` / `returnedCount` / `capped` when search is server-side |
| Safety | Parameterized Supabase filters only; no email search; RLS unchanged |

### Modules

| Module | Path |
|--------|------|
| Search SQL | `src/features/dashboards/server/adminBookingsListQuery.ts` (`resolveAdminBookingsSearchSql`) |
| Read model | `src/features/dashboards/server/adminOperationsReadModel.ts` |
| API | `src/app/api/admin/bookings/route.ts` (forwards `q`) |

## Stage 6C-3a — Server-side assignment filters: max_attempts + selected_declined (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| SQL filters (before LIMIT 200) | `filter=max_attempts`, `filter=selected_declined` via `bookings.metadata.assignment` (+ declined-offer booking ids for parity) |
| Count contract | Exact `matchTotal` / `returnedCount` / `capped`; no `subsetFiltered` for these presets |
| Combines with | 6C-1 status/dates and 6C-2 `q` search |
| Unchanged | Assignment engine, recovery/dispatch commands, RLS, mutations, indexes |

### Modules

| Module | Path |
|--------|------|
| Assignment SQL | `src/features/dashboards/server/adminAssignmentFilterSql.ts` |
| Wiring | `adminBookingsListQuery.ts`, `adminOperationsReadModel.ts` |

## Stage 6C-3b — Server-side assignment filter: dispatch_not_started (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| SQL filter (before LIMIT 200) | `filter=dispatch_not_started` — metadata reason ILIKE + recovery-candidate booking ids (paid past grace, no open/accepted offers) |
| Count contract | Exact `matchTotal` / `returnedCount` / `capped`; no `subsetFiltered` |
| Combines with | 6C-1 status/dates, 6C-2 `q`, 6C-3a presets (mutually exclusive filter param) |
| Unchanged | Assignment engine, recovery/dispatch commands, RLS, indexes/migrations |

### Modules

| Module | Path |
|--------|------|
| Assignment SQL | `src/features/dashboards/server/adminAssignmentFilterSql.ts` |
| Design | `docs/architecture/stage-6c-3b-dispatch-not-started-server-filter-design.md` |

### Tests (6C-3b)

- `adminAssignmentFilterSql.test.ts` (dispatch parity matrix, `buildRecoveryCandidateBookingIds`)
- `adminOperationsReadModel.test.ts` (SQL before limit, outside top-200, combined `q` + dates)
- `adminBookingsListQuery.test.ts` (classification)
- `src/app/api/admin/bookings/route.test.ts` (passthrough)

## Stage 6C-3c — Server-side assignment filter: recovery_needed (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| SQL filter (before LIMIT 200) | `filter=recovery_needed` — **same predicate bundle as** `dispatch_not_started` (`applyDispatchOrRecoveryNeededFilterSql`) |
| Count contract | Exact `matchTotal` / `returnedCount` / `capped`; no `subsetFiltered` |
| Combines with | 6C-1/2 filters and 6C-3a presets (mutually exclusive `filter` param) |
| Unchanged | Recovery eligibility logic, assignment engine, RLS, indexes |

### Tests (6C-3c)

- `adminAssignmentFilterSql.test.ts` (equivalence with dispatch + `matchesAdminBookingFilter`)
- `adminOperationsReadModel.test.ts` (SQL before limit, same match set as dispatch)
- `adminBookingsListQuery.test.ts`, `route.test.ts`

## Stage 6C-3d — Server-side assignment filter: assignment_attention (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| SQL filter (before LIMIT 200) | `filter=assignment_attention` — composed OR: max_attempts + selected_declined + needs_assignment + confirmed metadata edge |
| Included visibility keys | `needs_assignment`, `selected_declined_admin`, `max_attempts_admin`; metadata `attention_required` when key is null |
| Excluded | `dispatch_not_started`, `recovery_needed`, `selected_expired_admin`, `decline_redispatched`, `finding_cleaner`, `offer_sent`, `payment_failed` |
| Pre-queries | Declined-offer booking ids + open-offer booking ids (open-offer exclusion for needs_assignment parity) |
| Count contract | Exact `matchTotal` / `returnedCount` / `capped`; no `subsetFiltered` |
| Parity | Golden tests passed — branches ≡ enrichment oracle ≡ `matchesAdminBookingFilter` |
| Unchanged | Assignment engine, recovery/dispatch commands, RLS, indexes/migrations, UI controls |

### Modules

| Module | Path |
|--------|------|
| Assignment SQL | `src/features/dashboards/server/adminAssignmentFilterSql.ts` |
| Design | `docs/architecture/stage-6c-3d-assignment-attention-server-filter-design.md` |

### Tests (6C-3d)

- `adminAssignmentFilterSql.test.ts` (golden parity matrix)
- `adminOperationsReadModel.test.ts` (SQL before limit, `q` + dates)
- `adminBookingsListQuery.test.ts` (`needsInMemoryRefinement` false, `hasHonestMatchTotal` true)

**All admin booking assignment dropdown presets are now server-side.**

### Deferred (post 6C-3d)

| Item | Stage |
|------|-------|
| Customer email in search | Deferred |
| Cursor pagination beyond export cap | 6E-3 |
| Admin home `matchTotal` beyond list cap | Out of 6C scope |

### Tests (6C-3a)

- `adminAssignmentFilterSql.test.ts` (parity golden fixtures)
- `adminOperationsReadModel.test.ts` (integration)
- `adminBookingsListQuery.test.ts` (classification)
- `src/app/api/admin/bookings/route.test.ts`

### Deferred (6C-3b+ search note)

| Item | Stage |
|------|-------|
| Customer email in search | Deferred |

### Tests

- `adminBookingsListQuery.test.ts`
- `adminOperationsReadModel.test.ts`
- `AdminBookingsFilters.test.tsx`
- `src/app/api/admin/bookings/route.test.ts`

### Tests (6C-2)

- `adminBookingsListQuery.test.ts` (search resolution, min length)
- `adminOperationsReadModel.test.ts` (search + combined filters)
- `src/app/api/admin/bookings/route.test.ts` (`q` passthrough)

---

## Stage 6E-1 — Admin booking CSV export (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| Route | `GET /api/admin/export/bookings.csv` (admin auth, GET only) |
| Filters | Same `filter`, `q`, `from`, `to` as 6C list (shared parser) |
| Cap | 500 rows, `updated_at DESC`; truncation headers when `matchTotal > 500` |
| Columns | Allowlisted ops fields only — no email, phone, raw metadata, audits |
| UI | “Export CSV” on `/admin/bookings` preserves current query params |
| Audit | Structured log only (`admin_bookings_csv_export`) |

### Modules

| Module | Path |
|--------|------|
| Export route | `src/app/api/admin/export/bookings.csv/route.ts` |
| CSV mapper | `src/features/dashboards/server/adminBookingsExport.ts` |
| Export read model | `exportAdminBookingsCsv` in `adminOperationsReadModel.ts` |

### Deferred (6E-2+)

| Item | Stage |
|------|-------|
| Rate limit (10/hour/admin) | 6E-2 |
| Durable DB audit | 6E-2 |
| 1000 cap / keyset full export | 6E-3 |

---

## Stage 6F-1a — Cleaner nav consistency + job status labels (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| Shared nav | `CLEANER_NAV_ITEMS` in `src/features/dashboards/cleanerNav.ts` — Home, Offers, Jobs, Earnings on every cleaner route |
| Routes | `/cleaner`, `/cleaner/offers`, `/cleaner/jobs`, `/cleaner/jobs/[bookingId]`, `/cleaner/earnings` |
| Cleaner job labels | `labelForCleanerJobStatus` / `toneForCleanerJobStatus` on job cards and job detail badge only (display-only) |
| Tap targets | Slightly larger nav link hit area in `DashboardShell` (`min-h-10`, `py-2`) |

### Display mapping (cleaner job surfaces only)

| Status | Cleaner label |
|--------|---------------|
| `assigned` | Scheduled |
| `pending_assignment` | Awaiting cleaner |
| `in_progress` | In progress |
| `completed` | Completed |
| `payout_ready` | Completed |
| `paid_out` | Paid |

Earnings page keeps `labelForPayoutStatus` for payout rows. Admin and customer labels unchanged.

### Deferred (6F-1b+)

| Item | Stage |
|------|-------|
| Sticky job/offer action bars | 6F-4 |
| Bottom mobile nav | 6F-5 |
| Decline confirmation sheet | 6F-2 |
| Jobs/offers section partitioning | 6F-2 / 6F-3 |
| Offer expiry chips | 6F-2 |

### Tests

- `src/features/dashboards/cleanerNav.test.ts`
- `src/features/bookings/server/statusLabels.test.ts`
- `src/app/(cleaner)/cleaner/cleanerPagesStage6f1a.test.ts`

### Verification

```bash
npm run typecheck
npm run test -- src/features/dashboards/cleanerNav.test.ts src/features/bookings/server/statusLabels.test.ts "src/app/(cleaner)/cleaner/cleanerPagesStage6f1a.test.ts"
```

---

## Stage 6F-1b — Cleaner empty/error states (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| Offers page | `!result.ok` → `DashboardFetchError`; zero offers → friendly empty copy (not conflated with errors) |
| Jobs page | Same pattern; empty copy updated; fetch failure no longer shows empty state |
| Home page | Summary cards show `—` + inline error hint when fetch fails; preview sections show `DashboardFetchError` instead of hiding failures as zero |
| Loading | Unchanged — route `loading.tsx` on offers/jobs (6A-1) |

### Empty copy

| Page | Title | Description |
|------|-------|-------------|
| Offers | No job offers right now | New offers will appear here when jobs are available. |
| Jobs | No jobs yet | Accepted jobs and active work will appear here. |

### Deferred (6F-2+)

| Item | Stage |
|------|-------|
| Earnings fetch error vs empty | Done in stabilization Phase 1 |
| Sticky job/offer action bars | 6F-4 |
| Bottom mobile nav | 6F-5 |
| Decline confirmation sheet | 6F-2 |
| Jobs/offers section partitioning | 6F-2 / 6F-3 |
| Offer expiry chips | 6F-2 |

### Tests

- `src/app/(cleaner)/cleaner/cleanerPagesStage6f1b.test.ts`

### Verification

```bash
npm run typecheck
npm run test -- "src/app/(cleaner)/cleaner/cleanerPagesStage6f1b.test.ts" "src/app/(cleaner)/cleaner/cleanerPagesStage6f1a.test.ts"
```

---

## Stage 6F-2a — Cleaner offers layout + expiry visibility (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| Expiry formatter | `formatOfferExpiryDisplay` — relative (“Respond within 2h/45m”), absolute `en-ZA`, urgency normal/warning/expired |
| Expiry chip | `OfferExpiryChip` in card header; warning &lt; 1h; `aria-label` includes absolute time |
| Partition | `partitionCleanerOffers` — needs response vs past; soonest `expiresAt` first |
| Card | `CleanerOfferCard` — mobile hierarchy: chip → schedule → earnings → service → location → actions |
| Actions | `OfferActions` stacked full-width `min-h-11` on mobile; side-by-side on `md+` |
| Page | Section headers “Needs your response” / “Past offers”; partial empty when only past exists |

### Expiry chip policy (shipped)

| Condition | Chip | Tone |
|-----------|------|------|
| Open, &gt;1h | Respond within Nh | info |
| Open, &lt;1h | Respond within Nm | warning |
| Expired offered | Status “Expired” (past section) | danger badge |
| Past accepted/declined | No expiry chip | — |

No live countdown timers. No TTL/cron changes.

### Deferred (6F-2b+)

| Item | Stage |
|------|-------|
| Home preview expiry line | 6F-2b |
| Sticky action bars | 6F-4 |
| Bottom nav | 6F-5 |

### Tests

- `formatOfferExpiryDisplay.test.ts`
- `partitionCleanerOffers.test.ts`
- `OfferExpiryChip.test.tsx`, `CleanerOfferCard.test.tsx`, `OfferActions.test.tsx`
- `cleanerPagesStage6f2a.test.ts`

### Verification

```bash
npm run typecheck
npm run test -- src/features/dashboards/server/formatOfferExpiryDisplay.test.ts src/features/dashboards/server/partitionCleanerOffers.test.ts src/components/dashboard/OfferExpiryChip.test.tsx src/components/dashboard/CleanerOfferCard.test.tsx src/components/dashboard/OfferActions.test.tsx "src/app/(cleaner)/cleaner/cleanerPagesStage6f2a.test.ts"
```

---

## Stage 6F-2c-a — Decline confirmation (implemented)

### Scope delivered

| Item | Detail |
|------|--------|
| Component | `DeclineOfferConfirmSheet` — bottom sheet (`max-sm`), centered dialog (`md+`) |
| Wiring | Decline opens confirm; confirm calls existing `POST …/decline`; Accept one-tap unchanged |
| Summary | Service, schedule, earnings in confirm panel |
| a11y | `role="dialog"`, focus trap, Escape/backdrop/Cancel close, focus return to Decline, `role="alert"` on errors |
| API | **Unchanged** — no body, no new routes |

### Copy (shipped)

- Title: Decline this job offer?
- Body: You won’t be assigned… / may be offered to another cleaner
- Buttons: Keep offer / Decline offer

### Deferred

| Item | Stage |
|------|-------|
| Decline reason capture | 6F-2c-b (requires API/command) |
| Sticky action bars | 6F-4 |
| Bottom nav | 6F-5 |

### Tests

- `DeclineOfferConfirmSheet.test.tsx`
- `OfferActions.test.tsx`, `cleanerPagesStage6f2c.test.ts`

### Verification

```bash
npm run typecheck
npm run test -- src/components/dashboard/DeclineOfferConfirmSheet.test.tsx src/components/dashboard/OfferActions.test.tsx "src/app/(cleaner)/cleaner/cleanerPagesStage6f2c.test.ts" src/app/api/cleaner/cleanerMutationRoutes.test.ts
```

---

## Stage 6 stabilization — Phase 1 (implemented)

Presentation-only fixes from [stage-6-stabilization-audit.md](../audits/stage-6-stabilization-audit.md). No lifecycle, payment, assignment, notification, RLS, or API changes.

| Item | Detail |
|------|--------|
| Customer home | Fetch failure → `DashboardFetchError`; empty only on successful empty fetch |
| Admin bookings list | Fetch failure → `DashboardFetchError` |
| Cleaner earnings | Fetch failure vs empty split (matches offers/jobs) |
| Admin search `q` | Helper when query &lt; 3 chars: “Search uses 3 or more characters.” |
| Admin `payment_failed` | Hide generic payment status badge when booking status is `payment_failed` (list + detail) |
| Admin detail badges | `assignmentVisibilityKey` labels + tones match list |
| Loading routes | `/customer`, `/cleaner/jobs/[bookingId]` → `DashboardPageSkeleton` |

### Routes / modules

- `src/app/(customer)/customer/page.tsx`, `loading.tsx`
- `src/app/(admin)/admin/bookings/page.tsx`, `[bookingId]/page.tsx`
- `src/app/(cleaner)/cleaner/earnings/page.tsx`, `jobs/[bookingId]/loading.tsx`
- `src/components/dashboard/AdminBookingsFilters.tsx`
- `src/features/dashboards/server/adminBookingsListQuery.ts` (`isAdminBookingSearchIgnored`)

### Tests

- `src/app/stage6StabilizationPhase1.test.ts`
- `adminBookingsListQuery.test.ts` (`isAdminBookingSearchIgnored`)
- `AdminBookingsFilters.test.tsx` (short-search helper)

### Verification

```bash
npm run typecheck
npm run test -- src/app/stage6StabilizationPhase1.test.ts src/features/dashboards/server/adminBookingsListQuery.test.ts src/components/dashboard/AdminBookingsFilters.test.tsx
```

---

## Deferred (post 6A-1 / 6D-1 / 6B / 6C / 6E-1 / 6F-1a / 6F-1b / 6F-2a / 6F-2c-a / stabilization Phase 1)

| Item | Stage |
|------|-------|
| Cleaner sticky mobile actions | 6F-4 |
| Cleaner bottom nav | 6F-5 |
| Notification table card layout on mobile | 6F |

---

## Verification

```bash
npm run typecheck
npm run test -- src/components/dashboard/AdminOperationalStatusPanel.test.tsx "src/app/(admin)/admin/bookings/[bookingId]/adminBookingDetailOperationalPanel.test.ts" src/tests/security/mutationRouteBoundaryGuard.test.ts
```
