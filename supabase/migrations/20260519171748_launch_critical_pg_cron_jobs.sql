-- Launch-critical pg_cron jobs: expire pending payments, recover assignment after payment,
-- process notification outbox. Vault URL secrets required post-deploy (see docs/operations/).

create extension if not exists pg_cron with schema pg_catalog;

create extension if not exists pg_net with schema extensions;

-- Expire abandoned checkout payments (hourly).
create or replace function public.invoke_expire_pending_payments_http()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, net, pg_catalog
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret
  into v_url
  from vault.decrypted_secrets
  where name = 'expire_pending_payments_cron_url'
  limit 1;

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = 'cron_secret'
  limit 1;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise warning
      'expire_pending_payments cron skipped: create vault secrets expire_pending_payments_cron_url and cron_secret (see docs/operations/expire-pending-payments-cron.md)';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  into v_request_id;

  return v_request_id;
end;
$$;

comment on function public.invoke_expire_pending_payments_http() is
  'pg_net POST to /api/cron/expire-pending-payments. Requires Vault expire_pending_payments_cron_url and cron_secret.';

revoke all on function public.invoke_expire_pending_payments_http() from public;
revoke all on function public.invoke_expire_pending_payments_http() from anon;
revoke all on function public.invoke_expire_pending_payments_http() from authenticated;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'expire-pending-payments-hourly';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$$;

select cron.schedule(
  'expire-pending-payments-hourly',
  '0 * * * *',
  $$select public.invoke_expire_pending_payments_http();$$
);

-- Recover paid confirmed bookings without dispatch (every 15 minutes).
create or replace function public.invoke_recover_assignment_after_payment_http()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, net, pg_catalog
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret
  into v_url
  from vault.decrypted_secrets
  where name = 'recover_assignment_after_payment_cron_url'
  limit 1;

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = 'cron_secret'
  limit 1;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise warning
      'recover_assignment_after_payment cron skipped: create vault secrets recover_assignment_after_payment_cron_url and cron_secret (see docs/operations/assignment-recovery.md)';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  into v_request_id;

  return v_request_id;
end;
$$;

comment on function public.invoke_recover_assignment_after_payment_http() is
  'pg_net POST to /api/cron/recover-assignment-after-payment. Requires Vault recover_assignment_after_payment_cron_url and cron_secret.';

revoke all on function public.invoke_recover_assignment_after_payment_http() from public;
revoke all on function public.invoke_recover_assignment_after_payment_http() from anon;
revoke all on function public.invoke_recover_assignment_after_payment_http() from authenticated;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'recover-assignment-after-payment-quarter-hourly';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$$;

select cron.schedule(
  'recover-assignment-after-payment-quarter-hourly',
  '*/15 * * * *',
  $$select public.invoke_recover_assignment_after_payment_http();$$
);

-- Notification outbox worker (every 3 minutes when notifications enabled).
create or replace function public.invoke_process_notification_outbox_http()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault, net, pg_catalog
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret
  into v_url
  from vault.decrypted_secrets
  where name = 'process_notification_outbox_cron_url'
  limit 1;

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = 'cron_secret'
  limit 1;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise warning
      'process_notification_outbox cron skipped: create vault secrets process_notification_outbox_cron_url and cron_secret (see docs/operations/notification-outbox-worker.md)';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  into v_request_id;

  return v_request_id;
end;
$$;

comment on function public.invoke_process_notification_outbox_http() is
  'pg_net POST to /api/cron/process-notification-outbox. Requires Vault process_notification_outbox_cron_url and cron_secret.';

revoke all on function public.invoke_process_notification_outbox_http() from public, anon, authenticated;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'process-notification-outbox-every-3min';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$$;

select cron.schedule(
  'process-notification-outbox-every-3min',
  '*/3 * * * *',
  $$select public.invoke_process_notification_outbox_http();$$
);
