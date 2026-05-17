# Notification outbox worker (Stage 5C-1a / 5C-1b-a / 5C-2a / 5C-2b)

Delivers **customer `payment_confirmed` and `payment_failed` emails** and **cleaner `assignment_offer` emails** from `notification_outbox`. Other templates remain `pending` until later stages.

Design: [stage-5c-1b-payment-failed-email-design.md](../architecture/stage-5c-1b-payment-failed-email-design.md), [stage-5c-2-cleaner-offer-notification-design.md](../architecture/stage-5c-2-cleaner-offer-notification-design.md), [stage-5c-2b-notification-worker-queue-reachability-design.md](../architecture/stage-5c-2b-notification-worker-queue-reachability-design.md)

Enqueue rules: [notification-outbox.md](./notification-outbox.md)  
Audit: [stage-5c-notification-system-operational-messaging-audit.md](../audits/stage-5c-notification-system-operational-messaging-audit.md)

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ENABLE_NOTIFICATION_DELIVERY` | Yes (to send) | off | Must be `true` to process rows |
| `RESEND_API_KEY` | Yes (with Resend) | — | Resend API key |
| `NOTIFICATION_FROM_EMAIL` | Yes | — | Verified sender, e.g. `bookings@yourdomain.com` |
| `NOTIFICATION_SUPPORT_EMAIL` | No | — | Shown in email footer |
| `NOTIFICATION_EMAIL_PROVIDER` | No | `dry_run` when Resend missing; `resend` on Vercel production when configured | `dry_run` (no Resend) or `resend` (live sends) |
| `NOTIFICATION_DRY_RUN_MARK_SENT` | No | `true` | When `false` with `dry_run`, rows stay `pending` and `last_error` stores preview metadata |
| `APP_BASE_URL` | **Yes on Vercel** | — | Canonical hosted origin for email links (e.g. `https://cleaning-service-software.vercel.app`) |
| `NEXT_PUBLIC_APP_URL` | Fallback | — | Used when `APP_BASE_URL` is unset |
| `VERCEL_URL` | Auto on Vercel | — | Used when deployed and explicit URLs are missing or localhost |
| `CRON_SECRET` | Yes (cron route) | — | Same as other cron routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Worker reads outbox, bookings, auth |

**APP_BASE_URL (5C-2c):** Set to the deployed site origin in staging/production. The notification config resolves `APP_BASE_URL` → `NEXT_PUBLIC_APP_URL` → `https://${VERCEL_URL}`. On Vercel preview/production, **localhost origins are never used for email links** when a public origin is available. Local dev may use `http://localhost:3000`.

**Email provider port (Stage 5J-1a):** Active providers are **`dry_run`** and **`resend`** only, selected via `NOTIFICATION_EMAIL_PROVIDER` (same semantics as before). Sending goes through `NotificationEmailProviderPort` (`dryRunProvider`, `resendProvider`) and `resolveNotificationEmailSender()`. **No failover**, **no circuit breaker**, and **no Postmark send** in this slice.

Postmark (`POSTMARK_SERVER_TOKEN`) is **deferred** to a later stage and does not affect `providerReady` or delivery.

## Flag behavior

| State | Worker behavior |
|-------|-----------------|
| `ENABLE_NOTIFICATION_DELIVERY` not `true` | **No-op** — returns `deliveryEnabled: false`, does not query or mutate outbox |
| Flag on, `NOTIFICATION_EMAIL_PROVIDER=resend`, missing `RESEND_API_KEY` or `NOTIFICATION_FROM_EMAIL` | **No-op** — same as disabled |
| Flag on, `dry_run` provider (default when Resend missing, or explicit) | Processes rows without calling Resend |
| Flag on, `resend` provider and Resend configured | Live sends via Resend |

Rows are **never** marked `sent` when delivery is disabled.

## Supported-template polling (Stage 5C-2b)

