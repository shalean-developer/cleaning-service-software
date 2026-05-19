# Pricing engine (Phase 4)

Central, deterministic quote calculation for **Shalean Cleaning Services**. All customer totals and cleaner earnings previews for the booking wizard, lock step, and Paystack initialize should use `calculateQuote()` — do not duplicate pricing math in routes or UI.

**Module:** `src/features/pricing/`  
**Version:** `2026-05-16-mvp` (constant `PRICING_VERSION`)  
**Currency:** ZAR (amounts stored as integer **cents**)

## API

| Entry | Purpose |
|-------|---------|
| `calculateQuote(input)` | Main quote function (unit-testable, no I/O) |
| `buildBookingQuoteMetadata(input, breakdown)` | Snapshot for `bookings.metadata` on draft create |
| `POST /api/pricing/quote` | Stateless HTTP quote for the wizard (no booking/payment side effects) |

## Pricing inputs (`PricingInput`)

| Field | Required | Notes |
|-------|----------|-------|
| `serviceSlug` | Yes | Code-first catalog slug (see services below) |
| `bedrooms` | Yes | Integer; min 1 for residential, 0 allowed for office |
| `bathrooms` | Yes | Integer; min 1 for residential, 0 allowed for office |
| `propertySizeSqm` | No | Office / large properties; billed per sqm over free threshold |
| `frequency` | No | `once` (default), `weekly`, `biweekly`, `monthly` |
| `addons` | No | Array of add-on slugs |
| `teamSize` | No | Default `1`; values above 1 use team payout rules |
| `cleanerTenureMonths` | No | Earnings preview only; unknown → conservative 60% tier |

## Output shape

### `PricingBreakdown`

- `pricingVersion`, `currency`, `serviceSlug`
- `lineItems[]` — transparent `PricingLineItem` rows (`code`, `label`, optional `quantity` / `unitAmountCents`, `amountCents`)
- `subtotalCents` — before recurring discount
- `discountCents` — absolute discount from frequency
- `totalCents` — **customer total** (use for `bookings.price_cents` and Paystack)
- `frequency`
- `cleanerEarnings` — `CleanerEarningsPreview` (informational until Phase 10)
- `metadata` — bedrooms, bathrooms, addons, etc.

### `CleanerEarningsPreview`

- `perCleanerAmountCents`
- `teamSize`
- `totalCleanerPayoutCents` (= per-cleaner × team size)
- `ruleApplied` — machine-readable rule id
- `metadata` — e.g. `fallbackReason`, `payoutPercent`, tenure tier

## Service rules (MVP)

| Slug | Customer pricing (ZAR cents) |
|------|------------------------------|
| `regular-cleaning` | R450 base (1 bed + 1 bath) + R80/extra bedroom + R60/extra bathroom |
| `deep-cleaning` | R850 base + R150/extra bedroom + R120/extra bathroom |
| `moving-cleaning` | R1200 base + R200/extra bedroom + R150/extra bathroom |
| `airbnb-cleaning` | R550 base + R90/extra bedroom + R70/extra bathroom |
| `office-cleaning` | R600 base + R2/sqm over 50 sqm |
| `carpet-cleaning` | R400 base + R150 per bedroom zone |

### Add-ons

| Slug | Amount |
|------|--------|
| `inside-cabinets` | R120 |
| `inside-fridge` | R150 |
| `inside-oven` | R180 |
| `interior-walls` | R100 |
| `interior-windows` | R200 |
| `laundry` | R120 |
| `balcony` | R100 |

### Frequency multipliers

| Frequency | Multiplier |
|-----------|------------|
| `once` | 1.0 |
| `weekly` | 0.90 (10% discount line item) |
| `biweekly` | 0.95 |
| `monthly` | 0.97 |

## Cleaner earnings preview logic

Preview only — **no `earning_lines` writes** at quote time (Phase 10 records actual earnings).

| Job type | Rule |
|----------|------|
| Deep / Moving / Carpet | Fixed **R250** per cleaner |
| Regular (and Airbnb / Office) | Percent of customer total, clamped **R250–R300** per cleaner |
| Tenure under 4 months | **60%** |
| Tenure 4+ months | **70%** |
| Tenure unknown | **60%** + `metadata.fallbackReason` |
| Team (`teamSize` above 1) | Fixed **R250** per cleaner |

### Safety rules

- Reject quotes where cleaner payout would exceed customer total
- Reject non-finite, zero, or negative payout amounts
- Never return **R0** preview for a valid quote
- Customer total must be greater than zero

## Validation errors

| Code | When |
|------|------|
| `UNKNOWN_SERVICE` | Invalid `serviceSlug` |
| `INVALID_BEDROOMS` / `INVALID_BATHROOMS` | Out of range or below minimum for service |
| `UNKNOWN_ADDON` | Invalid add-on slug |
| `INVALID_FREQUENCY` | Unknown frequency |
| `INVALID_TEAM_SIZE` | Not an integer 1–10 |
| `ZERO_TOTAL` | Customer total ≤ 0 |
| `UNSAFE_TOTAL` | Total above platform max |
| `UNSAFE_CLEANER_EARNINGS` | Payout invalid or exceeds customer total |
| `NEGATIVE_AMOUNT` | Invalid line item amounts |

## Assumptions

- **Code-first catalog** — `services` DB rows are not required for quoting; slugs are authoritative in this phase.
- **ZAR only** — Paystack and bookings should use `currency: "ZAR"` when wiring initialize (today some defaults still say `USD` from foundation migration).
- **MVP rate card** — Amounts are deterministic placeholders aligned with Shalean product shape; finance can replace constants in `catalog.ts` or move to `pricing_rules` table later.
- **Single preview cleaner** — Percent rules apply per cleaner; team jobs use fixed per-head amounts.

## Deferred

- Admin-editable `pricing_rules` table
- `service_addons` DB catalog
- Quote invalidation on lock expiry (Phase 7)
- Wiring `initializePayment` to call `calculateQuote` automatically (wizard/lock will pass `priceCents` from quote)
- Persisting earnings (`earning_lines`) — Phase 10
- UI / wizard — Phase 6

## Related

- [Foundation completion plan — Phase 4](../plans/foundation-completion-plan.md)
- [Paystack foundation](../payments/paystack-foundation.md)
- [Booking command execution layer](../architecture/booking-command-execution-layer.md)
