# Cleaner CSV import

Imports **cleaner profile data only** into existing Supabase tables. Does not change schema or touch bookings, payouts, earnings, or offers.

## Prerequisites

- `.env.local` with `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`
- CSV with legacy cleaner export columns (see `data/import/cleaners_import_ready_safe.csv`)
- Each row must include `auth_user_id` pointing at an **existing** `auth.users` record (no auth user creation)

## Workflow

1. **Auth linking** — maps CSV rows to current `profile_id`
2. **Prepare invites** — builds `cleaner-auth-invites.csv` for Admin onboarding
3. **Dry-run import** — validates rows + linking report
4. **Execute import** — only when linking report shows all rows safe

See [AUTH_LINKING_PLAN.md](./AUTH_LINKING_PLAN.md) for the full plan.

## Onboarding leads (name + phone only)

For invite candidates **without** auth users or full legacy CSV columns:

```bash
npm run import:cleaners:onboarding-leads
# Custom CSV: node scripts/import/import-cleaner-onboarding-leads.mjs --csv path/to/file.csv
```

- Input: `data/import/cleaner-onboarding-leads-input.csv` (`full_name`, `phone`)
- Read-only: checks existing `cleaners` by phone; **no DB writes**, no auth creation
- Output: `cleaner-onboarding-leads.csv` (rows with `status=needs_auth_invite` only), `cleaner-onboarding-leads-report.json`
- Skips existing cleaners; dedupes by phone; `active` always false on leads

## Commands

```bash
# Step 1: Auth linking analysis (no writes)
npm run import:cleaners:link-auth

# Step 2: Invite list for Admin → Cleaners → New (no writes)
npm run import:cleaners:prepare-invites

# Step 3: Validate import plan (no writes)
npm run import:cleaners:dry-run

# Step 4: Apply inserts (blocked until linking is complete)
npm run import:cleaners:execute

# Custom CSV path
node scripts/import/link-cleaner-auth.mjs --csv path/to/file.csv
node scripts/import/import-cleaners-data.mjs --dry-run --csv path/to/file.csv
```

## Safety rules

- Skips cleaners already in DB (match by `phone` or `profile_id` / `auth_user_id`)
- Skips duplicate emails/phones within the CSV
- Never creates or updates `auth.users`
- Never overwrites existing `cleaners` rows
- New rows: `active=false`, profile upsert with `role=cleaner`, child rows for areas/capabilities/availability

## Output

| File | Purpose |
|------|---------|
| `cleaner-auth-invites.csv` | Admin onboarding list for `needs_auth_invite` cleaners |
| `cleaner-auth-linking-report.csv` | Auth/profile mapping per CSV row (required before execute) |
| `cleaner-auth-linking-report.json` | JSON copy of linking analysis |
| `import-cleaners-report.json` | Per-run import dry-run/execute log |

All reports are gitignored at the project root.
