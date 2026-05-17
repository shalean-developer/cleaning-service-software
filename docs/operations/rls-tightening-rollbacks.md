# RLS tightening — rollback reference

**Type:** Documentation only. Apply rollback SQL only when reverting a deployed RLS phase.

**Design:** [stage-5b-3-rls-tightening-design.md](../architecture/stage-5b-3-rls-tightening-design.md)

---

## Phase 1 (5B-3a) — payments admin write

**Forward migration:** `supabase/migrations/20260518140000_rls_payments_admin_select_only.sql`  
**Effect:** Drops `payments_admin_write`; keeps `payments_select_admin` and `payments_select_customer`.

### Rollback SQL (restore pre–5B-3a admin `FOR ALL` on payments)

```sql
-- Reverts 20260518140000_rls_payments_admin_select_only.sql
-- Source: 20260516160000_rls_role_security.sql

drop policy if exists payments_admin_write on public.payments;

create policy payments_admin_write on public.payments
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
```

### Verify after rollback

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_role_security_checks.sql
```

Expect `payments_admin_write` to appear again in the policy listing for `public.payments`.

---

## Phase 2 (5B-3b-a) — earning_lines admin write

**Forward migration:** `supabase/migrations/20260518150000_rls_earning_lines_admin_select_only.sql`  
**Effect:** Drops `earning_lines_admin_write`; keeps `earning_lines_select_admin` and `earning_lines_select_cleaner`.

### Rollback SQL (restore pre–5B-3b-a admin `FOR ALL` on earning_lines)

```sql
-- Reverts 20260518150000_rls_earning_lines_admin_select_only.sql
-- Source: 20260516160000_rls_role_security.sql

drop policy if exists earning_lines_admin_write on public.earning_lines;

create policy earning_lines_admin_write on public.earning_lines
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
```

### Verify after rollback

```bash
psql "$DATABASE_URL" -f supabase/tests/earning_lines_rls_phase3b_checks.sql
```

Expect `earning_lines_admin_write` to appear again in the policy listing for `public.earning_lines`.

---

## Phase 3 (5B-3c-a) — assignment_offers admin write

**Forward migration:** `supabase/migrations/20260518160000_rls_assignment_offers_admin_select_only.sql`  
**Effect:** Drops `assignment_offers_admin_write`; keeps `assignment_offers_select_admin`, `assignment_offers_select_cleaner`, `assignment_offers_select_customer`, and `assignment_offers_update_cleaner`.

### Rollback SQL (restore pre–5B-3c-a admin `FOR ALL` on assignment_offers)

```sql
-- Reverts 20260518160000_rls_assignment_offers_admin_select_only.sql
-- Source: 20260516160000_rls_role_security.sql

drop policy if exists assignment_offers_admin_write on public.assignment_offers;

create policy assignment_offers_admin_write on public.assignment_offers
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
```

### Verify after rollback

```bash
psql "$DATABASE_URL" -f supabase/tests/assignment_offers_rls_phase3c_checks.sql
```

Expect `assignment_offers_admin_write` to appear again in the policy listing for `public.assignment_offers`.

---

## Phase 4 (5B-3 Phase 4a) — payment_events + bookings admin write

**Forward migration:** `supabase/migrations/20260518170000_rls_payment_events_bookings_admin_select_only.sql`  
**Effect:** Drops `payment_events_admin_write` and `bookings_admin_write`; keeps all `SELECT` policies, `bookings_update_customer`, and `guard_booking_status_change`.

### Rollback SQL — payment_events_admin_write

```sql
-- Reverts payment_events portion of 20260518170000_rls_payment_events_bookings_admin_select_only.sql
-- Source: 20260516160000_rls_role_security.sql

drop policy if exists payment_events_admin_write on public.payment_events;

create policy payment_events_admin_write on public.payment_events
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
```

### Rollback SQL — bookings_admin_write

```sql
-- Reverts bookings portion of 20260518170000_rls_payment_events_bookings_admin_select_only.sql
-- Source: 20260516160000_rls_role_security.sql

drop policy if exists bookings_admin_write on public.bookings;

create policy bookings_admin_write on public.bookings
  for all to authenticated
  using (public.auth_is_admin())
  with check (public.auth_is_admin());
```

### Verify after rollback

```bash
psql "$DATABASE_URL" -f supabase/tests/payment_events_rls_phase4_checks.sql
psql "$DATABASE_URL" -f supabase/tests/bookings_rls_phase4_checks.sql
```

Expect both admin `FOR ALL` policies to appear again in `pg_policies`.

---

## Phase 5+ (not yet implemented)

Document rollbacks here when `booking_locks`, `payout_batches`, and other phases ship.
