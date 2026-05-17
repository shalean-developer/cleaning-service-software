# Stage 5C Hotfix — Notification duplicate + cleaner delivery audit

**Date:** 2026-05-17  
**Type:** Audit + **5C hotfix implemented** (`hasSentPaymentConfirmedForBooking`, worker guard)  
**Database:** Supabase `jdmumbvednevkrctkiwd` (linked from local `.env.local`)  
**Safety:** `ENABLE_NOTIFICATION_DELIVERY=false` confirmed in `.env.local` before this audit. No cron invocations were run.

---

## Executive summary

| Issue | Root cause | Severity |
|-------|------------|----------|
| Duplicate `payment_confirmed` for booking `450d59e5-…` | **Two distinct outbox rows**, both `sent` — one legitimate enqueue, one **manual probe row** inserted during local verification; worker has **no per-booking delivery dedupe** | Medium — hotfix recommended |
| Cleaner `assignment_offer` “not arriving” | Worker **did send** (14/14 `sent` → `test_e2e_cleaner@shalean.co.za`); Resend shows **delivered** offer emails. Likely **wrong inbox**, **pre–5C-2b queue blocking on hosted**, or **no real cleaner recipients in backlog** | Low for code; ops/deploy/inbox |
| Admin emails | **Not implemented** — expected | N/A |

**Smallest safe hotfix:** Add `hasSentPaymentConfirmedForBooking` (mirror `hasSentPaymentFailedForBooking`) and skip second send. Deploy **5C-2a + 5C-2b** to staging/production for cleaner offers; verify inbox `E2E_TEST_CLEANER_EMAIL` (default `test_e2e_cleaner@shalean.co.za`). No assignment or enqueue changes required for the observed data.

---

## 1. Duplicate `payment_confirmed` (booking `450D59E5`)

### 1.1 SQL evidence — all outbox rows for booking

```sql
select id, status, channel, recipient, payload, attempts,
       created_at, updated_at, last_error
from notification_outbox
where payload->>'bookingId' = '450d59e5-0476-41d6-afbe-26b8c2e00ebe'
order by created_at;
```

| id | template | status | created_at | updated_at | notes |
|----|----------|--------|------------|------------|-------|
| `4b621279-…` | `booking_draft_created` | pending | 06:49:01 | 06:49:01 | not delivered |
| `901cf40a-…` | `payment_pending` | pending | 06:49:06 | 06:49:06 | not delivered |
| `a391a280-…` | **`payment_confirmed`** | **sent** | 06:49:25 | **08:26:07** | legitimate enqueue; drained in batch cron |
| `4a95b910-…` | `pending_assignment` | pending | 06:49:28 | 06:49:28 | not delivered |
| `bc478d53-…` | `assignment_offer` | sent | 06:49:31 | 08:26:07 | cleaner offer (push channel) |
| `3e4fa0a7-…` | **`payment_confirmed`** | **sent** | **08:27:58** | **08:28:03** | **second row — not from command enqueue** |

### 1.2 `payment_confirmed` rows only

```sql
select id, status, created_at, updated_at, recipient, payload
from notification_outbox
where payload->>'template' = 'payment_confirmed'
  and payload->>'bookingId' = '450d59e5-0476-41d6-afbe-26b8c2e00ebe'
order by created_at;
```

| id | status | created_at | updated_at |
|----|--------|------------|------------|
| `a391a280-e46f-4c01-8d98-f03b8615b60f` | sent | 2026-05-17T06:49:25Z | 2026-05-17T08:26:07Z |
| `3e4fa0a7-4e50-4cac-b253-0b09e3bb87cb` | sent | 2026-05-17T08:27:58Z | 2026-05-17T08:28:03Z |

**Findings:**

- **Two rows**, not one row processed twice (`attempts = 1` on each).
- **Globally**, only **one** booking has more than one `payment_confirmed` row (any status): `450d59e5-…`.
- **Globally**, only **one** booking has more than one **`sent`** `payment_confirmed`: same booking.

```sql
-- Bookings with multiple sent payment_confirmed (2026-05-17 audit)
select payload->>'bookingId' as booking_id, count(*) as sent_count
from notification_outbox
where status = 'sent'
  and payload->>'template' = 'payment_confirmed'
group by 1
having count(*) > 1;
-- Result: 1 row → 450d59e5-0476-41d6-afbe-26b8c2e00ebe, count = 2
```

### 1.3 Was the same row sent more than once?

No. Each row has `attempts = 1` and a single `updated_at` transition to `sent`. No `processing` reclaim loop evidence on these ids.

### 1.4 Delivery dedupe vs other templates

| Template | Delivery dedupe helper | Behavior |
|----------|------------------------|----------|
| `payment_failed` | `hasSentPaymentFailedForBooking` | Skip send; mark duplicate row `sent` |
| `assignment_offer` | `hasSentAssignmentOfferForOffer` | Skip send; mark duplicate row `sent` |
| **`payment_confirmed`** | **None** | Every eligible row triggers Resend |

