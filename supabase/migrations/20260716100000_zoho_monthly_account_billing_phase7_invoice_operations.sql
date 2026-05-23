-- Zoho monthly account billing — Phase 7: month-end invoice operations audit actions.

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
      'monthly_invoice_generation_failed',
      'monthly_invoice_payment_sync_checked',
      'monthly_invoice_paid',
      'monthly_invoice_overdue',
      'monthly_invoice_void',
      'monthly_invoice_payment_sync_failed',
      'monthly_invoice_sent',
      'monthly_invoice_reminder_sent',
      'monthly_invoice_marked_overdue'
    )
  );
