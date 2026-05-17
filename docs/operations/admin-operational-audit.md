# Admin operational audit

Durable, **admin-only** audit log for human operational actions on bookings. Introduced in **Stage 5B-1a**.

Related:

- [Admin operational dashboard](./admin-operational-dashboard.md)
- [Architecture design](../architecture/stage-5b-1-durable-admin-operational-audit-design.md)

---

## What is recorded

Each row in `admin_operational_audit` captures one admin API attempt for:

| Action | API |
|--------|-----|
| `assignment_recovery` | `POST /api/admin/bookings/[bookingId]/recover-assignment` |
| `manual_dispatch_offer` | `POST /api/admin/bookings/[bookingId]/dispatch-offer` |
| `replace_open_offer` | `POST /api/admin/bookings/[bookingId]/replace-open-offer` |

Per row (when applicable):

- Admin profile id (and name on booking detail UI)
- Booking id
- **Reason** (required in API, 8–500 characters)
- **Outcome:** `success`, `idempotent`, `rejected`, or `failed`
- Result code (e.g. `NOT_ELIGIBLE`, `OPEN_OFFER_EXISTS`)
- Cleaner / offer / cancelled-offer UUIDs
- Booking status before and after (snapshot)
- Idempotency key (success/idempotent only)
- Small allowlisted **metadata** (engine outcome, attempt counts, etc.)

Stdout `console.warn` JSON logs are **still emitted** for log pipelines (Datadog/Vercel).

---

## What is intentionally not recorded

- Paystack / webhook raw payloads or secrets
- Full request bodies
- Customer-visible lifecycle transitions (see `booking_state_audit`)
- Payout-ready / paid-out button clicks (lifecycle audit only today)
- Cron batch recovery (no admin profile)
- `ADMIN_OVERRIDE_STATUS` (not exposed)

---

## Who can read it

| Role | Access |
|------|--------|
| **Admin** | `SELECT` all rows (RLS `auth_is_admin()`) |
| Customer | **No access** |
| Cleaner | **No access** |
| Authenticated insert/update/delete | **Denied** (writes via service role in app only) |

---

## Where to view it

**Admin booking detail** → section **“Admin operations”** (separate from **“State audit”**).

State audit remains the lifecycle command log (may be visible to customers/cleaners for their bookings via RLS). Admin operations are internal.

---

## How it helps investigations

- Answer **who** ran recovery/dispatch/replace and **why**
- See **rejected** attempts (not only successes)
- Correlate with offer/cleaner IDs and booking status snapshots
- Match idempotency keys to command-layer keys (`admin:dispatch:…`, `assignment:offer:…`)

---

## Known limitations

- **No backfill** for actions that only existed in console logs before deploy
- Audit insert is **best-effort** — if persistence fails, the admin action still completes and a warning is logged
- No global admin audit search page yet (per-booking only)
- No maker/checker or payout reason field in this slice

---

## Database

Migration: `supabase/migrations/20260518120000_admin_operational_audit.sql`

- Append-only trigger (no `UPDATE` / `DELETE`)
- Partial unique index on `(booking_id, idempotency_key)` for `success` / `idempotent` outcomes only
