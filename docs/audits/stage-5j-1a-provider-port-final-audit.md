# Stage 5J-1a Final Audit — Notification Provider Port Refactor

**Date:** 2026-05-17  
**Auditor:** Automated code + test verification  
**Scope:** Provider abstraction only — no new delivery features  
**Design reference:** [stage-5j-notification-provider-abstraction-failover-design.md](../architecture/stage-5j-notification-provider-abstraction-failover-design.md)

---

## Executive verdict

| Question | Answer |
|----------|--------|
| Is 5J-1a complete? | **Yes** |
| Safe to proceed to 5J-2 (outbox provider lineage)? | **Yes** — design and implement lineage **before** enabling failover (per master 5J plan) |
| Delivery behavior unchanged? | **Yes**, with one **documented intentional** readiness fix (Postmark token no longer implies `providerReady`) |

---

## Audit checklist

| # | Check | Result | Evidence |
|---|--------|--------|----------|
| 1 | `NotificationEmailProviderPort` exists | **Pass** | `notificationEmailProviderTypes.ts` — `providerName`, `isReady()`, `send()` |
| 2 | `DryRunProvider` preserves dry-run behavior | **Pass** | `dryRunProvider.ts` — no HTTP; `messageId` = `dry_run_{timestamp}`; `dryRunDelivery.ts` unchanged; worker dry-run tests pass |
| 3 | `ResendProvider` preserves Resend behavior | **Pass** | `resendProvider.ts` — same Resend SDK call, missing-config fail-closed, same error messages |
| 4 | Factory selects one provider only | **Pass** | `notificationEmailProviderFactory.ts` — `resolveActiveNotificationEmailProvider()` returns `dryRunProvider` **or** `resendProvider` via `resolveNotificationEmailProvider()` |
| 5 | No failover chain | **Pass** | No `PROVIDER_CHAIN`, orchestrator, or secondary send path in `src/` |
| 6 | No Postmark SDK | **Pass** | `package.json` — `resend` only; no `postmark` import in `src/` |
| 7 | No circuit breaker side effects | **Pass** | No circuit state, counters, or skip-send logic in worker/providers |
| 8 | `classifyProviderFailure` matches old retry behavior | **Pass** | Same rules as former `classifySendError()` (rate limit, timeout, 503 → retry; invalid email / domain → terminal; default → retry); table tests in `classifyProviderFailure.test.ts` |
| 9 | `processNotificationOutbox` behavior unchanged | **Pass** | File still uses `resolveNotificationEmailSender()`; claim/send/dedupe/reclaim/mark failure logic untouched; 30+ worker tests pass |
| 10 | Cron JSON shape unchanged | **Pass** | `route.ts` returns same keys: `ok`, `deliveryEnabled`, `emailProvider`, `reclaimed`, `scanned`, `sent`, `skipped`, `dryRun`, `failed`, `errors`, `dryRunPreviews`; route tests pass |
| 11 | Admin banner does not treat Postmark as Resend readiness | **Pass** | `config.ts` L108–109: `providerReady` = `dry_run` OR (`fromEmail` && `resendKey`) only; banner shows “Resend only” + `resendConfigured`; `config.test.ts` asserts Postmark-only → not ready |
| 12 | No outbox schema/migration changes | **Pass** | No `delivery_provider` / `provider_message_id` columns; no 5J migration files; latest migration remains retention cron (`20260519103000_*`) |
| 13 | No worker/requeue/RLS/template changes | **Pass** | `adminRequeueNotificationOutbox.ts`, templates, RLS migrations unchanged in this slice |
| 14 | Tests pass | **Pass** | See § Test run |
| 15 | Docs updated | **Pass** | `notification-outbox-worker.md`, `stage-5j-*.md` (5J-1a status section) |

---

## Architecture verification

### Provider port (Check 1)

```23:27:src/features/notifications/server/notificationEmailProviderTypes.ts
export interface NotificationEmailProviderPort {
  readonly providerName: NotificationEmailProviderName;
  isReady(): boolean;
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
```

`NotificationEmailProviderName` is `"dry_run" | "resend"` only — no `postmark`.

### Factory — single provider (Checks 4–5)

```11:22:src/features/notifications/server/notificationEmailProviderFactory.ts
export function resolveActiveNotificationEmailProvider(): NotificationEmailProviderPort {
  const mode = resolveNotificationEmailProvider();
  if (mode === "dry_run") {
    return dryRunProvider;
  }
  return resendProvider;
}

export function resolveNotificationEmailSender(): EmailSender {
  const provider = resolveActiveNotificationEmailProvider();
  return (params) => provider.send(params);
}
```

Mode resolution remains in `config.ts` (`resolveNotificationEmailProvider`) — same env rules as pre-5J-1a.

### Dry-run path (Check 2)

| Behavior | Pre-5J-1a | Post-5J-1a |
|----------|-----------|------------|
| No Resend HTTP | Yes | Yes (`DryRunProvider.send`) |
| `NOTIFICATION_DRY_RUN_MARK_SENT` | `dryRunDelivery.ts` | Unchanged |
| `dryRunPreviews` in cron response | Worker | Unchanged |
| Preview metadata `dry_run_sent;…` | `dryRunDelivery.ts` | Unchanged |

### Resend path (Check 3)

