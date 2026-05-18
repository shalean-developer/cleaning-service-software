# Stage 7B-1c-min — Live Assignment Latency Metrics Final Audit

**Date:** 2026-05-18  
**Type:** Audit only — no code changes  
**Scope:** Live 24h global median latency cards on `/admin/analytics/assignments` — read model, DTOs, UI; no migration, no rollup/cron changes  
**Related:** [stage-7b-1c-assignment-latency-metrics-design.md](../architecture/stage-7b-1c-assignment-latency-metrics-design.md), [stage-7b-assignment-funnel-analytics-design.md](../architecture/stage-7b-assignment-funnel-analytics-design.md), [stage-7b-1a-assignment-funnel-analytics-final-audit.md](./stage-7b-1a-assignment-funnel-analytics-final-audit.md), [stage-7b-1b-assignment-path-split-analytics-final-audit.md](./stage-7b-1b-assignment-path-split-analytics-final-audit.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| No migration added | **Pass** |
| No cron / rollup schema changed | **Pass** |
| Time-to-first-offer formula | **Pass** |
| Cleaner response formula + exclusions | **Pass** |
| Time-to-assigned formula | **Pass** |
| Median (p50) calculation | **Pass** |
| Sample gate n ≥ 10 | **Pass** |
| DTO fields (`medianMinutes`, `sampleSize`, `status` only) | **Pass** |
| No booking/customer/cleaner IDs in admin DTO | **Pass** |
| UI — three latency cards + insufficient data | **Pass** |
| Assignment engine / commands / RLS unchanged | **Pass** |
| `npm run typecheck` | **Pass** |
| Targeted unit tests (17) | **Pass** |
| Docs updated | **Pass** |

**Overall:** Stage **7B-1c-min** is **complete, additive, PII-free in admin surfaces**, and **does not change assignment behavior**. Safe to proceed to **Stage 7B consolidation audit** and/or **7B-1d path-split latency design**. **7B-1c-b** (7d histogram rollups) remains a separate follow-up slice.

---

## Architecture (7B-1c-min delta on 7B-1a / 7B-1b)

```text
assignment_offers (offered_at, responded_at, status)
  + booking_state_audit (MOVE_TO_PENDING_ASSIGNMENT, ACCEPT_CLEANER_ASSIGNMENT)
  → fetch* (read-only SELECT, server-side booking_id joins)
  → assignmentLatencyMetrics.ts (duration + median + exclusions)
  → assignmentLatencyDto.ts (aggregate DTO + sample gate)
  → loadAssignmentAnalytics24h.latency24h
  → AdminAssignmentAnalyticsPanel — “Assignment latency (24h live)”
```

**Read-only:** No writes to offers, bookings, audit, or rollup tables. No new API mutation routes. No cron payload changes.

**Internal vs external:** `booking_id` appears only in server query rows and pure-function inputs (`OfferMetricsInput`, `BookingAuditTimestamp`). Serialized admin payload contains **medians and counts only**.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | No migration was added | **Pass** | No `supabase/migrations/*latency*`; no new SQL files for 7B-1c-min |
| 2 | No cron / rollup schema changed | **Pass** | `rollupAssignmentMetricsHourly.ts` — no latency/histogram columns; `METRICS_HOURLY_SELECT` unchanged; `assignment_metrics_hourly` migrations untouched |
| 3 | Time-to-first-offer = first offer − first pending audit | **Pass** | `minOfferedAtByBooking` + `fetchFirstPendingAssignmentAuditByBookingIds` (`min(created_at)` per booking, `MOVE_TO_PENDING_ASSIGNMENT`); `durationMinutesBetween(pendingAt, firstOfferedAt)` |
| 4 | Cleaner response = `responded_at − offered_at` (accepted/declined) | **Pass** | `collectCleanerResponseDurationsMinutes` — status ∈ `{accepted, declined}`, requires `responded_at` |
| 5 | Expired / open / cancelled excluded from cleaner response | **Pass** | Status guard + unit test with `expired`, `cancelled`, `offered` rows |
| 6 | Time-to-assigned = accept audit − first pending audit | **Pass** | `fetchAcceptAssignmentAuditsInBucket` + `minCreatedAtByBooking` + `collectTimeToAssignedDurationsMinutes` |
| 7 | Median calculation correct | **Pass** | `medianOfValues` — odd: middle element; even: average of two middles; tests in `assignmentLatencyMetrics.test.ts` |
| 8 | Sample gate n ≥ 10 | **Pass** | `ASSIGNMENT_LATENCY_MIN_SAMPLE = 10`; `buildAssignmentLatencyMetricDto` → `insufficient_data` when n &lt; 10 |
| 9 | DTO exposes only `medianMinutes`, `sampleSize`, `status` | **Pass** | `AssignmentLatencyMetricDto` in `assignmentLatencyDto.ts` |
| 10 | DTO exposes no booking/customer/cleaner IDs | **Pass** | `assignmentAnalyticsReadModel.test.ts` — `assertNoPii` on `latency24h`; no ISO timestamps in serialized JSON |
| 11 | UI renders three latency cards | **Pass** | `AdminAssignmentAnalyticsPanel` — time to first offer, cleaner response, time to assigned |
| 12 | UI handles insufficient data | **Pass** | `formatLatencyMetricDisplay` → “Insufficient data”; hints `n=… (need ≥10)`; panel test |
| 13 | No assignment engine / command / RLS behavior changed | **Pass** | No matches under `commands/`, `assignmentEngine*`, `supabase/` for latency symbols; analytics-only modules |
| 14 | Tests pass | **Pass** | See §Test execution |
| 15 | Docs updated | **Pass** | See §Documentation |

---

## Metric definitions (verified)

### Time to first offer (booking-level)

| Step | Implementation |
|------|----------------|
| First offer | `min(offered_at)` per booking over `allOffersForTouched` (history + in-bucket created) |
| Pending anchor | `min(created_at)` where `command = 'MOVE_TO_PENDING_ASSIGNMENT'` |
| Window | Booking included only if **first** `offered_at` ∈ `[bucketStart, bucketEnd)` |
| Anomaly | Negative delta (`offered_at` before pending) excluded via `durationMinutesBetween` returning `null` |

### Cleaner response time (offer-level)

| Include | Exclude |
|---------|---------|
| `accepted`, `declined` with non-null `responded_at` | `expired`, `offered`, `cancelled` |
| `responded_at` in 24h window | Offers without response timestamp |

**Note:** `updated_at` is selected on offer rows for existing 7B rollup helpers but is **not** used for cleaner response latency in 7B-1c-min (per design).

### Time to assigned (booking-level)

| Step | Implementation |
|------|----------------|
| End | `min(created_at)` for `ACCEPT_CLEANER_ASSIGNMENT` per booking (idempotent replays) |
| Start | First `MOVE_TO_PENDING_ASSIGNMENT` |
| Window | Accept audits pre-filtered at fetch: `created_at` in `[bucketStart, bucketEnd)` |

---

## Median and sample gate

| Rule | Value |
|------|-------|
| Statistic | Median (p50), not mean |
| Minimum sample | **10** observations per metric |
| Below threshold | `status: "insufficient_data"`, `medianMinutes: null`, UI “Insufficient data” |
| At/above threshold | `status: "ok"`, `medianMinutes` from sorted durations |

---

## DTO and PII safety

| Surface | Fields |
|---------|--------|
| `live24h.latency24h.*` | `medianMinutes`, `sampleSize`, `status` per metric |
| UI display | Formatted duration string (e.g. `15 min`, `3.4 h`) derived client-side from `medianMinutes` — not raw timestamps |
| Forbidden in DTO | `booking_id`, `cleaner_id`, `customer_id`, `email`, `payload`, raw ISO strings |

**Server-internal:** `fetchFirstPendingAssignmentAuditByBookingIds` and offer fetches use `booking_id` for joins; results are aggregated before serialization.

---

## UI

| Element | Behavior |
|---------|----------|
| Section title | “Assignment latency (24h live)” |
| Cards | Median time to first offer · Median cleaner response · Median time to assigned |
| Sample hint | `n={sampleSize}` or `n={n} (need ≥10)` |
| Caveats | Rolling 24h window; open/expired excluded from response; global not path-split; 7d deferred |
| Mutations | None — no buttons or forms (existing panel test) |

---

## Assignment behavior unchanged

Verified: latency modules do not import or call:

- `executeBookingCommand`
- `createDispatchOffer` / `recordAssignmentOutcome`
- `processBookingAfterOfferEnded` / `respondToOffer`
- Offer expiry cron routes

No RLS policy changes under `supabase/`. No new columns on `assignment_metrics_hourly`.

**Query-layer refactor (behavior-preserving):** `fetchAssignedBookingIdsInBucket` now delegates to `fetchAcceptAssignmentAuditsInBucket` and maps to IDs — same acceptance-in-window semantics as 7B-1a.

**7B funnel regression:** `aggregateAssignmentMetricsHourly` and path counters unchanged; latency computed as an additional parallel branch in `loadAssignmentAnalytics24h`.

---

## Known limitations (accepted for min slice)

| Limitation | Notes |
|------------|-------|
| 24h window alignment | Uses `floorToUtcHour(now − 24h)` through current hour end — same as 7B-1a funnel; effective window may exceed exactly 24h |
| Global only | No path-split latency (deferred **7B-1d**) |
| No 7d latency | Histogram rollup buckets deferred **7B-1c-b** |
| Pending audit scope | Fetched only for bookings with offers created in window or assignment completed in window — sufficient for the three shipped metrics |
| Metadata snapshot bias | Unchanged from 7B-1b; does not affect latency formulas (no path dimension) |

---

## Test execution

```text
npm run typecheck                                                          → Pass
vitest assignmentLatencyMetrics.test.ts                                    → Pass (5 tests)
vitest assignmentLatencyDto.test.ts                                        → Pass (3 tests)
vitest assignmentLatencyReadModel.test.ts                                  → Pass (1 test)
vitest assignmentAnalyticsReadModel.test.ts                                → Pass (3 tests, incl. PII + regression)
vitest AdminAssignmentAnalyticsPanel.test.tsx                              → Pass (5 tests, incl. latency UI)
──────────────────────────────────────────────────────────────────────────
Total targeted: 5 files, 17 tests — all Pass
```

---

## Documentation

| Doc | Status |
|-----|--------|
| `docs/architecture/stage-7b-1c-assignment-latency-metrics-design.md` | **7B-1c-min shipped**; 7B-1c-b deferred |
| `docs/architecture/stage-7b-assignment-funnel-analytics-design.md` | Latency cards marked shipped |
| `docs/operations/admin-operational-dashboard.md` | §Assignment latency (7B-1c-min) added |

---

## Deferred (not blockers)

| Item | Phase |
|------|-------|
| 7d latency trends (histogram buckets) | **7B-1c-b** |
| Path-split latency | **7B-1d** |
| Expired open-duration median, p90, paid→first-offer | **7B-1c-full** |
| Charts, cleaner-level analytics, home teaser | Later |

---

## Final question

**Is 7B-1c-min complete and safe enough to move to Stage 7B consolidation audit or 7B-1d path latency design?**

**Yes.**

- All **15** audit checks **pass**.
- Implementation is **read-only** and **additive** relative to assignment operations and rollups.
- Admin surfaces remain **PII-free** (medians and sample counts only).
- Live 24h medians answer the core ops question (“how long does assignment take?”) without misleading 7d approximations or schema risk.

**Recommended next steps:**

1. **7B consolidation audit** — fold 7B-1a / 7B-1b-min / 7B-1c-min into a single Stage 7B sign-off.
2. **7B-1d design** — path-split latency (with same sample gates and snapshot-bias caveats as 7B-1b).
3. **7B-1c-b design** (can parallelize) — histogram columns for approximate 7d medians; still no mean-only sum/count rollups.

**Not required before consolidation:** New migration, cron changes, or assignment engine work.
