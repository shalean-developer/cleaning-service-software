# Auth enforcement gap map

This document records **intentional** gaps between the current foundation skeleton and production-grade auth, so we do not mistake scaffolding for completed security.

## Implemented (this phase)

- **Middleware** (`src/middleware.ts`): requires a valid Supabase session for `/customer`, `/admin`, `/cleaner` routes; redirects unauthenticated users to `/`. Loads `profiles.role` and blocks obvious cross-role path access (admin cannot open `/customer` as a customer session, etc.).  
- **Server layouts:** `requireProfileRole([...])` re-checks role on the server for each route group.  
- **`getCurrentUser()`:** resolves `auth.users` + `profiles` row for Server Components / actions.  
- **Command layer actor types:** separate from JWT claims; authorization uses explicit `actor` on each command plus optional run context (`actingCustomerId`, `actingCleanerId`).

## Gaps / risks

| Gap | Risk | Mitigation / next step |
|-----|------|-------------------------|
| RLS disabled on `public` tables | Data API could expose rows if anon key used incorrectly | Follow `docs/security/rls-plan.md`; keep service role server-only |
| No `profiles` row on first login | Middleware may redirect loops | Add signup trigger to insert `profiles` (SQL) + handle null profile |
| Middleware + layout double-query | Latency | Acceptable for foundation; cache profile in request context later |
| Admin cannot open `/customer` | Support workflows blocked | Add explicit impersonation feature with audit — not implemented |
| `NEXT_PUBLIC_*` keys in browser | Expected for Supabase; never ship service role | Enforce server-only module boundaries (`server-only` package) |
| Command executor in-memory default | No persistence until Supabase adapter lands | Wire RPC-backed backend for server actions |
| Cleaner/customer mapping in commands | `actingCleanerId` / `actingCustomerId` must be resolved server-side | Add resolver helpers querying `customers` / `cleaners` by `profile_id` |

## Non-goals (this phase)

- Full Clerk/Auth0 integration (see future marketplace auth phase).  
- Field-level authorization inside GraphQL-style APIs.  
- Rate limiting / bot protection at the edge.

## Definition of “RLS-ready”

- All `public` tables: RLS enabled.  
- No policy relies on editable JWT user metadata for authorization.  
- Booking status updates impossible for `authenticated` role on `bookings` table (only via RPC / service path).  
- Advisors clean on security lint.
