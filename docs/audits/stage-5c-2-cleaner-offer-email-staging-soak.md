# Stage 5C-2 Staging Soak — Cleaner assignment offer email delivery

**Date:** 2026-05-17  
**Environment:** `https://cleaning-service-software.vercel.app` (Vercel) + Supabase project `jdmumbvednevkrctkiwd`  
**Type:** Staging verification soak — no new product features in this pass  
**Related:** [stage-5c-2-cleaner-offer-email-final-audit.md](./stage-5c-2-cleaner-offer-email-final-audit.md), [stage-5c-2-cleaner-offer-notification-design.md](../architecture/stage-5c-2-cleaner-offer-notification-design.md)

---

## Executive summary

| Area | Result |
|------|--------|
| Backlog SQL | **Executed** — see §1 |
| Staging env (inferred) | **Partial** — `deliveryEnabled: true` on cron; full Vercel env list not verified (CLI auth required) |
| Staging cron | **Partial** — auth works; first run sent 1 row; **no `assignment_offer` row processed** |
| Cleaner offer email received | **Not verified** on staging |
| Resend dashboard | **Not verified** (no dashboard access in this pass) |
| Code/unit tests | **Pass** (46 tests, typecheck) |
| Production enable | **Not recommended yet** |

**Verdict:** Staging soak is **incomplete**. Cleaner offer emails are **not proven safe for production** until (1) **5C-2a is deployed to Vercel staging/production**, (2) **outbox queue head-of-line blocking** is addressed, and (3) a **successful end-to-end offer email** is observed (inbox + Resend + outbox `sent` for `assignment_offer`).

---

## 1. Backlog check (SQL)

Database: Supabase `jdmumbvednevkrctkiwd` (same project linked from local `.env.local`).

### 1.1 Pending `assignment_offer` summary

| Metric | Value |
|--------|-------|
| Pending count | **18** |
| Oldest | `2026-05-16 15:54:05+00` |
| Newest | `2026-05-17 06:49:31+00` |
| Age bucket | All **fresh** (&lt; 48h) |

### 1.2 Pending rows by linked offer status

| Offer status | Pending outbox rows |
|--------------|---------------------|
| `offered` | 8 |
| `accepted` | 3 |
| `declined` | 1 |
| *(offer row missing — deleted cleaner)* | 6 |

### 1.3 Rows that would send if processed today

| Metric | Value |
|--------|-------|
| Would send (open offer + `pending_assignment` + no `cleaner_id`) | **8** |

### 1.4 Recipients (cleaner emails)

| `recipient` (cleaners.id) | Pending rows | Auth email |
|---------------------------|--------------|------------|
| `bbfc422b-0d6b-4630-8540-bcc8d4147ade` | 12 | `test_e2e_cleaner@shalean.co.za` (E2E Test Cleaner) |
| `a4113e86-96c6-407c-a047-fb225ebeee1a` | 6 | **Cleaner deleted** — no profile/email |

**Customer targeting:** `assignment_offer` rows use `cleaners.id` only. **No customer recipients** in this backlog.

**Stale/terminal offers:** 4 rows (accepted/declined) + 6 orphan rows should **skip** per worker guards (no email). **8 rows** could send to the **single E2E test cleaner inbox** if reached by the worker.

### 1.5 Head-of-line blocking (critical)

| Metric | Value |
|--------|-------|
| Pending rows **before** first `assignment_offer` (by `created_at`) | **202** |
| Deliverable rows in **oldest 100** `pending` (any channel) | **0** |

Oldest pending templates are `booking_draft_created` and `payment_pending` (not delivered by worker). The worker loads `limit 100` pending rows ordered by `created_at`, then filters to deliverable templates. **Offer rows are never in the first 100 pending rows**, so **staging cron does not reach `assignment_offer` backlog** without queue drain or worker polling change.

Deliverable pending elsewhere in queue:

