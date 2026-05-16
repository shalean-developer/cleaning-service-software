# Cleaner dashboard earnings leakage audit

**Date:** 2026-05-16  
**Scope:** Cleaner-facing routes, read models, APIs, and UI that may expose **customer-paid totals** instead of **cleaner earnings only**.  
**Status:** Audit only — **no fixes applied** (per request).

---

## Executive summary

Cleaners are seeing **customer booking totals** (`bookings.price_cents`) on offers and job detail because the cleaner dashboard read model maps that column to `priceLabel` and the UI labels it “Pay”. The reference implementation on **`/cleaner/earnings`** correctly uses **`earning_lines.payout_amount_cents`** via `listCleanerEarnings()`.

| Surface | Customer total exposed? | Cleaner earnings shown? |
|---------|-------------------------|-------------------------|
| `/cleaner/offers` | **Yes** (`priceLabel` ← `price_cents`) | No |
| `/cleaner/jobs/[bookingId]` | **Yes** (“Pay” ← `priceLabel`) | **Yes** (“Your earnings” ← `earning_lines`) |
| `/cleaner/jobs` (list) | No in UI; **yes in API JSON** | No |
| `/cleaner` (home) | No amounts on cards | No |
| `/cleaner/earnings` | **No** | **Yes** |
| `GET /api/cleaner/offers` | **Yes** (`priceCents`) | No |
| `GET /api/cleaner/jobs`, `GET /api/cleaner/jobs/[id]` | **Yes** (`priceLabel`) | Partial on detail only |

**Root cause:** `bookings.price_cents` is the **customer total** (documented in `docs/pricing/pricing-engine.md` and `docs/earnings/earnings-and-payouts.md` as gross / Paystack amount). Cleaner read models treat it as display pay.

**Correct earnings sources (priority order):**

1. **Post-completion (canonical):** `earning_lines.payout_amount_cents` — same as `/cleaner/earnings` (`listCleanerEarnings` in `payoutReadModel.ts`).
2. **Pre-completion preview:** `bookings.metadata.quote.cleanerEarningsPreview.perCleanerAmountCents` (snapshot at quote/lock), or server-side `computeCleanerEarningsPreview()` / `computeEarningsForBooking()` using `price_cents` **only on the server** — never returned to the client as `priceCents` / `priceLabel`.
3. **Unavailable:** show `"Earnings being calculated"` — **never** fall back to `price_cents`.

---

## Data model reference

| Field / store | Meaning | Safe for cleaner UI? |
|---------------|---------|----------------------|
| `bookings.price_cents` | Customer total charged | **No** |
| `bookings.metadata.quote.breakdown.totalCents` | Customer total snapshot | **No** (in metadata; not currently rendered, but selectable via RLS) |
| `bookings.metadata.quote.cleanerEarningsPreview.perCleanerAmountCents` | Preview payout per cleaner | **Yes** (preview) |
| `earning_lines.payout_amount_cents` | Recorded cleaner payout | **Yes** (authoritative after completion) |
| `earning_lines.gross_amount_cents` | Customer total copy on ledger row | **No** for cleaner UI |

---

## Findings table

