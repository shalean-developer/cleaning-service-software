# Admin-assisted booking — pilot performance audit (Phase 7B)

**Status:** Internal pilot guidance  
**Last updated:** 2026-05-23

## Scope

Read-only audit of Phase 7A/7B operational tooling. No architecture changes.

## Current thresholds (pilot-safe)

| Surface | Limit / cadence | Notes |
|---------|-----------------|-------|
| Diagnostics booking scan | 500 rows | `ASSIST_BOOKING_SCAN_LIMIT` — fleet counts approximate when capped |
| Diagnostics audit scan | 2,000 rows | Analytics/friction derived from recent audit window |
| Pilot QA panel scan | 500 bookings / 2,000 audits | Same caps as diagnostics |
| Wizard assist-summary refresh | 800ms debounce | Coalesces rapid operator actions |
| Wizard polling | 30s, tab-hidden skip | Payment/confirmation steps only |
| Assist-summary payload | ~2–5 KB | Status, link, timeline snippets — not full booking detail |
| Full booking detail | Unchanged | Used only on booking detail page, not wizard poll |

## Query cost notes

1. **Diagnostics read model** — 6–8 parallel queries (bookings, audits, offline events, notifications, feedback count). Acceptable for admin-only pages; avoid embedding in high-traffic customer routes.
2. **Timeline aggregation** — Per-booking audit load + in-memory map. O(audits) per booking; fine for detail views, not for unbounded list rendering.
3. **Friction computation** — In-memory over scanned bookings + audits. Same cap sensitivity as diagnostics.
4. **Operator feedback / QA checklist** — Indexed by `booking_id`; low write volume expected during pilot.

## Polling load estimate

- 1 operator on confirmation step ≈ 2 requests/minute/booking (30s interval, debounced).
- 5 concurrent operators ≈ 10 req/min assist-summary — negligible vs normal admin traffic.

## Future scaling concerns

- Fleet scans beyond ~500 assisted bookings need pagination or materialized rollups.
- Audit analytics at high volume should move to hourly aggregates (similar to `notification_metrics_hourly`).
- Failed-notification booking correlation scans `notification_outbox` payload JSON — consider denormalized `booking_id` column on outbox if volume grows.

## Recommended optimizations (post-pilot)

1. Materialized view or cron snapshot for diagnostics/friction (refresh every 5–15 min).
2. Tag-based cache on assist-summary with invalidation on assist audit insert.
3. Raise scan caps only after index review on `bookings.metadata` JSON paths.
4. Export jobs async for >500 flagged rows.

## Pilot recommendation

Current tooling is **safe for internal pilot** (≤10 operators, ≤500 active assist bookings). Revisit caps before external/customer-facing ops dashboards.