The worker **does not** load the oldest `pending` rows of any template. It polls only rows that match the supported template/channel allowlist in SQL, then applies `isDeliverableOutboxRow` as a safety net.

| Template | Channel (poll + enqueue) |
|----------|--------------------------|
| `payment_confirmed` | `email` |
| `payment_failed` | `email` |
| `assignment_offer` | `push` (delivered as email placeholder) |

### Unsupported-template pending policy

Templates such as `booking_draft_created`, `payment_pending`, `cleaner_assigned`, and unknown templates:

- Stay **`pending`**
- Are **not** selected by the poll query
- Are **not** marked `sent` or `failed` by the worker
- Do **not** block supported rows (no head-of-line blocking)

`scanned` in the cron response counts **deliverable** rows only. `scanned: 0` is normal when the deliverable queue is empty, even if many unsupported `pending` rows exist.

### Deployment note (5C-2a + 5C-2b)

Deploy **5C-2a** (assignment offer email handler) and **5C-2b** (template-scoped polling) **together** before rerunning the cleaner offer staging soak. Either slice alone can leave `assignment_offer` rows undelivered.

## Supported templates

| Template | Delivered? |
|----------|------------|
| `payment_confirmed` | **Yes** (email) |
| `payment_failed` | **Yes** (email, Stage 5C-1b-a) |

### `payment_confirmed` delivery dedupe (5C hotfix)

| Topic | Behavior |
|-------|----------|
| **Delivery dedupe** | If another `payment_confirmed` row for the same `bookingId` is already `sent`, the current row is marked `sent` without a second email (same pattern as `payment_failed`). |
| **Enqueue** | Unchanged — command idempotency still controls how many rows are inserted. |
| **Historical duplicates** | Extra pending/duplicate rows may be drained as `skipped` (no Resend call) when a prior send exists. |
| `payment_pending` | No |
| `pending_assignment` | No |
| `cleaner_assigned` | No |
| `assignment_offer` | **Yes** (email — rows enqueued as `channel: push` until real push ships) |
| `booking_draft_created` | No |

### `payment_failed` delivery (5C-1b-a)

| Topic | Behavior |
|-------|----------|
| **Failure reason** | Loaded from latest `booking_state_audit` where `command = MARK_PAYMENT_FAILED` and `metadata.failure_reason` is set (`checkout_expired`, `paystack_declined`, or generic fallback). **Not** from outbox payload or Paystack events. |
| **Copy** | `checkout_expired` → subject “Your Shalean payment link expired”; other reasons → “Payment was not completed for your Shalean booking”. Calm body; no admin/dispatch/gateway details. |
| **Retry guidance** | If `assessPaymentRetryEligibility()` is true, email mentions retry from booking detail; otherwise suggests starting a new booking from the booking page. |
| **Primary link** | `{APP_BASE_URL}/customer/bookings/{bookingId}` |
| **Stale-row guard** | If booking is no longer `payment_failed` when the worker runs, row is marked `failed` (non-retryable) and **no email** is sent. |
| **Delivery dedupe** | If another `payment_failed` row for the same booking is already `sent`, the current row is marked `sent` without a second email. |
| **Enqueue** | Unchanged — still one row per first `MARK_PAYMENT_FAILED` (idempotent command replays do not enqueue). |

### `assignment_offer` delivery (5C-2a)

| Topic | Behavior |
|-------|----------|
| **Channel note** | Enqueued as `channel: push` from `OFFER_TO_CLEANER`; worker delivers as **email** in this slice (push placeholder). |
| **Recipient** | `cleaners.id` → `profile_id` → auth email |
| **Hydration** | Service label, schedule, suburb/city area (no street line), estimated earnings when preview exists, offer expiry |
| **Area copy (5C-2c)** | Suburb + city only (never `address.line1` or full address). Generic or missing values (e.g. `Street`, `Street, Street`, empty) → **“Area available in dashboard”** |
| **Primary link** | `{APP_BASE_URL}/cleaner/offers` — accept/decline only in authenticated dashboard; must be the hosted origin, not localhost |
| **Stale-row guard** | Skip send (mark `sent`) if offer not `offered`, past `expires_at`, booking not `pending_assignment`, or `cleaner_id` already set |
| **Delivery dedupe** | One email per `offerId` — skip if another `assignment_offer` row for same `offerId` is already `sent` |
| **Enqueue** | Unchanged — one row per new offer from `OFFER_TO_CLEANER` |

