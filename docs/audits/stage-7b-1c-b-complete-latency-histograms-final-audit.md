# Stage 7B-1c-b — Complete 7d Assignment Latency Histograms Final Audit

**Date:** 2026-05-18  
**Type:** Audit only — no code changes  
**Scope:** All three global 7d latency histograms (time-to-assigned, cleaner response, time-to-first-offer) — migrations, rollup cron path, read model, DTO, UI; assignment behavior unchanged  
**Related:** [stage-7b-1c-b-assignment-latency-histogram-rollups-design.md](../architecture/stage-7b-1c-b-assignment-latency-histogram-rollups-design.md), [stage-7b-1c-b-time-to-assigned-histogram-final-audit.md](./stage-7b-1c-b-time-to-assigned-histogram-final-audit.md), [stage-7b-1c-live-assignment-latency-final-audit.md](./stage-7b-1c-live-assignment-latency-final-audit.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Migrations — cleaner-response + time-to-first-offer columns | **Pass** |
| Migration — time-to-assigned unchanged (7B-1c-b-min) | **Pass** |
| Integer NOT NULL DEFAULT 0 + non-negative checks (all 24 histogram columns) | **Pass** |
| No RLS policy changes | **Pass** |
| Duration formulas + exclusions | **Pass** |
| Rollup uses existing assignment metrics cron path | **Pass** |
| Funnel/path counters logic unchanged | **Pass** |
| 7d merge (168h) + approximate median | **Pass** |
| DTO PII-free | **Pass** |
| UI — three 7d latency cards + insufficient data | **Pass** |
| Assignment engine / commands / operational RLS unchanged | **Pass** |
| `npm run typecheck` | **Pass** |
| Targeted unit tests (27) | **Pass** |
| Docs updated | **Pass** (minor header staleness in one architecture doc — see §Documentation) |

**Overall:** Stage **7B-1c-b** is **complete, additive, PII-free in admin surfaces**, and **does not change assignment behavior**. Safe to **freeze the Stage 7B analytics baseline** for global funnel + global latency after ops applies both histogram migrations and runs a **168h backfill**. **7B-4** (`assignment_path` snapshot) remains the recommended next slice if path accuracy matters more than further global analytics polish.

---

## Architecture

```text
booking_state_audit (MOVE_TO_PENDING_ASSIGNMENT, ACCEPT_CLEANER_ASSIGNMENT)
assignment_offers (offered_at, responded_at, status)
  → rollupAssignmentMetricsHourly (closed UTC hour, existing cron)
  → collect*DurationsMinutes + durationsTo*Histogram
  → assignment_metrics_hourly (+ 24 histogram integer columns)
  → buildAssignmentLatencyTrends7d (merge current7d ≈ 168 buckets)
  → approximateMedianMinutesFromLatencyHistogram (midpoint + cumulative rank)
  → AdminAssignmentAnalyticsPanel — “Assignment latency (7d rollup)” (3 cards)
```

**Read-only on operational tables:** Rollup **SELECT** only; upsert targets `assignment_metrics_hourly` (`service_role`). No writes to offers, bookings, or audit from analytics code.

**24h live latency (7B-1c-min)** remains a separate exact-median path — unchanged.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Migration adds cleaner-response histogram columns | **Pass** | `supabase/migrations/20260522130000_assignment_metrics_hourly_latency_histograms.sql` — 7 buckets + `cleaner_response_sample_count`; `assignment-metrics-hourly-latency-histograms.migration.test.ts` |
| 2 | Migration adds time-to-first-offer histogram columns | **Pass** | Same migration — 7 buckets + `time_to_first_offer_sample_count`; migration test |
| 3 | Existing time-to-assigned histogram remains unchanged | **Pass** | `20260522120000_assignment_metrics_hourly_time_to_assigned_histogram.sql` — separate migration, not modified by 7B-1c-b full migration; rollup still uses `durationsToTimeToAssignedHistogram` / `collectTimeToAssignedDurationsMinutes` |
| 4 | All histogram columns `integer not null default 0` | **Pass** | Every `add column` in both histogram migrations |
| 5 | All histogram columns have non-negative checks | **Pass** | Per-column `check (... >= 0)` in both migrations; migration tests assert patterns |
| 6 | No RLS policy changes | **Pass** | Neither histogram migration contains `create policy` / `drop policy`; `assignmentMetricsHourlyRlsPhase7bPolicy.test.ts` still targets 7B-1a policy only |
| 7 | Cleaner response duration = `responded_at − offered_at` | **Pass** | `collectCleanerResponseDurationsMinutes` → `durationMinutesBetween(offer.offered_at, offer.responded_at)` |
| 8 | Cleaner response includes accepted/declined only | **Pass** | `if (offer.status !== "accepted" && offer.status !== "declined") continue`; test excludes expired, open, cancelled |
| 9 | Cleaner response excludes expired/open/cancelled/missing responded_at/negative durations | **Pass** | Status filter + `if (!offer.responded_at) continue` + `isTimestampInBucket(responded_at)` + `durationMinutesBetween` null on negative |
| 10 | Time-to-first-offer = `min(offered_at) − first MOVE_TO_PENDING_ASSIGNMENT` | **Pass** | `minOfferedAtByBooking` + `fetchFirstPendingAssignmentAuditByBookingIds` (`min(created_at)` per booking) + `durationMinutesBetween(pendingAt, firstOfferedAt)` |
| 11 | Time-to-first-offer requires first offer in bucket hour | **Pass** | `if (!isTimestampInBucket(firstOfferedAt, bucketStart, bucketEnd)) continue` |
| 12 | Time-to-first-offer excludes missing anchors/negative durations | **Pass** | `if (!pendingAt) continue`; `durationMinutesBetween` returns null when end &lt; start |
| 13 | Time-to-assigned behavior remains unchanged | **Pass** | Same as 7B-1c-b-min: accept audits in bucket + first pending anchor + `collectTimeToAssignedDurationsMinutes`; no bucket filter on accept time beyond fetch-in-bucket |
| 14 | Rollup uses existing assignment metrics cron path | **Pass** | `rollupAssignmentMetricsHourly` spreads three histogram objects into upsert; `/api/cron/rollup-assignment-metrics` unchanged |
| 15 | Funnel/path counters remain unchanged | **Pass** | Same `aggregateAssignmentMetricsHourly` + `aggregateAssignmentMetricsPathHourly` before histogram spread; `assignmentAnalyticsReadModel.test.ts` — “keeps 7B funnel metrics independent” |
| 16 | 7d read model merges 168 hourly buckets | **Pass** | `buildAssignmentLatencyTrends7d` → `partitionAssignmentBucketsByTrendWindow` → `current7d`; `TRENDS_FULL_COVERAGE_HOURS = 24 * 7` |
| 17 | Approximate median uses bucket midpoint / cumulative rank | **Pass** | `approximateMedianMinutesFromLatencyHistogram` — `targetRank = ceil(n/2)`, walk buckets, return `midpointMinutes` |
| 18 | DTO exposes only `approximateMedianMinutes`, `sampleCount`, `status` | **Pass** | `AssignmentLatencyApproximateMetricDto` in `assignmentLatencyTrends7d.ts` |
| 19 | DTO exposes no IDs, timestamps, or bucket breakdown | **Pass** | `assignmentLatencyTrends7d.test.ts` — serialized JSON has no `bucket_` or `booking_id`; `assignmentAnalyticsReadModel.test.ts` — `assertNoPii` on `latencyTrends7d` |
| 20 | UI renders three 7d latency cards | **Pass** | `AdminAssignmentAnalyticsPanel` — three `LatencyApproximateMetricCard` entries; panel test asserts labels |
| 21 | UI handles insufficient data | **Pass** | `formatApproximateLatencyMetricDisplay` + `LatencyApproximateMetricCard` sample hints; panel test for low sample |
| 22 | No assignment engine / command / RLS behavior changed | **Pass** | No latency/histogram symbols in `executeBookingCommand.ts`; histogram migrations only alter `assignment_metrics_hourly` columns |
| 23 | Tests pass | **Pass** | See §Test execution |
| 24 | Docs updated | **Pass** (minor) | See §Documentation |

---

## Migrations (verified)

### Time-to-assigned (7B-1c-b-min) — unchanged

**File:** `supabase/migrations/20260522120000_assignment_metrics_hourly_time_to_assigned_histogram.sql`  
8 columns: 7 buckets + `time_to_assigned_sample_count`.

### Cleaner response + time-to-first-offer (7B-1c-b)

**File:** `supabase/migrations/20260522130000_assignment_metrics_hourly_latency_histograms.sql`  
16 columns: 8 per metric (7 buckets + sample count).

### Shared bucket scheme (minutes)

| Bucket key | Range |
|------------|--------|
| `0_15m` | \[0, 15) |
| `15_60m` | \[15, 60) |
| `1_4h` | \[60, 240) |
| `4_12h` | \[240, 720) |
| `12_24h` | \[720, 1440) |
| `24_48h` | \[1440, 2880) |
| `48h_plus` | \[2880, ∞) |

**Storage:** Integer counts only — no raw duration samples, UUIDs, or timestamps in rollup rows.

---

## Rollup behavior (verified)

| Metric | Terminal / anchor rule | Bucket attribution |
|--------|------------------------|-------------------|
| Time-to-assigned | `ACCEPT_CLEANER_ASSIGNMENT` in hour; duration = accept − first `MOVE_TO_PENDING_ASSIGNMENT` | Accept event in bucket |
| Cleaner response | `accepted` / `declined` with `responded_at` in bucket | `responded_at` in bucket |
| Time-to-first-offer | `min(offered_at)` per booking; duration = first offer − first pending | First `offered_at` in bucket |

Cron: `POST /api/cron/rollup-assignment-metrics` (unchanged route). Feature flag: `ASSIGNMENT_METRICS_ROLLUP_ENABLED`. Backfill: `backfillAssignmentMetricsHourly` up to **168h**.

---

## Read model & UI (verified)

| Surface | Fields exposed |
|---------|----------------|
| `AssignmentLatencyApproximateMetricDto` | `approximateMedianMinutes`, `sampleCount`, `status` |
| Page payload | `latencyTrends7d.timeToAssigned`, `.cleanerResponse`, `.timeToFirstOffer` + coverage metadata |
| UI | Three cards with `~` prefix via `formatApproximateLatencyMetricDisplay`; partial coverage amber note |

Sample gate: `ASSIGNMENT_LATENCY_MIN_SAMPLE = 10` (same as 24h live).

---

## Test execution

```text
npm run typecheck                                    → Pass
npm run test -- (8 targeted files, 27 tests)         → Pass
```

| Suite | Tests |
|-------|-------|
| `assignment-metrics-hourly-latency-histograms.migration.test.ts` | 2 |
| `assignment-metrics-hourly-time-to-assigned-histogram.migration.test.ts` | 2 |
| `assignmentMetricsHourlyRlsPhase7bPolicy.test.ts` | 1 |
| `assignmentLatencyHistogram.test.ts` | 6 |
| `assignmentLatencyTrends7d.test.ts` | 3 |
| `rollupAssignmentMetricsHourly.test.ts` | 4 |
| `assignmentAnalyticsReadModel.test.ts` | 3 |
| `AdminAssignmentAnalyticsPanel.test.tsx` | 6 |

---

## Documentation

| Document | Status |
|----------|--------|
| `docs/architecture/stage-7b-1c-b-assignment-latency-histogram-rollups-design.md` | **Shipped** — all three metrics |
| `docs/architecture/stage-7b-assignment-funnel-analytics-design.md` | **Shipped** — parent status updated |
| `docs/operations/admin-operational-dashboard.md` | **§Assignment latency 7d rollup (7B-1c-b)** — all three metrics, migrations, backfill |
| `docs/architecture/stage-7b-1c-assignment-latency-metrics-design.md` | Header still says “7B-1c-b deferred” — **stale**; body describes 7B-1c-b correctly elsewhere |
| `docs/audits/stage-7b-assignment-analytics-consolidation-final-audit.md` | Predates full 7B-1c-b — lists 7d histograms as “not in baseline” — **stale** |

**Ops note:** After applying migrations, run **168h** rollup backfill so all three 7d cards populate.

---

## Deferred (explicitly out of 7B-1c-b)

| Item | Stage |
|------|--------|
| Path-split latency histograms | 7B-1d (after 7B-4) |
| Per-offer `assignment_path` at insert | 7B-4 |
| p90, charts, cleaner-level stats, home teaser | Later |
| Prior-7d latency delta | 7B-1c-b+ (optional) |

---

## Final question

**Is full 7B-1c-b complete and safe enough to freeze Stage 7B analytics baseline again, or should we continue to 7B-4 assignment_path snapshot design?**

**Verdict: Freeze the Stage 7B baseline for global analytics (7B-1a funnel + 7B-1b path counters + 7B-1c live latency + 7B-1c-b 7d latency histograms)** after migrations and 168h backfill in each environment.

**Proceed to 7B-4 next** if the product priority is **accurate path attribution** on funnel breakdowns (and a prerequisite for 7B-1d path-split latency). That is independent of 7B-1c-b completeness — global latency does not need a path snapshot.

**Recommendation:**

1. **Ops:** Apply `20260522120000` + `20260522130000`, backfill 168h, enable hourly rollup cron.
2. **Product/engineering:** Treat **7B-1c-b as done**; optional consolidation audit refresh (`stage-7b-assignment-analytics-consolidation-final-audit.md`) is documentation-only.
3. **Next slice:** **7B-4** (`assignment_path` snapshot) before **7B-1d** (path-split latency) — not because 7B-1c-b is incomplete, but because path metrics still carry documented snapshot bias until 7B-4 ships.
