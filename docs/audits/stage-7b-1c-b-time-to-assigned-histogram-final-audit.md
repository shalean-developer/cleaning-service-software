# Stage 7B-1c-b-min — 7d Time-to-Assigned Histogram Rollup Final Audit

**Date:** 2026-05-18  
**Type:** Audit only — no code changes  
**Scope:** 7-day approximate median **time-to-assigned** via hourly histogram rollups on `assignment_metrics_hourly` — migration, rollup cron path, read model, UI; no cleaner-response / time-to-first-offer histograms  
**Related:** [stage-7b-1c-b-assignment-latency-histogram-rollups-design.md](../architecture/stage-7b-1c-b-assignment-latency-histogram-rollups-design.md), [stage-7b-1c-assignment-latency-metrics-design.md](../architecture/stage-7b-1c-assignment-latency-metrics-design.md), [stage-7b-1c-live-assignment-latency-final-audit.md](./stage-7b-1c-live-assignment-latency-final-audit.md), [stage-7b-1b-assignment-path-split-analytics-final-audit.md](./stage-7b-1b-assignment-path-split-analytics-final-audit.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Migration — 8 histogram columns, non-negative | **Pass** |
| No RLS policy changes | **Pass** |
| Bucket boundaries match design | **Pass** |
| Duration formula + exclusions | **Pass** |
| Rollup extends existing cron path only | **Pass** |
| Funnel/path counters logic unchanged | **Pass** |
| 7d merge over 168h + approximate median | **Pass** |
| DTO PII-free (no IDs, timestamps, buckets) | **Pass** |
| UI — one 7d approximate card | **Pass** |
| Assignment engine / commands / operational RLS unchanged | **Pass** |
| `npm run typecheck` | **Pass** |
| Targeted unit tests (36) | **Pass** |
| Docs updated | **Pass** |

**Overall:** Stage **7B-1c-b-min** is **complete, additive, PII-free in admin surfaces**, and **does not change assignment behavior**. Safe to proceed to **7B-1c-b** (cleaner-response + time-to-first-offer 7d histograms using the same pattern) after ops applies the migration and runs a **168h backfill**. A **Stage 7B consolidation audit** remains optional before path-split latency (7B-1d).

---

## Architecture (7B-1c-b-min delta on 7B-1a / 7B-1b / 7B-1c-min)

```text
booking_state_audit (MOVE_TO_PENDING_ASSIGNMENT, ACCEPT_CLEANER_ASSIGNMENT)
  → rollupAssignmentMetricsHourly (closed UTC hour)
  → collectTimeToAssignedDurationsMinutes + durationsToTimeToAssignedHistogram
  → assignment_metrics_hourly (+ 8 integer bucket columns)
  → buildAssignmentLatencyTrends7d (merge 168h current window)
  → approximateMedianMinutesFromHistogram (bucket midpoint)
  → AdminAssignmentAnalyticsPanel — “Assignment latency (7d rollup)”
```

**Read-only on operational tables:** Rollup **SELECT** only; upsert targets `assignment_metrics_hourly` (existing `service_role` grant). No writes to offers, bookings, or audit from analytics code.

**24h live latency (7B-1c-min)** remains a separate exact-median path — unchanged.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Migration adds exactly **8** histogram columns | **Pass** | `supabase/migrations/20260522120000_assignment_metrics_hourly_time_to_assigned_histogram.sql` — 7 bucket counts + `time_to_assigned_sample_count`; `assignment-metrics-hourly-time-to-assigned-histogram.migration.test.ts` |
| 2 | Columns `integer not null default 0` | **Pass** | Each `add column` line in migration SQL |
| 3 | Columns have `check (>= 0)` | **Pass** | Per-column `check (... >= 0)` in migration; migration test asserts pattern |
| 4 | No RLS policy changes | **Pass** | Migration has no `create policy` / `drop policy`; `assignmentMetricsHourlyRlsPhase7bPolicy.test.ts` still targets 7B-1a policy only |
| 5 | Buckets: 0–15m, 15–60m, 1–4h, 4–12h, 12–24h, 24–48h, 48h+ | **Pass** | `TIME_TO_ASSIGNED_DURATION_BUCKETS` in `assignmentLatencyHistogram.ts`; `durationMinutesToBucketIndex` tests boundaries |
| 6 | Duration = `ACCEPT_CLEANER_ASSIGNMENT` − first `MOVE_TO_PENDING_ASSIGNMENT` | **Pass** | Rollup: `fetchAcceptAssignmentAuditsInBucket` + `fetchFirstPendingAssignmentAuditByBookingIds` + `collectTimeToAssignedDurationsMinutes`; test `computes time-to-assigned from first pending and accept audit timestamps` |
| 7 | Missing anchors excluded | **Pass** | `collectTimeToAssignedDurationsMinutes` — `if (!pendingAt) continue`; bookings without pending audit produce no duration |
| 8 | Negative durations excluded | **Pass** | `durationMinutesBetween` returns `null` when `end < start`; `durationMinutesToBucketIndex` rejects negative; test `returns null for negative durations` |
| 9 | Rollup populates histogram in **existing** cron path | **Pass** | `rollupAssignmentMetricsHourly` spreads `...timeToAssignedHistogram` into upsert row; no new cron route; `/api/cron/rollup-assignment-metrics` unchanged |
| 10 | Existing funnel/path counters unchanged | **Pass** | Same `aggregateAssignmentMetricsHourly` + `aggregateAssignmentMetricsPathHourly` calls and args before histogram; histogram added via object spread only |
| 11 | 7d read model merges **last 168** hourly buckets | **Pass** | `buildAssignmentLatencyTrends7d` uses `partitionAssignmentBucketsByTrendWindow` → `current7d` where `TRENDS_7D_HOURS = 24 * 7` |
| 12 | Approximate median = cumulative rank + bucket midpoint | **Pass** | `approximateMedianMinutesFromHistogram` — `targetRank = ceil(n/2)`, walk buckets, return `midpointMinutes`; histogram tests |
| 13 | DTO: `approximateMedianMinutes`, `sampleCount`, `status` only (metric) | **Pass** | `AssignmentLatencyApproximateMetricDto` in `assignmentLatencyTrends7d.ts` |
| 14 | DTO: no IDs, timestamps, bucket breakdown | **Pass** | `assignmentLatencyTrends7d.test.ts` — `JSON.stringify` has no `bucket_`, `booking_id`; read-model `assertNoPii` |
| 15 | UI: one 7d card + approximate copy | **Pass** | `AdminAssignmentAnalyticsPanel` — “7d median time to assigned”, `~` prefix via `formatApproximateLatencyMetricDisplay`, “bucket midpoints”; panel test |
| 16 | No assignment engine / command / operational RLS changes | **Pass** | No matches under `commands/` for latency symbols; histogram migration only alters `assignment_metrics_hourly` columns |
| 17 | Tests pass | **Pass** | See §Test execution |
| 18 | Docs updated | **Pass** | See §Documentation |

---

## Migration (verified)

**File:** `supabase/migrations/20260522120000_assignment_metrics_hourly_time_to_assigned_histogram.sql`

| Column | Purpose |
|--------|---------|
| `time_to_assigned_bucket_0_15m_count` | Durations \[0, 15) minutes |
| `time_to_assigned_bucket_15_60m_count` | \[15, 60) |
| `time_to_assigned_bucket_1_4h_count` | \[60, 240) |
| `time_to_assigned_bucket_4_12h_count` | \[240, 720) |
| `time_to_assigned_bucket_12_24h_count` | \[720, 1440) |
| `time_to_assigned_bucket_24_48h_count` | \[1440, 2880) |
| `time_to_assigned_bucket_48h_plus_count` | \[2880, ∞) |
| `time_to_assigned_sample_count` | Observation count in hour |

**Storage:** Integer counts only — **no** raw duration samples, UUIDs, or timestamps in rollup rows.

---

## Rollup behavior (verified)

| Step | Implementation |
|------|----------------|
| Hour window | Same closed UTC hour as 7B-1a (`resolveRollupBucketStart` / `bucketEndExclusive`) |
| Accept events | `fetchAcceptAssignmentAuditsInBucket` — `command = 'ACCEPT_CLEANER_ASSIGNMENT'` in bucket |
| Pending anchor | `fetchFirstPendingAssignmentAuditByBookingIds` — `min(created_at)` per booking for `MOVE_TO_PENDING_ASSIGNMENT` |
| Histogram | `durationsToTimeToAssignedHistogram(collectTimeToAssignedDurationsMinutes(...))` |
| Upsert | Existing `assignment_metrics_hourly` upsert on `bucket_start` — funnel + path + histogram columns |

**Funnel counters:** `assignedBookingIds` still derived from accept audits (same booking set as before histogram work). `bookings_assigned_count` logic in `aggregateAssignmentMetricsHourly` is untouched.

---

## Read model & DTO (verified)

| Concern | Behavior |
|---------|----------|
| Data load | `METRICS_HOURLY_SELECT` includes 8 histogram columns; 14d bucket fetch (shared with funnel trends) |
| 7d window | `buildAssignmentLatencyTrends7d` merges **current** 7d partition only (168 hours) |
| Sample gate | `ASSIGNMENT_LATENCY_MIN_SAMPLE = 10` — same as 24h live |
| Coverage | `coverageHours7d`, `coverageComplete`, `partialCoverageNote` when &lt; 90% of 168 buckets |
| Admin payload | `latencyTrends7d.timeToAssigned` only — no per-bucket arrays |

**Parity note:** 7d figure is **approximate** (histogram midpoint); 24h live `latency24h.timeToAssigned` remains **exact** (sort-based median). UI copy states this.

---

## UI (verified)

| Element | Present |
|---------|---------|
| Section | “Assignment latency (7d rollup)” |
| Card | “7d median time to assigned” |
| Approximate label | `~` prefix when `status === "ok"` |
| Insufficient data | When `n < 10` |
| Footnotes | Bucket midpoints, rollup/backfill, deferred metrics |
| Charts | **None** |

---

## Privacy & safety

| Rule | Status |
|------|--------|
| No booking/customer/cleaner IDs in rollup or DTO | **Pass** |
| No raw timestamps in serialized admin JSON | **Pass** |
| No bucket breakdown exposed to admin | **Pass** |
| No cleaner-level dimensions | **Pass** |
| No assignment command / engine changes | **Pass** |
| Additive analytics columns only | **Pass** |

**Internal:** `booking_id` used only in server rollup queries and pure-function inputs — stripped before page DTO.

---

## Test execution

```text
npm run typecheck                                    → Pass
vitest (migration + RLS + histogram + rollup + trends7d + read model + panel) → 26 passed
vitest (assignmentLatencyMetrics + Dto + ReadModel)  → 10 passed (7B-1c-min regression)
Total targeted                                       → 36 passed
```

| Suite | File |
|-------|------|
| Migration | `assignment-metrics-hourly-time-to-assigned-histogram.migration.test.ts` |
| RLS catalog | `assignmentMetricsHourlyRlsPhase7bPolicy.test.ts` |
| Histogram | `assignmentLatencyHistogram.test.ts` |
| Rollup | `rollupAssignmentMetricsHourly.test.ts` |
| 7d trends | `assignmentLatencyTrends7d.test.ts` |
| Read model / PII | `assignmentAnalyticsReadModel.test.ts` |
| UI | `AdminAssignmentAnalyticsPanel.test.tsx` |
| 24h regression | `assignmentLatencyMetrics.test.ts`, `assignmentLatencyDto.test.ts`, `assignmentLatencyReadModel.test.ts` |

---

## Documentation

| Doc | Updated |
|-----|---------|
| `docs/architecture/stage-7b-1c-b-assignment-latency-histogram-rollups-design.md` | **7B-1c-b-min shipped** section |
| `docs/architecture/stage-7b-assignment-funnel-analytics-design.md` | Status + shipped row |
| `docs/operations/admin-operational-dashboard.md` | §Assignment latency 7d rollup (7B-1c-b-min) |

---

## Ops prerequisites (post-audit)

1. Apply migration `20260522120000_assignment_metrics_hourly_time_to_assigned_histogram.sql`.
2. Run rollup backfill for **168h** (`backfillAssignmentMetricsHourly` or hourly cron) so the 7d card has data.
3. Until backfill completes, expect partial coverage note and possible “Insufficient data” if `sample_count` &lt; 10.

---

## Deferred (unchanged)

| Item | Stage |
|------|-------|
| Cleaner response 7d histogram | 7B-1c-b |
| Time-to-first-offer 7d histogram | 7B-1c-b |
| Path-split latency | 7B-1d (after assignment path snapshot) |
| p90, charts, expired open-duration | Later |

---

## Final question

**Is 7B-1c-b-min complete and safe enough to move to cleaner-response / first-offer 7d histograms, or should Stage 7B be frozen here?**

**Verdict: 7B-1c-b-min is complete and safe.** Proceed to **7B-1c-b** (add the remaining two histogram families on `assignment_metrics_hourly` using the same rollup + merge + approximate-median pattern) **after** migration apply and 168h backfill in each environment.

**Freezing all of Stage 7B** is **not required** for safety — the slice is additive and isolated. Optional pause points:

- Run a **Stage 7B consolidation audit** (7B-1a + 7B-1b + 7B-1c-min + 7B-1c-b-min together) before expanding analytics further.
- **Defer path-split latency (7B-1d)** until per-offer `assignment_path` snapshot (7B-4) — independent of whether you ship cleaner-response / first-offer histograms next.

**Recommendation:** Ship **7B-1c-b** (two remaining global histograms) next; keep path-split and charts deferred; run consolidation audit when product wants a single 7B sign-off gate.
