# Stage 5D — Notification Observability Final Audit

**Date:** 2026-05-17  
**Type:** Audit only — no code changes  
**Scope:** Stage 5D-1 (booking detail history) + Stage 5D-2a (global `/admin/notifications` health page)  
**Related:** [stage-5d-notification-admin-observability-design.md](../architecture/stage-5d-notification-admin-observability-design.md), [stage-5d-2-global-notification-health-page-design.md](../architecture/stage-5d-2-global-notification-health-page-design.md), [notification-outbox-worker.md](../operations/notification-outbox-worker.md), [admin-operational-dashboard.md](../operations/admin-operational-dashboard.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Booking detail notification history (5D-1) | **Pass** |
| Global notification health page (5D-2a) | **Pass** |
| Read-only / no mutation from UI | **Pass** |
| PII / payload safety | **Pass** |
| Deliverable vs unsupported classification | **Pass** (with known count gap) |
| Tests & typecheck | **Pass** |
| Docs | **Pass** |

**Overall:** Stage **5D observability is complete** for its stated scope. It is **safe enough to begin Stage 5E retry/resend design** (design only first — not implementation without a separate audited spec).

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Booking detail notification history works | **Pass** | `getAdminBookingDetail` calls `listNotificationsForBooking`; booking page renders `AdminBookingNotificationsSection` with read-only copy |
| 2 | Global `/admin/notifications` works | **Pass** | Route `src/app/(admin)/admin/notifications/page.tsx`; `getAdminNotificationHealthPage`; nav via `ADMIN_DASHBOARD_NAV` |
| 3 | Summary cards classify deliverable vs unsupported | **Pass** | Deliverable counts use `buildDeliverableOutboxTemplateOrFilter()`; unsupported uses separate `UNSUPPORTED_PENDING_TEMPLATES` + dedicated card copy |
| 4 | Failed rows visible | **Pass** | Default filters: `pending,processing,failed` + deliverable; **Failed** card; failed preset filter |
| 5 | Unsupported pending not treated as failures | **Pass** | Separate card (“Not delivered yet — not a failure”); excluded from default needs-attention deliverable table |
| 6 | Dry-run rows visible | **Pass** | `isDryRun` + `(dry run)` in table; **Dry-run rows** summary card; `dry_run_sent` parsed in mapper |
| 7 | Delivery banner safe | **Pass** | Shows only `deliveryEnabled`, `emailProvider`, `appBaseUrl`, stale minutes, localhost warning — no API keys/secrets |
| 8 | Recipient emails hidden | **Pass** | No email resolver in read model; DTO has no `recipient` / email fields; tests assert no `@` in serialized output |
| 9 | Raw payloads hidden | **Pass** | Mapper allowlists `template`, `bookingId`, `offerId` only; DTO has no `payload` key; tests assert no raw payload in JSON |
| 10 | `last_error` sanitized | **Pass** | `sanitizeNotificationLastError()` redacts `@` and caps 500 chars; exposed as `lastError` / `statusNote` only |
| 11 | No retry/resend buttons | **Pass** | No Resend/Retry actions; only filter **Apply** button on global page (GET form) |
| 12 | No cron trigger in UI | **Pass** | Banner references cron in prose only; no fetch to `/api/cron/process-notification-outbox` |
| 13 | No mutation route added | **Pass** | No `src/app/api/admin/.../notification*` routes; admin read paths use `SELECT` only |
| 14 | Docs explain read-only policy | **Pass** | `admin-operational-dashboard.md` §5D-1/5D-2a; `notification-outbox-worker.md` §Admin observability |
| 15 | Tests pass | **Pass** | See [Test results](#test-results) |

---

## Implementation map

| Capability | Primary files |
|------------|----------------|
| Safe mapper | `mapNotificationOutboxRowForAdmin.ts`, `notificationOutboxDeliverability.ts` |
| Booking history | `listNotificationsForBooking.ts`, `adminOperationsReadModel.ts` |
| Global health | `notificationAdminReadModel.ts`, `notificationAdminAggregates.ts` |
| UI | `AdminNotificationOutboxTable.tsx`, `AdminNotificationHealthCards.tsx`, `AdminNotificationDeliveryBanner.tsx`, `AdminNotificationFilters.tsx` |
| Routes | `/admin/bookings/[bookingId]`, `/admin/notifications` |

---

## Security & privacy review

### What is exposed (intentional)

- Outbox `id`, `template`, `status`, `channel`, `attempts`, timestamps, `next_retry_at`
- Sanitized `last_error` / dry-run metadata
- `bookingId` / `offerId` (short ids in UI; full id in link tooltip)
- `recipientType` (`customer` | `cleaner` | `unknown`) — not email
- Environment: delivery flag, provider mode, public `APP_BASE_URL`

### What is not exposed

- Auth email addresses (no `resolveCustomerEmail` / `resolveCleanerEmail` in admin observability paths)
- Raw `payload` JSON
- `RESEND_API_KEY`, `CRON_SECRET`, `NOTIFICATION_FROM_EMAIL` value in banner (provider readiness mentioned in prose only)
- Email bodies / provider message IDs

### Server-side note

Read queries `SELECT` include `recipient` and `payload` columns for mapping, but the **admin DTO never includes them**. This is acceptable if the API/page layer only serializes the mapped DTO (current behavior).

### RLS (unchanged — residual risk)

`notification_outbox_admin` remains **`FOR ALL`** for authenticated admins. The UI and read model are select-only, but a admin with direct Supabase client access could still mutate rows. **5D did not tighten RLS** (by design). Stage 5E should use **service-role + audited API** for any writes, not browser JWT updates.

---

## Classification logic review

### Deliverable (worker-aligned)

| Template | Channel |
|----------|---------|
| `payment_confirmed` | `email` |
| `payment_failed` | `email` |
| `assignment_offer` | `push` (+ `bookingId` + `offerId` in payload) |

Implemented in `isDeliverableNotificationRow()` and SQL filter `buildDeliverableOutboxTemplateOrFilter()`.

### Unsupported pending (separate card)

Counted via `pending` + `payload->>template` in:

`booking_draft_created`, `payment_pending`, `pending_assignment`, `cleaner_assigned`

**Known gap:** Pending rows with **unknown** template strings are not included in the unsupported card (only the four known templates). They also do not appear in default deliverable needs-attention view. Ops can use `deliverable=all` + `status=pending` to inspect. Acceptable for 5D; document in 5E if needed.

### Default global table (needs attention)

- `deliverable=true`
- `status ∈ { pending, processing, failed }`
- Newest first, limit **100**
- Post-map filter ensures `isDeliverable === true`

Failed deliverable rows **do** appear (verified in `notificationAdminReadModel.test.ts`).

---

## UI behavior summary

### Booking detail (`/admin/bookings/:id`)

- Section **Notifications** after Admin operations
- Up to **25** rows per booking
- Compact table (no booking link column — same booking context)
- Empty state: “No notification records for this booking yet.”

### Global health (`/admin/notifications`)

- Delivery configuration banner
- Eight summary cards + oldest actionable pending age
- Filter presets + GET form (`status`, `deliverable`, `template`)
- Table with booking links
- Footer: 100-row cap notice

### Buttons

| Control | Purpose | Retry/resend? |
|---------|---------|----------------|
| Filter **Apply** | GET query submit | No |
| Preset links | Navigation filters | No |
| Booking links | Drill-down | No |

---

## Test results

Commands run during audit:

```bash
npm run typecheck
npx vitest run src/features/notifications/server/notificationAdminAggregates.test.ts \
  src/features/notifications/server/notificationAdminReadModel.test.ts \
  src/features/notifications/server/mapNotificationOutboxRowForAdmin.test.ts \
  src/components/dashboard/AdminNotificationOutboxTable.test.tsx \
  src/components/dashboard/AdminBookingNotificationsSection.test.tsx
npx vitest run src/features/dashboards/server/dashboardReadModels.test.ts -t "notification|operational audit"
```

| Suite | Result |
|-------|--------|
| `tsc --noEmit` | **Pass** |
| Notification unit/UI tests | **24 passed** |
| Booking detail read model (notifications) | **2 passed** (within dashboardReadModels) |

Coverage highlights:

- Unsupported vs failed classification (`notificationAdminAggregates.test.ts`)
- Failed rows in needs-attention list; unsupported filter excludes failed (`notificationAdminReadModel.test.ts`)
- Email redaction, no payload in JSON (`mapNotificationOutboxRowForAdmin.test.ts`, `dashboardReadModels.test.ts`)
- No Resend/Retry/buttons in table HTML (`AdminNotificationOutboxTable.test.tsx`, `AdminBookingNotificationsSection.test.tsx`)

**Not run:** Full `npm test` suite (per instruction to avoid unrelated timeouts). No live browser/staging click-through in this audit session.

---

## Documentation review

| Document | 5D coverage |
|----------|-------------|
| `admin-operational-dashboard.md` | Routes table, 5D-1 booking section, 5D-2a global section, troubleshooting, read-only warnings |
| `notification-outbox-worker.md` | Admin observability table, code paths, no cron from UI, no manual SQL status hacks |

Design docs (`stage-5d-*.md`) match implementation for Slice A scope. Deferred items (cursor pagination, home chip, cron last-run persistence, `recipientLabel` joins) correctly **not** implemented.

---

## Gaps & residual risks (not blockers for 5D sign-off)

| Risk | Severity | Notes |
|------|----------|-------|
| RLS `FOR ALL` on outbox | Medium (ops discipline) | UI read-only; 5E writes must not use browser JWT |
| Unsupported count incomplete | Low | Unknown-template pending omitted from unsupported card |
| 100-row global cap | Low | Documented; filters + SQL for more |
| `recipient` selected server-side | Low | Stripped before response; keep mapper as single gate |
| No persisted cron health | Low | By design in 5D-2a; banner is config-only |
| Manual staging verification | Low | Recommend ops smoke on staging after deploy |

---

## Stage 5D scope completeness

| Planned (5D) | Shipped |
|--------------|---------|
| 5D-1 Booking notification history | Yes |
| 5D-2a Global page + cards + banner + filters + table | Yes |
| 5D-2b Full filter matrix / home chip / cursor pagination | No (deferred) |
| Retry/resend | No (deferred to 5E) |
| RLS tightening | No (deferred) |
| `notification_worker_runs` | No (deferred) |

**Conclusion:** In-scope 5D deliverables are **complete**.

---

## Final question: Is Stage 5D complete and safe enough to move to Stage 5E retry/resend design?

**Yes.**

1. **Complete** — Both observability surfaces (per-booking and global) are implemented, tested, and documented. Read-only constraints are met.
2. **Safe** — No email/payload leakage in DTOs; no mutation UI or admin API; sanitization is tested; delivery banner exposes only safe config signals.
3. **Ready for 5E design** — Ops can diagnose failed/pending/dry-run/unsupported rows before adding requeue/resend. Stage 5E should be **design-first** and must address:
   - Service-role (or audited server) writes only — not admin JWT `UPDATE`
   - `admin_operational_audit` (or equivalent) for human requeue actions
   - Idempotency / dedupe interaction with existing worker
   - No blind “mark sent” from UI

**Do not implement 5E retry/resend without a written Stage 5E design and security review** — observability does not remove the need for careful write-path design.

---

## Sign-off table

| Stakeholder action | Recommendation |
|--------------------|----------------|
| Product / ops | Use `/admin/notifications` for queue health; booking detail for per-incident history |
| Engineering | Proceed to **Stage 5E design** doc |
| Security | Track RLS `FOR ALL` until 5E+ hardening; enforce server-only writes for requeue |
