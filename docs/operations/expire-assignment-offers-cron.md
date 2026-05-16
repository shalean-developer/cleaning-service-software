# Assignment offer expiry cron (Supabase)

Stale `assignment_offers` rows (`status = offered`, past `expires_at`) are expired by the app route `/api/cron/expire-assignment-offers`, which calls `expireStaleAssignmentOffers()`.

**Scheduler:** Supabase Cron (`pg_cron` + `pg_net`), not Vercel Cron.

**Fallback:** The same route remains available for manual or emergency triggers (curl, admin tooling).

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `CRON_SECRET` | Vercel (and local `.env.local`) | Bearer token validated by the Next.js route |
| Vault `cron_secret` | Supabase Dashboard → Database → Vault | **Must match** `CRON_SECRET` |
| Vault `expire_offers_cron_url` | Supabase Vault | Full URL, e.g. `https://your-app.vercel.app/api/cron/expire-assignment-offers` |

`APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` are not read by the database job — the Vault URL must be the production (or staging) HTTPS endpoint.

## One-time Vault setup (after migration)

Run in the Supabase SQL editor (replace placeholders; do not commit real secrets):

```sql
-- Full production URL to the cron route
select vault.create_secret(
  'https://YOUR_PRODUCTION_DOMAIN/api/cron/expire-assignment-offers',
  'expire_offers_cron_url',
  'URL for hourly assignment offer expiry HTTP cron'
);

-- Same value as CRON_SECRET in Vercel
select vault.create_secret(
  'YOUR_CRON_SECRET',
  'cron_secret',
  'Bearer token for /api/cron/expire-assignment-offers'
);
```

To rotate a secret, use Vault update/delete in the dashboard or `vault.update_secret` per [Supabase Vault docs](https://supabase.com/docs/guides/database/vault).

## Manual / test trigger

**Against deployed app (recommended):**

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  "https://YOUR_PRODUCTION_DOMAIN/api/cron/expire-assignment-offers"
```

**From SQL (uses Vault, same as scheduled job):**

```sql
select public.invoke_expire_assignment_offers_http();
```

**Local Next.js only** (Supabase Cron cannot reach `localhost` from hosted DB):

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  "http://localhost:3000/api/cron/expire-assignment-offers"
```

## Verify scheduling

**Job registered:**

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'expire-assignment-offers-hourly';
```

**Recent runs:**

```sql
select jobid, runid, job_pid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'expire-assignment-offers-hourly')
order by start_time desc
limit 20;
```

**Offers expired (after a run):**

```sql
select id, booking_id, cleaner_id, status, expires_at, updated_at
from assignment_offers
where status = 'expired'
order by updated_at desc
limit 20;
```

**Bookings flagged for attention:**

```sql
select id, status, metadata->'assignment' as assignment
from bookings
where metadata->'assignment'->>'status' = 'attention_required'
order by updated_at desc
limit 20;
```

## Remove or pause the job

**Unschedule (delete job):**

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = 'expire-assignment-offers-hourly';
```

**Pause without deleting:**

```sql
update cron.job set active = false where jobname = 'expire-assignment-offers-hourly';
```

**Resume:**

```sql
update cron.job set active = true where jobname = 'expire-assignment-offers-hourly';
```

## Migration

- File: `supabase/migrations/20260516220000_expire_assignment_offers_cron.sql`
- Applies: `pg_cron`, `pg_net`, `invoke_expire_assignment_offers_http()`, hourly schedule `0 * * * *`

Do **not** re-enable Vercel Cron for this path — that would duplicate hourly runs.
