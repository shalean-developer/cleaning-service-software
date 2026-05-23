-- Zoho monthly account billing — Phase 8: delivery automation & collections.

create table if not exists public.monthly_account_collections_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  batch_id uuid null references public.monthly_invoice_batches (id) on delete set null,
  admin_profile_id uuid not null references public.profiles (id),
  note_type text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint monthly_account_collections_notes_type_valid check (
    note_type in (
      'reminder_call',
      'finance_review',
      'payment_arrangement',
      'dispute',
      'escalation',
      'follow_up'
    )
  )
);

create index if not exists monthly_account_collections_notes_customer_idx
  on public.monthly_account_collections_notes (customer_id, created_at desc);

create index if not exists monthly_account_collections_notes_batch_idx
  on public.monthly_account_collections_notes (batch_id)
  where batch_id is not null;

alter table public.monthly_account_collections_notes enable row level security;

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
      'monthly_invoice_marked_overdue',
      'monthly_invoice_auto_sent',
      'monthly_invoice_auto_send_failed',
      'monthly_invoice_finance_review',
      'monthly_invoice_disputed',
      'monthly_invoice_reminder_scheduled',
      'monthly_collections_note_added',
      'monthly_invoice_dispute_requested'
    )
  );
