# Admin-assisted booking — alert interpretation guide

**Last updated:** 2026-05-23

Read-only fleet alerts — no auto-repair.

| Alert ID | Severity | Meaning | Operator action |
|----------|----------|---------|-----------------|
| `stale_pending_payment` | Critical | Pending >72h | Contact customer; check link/email delivery |
| `failed_payment_request_email` | Warning/Critical | Notification outbox failures | Resend email or WhatsApp copy |
| `repeated_link_regenerations` | Warning | Same booking regenerated multiple times | Confirm customer payment status before regenerating |
| `assignment_dispatch_attention` | Critical | pending_assignment without dispatch | Escalate; review assignment queue |
| `orphan_confirmed_unassigned` | Critical | confirmed but not pending_assignment | Escalate ops lead — possible dispatch failure |
| `recurring_materialization_failed` | Warning | Recurring series may not have materialized | Check recurring dashboard |
| `offline_payment_anomaly` | Warning | Offline event failed after record | Review `admin_offline_payment_events` |
| `paid_without_recurring_group` | Warning | Paid recurring booking without group | Check recurring health |
| `expired_links_pending` | Info | UI link expired while still pending | Late Paystack payment may still settle |
| `high_regenerate_rate` | Info | Fleet-wide high regenerate ratio | Review expiry SOP with team |

## Export fields

Pilot CSV/JSON includes `alert_flags`, `unresolved_alert_ids`, and per-booking friction for weekly review.