| File path | Route / page | Field currently used | Leaks customer total? | Recommended replacement | Risk |
|-----------|--------------|------------------------|----------------------|-------------------------|------|
| `src/features/dashboards/server/cleanerJobReadModel.ts` → `listCleanerOffersForDashboard` | `/cleaner/offers` | `formatZar(row.booking.price_cents)` → `priceLabel` | **Yes** | `earningsLabel` from preview or computed `perCleanerAmountCents`; else `"Earnings being calculated"` | **Critical** |
| `src/app/(cleaner)/cleaner/offers/page.tsx` | `/cleaner/offers` | `o.priceLabel` | **Yes** (displays read model) | `o.earningsLabel` (rename) | **Critical** |
| `src/features/assignments/server/getCleanerOffers.ts` | (data for offers) | Selects `bookings.price_cents` | Internal only | Keep for **server-side** preview compute only; do not map to API/UI as pay | Medium |
| `src/app/api/cleaner/offers/route.ts` | `GET /api/cleaner/offers` | `priceCents: row.booking.price_cents` | **Yes** | `earningsCents` / `earningsLabel` only; omit `priceCents` | **High** |
| `src/features/dashboards/server/cleanerJobReadModel.ts` → `getCleanerJobDetail` | `/cleaner/jobs/[bookingId]` | `priceLabel` ← `row.price_cents` | **Yes** | Same as offers; prefer `earning_lines` when present | **Critical** |
| `src/app/(cleaner)/cleaner/jobs/[bookingId]/page.tsx` | `/cleaner/jobs/[bookingId]` | `job.priceLabel` under **“Pay”** | **Yes** | **Remove** customer pay row or replace with `earningsLabel`; keep “Your earnings” block | **Critical** |
| `src/features/dashboards/server/cleanerJobReadModel.ts` → `listCleanerJobs` | `/cleaner/jobs` (API) | `priceLabel` ← `price_cents` | **Yes** in JSON | `earningsLabel` or omit amount on list | Medium |
| `src/app/(cleaner)/cleaner/jobs/page.tsx` | `/cleaner/jobs` | (none) | No in UI | No change | Low |
| `src/app/api/cleaner/jobs/route.ts` | `GET /api/cleaner/jobs` | Passes `result.jobs` with `priceLabel` | **Yes** | Cleaner-safe DTO | Medium |
| `src/app/api/cleaner/jobs/[bookingId]/route.ts` | `GET /api/cleaner/jobs/[id]` | `job.priceLabel` + `job.earnings[]` | **Yes** (dual display) | Drop `priceLabel`; expose only earnings fields | **High** |
| `src/features/dashboards/server/types.ts` | Cleaner DTOs | `CleanerOfferListItem.priceLabel`, `CleanerJobListItem.priceLabel` | **Yes** (name implies pay) | Rename to `earningsLabel`; optional `earningsCents` | Medium |
| `src/features/earnings/server/payoutReadModel.ts` → `listCleanerEarnings` | `/cleaner/earnings` | `payoutAmountCents` → `formatZar()` | **No** | **Keep as reference** | — |
| `src/app/(cleaner)/cleaner/earnings/page.tsx` | `/cleaner/earnings` | `e.payoutAmountCents` | **No** | No change | — |
| `src/features/earnings/server/payoutReadModel.ts` | (internal) | `grossAmountCents` on `CleanerEarningListItem` | Not rendered; present in type | Omit from cleaner-facing DTO / API if one is added | Low |
| `src/app/(cleaner)/cleaner/page.tsx` | `/cleaner` | Counts only; no amounts | No | No change | Low |
| `src/features/dashboards/server/lifecycleTimeline.ts` | Job detail timeline | No amounts | No | No change | Low |
| `src/app/api/cleaner/offers/[offerId]/accept/route.ts` | POST accept | No financial fields | No | No change | — |
| `src/app/api/cleaner/jobs/[bookingId]/start|complete/route.ts` | POST | No financial fields | No | No change | — |
| Supabase RLS `bookings_select_cleaner` | Direct client access | Full row: `price_cents`, `metadata` | **Yes** (defense in depth) | Optional: DB view / column policy; app must still sanitize | Medium |
| Supabase RLS `earning_lines_select_cleaner` | Direct client access | `gross_amount_cents` | **Yes** (defense in depth) | Optional: cleaner-safe view selecting payout columns only | Low |

**Search note:** Grep for `total_amount`, `customerPaid`, `formattedTotal`, etc. under `src/` returned **no matches**. The leakage uses project-specific names: **`price_cents`**, **`priceLabel`**, **`priceCents`**.

---

## Confirmed user-reported issues

### 1. `/cleaner/offers` — customer total shown

**Display chain:**

```53:53:src/features/dashboards/server/cleanerJobReadModel.ts
      priceLabel: formatZar(row.booking.price_cents, row.booking.currency),
```

```66:66:src/app/(cleaner)/cleaner/offers/page.tsx
                <p className="mt-1 text-sm font-medium text-zinc-800">{o.priceLabel}</p>
```

`getCleanerOffers` loads `price_cents` from `bookings` (`getCleanerOffers.ts` lines 60–62). That value is the **customer total**, not cleaner earnings.

### 2. `/cleaner/jobs/[bookingId]` — both customer total and earnings

