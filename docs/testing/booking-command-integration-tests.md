# Booking command integration tests (Phase 1)

`src/features/bookings/server/commands/executeBookingCommand.integration.test.ts` exercises the Supabase adapter against a real Postgres database.

## Safety rules

- **Never commit** `SUPABASE_SERVICE_ROLE_KEY` or other secrets.
- **Never add** remote credentials to `.env.example` or tracked env files.
- Tests create **only** rows tagged with the `test_phase1_` prefix.
- Cleanup deletes **only** customers whose `company_name` matches `test_phase1_<runId>` (and their related bookings, payments, offers, audits, notifications, profiles, and auth users).
- A stale sweep before the suite removes orphaned `test_phase1_*` customers from failed prior runs — it does **not** query or delete production customers, bookings, or payments.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Service role** JWT from Project Settings → API (not anon or publishable) |
| `BOOKING_COMMAND_RUN_REMOTE_INTEGRATION` | Remote only | Must be `true` to run writes against hosted Supabase |

## Local Supabase

```powershell
npm run db:reset
$env:SUPABASE_URL = "http://127.0.0.1:54321"
$env:SUPABASE_SERVICE_ROLE_KEY = "<from npx supabase status>"
npm test
```

Local URLs (`127.0.0.1`, `localhost`) do **not** require the remote opt-in flag.

## Remote Supabase (explicit opt-in)

Use a **non-production** project when possible. Set secrets in your shell or an **untracked** `.env.local` — never commit them.

```powershell
$env:SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service role key from Supabase dashboard>"
$env:BOOKING_COMMAND_RUN_REMOTE_INTEGRATION = "true"
npm test
```

If `SUPABASE_URL` points to a remote host and `BOOKING_COMMAND_RUN_REMOTE_INTEGRATION` is not `true`, the integration suite is **skipped** with a clear message (default `npm test` / CI behavior).

Before any writes, tests validate the JWT `role` claim is `service_role`, probe the Auth Admin API, and confirm PostgREST can read `public.customers`. Using an anon or publishable key fails with: `SUPABASE_SERVICE_ROLE_KEY is not a service_role key.`

If `auth.admin.createUser` returns **Database error creating new user**, apply `20260516150000_auth_profile_bootstrap.sql` (safe `handle_new_user` trigger that sets `profiles.role`). Then `supabase db push` again.

Optional bypass (no new auth user): set `BOOKING_COMMAND_INTEGRATION_CUSTOMER_ID` to an existing `customers.id` whose `company_name` starts with `test_phase1_`.

If Auth works but table access fails, apply migrations to the remote project (including `20260516140000_api_role_grants.sql`):

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## What gets created

Per run:

- One auth user: email `test_phase1_<uuid>@shalean.co.za`
- One customer: `company_name = test_phase1_<uuid>`
- Bookings via `CREATE_BOOKING_DRAFT` with `metadata.test_phase1_run_id`
- Payments / audit keys prefixed with `test_phase1_pay_` / `test_phase1_evt_`

## Cleanup

- `afterAll`: deletes the current run’s customer tree by exact `company_name`
- `beforeAll`: removes stale `test_phase1_*` customers only (idempotent)

## CI recommendation

- Default pipeline: omit service role key → integration tests skip, unit tests pass.
- Optional nightly / manual job: local Supabase or remote with `BOOKING_COMMAND_RUN_REMOTE_INTEGRATION=true`.
