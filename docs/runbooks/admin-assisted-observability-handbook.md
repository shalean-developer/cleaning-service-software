# Admin-assisted booking — observability handbook

**Last updated:** 2026-05-23

## Production dashboard

**Route:** `/admin/operations/admin-assisted-production`

### Production learning (Phase 10)

- **Weekly rollout review** — health trend, conversion, payment/assignment/recurring success, failed notifications, unresolved incidents, operator highlights
- **Incident review queue** — human review status (open / investigating / resolved / dismissed); never auto-resolved
- **Operator lessons** — derived from feedback with category + tags
- **Improvement backlog** — read-only items from repeated incidents, tags, alerts, and weekly decisions
- **Rollout recommendation** — advisory only (continue / expand links / enable EFT / hold / rollback)

### Live metrics
- Active assisted bookings, pending payments, confirmed today
- Offline EFT today, failed payment requests
- Recurring failures, orphan confirmed, assignment dispatch failures
- Stale pending >72h

### Rollout health score (0–100)
| Band | Score | Meaning |
|------|-------|---------|
| Healthy | ≥85 | Normal operations |
| Warning | 70–84 | Review alerts same day |
| Degraded | 50–69 | Limit new rollout stages |
| Critical | <50 | Escalate ops lead |

### Incident panel
Read-only visibility for repeated failures, regeneration loops, recurring issues, assignment escalations, offline reconciliation.

## Weekly reporting

- Phase 9 fleet export: `/api/admin/bookings/assist-production/weekly-export?format=csv|json`
- Phase 10 learning exports (admin-only, scrubbed):
  - `/api/admin/bookings/assist-production/learning-export?export=weekly&format=csv|json`
  - `export=incidents|lessons|backlog`

See [admin-assisted-incident-response-sop.md](./admin-assisted-incident-response-sop.md) for weekly review process.

## Performance thresholds (production-safe)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Production load | >2000ms | Review scan caps; consider pagination |
| Recurring enrichment | >500ms | Check recurring table indexes |
| Assist-summary cache hit rate | <50% | Expected during low wizard traffic |
| Diagnostics scan cap | 500 bookings | Fleet metrics are sample-based |

## Optimization roadmap
1. Time-windowed queries instead of full fleet scan
2. Materialized assist metrics table (future)
3. External monitoring webhook (future — not in scope)
