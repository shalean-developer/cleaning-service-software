-- Zoho monthly account billing — Phase 9: manual credit governance & account controls.

alter table public.customer_billing_accounts
  add column if not exists governance_state text not null default 'approved',
  add column if not exists credit_limit_cents bigint null,
  add column if not exists manual_override_until timestamptz null,
  add column if not exists suspended_at timestamptz null,
  add column if not exists suspended_by_admin_id uuid null references public.profiles (id),
  add column if not exists suspension_reason text null,
  add column if not exists last_finance_review_at timestamptz null,
  add column if not exists last_finance_review_by uuid null references public.profiles (id);

alter table public.customer_billing_accounts
  drop constraint if exists customer_billing_accounts_governance_state_valid;

alter table public.customer_billing_accounts
  add constraint customer_billing_accounts_governance_state_valid
  check (
    governance_state in (
      'approved',
      'account_review_required',
      'finance_hold',
      'disputed',
      'suspended'
    )
  );

alter table public.customer_billing_accounts
  drop constraint if exists customer_billing_accounts_credit_limit_nonnegative;

alter table public.customer_billing_accounts
  add constraint customer_billing_accounts_credit_limit_nonnegative
  check (credit_limit_cents is null or credit_limit_cents >= 0);

create table if not exists public.customer_billing_account_governance_audit (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.customer_billing_accounts (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  admin_profile_id uuid not null references public.profiles (id),
  action text not null,
  previous_state text null,
  next_state text null,
  reason text not null,
  exposure_snapshot jsonb not null default '{}'::jsonb,
  outstanding_balance_snapshot bigint null,
  idempotency_key text null,
  created_at timestamptz not null default now(),
  constraint customer_billing_account_governance_audit_action_valid
    check (
      action in (
        'governance_state_changed',
        'account_suspended',
        'account_unsuspended',
        'finance_review_started',
        'finance_review_completed',
        'credit_limit_updated',
        'override_granted'
      )
    )
);

create index if not exists customer_billing_account_governance_audit_customer_idx
  on public.customer_billing_account_governance_audit (customer_id, created_at desc);

create index if not exists customer_billing_account_governance_audit_account_idx
  on public.customer_billing_account_governance_audit (account_id, created_at desc);

create unique index if not exists customer_billing_account_governance_audit_idempotency_idx
  on public.customer_billing_account_governance_audit (idempotency_key)
  where idempotency_key is not null;

alter table public.customer_billing_account_governance_audit enable row level security;

alter table public.monthly_account_collections_notes
  add column if not exists review_owner_admin_id uuid null references public.profiles (id),
  add column if not exists follow_up_date date null,
  add column if not exists resolution text null;

alter table public.monthly_account_collections_notes
  drop constraint if exists monthly_account_collections_notes_type_valid;

alter table public.monthly_account_collections_notes
  add constraint monthly_account_collections_notes_type_valid
  check (
    note_type in (
      'reminder_call',
      'finance_review',
      'payment_arrangement',
      'dispute',
      'escalation',
      'follow_up',
      'governance_review',
      'credit_limit_review',
      'suspension_reason',
      'override_approval',
      'dispute_resolution',
      'finance_hold'
    )
  );

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
      'monthly_invoice_dispute_requested',
      'monthly_account_governance_state_changed',
      'monthly_account_credit_limit_updated',
      'monthly_account_override_granted'
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
      'monthly_invoice_generated',
      'monthly_account_governance_state_changed',
      'monthly_account_credit_limit_updated',
      'monthly_account_override_granted'
    )
  );
