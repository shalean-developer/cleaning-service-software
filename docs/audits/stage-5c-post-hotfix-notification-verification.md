# Stage 5C Post-Hotfix Verification — Notification Delivery

**Date:** 2026-05-17  
**Type:** Verification only (no feature changes)  
**Hotfix commit:** `a82c6a8` — *Hotfix notification payment confirmed send dedupe*  
**Hosted app:** https://cleaning-service-software.vercel.app  
**Database:** Supabase `jdmumbvednevkrctkiwd` (shalean-software)

---

## Executive summary

| Check | Verdict |
|-------|---------|
| Hotfix deployed on hosted worker | **Pass** (live dedupe probe) |
| `ENABLE_NOTIFICATION_DELIVERY` + provider on hosted | **Pass** (`deliveryEnabled: true`) |
| `CRON_SECRET` on hosted | **Pass** (cron authorized) |
| `payment_confirmed` dedupe (no second Resend send) | **Pass** |
| `payment_failed` dedupe | **Pass** |
| `assignment_offer` dedupe | **Pass** |
| `assignment_offer` delivery to cleaner | **Pass** (historical + Resend) |
| `payment_failed` delivery | **Pass** (historical + Resend) |
| Unsupported templates stay `pending` | **Pass** |
| `APP_BASE_URL` on hosted | **Fail / unverified** — emails from 08:26 UTC use `localhost` links |
| Resend dashboard alignment | **Pass** for subjects/recipients; link base URL concern above |

**Recommendation on `ENABLE_NOTIFICATION_DELIVERY=true`:** **Yes, keep enabled** for delivery stability (dedupe, cron, Resend). **Immediately set `APP_BASE_URL=https://cleaning-service-software.vercel.app` on Vercel** (and remove localhost defaults from production) so new emails use correct CTAs.

---

## 1. Deployment — latest commit on Vercel

| Signal | Result |
|--------|--------|
| Local `HEAD` | `a82c6a8fd018287778eb1449d58a843bc91bf0e4` |
| `origin` `HEAD` | `a82c6a8fd018287778eb1449d58a843bc91bf0e4` (matches) |
| GitHub commit time | 2026-05-17T09:06:32Z |
| Vercel CLI / dashboard | Not queried (CLI auth unavailable in verification session) |

**Indirect proof (strong):** Hosted cron at 2026-05-17 ~15:50 UTC processed three duplicate probe rows with **`sent: 0`, `skipped: 3`**. Pre-hotfix code would have sent a third `payment_confirmed` email to `customer@shalean.co.za`; Resend shows no new notification-template emails after 08:28 UTC.

**Conclusion:** Hosted worker behavior matches hotfix `a82c6a8` (payment_confirmed dedupe + existing payment_failed / assignment_offer dedupe).

---

## 2. Environment (hosted)

| Variable | Required | Verification |
|----------|----------|--------------|
| `ENABLE_NOTIFICATION_DELIVERY` | `true` | Cron JSON: `"deliveryEnabled": true` |
| `RESEND_API_KEY` | set | Resend API list succeeded; historical sends `delivered` |
| `NOTIFICATION_FROM_EMAIL` | set | Resend `from`: `noreply@shalean.co.za` |
| `APP_BASE_URL` | `https://cleaning-service-software.vercel.app` | **Not confirmed on Vercel.** Resend HTML for emails `4600ea69-…`, `1ec81b6f-…`, `d040d07d-…` (08:26–08:28 UTC batch) contains **`http://localhost:3000`** links, not the Vercel hostname. |
| `CRON_SECRET` | set | `GET /api/cron/process-notification-outbox` with Bearer token → `ok: true` |

Local `.env.local` (not production): `ENABLE_NOTIFICATION_DELIVERY=true`, `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` set, `APP_BASE_URL=http://localhost:3000` — expected for local dev only.

---

## 3. Hosted cron invocation

```powershell
Invoke-RestMethod `
  -Uri "https://cleaning-service-software.vercel.app/api/cron/process-notification-outbox" `
  -Method Get `
  -Headers @{ Authorization = "Bearer <CRON_SECRET>" }
