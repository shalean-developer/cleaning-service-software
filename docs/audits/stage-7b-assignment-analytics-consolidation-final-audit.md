# Stage 7B — Assignment Analytics Intelligence Layer Consolidation Final Audit

**Date:** 2026-05-18  
**Type:** Audit only — no code changes  
**Scope:** Consolidated sign-off for **7B-1a** (funnel foundation), **7B-1b-min** (path split), **7B-1c-min** (live latency)  
**Related audits:** [stage-7b-1a-assignment-funnel-analytics-final-audit.md](./stage-7b-1a-assignment-funnel-analytics-final-audit.md), [stage-7b-1b-assignment-path-split-analytics-final-audit.md](./stage-7b-1b-assignment-path-split-analytics-final-audit.md), [stage-7b-1c-live-assignment-latency-final-audit.md](./stage-7b-1c-live-assignment-latency-final-audit.md), [stage-7a-operational-queue-intelligence-final-audit.md](./stage-7a-operational-queue-intelligence-final-audit.md)

**Design / ops docs:** [stage-7b-assignment-funnel-analytics-design.md](../architecture/stage-7b-assignment-funnel-analytics-design.md), [stage-7b-1b-assignment-path-split-analytics-design.md](../architecture/stage-7b-1b-assignment-path-split-analytics-design.md), [stage-7b-1c-assignment-latency-metrics-design.md](../architecture/stage-7b-1c-assignment-latency-metrics-design.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Layer | Verdict |
|-------|---------|
| 1. Analytics architecture (7A vs 7B separation) | **Pass** |
| 2. Rollup foundation (`assignment_metrics_hourly`) | **Pass** |
| 3. Path split integrity (7B-1b-min) | **Pass** (with documented snapshot bias) |
| 4. Latency integrity (7B-1c-min) | **Pass** |
| 5. DTO / privacy safety | **Pass** |
| 6. UI safety | **Pass** |
| 7. RLS / security | **Pass** |
| 8. Regression safety (assignment ops unchanged) | **Pass** |
| 9. Tests | **Pass** (42 tests + typecheck) |
| 10. Documentation | **Pass** |

**Overall:** Stage **7B** (1a + 1b-min + 1c-min) is **internally consistent**, **read-only** on operational tables, **PII-safe** in admin surfaces, and **does not affect assignment behavior**. Suitable to **freeze as the analytics baseline** for assignment funnel, path, and live latency, with explicit deferred phases documented below.

---

## Stage 7B composition

| Slice | Shipped capability | Primary artifacts |
|-------|-------------------|-------------------|
| **7B-1a** | Hourly funnel rollups, 24h live funnel, 7d trend text | `20260520120000_assignment_metrics_hourly.sql`, `rollupAssignmentMetricsHourly`, `/admin/analytics/assignments` |
| **7B-1b-min** | Path-split created/accepted (rollup + live + 7d) | `20260521103000_assignment_metrics_hourly_path_split.sql`, `resolveAssignmentAnalyticsPath`, path UI section |
| **7B-1c-min** | Live 24h global median latency (3 cards) | `assignmentLatencyMetrics`, `assignmentLatencyDto`, latency UI section |

**Not in baseline:** 7d latency histograms (7B-1c-b), path-split latency (7B-1d), charts, cleaner-level stats, home teaser, `assignment_offers.assignment_path` snapshot (7B-4).

---

## 1. Analytics architecture

### 7A vs 7B separation

| Concern | 7A (operational) | 7B (historical) |
|---------|------------------|-----------------|
| Question | “How many bookings need attention **now**?” | “How did assignment perform **over time**?” |
| Entry points | `/admin`, `/admin/bookings`, `/admin/assignments` | `/admin/analytics/assignments` |
| Read model | `getAdminOperationalQueueCounts` | `getAdminAssignmentAnalyticsPage` |
| Data | Point-in-time SQL `count(*)` per filter | Time-bucketed offers + audit aggregates |
| Coupling | **None** — dashboards do not import each other |

**Verified:** No `assignmentAnalytics*` / `assignmentLatency*` imports under `src/features/dashboards/`. Queue strip and analytics page load independently.

### No lifecycle mutation from analytics

| Module class | Writes |
|--------------|--------|
| `assignmentAnalyticsReadModel`, `assignmentLatency*`, `resolveAssignmentAnalyticsPath` | **None** |
| `rollupAssignmentMetricsHourly` | **Upsert only** to `assignment_metrics_hourly` (telemetry table) |
| `AdminAssignmentAnalyticsPanel` | **None** (render only) |

**Verified:** No `executeBookingCommand`, `createDispatchOffer`, `recordAssignmentOutcome`, or offer-command imports in 7B read-model / path / latency modules.

```text
                    ┌─────────────────────┐
                    │   Stage 7A          │
                    │   Queue counts      │
                    │   (live triage)     │
                    └──────────┬──────────┘
                               │ separate routes
                    ┌──────────▼──────────┐
                    │   Stage 7B          │
                    │   Funnel + path +   │
                    │   latency (read)    │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
 assignment_offers    booking_state_audit    assignment_metrics_hourly
 (SELECT)              (SELECT)               (cron upsert / admin SELECT)
```

---

## 2. Rollup foundation

### Schema integrity

| Check | Verdict | Evidence |
|-------|---------|----------|
| Base table (7B-1a) | **Pass** | 9 integer counters + `bucket_start` PK; all `>= 0` checks |
| Path columns (7B-1b-min) | **Pass** | 8 additive columns only; no RLS/policy changes in path migration |
| PII columns | **Pass** | No UUID, email, name, or JSON payload columns |
| Indexes | **Pass** | `idx_assignment_metrics_hourly_bucket_desc` |

### Idempotent rollup behavior

| Behavior | Implementation |
|----------|----------------|
| Default bucket | `previousClosedUtcHour(now)` — never current partial hour |
| Upsert key | `onConflict: "bucket_start"` — full row replace, not increment |
| Re-run safety | Same inputs → same counter row (no duplicate aggregation) |
| Live vs rollup | 24h live computed fresh; 7d sums **hourly buckets only** — not added to live cards |

**Duplicate aggregation risk:** **Low.** Cron and live share `aggregateAssignmentMetricsHourly` / `aggregateAssignmentMetricsPathHourly` pure functions but write to different surfaces (DB row vs in-memory DTO). UI labels distinguish “24h live” vs “7-day trends (hourly rollups)”.

### Cron safety

| Check | Verdict |
|-------|---------|
| `CRON_SECRET` required | **Pass** — `verifyCronSecret`; 401 without secret (`route.test.ts`) |
| `ASSIGNMENT_METRICS_ROLLUP_ENABLED` kill switch | **Pass** |
| Service role only for upsert | **Pass** — `createServiceRoleClient` |
| Cron response JSON | **Pass** — counts only; no booking/cleaner IDs |
| Backfill cap | **Pass** — `MAX_BACKFILL_HOURS_PER_REQUEST = 24`; global cap 168h |

---

## 3. Path split integrity (7B-1b-min)

| Check | Verdict | Evidence |
|-------|---------|----------|
| Resolver read-only | **Pass** | SELECT on `bookings` / `booking_locks`; no metadata mutation |
| `selected` | **Pass** | `mapEnginePathToAnalyticsPath("selected")` + lock/metadata tests |
| `best_available` | **Pass** | `best_available` + `fallback_best_available` → `best_available` |
| `admin_manual` | **Pass** | Direct map |
| `unknown` | **Pass** | Null/ambiguous metadata + no lock |
| Path sums = global | **Pass** | `assignmentAnalyticsPathMetrics.test.ts` |
| Snapshot bias documented | **Pass** | UI + `admin-operational-dashboard.md` + design docs |

**Known limitation (accepted):** Path at read/rollup time reflects **current** `bookings.metadata.assignment.path`, not per-offer history. Multi-offer bookings may mis-attribute path for older offers until **7B-4**.

---

## 4. Latency integrity (7B-1c-min)

| Metric | Formula | Verdict |
|--------|---------|---------|
| Time to first offer | `min(offered_at)` − first `MOVE_TO_PENDING_ASSIGNMENT` | **Pass** |
| Cleaner response | `responded_at − offered_at` (accepted/declined) | **Pass** |
| Time to assigned | `ACCEPT_CLEANER_ASSIGNMENT` − first pending audit | **Pass** |
| Median (p50) | `medianOfValues` odd/even | **Pass** |
| Sample gate | n &lt; 10 → `insufficient_data` | **Pass** |
| Exclusions | expired, offered, cancelled excluded from response | **Pass** |
| No `updated_at` for response | Latency module has zero `updated_at` references | **Pass** |
| Negative durations | `durationMinutesBetween` returns null if end &lt; start | **Pass** |

**Note:** `OFFER_METRICS_SELECT` still includes `updated_at` for 7B-1a expired terminal bucketing (`terminalEventTimestamp`). Latency code does not consume it.

---

## 5. DTO / privacy safety

### Admin page payload (`AdminAssignmentAnalyticsPage`)

| Allowed | Examples |
|---------|----------|
| Counts | `offersCreated`, `bookingsAssigned`, path `offersCreated` |
| Rates | `acceptRatePercent`, `acceptRateLabel`, 7d deltas |
| Latency | `medianMinutes`, `sampleSize`, `status` per metric |
| Meta | `rollupAsOf`, `coverageHours7d`, `partialCoverageNote` |

### Forbidden (test-guarded)

`booking_id`, `cleaner_id`, `customer_id`, `email`, `recipient`, `customer`, `cleaner`, `payload`, raw ISO timestamps in latency JSON.

**Guards:** `assignmentAnalyticsReadModel.test.ts` — `assertNoPii` on full page + latency-only; latency JSON regex for ISO timestamps.

### Rollup table

Integer counters only — IDs never persisted in `assignment_metrics_hourly`.

### Server-internal (acceptable)

Rollup/live queries use `booking_id` for joins and redispatch logic; stripped before admin serialization.

---

## 6. UI safety

| Check | Verdict |
|-------|---------|
| No chart library / heavy viz | **Pass** — text and stat cards only |
| No mutation buttons | **Pass** — `AdminAssignmentAnalyticsPanel.test.tsx` |
| No operational actions | **Pass** — no links to recover/dispatch from analytics page |
| Caveats in UI | **Pass** — open offers excluded; path metadata snapshot; latency 24h only; insufficient data |
| Sections | Funnel (24h) → Latency (24h) → Path (24h) → Trends (7d rollups) |

---

## 7. RLS / security

| Surface | Policy |
|---------|--------|
| `assignment_metrics_hourly` | `assignment_metrics_hourly_select_admin` → `auth_is_admin()` for authenticated SELECT |
| Writes | `grant insert, update` to **service_role** only |
| Operational tables | **No RLS changes** in 7B migrations |
| Admin analytics API | `getAdminAssignmentAnalyticsPage` — admin role check; read-only |
| Cron | `CRON_SECRET` + service role; not exposed to browser |

**New mutation APIs:** **None** for 7B.

---

## 8. Regression safety

Verified **no edits** in 7B scope to:

| Area | Status |
|------|--------|
| Assignment engine (`assignmentEngine.ts`) | Unchanged |
| Offer lifecycle / `respondToOffer` | Unchanged |
| Dispatch / `createDispatchOffer` | Unchanged |
| Recovery (`adminAssignmentRecovery`, cron recovery) | Unchanged |
| `executeBookingCommand` | Unchanged |
| Notifications enqueue | Unchanged |
| Payments / finalize paths | Unchanged |
| 7A queue semantics (`getAdminOperationalQueueCounts`) | Unchanged — regression test included |

**Only telemetry write path:** `assignment_metrics_hourly` upsert via cron (isolated table).

---

## 9. Test execution

```text
npm run typecheck                                                                 → Pass

vitest (7B + 7A regression) — 15 files, 42 tests                                  → Pass

  Migrations / RLS
    assignment-metrics-hourly.migration.test.ts
    assignment-metrics-hourly-path-split.migration.test.ts
    assignmentMetricsHourlyRlsPhase7bPolicy.test.ts

  7B-1a core
    assignmentMetricsAggregate.test.ts
    rollupAssignmentMetricsHourly.test.ts
    rollup-assignment-metrics/route.test.ts

  7B-1b-min
    resolveAssignmentAnalyticsPath.test.ts
    assignmentAnalyticsPathMetrics.test.ts
    assignmentAnalyticsPathDto.test.ts

  7B-1c-min
    assignmentLatencyMetrics.test.ts
    assignmentLatencyDto.test.ts
    assignmentLatencyReadModel.test.ts

  Integration / UI
    assignmentAnalyticsReadModel.test.ts
    AdminAssignmentAnalyticsPanel.test.tsx

  7A regression
    adminOperationalQueueCounts.test.ts
```

---

## 10. Documentation

| Document | Aligned |
|----------|---------|
| `stage-7b-assignment-funnel-analytics-design.md` | **Yes** — 1a/1b/1c-min shipped; deferrals listed |
| `stage-7b-1b-assignment-path-split-analytics-design.md` | **Yes** |
| `stage-7b-1c-assignment-latency-metrics-design.md` | **Yes** |
| `admin-operational-dashboard.md` | **Yes** — funnel, path, latency sections |
| Per-slice final audits (1a, 1b, 1c) | **Yes** |

**Known limitations documented:** path snapshot bias, 24h UTC-hour window alignment, partial 7d rollup coverage note, no 7d latency, live-query scale bounds.

---

## Consolidated architecture

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                     /admin/analytics/assignments                          │
│  AdminAssignmentAnalyticsPanel (text/cards only)                          │
└──────────────────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │ live24h                      │ trends7d
         │                              │
┌────────┴────────────┐       ┌─────────┴──────────────────┐
│ loadAssignment      │       │ assignment_metrics_hourly   │
│ Analytics24h        │       │ (hourly buckets, 7d sum)    │
│                     │       └─────────▲──────────────────┘
│ • funnel aggregates │                 │
│ • path (resolver)   │       ┌─────────┴──────────────────┐
│ • latency medians   │       │ rollupAssignmentMetrics   │
└─────────▲───────────┘       │ Hourly (cron, service_role)│
          │                   └─────────▲──────────────────┘
          │                             │
          └─────────────┬───────────────┘
                        │ SELECT (read-only)
          ┌─────────────┴─────────────┐
          │ assignment_offers          │
          │ booking_state_audit        │
          │ admin_operational_audit    │
          │ bookings / booking_locks   │  ← path resolver only
          └────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  7A (separate): getAdminOperationalQueueCounts → queue strip / filters    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Deferred phases (explicitly out of baseline)

| ID | Scope | Why deferred |
|----|-------|--------------|
| **7B-1c-b** | 7d latency via histogram buckets on `assignment_metrics_hourly` | Avoid mean-only rollups; needs migration |
| **7B-1d** | Path-split latency | Snapshot bias; needs stable path dimension |
| **7B-4** | `assignment_offers.assignment_path` at insert | Improves path + path-latency accuracy |
| **7B-1b-full** | Decline/expire/cancel by path | Volume + interpretation |
| **7B-2** | Cleaner-level analytics | Privacy / workload inference |
| **7B-3** | Charts | Explicitly out of v1 |
| **7C** | SLA intelligence | Not designed in repo yet |
| **7D** | Anomaly detection | Requires baseline + thresholds |

---

## Final questions

### 1. Is Stage 7B stable enough to freeze as an analytics baseline?

**Yes.**

- All three shipped slices pass individual final audits.
- Consolidated checks (architecture, rollup, path, latency, privacy, UI, security, regression, tests, docs) **pass**.
- The layer is **additive**, **read-only** on assignment operations, and **operationally usable** for funnel review, path comparison, and live latency monitoring.

**Freeze recommendation:** Tag **7B baseline** = 7B-1a + 7B-1b-min + 7B-1c-min. Future work extends via new migrations/columns or new sections — not retroactive changes to metric definitions without a version note.

**Ops prerequisite for production 7d trends:** Apply both migrations and run `/api/cron/rollup-assignment-metrics` (or backfill) so path and global 7d rows populate.

---

### 2. What remaining risks or technical debt exist?

| Risk / debt | Severity | Notes |
|-------------|----------|-------|
| **Path snapshot bias** | Medium (interpretation) | Current metadata at read time; affects path breakdown and any future path latency |
| **No 7d latency** | Low (documented) | Admins see live medians only; 7d requires 7B-1c-b histograms |
| **Partial rollup coverage** | Low–medium (ops) | 7d trends show `partialCoverageNote` if cron gaps; not a code defect |
| **24h window = UTC-hour floor** | Low | Slightly &gt;24h effective window; consistent across funnel and latency |
| **Live query cost at scale** | Low (current volume) | Bounded fetches mirror 7B-1a; monitor if offer volume grows 10× |
| **Pending audit fetch scope** | Low | Latency pending rows fetched for created-in-window + assigned-in-window bookings only — sufficient for shipped metrics |
| **No per-offer path column** | Medium (future) | Blocks accurate 7B-1d until 7B-4 or equivalent |
| **7C / 7D undefined** | N/A | No design docs in repo; not blockers to freezing 7B |

---

### 3. What should be the next safest direction?

| Option | Safety | Rationale |
|--------|--------|-----------|
| **7B-1c-b — histogram rollups for 7d latency** | **Highest** | Same table pattern as 5H-b / 7B-1a; additive columns; cron-only writes; no assignment changes; completes latency story without path bias |
| **7B-4 — per-offer `assignment_path` snapshot** | **High** (schema) | Foundational; improves 1b accuracy and unblocks 1d; small command touch at offer insert — needs careful design |
| **7B-1d — path-split latency** | **Medium** | Interpretation risk until 7B-4; sample gates help but snapshot bias remains |
| **7C — SLA intelligence** | **Lower** (greenfield) | New product surface; needs SLA definitions, breach rules, separation from 7A queues |
| **7D — anomaly detection** | **Lowest** (greenfield) | Needs stable baselines (7B frozen + ideally 7B-1c-b 7d series), threshold tuning, alert noise controls |

**Recommended order:**

1. **7B-1c-b** — if the priority is “complete latency analytics” with minimal assignment risk.  
2. **7B-4** — if the priority is “accurate path dimensions” before any path-split latency (**7B-1d**).  
3. **7C** — only after product defines SLA metrics and explicit non-overlap with 7A triage.  
4. **7D** — after 7B baseline + at least one stable 7d series (rollups running reliably).

**Do not recommend** jumping to 7C or 7D before 7B ops hygiene (migrations applied, cron hourly, backfill for 7d) is confirmed in the target environment.

---

## Sign-off

| Reviewer action | Status |
|-----------------|--------|
| Freeze Stage 7B baseline (1a + 1b-min + 1c-min) | **Recommended** |
| Block assignment engine changes for analytics-only follow-ups | **Recommended** |
| Next implementation candidate | **7B-1c-b** (safest) or **7B-4** (if path accuracy is the bottleneck) |

**Stage 7B consolidation audit: PASS.**
