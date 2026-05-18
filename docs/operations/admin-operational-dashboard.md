# Admin operational dashboard

Operational views for admins at `/admin`. Stage **4B-1** added counts, filters, and audit detail. Stage **4B-2a** adds a **single-booking assignment recovery** action on booking detail (no manual cleaner pick, no batch recover in UI).

Related runbooks:

- [Assignment recovery after payment](./assignment-recovery.md)
- [Assignment decline & redispatch](./assignment-decline-redispatch.md)
- [Payment failed — customer retry](./payment-failed-customer-retry.md)
- [Expire pending payments cron](./expire-pending-payments-cron.md)
- [Expire assignment offers cron](./expire-assignment-offers-cron.md)

---

## Routes

| Route | Purpose |
|-------|---------|
| `/admin` | Operational queue strip (exact counts) + assignment preview + recent bookings |
| `/admin/bookings` | All bookings with filters and search |
| `/admin/bookings/[id]` | **Operational status panel** (recovery, manual dispatch, replace — Stage 6D-1), audit timelines, payout actions |
| `/admin/assignments` | Assignment queue with per-booking guidance |
| `/admin/payouts` | Payout-ready aggregates (unchanged) |
| `/admin/notifications` | Global notification outbox health (5D-2a) + 24h analytics (5H-a) + 7d text trends (5H-b) + retention dry-run counts (5I-α) |

---

## Operational Queue Summary Strip (Stage 7A-1)

The **Operational Queue Summary Strip** (`AdminOperationalQueueStrip`) is a read-only horizontal strip on **home**, **bookings**, and **assignments**. Each chip shows an **exact** booking count across **all** bookings (SQL `count(*)`, same semantics as `/admin/bookings?filter=…` `matchTotal`) and deep-links to `/admin/bookings?filter={filter}` for that queue.

| Chip | `filter` param | Meaning | Admin action |
|------|----------------|---------|--------------|
| **Needs assignment** | `pending_assignment` | `status = pending_assignment` | Review filtered list; dispatch from booking detail when eligible |
| **Dispatch not started** | `dispatch_not_started` | Paid, dispatch not started (6C visibility) | Monitor; recovery on booking detail or cron — see [assignment-recovery.md](./assignment-recovery.md) |
| **Recovery needed** | `recovery_needed` | Recovery eligible or dispatch not started | **Recover assignment** on booking detail when eligible |
| **Payment attention** | `payment_failed` | `status = payment_failed` | Customer must retry — see [payment-failed-customer-retry.md](./payment-failed-customer-retry.md) |
| **Assignment attention** | `assignment_attention` | Composed 6C attention preset (needs assignment, declined, max attempts, etc.) | Open filtered bookings; triage work queue at `/admin/assignments` |

**Deep links:** Every chip navigates to `/admin/bookings?filter=…` (for example `/admin/bookings?filter=payment_failed`). There is no separate count API — counts are computed server-side on each page load.

**Counts vs work queue:** The **Assignment attention** chip count uses `filter=assignment_attention` across **all** bookings (global exact count). **`/admin/assignments`** remains the detailed assignment work queue (scan of up to **100** `pending_assignment` / `confirmed` rows, in-app heuristics for day-to-day triage) and **may not match** the Assignment attention chip total exactly.

Home still shows up to **5** preview rows under “Needs attention” from the assignments work queue (not the chip total).

**List limits elsewhere (unchanged):**

- Bookings list (no filter): **200** newest by `updated_at`
- Assignment work queue scan: **100** `pending_assignment` / `confirmed` bookings

---

## Assignment queue badges

| Badge / key | Meaning | System still searching? | Admin action required? | Recovery cron? |
|-------------|---------|-------------------------|------------------------|----------------|
| Paid — dispatch not started | Paid `confirmed`, no dispatch progress past grace | No | Review | **Yes** — primary fix |
| Offer sent — awaiting acceptance | Open offer outstanding | Yes | Monitor | No |
| Finding cleaner / decline redispatched | Auto dispatch or redispatch in progress | Often yes | Monitor | No |
| Selected cleaner declined — admin action needed | Path `selected`, no auto redispatch | No | **Yes** — manual dispatch on booking detail when eligible | No |
| No cleaner accepted after dispatch attempts | Max attempts reached | No | **Yes** — manual dispatch on booking detail when eligible | No |
| Needs assignment | Generic `attention_required` | Varies | Review | Maybe |

