# Shalean Foundation vs Target Flow — Audit Report

**Date:** 2026-05-16  
**Project root:** `C:\Users\info\Cleaning Services Software`  
**Scope:** Foundation audit only (read-only). No production logic was changed.  
**Target reference:** Customer wizard → pricing → cleaner eligibility → payment → assignment → dashboards → completion → earnings/payouts.

---

## Executive summary

The repository is a **well-structured Next.js 16 + Supabase foundation** with a **strong booking lifecycle design on paper**: Postgres enums/tables, append-only audit, idempotent payment keys, and a typed `executeBookingCommand()` layer with Vitest coverage. **Almost none of the target diagram’s transactional surface area is wired end-to-end.**

What is real today:

- Next.js App Router layout with route groups for marketing, customer, cleaner, and admin.
- Two Supabase migrations defining core tables, indexes, FKs, and three `service_role`-only RPCs for payment finalization and generic transitions.
- In-memory booking command executor with guards, assignment offers, and optional earnings snapshot on completion.
- Auth scaffolding (middleware + `requireProfileRole`) that **degrades gracefully** when Supabase env vars are missing.

What is not real today (despite schema/comments suggesting future intent):

- Customer booking wizard, pricing engine, cleaner APIs, booking lock, Paystack initialize/webhook/verify, Supabase-backed command adapter, auto-assign, functional dashboards, payout lifecycle, or RLS.

**Verdict: B — Foundation partially matches, but key transactional modules are missing.**

The schema and command layer are ahead of the product wiring; the product path in the target diagram is still largely unimplemented.

---

## 1. Repository structure

### Present and organized

| Area | Path | Assessment |
|------|------|------------|
| Next.js app | `src/app/` | Route groups: `(marketing)`, `(customer)`, `(cleaner)`, `(admin)`; single API route `api/health` |
| Domain features | `src/features/` | `bookings` (substantial), `payments` / `assignments` / `earnings` / `notifications` / `recurring` (stubs) |
| Shared libs | `src/lib/` | `auth`, `database/types`, `supabase/server` |
| Supabase | `supabase/migrations/`, `supabase/config.toml`, `supabase/seed.sql` | Two migrations; seed is a no-op |
| Docs | `docs/` | Architecture, lifecycle, database plan, security plans, prior audit |
| Config | `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts` | Standard; scripts include `db:start`, `db:reset` |

`docs/architecture.md` (line 3) explicitly states the repo is **foundation-only** and that Supabase, Paystack, auth, and dashboards are **not wired yet** — this audit confirms that statement remains accurate for Paystack, wizard, and dashboards, while auth is **partially** scaffolded.

### Missing folders/modules (relative to target flow)

| Expected module | Status |
|-----------------|--------|
| Customer wizard UI | **Missing** — no `src/app/(customer)/.../book` or wizard steps |
| Pricing engine | **Missing** — no `src/features/pricing/` |
| Cleaner eligibility / availability | **Missing** — no `src/features/cleaners/` or availability tables |
| `src/app/api/booking/cleaners` | **Missing** |
| `src/app/api/cleaners/available` | **Missing** |
| Paystack routes (`initialize`, `webhook`, `verify`) | **Missing** |
| Booking lock / reservation | **Missing** |
| Supabase command adapter | **Missing** — only `InMemoryBookingCommandBackend` |
| Payouts | **Missing** — no `payouts` table or feature module |
| `docs/audits/` | **Present** (this file) |

### API surface today

Only one route handler exists:

```1:5:src/app/api/health/route.ts
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, service: "cleaning-services-software" });
}
```

---

## 2. Database foundation

**Migrations:**

- `supabase/migrations/20260515201500_core_foundation.sql` — enums, tables, indexes, audit append-only trigger
- `supabase/migrations/20260515203000_booking_command_layer.sql` — audit columns, idempotency index, RPCs

### Table coverage vs target