`processPaymentConfirmedRow` sends on every claimed row with no prior-sent check:

```177:231:src/features/notifications/server/processNotificationOutbox.ts
async function processPaymentConfirmedRow(...) {
  // ... resolve email, load booking, send ...
  await markOutboxSent(client, row.id, row.attempts, now.toISOString());
  return { outcome: "sent" };
}
```

### 1.5 Command enqueue idempotency

Enqueue uses `shouldEnqueueNotificationForCommandResult(!idempotent)` — idempotent `FINALIZE_PAYMENT_SUCCESS` replays do **not** enqueue a second row (covered by `notificationEnqueueIdempotency.test.ts`).

For booking `450d59e5-…`, the **first** `payment_confirmed` row at 06:49:25 matches a normal post-finalize enqueue. The **second** row at 08:27:58 was created **~2 hours later** and aligns with a **manual probe insert** during local notification verification (not a failed idempotency gate).

**Conclusion:** Observed duplicate emails for this booking are **multiple outbox rows + missing delivery dedupe**, not command double-enqueue or single-row double-send.

### 1.6 Backlog drain contribution

Cron batch at ~08:26 processed many pending `payment_confirmed` rows (including `a391a280`). The probe row `3e4fa0a7` was inserted at 08:27:58 and sent on the next cron (~08:28) — producing the **second** Resend message to `customer@shalean.co.za`.

---

## 2. Cleaner `assignment_offer` not arriving

### 2.1 Outbox summary (2026-05-17 audit)

```sql
select status, count(*)
from notification_outbox
where payload->>'template' = 'assignment_offer'
group by status;
```

| status | count |
|--------|------:|
| sent | 14 |
| failed | 6 |
| pending | 0 |
| processing | 0 |

### 2.2 Channel, payload, recipient

- **Channel:** all `push` (email placeholder per 5C-2a).
- **Recipient:** all **14 sent** rows → `bbfc422b-0d6b-4630-8540-bcc8d4147ade` (E2E test cleaner).
- **No pending** `assignment_offer` rows remain — worker has drained deliverable offer backlog locally.

Example (booking `450d59e5-…`):

| field | value |
|-------|--------|
| outbox id | `bc478d53-b9c3-4258-a430-5db8d7b5cc10` |
| status | sent |
| channel | push |
| offerId | `4336973d-3aa9-4e6a-b9e1-e3f300a32e06` |
| bookingId | `450d59e5-0476-41d6-afbe-26b8c2e00ebe` |
| recipient | `bbfc422b-…` (E2E cleaner) |

### 2.3 Offer / booking guards (booking `450d59e5`)

```sql
select o.id, o.status, o.expires_at, o.cleaner_id,
       b.status as booking_status, b.cleaner_id as booking_cleaner_id
from assignment_offers o
join bookings b on b.id = o.booking_id
where o.id = '4336973d-3aa9-4e6a-b9e1-e3f300a32e06';
```

| check | value |
|-------|--------|
| offer.status | `offered` |
| offer.expires_at | 2026-05-19 (not expired at audit) |
| booking.status | `pending_assignment` |
| booking.cleaner_id | null |

Row was **eligible to send**; outbox shows **`sent`** — not skipped by stale guards.

### 2.4 Worker selection after 5C-2b

Template-scoped polling (5C-2b) is in repo: pending query filters to supported template/channel only. Local cron after 5C-2b processed offers (all 14 now `sent`; batch timestamp `08:26:07` on many rows).

**Hosted staging** may still lack 5C-2a/5C-2b — see [stage-5c-2-cleaner-offer-email-staging-soak.md](./stage-5c-2-cleaner-offer-email-staging-soak.md) (head-of-line blocking before 5C-2b).

### 2.5 Cleaner email resolver

`resolveCleanerEmail` maps `cleaners.id` → `profile_id` → `auth.users.email`.

| cleaners.id | profile_id | auth email |
|-------------|------------|------------|
| `bbfc422b-0d6b-4630-8540-bcc8d4147ade` | `06307bd9-e70f-49e7-8a6a-f0c13636b9e9` | `test_e2e_cleaner@shalean.co.za` |

Resolver is correct for E2E cleaner. **All 14 sent offers** map to this single inbox.

### 2.6 Failed rows (6) — not E2E cleaner

| last_error | recipient (cleaners.id) | cause |
|------------|-------------------------|--------|
| Offer not found. | `a4113e86-96c6-407c-a047-fb225ebeee1a` | **Cleaner row deleted**; offer/orphan outbox (see staging soak §1.2) |

These failures do **not** explain missing mail to E2E cleaner; they are orphan backlog on a removed cleaner.

### 2.7 Resend evidence (read-only API, no cron)

Last 50 Resend messages (audit time):

| inbox | count in sample | latest subject | last_event |
|-------|----------------:|----------------|------------|
| `test_e2e_cleaner@shalean.co.za` | 10 | New Shalean cleaning job offer | delivered |
| `customer@shalean.co.za` | 3 | Payment confirmed — your Shalean booking is received | delivered |

