# Stage 7B-1a — Assignment Funnel Analytics Foundation Final Audit

**Date:** 2026-05-18  
**Type:** Audit only — no code changes  
**Scope:** Hourly assignment funnel rollups, rollup cron, 24h live read model, 7d trends, `/admin/analytics/assignments`  
**Related:** [stage-7b-assignment-funnel-analytics-design.md](../architecture/stage-7b-assignment-funnel-analytics-design.md), [stage-7a-operational-queue-intelligence-final-audit.md](./stage-7a-operational-queue-intelligence-final-audit.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| `assignment_metrics_hourly` migration | **Pass** |
| Integer counters only (no PII columns) | **Pass** |
| RLS admin SELECT only | **Pass** |
| service_role insert/update only | **Pass** |
| Rollup previous closed UTC hour default | **Pass** |
| Rollup idempotent upsert | **Pass** |
| Cron `CRON_SECRET` required | **Pass** |
| Cron JSON free of entity identifiers | **Pass** |
| 24h live = aggregate counts only (admin DTO) | **Pass** |
| 7d trends from hourly rollups | **Pass** |
| Analytics page text/cards only | **Pass** |
| No charts / mutations / PII in UI | **Pass** |
| Assignment engine / offer lifecycle unchanged | **Pass** |
| `npm run typecheck` | **Pass** |
| Targeted unit tests (14) | **Pass** |
| Docs updated | **Pass** |

**Overall:** Stage **7B-1a** is **complete, read-only, PII-free in admin surfaces**, and **does not change assignment behavior**. Safe to begin **7B-1b** design/implementation (path-split rollup columns + optional home teaser) and **7B-1c** (median latency cards).

---

## Architecture (authoritative)

```text
assignment_offers + booking_state_audit + admin_operational_audit
  → rollupAssignmentMetricsHourly (service_role, previous closed UTC hour)
      → assignment_metrics_hourly (integer counters only)
  → loadAssignmentAnalytics24h (admin session, rolling 24h aggregates)
  → loadAssignmentMetricsHourlyBuckets → buildAssignmentTrends7d
  → AdminAssignmentAnalyticsPanel (text/cards)
```

**Read-only:** No writes to offers, bookings, audit, or commands from analytics UI or read models.

**Separation from 7A:** `getAdminOperationalQueueCounts` and operational queue strip are **unchanged**.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | `assignment_metrics_hourly` migration exists | **Pass** | `supabase/migrations/20260520120000_assignment_metrics_hourly.sql` |
| 2 | Table stores integer counters only | **Pass** | Nine `*_count integer` columns + `bucket_start`, `created_at`, `updated_at`; no UUID/text PII columns |
| 3 | RLS admin SELECT only | **Pass** | Policy `assignment_metrics_hourly_select_admin` → `auth_is_admin()`; no authenticated INSERT/UPDATE |
| 4 | service_role insert/update only | **Pass** | `grant insert, update … to service_role`; migration test asserts no authenticated insert |
| 5 | Rollup defaults to previous closed UTC hour | **Pass** | `resolveRollupBucketStart(null)` → `previousClosedUtcHour`; tested in `rollupAssignmentMetricsHourly.test.ts` |
| 6 | Rollup is idempotent | **Pass** | `.upsert(row, { onConflict: "bucket_start" })` — re-run overwrites same bucket |
| 7 | Cron requires `CRON_SECRET` | **Pass** | `verifyCronSecret(request)` → 401; `route.test.ts` |
| 8 | Cron response has no booking/customer/cleaner IDs | **Pass** | JSON: `bucketStart`, `offersCreated`, `offersAccepted`, `bookingsAssigned`, `upserted` (+ backfill meta); test asserts no `bookingId`/`cleanerId` |
| 9 | 24h live metrics use aggregate counts only | **Pass** | `AdminAssignmentAnalytics24h` — numbers and rates only; `assignmentAnalyticsReadModel.test.ts` forbids PII keys |
| 10 | 7d trends use hourly rollups | **Pass** | `loadAssignmentMetricsHourlyBuckets` → `assignment_metrics_hourly` → `buildAssignmentTrends7d` |
| 11 | `/admin/analytics/assignments` text/stat cards | **Pass** | `AdminAssignmentAnalyticsPanel` — `MetricCard` grid + trend `<ul>`; no chart imports |
| 12 | No charts / mutations / PII in UI | **Pass** | Panel test: no `<button>` / `submit`; no chart libs; footer states no identities |
| 13 | Assignment engine / offer lifecycle unchanged | **Pass** | Additive analytics modules only; no edits to `executeBookingCommand`, `respondToOffer`, `processBookingAfterOfferEnded`, offer cron |
| 14 | Tests pass | **Pass** | See §Test execution |
| 15 | Docs updated | **Pass** | `admin-operational-dashboard.md` §7B-1a; design doc status **7B-1a shipped** |

---

## Migration structure

| Column | Type | Purpose |
|--------|------|---------|
| `bucket_start` | timestamptz PK | UTC hour bucket |
| `offers_created_count` | int ≥ 0 | Offers with `offered_at` in bucket |
| `offers_accepted_count` | int ≥ 0 | Terminal `accepted` by `responded_at` |
| `offers_declined_count` | int ≥ 0 | Terminal `declined` |
| `offers_expired_count` | int ≥ 0 | Terminal `expired` by `updated_at` / `responded_at` |
| `offers_cancelled_count` | int ≥ 0 | Terminal `cancelled` |
| `bookings_assigned_count` | int ≥ 0 | Distinct bookings with `ACCEPT_CLEANER_ASSIGNMENT` audit in bucket |
| `redispatch_booking_count` | int ≥ 0 | Distinct bookings with 2+ offers where later `offered_at` in bucket |
| `max_attempts_booking_count` | int ≥ 0 | Distinct bookings whose 5th offer `offered_at` in bucket |
| `admin_intervention_count` | int ≥ 0 | Admin audit success/idempotent intervention rows |

---

## Rollup behavior

| Rule | Implementation |
|------|----------------|
| Default bucket | Previous closed UTC hour (`previousClosedUtcHour`) |
| Partial hour guard | `isCurrentPartialUtcHour` rejects current hour rollup |
| Offer outcomes | `assignment_offers` — created + terminal queries |
| Assignments | `booking_state_audit` — `command = ACCEPT_CLEANER_ASSIGNMENT`, count distinct `booking_id` internally → **count only** stored |
| Admin interventions | `admin_operational_audit` — head count, actions `manual_dispatch_offer`, `replace_open_offer`, `assignment_recovery` |
| Idempotency | Upsert on `bucket_start` |
| Env gate | `ASSIGNMENT_METRICS_ROLLUP_ENABLED` (default on) |

**Internal note (acceptable):** Rollup queries select `booking_id` server-side to compute redispatch/max-attempts; IDs are **not** written to `assignment_metrics_hourly` or returned in cron/admin DTOs.

---

## Cron behavior

| Topic | Behavior |
|-------|----------|
| Route | `GET/POST /api/cron/rollup-assignment-metrics` |
| Auth | `CRON_SECRET` via `verifyCronSecret` |
| Options | `bucketStart`, `backfillHours` (cap 24/request) |
| Response | Structured JSON counters only |
| Backfill | `backfillAssignmentMetricsHourly` — up to 168 hours env max |

---

## Read model & metrics definitions

### 24h live (`loadAssignmentAnalytics24h`)

Rolling window: `floorToUtcHour(now - 24h)` → `bucketEndExclusive(floorToUtcHour(now))`.

Same aggregation as hourly rollup → `AdminAssignmentAnalytics24h`:

- Volumes: offers created/accepted/declined/expired/cancelled, bookings assigned, redispatch bookings, max attempts, admin interventions  
- Rates: accept %, decline %, expire % (terminal denominator)

### 7d trends (`buildAssignmentTrends7d`)

- Source: `assignment_metrics_hourly` buckets (14d lookback for current + prior 7d)  
- Outputs: offers created 7d, accept rate 7d, bookings assigned, redispatch, max attempts, deltas vs prior week  
- Partial coverage note when &lt; 90% of 168 expected buckets

---

## UI behavior

| Surface | Content |
|---------|---------|
| `/admin/analytics/assignments` | `DashboardShell` + `AdminAssignmentAnalyticsPanel` |
| 24h section | Grid of metric cards (text/numbers) |
| 7d section | Text trend list + rollup as-of / coverage note |
| Footer | Explicit: no customer/cleaner identities; separate from 7A queues |
| Nav | `adminNav` → “Assignment analytics” |

**Not present:** charts, forms, mutation buttons, entity links with IDs.

---

## Behavior unchanged (confirmed)

| Layer | 7B-1a impact |
|-------|----------------|
| `executeBookingCommand` / offer accept-decline-expiry | **None** |
| Assignment redispatch / recovery engine | **None** |
| `assignment_offers` RLS (existing) | **None** — analytics reads only |
| `booking_state_audit` RLS | **None** |
| Stage 7A operational queue strip/counts | **None** |
| `listAdminAssignmentQueue` | **None** |
| Payment / notification subsystems | **None** |

---

## Test execution summary

| Command / suite | Result |
|-----------------|--------|
| `npm run typecheck` | **Pass** |
| `assignmentMetricsAggregate.test.ts` | **Pass** (3 tests) |
| `rollupAssignmentMetricsHourly.test.ts` | **Pass** (2 tests) |
| `assignmentAnalyticsReadModel.test.ts` | **Pass** (1 test — DTO no PII) |
| `rollup-assignment-metrics/route.test.ts` | **Pass** (2 tests) |
| `AdminAssignmentAnalyticsPanel.test.tsx` | **Pass** (2 tests) |
| `assignment-metrics-hourly.migration.test.ts` | **Pass** (3 tests) |
| `assignmentMetricsHourlyRlsPhase7bPolicy.test.ts` | **Pass** (1 test) |
| **Total** | **7 files, 14 tests, all passed** |

---

## Files in 7B-1a scope

| File | Role |
|------|------|
| `supabase/migrations/20260520120000_assignment_metrics_hourly.sql` | Table + RLS |
| `src/features/assignments/server/assignmentMetricsHourlyUtc.ts` | UTC bucket helpers |
| `src/features/assignments/server/assignmentMetricsAggregate.ts` | Pure aggregation |
| `src/features/assignments/server/assignmentAnalyticsRollupQueries.ts` | Server read queries |
| `src/features/assignments/server/rollupAssignmentMetricsHourly.ts` | Rollup + backfill |
| `src/features/assignments/server/assignmentTrends7d.ts` | 7d trend builder |
| `src/features/assignments/server/assignmentAnalyticsReadModel.ts` | Admin page loader |
| `src/app/api/cron/rollup-assignment-metrics/route.ts` | Cron endpoint |
| `src/components/dashboard/AdminAssignmentAnalyticsPanel.tsx` | UI |
| `src/app/(admin)/admin/analytics/assignments/page.tsx` | Page |
| `src/lib/database/types.ts` | `AssignmentMetricsHourlyRow` |
| `src/features/dashboards/adminNav.ts` | Nav link |
| `*/*.test.ts` | Tests listed above |
| Docs | `admin-operational-dashboard.md`, design doc |

---

## Doc status

| Document | Status |
|----------|--------|
| `stage-7b-assignment-funnel-analytics-design.md` | **Current** — 7B-1a shipped; 7B-1b+ deferred |
| `admin-operational-dashboard.md` | **Current** — §Assignment funnel analytics (7B-1a) |
| This audit | **Created** |

---

## Operational notes

| Topic | Guidance |
|-------|----------|
| First deploy | Run `/api/cron/rollup-assignment-metrics` hourly; optional `?backfillHours=168` once for 7d trends |
| Empty 7d trends | Expected until rollups exist — partial coverage note shown |
| 24h vs 7A | 24h live works without rollups; 7A strip counts remain point-in-time queue semantics |

---

## Deferred to 7B-1b / 7B-1c

| Item | Phase |
|------|-------|
| Path-split rollup columns (`selected`, `best_available`, etc.) | **7B-1b** |
| Home analytics teaser (2–3 lines) | **7B-1b** |
| Median time-to-offer / time-to-assign cards | **7B-1c** |
| Charts | **7B-3** (design) |
| `assignment_path` on offer rows | **7B-4** (schema) |

---

## Final question

**Is Stage 7B-1a complete and safe enough to move to 7B-1b path split / latency metrics design?**

**Yes.**

- **Complete** for 7B-1a: migration, idempotent rollup cron, 24h live aggregates, 7d rollup trends, dedicated analytics page, tests, docs.  
- **Safe:** Read-only analytics path; PII-free admin DTOs and rollup table; assignment behavior untouched; separate from 7A.  
- **7B-1b ready:** Add path dimension to rollups and UI text rows without changing offer lifecycle; design path capture bias documented in 7B design doc.  
- **7B-1c ready:** Latency metrics can use same read-only query patterns on `offered_at` / `responded_at` / audit timestamps.

**Pre-flight for production:** Schedule rollup cron; run one-time backfill; verify admin page shows non-zero 7d trends after ≥90% bucket coverage.