| Domain entity | Table | Status |
|---------------|-------|--------|
| Profiles / users | `profiles` → `auth.users` | **Implemented** |
| Customers | `customers` | **Implemented** |
| Cleaners | `cleaners` (`active` flag) | **Implemented** (no availability/service-area columns) |
| Services | `services` (`base_price_cents` only) | **Partial** — no bedrooms/bathrooms/frequency/add-on catalog |
| Bookings | `bookings` | **Implemented** |
| Payments | `payments` | **Implemented** |
| Payment events | `payment_events` | **Implemented** |
| Assignment offers | `assignment_offers` | **Implemented** |
| Earnings | `earning_lines` | **Partial** — ledger lines only, no payout batch table |
| Notifications | `notification_outbox` | **Implemented** (schema only) |
| Lifecycle audit | `booking_state_audit` | **Implemented** + append-only trigger |

### Enums vs target lifecycle

`booking_status` in migration (lines 11–21) includes: `draft`, `pending_payment`, `confirmed`, `pending_assignment`, `assigned`, `in_progress`, `completed`, `cancelled`, `payment_failed`.

**Gaps vs target diagram wording:**

| Target term | Foundation |
|-------------|------------|
| `payment_confirmed` | Uses **`confirmed`** instead |
| `offered` (booking-level) | **Not a booking status** — only `assignment_offers.status = offered` |
| `payout_ready` / `paid` | **Missing** from `booking_status` and schema |

### Indexes, FKs, timestamps

- **Indexes:** bookings (status+schedule, customer, cleaner), payments, assignment_offers, earning_lines, notification_outbox — present in `20260515201500_core_foundation.sql` (lines 242–266).
- **FKs:** profiles ↔ auth.users; customers/cleaners ↔ profiles; bookings ↔ customers/cleaners/services; payments/events/offers/audit ↔ bookings — present.
- **`created_at` / `updated_at`:** on all major tables except `earning_lines` (created_at only) and `booking_state_audit` (created_at only).
- **Idempotency:** `payments.idempotency_key` UNIQUE; `payment_events.provider_event_id` UNIQUE; partial unique on `booking_state_audit (booking_id, idempotency_key)` when key set.

### RLS readiness

**Not enabled.** Migration comments defer RLS on every table (e.g. `profiles` line 61–62). `docs/security/rls-plan.md` is a draft plan only. **Risk:** any client using the anon key against Supabase Data API would have no row protection until RLS ships.

### DB-level status protection

- **`booking_state_audit`:** UPDATE/DELETE forbidden by trigger (`forbid_booking_state_audit_mutation`, lines 224–236).
- **`bookings.status`:** **No trigger** blocking direct SQL updates. Protection is **application-level** (`executeBookingCommand`, `forbidBookingStatusInPatch`) plus documentation comments on `bookings.status` (lines 124–125).

---

## 3. Booking lifecycle foundation

### Target lifecycle

```
draft → pending_payment → payment_confirmed/confirmed → pending_assignment
→ offered → assigned → in_progress → completed → payout_ready/paid
```

### Implemented command vocabulary

Typed commands in `src/features/bookings/server/commands/types.ts` (lines 14–27) map to most **booking** statuses, except auto-assign and payout states.

