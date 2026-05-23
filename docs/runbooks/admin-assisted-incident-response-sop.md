# Admin-assisted booking — incident response SOP

**Last updated:** 2026-05-23  
**Phase:** 10 — production learning (observation only)

## Purpose

Standardize how operators review admin-assisted booking incidents after rollout. This SOP does **not** auto-resolve incidents or mutate booking lifecycle.

## When to use

- Active incident appears on `/admin/operations/admin-assisted-production`
- Fleet alert escalates to incident (regeneration loop, assignment escalation, recurring failure, offline anomaly)
- Weekly review shows unresolved incidents > 0

## Incident review workflow

1. Open the production dashboard **Incident review queue**.
2. For each incident, set review status:
   - **open** — newly detected, not yet triaged
   - **investigating** — owner assigned, root cause in progress
   - **resolved** — mitigated or explained; add resolution notes
   - **dismissed** — false positive or acceptable noise; document why
3. Record **root cause notes**, **resolution notes**, and **follow-up action**.
4. Save review via the dashboard form (persists to `admin_assisted_incident_reviews`).
5. Do **not** bypass payment confirmation, assignment, or status overrides.

## Escalation matrix

| Severity | Response time | Owner |
|----------|---------------|-------|
| critical | Same shift | Ops lead + engineering on-call |
| high | Same business day | Ops lead |
| warning | Weekly review | Operator + ops lead |

## Rollback triggers (advisory)

Consider **hold** or **rollback** when:

- Unresolved **critical** incidents remain after investigation
- Recurring materialization failures persist
- Offline reconciliation anomalies (`offlinePaymentsFailed` > 0)
- Failed payment request rate ≥ 3 in scan window
- Health band = **critical**

The dashboard **Rollout recommendation** is advisory only — flags are changed manually per [admin-assisted-booking-rollout.md](./admin-assisted-booking-rollout.md).

## Operator feedback review

1. Operators submit feedback on booking detail (category + tags optional).
2. Lessons appear on the production dashboard and in weekly/lessons exports.
3. Ops lead reviews repeated tags (≥2 occurrences) in the generated backlog.

## Weekly review cadence

Every week (or before stage expansion):

1. Export weekly review CSV/JSON from production dashboard.
2. Review health score trend, conversion, payment/assignment/recurring success rates.
3. Triage unresolved incidents until resolved or dismissed.
4. Review improvement backlog (generated, read-only).
5. Record rollout decision rationale in ops notes (continue / expand links / enable EFT / hold / rollback).

## EFT rollout decision criteria

Enable offline EFT only when **all** are true:

- Health score ≥ 85
- Unresolved incidents ≤ 2 (none critical)
- Assignment success ≥ 90%
- Payment success ≥ 50% (link conversion or confirmed assists)
- Checklist `productionReady=true` and EFT item signed
- Advisory recommendation = **Enable EFT (next stage)**

## Documentation links

- [Observability handbook](./admin-assisted-observability-handbook.md)
- [Production rollout runbook](./admin-assisted-booking-rollout.md)
- [Alert interpretation](./admin-assisted-alert-interpretation.md)
