# Stage 5I-β Soak Plan — Metrics-Only Purge Readiness

**Type:** Ops checklist / audit (read-only)  
**Date:** 2026-05-17  
**Gate:** Required **before** implementing destructive `notification_metrics_hourly` purge (5I-β)  
**Does not:** implement code, change cron, delete data, or change RLS

**Related:**

- [stage-5i-beta-metrics-hourly-purge-design.md](../architecture/stage-5i-beta-metrics-hourly-purge-design.md) — purge design (post-soak)
- [stage-5i-alpha-retention-dry-run-final-audit.md](./stage-5i-alpha-retention-dry-run-final-audit.md) — 5I-α implementation audit
- [notification-retention-cleanup-cron.md](../operations/notification-retention-cleanup-cron.md) — cron setup and Vault secrets

---

## Purpose

Confirm that **5I-α** retention dry-run counts are **stable, correct, and non-destructive** before any team implements **5I-β** metrics-hourly `DELETE` behind env flags.

This soak validates the **same counts** that 5I-β will use for `eligible.metricsHourly.olderThanPolicy`. Outbox and worker-run categories are recorded to catch classification regressions early—even though 5I-β will not purge those tables.

---

## Prerequisites (before Day 1)

Complete once per environment (production required; staging optional but recommended).

| # | Check | How to verify |
|---|--------|----------------|
| P1 | **5I-α deployed** | Route `POST /api/cron/cleanup-notification-retention` returns 200 with retention JSON |
| P2 | **Migration applied** | `20260519103000_notification_retention_dry_run_cron.sql` on Supabase |
| P3 | **Vault secrets** | `cleanup_notification_retention_cron_url` + `cron_secret` match Vercel `CRON_SECRET` |
| P4 | **pg_cron job** (optional) | `notification-retention-dry-run-daily` at `15 3 * * *` active, or manual daily POST |
| P5 | **Rollup cron healthy** | Hourly rollup job running; 7d trends not stale >2h on `/admin/notifications` |
| P6 | **No purge flags** | Production must **not** have future 5I-β flags enabled (`NOTIFICATION_RETENTION_CLEANUP_ENABLED`, `NOTIFICATION_RETENTION_METRICS_PURGE_ENABLED`, etc.) — they do not exist in 5I-α |
| P7 | **Owner assigned** | Named production owner for daily runs and sign-off |

**Record environment:** `Production` — `https://cleaning-service-software.vercel.app`

### Soak progress

