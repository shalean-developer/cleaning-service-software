# Stage 7A-2 — Operational Queue Explainability Cards Design

**Date:** 2026-05-18  
**Status:** **7A-2 complete** — home explainability cards (7A-2a), bookings context card (7A-2b), assignments footnote (7A-2c)  
**Depends on:** Stage **7A-1** (Operational Queue Summary Strip — shipped), [stage-6c-server-side-admin-booking-filters-design.md](./stage-6c-server-side-admin-booking-filters-design.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

### Shipped in 7A-2a

| Item | Status |
|------|--------|
| `ADMIN_OPERATIONAL_QUEUES` explainability fields | **Shipped** |
| `buildAdminOperationalQueueCards` | **Shipped** |
| `AdminOperationalQueueExplainCard` + `AdminOperationalQueueExplainGrid` | **Shipped** |
| `/admin` home grid (read-only, existing counts) | **Shipped** |
| `/admin/bookings` active-filter context card | **Shipped (7A-2b)** — `AdminOperationalQueueContextCard` |
| `/admin/assignments` footnote | **Shipped (7A-2c)** — `AdminAssignmentQueueStripFootnote` |

**Goal:** For each operational queue chip, explain **what it means**, **why bookings appear**, **what admins should do next**, and **how urgent it is** — without changing counts, filters, lifecycle, or adding mutations.

**Non-goals:** New APIs, queue count logic changes, filter/search changes, assignment/payment commands, RLS, inline mutation buttons, batch actions, per-booking dynamic copy, tooltip-only UX, replacing the 7A-1 strip.

---

## Executive summary

| Design question | Recommendation |
|-----------------|----------------|
| 1. UI pattern | **Stacked explainability cards** below the strip on `/admin` home; **single active-filter context card** on `/admin/bookings` when `?filter=` is set; **short footnote** on `/admin/assignments` (chip vs work-queue distinction). Reject tooltips-only and side drawer for v1. |
| 2. Copy | Centralize per-queue static copy in `ADMIN_OPERATIONAL_QUEUES` (extend 7A-1 definition). See §Copy per queue. |
| 3. Severity | Four-level model: `informational` \| `monitor` \| `action_required` \| `urgent`. Map 1:1 to chip `tone` for color parity. |
| 4. Recommended action | One imperative sentence + optional secondary “monitor / cron may handle” line. No mutation CTAs. |
| 5. Placement | **Home:** all five cards. **Bookings:** active filter card only. **Assignments:** footnote only (no five-card grid). |
| 6. Filter deep links | **Yes** — primary CTA on each card: “View N bookings” → existing `/admin/bookings?filter=…`. |
| 7. Runbook links | **Yes** — reuse `AdminRunbookRef` + `ADMIN_RUNBOOKS` keys (read-only repo paths). |
| 8. Counts | **Unchanged** — exact SQL head counts from 7A-1; cards display the same `count` passed to the strip. |
| 9. Mutations | **None** in 7A-2. Actions happen on booking detail or via cron; cards link there indirectly via filtered list. |
| 10. Tests | Config/copy unit tests + component render tests; no new DB/integration tests. |

**Safest first 7A-2 slice:** Extend `ADMIN_OPERATIONAL_QUEUES` with explainability fields and render read-only cards on **`/admin` home only**, wired to existing `getAdminOperationalQueueCounts` output — no bookings/assignments page changes, no new server functions.

---

## Current 7A-1 baseline

### Architecture (unchanged by 7A-2)

```text
ADMIN_OPERATIONAL_QUEUES (adminOperationalQueues.ts)
  → getAdminOperationalQueueCounts (server-only)
      → Promise.all × 5: countAdminBookingsByFilter(filter)
          → same WHERE as listAdminBookings matchTotal (Stage 6C)
  → AdminOperationalQueueStrip (Link chips — count + label + tone)
```

### Surfaces today

| Route | Strip | Other context |
|-------|-------|---------------|
| `/admin` | 5 chips, exact counts | Assignment preview (up to 5 rows from **work queue**, not chip totals) |
| `/admin/bookings` | 5 chips + `activeFilter` highlight | Filtered list + `AdminBookingsFilters` |
| `/admin/assignments` | 5 chips | Per-row `AdminAssignmentQueueGuidance` (100-row scan, different semantics) |

### Gap 7A-2 closes

Admins see **numbers** but not:

- What each queue **means** in product terms
- **Why** a booking enters (predicate summary, not SQL)
- **Urgency** (monitor vs act now)
- **Next step** without opening three different docs
- Why **Assignment attention** count ≠ `/admin/assignments` list length

### Prior art to reuse

| Pattern | Location | Reuse in 7A-2 |
|---------|----------|---------------|
| Per-booking guidance block | `AdminAssignmentQueueGuidance` | Card layout + bullet flags style |
| Runbook reference | `AdminRunbookRef` + `ADMIN_RUNBOOKS` | Same keys, no new doc paths |
| Centralized queue config | `ADMIN_OPERATIONAL_QUEUES` | Extend with explainability fields |
| Chip tone colors | `AdminOperationalQueueStrip` | Severity drives same `tone` classes |

---

## Design question answers

### 1. Cards, tooltips, expandable panels, or side drawer?

| Option | Verdict | Rationale |
|--------|---------|-----------|
| **Tooltips on chips** | **Reject for v1** | Hidden on mobile; no room for “why” + runbook; poor a11y for operational copy |
| **Side drawer** | **Reject for v1** | Heavy interaction model; overlaps booking detail panel; extra client state |
| **Expandable panels per chip** | **Defer** | Adds click-to-reveal on already-clickable chips; confusing affordance |
| **Stacked explainability cards** | **Adopt** | Scannable on home; works without JS; mirrors assignment guidance blocks; testable static copy |

**Recommendation:** **Read-only cards** in a responsive grid (`1 col` mobile → `2–3 col` desktop) **below** the strip. Chips remain the primary navigation control; cards are reference, not duplicate buttons.

### 2. What copy should each queue show?

Each card has four fields (see §Queue explanation model and §Copy per queue):

1. **Title** — same as chip label  
2. **Summary** — one sentence, what this queue is  
3. **Why here** — 2–4 bullets, plain-language inclusion rules (aligned with 6C matchers, not raw SQL)  
4. **What to do** — recommended action (imperative) + optional “Usually handled by…” line  

Optional fifth line for **Assignment attention** only: chip count vs `/admin/assignments` work queue.

### 3. What severity should each queue have?

Use a **severity** enum separate from but mapped to chip **tone**:

| Severity | Meaning for admins | Default tone |
|----------|-------------------|--------------|
| `informational` | Awareness only; system often progressing | `neutral` |
| `monitor` | Watch; cron or automation may resolve | `warning` or `info` |
| `action_required` | Admin should review triage list today | `warning` |
| `urgent` | Customer or revenue blocked; prioritize | `danger` |

Per-queue mapping in §Severity model.

### 4. What recommended action should each queue show?

One **primary** action (text + link to filtered bookings). **Secondary** lines clarify what **not** to do in the strip (no payment finalize, no batch recover). Booking-level actions stay on `/admin/bookings/[id]`.

### 5. Home only or also `/admin/bookings`?

| Surface | 7A-2 content |
|---------|--------------|
| `/admin` | Full grid: all 5 explainability cards |
| `/admin/bookings` | **One** context card when `filter` is one of the five strip filters; hidden when no filter or unknown filter |
| `/admin/assignments` | **No card grid** — one static footnote under strip linking to `assignment_attention` filter + `/admin/assignments` distinction |

**Rationale:** Home is the orientation surface. Bookings page already has list + filters; repeating five cards wastes vertical space. Active-filter card reinforces why the current list looks the way it does.

### 6. Should explanations include links to filtered views?

**Yes.** Every card includes:

- **Primary link:** `View all ({count})` → `/admin/bookings?filter={filter}` (same href as chip)  
- Count reuses `AdminOperationalQueueCountItem.count` — no second query  

Cards must **not** imply the link shows more rows than the list cap (200); optional footnote on bookings context card: “List shows up to 200 newest matches; count is exact.”

### 7. Should explanations include runbook links?

**Yes**, where ops runbooks already exist. Reuse `AdminRunbookRef` (repository path text, not external URLs).

| Queue | Runbook key |
|-------|-------------|
| Needs assignment | `adminDashboard` |
| Dispatch not started | `assignmentRecovery` |
| Recovery needed | `assignmentRecovery` |
| Payment attention | `paymentFailedRetry` |
| Assignment attention | `assignmentDeclineRedispatch` (+ `adminDashboard` for filter vs queue note) |

No new markdown files required for 7A-2.

### 8. Should counts remain exact and read-only?

**Yes — non-negotiable.**

- Count source: unchanged `getAdminOperationalQueueCounts`  
- Cards display `count` as read-only text; no increment/decrement, no refresh button  
- Zero count: still show card with “None right now” copy; link remains valid  

### 9. Should any mutation actions be shown?

**No.**

| Allowed | Not allowed |
|---------|-------------|
| Links to filtered list | Recover / dispatch / requeue buttons on cards |
| Links to `/admin/assignments` | POST from card |
| Runbook path references | “Fix all” batch actions |
| Text: “Use Recover assignment on booking detail when eligible” | Embedded forms |

Mutations remain on booking detail (`AdminOperationalStatusPanel`) and cron — unchanged.

### 10. What tests are required?

| Layer | Tests |
|-------|-------|
| Config | `adminOperationalQueues.test.ts` — every queue has required explainability fields; severity/tone consistency; runbook keys valid |
| Merge counts + explainability | Pure helper `buildAdminOperationalQueueCards(queues)` — maps count items + static defs |
| Component | `AdminOperationalQueueExplainCard` — renders title, severity badge, why bullets, runbook ref, link href |
| Page | Optional snapshot of home section (if repo adds page tests later) — **not required for slice 1** |
| Excluded | No new RLS tests, no SQL parity tests (6C already cover filters), no API route tests |

---

## Queue explanation model

### Type extension (proposed)

Extend `AdminOperationalQueueDefinition` in `adminOperationalQueues.ts`:

```typescript
export type AdminOperationalQueueSeverity =
  | "informational"
  | "monitor"
  | "action_required"
  | "urgent";

export type AdminOperationalQueueExplainability = {
  summary: string;
  whyHere: readonly string[];
  recommendedAction: string;
  secondaryNote?: string;
  severity: AdminOperationalQueueSeverity;
  runbookKey: AdminRunbookKey;
  /** Optional extra runbook for cross-links (assignment_attention only). */
  secondaryRunbookKey?: AdminRunbookKey;
};
```

Runtime card DTO (client/server component props):

```typescript
export type AdminOperationalQueueCard = AdminOperationalQueueCountItem &
  AdminOperationalQueueExplainability;
```

Built by merging `getAdminOperationalQueueCounts` results with static defs — **no extra DB round trip**.

### Card anatomy (wireframe)

```text
┌─────────────────────────────────────────────┐
│ [Severity badge]  Needs assignment     12   │  ← count from 7A-1
│ Bookings waiting for a cleaner offer…       │  ← summary
│ Why bookings appear here:                   │
│   • status is pending_assignment            │
│   • paid, no assigned cleaner yet           │
│ What to do: Open the list and send…         │
│ View all (12) →                             │  ← link
│ Runbook: Admin operational dashboard        │
└─────────────────────────────────────────────┘
```

---

## Severity model

| Queue key | Severity | Tone (7A-1) | Urgency label (UI) |
|-----------|----------|-------------|-------------------|
| `needs_assignment` | `action_required` | `warning` | Action needed |
| `dispatch_not_started` | `monitor` | `warning` | Monitor |
| `recovery_needed` | `action_required` | `info` | Action needed |
| `payment_attention` | `urgent` | `danger` | Urgent |
| `assignment_attention` | `action_required` | `warning` | Action needed |

**Note:** `recovery_needed` keeps `info` tone (7A-1) but severity `action_required` because ops may need **Recover assignment** on detail — severity drives badge text; tone drives border color on nested count pill if shown.

Badge component: small pill — `Urgent` (red), `Action needed` (amber), `Monitor` (sky), `Informational` (zinc). Only the four severities above appear in v1.

---

## Copy per queue

### Needs assignment

| Field | Copy |
|-------|------|
| **Summary** | Bookings that are paid (or otherwise ready) but still have **no assigned cleaner** — the system is waiting to start or complete dispatch. |
| **Why here** | • `status` is `pending_assignment`<br>• No cleaner is assigned yet<br>• Includes bookings before the first offer is sent |
| **Recommended action** | **Open the filtered list** and, for each booking, use **Send offer to cleaner** on booking detail when manual dispatch is eligible. |
| **Secondary note** | If dispatch should have started automatically, check payment and assignment metadata on booking detail before sending a manual offer. |
| **Severity** | `action_required` |
| **Runbook** | `adminDashboard` |

### Dispatch not started

| Field | Copy |
|-------|------|
| **Summary** | Paid bookings where **assignment dispatch never started** or visibility shows “dispatch not started” — often right after payment or a failed auto-dispatch. |
| **Why here** | • Assignment reason contains “dispatch not started”, **or**<br>• Paid `confirmed` booking past the recovery grace window with no open or accepted offers<br>• Overlaps with recovery visibility but this filter is the **monitoring** view |
| **Recommended action** | **Monitor the list** — recovery cron may pick up eligible bookings. For a single stuck booking, open detail and use **Recover assignment** when eligibility shows **eligible**. |
| **Secondary note** | Do not batch-recover from this page. See assignment recovery runbook for cron vs manual timing. |
| **Severity** | `monitor` |
| **Runbook** | `assignmentRecovery` |

### Recovery needed

| Field | Copy |
|-------|------|
| **Summary** | Bookings that need **post-payment assignment recovery** — dispatch did not complete and the booking is eligible (or flagged) for the recovery path. |
| **Why here** | • Recovery eligibility is **eligible** on booking detail, **or**<br>• Assignment visibility key is `dispatch_not_started`<br>• Same SQL bundle as dispatch-not-started filter (6C-3c) — use this queue when actively recovering |
| **Recommended action** | **Open each booking** and run **Recover assignment** when the operational panel shows eligibility **eligible**. Otherwise wait for cron or investigate grace / in-progress states on detail. |
| **Secondary note** | Bookings in grace period may appear in related filters but are not yet eligible for recovery. |
| **Severity** | `action_required` |
| **Runbook** | `assignmentRecovery` |

### Payment attention

| Field | Copy |
|-------|------|
| **Summary** | Bookings whose payment **failed** or could not be completed — the job cannot proceed until the customer retries checkout. |
| **Why here** | • `status` is `payment_failed`<br>• Customer must complete payment again — admin cannot finalize payment in the dashboard |
| **Recommended action** | **Confirm the customer has been notified** and direct them to retry from their booking/payment flow. Use booking detail to verify outbox notifications if needed. |
| **Secondary note** | Admin cannot charge or retry Paystack on behalf of the customer. |
| **Severity** | `urgent` |
| **Runbook** | `paymentFailedRetry` |

### Assignment attention

| Field | Copy |
|-------|------|
| **Summary** | Bookings that need **assignment triage** — needs assignment, selected cleaner declined, max dispatch attempts, or legacy attention metadata. |
| **Why here** | • Visibility key is `needs_assignment`, `selected_declined_admin`, or `max_attempts_admin`, **or**<br>• Stale `attention_required` metadata on `confirmed` without a visibility key<br>• **Excludes** dispatch-not-started and recovery-only cases (separate chips) |
| **Recommended action** | **Open the filtered bookings list** for global triage. For day-to-day scanning, also use **`/admin/assignments`** — per-booking guidance and badges live there. |
| **Secondary note** | **This count is exact across all bookings.** The assignments work queue scans only the newest 100 `pending_assignment` / `confirmed` rows — the two numbers often differ. |
| **Severity** | `action_required` |
| **Runbook** | `assignmentDeclineRedispatch` (primary), `adminDashboard` (secondaryRunbookKey) |

---

## UI placement

### `/admin` (home)

```text
DashboardShell
  AdminOperationalQueueStrip          ← 7A-1 unchanged
  AdminOperationalQueueExplainGrid    ← 7A-2: 5 cards, responsive grid
  Assignment queue preview note       ← existing
  Needs attention list                ← existing (work queue)
  Recent bookings                     ← existing
```

### `/admin/bookings`

```text
AdminOperationalQueueStrip (activeFilter)
AdminOperationalQueueContextCard      ← 7A-2: only when filter ∈ strip filters
AdminBookingsFilters
… list …
```

Context card uses the same copy as the matching grid card. If `filter` is `selected_declined` (not a strip queue), **no** 7A-2 card — filters outside the five queues are out of scope.

### `/admin/assignments`

```text
AdminOperationalQueueStrip
<p className="text-xs">…assignment chip vs work queue…</p>   ← 7A-2 footnote only
… assignment rows + AdminAssignmentQueueGuidance …
```

---

## Read-only guarantee

| Concern | 7A-2 guarantee |
|---------|----------------|
| Count semantics | Identical to 7A-1; cards never recompute filters |
| Navigation | `<Link href>` only — same URLs as chips |
| Runbooks | Display `docPath` text only — no fetch of markdown at runtime required |
| Server mutations | Zero new routes, actions, or command imports |
| Lifecycle / RLS | No changes to `executeBookingCommand`, webhooks, migrations |
| Assignment work queue | `listAdminAssignmentQueue` unchanged |
| Strip component | `AdminOperationalQueueStrip` unchanged in slice 1; optional: pass severity into chip `aria-describedby` in slice 3 |

---

## Test plan

### Unit — config (`adminOperationalQueues.test.ts`)

- `ADMIN_OPERATIONAL_QUEUES.length === 5`
- Each entry has `explainability` with non-empty `summary`, `whyHere.length >= 2`, `recommendedAction`, valid `runbookKey`
- `severity` ↔ `tone` mapping table enforced (documented exceptions: `recovery_needed` info + action_required)
- `adminOperationalQueueHref(filter)` unchanged

### Unit — builder (new `buildAdminOperationalQueueCards.test.ts`)

- Merges count items with defs by `key`
- Preserves `count`, `href`, `label`, `tone`
- Unknown key throws or filters (defensive)

### Component — `AdminOperationalQueueExplainCard.test.tsx`

- Renders severity badge text for `urgent`
- Renders all `whyHere` bullets
- Link `href` matches `adminOperationalQueueHref`
- `AdminRunbookRef` receives correct `runbookKey`
- `count === 0` still renders “View all (0)” or “None right now” per product choice (**recommend:** show “View list” without emphasizing zero)

### Regression

- `adminOperationalQueueCounts.test.ts` — unchanged
- `npm run typecheck`

### Manual QA checklist

- [ ] Home: five cards, counts match chips
- [ ] Bookings `?filter=payment_failed`: one context card, matches chip copy
- [ ] Bookings no filter: no context card
- [ ] Assignments: footnote visible; assignments list still works
- [ ] No buttons that POST
- [ ] Mobile: grid stacks, readable without hover

---

## Phased implementation plan

| Phase | Scope | Risk |
|-------|-------|------|
| **7A-2a** (first slice) | Extend `ADMIN_OPERATIONAL_QUEUES` + `buildAdminOperationalQueueCards` + `AdminOperationalQueueExplainCard` + grid on **`/admin` only** | **Shipped** |
| **7A-2b** | `AdminOperationalQueueContextCard` on `/admin/bookings` when strip filter active | **Shipped** |
| **7A-2c** | Assignments footnote (`AdminAssignmentQueueStripFootnote`) | **Shipped** |
| **7A-2d** (optional) | Collapse grid on mobile; `aria-describedby` on chips | **Deferred** |
| **7A-2d** (optional) | Collapse grid to “show explanations” on mobile if vertical space is excessive | Cosmetic |

Each phase ships with tests for touched files only. Do not combine 7A-2a with count or filter changes.

---

## Final recommendation

**Adopt stacked explainability cards** fed from an **extended centralized queue config**, rendered **below the existing strip on admin home first**, with **filter deep links and runbook references**, **exact read-only counts**, and **no mutation controls**.

Defer tooltips, drawers, and expandable chip panels. Keep assignment **per-row** guidance on `/admin/assignments`; 7A-2 explains **queue-level** semantics only.

Align copy with Stage **6C** filter definitions (especially assignment_attention vs dispatch/recovery disjointness) so admins are not surprised when counts differ across chips.

---

## Final question: safest first 7A-2 implementation slice?

**7A-2a — Home-only explainability cards from static config**

1. Add `explainability` to each entry in `ADMIN_OPERATIONAL_QUEUES` (copy + severity + runbook keys).  
2. Add `buildAdminOperationalQueueCards(queues: AdminOperationalQueueCountItem[])`.  
3. Add `AdminOperationalQueueExplainCard` (presentational).  
4. Add `AdminOperationalQueueExplainGrid` on `src/app/(admin)/admin/page.tsx` below `AdminOperationalQueueStrip`, passing the same `queueCounts.queues` already fetched.  
5. Tests: config completeness + builder merge + one component test.

**Why this is safest**

- **No new server function** — reuses `getAdminOperationalQueueCounts`  
- **No bookings/assignments page risk** — single file page change  
- **No filter or count logic** — pure presentation  
- **No mutations** — links and runbook text only  
- **Easy to revert** — one grid component + config extension  
- **Validates copy with ops** before rolling context card to bookings  

After 7A-2a is merged and copy is stable, ship **7A-2b** (bookings active-filter context card) and **7A-2c** (assignments footnote).