**Safe detail policy:** No customer name/phone/email, payment details, admin dispatch metadata, or direct accept/decline API links in email body.

**Known limitations:** No email when offer cancelled/replaced before worker runs (row drained as skip); no “offer withdrawn” email; no real push; no per-offer deep link.

## Dry-run testing (Stage 5C test mode)

Use **`NOTIFICATION_EMAIL_PROVIDER=dry_run`** to exercise the worker without consuming Resend quota.

| Setting | Behavior |
|---------|----------|
| `NOTIFICATION_EMAIL_PROVIDER=dry_run` | Never calls Resend; builds templates and resolves recipients as normal |
| `NOTIFICATION_DRY_RUN_MARK_SENT=true` (default) | Marks rows `sent`; sets `last_error` to safe `dry_run_sent;template=…;bookingId=…;recipientType=…` metadata |
| `NOTIFICATION_DRY_RUN_MARK_SENT=false` | Leaves rows `pending` with preview metadata in `last_error` (re-runnable) |

**Provider defaults:**

- Resend **not** configured → `dry_run`
- Vercel **production** with Resend configured and provider unset → `resend`
- Otherwise (local, preview, staging) with Resend configured and provider unset → `dry_run`

**Production:** set `NOTIFICATION_EMAIL_PROVIDER=resend` explicitly.

**Staging/local example:**

```bash
ENABLE_NOTIFICATION_DELIVERY=true
NOTIFICATION_EMAIL_PROVIDER=dry_run
APP_BASE_URL=https://cleaning-service-software.vercel.app
# RESEND_API_KEY not required for dry_run
```

Cron response includes `emailProvider`, `dryRun`, and `dryRunPreviews` (template, `bookingId`, `offerId`, `recipientType` only — **no email addresses**).

## Cron route

`GET` or `POST` `/api/cron/process-notification-outbox`

Headers (either):

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

Response (no email addresses):

```json
{
  "ok": true,
  "deliveryEnabled": true,
  "emailProvider": "dry_run",
  "reclaimed": 0,
  "scanned": 3,
  "sent": 2,
  "skipped": 0,
  "dryRun": 0,
  "failed": 1,
  "errors": [{ "outboxId": "…", "code": "PROCESS_FAILED", "message": "…" }],
  "dryRunPreviews": [
    {
      "outboxId": "…",
      "template": "payment_confirmed",
      "bookingId": "…",
      "offerId": null,
      "recipientType": "customer"
    }
  ]
}
```

### Schedule recommendation

- **Production:** every **2–5 minutes** via Supabase `pg_cron` + `pg_net` (mirror [expire-pending-payments-cron.md](./expire-pending-payments-cron.md))
- **Staging:** manual invoke or same schedule with Resend sandbox domain

### Manual trigger (local/staging)

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/process-notification-outbox"
```

Mark manual invocations in run logs (optional header):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  -H "x-cron-invoke-source: manual" \
  "http://localhost:3000/api/cron/process-notification-outbox"
```

## Worker run logging (Stage 5G-a)

Each successful cron invocation (after auth) appends one row to **`notification_worker_runs`** via service role. Admins see the latest run on **`/admin/notifications`** (Last worker run card) and the **15 most recent runs** in a read-only table (5G-b).