Queue rows include a **guidance** block: why the booking is listed, flags for searching / admin required / cron / manual intervention, and a runbook reference path.

---

## Bookings filters

Query params on `/admin/bookings`:

| Filter | Shows |
|--------|--------|
| `payment_failed` | `status = payment_failed` |
| `pending_assignment` | `status = pending_assignment` |
| `assignment_attention` | Needs assignment, selected declined, or max attempts |
| `dispatch_not_started` | Visibility key or recovery dispatch-not-started |
| `selected_declined` | Selected cleaner declined |
| `max_attempts` | No cleaner accepted after dispatch attempts |
| `recovery_needed` | Recovery eligible or dispatch not started |

Search (`q`): booking UUID fragment, customer company name, payment provider reference.

Date range (`from`, `to`): filters on **scheduled** start date.

---

## Booking detail — operational status panel

**Mounted on** `/admin/bookings/[bookingId]` as of **Stage 6D-1** (`AdminOperationalStatusPanel`). Uses `getAdminBookingDetail().operational` only — no new eligibility logic in the UI. Actions call existing admin APIs (`recover-assignment`, `dispatch-offer`, `replace-open-offer`); no new lifecycle mutations.

- Payment and assignment state labels
- Recovery eligibility (`eligible`, grace period, in progress, N/A)
- Open offer summary and last offer outcome
- **Suggested next step** (text + runbook path)
- **Recover assignment** (4B-2a) — only when eligibility is **eligible**

### Recover assignment (4B-2a)

| Field | Rule |
|-------|------|
| Visible when | Operational panel: recovery eligibility = **eligible** |
| Hidden when | Grace period, dispatch in progress, payment failed, already assigned |
| Required | Reason (8–500 chars) before POST |
| Does | Re-runs post-payment dispatch for this booking via existing engine |
| Does not | Pick a cleaner, override status, finalize payment, or batch-recover |

See [assignment-recovery.md](./assignment-recovery.md) for outcomes and when to use cron instead.

### Send offer to cleaner (4B-3a)

| Field | Rule |
|-------|------|
| Visible when | `pending_assignment`, paid, no assigned cleaner, no open offer to another cleaner, manual intervention needed |
| Hidden when | `confirmed` (use recovery first), open offer awaiting response, already assigned |
| Required | Eligible cleaner + reason (8–500 chars); checkbox if max dispatch attempts reached |
| Does | `POST /api/admin/bookings/:bookingId/dispatch-offer` → `OFFER_TO_CLEANER` (admin actor) |
| Does not | Direct-assign cleaner, accept on behalf of cleaner |

**Important:** This sends an **offer only**. The booking becomes `assigned` when the cleaner **accepts** — same as automated dispatch.

After acceptance, lifecycle continues normally (in progress, completed, payout).

See [assignment-decline-redispatch.md](./assignment-decline-redispatch.md) for when to use manual dispatch vs waiting for auto-redispatch.

### Admin operations audit (5B-1a)

Booking detail has two audit sections:

| Section | Source | Audience |
|---------|--------|----------|
| **State audit** | `booking_state_audit` | Lifecycle commands (customer/cleaner may read their booking’s rows) |
| **Admin operations** | `admin_operational_audit` | Recovery, dispatch, replace, notification requeue — **admin only** |

Records success, idempotent, rejected, and failed outcomes with the admin’s reason. See [admin-operational-audit.md](./admin-operational-audit.md). No backfill for pre-deploy console-only logs.

### Notification history (5D-1)

Booking detail includes a **Notifications** section (read-only):

| Topic | Behavior |
|-------|----------|
| Source | `notification_outbox` rows where `payload.bookingId` matches the booking |
| Limit | Latest **25** rows, newest first |
| Shows | Template, status, channel, attempts, last update, sanitized error / dry-run note, short offer id when present |
| Hidden | Recipient **email addresses**, raw JSON payload, secrets |
| Actions | **Requeue** on **failed** deliverable rows; **Requeue dry-run** on **dry-run `sent`** rows (`last_error` starts with `dry_run_sent`) — required reason; resets row to `pending` for cron/worker |