**Customer total (“Pay”):**

```172:172:src/features/dashboards/server/cleanerJobReadModel.ts
      priceLabel: formatZar(row.price_cents, row.currency),
```

```60:63:src/app/(cleaner)/cleaner/jobs/[bookingId]/page.tsx
          <section>
            <dt className="text-zinc-500">Pay</dt>
            <dd className="font-medium text-zinc-900">{job.priceLabel}</dd>
          </section>
```

**Cleaner earnings (correct):**

```154:187:src/features/dashboards/server/cleanerJobReadModel.ts
  const { data: earningRows } = await client
    .from("earning_lines")
    .select("id, payout_amount_cents, payout_status, created_at")
    ...
      earnings: (earningRows ?? []).map((e) => ({
        ...
        payoutAmountCents: e.payout_amount_cents,
```

After job completion, the page can show **both** R530 (example customer total) and R318 (example payout) — the reported behavior.

### 3. `/cleaner/earnings` — correct (reference)

```36:70:src/features/earnings/server/payoutReadModel.ts
  const { data: lines, error } = await client
    .from("earning_lines")
    ...
      payoutAmountCents: line.payout_amount_cents,
```

```60:61:src/app/(cleaner)/cleaner/earnings/page.tsx
              <p className="mt-2 text-lg font-semibold text-zinc-900">
                {formatZar(e.payoutAmountCents)}
```

Does **not** use `bookings.price_cents` for display. Does load `grossAmountCents` into the list item type but **does not render it**.

---

## API exposure detail

### `GET /api/cleaner/offers`

```19:31:src/app/api/cleaner/offers/route.ts
  return NextResponse.json({
    ok: true,
    offers: result.offers.map((row) => ({
      ...
      priceCents: row.booking.price_cents,
      currency: row.booking.currency,
    })),
  });
```

Any client consuming this BFF receives the **customer total** in clear cents. The offers **page** uses the server read model, not this route; the route is still a leakage vector for future/mobile clients.

### `GET /api/cleaner/jobs` and `GET /api/cleaner/jobs/[bookingId]`

Both return objects from `cleanerJobReadModel` unchanged, including `priceLabel` derived from `price_cents`. Detail also includes correct `earnings[]`.

---

## Metadata and RLS (defense in depth)

Wizard/lock persists a full quote snapshot on `bookings.metadata`:

```23:30:src/features/pricing/server/metadata.ts
      breakdown: {
        lineItems: breakdown.lineItems,
        subtotalCents: breakdown.subtotalCents,
        discountCents: breakdown.discountCents,
        totalCents: breakdown.totalCents,
        ...
      },
      cleanerEarningsPreview: breakdown.cleanerEarnings,
```

Cleaner read models fetch `metadata` only to parse **service/location** (`parseBookingDisplay`) — they do **not** currently send raw metadata to the UI. However, **`bookings_select_cleaner`** allows authenticated cleaners to `SELECT` full booking rows (including `price_cents` and metadata) for assigned bookings and offer-linked bookings (`cleaner_can_access_booking`). A custom Supabase client in the browser could read customer totals without going through the read model.

Similarly, **`earning_lines_select_cleaner`** exposes `gross_amount_cents` (customer total copy) on ledger rows. The app read model for job detail correctly selects only `payout_amount_cents`, but RLS does not hide gross at the DB layer.

**Recommendation for later (optional hardening):** `cleaner_booking_pay_display` view or restricted column set; not required for the first UI/API fix if all cleaner surfaces use a server-only DTO.

---

## Functions and files that need fixing

