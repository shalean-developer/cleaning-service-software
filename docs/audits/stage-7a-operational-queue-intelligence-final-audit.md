# Stage 7A — Operational Queue Intelligence Final Audit

**Date:** 2026-05-18  
**Type:** Audit only — no code changes  
**Scope:** Stages **7A-1** (summary strip), **7A-2a** (home explainability cards), **7A-2b** (bookings context card), **7A-2c** (assignments footnote)  
**Related:** [stage-7a-1-operational-queue-summary-strip-final-audit.md](./stage-7a-1-operational-queue-summary-strip-final-audit.md), [stage-7a-2-operational-queue-explainability-cards-design.md](../architecture/stage-7a-2-operational-queue-explainability-cards-design.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Queue definitions centralized | **Pass** |
| Strip on `/admin`, `/admin/bookings`, `/admin/assignments` | **Pass** |
| Exact SQL head counts (not list-capped) | **Pass** |
| Chip deep links → `/admin/bookings?filter=…` | **Pass** |
| Home five-card explainability grid | **Pass** |
| Bookings active-filter context card | **Pass** |
| Assignments chip vs work-queue footnote | **Pass** |
| No mutation buttons / APIs | **Pass** |
| Lifecycle / payment / assignment / RLS / commands | **Pass** (unchanged) |
| `npm run typecheck` | **Pass** |
| Targeted unit tests (21) | **Pass** |
| Operational + architecture docs | **Pass** |
| Admin page E2E / snapshot tests | **N/A** (none in repo) |

**Overall:** Stage **7A** is **complete, read-only, accurate, and explainable**. Safe to begin **Stage 7B — assignment funnel analytics design** (design-only; no 7A follow-up blockers).

---

## Architecture (authoritative)

```text
ADMIN_OPERATIONAL_QUEUES (adminOperationalQueues.ts)
  ├── labels, filters, tones, explainability (7A-2)
  └── adminOperationalQueueHref(filter)

getAdminOperationalQueueCounts (server-only)
  └── Promise.all × 5: countAdminBookingsByFilter(filter)
        ├── normalizeAdminBookingsQuery({ filter })
        ├── resolveAdminAssignmentFilterSql (assignment presets)
        └── bookings SELECT count exact head — NO order/limit

Surfaces:
  /admin
    AdminOperationalQueueStrip
    AdminOperationalQueueExplainGrid ← buildAdminOperationalQueueCards
  /admin/bookings
    AdminOperationalQueueStrip (activeFilter)
    AdminOperationalQueueContextCard ← buildAdminOperationalQueueContextCard (operational filters only)
  /admin/assignments
    AdminOperationalQueueStrip
    AdminAssignmentQueueStripFootnote
```

**Read-only contract:** Strip chips and home “View all” links use `next/link` only. Explainability components use `AdminRunbookRef` (doc paths) and navigation links — no forms, `fetch` to mutation routes, or server actions.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Queue definitions centralized | **Pass** | Single source: `src/features/dashboards/adminOperationalQueues.ts` — `ADMIN_OPERATIONAL_QUEUES`, `adminOperationalQueueHref`, `QUEUE_EXPLAINABILITY`, builders |
| 2 | Queue strip on `/admin` | **Pass** | `src/app/(admin)/admin/page.tsx` — `AdminOperationalQueueStrip` when `queueCounts?.ok` |
| 3 | Queue strip on `/admin/bookings` | **Pass** | `src/app/(admin)/admin/bookings/page.tsx` — strip + `activeFilter` |
| 4 | Queue strip on `/admin/assignments` | **Pass** | `src/app/(admin)/admin/assignments/page.tsx` — strip when `queueCounts.ok` |
| 5 | Counts use exact server-side SQL count path | **Pass** | `countAdminBookingsByFilter`: `select("*", { count: "exact", head: true })` + `applyAdminBookingsSqlFilters` — same path as `listAdminBookings` `matchTotal` |
| 6 | Counts not capped by 200-row list | **Pass** | No `.order()` / `.limit()` on count query; all five filters are server-side (6C) |
| 7 | Chips link to correct filters | **Pass** | `adminOperationalQueueHref` → `/admin/bookings?filter={filter}`; tested in `adminOperationalQueues.test.ts` |
| 8 | Home explainability — all five queues | **Pass** | `AdminOperationalQueueExplainGrid` + `buildAdminOperationalQueueCards(queueCounts.queues)` on home when `queueCounts?.ok` |
| 9 | Bookings context card — operational filters only | **Pass** | `isAdminOperationalQueueFilter` + `buildAdminOperationalQueueContextCard`; null for `selected_declined`, `max_attempts`, no filter |
| 10 | Assignments footnote — global vs work queue | **Pass** | `AdminAssignmentQueueStripFootnote` below strip; copy mentions exact strip counts vs detailed work queue / Assignment attention chip |
| 11 | No mutation buttons | **Pass** | Component tests assert no `type="submit"` / recover CTAs on explainability UI; strip is `Link` only; context card has no action buttons |
| 12 | No new mutation APIs | **Pass** | No new files under `src/app/api/`; counts via Server Components only |
| 13 | No lifecycle/payment/assignment/RLS/command changes | **Pass** | 7A adds read models + UI; `adminOperationsReadModel.ts` list/queue logic unchanged; no migrations |
| 14 | Tests pass | **Pass** | See §Test execution (21 tests) |
| 15 | Docs updated | **Pass** | `admin-operational-dashboard.md`, `stage-7a-2-operational-queue-explainability-cards-design.md` (7A-2 complete) |

---

## Queue → filter mapping

| Strip label | Queue key | `filter` param | Deep link |
|-------------|-----------|----------------|-----------|
| Needs assignment | `needs_assignment` | `pending_assignment` | `/admin/bookings?filter=pending_assignment` |
| Dispatch not started | `dispatch_not_started` | `dispatch_not_started` | `/admin/bookings?filter=dispatch_not_started` |
| Recovery needed | `recovery_needed` | `recovery_needed` | `/admin/bookings?filter=recovery_needed` |
| Payment attention | `payment_attention` | `payment_failed` | `/admin/bookings?filter=payment_failed` |
| Assignment attention | `assignment_attention` | `assignment_attention` | `/admin/bookings?filter=assignment_attention` |

---

## Explainability surfaces

| Surface | Component | When shown |
|---------|-----------|------------|
| `/admin` home | `AdminOperationalQueueExplainGrid` (5 cards) | `queueCounts.ok` |
| `/admin/bookings` | `AdminOperationalQueueContextCard` (1 compact card) | `queueCounts.ok` && operational `filter` |
| `/admin/assignments` | `AdminAssignmentQueueStripFootnote` | `queueCounts.ok` |

**Navigation links (allowed):** Home explain cards include “View all” / “View list” `Link` to filtered bookings — not mutations.

**Bookings non-operational filters:** `selected_declined`, `max_attempts`, etc. — strip may still render; **no** context card (by design).

---

## Count accuracy vs other surfaces

| Surface | Count semantics |
|---------|-----------------|
| Strip / explainability cards | Global exact SQL `matchTotal` per filter |
| `/admin/bookings` list | Up to **200** rows; footer `matchTotal` when server-side filter |
| `/admin/assignments` work queue | Up to **100** `pending_assignment` / `confirmed` scan; different inclusion rules |
| Home “Needs attention” preview | Work queue slice (max **5**), not chip total |

7A-2c footnote and assignment_attention card `secondaryNote` document the assignments vs chip distinction.

---

## Failure and performance

| Scenario | Behavior |
|----------|----------|
| Count error | `getAdminOperationalQueueCounts` → `{ ok: false }`; strip, grid, context card, footnote omitted |
| Non-admin | `FORBIDDEN`; UI omitted |
| Page load | **5 parallel** head-count queries per admin page showing strip (home, bookings, assignments) |
| No polling / realtime | Confirmed |

---

## Test execution summary

| Command / suite | Result |
|-----------------|--------|
| `npm run typecheck` | **Pass** |
| `adminOperationalQueues.test.ts` | **Pass** (4 tests) |
| `adminOperationalQueueCounts.test.ts` | **Pass** (3 tests) |
| `AdminOperationalQueueExplainCard.test.tsx` | **Pass** (4 tests) |
| `AdminOperationalQueueExplainGrid.test.tsx` | **Pass** (1 test) |
| `AdminOperationalQueueContextCard.test.tsx` | **Pass** (7 tests) |
| `AdminAssignmentQueueStripFootnote.test.tsx` | **Pass** (2 tests) |
| **Total** | **6 files, 21 tests, all passed** |
| Admin page render / E2E | **N/A** |

---

## Files in Stage 7A scope

| File | Role |
|------|------|
| `src/features/dashboards/adminOperationalQueues.ts` | Central config + explainability + builders |
| `src/features/dashboards/adminOperationalQueues.test.ts` | Config / filter / builder tests |
| `src/features/dashboards/server/adminOperationalQueueCounts.ts` | SQL count read model |
| `src/features/dashboards/server/adminOperationalQueueCounts.test.ts` | Count path tests |
| `src/components/dashboard/AdminOperationalQueueStrip.tsx` | Chip strip (7A-1) |
| `src/components/dashboard/AdminOperationalQueueExplainCard.tsx` | Home card (7A-2a) |
| `src/components/dashboard/AdminOperationalQueueExplainGrid.tsx` | Home grid (7A-2a) |
| `src/components/dashboard/AdminOperationalQueueContextCard.tsx` | Bookings context (7A-2b) |
| `src/components/dashboard/AdminAssignmentQueueStripFootnote.tsx` | Assignments footnote (7A-2c) |
| `src/app/(admin)/admin/page.tsx` | Home wiring |
| `src/app/(admin)/admin/bookings/page.tsx` | Bookings wiring |
| `src/app/(admin)/admin/assignments/page.tsx` | Assignments wiring |
| `*/*.test.tsx` | Component tests (listed above) |
| `docs/operations/admin-operational-dashboard.md` | Ops runbook |
| `docs/architecture/stage-7a-2-operational-queue-explainability-cards-design.md` | Design + ship status |

**Orphaned (harmless):** `AdminOpsSummaryCards.tsx`, `getAdminOperationsSummary` — superseded on home by 7A-1; safe cleanup in a later slice.

**Explicitly unchanged:** `executeBookingCommand`, payment webhooks, assignment commands, RLS migrations, `listAdminBookings` filter SQL helpers (reused, not modified).

---

## Behavior unchanged (confirmed)

| Layer | 7A impact |
|-------|-----------|
| Booking lifecycle transitions | None |
| Payment capture / webhooks | None |
| Assignment engine / dispatch / recovery commands | None |
| `listAdminAssignmentQueue` inclusion rules | None |
| Notification delivery | None |
| RLS policies | None |
| `GET /api/admin/bookings` | None (still no query passthrough for counts) |

---

## Doc status

| Document | Status |
|----------|--------|
| `admin-operational-dashboard.md` | **Current** — 7A-1 strip, 7A-2a/b/c sections, routes table |
| `stage-7a-2-operational-queue-explainability-cards-design.md` | **Current** — 7A-2 complete |
| `stage-7a-1-operational-queue-summary-strip-final-audit.md` | **Historical** — pre-7A-2 housekeeping notes superseded |
| This audit | **Created** |

---

## Optional follow-ups (out of 7A scope)

| Item | Priority |
|------|----------|
| Remove orphaned `AdminOpsSummaryCards` / `getAdminOperationsSummary` | Low — cleanup |
| `aria-describedby` from chips to explainability | Low — 7A-2d optional |
| Admin home/bookings E2E smoke | Low — no page tests today |
| Reduce 5× count queries via single RPC/cache | Future perf — not required for 7B design |

---

## Final question

**Is Stage 7A complete and safe enough to move to Stage 7B assignment funnel analytics design?**

**Yes.**

- **Complete:** 7A-1 strip on three admin surfaces; 7A-2a/b/c explainability shipped; centralized config; exact counts; docs aligned.
- **Safe:** Read-only UI; no new mutation APIs; core architecture untouched; 21 unit tests + typecheck green.
- **7B readiness:** Assignment funnel analytics is a **new read/analytics layer** — it should consume existing queue/filter semantics and `matchTotal` patterns from 6C/7A without altering lifecycle. No 7A blockers remain for **design kickoff** on 7B.

**Recommendation:** Start 7B as **design-only** (funnel stages, metrics sources, admin surface placement). Keep analytics queries separate from `getAdminOperationalQueueCounts` unless explicitly unified in the 7B design review.