| Topic | Behavior |
|-------|----------|
| **Write path** | Cron route only — `recordNotificationWorkerRun()`; never throws; cron JSON response unchanged |
| **Disable logging** | `NOTIFICATION_WORKER_RUN_LOGGING=false` |
| **RLS** | Admin JWT: `SELECT` only; writes: `service_role` only; append-only (no UPDATE/DELETE) |
| **Stored** | `ok`, timing, `delivery_enabled`, `email_provider`, `trigger_source`, counters (`reclaimed`, `scanned`, `sent`, `skipped`, `failed`, `dry_run`), capped `errors` JSON |
| **Admin UI (5G-b)** | Recent runs table: sanitized counters and status only — **no** raw `errors` JSON, emails, or provider payloads; **no** cron trigger from UI |
| **Not stored** | Email addresses, raw provider payloads, `dryRunPreviews`, outbox `payload` |
| **trigger_source** | `cron` (default) or `manual` when `x-cron-invoke-source: manual` |
| **Retention / pagination** | Deferred — fixed cap of 15 newest rows; no purge job yet |

### Cron freshness (admin UI)

| Level | Threshold (since last `completed_at`) |
|-------|--------------------------------------|
| Healthy | ≤ **10** minutes |
| Warning | **> 10** and ≤ **15** minutes |
| Critical | **> 15** minutes |
| Unknown | No rows yet |

Assumes scheduler runs every **2–5 minutes**. A recent run with `delivery_enabled = false` still counts as healthy cron (proves scheduler + route work).

### Troubleshooting stale cron

1. Confirm `pg_cron` / `pg_net` job targets `/api/cron/process-notification-outbox` with `CRON_SECRET`.
2. Confirm deployment has `SUPABASE_SERVICE_ROLE_KEY` (503 without it).
3. Invoke manual curl above; refresh `/admin/notifications` — card should update within one load.
4. Check Vercel/function logs for `notification_worker_run_persist_failed` if manual curl works but no DB row.

**Deferred (post 5G-b):** Pagination, retention/purge job, per-run error drill-down in UI.

## Admin delivery analytics (Stage 5H-a)

Admins see a **Delivery analytics (24h)** strip and **Template breakdown** on **`/admin/notifications`**, computed on page load from `notification_worker_runs` (24h window) and bounded outbox head counts. No new tables, cron jobs, or charts in this slice.

| Topic | Behavior |
|-------|----------|
| **Data source (24h)** | `notification_worker_runs` where `completed_at >= now() - 24 hours`; aggregate fields only — query **must not** `SELECT` the `errors` JSONB column |
| **Run metrics shown** | Run count, runs OK %, sum sent / failed / dry-run / scanned / skipped / reclaimed, avg sent per run |
| **Live success rate** | `sent / (sent + failed)` counting only runs with `delivery_enabled` and `email_provider = resend` — **excludes dry-run provider batches** |
| **Dry-run share** | Separate % — `dry_run / (sent + failed + dry_run)` across all provider modes in the window |
| **Dry-run mode badge** | UI badge when delivery is enabled and configured provider is `dry_run` |
| **Queue pressure** | Score = deliverable actionable pending + processing + failed (from outbox summary); **unsupported pending is excluded**; elevated/critical thresholds match ops cards |
| **Supported template breakdown** | Per-row counts for deliverable templates only: `payment_confirmed`, `payment_failed` (email), `assignment_offer` (push) × sent / failed / pending / processing |
| **Unsupported pending breakdown** | Separate list — `booking_draft_created`, `payment_pending`, `pending_assignment`, `cleaner_assigned` pending counts only; **not** included in pressure score or live success rate |
| **Sensitive data policy** | Analytics DTO and UI expose **no** recipient emails, raw outbox `payload`, raw worker `errors` JSON, or provider response bodies — template keys, channels, counts, rates, and enums only |
| **Not in 5H-a** | 7-day trends, hourly rollups, charts, export, home dashboard chip |

