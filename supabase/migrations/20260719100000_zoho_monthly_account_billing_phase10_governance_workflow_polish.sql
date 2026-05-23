-- Zoho monthly account billing — Phase 10: governance workflow polish (manual UX only).

alter table public.customer_billing_accounts
  add column if not exists finance_review_status text null,
  add column if not exists finance_review_owner_admin_id uuid null references public.profiles (id),
  add column if not exists finance_review_follow_up_date date null,
  add column if not exists finance_review_resolution text null;

alter table public.customer_billing_accounts
  drop constraint if exists customer_billing_accounts_finance_review_status_valid;

alter table public.customer_billing_accounts
  add constraint customer_billing_accounts_finance_review_status_valid
  check (
    finance_review_status is null
    or finance_review_status in ('open', 'resolved', 'dismissed')
  );

alter table public.customer_billing_account_governance_audit
  drop constraint if exists customer_billing_account_governance_audit_action_valid;

alter table public.customer_billing_account_governance_audit
  add constraint customer_billing_account_governance_audit_action_valid
  check (
    action in (
      'governance_state_changed',
      'account_suspended',
      'account_unsuspended',
      'finance_review_started',
      'finance_review_completed',
      'finance_review_assigned',
      'finance_review_resolved',
      'finance_review_dismissed',
      'credit_limit_updated',
      'override_granted'
    )
  );

create index if not exists customer_billing_accounts_finance_review_open_idx
  on public.customer_billing_accounts (finance_review_status, finance_review_follow_up_date)
  where finance_review_status = 'open';

create index if not exists customer_billing_accounts_override_until_idx
  on public.customer_billing_accounts (manual_override_until)
  where manual_override_until is not null;
