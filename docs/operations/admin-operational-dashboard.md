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
| `/admin` | Summary counts + preview of assignment attention + recent bookings |
| `/admin/bookings` | All bookings with filters and search |
| `/admin/bookings/[id]` | Operational status panel, audit timeline, payout actions (existing) |
| `/admin/assignments` | Assignment queue with per-booking guidance |
| `/admin/payouts` | Payout-ready aggregates (unchanged) |
| `/admin/notifications` | Global notification outbox health (5D-2a) |

---

## Summary counts (home)

| Card | Meaning | Admin action |
|------|---------|--------------|
| **Assignment attention** | Bookings in the assignment queue (see below) | Monitor queue; use runbooks — no in-app dispatch yet |
| **Payment issues** | Bookings with `status = payment_failed` | Customer must retry payment; see [payment-failed-customer-retry.md](./payment-failed-customer-retry.md) |
| **Recovery needed** | Paid bookings eligible for post-payment recovery (`dispatch_not_started` or recovery candidate) | Use **Recover assignment** on booking detail when eligible, or cron / ops script for batch — see [assignment-recovery.md](./assignment-recovery.md) |

Home shows up to **5** preview cards for assignment attention; the card total is the **full queue count**.

List limits (loaded from DB, then filtered in app):

- Bookings list: **200** newest by `updated_at`
- Assignment queue scan: **100** `pending_assignment` / `confirmed` bookings

---

## Assignment queue badges

| Badge / key | Meaning | System still searching? | Admin action required? | Recovery cron? |
|-------------|---------|-------------------------|------------------------|----------------|
| Paid — dispatch not started | Paid `confirmed`, no dispatch progress past grace | No | Review | **Yes** — primary fix |
| Offer sent — awaiting acceptance | Open offer outstanding | Yes | Monitor | No |
| Finding cleaner / decline redispatched | Auto dispatch or redispatch in progress | Often yes | Monitor | No |
| Selected cleaner declined — admin action needed | Path `selected`, no auto redispatch | No | **Yes** (manual dispatch not in app) | No |
| No cleaner accepted after dispatch attempts | Max attempts reached | No | **Yes** (manual dispatch not in app) | No |
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
| Actions | **Requeue** (5E-1a) on **failed** deliverable rows only — required reason; resets row to `pending` for cron/worker |

**Requeue does not:** send email immediately, trigger cron from the UI, bypass worker delivery dedupe, resend live `sent` rows, or support bulk requeue. Dry-run `sent` requeue is deferred (5E-1b-β); force-resend is deferred (5E+).

Use this section to confirm whether `payment_confirmed`, `payment_failed`, or `assignment_offer` rows reached `sent` vs `pending` / `failed`. Unsupported templates (e.g. `booking_draft_created`) may remain `pending` until a later worker stage.

See [notification-outbox-worker.md](./notification-outbox-worker.md) for delivery flags and cron behavior.

### Global notification health (5D-2a)

Route: **`/admin/notifications`** (admin nav → Notifications).

| Topic | Behavior |
|-------|----------|
| Purpose | Platform-wide `notification_outbox` queue health |
| Summary cards | Sent, actionable pending, scheduled retry, processing, failed, stale processing, **unsupported pending**, dry-run row count |
| Oldest pending | Age of oldest deliverable pending row with retry due |
| Default table | Needs attention — deliverable `pending` / `processing` / `failed`, newest first, cap **100** |
| Unsupported policy | `booking_draft_created`, `payment_pending`, etc. stay `pending` — counted separately, **not failures** |
| Filters | `status`, `template`, `deliverable` (`true` / `false` / `all`) via query params |
| Hidden | Recipient emails, raw payload, API keys |
| Actions | **Requeue** (5E-1b-α) on **failed** deliverable rows — same rules as booking detail; required reason; no bulk actions; do not trigger cron from UI |

**Troubleshooting failed rows:** Use the Note column (sanitized `last_error`). Common causes: no auth email on customer/cleaner profile, stale booking/offer state, provider send failure after retries, delivery disabled. Per-booking context: open the booking link → Notifications section. Do **not** `UPDATE` outbox status in SQL.

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

---

## Intentionally not actionable in admin UI yet

- Notification retry / resend (global and booking views are read-only in 5D-2a)
- Assignment queue inline replace/dispatch (use booking detail)
- Cancel-only API (withdraw offer without immediate replacement)
- Push notification to cleaner when offer withdrawn
- Admin accept or decline on behalf of cleaner
- Payment finalize or retry
- `ADMIN_OVERRIDE_STATUS`
- Direct earnings or formula edits
- Batch recover all from UI

Use cron/script for batch recovery; use booking detail recovery for a single eligible booking.
