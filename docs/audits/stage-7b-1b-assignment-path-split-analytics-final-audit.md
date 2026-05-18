# Stage 7B-1b-min — Assignment Path Split Analytics Final Audit

**Date:** 2026-05-18  
**Type:** Audit only — no code changes  
**Scope:** Path-split offer created/accepted metrics on `assignment_metrics_hourly`, read-only path resolver, rollup/live/7d read models, `/admin/analytics/assignments` path breakdown UI  
**Related:** [stage-7b-1b-assignment-path-split-analytics-design.md](../architecture/stage-7b-1b-assignment-path-split-analytics-design.md), [stage-7b-1a-assignment-funnel-analytics-final-audit.md](./stage-7b-1a-assignment-funnel-analytics-final-audit.md), [stage-7b-assignment-funnel-analytics-design.md](../architecture/stage-7b-assignment-funnel-analytics-design.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Migration adds exactly 8 path columns | **Pass** |
| Columns `integer not null default 0` + `check (>= 0)` | **Pass** |
| RLS on `assignment_metrics_hourly` unchanged | **Pass** |
| Path resolver read-only (no metadata mutation) | **Pass** |
| Resolver maps `selected` / `best_available` / `admin_manual` / `unknown` | **Pass** |
| Rollup counts created + accepted by path | **Pass** |
| Path sums equal global created/accepted counts | **Pass** (unit-tested) |
| 24h/7d DTOs counts and rates only — no IDs/PII | **Pass** |
| UI path breakdown + metadata caveat | **Pass** |
| Assignment engine / offers / commands unchanged | **Pass** |
| `npm run typecheck` | **Pass** |
| Targeted unit tests (21 + 3 regression) | **Pass** |
| Docs updated | **Pass** |

**Overall:** Stage **7B-1b-min** is **complete, additive, PII-free in admin surfaces**, and **does not change assignment behavior**. Safe to begin **7B-1c** (median latency metrics) **design** after ops applies the path-split migration and runs rollup backfill for 7d path trends.

---

## Architecture (7B-1b-min delta on 7B-1a)

```text
assignment_offers + bookings.metadata + booking_locks (read-only)
  → resolveAssignmentAnalyticsPathFromSignals / buildAssignmentAnalyticsPathByBookingId
  → aggregateAssignmentMetricsPathHourly (per bucket)
      → assignment_metrics_hourly (+ 8 path columns)
  → loadAssignmentAnalytics24h.byPath (24h live)
  → buildAssignmentTrends7d.byPath7d (7d rollups)
  → AdminAssignmentAnalyticsPanel — path breakdown section
```

**Read-only:** Resolver and rollup only **SELECT** booking metadata/locks; no `RECORD_ASSIGNMENT_ATTENTION`, no offer writes, no command calls from analytics modules.

**Known limitation (documented, acceptable for min slice):** Path is resolved from **current** `bookings.metadata.assignment.path` (and lock fallback) at rollup/read time — not per-offer historical snapshot. Per-offer `assignment_path` remains deferred to **7B-4**.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Migration adds exactly 8 path-split columns | **Pass** | `supabase/migrations/20260521103000_assignment_metrics_hourly_path_split.sql`; `assignment-metrics-hourly-path-split.migration.test.ts` |
| 2 | Columns `integer not null default 0` | **Pass** | All eight `add column … integer not null default 0 check (… >= 0)` |
| 3 | RLS on `assignment_metrics_hourly` unchanged | **Pass** | Path migration has no `create policy` / `drop policy`; 7B-1a policy `assignment_metrics_hourly_select_admin` unchanged (`assignmentMetricsHourlyRlsPhase7bPolicy.test.ts`) |
| 4 | Path resolver is read-only | **Pass** | `resolveAssignmentAnalyticsPath.ts` — only `readAssignmentMetadata`, `findLockByBookingId`, `select` on `bookings`/`booking_locks`; no `update`/`insert`/`recordAssignmentOutcome` |
| 5 | Resolver maps `selected` correctly | **Pass** | `mapEnginePathToAnalyticsPath("selected")`; metadata + lock `mode: selected` tests |
| 6 | Resolver maps `best_available` correctly | **Pass** | `best_available` and `fallback_best_available` → `best_available`; lock/metadata fallback tests |
| 7 | Resolver maps `admin_manual` correctly | **Pass** | `mapEnginePathToAnalyticsPath("admin_manual")`; metadata test |
| 8 | Resolver falls back to `unknown` when ambiguous | **Pass** | `null` metadata + no lock → `unknown`; empty `{}` → `unknown` |
| 9 | Rollup counts created offers by path | **Pass** | `aggregateAssignmentMetricsPathHourly` increments `offers_created_*` for `offered_at` in bucket |
| 10 | Rollup counts accepted offers by path | **Pass** | Same function; `status === "accepted"` with terminal timestamp in bucket |
| 11 | Path created sum = `offers_created_count` | **Pass** | `sumPathCreatedCounts(path) === global.offers_created_count` in `assignmentAnalyticsPathMetrics.test.ts` |
| 12 | Path accepted sum = `offers_accepted_count` | **Pass** | `sumPathAcceptedCounts(path) === global.offers_accepted_count` in same test |
| 13 | 24h DTO exposes counts/rates only, no IDs/PII | **Pass** | `AdminAssignmentAnalytics24h.byPath`; `assignmentAnalyticsReadModel.test.ts` forbids `booking_id`, `cleaner_id`, `email`, etc. |
| 14 | UI renders path breakdown and caveat | **Pass** | `AdminAssignmentAnalyticsPanel` — “Assignment path breakdown”, selected/best/admin cards, metadata caveat; panel tests |
| 15 | Assignment engine / offers / commands unchanged | **Pass** | No edits to `executeBookingCommand`, `createDispatchOffer`, `recordAssignmentOutcome`, `processBookingAfterOfferEnded`, `respondToOffer`, offer cron; analytics modules only |
| 16 | Tests pass | **Pass** | See §Test execution |
| 17 | Docs updated | **Pass** | `admin-operational-dashboard.md` §7B-1b-min; `stage-7b-1b-…-design.md` shipped; `stage-7b-assignment-funnel-analytics-design.md` status |

---

## Migration (additive)

**File:** `supabase/migrations/20260521103000_assignment_metrics_hourly_path_split.sql`

| Column | Purpose |
|--------|---------|
| `offers_created_selected_count` | Offers created in bucket, path = selected |
| `offers_created_best_available_count` | Path = best_available (incl. `fallback_best_available`) |
| `offers_created_admin_manual_count` | Path = admin_manual |
| `offers_created_unknown_count` | Unresolved path |
| `offers_accepted_selected_count` | Accepted in bucket by path |
| `offers_accepted_best_available_count` | |
| `offers_accepted_admin_manual_count` | |
| `offers_accepted_unknown_count` | |

No new tables. No RLS/grant changes. Existing `service_role` upsert and admin `SELECT` policy cover new columns automatically.

---

## Path resolver

| Input (priority) | Maps to |
|------------------|---------|
| `metadata.assignment.path` | `selected`, `best_available`, `admin_manual`; `fallback_best_available` → `best_available` |
| `booking_locks.locked_cleaner_preference.mode` | `selected` or `best_available` |
| `metadata.cleanerPreferenceMode` | Same fallback |
| None of the above | `unknown` |

**Functions:** `resolveAssignmentAnalyticsPathFromSignals`, `resolveAssignmentAnalyticsPathForBooking`, `buildAssignmentAnalyticsPathByBookingId`.

---

## Rollup and live metrics

| Behavior | Implementation |
|----------|----------------|
| Path source per offer | `pathByBookingId.get(offer.booking_id) ?? "unknown"` |
| Created bucket | `offered_at` in `[bucketStart, bucketEnd)` |
| Accepted bucket | `responded_at` in window, `status === accepted` |
| Global counters | Unchanged `aggregateAssignmentMetricsHourly` (7B-1a) |
| Upsert row | `{ ...globalCounters, ...pathCounters }` in `rollupAssignmentMetricsHourly` |
| 24h accept rate by path | Terminal count in path ≥ 10 (`PATH_ACCEPT_RATE_MIN_TERMINAL`) |
| 7d accept rate by path | Created in path ≥ 10 (`computePathAcceptRateFromCreatedPercent`) |

**Internal reads:** Rollup/live batch-fetch `bookings.id, metadata` and active `booking_locks` by `booking_id`. IDs used server-side only; not stored in rollup table or admin DTOs.

---

## UI and DTO safety

| Surface | Exposed fields |
|---------|----------------|
| `live24h.byPath[path]` | `offersCreated`, `offersAccepted`, `acceptRatePercent`, `acceptRateLabel` |
| `trends7d.byPath7d[path]` | `offersCreated7d`, `offersAccepted7d`, `acceptRate7dPercent`, `acceptRate7dLabel` |
| UI | Text/cards only; “Not enough data” when rate gated; unknown row only if nonzero (24h) |

**Caveat copy (UI):** “Path is derived from current booking metadata; historical path accuracy improves in a later snapshot stage.”

---

## Assignment behavior unchanged

Verified: analytics path modules do not import or call:

- `executeBookingCommand`
- `createDispatchOffer` / `recordAssignmentOutcome`
- `processBookingAfterOfferEnded` / `respondToOffer`
- Offer expiry cron routes

No `assignment_path` column added to `assignment_offers`. No RLS changes on `assignment_offers`, `bookings`, or `booking_state_audit`.

**7A operational queues:** Not modified by 7B-1b-min files (separate dashboard modules).

---

## Test execution

```text
npm run typecheck                                    → Pass
vitest (9 files, 21 tests)                           → Pass
  - assignment-metrics-hourly.migration.test.ts
  - assignment-metrics-hourly-path-split.migration.test.ts
  - assignmentMetricsHourlyRlsPhase7bPolicy.test.ts
  - resolveAssignmentAnalyticsPath.test.ts
  - assignmentAnalyticsPathMetrics.test.ts
  - assignmentAnalyticsPathDto.test.ts
  - rollupAssignmentMetricsHourly.test.ts
  - assignmentAnalyticsReadModel.test.ts
  - AdminAssignmentAnalyticsPanel.test.tsx
vitest assignmentMetricsAggregate.test.ts (7B-1a)    → Pass (3 tests)
```

---

## Documentation

| Doc | Status |
|-----|--------|
| `docs/architecture/stage-7b-1b-assignment-path-split-analytics-design.md` | **7B-1b-min shipped** |
| `docs/architecture/stage-7b-assignment-funnel-analytics-design.md` | Path split marked shipped |
| `docs/operations/admin-operational-dashboard.md` | Path taxonomy, caveat, deferred items |

---

## Deferred (not blockers for 7B-1c design)

| Item | Phase |
|------|-------|
| `assignment_offers.assignment_path` at insert (accurate history) | **7B-4** |
| Decline / expire / cancel by path | **7B-1b-full** |
| Separate `fallback` UI row | Optional |
| Median latency cards (global + optional by path) | **7B-1c** |
| Charts, cleaner-level analytics, home teaser | Later |

---

## Ops notes (post-deploy)

1. Apply migration `20260521103000_assignment_metrics_hourly_path_split.sql`.
2. Run `/api/cron/rollup-assignment-metrics` (or backfill) so 7d path columns populate; until backfill, path 7d lines may show zeros with partial-coverage note.
3. Expect **snapshot bias** on multi-offer bookings until 7B-4.

---

## Final question

**Is 7B-1b-min complete and safe enough to move to 7B-1c latency metrics design?**

**Yes.**

- All 17 audit checks **pass**.
- Implementation is **additive** and **read-only** relative to assignment operations.
- Admin surfaces remain **PII-free** (integer counts and rates only).
- Documented metadata snapshot bias is an accepted tradeoff for the min slice; it does not block designing **7B-1c** median time-to-offer / time-to-accept / response-time cards on the same rollup + live query pattern.

**Recommended before 7B-1c implementation (not design):** Apply the path-split migration and backfill hourly rollups in the target environment so 7d path and global metrics stay aligned in production.