| Template | Channel | Pending count |
|----------|---------|---------------|
| `payment_confirmed` | email | 68 |
| `assignment_offer` | push | 18 |
| `payment_failed` | email | 4 |

---

## 2. Environment check (staging)

| Variable | Required | Verified |
|----------|----------|----------|
| `ENABLE_NOTIFICATION_DELIVERY=true` | Yes | **Inferred yes** — cron returned `deliveryEnabled: true` |
| `RESEND_API_KEY` | Yes | **Inferred yes** — delivery enabled requires provider |
| `NOTIFICATION_FROM_EMAIL` | Yes | **Inferred yes** — same gate |
| `APP_BASE_URL=https://cleaning-service-software.vercel.app` | Yes | **Not confirmed** via `vercel env ls` (CLI login required). Local `.env.local` uses `http://localhost:3000` — staging URL must be set in Vercel for correct CTA links |
| `CRON_SECRET` | Yes | **Yes** — cron accepted Bearer from project `.env.local` |

**Note:** Full Vercel environment inspection was not completed in this pass. Confirm `APP_BASE_URL` in Vercel dashboard before production.

---

## 3. Staging cron invocation

**Endpoint:** `GET https://cleaning-service-software.vercel.app/api/cron/process-notification-outbox`  
**Auth:** `Authorization: Bearer <CRON_SECRET>` (from project env, not documented here)

### Run 1 (initial)

```json
{
  "ok": true,
  "deliveryEnabled": true,
  "reclaimed": 0,
  "scanned": 1,
  "sent": 1,
  "skipped": 0,
  "failed": 0,
  "errors": []
}
```

**Interpretation:** Worker ran with delivery on. One row processed — latest `sent` rows in DB are `payment_confirmed` (email), not `assignment_offer`. **No `assignment_offer` row moved to `sent`.**

### Runs 2–6 (immediate follow-up)

```json
{ "scanned": 0, "sent": 0, ... }
```

**Interpretation:** No deliverable candidates in the first 100 pending rows (head-of-line blocking).

### Run 7 (soak: one `assignment_offer` row `created_at` set to `2020-01-01` to force queue priority)

```json
{ "scanned": 0, "sent": 0, ... }
```

**Interpretation:** Row `bc478d53-b9c3-4258-a430-5db8d7b5cc10` remained `pending`. **Strong signal that deployed staging build does not yet include 5C-2a** (pre-5C-2 worker only polls `channel = email`, so `push` + `assignment_offer` is never scanned). `created_at` was restored to original after test.

---

## 4. Verify results (checklist)

| # | Check | Staging soak result |
|---|--------|---------------------|
| 1 | Cron `ok: true`, `deliveryEnabled: true` | **Pass** |
| 2 | `assignment_offer` processed | **Fail** — 18 still `pending`, 0 `sent` |
| 3 | Cleaner offer email arrives | **Not verified** |
| 4 | CTA `/cleaner/offers` | **Not verified** (depends on deploy + send) |
| 5 | No customer PII in email | **Pass** (code + unit tests); **not verified** in live email |
| 6 | Earnings safe/omitted | **Pass** (code + unit tests) |
| 7 | Duplicate email per `offerId` | **Pass** (unit tests); **not verified** live |
| 8 | Resend dashboard delivered | **Not verified** |
| 9 | `payment_confirmed` / `payment_failed` still work | **Partial** — one `payment_confirmed` send on run 1; full regression not re-run |
| 10 | Unrelated push templates pending | **Pass** — no other `push` templates in outbox |

### Code-level verification (local, same DB)

| Command | Result |
|---------|--------|
| `npm run typecheck` | **Pass** |
| `npx vitest run src/features/notifications src/app/api/cron/process-notification-outbox` | **46/46 pass** |

---

## 5. Issues found