**Requeue does not:** send email immediately, trigger cron from the UI, bypass worker delivery dedupe, resend **live** `sent` rows, or support bulk requeue. After requeue, **cron must run**; delivery mode determines whether the next worker pass is dry-run or Resend. Force-resend is deferred (5E+).

Use this section to confirm whether `payment_confirmed`, `payment_failed`, or `assignment_offer` rows reached `sent` vs `pending` / `failed`. Unsupported templates (e.g. `booking_draft_created`) may remain `pending` until a later worker stage.

See [notification-outbox-worker.md](./notification-outbox-worker.md) for delivery flags and cron behavior.

### Global notification health (5D-2a + 5H-a + 5H-b)

Route: **`/admin/notifications`** (admin nav → Notifications).

Page order (top to bottom): delivery banner → **delivery analytics (24h + 7d trends)** → **template breakdown** → worker health → recent worker runs → point-in-time summary cards → filtered outbox table.

| Topic | Behavior |
|-------|----------|
| Purpose | Platform-wide `notification_outbox` queue health + rolling worker telemetry |
| Delivery analytics (5H-a) | **24h worker metrics** from `notification_worker_runs` (`completed_at` in last 24 hours): run count, runs OK %, sent/failed/dry-run/scanned totals, avg sent per run |
| Live success rate (5H-a) | **Resend only** — batches where `delivery_enabled` and `email_provider = resend`; **excludes** dry-run provider runs |
| Dry-run share (5H-a) | **Separate** metric — dry-run count as % of (sent + failed + dry-run) in the window; shown beside live success rate, not mixed into it |
| Dry-run mode badge (5H-a) | Shown when delivery is enabled and configured provider is `dry_run` (config signal, not a queue failure) |
| Queue pressure (5H-a) | Derived score from deliverable **actionable pending + processing + failed**; label normal / elevated / critical; **unsupported pending excluded** from score |
| Template breakdown (5H-a) | **Supported templates only** — `payment_confirmed`, `payment_failed` (email), `assignment_offer` (push channel); columns: sent, failed, pending, processing per template |
| Unsupported pending (5H-a) | **Separate** subsection under template breakdown — `booking_draft_created`, `payment_pending`, `pending_assignment`, `cleaner_assigned` pending counts only; labeled enqueue-only, not delivery failures |
| 7-day trends (5H-b) | **Text only** under the 24h strip — from `notification_metrics_hourly`: sent, failed rows, live success rate, dry-run deliveries, worker runs vs **prior 7 days**; shows `rollupAsOf` and partial-coverage note when buckets are missing |
| Analytics sensitive data | **No** recipient emails, raw outbox `payload`, raw worker `errors` JSON, or provider response bodies in analytics or trend DTOs — counts, rates, template keys, and enums only |
| Summary cards | Sent, actionable pending, scheduled retry, processing, failed, stale processing, **unsupported pending**, dry-run row count (current outbox state — below analytics) |
| Oldest pending | Age of oldest deliverable pending row with retry due |
| Default table | Needs attention — deliverable `pending` / `processing` / `failed`, newest first, cap **100** |
| Unsupported policy | `booking_draft_created`, `payment_pending`, etc. stay `pending` — counted separately, **not failures** |
| Filters | `status`, `template`, `deliverable` (`true` / `false` / `all`) via query params |
| Hidden (all sections) | Recipient emails, raw payload, API keys |
| Actions | **Requeue** / **Requeue dry-run** (5E-1b-α / 5E-1b-β) — same eligibility as booking detail; required reason; no bulk actions; do not trigger cron from UI |
| Worker health (5G-a) | **Last worker run** card — cron freshness (healthy ≤10m, warning ≤15m, critical >15m), last counters, delivery snapshot at run time; no raw errors or emails |
| Recent worker runs (5G-b) | Read-only table (newest **15**) — time, OK/partial/failed badge, provider, trigger, delivery on/off, counters; empty state when no rows; **no** raw `errors`, emails, or “run now”; retention/pagination deferred |

