# Stage 5B-1 — Durable Admin Operational Audit (Final Audit)

**Date:** 2026-05-17  
**Scope:** Verify Stage 5B-1 additive audit storage was implemented safely without changing booking lifecycle, payment finalize, assignment accept semantics, earnings/payout commands, or `booking_state_audit`.  
**Type:** Audit only — no implementation changes in this pass.

**Related:** [stage-5a-security-governance-audit.md](./stage-5a-security-governance-audit.md), [stage-5b-1-durable-admin-operational-audit-design.md](../architecture/stage-5b-1-durable-admin-operational-audit-design.md), [admin-operational-audit.md](../operations/admin-operational-audit.md)

---

## Executive summary

| Check | Verdict |
|-------|---------|
| 1. Table schema | **Pass** — migration matches design |
| 2. RLS admin SELECT only | **Pass** (static); **live RLS unverified** (migration not applied to integration DB) |
| 3. Authenticated cannot I/U/D | **Pass** (static) |
| 4. Service role INSERT | **Pass** (static) |
| 5. Append-only trigger | **Pass** (static) |
| 6. Metadata sanitization | **Pass** (unit tests) |
| 7–9. Action instrumentation | **Pass** (code + Stage 4 unit tests) |
| 10. Insert failure non-blocking | **Pass** (unit tests + helper contract) |
| 11. Admin UI separation | **Pass** |
| 12. Customer/cleaner isolation | **Pass** |
| 13. `booking_state_audit` unchanged | **Pass** |
| 14. Sensitive domains unchanged by 5B-1 slice | **Pass** for 5B-1 files; **note** unrelated uncommitted worktree diffs exist |
| 15. No historical backfill documented | **Pass** |
| **Deploy readiness** | **Conditional go** — apply migration before/with app deploy; run RLS integration after migrate |
| **Next governance slice** | **5B-2 / 5B-3** (command actor / offer audit keys) before **5B-7** RLS narrowing |

---

## Before vs after

| Aspect | Before (Stage 4 / 5A) | After (Stage 5B-1) |
|--------|----------------------|-------------------|
| Admin recovery / dispatch / replace forensics | `console.warn` JSON only (`logAdmin*`) | Dual write: console log **unchanged** + `admin_operational_audit` row via service role |
| Queryable admin ops history | None in DB | Per-booking rows with action, outcome, reason, ids, status snapshots |
| Customer/cleaner visibility | N/A | No new exposure; table admin-SELECT-only |
| Lifecycle audit | `booking_state_audit` only | Unchanged schema and semantics |
| Admin booking detail UI | Single “State audit” timeline | **State audit** (lifecycle) + **Admin operations** (internal) |
| Failed audit persist | N/A | Admin action still completes; `admin_operational_audit_persist_failed` warning |

**Lifecycle behavior:** Admin commands still call the same assignment/booking command paths (`recoverAssignmentForBooking`, `createAdminDispatchOffer`, replace flow). Audit calls are `await` sidecars **after** eligibility/result resolution; `recordAdminOperationalAudit` never throws.

---

## Checklist (15 items)

### 1. `admin_operational_audit` exists with correct columns

**Pass.** Migration `supabase/migrations/20260518120000_admin_operational_audit.sql` defines:

- `id`, `booking_id`, `admin_profile_id`, `action`, `outcome`, `reason`, `result_code`
- `cleaner_id`, `offer_id`, `cancelled_offer_id`, `idempotency_key`
- `booking_status_before`, `booking_status_after`, `metadata`, `created_at`
- CHECK on `action` ∈ `assignment_recovery`, `manual_dispatch_offer`, `replace_open_offer`
- CHECK on `outcome` ∈ `success`, `idempotent`, `rejected`, `failed`

**Evidence:** `src/tests/database/admin-operational-audit.migration.test.ts` (8 tests, all passed).

### 2. RLS allows admin SELECT only

**Pass (static).** Policy `admin_operational_audit_select_admin` — `FOR SELECT TO authenticated USING (auth_is_admin())`. No other policies on the table.

### 3. Authenticated users cannot INSERT / UPDATE / DELETE

**Pass (static).** No `FOR INSERT/UPDATE/DELETE` policies for `authenticated`. Grants: `SELECT` to `authenticated` and `service_role`; `INSERT` to `service_role` only.

