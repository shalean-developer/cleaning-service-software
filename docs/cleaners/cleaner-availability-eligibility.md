# Cleaner availability and eligibility (Phase 5)

Read-only APIs and server module for listing cleaners who can take a job. Customers pick a **selected cleaner** or rely on **best available** metadata; Phase 8 assignment reuses the same eligibility and ranking rules after payment.

**Module:** `src/features/cleaners/`  
**Migration:** `supabase/migrations/20260516180000_cleaner_availability_eligibility.sql`

## Data model

| Table / column | Purpose |
|----------------|---------|
| `cleaners.suspended_at` | Block suspended cleaners from eligibility |
| `cleaners.average_rating` | Optional display + ranking (0–5) |
| `cleaner_service_areas` | `area_slug` suburbs a cleaner serves (empty = all areas) |
| `cleaner_service_capabilities` | `service_slug` aligned with pricing catalog |
| `cleaner_availability` | Weekly windows: `day_of_week` (0=Sun), `start_time`, `end_time`, `timezone` |
| `cleaner_time_off` | Exception blocks (`start_at`, `end_at`) |
| `bookings` (existing) | Schedule conflict detection via `cleaner_id` + overlapping slot |

Indexes support lookup by `area_slug`, `service_slug`, `cleaner_id`, and time-off ranges.

### RLS

New tables follow the same pattern as `cleaners`: cleaners read **own** rows; **admin** writes; **customers do not** read these tables directly. APIs authenticate the user, then load data with the **service role** and return only **public cleaner cards**.

## Eligibility rules (order)

1. `active = true`
2. Not **suspended** (`suspended_at` in the past)
3. **Service capability** — `service_slug` present for the requested service
4. **Service area** — requested `area_slug` in cleaner areas, or cleaner has no areas (serves all)
5. **Recurring availability** — slot day/time falls in a window (same timezone as slot, default `Africa/Johannesburg`)
6. **Time off** — slot does not overlap `cleaner_time_off`
7. **Schedule conflict** — no overlapping booking for that `cleaner_id` in statuses: `assigned`, `in_progress`, `confirmed`, `pending_assignment`

## Selected cleaner vs best available

| Path | Phase 5 behaviour | Phase 8 |
|------|-----------------|--------|
| **Selected cleaner** | Customer passes `selectedCleanerId` / `preferred_cleaner_id`; API returns `selectedCleaner` with eligible + reason | Re-checked at assignment; `OFFER_TO_CLEANER` + accept API |
| **Best available** | `bestAvailable` on response — highest `average_rating`, then lowest `cleanerId` (stable) | Same ranking at assignment; offer to top eligible cleaner |

No assignment offers or status changes are created in Phase 5 APIs (assignment runs post-payment in Phase 8).

## API contracts

### `GET` / `POST` `/api/cleaners/available`

**Auth:** customer or admin  

**Inputs (query or JSON):**

| Field | Required | Notes |
|-------|----------|-------|
| `serviceSlug` | Yes | Pricing catalog slug |
| `suburb` / `areaSlug` | Yes | Normalized to `area_slug` |
| `date` + `time` | Yes* | Builds slot; default duration 180 min |
| `scheduledStart` + `scheduledEnd` | Yes* | Alternative to date/time |
| `teamSize` | No | Default 1 |
| `bedrooms`, `bathrooms`, … | No | Optional pricing input for earnings preview |

**Response:**

```json
{
  "ok": true,
  "cleaners": [CleanerPublicCard],
  "bestAvailable": { "cleanerId", "displayName", "rankScore", "reason" } | null
}
```

### `GET` / `POST` `/api/booking/cleaners`

**Auth:** customer or admin  

**Inputs:** Same as above, plus optional `bookingId`. With `bookingId`, slot and quote context are loaded from the booking when the customer owns it (or admin).

**Response:** Same as available, plus:

```json
{
  "selectedCleaner": {
    "cleanerId",
    "eligible",
    "eligibilityStatus",
    "eligibilityReason",
    "eligibilityCode"
  } | null
}
```

## Privacy — `CleanerPublicCard` only

Safe fields returned to clients:

- `cleanerId`, `displayName`, `rating`
- `serviceAreasSummary`, `availabilitySummary`
- `eligibilityStatus`, `eligibilityReason`, `eligibilityCode`
- `estimatedEarningsPreviewCents` (when quote inputs provided)

**Never returned:** phone, email, profile id, home address, suspension timestamps, internal notes.

## Earnings preview

When bedrooms/bathrooms (or booking `metadata.quote`) are supplied, eligible cleaners get `estimatedEarningsPreviewCents` from `calculateQuote()` using cleaner `created_at` as tenure proxy. Informational only — no `earning_lines` writes.

## Phase 8 integration

- `pickBestAvailable()` and `evaluateCleanerEligibility()` power `runAssignmentAfterPayment()`
- See [assignment engine](../assignments/assignment-engine.md)

## Related

- [Pricing engine](../pricing/pricing-engine.md)
- [RLS role security](../security/rls-role-security.md)
- [Foundation plan — Phase 5](../plans/foundation-completion-plan.md)