**Cleaner offer emails were sent and marked delivered by Resend** to `test_e2e_cleaner@shalean.co.za`.

### 2.8 Why operators report “not arriving”

| Hypothesis | Evidence |
|------------|----------|
| Wrong inbox monitored | All sends go to `test_e2e_cleaner@shalean.co.za`, not production cleaner personal mail |
| Hosted worker not on 5C-2a/5C-2b | Staging soak: `scanned: 0` for offers until deploy + queue fix |
| Expecting customer inbox | Offers correctly go to cleaner auth email only |
| Stale skip without send | Not applicable to `450d59e5` row (status `sent`) |
| Resend failure | No — `delivered` on recent offer messages |

---

## 3. Admin emails

| Check | Result |
|-------|--------|
| Worker supported templates | `payment_confirmed`, `payment_failed`, `assignment_offer` only |
| `notification_outbox` admin templates | **0** rows |
| Admin enqueue in commands | **Not present** for notifications |

**Expected:** Admin notification email is **not implemented** in Stage 5C. Absence is **not a bug**.

---

## 4. Recommended fix (smallest safe hotfix)

### 4.1 Stop duplicate customer `payment_confirmed` emails

**Implemented (worker only):**

1. `hasSentPaymentConfirmedForBooking.ts` — scans `status = sent`, `channel = email`, template + `bookingId` match.
2. `processPaymentConfirmedRow` — if already sent for booking → `markOutboxSent` without Resend (`skipped` in batch metrics).
3. Enqueue unchanged.

**Tests:**

- Second `payment_confirmed` row same booking → skipped, one Resend call.
- First row still sends.
- Regression: existing notification suite + new unit test file.

**Optional ops (not code):** Delete or mark failed the probe row `3e4fa0a7-…` if duplicate email already confused testers.

### 4.2 Cleaner offer delivery

**No worker logic change required** for observed data — delivery works to E2E cleaner inbox.

**Deploy / verify:**

1. Deploy **5C-2a + 5C-2b** together to Vercel (see [notification-outbox-worker.md](../operations/notification-outbox-worker.md)).
2. Confirm `ENABLE_NOTIFICATION_DELIVERY=true` and Resend env on target environment.
3. Monitor **`E2E_TEST_CLEANER_EMAIL`** (or override in `.env.local` before `e2e:seed`).
4. Run cron; confirm `assignment_offer` → `sent` without manual `created_at` hacks.
5. For production cleaners: ensure real `auth.users.email` on cleaner profiles before expecting non-E2E inboxes (current backlog was E2E-only).

**Do not change:** assignment commands, offer enqueue, RLS.

### 4.3 Admin

No action until a future stage defines admin templates.

---

## 5. Rollout / rollback

| Step | Action |
|------|--------|
| Pre-deploy | Keep `ENABLE_NOTIFICATION_DELIVERY=false` on staging until ready |
| Deploy | Ship hotfix dedupe + ensure 5C-2a/5C-2b on same deployment |
| Verify | One booking → at most one Resend `payment_confirmed`; one offer → one Resend to cleaner inbox |
| Rollback | Revert worker commit; dedupe is additive-safe — rollback restores duplicate risk only |

---

## 6. SQL reference pack

```sql
-- Duplicate payment_confirmed per booking (sent)
select payload->>'bookingId', count(*), array_agg(id order by created_at)
from notification_outbox
where status = 'sent' and payload->>'template' = 'payment_confirmed'
group by 1 having count(*) > 1;

-- assignment_offer status breakdown
select status, count(*) from notification_outbox
where payload->>'template' = 'assignment_offer' group by 1;

-- Sent offers → cleaner ids
select recipient, count(*) from notification_outbox
where status = 'sent' and payload->>'template' = 'assignment_offer'
group by 1;

-- Deliverable pending (5C-2b poll predicate)
select id, payload->>'template' as template, channel, created_at
from notification_outbox
where status = 'pending'
  and (next_retry_at is null or next_retry_at <= now())
  and (
    (channel = 'email' and payload->>'template' in ('payment_confirmed', 'payment_failed'))
    or (channel = 'push' and payload->>'template' = 'assignment_offer')
  )
order by created_at limit 25;
```

---

## Final answer

**Smallest safe hotfix:**

1. **Customer duplicates:** Add **per-booking `payment_confirmed` delivery dedupe** in the worker (`hasSentPaymentConfirmedForBooking` + skip send). This stops duplicate emails from multiple outbox rows without touching enqueue or payment logic. The `450D59E5` case was triggered by a **second outbox row** (including a manual probe insert) and **absent dedupe**, not broken finalize idempotency.

2. **Cleaner offers:** **No code hotfix required** for the current database state — offers **are** sending to `test_e2e_cleaner@shalean.co.za` per outbox and Resend. Fix **deployment and verification**: deploy **5C-2a + 5C-2b** on hosted, use the correct cleaner test inbox, and optionally point `E2E_TEST_CLEANER_EMAIL` at a real monitored mailbox via `e2e:seed`.

3. **Admin:** Document as **future work** — not a defect today.