**Live verification:** `src/tests/security/admin-operational-audit.integration.test.ts` — **failed at setup** because `serviceClient.from("admin_operational_audit").insert(...)` returned `null` (table absent on linked Supabase project). Treat as **not run** until migration is applied.

### 4. Service role can INSERT

**Pass (static).** `grant insert on public.admin_operational_audit to service_role`.

**Runtime path:** `recordAdminOperationalAudit` uses the same service-role `SupabaseClient` passed from admin action handlers.

### 5. Append-only trigger blocks mutation

**Pass (static).** `forbid_admin_operational_audit_mutation()` + `BEFORE UPDATE OR DELETE` trigger `admin_operational_audit_append_only`.

### 6. Metadata sanitization prevents secrets / raw payloads

**Pass.** `sanitizeAdminOperationalMetadata` in `src/features/admin/server/recordAdminOperationalAudit.ts`:

- Denylist: `authorization`, `secret`, `token`, `password`, `card`, `signature`, `raw`, `payload`, `webhook`, `paystack`, plus substring checks
- Allowlist-only keys (e.g. `engine_outcome`, `eligible`, `open_offer_count`)
- Primitives only; strings capped at 200 chars; nested objects dropped

**Evidence:** `src/features/admin/server/recordAdminOperationalAudit.test.ts` — drops `authorization`, `token`, `raw`, unknown keys.

### 7. Assignment recovery writes audit rows

**Pass.** `adminAssignmentRecovery.ts` calls `auditAdminAssignmentRecovery` on all major exit paths (ineligible, already recovered, engine outcomes, errors, success). Sidecar maps to `action: assignment_recovery` and persists via `recordAdminOperationalAudit`.

**Evidence:** `adminAssignmentRecovery.test.ts` asserts `auditAdminAssignmentRecovery` invoked on success path (sidecar mocked).

### 8. Manual dispatch writes audit rows

**Pass.** `adminManualDispatchOffer.ts` — multiple `auditAdminManualDispatch` calls including `failNotEligible` helper.

**Evidence:** `adminManualDispatchOffer.test.ts` asserts sidecar called.

### 9. Replace open offer writes audit rows

**Pass.** `adminReplaceOpenOffer.ts` — seven `auditAdminReplaceOpenOffer` call sites.

**Evidence:** `adminReplaceOpenOffer.test.ts` (sidecar mocked; behavioral tests unchanged).

### 10. Audit insert failure does not break admin action

**Pass.** `recordAdminOperationalAudit`:

- Returns immediately if `client` is null
- Wraps insert in `try/catch`; logs `admin_operational_audit_persist_failed`; **never rethrows**

**Evidence:** Unit test “logs warning and does not throw when insert fails”. Admin action modules do not branch on audit return value.

### 11. Admin booking detail shows admin operations separately

**Pass.** `src/app/(admin)/admin/bookings/[bookingId]/page.tsx`:

- **State audit** — `AdminAuditTimeline` + `b.audits` (lifecycle)
- **Admin operations** — `AdminOperationalTimeline` + `b.operationalAudits` (amber-bordered section, explicit “admin-only” copy)

**Read model:** `getAdminBookingDetail` in `adminOperationsReadModel.ts` loads `admin_operational_audit` and maps to `operationalAudits`.

### 12. Customer / cleaner read models do not expose admin audit

**Pass.** Grep across `src/features/dashboards` and `src/app/(customer)` — no `operationalAudits` or `admin_operational_audit` outside admin paths. Customer detail still uses `booking_state_audit` only.

### 13. `booking_state_audit` was not changed

**Pass.** New migration contains no `ALTER` on `booking_state_audit`. Migration test explicitly asserts no modification. No changes in `src/features/admin/**` to lifecycle audit writers.

### 14. Payment finalize, earnings, payout commands, accept semantics, broad RLS — not changed by 5B-1

**Pass for the 5B-1 slice** (migration + `src/features/admin/**` + admin timeline + instrumentation sidecar + admin read-model fields):

- No references to `finalizePaidBooking`, payout commands, `executeBookingCommand` core, or accept routes in 5B-1-only files
- Migration does not alter existing RLS policies on other tables