```

### Run A — empty deliverable queue

```json
{
  "ok": true,
  "deliveryEnabled": true,
  "reclaimed": 0,
  "scanned": 0,
  "sent": 0,
  "skipped": 0,
  "failed": 0,
  "errors": []
}
```

### Run B — post-hotfix dedupe probes (three inserted rows)

Probe IDs (verification-only inserts, now drained):

| id | template | purpose |
|----|----------|---------|
| `11111111-1111-4111-8111-111111110001` | `payment_confirmed` | Duplicate for booking `450d59e5-…` (already 2× `sent`) |
| `11111111-1111-4111-8111-111111110002` | `assignment_offer` | Duplicate for offer `4336973d-…` (already `sent`) |
| `11111111-1111-4111-8111-111111110003` | `payment_failed` | Duplicate for booking `f6d1a40e-…` (already `sent`) |

```json
{
  "ok": true,
  "deliveryEnabled": true,
  "reclaimed": 0,
  "scanned": 3,
  "sent": 0,
  "skipped": 3,
  "failed": 0,
  "errors": []
}
```

All three probe rows: `status = sent`, `attempts = 1`, `last_error = null`, `updated_at ≈ 2026-05-17T15:50:09Z`.

---

## 4. Verification matrix

### 4.1 No duplicate `payment_confirmed` email (same `bookingId`)

| Item | Result |
|------|--------|
| Historical duplicate (pre-hotfix) | Booking `450d59e5-0476-41d6-afbe-26b8c2e00ebe` has **2** `sent` rows; Resend shows **2** delivered to `customer@shalean.co.za` at 08:26 and 08:28 UTC (expected before hotfix) |
| Post-hotfix probe | Third pending row → **skipped**, **no** new Resend `Payment confirmed` after 08:28 UTC |
| Globally duplicate bookings | Only this booking has >1 `payment_confirmed` row |

**Pass** for hotfix behavior. Customer already received duplicate before deploy; dedupe prevents recurrence.

### 4.2 Duplicate `payment_confirmed` rows skipped without Resend

Worker path: `hasSentPaymentConfirmedForBooking` → `markOutboxSent` → `outcome: skipped` (no `emailSender` call).

**Pass** (live probe + unit tests `does not resend when payment_confirmed already sent for booking`, `sends first payment_confirmed and skips duplicate in same batch`).

### 4.3 `payment_failed` still sends correctly

| Item | Result |
|------|--------|
| Outbox | 4× `sent` / `email` |
| Resend | Subjects e.g. `Your Shalean payment link expired` — `delivered` / `suppressed` per recipient |
| Dedupe probe | Duplicate row **skipped**, no new Resend entry |

**Pass** for delivery + dedupe. No fresh `payment_failed` send in this session (no pending first-time rows).

### 4.4 `assignment_offer` email to cleaner

| Item | Result |
|------|--------|
| Outbox | 14× `sent` (`channel: push`), 6× `failed` |
| Resend | `New Shalean cleaning job offer` → `test_e2e_cleaner@shalean.co.za` — `delivered` (multiple at 08:26–08:27 UTC) |
| Open offers | All open `offered` rows already have an outbox row; no greenfield send test without new enqueue |

**Pass** on historical delivery. Live **send** not re-run (no pending first-time offer rows).

### 4.5 `assignment_offer` duplicate suppressed

Duplicate probe for offer `4336973d-3aa9-4e6a-b9e1-e3f300a32e06` → **skipped**, no new Resend offer email.

**Pass**.

### 4.6 Unsupported templates remain `pending`

| template | status | channel | count |
|----------|--------|---------|------:|
| `booking_draft_created` | pending | email | 167 |
| `payment_pending` | pending | email | 111 |
| `pending_assignment` | pending | email | 14 |
| `cleaner_assigned` | pending | email | 3 |

**295** total unsupported `pending` rows. Deliverable `pending` queue after probes: **0**.

Cron `scanned: 0` with large unsupported backlog confirms **no head-of-line blocking**.

**Pass**.

### 4.7 Resend dashboard vs outbox

Notification-worker emails use `from: noreply@shalean.co.za` and subjects:

- `Payment confirmed - your Shalean booking is received`
- `Your Shalean payment link expired` / payment-failed variants
- `New Shalean cleaning job offer`

Counts and recipients align with outbox `sent` rows from the 08:26 UTC drain batch. Post-probe: **no** new rows for those subjects.

**Pass** with **APP_BASE_URL** caveat (links point to localhost in sampled HTML).

---

## 5. Automated tests (local)

```
npm test -- --run \
  src/features/notifications/server/processNotificationOutbox.test.ts \
  src/features/notifications/server/hasSentPaymentConfirmedForBooking.test.ts
```

**27/27 passed.**

---

## 6. Known residual risks

1. **Pre-hotfix duplicate emails** — Cannot be unsent; dedupe only prevents future duplicates.
2. **`APP_BASE_URL` on production** — Sampled emails use `http://localhost:3000` in CTAs. Fix Vercel env before relying on email links in production.
3. **`assignment_offer` failed rows (6)** — Investigate separately (`NO_EMAIL`, stale offer, etc.); not introduced by hotfix.
4. **Unsupported backlog (295 pending)** — Expected; will not send until future stages.

---

## 7. Final answer

**Is notification delivery stable enough to keep `ENABLE_NOTIFICATION_DELIVERY=true`?**

**Yes.** Hosted delivery is operational: cron auth works, Resend sends, dedupe for `payment_confirmed`, `payment_failed`, and `assignment_offer` is proven on production worker after hotfix `a82c6a8`.

**Condition:** Set **`APP_BASE_URL=https://cleaning-service-software.vercel.app`** on Vercel (verify with one controlled send and inspect email HTML). Until then, emails deliver but booking/offer links may be wrong.

---

## References

- [stage-5c-notification-duplicate-cleaner-delivery-hotfix-audit.md](./stage-5c-notification-duplicate-cleaner-delivery-hotfix-audit.md)
- [notification-outbox-worker.md](../operations/notification-outbox-worker.md)
- `src/features/notifications/server/hasSentPaymentConfirmedForBooking.ts`
- `src/features/notifications/server/processNotificationOutbox.ts`