| Transition | Command | Enforced in guards | Persisted to Postgres via RPC |
|------------|---------|-------------------|-------------------------------|
| → `draft` | `CREATE_BOOKING_DRAFT` | Yes | **No** (in-memory only) |
| → `pending_payment` | `MARK_PAYMENT_PENDING` | Yes | **No** |
| → `confirmed` | `FINALIZE_PAYMENT_SUCCESS` | Yes | **Yes** (`booking_finalize_payment_success`) |
| → `payment_failed` | `MARK_PAYMENT_FAILED` | Yes | **Yes** (`booking_record_payment_failure`) |
| → `pending_assignment` | `MOVE_TO_PENDING_ASSIGNMENT` | Yes (+ paid payment gate) | **Partial** (`booking_apply_transition` exists but not wired from TS) |
| Offer (no booking status change) | `OFFER_TO_CLEANER` | Requires `pending_assignment` | **No** |
| → `assigned` | `ACCEPT_CLEANER_ASSIGNMENT` | Yes | **Partial** (`booking_apply_transition` with `p_cleaner_id`) |
| → `in_progress` | `MARK_IN_PROGRESS` | Yes | **Partial** |
| → `completed` | `MARK_COMPLETED` | Yes | **Partial** |
| → `cancelled` | `CANCEL_BOOKING` | Yes | **Partial** |
| Arbitrary | `ADMIN_OVERRIDE_STATUS` | Admin + reason | **No** (bypasses shape guards by design) |

### Command layer vs open updates

**Strengths:**

- Central executor: `src/features/bookings/server/commands/executeBookingCommand.ts`
- Transition guards: `bookingCommandGuards.ts` (`assertTransitionShape`, `nextStatusForCommand`)
- App-layer patch guard: `directMutationGuard.ts` throws on `{ status }` patches
- Repository scan (documented in `docs/audits/booking-lifecycle-enforcement-followup.md`) found **no** ad hoc `bookings.status` updates in application TS

**Weaknesses:**

- Production path still uses **`InMemoryBookingCommandBackend`** only — no `createSupabaseBookingCommandBackend`.
- Postgres can still `UPDATE bookings SET status = ...` outside RPCs (no RLS, no status trigger).
- `ADMIN_OVERRIDE_STATUS` can jump to `pending_assignment` **without** paid-payment invariant (see test at `executeBookingCommand.test.ts` lines 177–208).

### `offered` state

Target diagram implies a booking-level **offered** phase. Foundation models offers only on **`assignment_offers`**, while booking remains `pending_assignment` until accept → `assigned`. This is a **design delta**, not a blocker, but dashboards must not expect `bookings.status = offered`.

---

## 4. Customer booking wizard foundation

| Wizard step | Implementation |
|-------------|----------------|
| Service selection | **Missing** |
| Pricing calculation | **Missing** |
| Date/time | **Missing** (only fields on `CREATE_BOOKING_DRAFT` command) |
| Address/location | **Missing** (no address columns on `bookings`; only `metadata` jsonb) |
| Notes | **Missing** in booking flow (customer `notes` on `customers` table only) |
| Cleaner preference | **Missing** |
| Review | **Missing** |
| Checkout | **Missing** |

Customer surface is a placeholder page:

```7:20:src/app/(customer)/customer/page.tsx
export default function CustomerHomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm text-zinc-600">
        Customer booking area (foundation). Domain routes live under{" "}
        ...
      </p>
    </main>
  );
}
```

**Classification: missing** (command layer could create drafts if called from server code, but no wizard UX or server actions).

---

## 5. Pricing engine

| Capability | Status |
|------------|--------|
| Centralized pricing module | **Missing** — no `src/features/pricing/` |
| Service type | **Partial** — `services` table with `base_price_cents` |
| Bedrooms/bathrooms / size | **Missing** |
| Frequency | **Missing** |
| Add-ons | **Missing** |
| Team size | **Missing** |
| Final customer amount | **Partial** — `bookings.price_cents` set at draft creation only |
| Cleaner earnings preview | **Missing** |

**Classification: missing** (catalog stub only).

---

## 6. Cleaner eligibility and cleaner picker

| Capability | Status |
|------------|--------|
| `/api/booking/cleaners` | **Missing** |
| `/api/cleaners/available` | **Missing** |
| Cleaner `active` flag | **Schema only** (`cleaners.active`) |
| Availability schedules | **Missing** — no tables or queries |
| Service area / geo | **Missing** |
| Blocked/suspended exclusion | **Missing** (only `active` boolean) |
| Selected-cleaner path | **Partial** — `OFFER_TO_CLEANER` + `ACCEPT_CLEANER_ASSIGNMENT` in command layer |
| Best-available / auto-assign | **Missing** — no `assignBestCleaner`, no dispatch ranking |

