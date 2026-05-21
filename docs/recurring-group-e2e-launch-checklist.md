# Recurring schedule group — E2E launch checklist

Use this checklist in **staging** before enabling multi-day recurring schedules for real customers.

**Payment model:** each visit is paid individually via existing Paystack retry flow. No auto-charge, no subscription, no monthly invoicing.

**Automated helpers:**

```bash
npm run ops:e2e:recurring-group
npm run ops:e2e:recurring-group -- --group-id=<uuid>
npm run ops:audit:recurring-bookings
npm run ops:soak:recurring-bookings
npm run ops:audit:recurring-launch
```

---

## 1. Weekly multi-day group (Mon + Wed + Fri)

| Step | Expected |
|------|----------|
| Customer books weekly clean with **Mon, Wed, Fri** and one shared time | Checkout succeeds |
| First visit (anchor day) paid | Anchor booking `confirmed` (or paid path) |
| Group materialized | `recurring_schedule_groups` row; `selected_days` = [1,3,5] |
| Weekday series | 3 `booking_series` rows, one per weekday, same `group_id` |
| Synthetic anchors | Non-paid weekdays have `bookings.synthetic_anchor = true` |
| Generated children | `pending_payment` children for upcoming visits; `metadata.recurring.generated = true` |
| Cleaner visibility | **No** unpaid child visible to cleaners (`assigned` / `in_progress` without payment) |
| Ops check | `npm run ops:e2e:recurring-group` → no critical issues for this group |

---

## 2. Bi-weekly multi-day group (Tue + Sat)

| Step | Expected |
|------|----------|
| Customer books **bi-weekly** Tue + Sat | Group `frequency = biweekly` |
| Fortnight phase | Generated dates align across both weekdays (no drift between series) |
| No duplicate slots | Same `series_id` + `scheduled_start` appears once |
| Ops check | No `DUPLICATE_OCCURRENCE` for group series |

---

## 3. Customer view

| Step | Route / action | Expected |
|------|----------------|----------|
| List | `/customer/bookings/recurring` | Group card: service, days, “Pay to confirm” if unpaid |
| Group detail | `/customer/bookings/recurring/groups/[groupId]` | Summary, weekday panel, visits |
| Timeline | Group detail | **Synthetic anchors hidden** |
| Pay CTA | Unpaid child | “Pay next visit” / Pay to confirm; opens Paystack retry |
| Paid visit | Paid upcoming child | **No** pay button |
| Request — group | Pause / cancel / reschedule entire schedule | Creates `recurring_series_requests` with `scope=group`; **does not** mutate series |
| Request — weekday | Pause / cancel / reschedule one day | `scope=series`, `target_weekday` set |
| Weekday drill-down | Link to `/customer/bookings/recurring/[seriesId]` | Series detail still works |

Copy must say:

- “Each recurring visit is paid individually”
- “Pay to confirm this visit”
- “Cleaners are assigned after payment”
- “Request changes to your schedule”

Copy must **not** say: auto-charge, subscription, monthly invoice, automatically billed.

---

## 4. Admin view

| Step | Route / action | Expected |
|------|----------------|----------|
| List | `/admin/recurring` | Group card; open request count if any |
| Group detail | `/admin/recurring/groups/[groupId]` | Weekday series, timeline, requests |
| Requests | Support panel | Scope (full schedule / weekday), note, resolve |
| Resolve | Mark acknowledged / resolved | Status updates; no auto-execution on series |
| Pause group | Group actions | Group + series paused; audit on anchor |
| Resume group | Group actions | Resumes series; generation may run |
| Cancel group | Group actions | Group + series cancelled; completed visits remain |

---

## 5. Payment flow (unchanged product path)

| Step | Expected |
|------|----------|
| Customer pays unpaid child | `startPaymentRetryCheckout` → Paystack |
| Webhook / verify | Existing finalize path runs |
| After payment | Booking moves to paid path; dispatch deferred assignment runs |
| Before payment | **No** cleaner assignment / offers for unpaid child |
| Repeat finalize | No duplicate open offers on same booking |

---

## 6. Cleaner visibility

| Booking type | Cleaner job list |
|--------------|------------------|
| `pending_payment` generated child | Hidden |
| Paid / confirmed / assigned child | Visible per existing rules |
| `synthetic_anchor = true` | Hidden; no payment; no cleaner |

---

## 7. Audit / health

| Check | Target |
|-------|--------|
| `npm run ops:audit:recurring-bookings` | 0 issues (or only known warnings) |
| `npm run ops:soak:recurring-bookings` | PASS |
| `npm run ops:audit:recurring-launch` | Recurring group section not BLOCKED |
| `/admin/recurring/health` | Group-related alerts empty or explained |

---

## 8. Launch sign-off

- [ ] All scenarios 1–7 executed in staging
- [ ] `ops:e2e:recurring-group` → PASS or WARN (not FAIL)
- [ ] `ops:audit:recurring-launch` → READY or READY WITH WARNINGS
- [ ] Copy audit (`npm test` — `recurringCustomerCopy`) green
- [ ] No payment/finalize/dispatch code changes in this release
- [ ] Migrations applied: `20260606120000`, `20260608120000`

---

## Staging test data (manual)

There is **no** default seed script for groups (avoids accidental production writes). To test:

1. Use a staging customer email clearly marked as test (e.g. `+staging-recurring@…`).
2. Complete a real multi-day booking + payment in staging UI.
3. Run `npm run ops:e2e:recurring-group -- --group-id=<uuid>`.
4. Remove via existing mock customer cleanup if needed (`ops:audit:mock-customers` / `ops:delete:mock-customers`).

---

## Remaining limitations

- Reschedule requests store ISO datetime in metadata; admin applies manually.
- No batch pay for multiple unpaid children.
- No guaranteed same-cleaner language unless product supports it.
