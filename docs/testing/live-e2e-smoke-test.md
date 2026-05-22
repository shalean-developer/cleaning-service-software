# Live end-to-end smoke test (Phase 11)

Prove the transactional MVP against **real Supabase** and **Paystack test mode**. This is a **manual** checklist with helper scripts — not Playwright automation.

## Prerequisites

### Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL — **safe for browser** (sign-in, session cookies) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key — **safe for browser** |
| `SUPABASE_URL` | Yes | Same project URL as above; used by server scripts (can match `NEXT_PUBLIC_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Server-only** — seed, inspect scripts, booking commands; **never** import in client components or `NEXT_PUBLIC_*` |
| `PAYSTACK_SECRET_KEY` | Yes | `sk_test_…` for test mode |
| `PAYSTACK_WEBHOOK_SECRET` | Yes | From Paystack dashboard |
| `PAYSTACK_ENABLED` | Yes | `true` |
| `BOOKING_COMMAND_BACKEND` | Recommended | `supabase` on staging |
| `APP_BASE_URL` | Yes (Paystack return) | `http://localhost:3000` for local dev (must match running port) |
| `NEXT_PUBLIC_APP_URL` | Recommended | Same as `APP_BASE_URL` for wizard callback when client builds URL |

Copy `.env.example` to `.env.local` and fill all Supabase + Paystack + app URL variables before running the app or seed.

After seeding, `.env.local` will also contain `E2E_TEST_*` IDs (see below).

### Auth URLs (local / staging)

| URL | Purpose |
|-----|---------|
| `/sign-in` | Email/password login (all roles) |
| `/customer/book` | Customer booking wizard (after customer login) |
| `/cleaner/offers` | Cleaner assignment offers (after cleaner login) |
| `/admin/payouts` | Admin payout queue (after admin login) |
| `/payment/success` | Paystack return + automatic verify (after payment) |
| `/payment/failed` | Checkout cancelled / failed messaging |

Unauthenticated visits to `/customer`, `/cleaner`, or `/admin` redirect to `/sign-in?redirectedFrom=…`.

### Database

```bash
npx supabase db push
```

All foundation migrations through Phase 10 must be applied.

### Paystack test setup

1. Use a **test** secret key (`sk_test_…`).
2. Set `APP_BASE_URL=http://localhost:3000` (or your dev port) in `.env.local`.
3. **Production / staging:** configure webhook → `https://<your-host>/api/paystack/webhook`.
4. **Localhost:** webhook optional — after payment, Paystack redirects to `/payment/success`, which calls `/api/paystack/verify` automatically. No manual verify URL needed.
5. Optional: tunnel (ngrok) if you want to test webhook + return in parallel.

### Test cards (Paystack)

| Scenario | Card number | CVV | Expiry | OTP |
|----------|-------------|-----|--------|-----|
| Success | `4084084084084081` | `408` | any future | `123456` |
| Declined | `4084080000000408` | `408` | any future | — |

See [Paystack test cards](https://paystack.com/docs/payments/test-payments/).

---

## One-time seed

```bash
npm run e2e:seed
```

If sign-in shows “no profile was found”, re-run the seed or audit orphans:

```bash
npm run ops:audit:auth-profiles
npm run ops:repair:auth-profiles -- --e2e
```

Production accounts (e.g. `admin@shalean.com`) without a `profiles` row must be provisioned via admin service-role flows — never auto-promoted to admin.

Creates (idempotent, `test_e2e_*` prefix only):

| Entity | Email / marker |
|--------|----------------|
| Customer | `test_e2e_customer@shalean.co.za` |
| Cleaner | `test_e2e_cleaner@shalean.co.za` |
| Admin | `test_e2e_admin@shalean.co.za` |
| Password | `TestE2e!2026Shalean` (also in `.env.local`) |
| Cleaner area | `cape-town` (use suburb **Cape Town** in wizard) |
| Services | All six catalog services (ZAR) |
| Cleaner capabilities | All `serviceSlug` values |
| Availability | Mon–Sat 08:00–18:00 `Africa/Johannesburg` |

**Does not** delete or modify non-test data.

---

## Manual smoke checklist

Use a single booking and note `bookingId` after checkout for inspect scripts.

### 1. Customer login

- [ ] Open **`/sign-in`**
- [ ] Sign in as `test_e2e_customer@shalean.co.za` / `TestE2e!2026Shalean`
- [ ] Land on `/customer` (or `redirectedFrom` target if you were redirected from a protected URL)

**Expected DB:** `profiles.role = customer`, `customers.company_name = test_e2e_customer`

### 2. Booking wizard

- [ ] Open `/customer/book`
- [ ] Service: **Regular Cleaning**
- [ ] Suburb: **Cape Town** (normalizes to `cape-town`)
- [ ] Schedule: future date, **10:00** (within cleaner availability)
- [ ] Address fields completed

**Expected:** Quote displays; cleaner list or best-available option appears.

### 3. Pricing quote

- [ ] Note `totalCents` on review step
- [ ] Metadata will store `metadata.quote` snapshot on lock

**Expected API:** `GET /api/pricing/quote` or wizard-internal quote — positive ZAR total.

### 4. Cleaner selection

- [ ] Choose **best available** or select `test_e2e` cleaner if listed
- [ ] Proceed to checkout

**Expected:** `metadata.cleanerPreferenceMode` set; preferred cleaner id if selected.

### 5. Booking lock

- [ ] Complete checkout step → lock created before Paystack

**Expected DB:**

| Table | State |
|-------|--------|
| `bookings` | `status = pending_payment` |
| `payments` | `status = pending`, idempotency key set |
| `booking_locks` | active lock row |

```bash
npm run e2e:inspect:booking -- <bookingId>
```

### 6. Paystack test checkout

- [ ] Redirect to Paystack; pay with success test card
- [ ] Browser returns to **`/payment/success?reference=…`** automatically
- [ ] Page shows “Verifying payment…” then redirects to **`/customer/bookings/<bookingId>`**

### 7. Payment finalization (automatic on localhost)

- [ ] **No manual** `GET /api/paystack/verify?reference=…` required
- [ ] Booking moves to `confirmed` → `pending_assignment` (verify fallback or webhook)
- [ ] Optional: confirm webhook in Paystack dashboard logs if tunnel configured

**Expected DB:**

| Table | State |
|-------|--------|
| `bookings` | `confirmed` → `pending_assignment` (after assignment engine) |
| `payments` | `paid` |
| `payment_events` | row with provider event id |
| `booking_state_audit` | `FINALIZE_PAYMENT_SUCCESS`, `MOVE_TO_PENDING_ASSIGNMENT` |

### 8. Assignment offer

- [ ] Assignment engine runs after payment

**Expected DB:**

| Table | State |
|-------|--------|
| `assignment_offers` | `status = offered` for `E2E_TEST_CLEANER_ID` |
| `bookings` | `pending_assignment` |

```bash
npm run e2e:inspect:offers -- --booking <bookingId>
```

### 9. Cleaner accepts offer

- [ ] Sign out (dashboard header) or use a private window
- [ ] **`/sign-in`** → `test_e2e_cleaner@shalean.co.za` / `TestE2e!2026Shalean`
- [ ] **`/cleaner/offers`** → **Accept**

**Expected DB:**

| Table | State |
|-------|--------|
| `bookings` | `assigned`, `cleaner_id` = test cleaner |
| `assignment_offers` | `accepted` |

### 10. Cleaner starts job

- [ ] `/cleaner/jobs/<bookingId>` → **Start job**

**Expected:** `status = in_progress`, audit `MARK_BOOKING_IN_PROGRESS`

### 11. Cleaner completes job

- [ ] **Mark complete**

**Expected DB:**

| Table | State |
|-------|--------|
| `bookings` | `completed` |
| `earning_lines` | one `booking_completion` line, `payout_status = pending`, `payout_amount_cents > 0` |

```bash
npm run e2e:inspect:earnings -- --booking <bookingId>
```

### 12. Admin payout-ready

- [ ] Sign out → **`/sign-in`** → `test_e2e_admin@shalean.co.za` / `TestE2e!2026Shalean`
- [ ] `/admin/bookings/<bookingId>` → **Mark payout-ready**
- [ ] Optional: verify **`/admin/payouts`** lists the booking

**Expected:**

| Table | State |
|-------|--------|
| `bookings` | `payout_ready` |
| `earning_lines` | `payout_status = payout_ready` |

### 13. Admin paid out

- [ ] **Mark paid out**

**Expected:**

| Table | State |
|-------|--------|
| `bookings` | `paid_out` |
| `earning_lines` | `payout_status = paid` |

### 14. Dashboard verification

- [ ] Customer `/customer/bookings/<id>` — shows completed (no payout jargon)
- [ ] Cleaner `/cleaner/earnings` — shows earning row
- [ ] Admin `/admin/payouts` — totals reflect paid amount

---

## Helper scripts

| Command | Purpose |
|---------|---------|
| `npm run e2e:seed` | Create/update test users and cleaner eligibility |
| `npm run e2e:inspect:booking -- <bookingId>` | JSON snapshot: booking, payments, offers, audits, earnings |
| `npm run e2e:inspect:offers -- --booking <id>` | Offers for booking |
| `npm run e2e:inspect:offers -- --cleaner` | Offers for seeded cleaner |
| `npm run e2e:inspect:earnings -- --booking <id>` | Earnings for booking |
| `npm run e2e:inspect:earnings -- --cleaner` | All cleaner earnings |
| `npm run e2e:repair:assignments` | **Dry-run:** list orphaned E2E `pending_assignment` bookings (stale assignment metadata, no open offers) |
| `CONFIRM_ASSIGNMENT_REPAIR=yes npm run e2e:repair:assignments` | Re-run `runAssignmentAfterPayment` for those bookings (creates new offers for eligible cleaner) |

### Orphaned assignment repair

Use when admin assignment queue shows `pending_assignment` E2E bookings but the cleaner dashboard has **no open offers** — often after a cleaner row was deleted and `assignment_offers` cascaded away while `bookings.metadata.assignment` still says `offered`.

**Safety (default):**

- Targets only customers with `company_name` like `test_e2e_%`
- Dry-run unless `CONFIRM_ASSIGNMENT_REPAIR=yes`
- Does not delete bookings, change `bookings.status`, or create fake cleaners
- Uses existing `runAssignmentAfterPayment` (service role + booking command backend)

```bash
# Discover (no writes)
npm run e2e:repair:assignments

# Apply repairs
CONFIRM_ASSIGNMENT_REPAIR=yes npm run e2e:repair:assignments

# Verify offers for E2E cleaner
npm run e2e:inspect:offers -- --cleaner
```

---

## Rollback / cleanup

**Only** removes `test_e2e_*` users and their bookings — never production customers.

```bash
CONFIRM_E2E_CLEANUP=yes npm run e2e:cleanup
npm run e2e:seed
```

Preserves `services` catalog rows.

### Unified mock data cleanup (production-safe)

Dry-run audit for mock bookings, customers, and cleaners (no writes). Writes `mock-data-audit-report.json` and `mock-data-audit-report.csv` in the project root. Exits non-zero when REVIEW rows exist unless `--allow-review` is passed.

```bash
npm run ops:audit:mock-data
npm run ops:audit:mock-data -- --allow-review
```

Delete only rows in the DELETE bucket (requires explicit confirmation):

```bash
CONFIRM_MOCK_DATA_DELETE=yes npm run ops:delete:mock-data
```

Rules: real records (e.g. Princess Saidi, Farai Chitekedza, protected inboxes) are KEEP; paid/completed/earning/payout history blocks hard delete; mock bookings that cannot be hard-deleted may be archived when safe; each action writes `admin_delete_audit`.

### Mock cleaner ops (production-safe)

Audit mock vs real cleaners (dry-run table, no writes):

```bash
npm run ops:audit:mock-cleaners
```

Remove mock/test cleaners only (`test_e2e`, `test_phase`, mock/demo markers). Real cleaners and all booking/payment/audit rows are kept; bookings are unassigned from mock cleaners (not deleted).

```bash
CONFIRM_MOCK_CLEANER_DELETE=yes npm run ops:delete:mock-cleaners
```

E2E seed guards:

- Local Supabase (`127.0.0.1` / `localhost`): always allowed
- Remote staging: `CONFIRM_E2E_SEED_REMOTE=yes npm run e2e:seed`
- Production: `CONFIRM_E2E_SEED_PRODUCTION=yes npm run e2e:seed` (use only when intentional)

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| No cleaners in wizard | `npm run e2e:seed`; suburb must be **Cape Town**; date/time within Mon–Sat 08:00–18:00 |
| Stuck `pending_payment` | Check `APP_BASE_URL` matches dev port; open `/payment/success?reference=…` while signed in; or manual verify; inspect `payment_events` |
| No return from Paystack | Initialize must send `callback_url`; check Paystack test mode allows `http://localhost` |
| No assignment offer | `BOOKING_COMMAND_BACKEND=supabase`; logs for `runAssignmentAfterPayment` |
| Admin queue shows pending but cleaner has no offers | Stale metadata vs deleted offers — run `npm run e2e:repair:assignments` (see above) |
| Completion forbidden | Cleaner signed in matches `cleaner_id`; status must be `in_progress` |
| Earnings missing | `metadata.quote` on booking; positive `price_cents` |

---

## Related docs

- [Booking command integration tests](./booking-command-integration-tests.md)
- [Earnings and payouts](../earnings/earnings-and-payouts.md)
- [Paystack foundation](../payments/paystack-foundation.md)
- [Production readiness](../launch/production-readiness-checklist.md)