**Requires:** Stage **5G** migration `notification_worker_runs` applied; cron logging enabled (default). Empty analytics when no runs exist in the window is normal on new environments.

## Hourly metrics rollup & 7-day trends (Stage 5H-b)

Persists **worker telemetry only** into `notification_metrics_hourly` (one row per UTC hour). Powers **text-only 7-day trends** on `/admin/notifications` under the 24h strip. Does **not** change the outbox worker or 5H-a live 24h cards.

| Topic | Behavior |
|-------|----------|
| **Table** | `notification_metrics_hourly` — integer counters only; **no** `errors`, `payload`, `recipient`, or `template` columns |
| **Rollup source** | `notification_worker_runs` where `completed_at` in `[bucket_start, bucket_start + 1 hour)` — query **must not** `SELECT` `errors` |
| **Closed hour only** | Default cron rolls the **previous** closed UTC hour — never the in-progress hour |
| **Live counters** | `live_sent_count` / `live_failed_count` only when `delivery_enabled` and `email_provider = resend`; `dry_run_count` stays separate |
| **Idempotent** | `service_role` upsert on `bucket_start` — safe to rerun the same hour |
| **RLS** | Admin JWT: `SELECT` only; writes: `service_role` only |
| **7-day trends** | Sums last 7×24 buckets vs prior 7×24: sent, failed row count, live success rate, dry-run deliveries, worker run count — **text only**, no charts |
| **Partial coverage** | UI notes when fewer than ~90% of hourly buckets exist (e.g. before backfill) |
| **Sensitive data** | Rollup cron response and admin trends DTO: **no** emails, raw payloads, or raw errors |

### Rollup cron route

`GET` or `POST` `/api/cron/rollup-notification-metrics`

Headers: `Authorization: Bearer $CRON_SECRET` or `x-cron-secret`.

| Call | Behavior |
|------|----------|
| Default (no params) | Roll up **previous closed UTC hour** |
| `?bucketStart=2026-05-17T10:00:00.000Z` | Roll up that UTC hour (ops replay) |
| `POST { "backfillHours": N }` | Roll up to **24** closed hours in one request (capped) |

Response (counts only):

```json
{
  "ok": true,
  "bucketStart": "2026-05-17T10:00:00.000Z",
  "runCount": 12,
  "liveSent": 30,
  "liveFailed": 2,
  "dryRun": 0,
  "upserted": true
}
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `NOTIFICATION_METRICS_ROLLUP_ENABLED` | on | Set `false` to disable rollup cron |
| `CRON_SECRET` | required | Auth for cron route |
| `SUPABASE_SERVICE_ROLE_KEY` | required | Upsert buckets |

**Schedule:** hourly at **:05** UTC (after the closed hour), via `pg_cron` + `pg_net` or external scheduler — separate from the outbox worker cron.

### Backfill (last 168 closed hours)

After first deploy:

```bash
npm run ops:backfill:notification-metrics
```

Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Optional: `NOTIFICATION_METRICS_BACKFILL_HOURS=168` (max 168). Logs counts only — no PII.

Manual single hour:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR_DOMAIN/api/cron/rollup-notification-metrics?bucketStart=2026-05-17T10:00:00.000Z"
```

**Requires:** migration `20260518220000_notification_metrics_hourly.sql` and Stage **5G** worker runs data.

## Stale `processing` reclaim (Stage 5C-1c)

If the worker crashes after claiming a row (`pending` → `processing`), reclaim returns it to the queue. **Reclaim does not send email.**

| Variable | Default | Purpose |
|----------|---------|---------|
| `NOTIFICATION_PROCESSING_STALE_MINUTES` | `15` | Stale threshold (10–15 min recommended) |

### Rows eligible for reclaim

| Condition | Required |
|-----------|----------|
| `status` | `processing` |
| `updated_at` | Older than stale threshold (claim time) |
| `attempts` | **&lt;** `NOTIFICATION_MAX_ATTEMPTS` (5) |