`src/features/assignments/index.ts` is a one-line stub: *"matching cleaners to bookings (later)"*.

**Classification: missing** (assignment **commands** exist; eligibility **APIs and data model** do not).

---

## 7. Booking lock and payment initialization

| Capability | Status |
|------------|--------|
| Lock service/date/price/cleaner before pay | **Missing** — no lock table, TTL, or reservation RPC |
| `pending_payment` row via command | **Partial** — `MARK_PAYMENT_PENDING` in in-memory executor (`executeBookingCommand.ts` lines 149–200) |
| Paystack initialize route | **Missing** |
| Payment reference on `payments.provider_ref` | **Schema only** |
| Idempotency key | **Implemented** (DB unique + command) |
| Payment expiry | **Missing** — no `expires_at` on payments/bookings |
| Safe retry | **Partial** — idempotent `MARK_PAYMENT_PENDING` when same key + already `pending_payment` |

**Classification: partial** at data model; **missing** at API/product layer.

---

## 8. Paystack finalization foundation

| Target artifact | Current state |
|-----------------|---------------|
| Paystack webhook route | **Missing** |
| Paystack verify fallback | **Missing** |
| `finalizePaidBooking` (named) | **Missing** — equivalent behavior: `FINALIZE_PAYMENT_SUCCESS` command + `booking_finalize_payment_success` RPC |
| `upsertBookingFromPaystack` (named) | **Missing** — no Paystack-specific projection layer |
| Idempotent finalization | **Implemented** in command + RPC (audit `idempotency_key`) |
| Duplicate payment protection | **Partial** — payment idempotency key + event `provider_event_id` unique; no app handler |
| `pending_payment` → `confirmed` | **Implemented** in RPC (migration lines 175–212) and in-memory backend |

`src/features/payments/index.ts`:

```1:2:src/features/payments/index.ts
/** Payments feature — Paystack + idempotent webhooks (later). */
export {};
```

**Classification: partial** (domain command + DB RPC exist; **no Paystack integration**).

---

## 9. Assignment foundation

### A. Auto-assign path

| Item | Status |
|------|--------|
| `assignBestCleaner` | **Missing** |
| Booking → `assigned` only after safe assignment | **N/A** — no auto path |
| Ranking / dispatch scoring | **Missing** |

### B. Selected-cleaner path

| Item | Status |
|------|--------|
| `createDispatchOfferRow` (named) | **Partial** — `OFFER_TO_CLEANER` creates `assignment_offers` in memory |
| Offer visible to cleaner | **Missing** at API/UI |
| Accept before `assigned` | **Implemented** in command layer (`ACCEPT_CLEANER_ASSIGNMENT`, lines 331–374) |
| No silent `pending_assignment` trap | **Partial** — booking stays `pending_assignment` until accept; **no expiry job** for stale offers |

### Assignment offer schema

`assignment_offers` includes: `cleaner_id`, `booking_id`, `status`, `expires_at`, `offered_at`, `responded_at` — **implemented** in migration (lines 158–168). No DB trigger for expiry; no audit table for offer state changes.

**Classification: partial** (command + schema); **missing** (auto-assign, APIs, persistence adapter).

---

## 10. Dashboard foundation

| Dashboard | Route | Lifecycle UI | Booking details | Payment | Assignment | Completion |
|-----------|-------|--------------|-----------------|---------|------------|------------|
| Customer | `/customer` | **Stub** | **No** | **No** | **No** | **No** |
| Cleaner | `/cleaner` | **Stub** | **No** | **No** | **No** | **No** |
| Admin | `/admin` | **Stub** | **No** | **No** | **No** | **No** |

Read queries return empty:

