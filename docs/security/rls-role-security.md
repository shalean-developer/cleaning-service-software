# RLS and role security (Phase 2)

Row Level Security is enabled on all foundation transactional tables. Authorization uses `profiles.role` and FK joins (`customers.profile_id`, `cleaners.profile_id`) — never `user_metadata` for access control.

**Migration:** `supabase/migrations/20260516160000_rls_role_security.sql`

## Access matrix

| Table | anon | customer | cleaner | admin | service_role |
|-------|------|----------|---------|-------|--------------|
| `profiles` | — | select/update own | select/update own | select/update (incl. others via admin path) | bypass RLS |
| `customers` | — | select/update own | — | full | bypass |
| `cleaners` | — | — | select/update own | full | bypass |
| `services` | select active catalog | select active (+ admin all) | same | full write | bypass |
| `bookings` | — | select/update own (no status change) | select assigned/offered | full | bypass + RPC |
| `payments` | — | select own booking | — | full | bypass + RPC |
| `payment_events` | — | select own payment chain | — | full | bypass |
| `assignment_offers` | — | select own booking offers | select/update own offers (response fields only) | full | bypass |
| `earning_lines` | — | — | select own | full | bypass |
| `notification_outbox` | — | — | — | full | bypass |
| `booking_state_audit` | — | select own bookings | select involved bookings | select all | insert via RPC |

## Booking status protection

1. **Trigger `guard_booking_status_change`** — any session with `auth.uid()` set cannot change `bookings.status` on INSERT/UPDATE.
2. **Command path** — `booking_apply_transition`, `booking_finalize_payment_success`, and `booking_record_payment_failure` run as `security definer` and are granted **only to `service_role`**. The app calls them from `SupabaseBookingCommandBackend` using the server-only service role client.
3. **Application guard** — `bookingStatusMutationGuard.test.ts` blocks direct `status` patches in TypeScript outside approved adapters.

Customers may update non-status booking fields on their own rows (e.g. draft metadata) where policies allow; lifecycle status changes remain server-only.

## Assignment offer cleaner updates

Trigger `guard_assignment_offer_cleaner_update` allows cleaners to change only `status` and `responded_at` on their own offers. `booking_id`, `cleaner_id`, and timing fields cannot be changed from an authenticated cleaner session.

## Auth helpers (SQL)

| Function | Purpose |
|----------|---------|
| `auth_profile_id()` | `auth.uid()` |
| `auth_is_admin()` | `profiles.role = 'admin'` |
| `auth_customer_id()` | `customers.id` for current profile |
| `auth_cleaner_id()` | `cleaners.id` for current profile |
| `customer_owns_booking(uuid)` | Customer scope check |
| `cleaner_can_access_booking(uuid)` | Assigned or offered booking |

All helpers are `security definer` with `search_path = public` to avoid policy recursion.

## Client usage

| Client | Use for |
|--------|---------|
| User session (`@/lib/supabase/server`) | RLS-scoped reads in Server Components |
| Service role (`@/lib/supabase/serviceRole`) | `executeBookingCommand`, webhooks, admin batch jobs |

Never import the service role module from client bundles.

## Verification

### Automated (Vitest)

`src/tests/security/rls-policies.integration.test.ts` — requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (for remote) `BOOKING_COMMAND_RUN_REMOTE_INTEGRATION=true`.

### SQL checklist

`supabase/tests/rls_role_security_checks.sql` — confirms RLS enabled and lists policies.

## Remaining risks

- **Middleware without env** still sets `x-auth-enforcement: disabled` when public Supabase env is missing (production should require env).
- **Admin impersonation** not implemented; admins cannot use customer routes without a separate feature.
- **Column-level booking updates** for customers are not restricted beyond status; tighten in a later phase if only specific draft fields should be editable.
- **RLS on `auth.users`** is managed by Supabase; profile bootstrap remains in `20260516150000_auth_profile_bootstrap.sql`.

## Related docs

- [RLS plan (draft)](rls-plan.md) — original intent; Phase 2 implements this migration.
- [Booking command execution layer](../architecture/booking-command-execution-layer.md)
- [Auth enforcement gap map](auth-enforcement-gap-map.md)