| Priority | File | Function / area | Change |
|----------|------|-----------------|--------|
| P0 | `src/features/dashboards/server/cleanerJobReadModel.ts` | `listCleanerOffersForDashboard` | Replace `priceLabel` from `price_cents` with cleaner earnings preview |
| P0 | `src/features/dashboards/server/cleanerJobReadModel.ts` | `getCleanerJobDetail` | Remove customer `priceLabel`; use earnings-only display |
| P1 | `src/features/dashboards/server/cleanerJobReadModel.ts` | `listCleanerJobs` | Align list DTO (earnings or no amount) |
| P1 | `src/app/(cleaner)/cleaner/offers/page.tsx` | render | Use earnings label field |
| P1 | `src/app/(cleaner)/cleaner/jobs/[bookingId]/page.tsx` | “Pay” section | Remove or replace with earnings-only copy |
| P1 | `src/app/api/cleaner/offers/route.ts` | `GET` | Stop serializing `priceCents` |
| P2 | `src/features/dashboards/server/types.ts` | `CleanerOfferListItem`, `CleanerJobListItem`, `CleanerJobDetail` | Rename `priceLabel` → `earningsLabel`; add `earningsCents?` |
| P2 | New module (suggested) | `resolveCleanerEarningsDisplay(...)` | Centralize preview vs ledger logic |
| P2 | `src/features/earnings/server/payoutReadModel.ts` | `listCleanerEarnings` | Drop `grossAmountCents` from cleaner list type if exposed via API later |
| P3 | `src/features/dashboards/server/dashboardReadModels.test.ts` | tests | Assert earnings label ≠ customer total |

**Suggested new helper** (name illustrative):

`src/features/dashboards/server/resolveCleanerEarningsDisplay.ts`

```ts
// Pseudocode — implement in fix phase
function resolveCleanerEarningsDisplay(input: {
  booking: { price_cents: number; currency: string; metadata: Json; cleaner_id: string | null };
  earningLines: { payout_amount_cents: number }[];
  cleanerTenureMonths?: number | null;
}): { earningsCents: number | null; earningsLabel: string } {
  if (input.earningLines.length > 0) {
    const cents = input.earningLines[0]!.payout_amount_cents;
    return { earningsCents: cents, earningsLabel: formatZar(cents, input.booking.currency) };
  }
  // Preview from metadata.quote.cleanerEarningsPreview.perCleanerAmountCents
  // OR computeCleanerEarningsPreview / computeEarningsForBooking (server only)
  // NEVER return booking.price_cents
  return { earningsCents: null, earningsLabel: "Earnings being calculated" };
}
```

**Reuse existing server logic:**

| Helper | Module | Use when |
|--------|--------|----------|
| `listCleanerEarnings` | `payoutReadModel.ts` | Earnings list page (unchanged) |
| `computeEarningsForBooking` | `computeEarningsForBooking.ts` | Assigned job with `cleaner_id` + quote metadata |
| `computeCleanerEarningsPreview` | `computeCleanerEarnings.ts` | Offer / pending job; needs `customerTotalCents` **internally** |
| `metadata.quote.cleanerEarningsPreview` | `buildBookingQuoteMetadata` | Fast path when snapshot exists |

For **offers**, `computeEarningsForBooking` may fail if `booking.cleaner_id` is null; use metadata preview or `computeCleanerEarningsPreview` with booking `price_cents` on the server only.

---

## Proposed fix plan (implementation phase — not done)

### Phase 1 — Read model and DTO (single source of truth)

1. Add `resolveCleanerEarningsDisplay` (or equivalent) in `src/features/dashboards/server/`.
2. Update `listCleanerOffersForDashboard`, `getCleanerJobDetail`, and `listCleanerJobs` to set **`earningsLabel`** / **`earningsCents`** instead of **`priceLabel`** from `price_cents`.
3. Update `src/features/dashboards/server/types.ts` cleaner types; deprecate `priceLabel` on cleaner DTOs.
4. Rule: if preview and ledger disagree after completion, **ledger wins** (`earning_lines.payout_amount_cents`).

### Phase 2 — UI

1. **`/cleaner/offers`:** Show `earningsLabel` only (copy: “Your earnings” or “Estimated earnings”).
2. **`/cleaner/jobs/[bookingId]`:** Remove the **“Pay”** row that uses customer total; keep one earnings section (merge duplicate UX).
3. **`/cleaner/earnings`:** No change.

### Phase 3 — APIs

1. `GET /api/cleaner/offers`: replace `priceCents` with `earningsCents` + `earningsLabel`; document breaking change for any consumer.
2. `GET /api/cleaner/jobs*`: same DTO as read model; remove `priceLabel`.

### Phase 4 — Tests and regression guards