**How to read analytics vs summary cards:** 24h cards = **live** worker-run aggregates. 7d trends = **hourly rollup buckets** (worker throughput only). Summary cards = **queue snapshot now** (outbox). A healthy cron can show high 7d `sent` while actionable pending is still elevated if new rows enqueue faster than the worker drains them.

**5H-b ops:** Schedule hourly rollup cron; run `npm run ops:backfill:notification-metrics` once after deploy. See [notification-outbox-worker.md](./notification-outbox-worker.md) § Hourly metrics rollup.

**Troubleshooting failed rows:** Use the Note column (sanitized `last_error`). Common causes: no auth email on customer/cleaner profile, stale booking/offer state, provider send failure after retries, delivery disabled. Per-booking context: open the booking link → Notifications section. Do **not** `UPDATE` outbox status in SQL.

See [notification-outbox-worker.md](./notification-outbox-worker.md) for worker flags, dry-run behavior, and how run counters feed analytics.

### Replace open offer (4C-a)

| Field | Rule |
|-------|------|
| Visible when | Exactly **one** ops-open offer on a `pending_assignment` paid booking with no assigned cleaner |
| Hidden when | No open offer (use **Send offer** instead) or multiple open offers (data incident) |
| Required | New eligible cleaner (not the current offer holder) + reason (8–500 chars); max-attempts checkbox when ≥5 offer rows |
| Does | `POST /api/admin/bookings/:bookingId/replace-open-offer` → `CANCEL_OPEN_ASSIGNMENT_OFFER` then `OFFER_TO_CLEANER` (admin actor) |
| Does not | Direct-assign, cancel-only API, notify withdrawn cleaner, assignment queue shortcut |

**Important:** Cancels the current open offer (`cancelled` status) then sends a **new offer**. Booking stays `pending_assignment` until the new cleaner **accepts**.

Customers continue to see calm “finding cleaner” / “reviewing availability” copy — no “offer replaced” wording.

**Payout actions** (separate section): Mark payout-ready / Mark paid out when booking status allows.

---

## State audit timeline

Each audit row shows:

- Command and status transition
- Timestamp
- **Actor type** (customer, cleaner, admin, system, service)
- **Reason** when recorded
- **Idempotency key** when set (safe for ops dedupe)
- **Metadata summary** — whitelisted fields only (no secrets, tokens, or raw webhook payloads)

---

## What cron handles (admin does not click)

| Job | Doc |
|-----|-----|
| Recover assignment after payment | [assignment-recovery.md](./assignment-recovery.md) |
| Expire stale assignment offers + redispatch | [expire-assignment-offers-cron.md](./expire-assignment-offers-cron.md) |
| Expire pending payments | [expire-pending-payments-cron.md](./expire-pending-payments-cron.md) |
| Notification retention dry-run (counts only) | [notification-retention-cleanup-cron.md](./notification-retention-cleanup-cron.md) |

### Notification retention dry-run (5I-α)

On **`/admin/notifications`**, the **Retention dry-run** section shows how many rows would be eligible for future cleanup under the Stage 5I policy. **No data is deleted** from the admin UI or from the dry-run cron route (`deleted: 0`, `dryRun: true`).

**Before destructive cleanup:** run the dry-run cron daily for **3–5 days**, record counts, and complete the soak sign-off in [notification-retention-cleanup-cron.md](./notification-retention-cleanup-cron.md). Destructive purge is deferred to Stage 5I-β+.

---

## Intentionally not actionable in admin UI yet

- Notification retention purge (dry-run counts only in 5I-α; no delete)
- Notification retry / resend beyond governed requeue (5E)
- Assignment queue inline replace/dispatch (use booking detail)
- Cancel-only API (withdraw offer without immediate replacement)
- Push notification to cleaner when offer withdrawn
- Admin accept or decline on behalf of cleaner
- Payment finalize or retry
- `ADMIN_OVERRIDE_STATUS`
- Direct earnings or formula edits
- Batch recover all from UI

Use cron/script for batch recovery; use booking detail recovery for a single eligible booking.