```13:25:src/features/bookings/server/queries.ts
export async function getBookingById(
  _id: BookingId,
): Promise<BookingRecord | null> {
  void _id;
  return null;
}

export async function listBookingsForCustomer(
  _customerId: string,
): Promise<BookingRecord[]> {
  void _customerId;
  return [];
}
```

Layouts call `requireProfileRole` (good), but pages are placeholders.

**Classification: missing** for product dashboards; **partial** for route/auth shell.

---

## 11. Completion and earnings foundation

| Capability | Status |
|------------|--------|
| Cleaner marks completed | **Command only** — `MARK_COMPLETED` (cleaner-scoped when actor is cleaner) |
| Admin/customer confirmation | **Not modeled** — single-step completion |
| `completed` booking status | **Implemented** in enum + command |
| Earnings record creation | **Partial** — optional `recordEarningsSnapshot` on `MARK_COMPLETED` (explicit cents required) |
| Payout readiness / paid | **Missing** — no status, no payout table |
| Payout audit trail | **Missing** |
| R0 / unsafe earnings prevention | **Partial** — rejects negative cents; no server-side pricing-derived earnings |

`src/features/earnings/index.ts` is a stub. `earning_lines` has no payout linkage.

**Classification: partial** (completion command + ledger table); **missing** (payout lifecycle).

---

## 12. Security foundation

| Control | Status | Notes |
|---------|--------|-------|
| RLS on `public` tables | **Missing** | Deferred in migration |
| Auth role separation | **Partial** | `profiles.role` + middleware matcher (`src/middleware.ts` lines 46–54) |
| Customer sees own bookings only | **Not enforceable** | No RLS; queries stubbed |
| Cleaner sees assigned/offered only | **Not enforceable** | Same |
| Admin operations | **Partial** | Path guard only |
| Service role server-only | **Planned** | RPC grants to `service_role` only; **no service-role client module** in repo |
| Sensitive keys in client | **OK so far** | Only `NEXT_PUBLIC_SUPABASE_*` in `publicEnv.ts`; no Paystack secret in repo |

**Middleware gap:** If `getSupabasePublicEnv()` returns null, middleware **skips auth** and sets `x-auth-enforcement: disabled` (`middleware.ts` lines 10–12). Fine for local dev; **critical** if deployed without env.

**Classification: partial** (scaffolding); **high risk** without RLS before any real data.

---

## 13. Gap classification table

