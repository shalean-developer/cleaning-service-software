# Cleaner auth invites plan (26 cleaners)

Prepare accounts **before** any cleaner data import. No automatic invites or auth creation.

## Step 1 — Generate invite list (read-only)

```bash
npm run import:cleaners:prepare-invites
```

Reads `cleaner-auth-linking-report.csv` and writes:

- `cleaner-auth-invites.csv` — use this in Admin onboarding
- `cleaner-auth-invites-summary.json` — counts and metadata

## Step 2 — Create accounts manually

For each row in `cleaner-auth-invites.csv`:

1. **Admin → Cleaners → New**
2. **Full name** — copy from CSV
3. **Phone** — copy E.164 from CSV (e.g. `+27680284159`)
4. **Password** — set a secure temporary password
5. Do **not** use `temporary_email_if_needed` for login (legacy placeholder only)
6. Expected login after save: `email` column (`0XXXXXXXXX@shalean.co.za` from phone)

New cleaners default to **inactive** until onboarding is completed in admin.

## Step 3 — Re-link auth

```bash
npm run import:cleaners:link-auth
```

Target: every former `needs_auth_invite` row becomes `matched_ready` with `current_profile_id` filled.

## Step 4 — Import (later only)

Only after link-auth shows **Import blocked: NO**:

```bash
npm run import:cleaners:dry-run
npm run import:cleaners:execute
```

## Email rules (in invite CSV)

| Situation | `email` column | `temporary_email_if_needed` |
|-----------|----------------|----------------------------|
| Real personal email | Use real email | Optional phone login backup |
| Legacy `@cleaner.shalean.com` | Phone-derived `@shalean.co.za` | Placeholder preserved |
| No email | Phone-derived `@shalean.co.za` | Empty |

## What we do not do

- No automatic Supabase invites
- No bulk auth user creation scripts
- No cleaner profile import until linking passes
- No changes to bookings, payouts, earnings, offers, or payments

## Acceptance

- [ ] `cleaner-auth-invites.csv` has 26 rows
- [ ] Each row has `pending_invite` or flagged `missing_contact`
- [ ] Admin created all accounts
- [ ] `import:cleaners:link-auth` shows 0 `needs_auth_invite`
- [ ] Import execute still blocked until linking green
