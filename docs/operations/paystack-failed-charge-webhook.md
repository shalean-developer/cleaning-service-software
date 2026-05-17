# Paystack `charge.failed` webhook (Stage 2B-3a)

Real-time handling when Paystack reports a declined or failed charge for an in-flight checkout.

## Paystack dashboard setup

1. Webhook URL: `https://<production-domain>/api/paystack/webhook`
2. Subscribe to at least:
   - **`charge.success`** (existing — payment confirmation)
   - **`charge.failed`** (Stage 2B-3a — declined/failed charges)
3. Use the same secret as `PAYSTACK_WEBHOOK_SECRET` (or `PAYSTACK_SECRET_KEY` default).

**Important:** Confirm delivery in the Paystack dashboard with a **test decline** transaction. Some Paystack documentation wording suggests webhooks are primarily for successful charges; treat `charge.failed` as best-effort and keep the expiry cron running.

## Expected behavior

| Condition | Webhook result | Booking / payment |
|-----------|----------------|-------------------|
| Valid `charge.failed`, `pending_payment`, unpaid | HTTP 200, handled | `payment_failed` + payment `failed` via `MARK_PAYMENT_FAILED` |
| Duplicate same Paystack transaction id | HTTP 200, idempotent | No duplicate audit transition |
| Unknown reference | HTTP 200, ignored | No change |
| Already `confirmed` / payment `paid` | HTTP 200, skipped | No downgrade |
| Already `payment_failed` | HTTP 200, idempotent | No change |
| `charge.success` | Unchanged | Finalize path only |
| Other events (e.g. `transfer.*`) | HTTP 200, ignored | No change |

Audit metadata for webhook failures:

- `failure_reason`: `paystack_declined`
- `source`: `paystack_webhook`
- Optional: `gateway_response`, `paystack_status`, `paystack_reference`

## Safety caveats

- **Abandoned checkout** (customer closes Paystack without paying) may **not** emit `charge.failed`. Those bookings still move to `payment_failed` via the [expire pending payments cron](./expire-pending-payments-cron.md) (`checkout_expired`).
- **Never downgrades** a paid or post-payment booking when a late failure webhook arrives.
- **Does not** change the verify route or `/payment/success` — success authority remains webhook + verify finalize path.
- **Does not** replace cron — schedule both.

## Verification / testing

### Local / CI

```bash
npm run typecheck
npx vitest run src/features/payments/server/processPaystackChargeFailure.test.ts src/features/payments/server/paystackFoundation.test.ts
```

### Staging

1. Create a booking and start Paystack checkout (initialize).
2. Use a Paystack **decline** test card.
3. In Paystack dashboard → Webhooks, confirm `charge.failed` was delivered (200 response).
4. Confirm booking status is `payment_failed` before cron would expire the link.
5. Confirm **Retry payment** still works on booking detail (Stage 2B-2c).
6. Regression: complete a successful payment and confirm `confirmed` is unchanged.

### Support

If a customer was charged but booking shows `payment_failed`, use existing verify/support workflow — do not patch status in SQL. See [payment failed customer retry](./payment-failed-customer-retry.md).

## Related

- [Stage 2B-3 design](../architecture/stage-2b-3-paystack-failed-charge-webhook-design.md)
- [Paystack foundation](../payments/paystack-foundation.md)
- [Expire pending payments cron](./expire-pending-payments-cron.md)
