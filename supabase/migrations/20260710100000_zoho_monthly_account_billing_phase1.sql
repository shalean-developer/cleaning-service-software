-- Zoho monthly account billing — Phase 1: schema + read models only.
-- No booking lifecycle, invoice generation, or payment sync changes in this migration.

create table if not exists public.customer_billing_accounts (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null
    references public.customers (id) on delete restrict,

  billing_mode text not null,
  zoho_customer_id text null,
  billing_email text not null,
  billing_terms text not null,

  is_monthly_account_enabled boolean not null default false,

  approved_by_admin_id uuid null
    references public.profiles (id) on delete set null,
  approved_at timestamptz null,
  approval_reason text null,

  disabled_at timestamptz null,
  disabled_by_admin_id uuid null
    references public.profiles (id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customer_billing_accounts_customer_unique
    unique (customer_id),

  constraint customer_billing_accounts_billing_mode_valid
    check (billing_mode in ('pay_now', 'paystack_link', 'offline_payment', 'monthly_account')),

  constraint customer_billing_accounts_billing_email_nonempty
    check (length(trim(billing_email)) > 0),

  constraint customer_billing_accounts_billing_terms_nonempty
    check (length(trim(billing_terms)) > 0),

  constraint customer_billing_accounts_monthly_enabled_requires_approval
    check (
      is_monthly_account_enabled = false
      or (
        billing_mode = 'monthly_account'
        and approved_by_admin_id is not null
        and approved_at is not null
        and approval_reason is not null
        and length(trim(approval_reason)) > 0
      )
    )
);

comment on table public.customer_billing_accounts is
  'Per-customer billing configuration including optional monthly account mode. Service-role writes only in Phase 1.';

create index if not exists idx_customer_billing_accounts_customer_id
  on public.customer_billing_accounts (customer_id);

create index if not exists idx_customer_billing_accounts_zoho_customer_id
  on public.customer_billing_accounts (zoho_customer_id)
  where zoho_customer_id is not null;

create or replace function public.set_customer_billing_accounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_billing_accounts_set_updated_at on public.customer_billing_accounts;
create trigger customer_billing_accounts_set_updated_at
  before update on public.customer_billing_accounts
  for each row
  execute function public.set_customer_billing_accounts_updated_at();

alter table public.customer_billing_accounts enable row level security;

drop policy if exists customer_billing_accounts_select_admin on public.customer_billing_accounts;
create policy customer_billing_accounts_select_admin on public.customer_billing_accounts
  for select to authenticated
  using (public.auth_is_admin());

grant select on public.customer_billing_accounts to authenticated, service_role;
grant insert, update, delete on public.customer_billing_accounts to service_role;

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.customer_billing_account_audit (
  id uuid primary key default gen_random_uuid(),

  account_id uuid null
    references public.customer_billing_accounts (id) on delete set null,

  customer_id uuid null
    references public.customers (id) on delete set null,

  admin_profile_id uuid null
    references public.profiles (id) on delete set null,

  action text not null,
  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint customer_billing_account_audit_action_valid
    check (
      action in (
        'monthly_account_enabled',
        'monthly_account_disabled',
        'billing_terms_updated',
        'zoho_customer_linked',
        'billing_account_viewed'
      )
    ),

  constraint customer_billing_account_audit_action_nonempty
    check (length(trim(action)) > 0)
);

comment on table public.customer_billing_account_audit is
  'Append-only audit for customer billing account changes. Service-role writes only.';

create index if not exists idx_customer_billing_account_audit_customer_created
  on public.customer_billing_account_audit (customer_id, created_at desc)
  where customer_id is not null;

create index if not exists idx_customer_billing_account_audit_account_created
  on public.customer_billing_account_audit (account_id, created_at desc)
  where account_id is not null;

create or replace function public.forbid_customer_billing_account_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'customer_billing_account_audit is append-only: UPDATE and DELETE are forbidden';
end;
$$;

drop trigger if exists customer_billing_account_audit_append_only on public.customer_billing_account_audit;
create trigger customer_billing_account_audit_append_only
  before update or delete on public.customer_billing_account_audit
  for each row
  execute function public.forbid_customer_billing_account_audit_mutation();

alter table public.customer_billing_account_audit enable row level security;

drop policy if exists customer_billing_account_audit_select_admin on public.customer_billing_account_audit;
create policy customer_billing_account_audit_select_admin on public.customer_billing_account_audit
  for select to authenticated
  using (public.auth_is_admin());

grant select on public.customer_billing_account_audit to authenticated, service_role;
grant insert on public.customer_billing_account_audit to service_role;

-- ---------------------------------------------------------------------------
-- Monthly invoice batches
-- ---------------------------------------------------------------------------

create table if not exists public.monthly_invoice_batches (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null
    references public.customers (id) on delete restrict,

  billing_month date not null,
  status text not null default 'draft',

  zoho_invoice_id text null,
  zoho_invoice_number text null,

  total_cents bigint not null default 0,
  currency text not null default 'ZAR',

  generated_by_admin_id uuid null
    references public.profiles (id) on delete set null,
  generated_at timestamptz null,
  sent_at timestamptz null,
  paid_at timestamptz null,

  idempotency_key text null,
  zoho_reference_number text null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint monthly_invoice_batches_customer_month_unique
    unique (customer_id, billing_month),

  constraint monthly_invoice_batches_status_valid
    check (status in ('draft', 'generated', 'sent', 'paid', 'overdue', 'void')),

  constraint monthly_invoice_batches_total_cents_nonnegative
    check (total_cents >= 0),

  constraint monthly_invoice_batches_currency_zar
    check (currency = 'ZAR')
);

comment on table public.monthly_invoice_batches is
  'Monthly consolidated invoice batches per customer. Generation/sync deferred to Phase 2+.';

create index if not exists idx_monthly_invoice_batches_customer_billing_month
  on public.monthly_invoice_batches (customer_id, billing_month desc);

create index if not exists idx_monthly_invoice_batches_status
  on public.monthly_invoice_batches (status, updated_at desc);

create or replace function public.set_monthly_invoice_batches_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monthly_invoice_batches_set_updated_at on public.monthly_invoice_batches;
create trigger monthly_invoice_batches_set_updated_at
  before update on public.monthly_invoice_batches
  for each row
  execute function public.set_monthly_invoice_batches_updated_at();

alter table public.monthly_invoice_batches enable row level security;

drop policy if exists monthly_invoice_batches_select_admin on public.monthly_invoice_batches;
create policy monthly_invoice_batches_select_admin on public.monthly_invoice_batches
  for select to authenticated
  using (public.auth_is_admin());

grant select on public.monthly_invoice_batches to authenticated, service_role;
grant insert, update, delete on public.monthly_invoice_batches to service_role;

-- ---------------------------------------------------------------------------
-- Monthly invoice batch line items
-- ---------------------------------------------------------------------------

create table if not exists public.monthly_invoice_batch_items (
  id uuid primary key default gen_random_uuid(),

  batch_id uuid not null
    references public.monthly_invoice_batches (id) on delete cascade,

  booking_id uuid not null
    references public.bookings (id) on delete restrict,

  visit_date date not null,
  service_slug text not null,
  amount_cents bigint not null,

  status text not null default 'accrued',

  zoho_line_item_id text null,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint monthly_invoice_batch_items_booking_unique
    unique (booking_id),

  constraint monthly_invoice_batch_items_amount_cents_positive
    check (amount_cents > 0),

  constraint monthly_invoice_batch_items_status_valid
    check (status in ('accrued', 'included', 'invoiced', 'paid', 'void', 'excluded')),

  constraint monthly_invoice_batch_items_service_slug_nonempty
    check (length(trim(service_slug)) > 0)
);

comment on table public.monthly_invoice_batch_items is
  'Line items accrued into monthly invoice batches. One booking maps to at most one batch item.';

create index if not exists idx_monthly_invoice_batch_items_batch_id
  on public.monthly_invoice_batch_items (batch_id);

create index if not exists idx_monthly_invoice_batch_items_booking_id
  on public.monthly_invoice_batch_items (booking_id);

create index if not exists idx_monthly_invoice_batch_items_status
  on public.monthly_invoice_batch_items (status);

create or replace function public.set_monthly_invoice_batch_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monthly_invoice_batch_items_set_updated_at on public.monthly_invoice_batch_items;
create trigger monthly_invoice_batch_items_set_updated_at
  before update on public.monthly_invoice_batch_items
  for each row
  execute function public.set_monthly_invoice_batch_items_updated_at();

alter table public.monthly_invoice_batch_items enable row level security;

drop policy if exists monthly_invoice_batch_items_select_admin on public.monthly_invoice_batch_items;
create policy monthly_invoice_batch_items_select_admin on public.monthly_invoice_batch_items
  for select to authenticated
  using (public.auth_is_admin());

grant select on public.monthly_invoice_batch_items to authenticated, service_role;
grant insert, update, delete on public.monthly_invoice_batch_items to service_role;
