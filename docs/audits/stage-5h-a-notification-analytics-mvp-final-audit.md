# Stage 5H-a — Notification Analytics MVP Final Audit

**Date:** 2026-05-17  
**Type:** Audit only — no code changes  
**Scope:** Stage **5H-a** — 24h worker aggregates, queue pressure badge, deliverable template breakdown, unsupported-pending section, sanitized admin DTO + UI on `/admin/notifications`  
**Related:** [stage-5h-notification-analytics-metrics-design.md](../architecture/stage-5h-notification-analytics-metrics-design.md), [stage-5g-notification-worker-run-logging-final-audit.md](./stage-5g-notification-worker-run-logging-final-audit.md), [stage-5d-notification-observability-final-audit.md](./stage-5d-notification-observability-final-audit.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| 24h worker stats load & aggregate | **Pass** |
| Live success rate excludes dry-run provider | **Pass** |
| Dry-run ratio shown separately | **Pass** |
| Queue pressure excludes unsupported pending | **Pass** |
| Template breakdown — deliverable only | **Pass** |
| Unsupported pending shown separately | **Pass** |
| Analytics SQL omits raw `errors` | **Pass** |
| Analytics DTO omits payloads / emails / errors | **Pass** |
| UI renders aggregates only | **Pass** (no dedicated component tests — see gaps) |
| Worker / requeue / RLS unchanged by 5H-a | **Pass** (read-side only) |
| Automated tests | **Pass** (25/25 targeted) |
| Operations docs for 5H-a UI | **Gap** — design doc only; ops runbook not updated |

**Overall:** Stage **5H-a is complete and safe** for production use **after** Stage **5G** migration `20260518210000_notification_worker_runs.sql` is applied (analytics reads that table). **Safe to proceed to Stage 5H-b** (hourly rollups / 7-day trends **design**). Implementation of 5H-b should remain a separate slice with its own migration, cron, and sanitization audit.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | 24h worker stats load correctly | **Pass** | `loadWorkerRunsForAnalytics()` — `notification_worker_runs` with `WORKER_RUN_ANALYTICS_SELECT`, `completed_at >= now - 24h`; `computeWorker24hAnalytics()`; integration test `loadNotificationAnalytics` + page test asserts `runCount` / `sentTotal` |
| 2 | Live success rate excludes dry-run | **Pass** | `computeWorker24hAnalytics()` only adds to `liveSent` / `liveFailed` when `delivery_enabled && email_provider === "resend"`; unit test `excludes dry-run provider runs from live success rate` |
| 3 | Dry-run ratio shown separately | **Pass** | `dryRunRatioPercent` = `dryRunTotal / (sent + failed + dryRun)`; UI cards **Dry-run (24h)** and **Dry-run share** with hints; separate from **Live success rate** |
| 4 | Queue pressure excludes unsupported pending | **Pass** | `computeQueuePressure(summary)` uses `actionablePending + processing + failed` only; `actionablePending` counts use `deliverable: true` in `loadNotificationHealthSummary()` |
| 5 | Template breakdown — supported templates only | **Pass** | `loadDeliverableTemplateBreakdown()` iterates `DELIVERABLE_NOTIFICATION_SPECS` (3 template/channel pairs); per-status head counts with template + channel filters |
| 6 | Unsupported pending appears separately | **Pass** | `loadUnsupportedTemplateBreakdown()` + `AdminNotificationTemplateBreakdownTable` “Unsupported pending (enqueue-only)” section; summary card **Unsupported pending** in `AdminNotificationHealthCards` |
| 7 | Analytics read model does not select raw errors | **Pass** | `WORKER_RUN_ANALYTICS_SELECT` omits `errors`; test asserts `cols` does not contain `"errors"`; mock throws if analytics query selects `errors` |
| 8 | Analytics DTO exposes no raw payloads / emails / errors | **Pass** | `AdminNotificationAnalytics` — numeric aggregates, template keys, enums only; `JSON.stringify(page.analytics)` tests reject `errors`, `@`, `payload` |
| 9 | UI renders analytics safely | **Pass** | `AdminNotificationAnalyticsPanel` / `AdminNotificationTemplateBreakdownTable` — counts and template keys only; footnote on dry-run vs pressure; **Gap:** no dedicated component tests for these two components (covered indirectly via read-model contract tests) |
| 10 | No worker / requeue / RLS behavior changed | **Pass** | 5H-a files: aggregates module, read-model extension, types, two UI components, page wiring, tests — **no** edits to `processNotificationOutbox.ts`, requeue actions, or Supabase RLS migrations for 5H-a |
| 11 | Tests pass | **Pass** | See [Test execution](#test-execution) |
| 12 | Docs updated | **Gap** | [stage-5h-notification-analytics-metrics-design.md](../architecture/stage-5h-notification-analytics-metrics-design.md) describes 5H-a; [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md) and [notification-outbox-worker.md](../operations/notification-outbox-worker.md) **do not** yet document the analytics strip / template table |

---

## Implementation map

| Piece | Path |
|-------|------|
| Pure aggregates (24h + pressure) | `src/features/notifications/server/notificationAnalyticsAggregates.ts` |
| Aggregate unit tests | `src/features/notifications/server/notificationAnalyticsAggregates.test.ts` |
| Analytics loader + bounded selects | `src/features/notifications/server/notificationAdminReadModel.ts` — `WORKER_RUN_ANALYTICS_SELECT`, `loadNotificationAnalytics()` |
| Sanitized DTO | `src/features/notifications/server/notificationAdminTypes.ts` — `AdminNotificationAnalytics` |
| Read-model / page contract tests | `src/features/notifications/server/notificationAdminReadModel.test.ts` |
| Analytics UI strip | `src/components/dashboard/AdminNotificationAnalyticsPanel.tsx` |
| Template matrix UI | `src/components/dashboard/AdminNotificationTemplateBreakdownTable.tsx` |
| Page composition | `src/app/(admin)/admin/notifications/page.tsx` |

---

## Security & data exposure

### Worker run query (24h window)

```258:273:src/features/notifications/server/notificationAdminReadModel.ts
/** Worker fields for 24h analytics — must not include `errors` JSONB (5H-a). */
export const WORKER_RUN_ANALYTICS_SELECT =
  "ok, delivery_enabled, email_provider, reclaimed, scanned, sent, skipped, failed, dry_run, completed_at";

async function loadWorkerRunsForAnalytics(
  client: SupabaseClient<Database>,
  now: Date,
): Promise<WorkerRunAnalyticsRow[]> {
  const sinceIso = new Date(
    now.getTime() - NOTIFICATION_ANALYTICS_WINDOW_HOURS * 60 * 60_000,
  ).toISOString();

  const { data, error } = await client
    .from("notification_worker_runs")
    .select(WORKER_RUN_ANALYTICS_SELECT)
    .gte("completed_at", sinceIso);
```

Recent-run and latest-health queries continue to use `WORKER_RUN_SELECT` (still **without** `errors`) — unchanged from 5G.

### Live vs dry-run metrics

```71:92:src/features/notifications/server/notificationAnalyticsAggregates.ts
    if (run.delivery_enabled && run.email_provider === "resend") {
      liveSent += run.sent;
      liveFailed += run.failed;
    }
  }

  const deliveryDenominator = sentTotal + failedTotal + dryRunTotal;

  return {
    // ...
    liveSuccessRatePercent: roundPercent(liveSent, liveSent + liveFailed),
    dryRunRatioPercent: roundPercent(dryRunTotal, deliveryDenominator),
```

- **Live success rate:** Resend + delivery enabled only (dry-run provider batches excluded).
- **Dry-run share:** Separate ratio over all delivery outcome counters in the window.
- **Totals** (`sentTotal`, `failedTotal`, `dryRunTotal`): Include all provider modes — labeled “All provider modes” / “Preview sends” in UI.

### Queue pressure

```97:111:src/features/notifications/server/notificationAnalyticsAggregates.ts
export function computeQueuePressure(
  summary: Pick<
    NotificationHealthSummary,
    "actionablePending" | "processing" | "failed" | "staleProcessing"
  >,
): NotificationQueuePressure {
  const score = summary.actionablePending + summary.processing + summary.failed;
  // critical if failed >= 5 OR staleProcessing >= 1
  // elevated if actionablePending >= 10 OR processing >= 5
```

`unsupportedPending` is **not** an input — aligned with design §8.

### Template breakdown

| Bucket | Source | In failure / pressure rates? |
|--------|--------|--------------------------------|
| Deliverable | `DELIVERABLE_NOTIFICATION_SPECS` × status counts | Yes (via deliverable summary fields) |
| Unsupported | `UNSUPPORTED_PENDING_TEMPLATES` pending counts only | No — informational backlog |

---

## UI safety

| Surface | Renders | Does not render |
|---------|---------|-----------------|
| Analytics panel | Run counts, percentages, pressure label/score, dry-run mode badge | Emails, `errors`, payload JSON, row IDs |
| Template table | Template key, channel, status counts | Recipient, `last_error` bodies, payload |
| Unsupported section | Template key + pending count | Same |

Page order: delivery banner → **analytics (5H-a)** → template breakdown → worker health (5G) → recent runs → health cards → outbox table (existing sanitization).

---

## Worker / requeue / RLS boundary

| Concern | 5H-a impact |
|---------|-------------|
| `processNotificationOutbox` | **None** — no imports or logic changes |
| Cron delivery batching | **None** for analytics slice (5G cron persist may exist separately) |
| Admin requeue | **None** — eligibility and actions unchanged |
| RLS on `notification_outbox` / `notification_worker_runs` | **None** — no new migrations in 5H-a |
| New tables / cron rollups | **None** — explicitly deferred to 5H-b |

---

## Test execution

Commands run on **2026-05-17**:

```bash
npm run typecheck
# exit 0

npx vitest run src/features/notifications/server/notificationAnalyticsAggregates.test.ts \
  src/features/notifications/server/notificationAdminReadModel.test.ts
# 2 files, 12 tests passed

npx vitest run src/components/dashboard/AdminNotificationDeliveryBanner.test.tsx \
  src/components/dashboard/AdminNotificationWorkerHealthCard.test.tsx \
  src/components/dashboard/AdminNotificationRecentWorkerRunsTable.test.tsx \
  src/components/dashboard/AdminNotificationOutboxTable.test.tsx
# 4 files, 13 tests passed
```

| Bundle | Files | Tests |
|--------|-------|-------|
| Typecheck | — | **Pass** |
| Analytics aggregates | `notificationAnalyticsAggregates.test.ts` | 5 |
| Admin read model (incl. analytics) | `notificationAdminReadModel.test.ts` | 7 |
| Admin notification components | 4 component test files | 13 |
| **Total targeted** | **6** | **25 passed** |

### Test gaps (non-blocking for 5H-a sign-off)

| Gap | Risk | Recommendation for 5H-b |
|-----|------|-------------------------|
| No `AdminNotificationAnalyticsPanel.test.tsx` | Low — DTO contract tested server-side | Add render test asserting no `@` / `errors` / `payload` in HTML |
| No `AdminNotificationTemplateBreakdownTable.test.tsx` | Low | Same |
| No `completed_at` window boundary test | Low | Add fixture run at T−24h±1s |
| No live DB / RLS test for analytics path | Low | Unchanged RLS; optional JWT integration test later |

---

## Documentation

| Document | 5H-a coverage |
|----------|----------------|
| `docs/architecture/stage-5h-notification-analytics-metrics-design.md` | **Yes** — defines 5H-a slice, sanitization rules, deferred 5H-b |
| `docs/operations/admin-operational-dashboard.md` | **No** — still ends at 5G-b recent runs table |
| `docs/operations/notification-outbox-worker.md` | **No** — no analytics section |

**Recommended follow-up (ops, not blocking 5H-b design):** Add a short subsection under “Global notification health” describing the 24h analytics strip, live vs dry-run metrics, template breakdown, and that unsupported pending is excluded from pressure score.

---

## Performance note (informational)

`loadNotificationAnalytics()` runs **1** worker-runs query plus **12** deliverable head-count queries (3 templates × 4 statuses) plus **4** unsupported pending counts — **17** round-trips in parallel via `Promise.all`. Acceptable for MVP; 5H-b rollups should reduce hot-path query fan-out for trends.

---

## Stage 5H-a vs Stage 5H-b boundary

| In scope (5H-a — shipped) | Deferred (5H-b+) |
|---------------------------|------------------|
| 24h worker aggregates on read | Hourly rollup table |
| Template × status matrix (live counts) | 7-day trend text / sparklines |
| Queue pressure badge | Home dashboard chip |
| Sync compute on page load | Cron rollup job |
| Sanitized DTO + UI strip | Export / BI |

**5H-b design** should treat this audit’s sanitization contract as fixed: rollups store **counts and enums only**; never persist or SELECT `errors`, `payload`, or `recipient` into browser-facing rollup DTOs.

---

## Final question

### Is Stage 5H-a complete and safe enough to move to Stage 5H-b hourly rollups / 7-day trends design?

**Yes.**

- Functional MVP matches the design slice: 24h worker stats, separated dry-run metrics, deliverable template matrix, isolated unsupported backlog, queue pressure without unsupported noise.
- Security posture holds: analytics path does not SELECT `errors`; DTO and integration tests guard against payloads, emails, and error blobs in the admin API surface.
- Worker delivery, requeue governance, and RLS are untouched by the 5H-a read/UI layer.
- Automated tests and typecheck pass for the targeted bundles.

**Before production:** Ensure `notification_worker_runs` migration (5G) is applied so 24h stats have data.

**Before 5H-b implementation:** Complete ops doc updates; consider analytics panel component tests and window-boundary unit tests when building rollups.
