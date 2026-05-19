# Assignment recovery after payment (Stage 3B-1)

Recovers **O1** bookings: paid, `confirmed`, but assignment dispatch never started (no `pending_assignment`, no open offers).

Payment success is never rolled back. Recovery calls existing `runAssignmentAfterPayment()`.

## Detection

`findAssignmentRecoveryCandidates()` / `isAssignmentRecoveryCandidate()` select bookings where:

| Check | Rule |
|-------|------|
| Booking status | `confirmed` |
| Payment | At least one `payments.status = paid` |
| Paid age | `payments.updated_at` older than grace (default **3 minutes**, `ASSIGNMENT_RECOVERY_GRACE_MINUTES`) |
| Cleaner | `bookings.cleaner_id` is null |
| Offers | No open `offered` row (not past `expires_at`); no `accepted` offer |

Terminal states (`cancelled`, `completed`, `assigned`, etc.) are excluded by status.

## Observability on finalize

After `FINALIZE_PAYMENT_SUCCESS`, `finalizePaidBooking` runs assignment. If assignment throws, returns `ok: false`, or the booking **remains `confirmed`**:

1. Structured log: `post_payment_assignment_failed` (JSON via `console.warn`)
2. Metadata: `metadata.assignment.status = attention_required` with reason **"Paid but dispatch not started; assignment recovery pending."**

Admin assignment queue shows badge **Paid — dispatch not started**.

## Recovery execution

### Preferred: cron route (manual or scheduled)

```
GET|POST /api/cron/recover-assignment-after-payment
Authorization: Bearer $CRON_SECRET
```

Calls `runAssignmentRecoveryBatch()`:

1. List candidates (batch size 50)
2. Re-check each candidate (skip if already recovered)
3. `runAssignmentAfterPayment(bookingId)` per candidate
4. Return JSON: `recoveredBookingIds`, `skippedBookingIds`, `failed`

Safe to rerun: idempotent move + offer creation; skips bookings with open offers or non-`confirmed` status.

### Ops script (dry-run default)

```bash
npm run ops:recover:assignments
CONFIRM_ASSIGNMENT_RECOVERY=yes npm run ops:recover:assignments
```

Uses service role + Vitest CLI wrapper (`scripts/recover-assignment-after-payment.mjs`).

### Admin single-booking recovery (Stage 4B-2a)

```
POST /api/admin/bookings/:bookingId/recover-assignment
```

- **Auth:** logged-in admin only (session cookie). No cron secret.
- **Body:** `{ "reason": "..." }` — required, 8–500 characters after trim.
- **Engine:** `recoverAssignmentForBooking` → `runAssignmentAfterPayment` (same as batch recovery).
- **UI:** Booking detail → Operational status panel → **Run assignment recovery** when eligibility is **eligible** (not during grace period).

| When to use | When not to use |
|-------------|-----------------|
| One booking stuck on **confirmed** after paid payment, past grace | `payment_failed` — customer must pay first |
| Dispatch-not-started badge, operational panel shows eligible | Inside grace window (~3 min after payment) |
| Faster than waiting for cron when ops is watching | `pending_assignment` + attention, selected decline, max attempts — needs manual dispatch (future) |
| | Booking already assigned or has open offer |

**Expected outcomes**

| Result | Meaning |
|--------|---------|
| `recovered` | Booking left `confirmed` (usually `pending_assignment` + offer or `attention_required`) |
| `already_recovered` | Booking already past confirmed — safe no-op |
| `NOT_ELIGIBLE` / `GRACE_PERIOD` | Pre-check failed — engine not run |
| `STILL_CONFIRMED` | Engine ran but status unchanged — investigate context |
| `ENGINE_ERROR` | Engine returned failure |

Structured log: `admin_assignment_recovery` (booking id, admin profile id, reason, result).

Batch recovery (cron/script) remains the right tool for many bookings at once.

## Operational guidance

1. **After payment incidents** — Check admin **Assignments** queue for "Paid — dispatch not started".
2. **Wait for grace** — Avoid recovering within 3 minutes of payment (normal finalize may still be running).
3. **Trigger recovery** — Cron POST or ops script with confirm flag.
4. **Verify** — Booking should move to `pending_assignment` with an `offered` row (or `attention_required` if no eligible cleaner).
5. **Do not** manually patch `bookings.status` — use commands / engine only.

## Safe rerun behavior

| Situation | Recovery behavior |
|-----------|-------------------|
| Already `pending_assignment` + open offer | Skipped (not a candidate) |
| Already `assigned` | Skipped |
| `attention_required` + still `confirmed` | Candidate → `runAssignmentAfterPayment` may still short-circuit if metadata blocks; ops may need manual review |
| Second recovery run after success | Skipped (not `confirmed`) |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `ASSIGNMENT_RECOVERY_GRACE_MINUTES` | `3` | Min age of paid payment before recovery |
| `CRON_SECRET` | — | Auth for recovery cron route |
| `CONFIRM_ASSIGNMENT_RECOVERY` | — | Set to `yes` for ops script apply mode |

## Known limitations

- Does not change decline/expiry redispatch policy (`attention_required` without offer still blocks engine retry).
- Batch cap 50 per run; large backlogs need repeated cron/script runs.
- **pg_cron:** migration `20260619171500_launch_critical_pg_cron_jobs` registers `recover-assignment-after-payment-quarter-hourly` (`*/15 * * * *`). Vault secret: `recover_assignment_after_payment_cron_url` (full HTTPS URL) + shared `cron_secret`.
- E2E orphan repair (`repairOrphanedAssignments`) remains separate (pending_assignment without offers, E2E customers only).

## Related

- [assignment-decline-redispatch.md](./assignment-decline-redispatch.md) — decline vs expiry redispatch (3B-2a)
- [assignment-engine.md](../assignments/assignment-engine.md)
- [stage-3a-assignment-dispatch-reliability-audit.md](../audits/stage-3a-assignment-dispatch-reliability-audit.md)
