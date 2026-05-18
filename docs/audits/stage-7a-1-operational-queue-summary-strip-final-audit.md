# Stage 7A-1 — Operational Queue Summary Strip Final Audit

**Date:** 2026-05-18  
**Type:** Audit only — no code changes  
**Scope:** Read-only operational queue strip on admin home, bookings, and assignments  
**Related:** [stage-6c-server-side-admin-booking-filters-final-audit.md](./stage-6c-server-side-admin-booking-filters-final-audit.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Queue definitions centralized | **Pass** |
| Deep links match Stage 6C `filter` params | **Pass** |
| Counts use SQL head `count: exact` (no list limit) | **Pass** |
| Counts exact for all five strip queues | **Pass** (same semantics as `matchTotal`) |
| Admin home / bookings / assignments render strip | **Pass** |
| Active filter highlight on bookings | **Pass** |
| Strip failure does not break pages | **Pass** |
| No new mutation routes or APIs | **Pass** |
| Lifecycle / payment / assignment / RLS / commands unchanged | **Pass** (additive read path + page wiring only) |
| Targeted unit tests | **Pass** (4 tests) |
| `npm run typecheck` | **Fail** (test-file TS error — see §Test execution) |
| Operational docs updated | **Fail** (gap — see §Doc notes) |
| Admin page render / static tests | **N/A** (none in repo) |

**Overall:** Stage **7A-1** is **functionally complete and architecturally safe** for its stated scope. Fix the typecheck regression in `adminOperationalQueueCounts.test.ts` before merge. Update `admin-operational-dashboard.md` (home summary section) before calling docs “done.” Safe to start **7A-2** (queue explainability cards) once those two housekeeping items are addressed.

---

## Architecture (authoritative)

```text
ADMIN_OPERATIONAL_QUEUES (adminOperationalQueues.ts)
  → getAdminOperationalQueueCounts (server-only)
      → Promise.all × 5: countAdminBookingsByFilter(filter)
          → normalizeAdminBookingsQuery({ filter })
          → resolveAdminAssignmentFilterSql (assignment presets only)
          → bookings SELECT count exact head
          → applyAdminBookingsSqlFilters (same as listAdminBookings matchTotal path)
          → NO order/limit/enrichment
  → AdminOperationalQueueStrip (Link chips only)
```

**Read-only:** Strip uses `next/link` navigation only. No `fetch` to mutation endpoints, no server actions, no forms.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Queue definitions centralized | **Pass** | Single source: `src/features/dashboards/adminOperationalQueues.ts` — `ADMIN_OPERATIONAL_QUEUES`, `adminOperationalQueueHref`. Counts and UI consume this list. |
| 2 | Each queue links to correct `/admin/bookings?filter=` | **Pass** | `adminOperationalQueueHref` → `/admin/bookings?filter={filter}`. Tested in `adminOperationalQueues.test.ts`. Mapping below. |
| 3 | Counts use server-side SQL count path | **Pass** | `countAdminBookingsByFilter`: `select("*", { count: "exact", head: true })` + `applyAdminBookingsSqlFilters` + `resolveAdminAssignmentFilterSql` when needed. Mirrors `listAdminBookings` count branch (lines 287–292 in `adminOperationsReadModel.ts`). |
| 4 | Counts exact, not capped by 200-row list | **Pass** | No `.order()` / `.limit()` on count query. All five strip filters are server-side (`SERVER_SIDE_STATUS_FILTERS` or `SERVER_SIDE_ASSIGNMENT_FILTERS`); `hasHonestMatchTotal({ filter })` is true for each. |
| 5 | Admin home renders strip | **Pass** | `src/app/(admin)/admin/page.tsx`: `getAdminOperationalQueueCounts` → `{queueCounts?.ok ? <AdminOperationalQueueStrip … /> : null}`. Replaces prior `AdminOpsSummaryCards` (capped home summary). |
| 6 | Admin bookings renders strip + active highlight | **Pass** | `bookings/page.tsx`: parallel fetch; `<AdminOperationalQueueStrip activeFilter={filter} />`; `aria-current` when href filter matches `activeFilter`. |
| 7 | Admin assignments renders strip | **Pass** | `assignments/page.tsx`: parallel fetch; strip above queue list. |
| 8 | Strip failure does not break pages | **Pass** | All three pages: render strip only when `queueCounts.ok` (or `queueCounts?.ok`). Bookings list uses separate `listAdminBookings` result; assignments use `listAdminAssignmentQueue`. No thrown errors on count failure. |
| 9 | No new mutation routes or APIs | **Pass** | No new files under `src/app/api/`. Counts run in Server Components via `getAdminOperationalQueueCounts` only. |
| 10 | No lifecycle / payment / assignment / RLS / command changes | **Pass** | Git diff: additive files + three admin page imports. No edits to `executeBookingCommand`, payment webhooks, assignment commands, migrations, or RLS. `adminOperationsReadModel.ts` unchanged. |
| 11 | Tests pass | **Pass** | See §Test execution. |
| 12 | Docs updated | **Fail** | No `stage-7a-1` mention in `docs/`. `admin-operational-dashboard.md` still describes old home summary cards (§Doc notes). |

---

## Queue → filter mapping

| Strip label | Queue key | `filter` param | Deep link |
|-------------|-----------|----------------|-----------|
| Needs assignment | `needs_assignment` | `pending_assignment` | `/admin/bookings?filter=pending_assignment` |
| Dispatch not started | `dispatch_not_started` | `dispatch_not_started` | `/admin/bookings?filter=dispatch_not_started` |
| Recovery needed | `recovery_needed` | `recovery_needed` | `/admin/bookings?filter=recovery_needed` |
| Payment attention | `payment_attention` | `payment_failed` | `/admin/bookings?filter=payment_failed` |
| Assignment attention | `assignment_attention` | `assignment_attention` | `/admin/bookings?filter=assignment_attention` |

Aligns with `AdminBookingsFilters` `FILTER_OPTIONS` and Stage 6C filter inventory.

---

## Count accuracy vs list `matchTotal`

For each strip queue, `countAdminBookingsByFilter(filter)` applies the **same WHERE** as `listAdminBookings(user, { filter })` → `matchTotal` (filter-only, no `q`/dates). Verified by code path parity:

| Strip filter | SQL mechanism (6C) |
|--------------|-------------------|
| `pending_assignment` | `eq(status, pending_assignment)` |
| `payment_failed` | `eq(status, payment_failed)` |
| `dispatch_not_started` | Reason ILIKE + recovery-candidate ids OR |
| `recovery_needed` | Same bundle as dispatch |
| `assignment_attention` | Composed four-branch OR (6C-3d) |

**Not used for strip counts:** `listAdminBookings()` without filter (200 cap), `getAdminOperationsSummary` (capped scan), `listAdminAssignmentQueue` (100-booking scan, different inclusion rules).

---

## Known semantic distinction (document for 7A-2)

| Surface | What it counts |
|---------|----------------|
| **Assignment attention chip** | Bookings matching `filter=assignment_attention` (6C SQL, global exact) |
| **`/admin/assignments` work queue** | Scan of up to 100 `pending_assignment` / `confirmed` rows, in-app attention heuristics — **not** identical to assignment_attention filter count |

Strip copy states: *“Exact counts across all bookings.”* This is accurate for chips. 7A-2 explainability should clarify assignment chip vs assignments page when admins compare numbers.

---

## Failure and performance behavior

| Scenario | Behavior |
|----------|----------|
| Count query error | `getAdminOperationalQueueCounts` → `{ ok: false }`; page renders without strip |
| Non-admin | `FORBIDDEN`; strip omitted |
| Supabase unconfigured | `AUTH_NOT_CONFIGURED`; strip omitted |
| Page load cost | **5 parallel** head-count queries per page that shows strip (home, bookings, assignments) |

No unbounded polling or realtime subscriptions.

---

## Test execution summary

| Command / suite | Result |
|-----------------|--------|
| `npm run typecheck` | **Fail** — `adminOperationalQueueCounts.test.ts(67,63)`: `then` callback type `data: []` vs `never[]` |
| `adminOperationalQueues.test.ts` | **Pass** (1 test) |
| `adminOperationalQueueCounts.test.ts` | **Pass** (3 tests; vitest run succeeds despite tsc failure on same file) |
| Admin page render / static tests | **N/A** — no `admin/page.test` or similar in repo |

**Bundled vitest run:** 2 files, 4 tests, all passed.

---

## Files touched (7A-1 scope)

| File | Role |
|------|------|
| `src/features/dashboards/adminOperationalQueues.ts` | Central queue definitions |
| `src/features/dashboards/server/adminOperationalQueueCounts.ts` | Count read model |
| `src/components/dashboard/AdminOperationalQueueStrip.tsx` | UI strip |
| `src/app/(admin)/admin/page.tsx` | Home strip |
| `src/app/(admin)/admin/bookings/page.tsx` | Bookings strip + active filter |
| `src/app/(admin)/admin/assignments/page.tsx` | Assignments strip |
| `*/*.test.ts` | Config + count tests |

**Orphaned (harmless):** `AdminOpsSummaryCards.tsx`, `getAdminOperationsSummary` — no longer used on home; safe to remove in a later cleanup slice.

**Unrelated working-tree changes (out of 7A-1 scope):** `paymentFailed.test.ts`, `rlsTestSupport.ts`, `serviceRoleLifecycleWriteRegistry.test.ts`.

---

## Behavior unchanged (confirmed)

| Layer | 7A-1 impact |
|-------|-------------|
| Booking lifecycle transitions | None |
| Payment capture / webhooks | None |
| Assignment engine / dispatch / recovery commands | None |
| Notification delivery | None |
| RLS policies | None — no migrations |
| `listAdminBookings` / filter SQL helpers | None — reused, not modified |
| `GET /api/admin/bookings` | None |

---

## Doc notes

| Document | Status |
|----------|--------|
| This audit | Created |
| `docs/operations/admin-operational-dashboard.md` | **Stale** — §“Summary counts (home)” still describes three large cards and capped queue totals; should document operational queue strip, exact per-filter counts, and assignment chip vs assignments page |
| `docs/operations/stage-6-ui-polish.md` | No 7A-1 cross-reference (optional) |

---

## Pre-7A-2 recommendations

1. Fix `adminOperationalQueueCounts.test.ts` type error so `npm run typecheck` passes.
2. Update `admin-operational-dashboard.md` home section for the strip.
3. In 7A-2, add per-queue explainability (why, severity, recommended action) without changing count semantics or adding mutations.

---

## Final question

**Is Stage 7A-1 complete and safe enough to move to 7A-2 queue explainability cards?**

**Yes**, with two pre-flight items:

- **Complete** for 7A-1 scope: read-only strip, centralized queues, exact SQL counts, correct deep links, three admin surfaces, graceful degradation, no core architecture changes.
- **Safe** for 7A-2: explainability can extend `ADMIN_OPERATIONAL_QUEUES` and chip UI without touching lifecycle, payment, or assignment commands.
- **Before merge / parallel to 7A-2 kickoff:** resolve typecheck failure and refresh operational dashboard docs so admins are not misled by outdated home-card documentation.