### Rows not reclaimed

| Status | Reason |
|--------|--------|
| `sent` | Terminal success |
| `failed` | Terminal failure |
| `pending` | Already queued |
| `processing` (fresh) | Still within stale window |
| `processing` + `attempts >= 5` | Exhausted — leave for ops / manual review |

### Fields set on reclaim

| Field | Value |
|-------|--------|
| `status` | `pending` |
| `next_retry_at` | `now()` |
| `last_error` | `Reclaimed stale processing notification` |
| `attempts` | Unchanged |

Reclaim runs at the **start of every cron invocation** (even when `ENABLE_NOTIFICATION_DELIVERY` is off), before the delivery batch.

Cron response includes `reclaimed` (count reset on that run).

## Worker behavior (summary)

1. Reclaim stale `processing` rows (see above).
2. Select `pending` rows where retry is due (`next_retry_at` null or ≤ now) **and** template/channel is in the supported allowlist (5C-2b), oldest first, up to batch size.
3. Apply `isDeliverableOutboxRow` (payload guards, e.g. `offerId` + `bookingId` for offers).
4. Claim row: `pending` → `processing`.
5. Resolve recipient → auth email (`customers.id` or `cleaners.id`).
6. Load booking/offer context; apply stale/dedupe guards per template.
7. Build transactional template (no admin/dispatch fields).
8. Send via **Resend**.
9. Success → `sent`; retryable failure → `pending` + `next_retry_at`; permanent / max attempts → `failed`.
10. One bad row does not stop the batch.

## Provider setup (Resend)

1. Create a Resend account and verify your sending domain.
2. Add DNS records Resend provides (SPF/DKIM).
3. Set `NOTIFICATION_FROM_EMAIL` to an address on that domain.
4. Use a sandbox API key in non-production.

## Rollback / disable

1. Set `ENABLE_NOTIFICATION_DELIVERY=false` (or unset) in Vercel — **immediate no-op**.
2. Unschedule `pg_cron` job if configured.
3. Existing `pending` rows are safe; nothing is deleted.
4. To re-enable: set flag + env, redeploy, run cron manually once.

Do **not** mark rows `sent` in SQL without a provider send — that would block legitimate delivery.

## Admin observability (Stage 5D-1 / 5D-2a / 5G / 5H-a)

