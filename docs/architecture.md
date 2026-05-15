# Architecture

This repository is a **foundation-only** Next.js (App Router) + TypeScript + Tailwind CSS monolith for a cleaning-services platform. **Supabase, Paystack, auth, and dashboards are intentionally not wired yet.**

## High-level layout

| Area | Path | Purpose |
|------|------|--------|
| Public marketing | `src/app/(marketing)` | SEO-first pages; route group does not change URLs. |
| Customer app | `src/app/(customer)` | Customer flows; URLs under `/customer/...` to avoid clashing with `/`. |
| Cleaner app | `src/app/(cleaner)` | Field/cleaner flows under `/cleaner/...`. |
| Admin app | `src/app/(admin)` | Operations under `/admin/...`. |
| HTTP APIs | `src/app/api` | Webhooks, health checks, thin handlers. |
| Domain logic | `src/features/*` | Feature modules shared by Server Actions and routes (when added). |

## Principles (locked in early)

1. **Route groups** separate product surfaces without coupling layouts to the same URL.
2. **Booking state** is modeled in TypeScript (`features/bookings/server`) and will later be enforced in Postgres + RLS; all transitions go through `executeBookingCommand()` (see `docs/architecture/booking-command-execution-layer.md`).
3. **Payments** will be idempotent at the edge (webhook dedupe + unique business keys) — see future `features/payments`.
4. **Earnings** will never trust the browser; ledger lives under `features/earnings` when implemented.
5. **Thin API routes**: handlers validate and delegate; business rules stay in feature `server/` modules.

## Next milestones (suggested order)

1. Supabase project + migrations mirroring `docs/database-plan.md`.
2. Supabase Auth + role claims; RLS policies per table.
3. Paystack webhooks + payment projection tables.
4. Server Actions per domain that call the same booking lifecycle + audit log.

## Observability

When deploying, add structured logging around lifecycle transitions and webhook handlers; keep correlation IDs on booking rows.