| Behavior | Status |
|----------|--------|
| `resend.emails.send({ from, to, subject, html, text })` | Preserved |
| Missing key/from → `{ ok: false, error: "Email provider is not configured.", retryable: false }` | Preserved |
| Success → `messageId` from `data.id` | Preserved |
| API error / catch → `retryable` via classifier | Preserved |

### Failure classification (Check 8)

`classifyProviderFailure()` in `classifyProviderFailure.ts` is byte-for-byte equivalent to the former inline `classifySendError()` logic. Worker still consumes only `sendResult.retryable` — no new branching.

### Worker integration (Check 9)

`processNotificationOutbox.ts`:

- Imports `resolveNotificationEmailSender` from `sendEmail` (unchanged entry point).
- Injects `options.emailSender ?? resolveNotificationEmailSender()` (unchanged).
- Uses `sendResult.ok`, `.error`, `.retryable` only — optional `provider` on result is ignored.

No edits to `markOutboxFailure`, dedupe helpers, reclaim, or batch size.

### Cron response (Check 10)

`GET/POST /api/cron/process-notification-outbox` still serializes `ProcessNotificationOutboxResult` fields only. No new provider-health or failover fields.

### Intentional delta — readiness (Check 11)

**Not a regression:** Pre-5J-1a, `providerReady` could be `true` with only `POSTMARK_SERVER_TOKEN` + `NOTIFICATION_FROM_EMAIL` while sends still required `RESEND_API_KEY`. That was a misconfiguration trap (noted in 5C-1 audits).

Post-5J-1a:

```108:109:src/features/notifications/server/config.ts
  const providerReady =
    emailProvider === "dry_run" || Boolean(fromEmail && resendKey);
```

Deployments that incorrectly relied on Postmark token for readiness will now correctly show **not ready** until Resend is configured — aligned with actual send capability.

### Outbox / RLS / requeue (Checks 12–13)

| Area | 5J-1a change |
|------|----------------|
| `notification_outbox` schema | None |
| RLS policies | None |
| `adminRequeueNotificationOutbox` | None |
| Email templates (`templates/*`) | None |
| Cron route auth/handler flow | None |

---

## Negative checks (must be absent)

| Item | `src/` search | Result |
|------|---------------|--------|
| Postmark SDK import | `postmark` in `src/` | **None** |
| Failover orchestrator | `failover`, `PROVIDER_CHAIN` | **None** (UI copy only) |
| Circuit breaker | `circuitBreaker`, circuit state mutation | **None** |
| Outbox lineage columns in code | `delivery_provider`, `provider_message_id` | **Design doc only** |

---

## Test run (Check 14)

Commands executed during audit:

```bash
npm run typecheck
npx vitest run \
  src/features/notifications/server/sendEmailProvider.test.ts \
  src/features/notifications/server/notificationEmailProviderFactory.test.ts \
  src/features/notifications/server/classifyProviderFailure.test.ts \
  src/features/notifications/server/config.test.ts \
  src/features/notifications/server/processNotificationOutbox.test.ts \
  src/app/api/cron/process-notification-outbox/route.test.ts \
  src/components/dashboard/AdminNotificationDeliveryBanner.test.tsx
```

| Suite | Result |
|-------|--------|
| Typecheck (`tsc --noEmit`) | **Pass** |
| Vitest (7 files) | **61 / 61 pass** |

Coverage highlights:

- Dry-run does not call Resend mock
- Resend configured / fail-closed paths
- Factory env selection (`dry_run` vs `resend`)
- Classifier table cases
- Postmark-only env → `providerReady` false
- Full worker batch (dedupe, retryable failure, dry-run mark-sent)
- Cron auth + JSON sanitization (no `@` in body)
- Banner Resend-only + deferred Postmark/failover copy

---

## Documentation (Check 15)

| Document | Update |
|----------|--------|
| `docs/operations/notification-outbox-worker.md` | 5J-1a provider port section; Postmark deferred |
| `docs/architecture/stage-5j-notification-provider-abstraction-failover-design.md` | Status + implementation table for 5J-1a |

---

## Files introduced (reference)

| File | Role |
|------|------|
| `notificationEmailProviderTypes.ts` | Port + shared types |
| `dryRunProvider.ts` | Dry-run adapter |
| `resendProvider.ts` | Resend adapter |
| `notificationEmailProviderFactory.ts` | Single-provider factory |
| `classifyProviderFailure.ts` | Centralized classifier |
| `sendEmail.ts` | Thin public facade (backward-compatible exports) |

---

## Risks and follow-ups before 5J-3+

| Risk | Mitigation in 5J-2 |
|------|-------------------|
| Crash after Resend accept but before `sent` → duplicate on retry | Persist `provider_message_id` + `delivery_provider` before marking `sent` |
| Failover without lineage | Do **not** enable failover until 5J-2 migration ships |
| Stale 5C audits citing Postmark in `providerReady` | Treat as superseded by this audit for readiness semantics |

---

## Final question

**Is Stage 5J-1a complete and safe enough to move to 5J-2 outbox provider lineage?**

**Yes.**

5J-1a delivers the provider port, factory, and classifier without failover, Postmark, circuit breaking, or schema changes. The only deliberate behavior adjustment is **correcting** Resend readiness (excluding unwired Postmark token), which reduces operational risk.

**Recommended next step:** **5J-2** — design is already outlined in the master 5J doc (add `delivery_provider`, `provider_message_id`, `provider_accepted_at` to `notification_outbox`, write lineage on successful provider accept). Implement 5J-2 before 5J-3 failover or 5J-4 Postmark.
