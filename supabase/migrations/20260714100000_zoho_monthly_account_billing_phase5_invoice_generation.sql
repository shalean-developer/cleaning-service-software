-- Zoho monthly account billing — Phase 5: invoice generation audit + idempotency.

alter table public.customer_billing_account_audit
  drop constraint if exists customer_billing_account_audit_action_valid;

alter table public.customer_billing_account_audit
  add constraint customer_billing_account_audit_action_valid
  check (
    action in (
      'monthly_account_enabled',
      'monthly_account_disabled',
      'billing_terms_updated',
      'zoho_customer_linked',
      'billing_account_viewed',
      'monthly_service_authorized',
      'monthly_invoice_item_accrued',
      'monthly_invoice_generated',
      'monthly_invoice_generation_failed'
    )
  );

alter table public.customer_billing_account_idempotency
  drop constraint if exists customer_billing_account_idempotency_action_valid;

alter table public.customer_billing_account_idempotency
  add constraint customer_billing_account_idempotency_action_valid
  check (
    action in (
      'monthly_account_enabled',
      'monthly_account_disabled',
      'billing_terms_updated',
      'zoho_customer_linked',
      'monthly_invoice_generated'
    )
  );
