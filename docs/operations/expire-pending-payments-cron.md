# Abandoned checkout expiry cron

Bookings stuck in `pending_payment` after an abandoned Paystack checkout are moved to `payment_failed` via `MARK_PAYMENT_FAILED` with `metadata.failure_reason = checkout_expired`.

**Route:** `/api/cron/expire-pending-payments`  
**Service:** `expireStalePendingPayments()` in `src/features/payments/server/expirePendingPayments.ts`

**Scheduler:** Configure Supabase Cron (`pg_cron` + `pg_net`) or an external scheduler — same pattern as assignment offer expiry. Hourly is sufficient; every 15 minutes is optional in high-volume production.

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `CRON_SECRET` | Vercel (and local `.env.local`) | Bearer token validated by the Next.js route |
| `PENDING_PAYMENT_EXPIRY_GRACE_MINUTES` | Optional | Minutes after `payment_link_expires_at` before expiry (default **15**) |
| `PENDING_PAYMENT_EXPIRE_BATCH_SIZE` | Optional | Max rows per run (default **50**) |

Vault secrets for Supabase-scheduled HTTP calls should mirror assignment offer cron: a full HTTPS URL and a `cron_secret` matching `CRON_SECRET`.

## One-time Vault setup (after migration `20260619171500_launch_critical_pg_cron_jobs`)

```sql
select vault.create_secret(
  'https://YOUR_PRODUCTION_DOMAIN/api/cron/expire-pending-payments',
  'expire_pending_payments_cron_url',
  'URL for hourly expire pending payments HTTP cron'
);
-- cron_secret: reuse existing Vault secret (must match Vercel CRON_SECRET)
```

**pg_cron job:** `expire-pending-payments-hourly` at `0 * * * *` (hourly UTC).

Verify:

```sql
select jobid, jobname, schedule, active from cron.job where jobname = 'expire-pending-payments-hourly';
select public.invoke_expire_pending_payments_http();
```

## Expiry rules

| Case | Stale when |
|------|------------|
| `payment_link_expires_at` set | `now > payment_link_expires_at + grace` (default grace 15 min) |
| `payment_link_expires_at` null | `now > payments.created_at + 30 min + grace` (45 min total) |

Only rows with `bookings.status = pending_payment` and `payments.status` in (`initialized`, `pending`) are candidates. Paid bookings are never updated.

## Manual trigger

**Deployed app:**

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  "https://YOUR_PRODUCTION_DOMAIN/api/cron/expire-pending-payments"
```

**Local Next.js:**

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  "http://localhost:3000/api/cron/expire-pending-payments"
```

Response shape (no sensitive payment fields):

```json
{
  "ok": true,
  "scanned": 2,
  "expired": 1,
  "skipped": { "paid": 0, "notYetDue": 1, "wrongBookingStatus": 0, "alreadyFailed": 0, "commandRejected": 0 },
  "errors": []
}
```

## Verification

**Audit rows from cron:**

```sql
select booking_id, command, idempotency_key, metadata, created_at
from booking_state_audit
where idempotency_key like 'cron:expire-pending-payment:%'
order by created_at desc
limit 20;
```

**Bookings expired for abandoned checkout:**

```sql
select b.id, b.status, p.status as payment_status, p.payment_link_expires_at, p.updated_at
from bookings b
join payments p on p.booking_id = b.id
where b.status = 'payment_failed'
  and p.status = 'failed'
order by p.updated_at desc
limit 20;
```

**Still stuck in pending_payment (should shrink after cron runs):**

```sql
select b.id, b.updated_at, p.payment_link_expires_at, p.created_at
from bookings b
join payments p on p.booking_id = b.id
where b.status = 'pending_payment'
  and p.status in ('pending', 'initialized')
order by b.updated_at asc
limit 20;
```

## Rollback notes

- Cron transitions are **audit-backed**; do not `UPDATE bookings.status` directly in production.
- To undo a mistaken expiry for a single booking, use admin support workflow (`ADMIN_OVERRIDE_STATUS` with reason) only after confirming Paystack did not capture funds.
- Pausing the job stops new expiries; customers can still complete checkout while `pending_payment` if within the Paystack window.
- Re-enabling cron is safe: idempotency key `cron:expire-pending-payment:{paymentId}` prevents duplicate failure transitions.

## Related

- Design: `docs/architecture/stage-2b-2-abandoned-checkout-expiry-design.md`
- Customer/admin UX after expiry: `docs/operations/payment-failed-customer-retry.md`
- Assignment offer cron (scheduler pattern): `docs/operations/expire-assignment-offers-cron.md`
