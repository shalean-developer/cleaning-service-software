# Cleaner import — auth linking plan

Read-only workflow before `npm run import:cleaners:execute`. No import runs until every CSV row has a safe `current_profile_id`.

## Steps

### 1. Analyze (no writes)

```bash
npm run import:cleaners:link-auth
```

Outputs:

- `cleaner-auth-linking-report.csv` — one row per CSV cleaner (required for import)
- `cleaner-auth-linking-report.json` — same data for tooling

### 2. Review linkage_status

| Status | Meaning | Action |
|--------|---------|--------|
| `matched_ready` | Current auth user found; `current_profile_id` set | Ready for import after re-run link-auth |
| `already_imported` | `cleaners` row already exists for phone/profile | Skip import (no overwrite) |
| `needs_auth_invite` | No auth user in this project | Create via **Admin → Cleaners → New** or migrate auth from legacy Supabase |
| `duplicate_conflict` | Multiple auth matches or profile is customer/admin | Resolve manually; do not auto-link |
| `cannot_map` | Invalid CSV row | Fix source data |

### 3. Prepare invite list and create auth (26 expected today)

```bash
npm run import:cleaners:prepare-invites
```

Opens `cleaner-auth-invites.csv` — use with **Admin → Cleaners → New** (see [CLEANER_AUTH_INVITES_PLAN.md](./CLEANER_AUTH_INVITES_PLAN.md)).

For each row: enter full name + phone; system assigns `@shalean.co.za` login. Do **not** use legacy `@cleaner.shalean.com` placeholders for login.

Alternative: migrate `auth.users` from the legacy Supabase project preserving UUIDs, then re-run link-auth.

### 4. Re-run linking

```bash
npm run import:cleaners:link-auth
```

Target: `Import blocked: NO` and every row either `matched_ready` or `already_imported` with a non-empty `current_profile_id`.

### 5. Dry-run import (still no writes)

```bash
npm run import:cleaners:dry-run
```

Confirms linking report is loaded and rows resolve.

### 6. Execute import (only when unblocked)

```bash
npm run import:cleaners:execute
```

Blocked automatically if linking report is missing or any row is not safe.

## Safety rules

- No fake auth users from the import scripts
- No overwrite of existing `profiles` (full_name/role unchanged when profile exists)
- No overwrite of existing `cleaners` rows
- Match order: existing cleaner phone → legacy `auth_user_id` → CSV email → phone-derived `@shalean.co.za` email
- Does not touch bookings, earnings, payouts, offers, or payments

## Acceptance checklist

- [ ] `cleaner-auth-linking-report.csv` generated
- [ ] Every `needs_auth_invite` cleaner has a named owner / invite plan
- [ ] Every `matched_ready` row has `current_profile_id` populated
- [ ] Zero `duplicate_conflict` / `cannot_map` rows (or explicitly waived)
- [ ] `import:cleaners:execute` exits 0 on dry-run with linking loaded