| Day | Status | Date (UTC) | Notes |
|-----|--------|------------|-------|
| **1** | **PASS** | 2026-05-17 | Manual POST; `dryRun: true`, `deleted: 0`; see [Day 1 record](#day-1-record-2026-05-17) |
| 2 | Pending | | |
| 3 | Pending | | |

**Sign-off:** Not ready — need ≥2 more consecutive daily runs.

---

## 3–5 day soak checklist

Run **once per calendar day** for **minimum 3 consecutive days** (5 recommended). Use the **same environment** (production) each day.

### Daily procedure (each day)

- [ ] **D1** Trigger dry-run (PowerShell or pg_cron — see [Safe commands](#safe-commands))
- [ ] **D2** HTTP status **200** and JSON `ok: true`
- [ ] **D3** Confirm `dryRun: true`
- [ ] **D4** Confirm `deleted: 0` (number zero, not object)
- [ ] **D5** Record `asOf` timestamp
- [ ] **D6** Record `eligible.metricsHourly.olderThanPolicy`
- [ ] **D7** Record `oldestEligible.metricsHourly` (date or `null`)
- [ ] **D8** Record all outbox eligible counts (detect spikes — [Outbox columns](#outbox-columns-for-spike-detection))
- [ ] **D9** Record `eligible.workerRuns.eligibleWithRollupCoverage` and `protectedMissingRollup`
- [ ] **D10** Record protected outbox counts (queue sanity)
- [ ] **D11** Open `/admin/notifications` — compare retention section to cron JSON ([Admin panel](#admin-panel-adminnotifications))
- [ ] **D12** Confirm worker delivery / requeue still normal (no ops incidents)
- [ ] **D13** Save evidence: JSON file or screenshot + Vercel log line `notification_retention_dry_run`
- [ ] **D14** Apply [No-go criteria](#no-go-criteria) — if any hit, **stop soak** and investigate

### Soak log table (copy per environment)

| Day | Date (UTC) | Trigger | HTTP | `dryRun` | `deleted` | `metricsHourly` eligible | `oldestEligible.metricsHourly` | Live sent elig. | Dry-run sent elig. | Failed elig. | Unsup. pending elig. | WR elig (rollup) | WR prot (no rollup) | Pending deliv. (prot.) | Processing (prot.) | Admin panel match? | Notes |
|-----|------------|---------|------|----------|-----------|--------------------------|--------------------------------|-----------------|--------------------|--------------|---------------------|------------------|----------------------|------------------------|-------------------|---------------------|-------|
| 1 | 2026-05-17 | manual (PowerShell) | 200 | true | 0 | 0 | — (`null`) | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | — | **PASS** — `asOf` 20:18:03Z; failed within retention (prot.) = 6; no-go criteria clear |
| 2 | | | | | | | | | | | | | | | | | |
| 3 | | | | | | | | | | | | | | | | | |
| 4 | | | | | | | | | | | | | | | | | |
| 5 | | | | | | | | | | | | | | | | | |

### Day 1 record (2026-05-17)

**Result:** Successful dry-run — safe to count as **Day 1 of 3** toward soak sign-off.

| Check | Result |
|-------|--------|
| Trigger | `POST https://cleaning-service-software.vercel.app/api/cron/cleanup-notification-retention` |
| Auth | Bearer `CRON_SECRET` (production) |
| HTTP | **200** |
| `ok` | `true` |
| `dryRun` | `true` |
| `deleted` | `0` |
| `asOf` | `2026-05-17T20:18:03.249Z` |
| No-go criteria | **None triggered** |

**Metrics-hourly (5I-β focus):**

| Field | Value |
|-------|-------|
| `eligible.metricsHourly.olderThanPolicy` | `0` |
| `oldestEligible.metricsHourly` | `null` |

**Expected:** Eligible `0` — hourly rollup table younger than 13 months.

**Outbox eligible (spike baseline):**

| Field | Value |
|-------|-------|
| `eligible.outbox.liveSentOlderThanPolicy` | 0 |
| `eligible.outbox.dryRunSentOlderThanPolicy` | 0 |
| `eligible.outbox.failedOlderThanPolicy` | 0 |
| `eligible.outbox.unsupportedPendingOlderThanPolicy` | 0 |

**Worker runs:**

| Field | Value |
|-------|-------|
| `eligible.workerRuns.olderThanPolicy` | 0 |
| `eligible.workerRuns.eligibleWithRollupCoverage` | 0 |
| `eligible.workerRuns.protectedMissingRollup` | 0 |

**Protected outbox (queue sanity):**

| Field | Value |
|-------|-------|
| `protected.outbox.pendingDeliverable` | 2 |
| `protected.outbox.processing` | 0 |
| `protected.outbox.failedWithinRetention` | 6 |
| `protected.outbox.requeueShieldRecent` | 0 |

**Policy (defaults confirmed):** live sent 90d · dry-run sent 60d · failed 365d · unsupported pending 180d · worker runs 90d · metrics **13mo** · requeue shield 30d.

**Day 1 daily checklist:** D1–D7, D8–D10, D12–D14 complete via cron response. **D11** (admin panel parity) — record on next page load before Day 2.

**Evidence:** Terminal / PowerShell `Invoke-RestMethod` output; optional Vercel log filter `notification_retention_dry_run` for same `asOf` window.

---

## Safe commands

### PowerShell — manual cron dry-run

Set variables once per session (use production domain and secret from Vercel / password manager — **never commit secrets**):

```powershell
$CronSecret = $env:CRON_SECRET   # or paste locally for one-off run
$BaseUrl    = "https://YOUR_PRODUCTION_DOMAIN"
$Uri        = "$BaseUrl/api/cron/cleanup-notification-retention"

$response = Invoke-RestMethod `
  -Method POST `
  -Uri $Uri `
  -Headers @{
    "Authorization" = "Bearer $CronSecret"
    "Content-Type"  = "application/json"
  } `
  -Body '{"source":"manual-soak"}'

$response | ConvertTo-Json -Depth 10
```

**Quick invariant checks:**

```powershell
$response.ok
$response.dryRun      # must be $true
$response.deleted     # must be 0
$response.eligible.metricsHourly.olderThanPolicy
$response.oldestEligible.metricsHourly
```

**Save JSON to file:**

```powershell
$response | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 "retention-dry-run-$(Get-Date -Format 'yyyy-MM-dd').json"
```

**401 troubleshooting:** `CRON_SECRET` on Vercel must match Bearer token; no trailing newline in secret.

### Bash (reference)

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source":"manual-soak"}' \
  "https://YOUR_PRODUCTION_DOMAIN/api/cron/cleanup-notification-retention" | jq .
```

### Supabase SQL — same as scheduled pg_cron

```sql
select public.invoke_notification_retention_dry_run_http();
```

Verify job:

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'notification-retention-dry-run-daily';
```

### Vercel logs

Filter production logs for: `notification_retention_dry_run`

Confirm log payload includes `dryRun: true`, `deleted: 0`, and eligible/protected counts (no row IDs, no payloads).

---

## Expected JSON fields

### Required invariants (every successful run)

| Field | Expected | If wrong |
|-------|----------|----------|
| `ok` | `true` | Investigate 5xx / auth |
| `dryRun` | `true` | **NO-GO** — do not implement 5I-β |
| `deleted` | `0` (number) | **NO-GO** — possible wrong deployment |
| `asOf` | ISO timestamp | Record for log table |

### Metrics-hourly (5I-β focus)

| JSON path | Meaning | Expected during soak |
|-----------|---------|----------------------|
| `eligible.metricsHourly.olderThanPolicy` | Rows with `bucket_start < now − 13 months` | Usually **`0`** until table has been live **>13 months** |
| `oldestEligible.metricsHourly` | Oldest bucket in eligible set | **`null`** when eligible is 0; else ISO date of oldest bucket |

**When eligible > 0:** `oldestEligible.metricsHourly` should be **≥13 months** before `asOf` (by policy). Cross-check in SQL:

```sql
select count(*) as eligible,
       min(bucket_start) as oldest_bucket
from public.notification_metrics_hourly
where bucket_start < (now() at time zone 'utc') - interval '13 months';
```

Note: SQL `interval '13 months'` may differ slightly from app `subtractMonths` at month boundaries — **app dry-run count is authoritative** for 5I-β; SQL is advisory.

### Policy reference (defaults)

| Field | Default |
|-------|---------|
| `policy.metricsMonths` | `13` |
| `policy.outboxLiveSentDays` | `90` |
| `policy.outboxDryRunSentDays` | `60` |
| `policy.outboxFailedMaxDays` | `365` |
| `policy.outboxUnsupportedPendingDays` | `180` |
| `policy.workerRunsDays` | `90` |
| `policy.requeueShieldDays` | `30` |

### Outbox columns for spike detection

Record daily; flag if day-over-day jump is unexplained:

| JSON path | Label on admin UI |
|-----------|-------------------|
| `eligible.outbox.liveSentOlderThanPolicy` | Live sent (older than policy) |
| `eligible.outbox.dryRunSentOlderThanPolicy` | Dry-run sent (older than policy) |
| `eligible.outbox.failedOlderThanPolicy` | Failed (past max retention) |
| `eligible.outbox.unsupportedPendingOlderThanPolicy` | Unsupported pending (older than policy) |
| `protected.outbox.pendingDeliverable` | Pending deliverable |
| `protected.outbox.processing` | Processing |
| `protected.outbox.failedWithinRetention` | Failed within retention |
| `protected.outbox.requeueShieldRecent` | Recent requeue shield |

### Worker runs (future 5I-γ; record now)

| JSON path | Expected trend |
|-----------|----------------|
| `eligible.workerRuns.olderThanPolicy` | Grows as history accumulates |
| `eligible.workerRuns.eligibleWithRollupCoverage` | ≤ `olderThanPolicy` |
| `eligible.workerRuns.protectedMissingRollup` | Should **decrease** as rollup backfill completes; sustained high = fix rollup before 5I-γ |

---

## Admin panel (`/admin/notifications`)

### What to check

1. Sign in as **admin**.
2. Navigate to **`/admin/notifications`**.
3. Scroll to section **“Retention dry-run”** (sky-bordered panel).
4. Confirm copy: **“Dry-run only — no data is deleted.”**
5. Confirm **no purge / delete buttons** in that section.

### Screenshot / checklist items

| UI element | Cron JSON path | Match rule |
|------------|----------------|------------|
| Hourly metrics (older than policy) | `eligible.metricsHourly.olderThanPolicy` | **Exact match** if page loaded within ~5 min of cron and queue unchanged |
| Oldest bucket hint under metrics card | `oldestEligible.metricsHourly` | Same date (UI shows `YYYY-MM-DD`) |
| Live / dry-run sent / failed / unsupported eligible | Same `eligible.outbox.*` paths | Same match rule |
| Worker runs (rollup-covered) | `eligible.workerRuns.eligibleWithRollupCoverage` | Same |
| Worker runs (missing rollup) | `eligible.workerRuns.protectedMissingRollup` | Same |
| Protected outbox four cards | `protected.outbox.*` | Same |

**Admin vs cron timing:** Admin read model calls `reportNotificationRetentionDryRun()` at **page load time**. Cron `asOf` is **trigger time**. Small differences are normal if the outbox queue moved between runs. **Large mismatches** on the same day without queue activity = **NO-GO**.

**Recommended parity workflow:**

1. Run PowerShell cron POST.
2. Within 5 minutes, hard-refresh `/admin/notifications`.
3. Compare metrics + outbox eligible + protected cards to saved JSON.

### What to archive

- Screenshot of full **Retention dry-run** panel with URL bar visible.
- Same-day cron JSON file.
- Optional: 7-day trends section showing rollup not stale (context for future worker-run purge).

---

## Behavioral unchanged checks

Confirm during soak (no automated test required; ops judgment):

| Area | Expected | Evidence |
|------|----------|----------|
| **RLS** | Admins SELECT only on notification ops tables; no new DELETE grants on metrics | No migration between soak start/end except dry-run cron |
| **Worker** | Outbox processing continues; 24h cards update | `/admin/notifications` worker health |
| **Requeue** | Admin requeue still works; shield count may spike after requeue | Audit + shield protected count |
| **Rollup** | Hourly metrics cron populates buckets | `rollupCoverage` / 7d trends footnote |
| **Cron route** | Only counts; no DELETE in codebase for retention route | `deleted: 0` every run |

---

## Sign-off criteria (GO for 5I-β implementation)

All must be true:

| # | Criterion |
|---|-----------|
| S1 | **≥ 3 consecutive daily** dry-run runs completed and logged |
| S2 | Every run: **`dryRun: true`** and **`deleted: 0`** |
| S3 | **`metricsHourly` eligible count** is **expected** for table age (usually **0** if rollups &lt; 13 months old; if &gt; 0, oldest bucket date aligns with 13mo policy) |
| S4 | **No outbox purge surprise** — eligible outbox categories stable or slowly increasing; no unexplained day-over-day spikes; protected counts match queue intuition |
| S5 | **Worker runs:** `eligibleWithRollupCoverage` ≤ `olderThanPolicy`; `protectedMissingRollup` not persistently high |
| S6 | **Admin panel** counts match cron JSON on at least one day per comparison workflow |
| S7 | **No auth/cron failures** (no 401/503 on dry-run POST; pg_cron warnings absent if using scheduler) |
| S8 | **Production owner approval** — named signatory below |

### Sign-off block (copy to ticket / PR)

```text
Stage 5I-β soak sign-off
Environment: Production — https://________________
Soak days: ____ / ____ / ____  (≥3 consecutive)
All runs dryRun=true, deleted=0: YES / NO
metricsHourly eligible (last day): ______  oldest: ______
Outbox surprises: NONE / describe: _______________
Admin/cron parity: PASS / FAIL
Rollup healthy: YES / NO
Approved to implement 5I-β metrics-only purge (code + flags, no prod enable): YES / NO

Signed: _________________________  Date: __________
Role: Production owner / on-call lead
```

---

## No-go criteria (STOP — do not implement 5I-β)

Stop soak and fix before any destructive work:

| # | Signal | Action |
|---|--------|--------|
| N1 | **`deleted` > 0** or `deleted` not a number | Wrong build or early 5I-β deployed — revert / disable flags |
| N2 | **`dryRun: false`** unexpectedly | Same as N1 |
| N3 | **Outbox eligible counts** spike without known backlog aging | Classification bug — fix 5I-α reporter |
| N4 | **Protected pending deliverable** or **processing** drops sharply day-over-day | Data loss or query bug |
| N5 | **Worker runs eligible** &gt; **olderThanPolicy** | Logic bug |
| N6 | **`protectedMissingRollup`** high for **≥3 days** | Fix rollup cron (5H-b) before any worker-run purge planning |
| N7 | **Admin panel mismatch** with cron on same-day comparison | Read-model drift |
| N8 | **Cron auth failure** (401) or **503** service role | Fix secrets / env before continuing |
| N9 | **Failed within retention** drops while failed queue unchanged | Count mismatch |
| N10 | **Unsupported pending eligible** jumps with no old templates | Template filter wrong |

---

## Post-soak next step

**Only after sign-off (all [GO criteria](#sign-off-criteria-go-for-5i-β-implementation)):**

1. **Implement** 5I-β per [stage-5i-beta-metrics-hourly-purge-design.md](../architecture/stage-5i-beta-metrics-hourly-purge-design.md):
   - `grant delete` on `notification_metrics_hourly` to `service_role` only
   - `purgeNotificationMetricsHourly()` + env flags
   - Extend same cron route (metrics-only when flags armed)
2. **Do not enable** production destructive flags on first deploy — ship code dark.
3. **Staging drill:** `NOTIFICATION_RETENTION_METRICS_MONTHS=3`, small batch, verify deletes match prior dry-run count.
4. **Production first enable:** conservative batch caps; one supervised run; confirm `eligible.metricsHourly` → 0 after purge.
5. **Continue** daily dry-run (or combined cleanup log) after first purge for regression monitoring.

**Still forbidden after 5I-β code ships (until later stages):** outbox purge, worker-run purge, audit purge, admin UI delete buttons, RLS changes beyond metrics `DELETE` grant to `service_role`.

---

## Quick reference — JSON response shape

```json
{
  "ok": true,
  "dryRun": true,
  "deleted": 0,
  "asOf": "2026-05-17T12:00:00.000Z",
  "policy": {
    "metricsMonths": 13,
    "outboxLiveSentDays": 90,
    "outboxDryRunSentDays": 60,
    "outboxFailedMaxDays": 365,
    "outboxUnsupportedPendingDays": 180,
    "workerRunsDays": 90,
    "requeueShieldDays": 30
  },
  "eligible": {
    "outbox": { "liveSentOlderThanPolicy": 0, "dryRunSentOlderThanPolicy": 0, "failedOlderThanPolicy": 0, "unsupportedPendingOlderThanPolicy": 0 },
    "workerRuns": { "olderThanPolicy": 0, "eligibleWithRollupCoverage": 0, "protectedMissingRollup": 0 },
    "metricsHourly": { "olderThanPolicy": 0 }
  },
  "protected": {
    "outbox": { "pendingDeliverable": 0, "processing": 0, "failedWithinRetention": 0, "requeueShieldRecent": 0 }
  },
  "oldestEligible": {
    "liveSent": null,
    "dryRunSent": null,
    "failedExpired": null,
    "unsupportedPending": null,
    "workerRuns": null,
    "metricsHourly": null
  }
}
```

---

## Audit metadata

| Item | Value |
|------|--------|
| Document | `docs/audits/stage-5i-beta-metrics-hourly-purge-soak-plan.md` |
| Code changes in this task | **None** |
| Cron / RLS / data changes | **None** |
| Minimum soak duration | **3 consecutive days** (5 recommended) |