See [Recommended tests](#recommended-tests).

### Phase 5 — Optional hardening

- DB view for cleaner booking financials (payout columns only).
- Strip `gross_amount_cents` from cleaner-selectable `earning_lines` via view.
- ESLint / test guard: ban `price_cents` and `priceLabel` in `(cleaner)` app paths and `api/cleaner/**`.

**Out of scope (do not change):** Admin (`/admin/*`), customer (`/customer/*`), booking wizard, Paystack, `calculateQuote` customer totals.

---

## Recommended tests

### Unit tests (`cleanerJobReadModel` or dedicated `cleanerEarningsDisplay.test.ts`)

1. **Offers:** Given `price_cents = 53000` and preview `perCleanerAmountCents = 31800`, `listCleanerOffersForDashboard` returns `earningsLabel` matching **R318.00**, not R530.00.
2. **Job detail with ledger:** Given `earning_lines.payout_amount_cents = 31800`, display uses **31800** even if `price_cents = 53000`.
3. **Job detail pre-completion:** No earning lines; metadata preview present → preview cents; no preview → `"Earnings being calculated"`.
4. **Never fallback:** Missing preview and missing lines → label is **not** `formatZar(price_cents)`.

### API contract tests

5. `GET /api/cleaner/offers` response objects **must not** have `priceCents` property (or `expect(body).not.toMatchObject({ offers: [{ priceCents: expect.any(Number) }] })`).
6. `GET /api/cleaner/jobs/[id]` **must not** include `priceLabel`; **must** include `earnings` or `earningsLabel` only.

### Extend `dashboardReadModels.test.ts`

7. Mock booking with divergent `price_cents` vs preview; assert cleaner offer/job DTO does not equal customer formatted total.
8. Keep existing auth tests (cleaner cannot load another cleaner’s job).

### Integration / RLS (optional)

9. Cleaner session `select` from `bookings` still returns `price_cents` (document as known RLS behavior until view exists).

### E2E (Playwright / smoke)

10. Log in as cleaner → `/cleaner/offers` → amount text does not match admin booking **customer total** for same `bookingId`.
11. `/cleaner/jobs/[id]` → page does not contain customer total string when earnings block shows a lower payout.

---

## Acceptance criteria mapping (for fix PR)

| Criterion | Current | After fix |
|-----------|---------|-----------|
| `/cleaner/offers` shows only cleaner earnings | Fail | Pass |
| `/cleaner/jobs/[bookingId]` shows only cleaner earnings | Fail (dual) | Pass |
| `/cleaner/earnings` unchanged | Pass | Pass |
| No cleaner page shows customer total | Fail | Pass |
| Cleaner APIs omit unnecessary customer totals | Fail | Pass |
| Tests fail on regression | Missing | Add per above |

---

## Related documentation

- [Earnings and payouts](../earnings/earnings-and-payouts.md) — `gross_amount_cents` = customer total; `payout_amount_cents` = cleaner payout
- [Pricing engine](../pricing/pricing-engine.md) — `totalCents` / `price_cents` = customer total
- [Customer/cleaner/admin dashboards](../dashboards/customer-cleaner-admin-dashboards.md) — route map (Phase 10 mentions earnings on job + `/cleaner/earnings`)

---

## Appendix: cleaner route inventory

| Route | Data entry | Financial UI |
|-------|------------|----------------|
| `/cleaner` | `listCleanerOffersForDashboard`, `listCleanerJobs` | None |
| `/cleaner/offers` | `listCleanerOffersForDashboard` | **Leaks** `priceLabel` |
| `/cleaner/jobs` | `listCleanerJobs` | None |
| `/cleaner/jobs/[bookingId]` | `getCleanerJobDetail` | **Leaks** `priceLabel` + correct `earnings` |
| `/cleaner/earnings` | `listCleanerEarnings` | Correct |
| `GET /api/cleaner/offers` | `getCleanerOffers` | **Leaks** `priceCents` |
| `GET /api/cleaner/jobs` | `listCleanerJobs` | **Leaks** `priceLabel` |
| `GET /api/cleaner/jobs/[bookingId]` | `getCleanerJobDetail` | **Leaks** `priceLabel` |
| `POST /api/cleaner/offers/[id]/accept|decline` | — | None |
| `POST /api/cleaner/jobs/[id]/start|complete` | — | None |