**Repository caveat:** The working tree contains **uncommitted** changes on other tracks (e.g. `finalizePaidBooking.ts`, payment/assignment stages) that are **outside** the 5B-1 audit slice. Deploy 5B-1 as an isolated changeset: migration `20260518120000_*` + admin audit modules + read-model/UI wiring + tests/docs — not the full dirty working tree without review.

### 15. Docs explain no historical backfill

**Pass.**

- `docs/operations/admin-operational-audit.md` — “No backfill for actions that only existed in console logs before deploy”
- `docs/operations/admin-operational-dashboard.md` — cross-reference, same limitation

---

## Table / RLS summary

```text
admin_operational_audit
├── RLS: ON
├── SELECT: authenticated AND auth_is_admin()
├── INSERT: service_role (grant); no authenticated INSERT policy
├── UPDATE/DELETE: blocked by trigger (all roles)
├── Indexes: booking+created, admin+created, action+created
└── Partial UNIQUE (booking_id, idempotency_key) WHERE outcome IN (success, idempotent)
```

**Separation from lifecycle audit:**

| Table | Purpose | Customer/cleaner read |
|-------|---------|------------------------|
| `booking_state_audit` | Status transitions / commands | Yes (scoped by booking) |
| `admin_operational_audit` | Human admin ops | **No** (admin only) |

---

## Write helper behavior

| Function | Role |
|----------|------|
| `sanitizeAdminOperationalMetadata` | Allowlist + strip secrets before insert |
| `recordAdminOperationalAudit` | Service-role insert; fail-soft |
| `mapAdminOperationalOutcome` | Maps action result status → `success` \| `idempotent` \| `rejected` \| `failed` |
| `admin*IdempotencyKey` | Aligns with command-layer keys for success/idempotent rows only |
| `auditAdmin*` (sidecar) | `logAdmin*` then `recordAdminOperationalAudit` |

**Idempotency key rule:** Stored only when `outcome` is `success` or `idempotent` (matches partial unique index).

---

## Action instrumentation

| Action | Module | Sidecar | Exit paths audited |
|--------|--------|---------|-------------------|
| Assignment recovery | `adminAssignmentRecovery.ts` | `auditAdminAssignmentRecovery` | All major branches (≥8 call sites) |
| Manual dispatch | `adminManualDispatchOffer.ts` | `auditAdminManualDispatch` | Including `failNotEligible` |
| Replace open offer | `adminReplaceOpenOffer.ts` | `auditAdminReplaceOpenOffer` | Success, reject, error paths |

Console `logAdmin*` functions remain the first step inside the sidecar — operational log pipelines unchanged.

---

## UI / read model behavior

- **Admin booking detail:** Two sections; operational timeline shows action label, outcome, admin name, reason, codes, cleaner/offer refs, status before/after, sanitized metadata summary.
- **Admin list / queue:** Unchanged by 5B-1 (no global admin-audit search page — documented limitation).
- **Customer / cleaner:** No new fields; lifecycle timelines unchanged.

---

## Test evidence

| Command | Result |
|---------|--------|
| `npm run typecheck` | **Pass** |
| Targeted vitest (admin audit + Stage 4 admin actions + dashboard read model) | **63 passed**, 5 skipped |
| `admin-operational-audit.migration.test.ts` | 8/8 pass |
| `recordAdminOperationalAudit.test.ts` | pass |
| `mapAdminOperationalOutcome.test.ts` | pass |
| `adminAssignmentRecovery.test.ts` | pass (sidecar mocked) |
| `adminManualDispatchOffer.test.ts` | pass |
| `adminReplaceOpenOffer.test.ts` | pass |
| `dashboardReadModels.test.ts` | pass (`operationalAudits` mapping) |
| `admin-operational-audit.integration.test.ts` | **Setup failed** — table missing on integration Supabase (migration not applied) |

**Vitest command used:**

```bash
npx vitest run src/features/admin \
  src/tests/database/admin-operational-audit.migration.test.ts \
  src/tests/security/admin-operational-audit.integration.test.ts \
  src/features/assignments/server/adminAssignmentRecovery.test.ts \
  src/features/assignments/server/adminManualDispatchOffer.test.ts \
  src/features/assignments/server/adminReplaceOpenOffer.test.ts \
  src/features/dashboards/server/dashboardReadModels.test.ts
```

**Not run / out of scope:** Full suite; unrelated timeout failures (per instruction).

---

