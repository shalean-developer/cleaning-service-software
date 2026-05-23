# Reconcile Zoho invoice payments cron

Recovers `zoho_reconcile_pending` rows after Paystack success when Zoho customer payment creation failed temporarily.

## Route

```
GET|POST /api/cron/reconcile-zoho-invoice-payments
```

## Authentication

Same as other crons — `Authorization: Bearer $CRON_SECRET` or `x-cron-secret: $CRON_SECRET`.

Returns **401** if `CRON_SECRET` is unset or wrong.

## Behavior

- Scans up to 25 eligible rows (`zoho_reconcile_pending`, attempts < 5, next retry due)
- Re-verifies Paystack transaction
- Retries Zoho customer payment creation
- Backoff: 5m → 15m → 1h → 6h; after 5 failures → `zoho_reconcile_failed`

## Option A — Vercel Cron

Add to project settings or `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reconcile-zoho-invoice-payments",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

Set `CRON_SECRET` in Vercel environment variables. Vercel sends `Authorization: Bearer {CRON_SECRET}` automatically when using Vercel Cron.

## Option B — External scheduler

Use any scheduler (GitHub Actions, Supabase `pg_cron` + `pg_net`, etc.) to call:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.shalean.com/api/cron/reconcile-zoho-invoice-payments"
```

## Manual invoke (ops)

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.shalean.com/api/cron/reconcile-zoho-invoice-payments"
```

Safe JSON response: `{ ok, scanned, retried, paid, pending, failed, skipped, errors }`

## Monitoring

- Admin: `/admin/operations/zoho-payments` — reconciliation pending/failed counts
- Logs: `zoho_invoice_reconcile_cron_started`, `zoho_invoice_reconcile_cron_completed`

## Related

- [Zoho invoice payments](../payments/zoho-invoice-payments.md) — Phase 4 retry state machine
- [Production readiness audit](../payments/zoho-invoice-production-readiness-audit.md)
