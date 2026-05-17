# Stage 5C-2 Final Audit — Cleaner assignment offer email delivery

**Date:** 2026-05-17  
**Scope:** Stage 5C-2a — `assignment_offer` rows delivered as transactional email via existing notification worker (Resend, `ENABLE_NOTIFICATION_DELIVERY`).  
**Type:** Audit only — no new templates, no code changes in this pass.

**Related:** [stage-5c-2-cleaner-offer-notification-design.md](../architecture/stage-5c-2-cleaner-offer-notification-design.md), [notification-outbox-worker.md](../operations/notification-outbox-worker.md), [stage-5c-1-notification-rollout-final-audit.md](./stage-5c-1-notification-rollout-final-audit.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| `assignment_offer` processing + guards | **Pass** |
| Push-channel email conversion (scoped) | **Pass** |
| Unrelated push templates stay pending | **Pass** |
| Cleaner recipient resolution | **Pass** |
| Missing cleaner email → safe failure | **Pass** |
| Open offer + `pending_assignment` sends | **Pass** |
| Terminal/expired offers do not send | **Pass** (see test gap) |
| Assigned bookings do not send stale offers | **Pass** |
| Per-offer delivery dedupe | **Pass** |
| No customer PII in email | **Pass** |
| Suburb/city location only | **Pass** |
| Earnings safe or omitted | **Pass** |
| CTA `/cleaner/offers` only | **Pass** |
| `payment_confirmed` / `payment_failed` regression | **Pass** |
| Backlog risk documented | **Pass** |
| Staging backlog inspection (live DB) | **Not run** — no staging DB access in this pass |
| Automated tests | **Pass** (46 tests) |

**Final recommendation:** **Cleaner assignment offer email delivery is safe to enable in staging** when the checklist in §12 is followed (backlog query first, flag on, Resend sandbox, correct `APP_BASE_URL`, test cleaners only). **Production enable** should wait until staging soak confirms send/skip counts, no duplicate emails per `offerId`, and customer payment emails remain stable.

---

## Verification matrix (15 checks)

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | `assignment_offer` rows processed safely | **Pass** | `processAssignmentOfferRow` — claim → dedupe → load context → recipient match → status/expiry/booking guards → resolve email → send → `sent`/`failed`/`skipped` (`processNotificationOutbox.ts` L232–337) |
| 2 | Only `assignment_offer` push rows converted to email | **Pass** | `isDeliverableOutboxRow`: `assignment_offer` requires `channel === "push"` + `offerId` + `bookingId` (L73–84); customer templates require `channel === "email"` |
| 3 | Unrelated push rows stay pending | **Pass** | Any other `channel: push` template fails `isDeliverableOutboxRow` → never in batch; test `leaves unrelated push templates pending` |
| 4 | Cleaner email resolution works | **Pass** | `resolveCleanerEmail`: `cleaners.id` → `profile_id` → `auth.admin.getUserById` + `profiles.full_name`; tests in `resolveCleanerEmail.test.ts` |
| 5 | Missing cleaner email fails safely | **Pass** | `NO_EMAIL` / `CLEANER_NOT_FOUND` → `markOutboxFailure` non-retryable; `sanitizeErrorMessage` redacts `@`; tests `marks failed when cleaner has no email` + resolver tests |
| 6 | `offered` + `pending_assignment` sends | **Pass** | Guards require `offer.status === "offered"`, `booking.status === "pending_assignment"`, `booking.cleaner_id == null`; test `delivers assignment_offer push rows as email when offer is open` |
| 7 | Expired/cancelled/accepted/declined do not send | **Pass** | `status !== "offered"` → skip mark `sent` without send; `isOfferPastExpiry` → skip; tests: `cancelled`, `expired`. **Gap:** no dedicated unit tests for `accepted` / `declined` — same guard branch (L270–272) |
| 8 | Assigned bookings do not send stale offers | **Pass** | `booking.status !== "pending_assignment"` OR `cleaner_id != null` → skip; test `skips assignment_offer when booking is no longer pending_assignment` (assigned + `cleaner_id` set) |
| 9 | Duplicate offer emails suppressed | **Pass** | `hasSentAssignmentOfferForOffer(offerId)` before send; test `does not resend when assignment_offer already sent for offerId` |
| 10 | Email includes no customer PII | **Pass** | Template inputs: service, schedule, area, earnings, expiry, cleaner greeting only — no customer fields in `buildAssignmentOfferEmail` or loader; `assignmentOffer.test.ts` asserts no `customer@`, no `/accept`/`/decline` API paths |
| 11 | Email uses suburb/city only | **Pass** | `formatOfferLocationForEmail` uses `display.suburb` + `display.city` only — excludes `addressLine` (`loadAssignmentOfferNotificationContext.ts` L25–28); test `uses suburb/city only for location label` |
| 12 | Earnings estimate safe or omitted | **Pass** | `resolveOfferEarningsLabelForEmail` → `resolveCleanerEarningsDisplay` with `cleaner_id: null`; returns `null` when label is `EARNINGS_BEING_CALCULATED_LABEL`; template shows “Earnings: shown in your cleaner dashboard”; no `R 0` in tests |
| 13 | CTA points to `/cleaner/offers` only | **Pass** | `offersPageUrl: \`${appBaseUrl}/cleaner/offers\`` (L320); template link text “View offers”; no per-offer or accept URLs |
| 14 | `payment_confirmed` / `payment_failed` still work | **Pass** | Unchanged branches in `processOneRow`; email channel filter preserved; regression tests pass in `processNotificationOutbox.test.ts` |
| 15 | Backlog risk documented | **Pass** | [notification-outbox-worker.md](../operations/notification-outbox-worker.md) § `assignment_offer` + staging checklist; design doc § rollout |

---

## Code path reference

### Deliverability filter

```73:84:src/features/notifications/server/processNotificationOutbox.ts
function isDeliverableOutboxRow(row: NotificationOutboxRow): boolean {
  const template = readTemplate(row.payload);
  if (template === PAYMENT_CONFIRMED_TEMPLATE || template === PAYMENT_FAILED_TEMPLATE) {
    return row.channel === "email";
  }
  if (template === ASSIGNMENT_OFFER_TEMPLATE) {
    return (
      row.channel === "push" &&
      Boolean(readOfferId(row.payload) && readBookingId(row.payload))
    );
  }
  return false;
}
```

### Send guards (order)

1. Valid `bookingId` + `offerId` in payload  
2. No prior `sent` row for same `offerId`  
3. Offer exists; `offer.cleaner_id === row.recipient`  
4. `offer.status === "offered"`  
5. Not past `expires_at`  
6. `booking.status === "pending_assignment"`  
7. `booking.cleaner_id == null`  
8. Cleaner auth email resolvable  

### Enqueue unchanged

`OFFER_TO_CLEANER` still enqueues `channel: "push"` with `{ template: "assignment_offer", bookingId, offerId }` — no changes in `executeBookingCommand.ts` (L386–390).

---

## Automated verification

| Command | Result |
|---------|--------|
| `npm run typecheck` | **Pass** (exit 0) |
| `npx vitest run src/features/notifications src/app/api/cron/process-notification-outbox` | **Pass** — 12 files, **46 tests** |

### Test coverage map (assignment_offer)

| Concern | Test file / case |
|---------|------------------|
| Cleaner resolver | `resolveCleanerEmail.test.ts` |
| Per-offer dedupe | `hasSentAssignmentOfferForOffer.test.ts` |
| Suburb/city + earnings hydration | `loadAssignmentOfferNotificationContext.test.ts` |
| Template safety / CTA | `assignmentOffer.test.ts` |
| Happy path send | `delivers assignment_offer push rows as email when offer is open` |
| Cancelled / expired skip | `skips cancelled…`, `skips expired…` |
| Assigned booking skip | `skips assignment_offer when booking is no longer pending_assignment` |
| Dedupe skip | `does not resend when assignment_offer already sent for offerId` |
| Missing email | `marks failed when cleaner has no email` |
| Unrelated push pending | `leaves unrelated push templates pending` |
| Flag off no-op | `no-ops when delivery flag is off` |
| Payment regression | `marks sent on successful payment_confirmed…`, `payment_failed` tests |
| Cron auth | `route.test.ts` |

### Test gaps (non-blocking for staging)

| Gap | Risk | Mitigation |
|-----|------|------------|
| No explicit `declined` / `accepted` offer status tests | Low | Same `status !== "offered"` branch as `cancelled` |
| No live Resend send in CI | Low | Staging manual send with sandbox |
| `hasSentAssignmentOfferForOffer` scans all `sent` rows | Low at staging volume | Monitor; add indexed query later if needed |

---

## Staging backlog inspection

**Status: Not executed in this audit pass** — no staging database connection available to the auditor environment.

**Required ops step before first enable:**

```sql
-- Pending assignment_offer rows (historical backlog)
select
  count(*) as pending_count,
  min(created_at) as oldest,
  max(created_at) as newest
from notification_outbox
where status = 'pending'
  and channel = 'push'
  and payload->>'template' = 'assignment_offer';

-- By age bucket
select
  case
    when created_at < now() - interval '7 days' then 'older_than_7d'
    when created_at < now() - interval '48 hours' then '2d_to_7d'
    else 'fresh'
  end as age_bucket,
  count(*)
from notification_outbox
where status = 'pending'
  and channel = 'push'
  and payload->>'template' = 'assignment_offer'
group by 1;

-- How many would likely skip (offer no longer open)
select o.status, count(*)
from notification_outbox n
join assignment_offers o on o.id = (n.payload->>'offerId')::uuid
where n.status = 'pending'
  and n.payload->>'template' = 'assignment_offer'
group by 1;
```

**Backlog behavior when cron runs:**

| Row age / offer state | Expected worker outcome |
|-----------------------|-------------------------|
| Offer still `offered`, booking `pending_assignment` | **Email sent** (one per `offerId`) |
| Offer `cancelled` / `expired` / `declined` / `accepted` | **Skip** — marked `sent`, no email |
| Booking already assigned | **Skip** |
| Duplicate pending rows same `offerId` | First sends; rest deduped |

**Risk:** Large backlog → burst of emails to cleaners with **still-open** offers. Mitigation: run backlog SQL first; enable flag during low-traffic window; batch size 25 per cron tick.

---

## Safety comparison to pre-5C-2 audit

| Item | Stage 5C-1 audit (item 9) | After 5C-2a |
|------|---------------------------|-------------|
| `assignment_offer` | Stayed `pending` | **Delivered as email** when flag on |
| Worker query | `.eq("channel", "email")` only | All `pending` rows; filter in `isDeliverableOutboxRow` |
| Push channel | Ignored | **Only** `assignment_offer` push rows |

---

## Risks and mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Historical backlog email burst | Medium | Run § backlog SQL before enable; cron every 2–5 min caps at 25/run |
| Accept vs worker race | Low | Offer may email just before accept; cleaner sees stale offer in dashboard briefly |
| Cleaner without auth email | Low | Row → `failed`; ops can fix profile |
| Wrong `APP_BASE_URL` on staging | Medium | Verify env before enable |
| Resend sandbox vs production domain | Medium | Staging uses sandbox sender + test cleaner emails only |
| No withdraw email on admin replace | Low | Documented; pending row drained as skip |

---

## What was not changed (confirmed)

| Area | Status |
|------|--------|
| `OFFER_TO_CLEANER` enqueue | Unchanged |
| Assignment accept/decline routes | Unchanged |
| Earnings formulas | Unchanged |
| RLS | Unchanged |
| Real push (FCM/APNs) | Not implemented |
| Cancel/expire notification emails | Not implemented |

---

## Staging enable checklist

1. Confirm `payment_confirmed` / `payment_failed` stable on staging (5C-1 soak).
2. Run backlog SQL (§ Staging backlog inspection).
3. Set `ENABLE_NOTIFICATION_DELIVERY=true`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, correct `APP_BASE_URL`.
4. Use Resend sandbox; restrict to cleaners with known test emails.
5. Trigger one new `OFFER_TO_CLEANER` (dispatch) and run cron manually.
6. Verify email: subject “New Shalean cleaning job offer”, CTA `/cleaner/offers`, suburb/city only, no customer PII.
7. Accept offer in dashboard → re-run cron → **no second email** for same `offerId`.
8. Monitor: `select payload->>'template', status, count(*) from notification_outbox where payload->>'template' = 'assignment_offer' group by 1,2;`

---

## Final answer

**Is cleaner assignment offer email delivery safe to enable in staging?**

**Yes — with pre-enable backlog inspection and the staging checklist above.**

Conditions:

- Keep `ENABLE_NOTIFICATION_DELIVERY` **staging-only** until soak completes.
- Do **not** enable production until staging shows acceptable `sent` / `skipped` / `failed` ratios and no duplicate emails per `offerId`.
- Run the backlog SQL before the first cron with delivery enabled.
- Use test cleaner accounts with valid auth emails only.

**Not recommended yet:** Production enable without staging soak, or enabling while a very large backlog of open offers exists without ops awareness.