## Remaining risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration not applied before app deploy | **High** | Apply `20260518120000_admin_operational_audit.sql` first; verify insert + RLS integration |
| Best-effort audit — silent loss if DB down | **Low–medium** | Monitor `admin_operational_audit_persist_failed` in logs; alert in prod |
| No historical backfill | **Low** | Documented; pre-deploy ops only in stdout |
| Admin `FOR ALL` on other tables unchanged | **High (latent)** | Address in **5B-7** after 5B-2/5B-3 |
| Duplicate success rows if idempotency key omitted on new actions | **Low** | Partial unique index + helper conventions |
| 5B-1 files largely **uncommitted** in local tree | **Process** | Commit/deploy as coherent slice; avoid mixing unrelated WIP |

---

## Production rollout checklist

1. **Review diff** — deploy only 5B-1 paths (migration, `src/features/admin/**`, sidecar imports, `adminOperationsReadModel`, admin booking page, timeline component, types, tests, ops docs).
2. **Apply migration** on production/staging: `supabase db push` or equivalent for `20260518120000_admin_operational_audit.sql`.
3. **Verify table** — `\d admin_operational_audit`, RLS enabled, trigger present.
4. **Smoke test (staging)** — Run one recovery, one manual dispatch, one replace; confirm rows in `admin_operational_audit` and admin booking detail “Admin operations” section.
5. **RLS integration** — Re-run `admin-operational-audit.integration.test.ts` against migrated DB (admin read; customer/cleaner denied; authenticated insert/update/delete fail).
6. **Log watch** — No spike in `admin_operational_audit_persist_failed` after deploy.
7. **Communicate** — No backfill; investigations for pre-deploy actions still use historical stdout if retained.

---

## Rollback plan

| Step | Action |
|------|--------|
| 1 | Deploy previous app build (audit writes stop; console `logAdmin*` still work) |
| 2 | **Do not** drop table immediately if investigations may need rows |
| 3 | Optional later: `DROP TABLE admin_operational_audit` + migration revert only after confirming no compliance need for captured rows |
| 4 | No rollback needed for `booking_state_audit` — unaffected |

Rollback is **low risk** to lifecycle: removing the sidecar restores pre-5B-1 behavior (console-only).

---

## Final verdict

**Stage 5B-1 is safe to deploy** as an additive, read-isolated audit layer **provided**:

1. Migration is applied **before or with** the app release that calls `recordAdminOperationalAudit`.
2. The release artifact is scoped to the 5B-1 slice (not unreviewed payment/assignment WIP in the same working tree).
3. Post-migrate RLS integration tests are executed once on staging.

Lifecycle, payment finalize, accept semantics, earnings formulas, and payout commands are **not modified** by the 5B-1 implementation files themselves.

---

## Answers to final questions

### Is Stage 5B-1 safe to deploy?

**Yes — conditional.** The design and code review support a **conditional go**: additive table, admin-only read, service-role write, append-only enforcement, fail-soft writes, and separated UI. Blockers are **operational** (migrate first, commit coherent slice, verify RLS live), not architectural.

### Is RLS tightening the next safe governance slice?

**RLS narrowing (Stage 5B-7) is the right next *class* of hardening**, but per [stage-5a-security-governance-audit.md](./stage-5a-security-governance-audit.md) the **safest sequence** is:

1. **5B-1** — durable admin operational audit (**this slice**)
2. **5B-2** — tighten command actor policies
3. **5B-3** — assignment offer command audit / idempotency alignment
4. **5B-7** — narrow admin `FOR ALL` / split write policies (medium–high change risk)

Deploy **5B-1** first, then **5B-2 and 5B-3** before broad **5B-7** RLS surgery. RLS tightening alone does not replace the forensic value added here; conversely, this audit table does not remove the latent PostgREST bypass risk from admin `FOR ALL` on `payments`, `earning_lines`, and `assignment_offers`.

---

## Sign-off

| Role | Status |
|------|--------|
| Schema / RLS (static) | Verified |
| Application instrumentation | Verified |
| UI isolation | Verified |
| Automated tests | 63 pass; RLS integration pending migration |
| Lifecycle regression | No change identified in 5B-1 slice |
| **Recommendation** | **Deploy 5B-1 after migration; schedule 5B-2/5B-3 before 5B-7** |
