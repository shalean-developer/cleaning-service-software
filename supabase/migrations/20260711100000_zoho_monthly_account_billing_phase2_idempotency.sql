-- Zoho monthly account billing — Phase 2: idempotency for admin mutations.

create table if not exists public.customer_billing_account_idempotency (
  idempotency_key text primary key,

  customer_id uuid not null
    references public.customers (id) on delete restrict,

  admin_profile_id uuid not null
    references public.profiles (id) on delete restrict,

  action text not null,
  result jsonb not null,

  created_at timestamptz not null default now(),

  constraint customer_billing_account_idempotency_action_nonempty
    check (length(trim(action)) > 0),

  constraint customer_billing_account_idempotency_action_valid
    check (
      action in (
        'monthly_account_enabled',
        'monthly_account_disabled',
        'billing_terms_updated',
        'zoho_customer_linked'
      )
    )
);

comment on table public.customer_billing_account_idempotency is
  'Idempotent outcomes for admin monthly billing account mutations. Service-role only.';

create index if not exists idx_customer_billing_account_idempotency_customer_created
  on public.customer_billing_account_idempotency (customer_id, created_at desc);

alter table public.customer_billing_account_idempotency enable row level security;

drop policy if exists customer_billing_account_idempotency_select_admin
  on public.customer_billing_account_idempotency;
create policy customer_billing_account_idempotency_select_admin
  on public.customer_billing_account_idempotency
  for select to authenticated
  using (public.auth_is_admin());

grant select on public.customer_billing_account_idempotency to authenticated, service_role;
grant insert on public.customer_billing_account_idempotency to service_role;