| Surface | Detail |
|---------|--------|
| Booking detail | **Notifications** section — per-booking history (limit 25) |
| Global health | **`/admin/notifications`** — 24h delivery analytics + template breakdown (5H-a), worker health + recent runs (5G), summary counts + filtered queue table (limit 100) |
| 24h analytics (5H-a) | Worker throughput, live vs dry-run rates, queue pressure badge, supported template matrix, unsupported pending backlog — see [Admin delivery analytics](#admin-delivery-analytics-stage-5h-a) |
| Access | Read-only; admin JWT `SELECT` on `notification_outbox` and `notification_worker_runs` |
| Hidden | Recipient emails, raw payload, raw worker `errors` in analytics/recent-runs UI, secrets |
| Unsupported pending | Enqueued templates not yet delivered by worker — **separate count and breakdown**, not a failure, **excluded from queue pressure score** |
| Cron from UI | **Not supported** — use scheduled cron or manual curl with `CRON_SECRET` |

Do **not** mark rows `sent` or `failed` manually in SQL from the dashboard.

### Admin requeue (Stage 5E-1a / 5E-1b-α / 5E-1b-β)

| Topic | Behavior |
|-------|----------|
| **Where** | Admin booking detail → **Notifications**, and global **`/admin/notifications`** → **Requeue** / **Requeue dry-run** on eligible rows only |
| **Eligible (failed)** | `status = failed` and deliverable template (`payment_confirmed`, `payment_failed`, `assignment_offer`) |
| **Eligible (dry-run sent, 5E-1b-β)** | `status = sent`, `last_error` starts with `dry_run_sent`, and same deliverable templates — for staging/testing only |
| **Blocked** | Live `sent` rows (no `dry_run_sent` prefix); `pending` / `processing`; unsupported templates; malformed payload |
| **What it does** | Service-role in-place update: `pending`, `attempts = 0`, `next_retry_at = now()`, `last_error = admin_requeued` |
| **What it does not do** | Send email in the request; trigger cron from UI; bypass worker delivery dedupe; resend live `sent` rows; bulk requeue |
| **Reason** | Required, 8–500 characters; stored in `admin_operational_audit`, not on outbox |
| **After requeue** | **Cron must run** — worker picks up the row on the next run. **Delivery dedupe still applies** (may mark `sent` without a second email). **Delivery mode** (`NOTIFICATION_EMAIL_PROVIDER`) determines whether the next processing is dry-run or Resend. |
| **Resend / force resend** | **Deferred** — not in 5E-1a / 5E-1b |

API: `POST /api/admin/notifications/:outboxId/requeue` with `{ "reason": "…" }`. Writes via `adminRequeueNotificationOutbox` only (not browser JWT `UPDATE`).

## Retention dry-run (Stage 5I-α)

**No deletion in this stage.** Eligibility counts only — for ops planning before destructive cleanup (5I-β+).

| Surface | Detail |
|---------|--------|
| Admin UI | **`/admin/notifications`** → **Retention dry-run** section (counts + protected rows) |
| Cron | `GET`/`POST /api/cron/cleanup-notification-retention` with `Authorization: Bearer $CRON_SECRET` |
| Response | `dryRun: true`, `deleted: 0`, eligible/protected counts per category |
| PII | Never returns `recipient`, `payload`, or worker `errors` |

### Eligible categories (future cleanup)

| Category | Default policy |
|----------|----------------|
| Live `sent` | `updated_at` older than **90 days** (not `dry_run_sent`) |
| Dry-run `sent` | `updated_at` older than **60 days** (`last_error` like `dry_run_sent%`) |
| Deliverable `failed` | `updated_at` older than **365 days** |
| Unsupported `pending` | `created_at` older than **180 days** (enqueue-only templates) |
| `notification_worker_runs` | `completed_at` older than **90 days** **only when** matching `notification_metrics_hourly` UTC bucket exists |
| `notification_metrics_hourly` | `bucket_start` older than **13 months** |

### Protected (never counted as eligible)

- Deliverable `pending` / `processing`
- Deliverable `failed` still within max retention window
- Outbox rows with successful `notification_requeue` audit in the last **30 days** (excluded from eligible sent/failed counts)

### Manual dry-run

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  "https://YOUR_PRODUCTION_DOMAIN/api/cron/cleanup-notification-retention"
```

**Soak (required before destructive cleanup):** Run the dry-run cron daily for **3–5 days**, compare counts, sign off — see [notification-retention-cleanup-cron.md](./notification-retention-cleanup-cron.md).

**Scheduling:** Supabase Cron job `notification-retention-dry-run-daily` (03:15 UTC) via migration `20260519103000_notification_retention_dry_run_cron.sql`.

Destructive purge remains **deferred** to Stage 5I-β+.

Design: [stage-5i-notification-retention-cleanup-design.md](../architecture/stage-5i-notification-retention-cleanup-design.md)

## Code locations

| Piece | Path |
|-------|------|
| Worker | `src/features/notifications/server/processNotificationOutbox.ts` |
| Admin mapper | `src/features/notifications/server/mapNotificationOutboxRowForAdmin.ts` |
| Global health read model | `src/features/notifications/server/notificationAdminReadModel.ts` |
| 24h analytics aggregates | `src/features/notifications/server/notificationAnalyticsAggregates.ts` |
| Hourly rollup + 7d trends | `rollupNotificationMetricsHourly.ts`, `notificationTrends7d.ts` |
| Rollup cron | `src/app/api/cron/rollup-notification-metrics/route.ts` |
| Backfill CLI | `npm run ops:backfill:notification-metrics` → `scripts/ops/backfill-notification-metrics-hourly.mjs` |
| Booking history query | `src/features/notifications/server/listNotificationsForBooking.ts` |
| Cron route | `src/app/api/cron/process-notification-outbox/route.ts` |
| Templates | `paymentConfirmed.ts`, `paymentFailed.ts`, `assignmentOffer.ts` |
| Failure context | `loadPaymentFailedNotificationContext.ts` |
| Offer context | `loadAssignmentOfferNotificationContext.ts` |
| Dedupe helpers | `hasSentPaymentFailedForBooking.ts`, `hasSentAssignmentOfferForOffer.ts` |
| Admin requeue (5E-1a) | `adminRequeueNotificationOutbox.ts`, `POST …/api/admin/notifications/[outboxId]/requeue` |
| Retention dry-run (5I-α) | `reportNotificationRetentionDryRun.ts`, `GET/POST …/api/cron/cleanup-notification-retention` |
| Retention soak runbook | [notification-retention-cleanup-cron.md](./notification-retention-cleanup-cron.md) |
| Recipient resolvers | `resolveCustomerEmail.ts`, `resolveCleanerEmail.ts` |

## Staging rollout checklist (`payment_failed`)

1. Confirm `payment_confirmed` emails are stable on staging.
2. Set `ENABLE_NOTIFICATION_DELIVERY=true`, Resend sandbox key, verified sender, correct `APP_BASE_URL`.
3. Use test customers with known emails only.
4. Trigger `MARK_PAYMENT_FAILED` (abandon checkout cron or test decline) and run cron manually.
5. Verify: one email per booking, correct subject for `checkout_expired` vs generic, booking detail link works.
6. Retry payment on same booking → confirm **no second** failure email (stale guard + dedupe).
7. Enable production only after soak; monitor `notification_outbox` counts by template/status.

## Staging rollout checklist (`assignment_offer`)

1. Confirm customer payment emails are stable on staging.
2. `ENABLE_NOTIFICATION_DELIVERY=true`, Resend sandbox, verified sender, correct `APP_BASE_URL`.
3. Use test cleaners with known auth emails only.
4. Trigger `OFFER_TO_CLEANER` (dispatch after payment or admin manual dispatch).
5. Run cron manually; verify one email per offer with subject “New Shalean cleaning job offer”.
6. Confirm CTA opens `/cleaner/offers` (not direct accept URL).
7. Accept offer in dashboard → re-run cron → **no second** email for same `offerId`.
8. Replace/cancel offer before worker runs → confirm pending row is drained without send.
9. Enable production after soak; monitor `assignment_offer` `sent` / `failed` counts.

## Staging verification checklist (5C-2b queue reachability)

Run after **5C-2a + 5C-2b** are deployed to staging:

1. Confirm `ENABLE_NOTIFICATION_DELIVERY=true`, Resend sandbox, `APP_BASE_URL` correct.
2. Note pending counts: unsupported (`booking_draft_created`, `payment_pending`) vs deliverable (`assignment_offer`, payment emails).
3. Trigger `OFFER_TO_CLEANER` for a test cleaner with a known email.
4. Run cron **without** reordering `created_at` on outbox rows.
5. Expect `scanned` ≥ 1 and the new `assignment_offer` row → `sent`.
6. Confirm unsupported rows remain `pending` after the run.
7. Re-run cron → no duplicate offer email for the same `offerId`.
8. Optional SQL — deliverable backlog only:

```sql
select payload->>'template' as template, channel, count(*)
from notification_outbox
where status = 'pending'
  and (
    (channel = 'email' and payload->>'template' in ('payment_confirmed', 'payment_failed'))
    or (channel = 'push' and payload->>'template' = 'assignment_offer')
  )
group by 1, 2;
```
