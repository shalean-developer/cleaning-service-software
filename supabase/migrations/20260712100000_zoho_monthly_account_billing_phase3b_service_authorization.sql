-- Zoho monthly account billing — Phase 3B: service authorization (not payment).
-- Allows monthly_account draft bookings to reach confirmed/assignment without paid payment.

-- ---------------------------------------------------------------------------
-- monthly_service_authorizations — service delivery clearance, not payment
-- ---------------------------------------------------------------------------

create table if not exists public.monthly_service_authorizations (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null
    references public.bookings (id) on delete restrict,

  customer_id uuid not null
    references public.customers (id) on delete restrict,

  admin_profile_id uuid not null
    references public.profiles (id) on delete restrict,

  monthly_account_id uuid not null
    references public.customer_billing_accounts (id) on delete restrict,

  amount_cents integer not null,
  status text not null default 'authorized',

  reason text not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  revoked_at timestamptz null,
  revoked_by_admin_id uuid null
    references public.profiles (id) on delete set null,
  revoked_reason text null,

  constraint monthly_service_authorizations_booking_unique
    unique (booking_id),

  constraint monthly_service_authorizations_idempotency_unique
    unique (idempotency_key),

  constraint monthly_service_authorizations_status_valid
    check (status in ('authorized', 'revoked')),

  constraint monthly_service_authorizations_amount_cents_positive
    check (amount_cents > 0),

  constraint monthly_service_authorizations_reason_nonempty
    check (length(trim(reason)) > 0),

  constraint monthly_service_authorizations_idempotency_nonempty
    check (length(trim(idempotency_key)) >= 8)
);

comment on table public.monthly_service_authorizations is
  'Admin service delivery authorization for monthly_account bookings. Not a payment record.';

create index if not exists idx_monthly_service_authorizations_customer_id
  on public.monthly_service_authorizations (customer_id);

create index if not exists idx_monthly_service_authorizations_monthly_account_id
  on public.monthly_service_authorizations (monthly_account_id);

create index if not exists idx_monthly_service_authorizations_status
  on public.monthly_service_authorizations (status)
  where status = 'authorized';

-- ---------------------------------------------------------------------------
-- Extend customer_billing_account_audit actions
-- ---------------------------------------------------------------------------

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
      'monthly_service_authorized'
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: admin SELECT only; service_role writes
-- ---------------------------------------------------------------------------

alter table public.monthly_service_authorizations enable row level security;

drop policy if exists monthly_service_authorizations_select_admin
  on public.monthly_service_authorizations;
create policy monthly_service_authorizations_select_admin
  on public.monthly_service_authorizations
  for select
  to authenticated
  using (public.auth_is_admin());

grant select on public.monthly_service_authorizations to authenticated;
grant insert, update on public.monthly_service_authorizations to service_role;