| Flow area | Target from diagram | Current implementation | Status | Risk | Recommended next step |
|-----------|---------------------|------------------------|--------|------|-------------------------|
| Repo layout | Feature-based Next + Supabase | Present; stubs for payments/assignments/earnings | **Partial** | Low | Add `features/pricing`, API route folders per diagram |
| DB core schema | Full entity model | 2 migrations, aligned TS types | **Implemented** | Low | Add address/pricing inputs + payout tables when designing product |
| DB RLS | Tenant isolation | Deferred, documented plan only | **Missing** | **Critical** | Enable RLS per `docs/security/rls-plan.md` before client reads |
| Lifecycle commands | Command-only status changes | In-memory executor + 3 RPCs | **Partial** | High | Ship `createSupabaseBookingCommandBackend` |
| DB status hardening | No ad hoc status updates | Audit trigger only; bookings unprotected | **Partial** | High | Deny `UPDATE status` for `authenticated`; route via RPC |
| Customer wizard | Multi-step book flow | Placeholder `/customer` page | **Missing** | High | Build wizard + server actions calling commands |
| Pricing engine | Central quote + earnings preview | `services.base_price_cents` only | **Missing** | High | Implement `features/pricing` + persist quote on draft |
| Cleaner APIs | `/api/booking/cleaners`, `/api/cleaners/available` | None | **Missing** | High | Schema for availability + eligibility queries |
| Booking lock | Hold slot/price before pay | None | **Missing** | High | Lock record or transactional draft + expiry |
| Paystack init | Initialize + reference | None | **Missing** | **Critical** | API route + `MARK_PAYMENT_PENDING` + `provider_ref` |
| Paystack webhook/verify | Finalize payment | RPC + command exist, no HTTP | **Partial** | **Critical** | Webhook → `FINALIZE_PAYMENT_SUCCESS` with event idempotency |
| Payment finalization helpers | `finalizePaidBooking`, `upsertBookingFromPaystack` | Unnamed equivalents in command/RPC | **Partial** | Medium | Thin Paystack adapter naming + `payment_events` insert |
| Auto assign | `assignBestCleaner` | None | **Missing** | High | Assignment service + command after `pending_assignment` |
| Dispatch offer | `createDispatchOfferRow` | `OFFER_TO_CLEANER` in-memory | **Partial** | Medium | Persist offers; cleaner accept API |
| Dashboards | Lifecycle views per role | Stub pages, null queries | **Missing** | Medium | Wire queries + status labels from `BOOKING_STATUSES` |
| Completion | Mark complete + confirm | `MARK_COMPLETED` command | **Partial** | Medium | UI + optional confirmation step |
| Earnings/payout | payout_ready → paid | `earning_lines` only | **Missing** | High | Payout batch table + statuses + guards |
| Notifications | Outbox on transitions | In-memory enqueue in executor | **Stub** | Low | Worker for `notification_outbox` |
| Auth | Session + role paths | Middleware + layouts | **Partial** | Medium | Profile bootstrap trigger; fail closed in prod |
| Tests | Lifecycle invariants | 8 Vitest tests, in-memory | **Partial** | Low | Integration tests against `supabase db reset` |

---

## 14. Recommended implementation order

1. **Supabase command adapter** — Map each `BookingCommand` to RPC/SQL; stop using in-memory backend in server code (`docs/architecture/booking-command-execution-layer.md` lines 42–44).
2. **RLS + deny direct booking status updates** — Implement `docs/security/rls-plan.md`; block `authenticated` from patching `bookings.status`.
3. **Paystack** — Initialize route → `MARK_PAYMENT_PENDING`; webhook/verify → `FINALIZE_PAYMENT_SUCCESS` / `MARK_PAYMENT_FAILED`; write `payment_events`.
4. **Pricing engine** — Quote service inputs; store breakdown in `bookings.metadata`; earnings preview for cleaner path.
5. **Cleaner eligibility APIs** — Availability/service-area schema + `/api/booking/cleaners` and `/api/cleaners/available`.
6. **Customer wizard** — Steps through draft → lock → checkout; call commands from server actions only.
7. **Assignment** — Selected-cleaner offers (persisted) + `assignBestCleaner` auto path with explicit `assigned` transition.
8. **Dashboards** — Replace stub queries; show payment + assignment + lifecycle labels.
9. **Completion & payouts** — Extend enum or payout table for `payout_ready` / `paid`; batch payouts with audit.

---

## 15. Final verdict

### **B. Foundation partially matches, but key transactional modules are missing**

**Rationale:** The database schema, lifecycle enum alignment, idempotency constraints, booking command vocabulary, and payment-finalization RPCs are genuine foundation work — not an empty repo. However, the **target diagram’s operational path** (wizard → pricing → cleaner APIs → lock → Paystack → dashboards → payouts) is **largely unbuilt**. The authoritative executor does not persist to Supabase yet; RLS is off; Paystack and cleaner endpoints are absent.

Do **not** treat this codebase as production-ready for customer bookings or payments without completing the gaps above.

---

## Appendix: Test and tooling signal

- `npm test` — **8 tests passed** (`executeBookingCommand.test.ts`) — guards, idempotency, payment gate, admin audit, double-accept, patch guard.
- `supabase/seed.sql` — `select 1;` only (no fixture data).
- README — generic create-next-app text; does not describe Shalean domain (drift from `docs/architecture.md`).

---

*Audit performed read-only. No application or migration files were modified.*