| ID | Severity | Issue |
|----|----------|--------|
| S1 | **Blocker** | **5C-2a likely not deployed** to `cleaning-service-software.vercel.app` — prioritized `assignment_offer` row still not scanned |
| S2 | **Blocker** | **Outbox head-of-line blocking** — 202 non-deliverable `pending` rows before first offer; worker only inspects oldest 100 `pending` |
| S3 | High | **8 live sends** would go to `test_e2e_cleaner@shalean.co.za` once queue + deploy fixed — confirm that inbox is acceptable for staging |
| S4 | Medium | **6 orphan rows** for deleted cleaner `a4113e86-…` — expect `failed` or skip, not customer email |
| S5 | Medium | **`APP_BASE_URL` on Vercel** not confirmed — risk wrong CTA host if still `localhost` |
| S6 | Low | **Accept/worker race** — documented in design; not exercised in soak |

---

## 6. Recommended actions before production

1. **Deploy** branch containing 5C-2a to Vercel staging; confirm build includes `isDeliverableOutboxRow` + `processAssignmentOfferRow`.
2. **Drain or defer** non-deliverable pending noise (ops SQL example below) **or** implement worker poll improvement (separate change — out of soak scope).
3. Re-run staging cron until at least one `assignment_offer` → `sent`.
4. Confirm email in `test_e2e_cleaner@shalean.co.za` (or designated staging cleaner): subject **“New Shalean cleaning job offer”**, link to `https://cleaning-service-software.vercel.app/cleaner/offers`, suburb/city only, no customer PII.
5. Re-run cron for same `offerId` — confirm **no second email** (dedupe).
6. Confirm Resend dashboard shows delivery.
7. Set **`APP_BASE_URL`** on Vercel to production URL before production enable.

### Optional ops SQL — defer non-deliverable backlog (staging only)

```sql
-- Review counts first; then optionally mark undelivered templates as failed to unblock queue
update notification_outbox
set
  status = 'failed',
  last_error = 'soak: template not delivered in 5C-2',
  updated_at = now()
where status = 'pending'
  and payload->>'template' in (
    'booking_draft_created',
    'payment_pending',
    'pending_assignment',
    'cleaner_assigned'
  );
```

Do **not** run on production without review.

---

## 7. Production enable recommendation

**Are cleaner assignment offer emails safe to enable in production?**

**No — not yet.**

| Gate | Status |
|------|--------|
| Code + unit tests | Ready |
| Staging deploy of 5C-2a | **Not confirmed** |
| Staging E2E offer email | **Not demonstrated** |
| Queue/backlog strategy | **Required** |
| `APP_BASE_URL` on Vercel | **Confirm** |
| Staging soak on real cleaner inboxes | **Only E2E test email identified** — acceptable for staging, not proof for all production cleaners |

**Conditional yes for staging enable** after: deploy 5C-2a + queue drain + one successful offer email + dedupe check.

**Production:** Enable only after staging soak passes and `assignment_offer` `sent`/`failed` metrics are monitored for 24–48h.

---

## 8. Rollback plan

| Step | Action |
|------|--------|
| 1 | Set `ENABLE_NOTIFICATION_DELIVERY=false` on Vercel (immediate no-op) |
| 2 | Unschedule or pause `pg_cron` / Vercel cron for `/api/cron/process-notification-outbox` |
| 3 | Leave `pending` rows in place — do not mass-mark `sent` in SQL |
| 4 | Redeploy previous build if needed (removes `assignment_offer` handler) |
| 5 | Communicate to ops: cleaners may still see offers in `/cleaner/offers` dashboard without email |

No data migration rollback required. Offer enqueue (`OFFER_TO_CLEANER`) is unchanged.

---

## 9. Final soak sign-off

| Role | Status |
|------|--------|
| Backlog analysis | **Complete** |
| Staging cron | **Partial** |
| Live cleaner offer email | **Not verified** |
| Production ready | **No** |

**Next step:** Deploy 5C-2a to staging → drain non-deliverable pending → re-run this soak checklist → update this doc with email/Resend evidence.
