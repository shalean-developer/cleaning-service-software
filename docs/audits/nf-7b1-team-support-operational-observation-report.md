# NF-7B.1 — Team support operational observation and analytics

**Date:** 2026-05-18  
**Phase:** Observation only (NF-7B.1). No assignment engine, payout, or lifecycle changes.

---

## 1. Metrics added

Admin **Team support** analytics (`/admin/analytics/team-support`) aggregates the newest 500 bookings:

| Metric | Purpose |
|--------|---------|
| Regular cleaning bookings | Denominator for team-request share |
| 2-cleaner requests (`requestedTeamSize: 2`) | Demand signal |
| Team request % | Share of regular-cleaning volume |
| Avg price (team vs all regular) | Pricing / surcharge observation |
| Avg home size (bed+bath proxy) | Whether larger homes drive team requests |
| High operational load count | Stacked 2-cleaner + equipment + heavy |
| Manual fulfillment breakdown | 2 fulfilled / 1 only / not recorded |

Bookings CSV export adds: `two_cleaner_request`, `operational_load_score`, `team_fulfillment`.

---

## 2. Operational visibility improvements

- **List badges:** `2-cleaner request`, `Bring equipment`, `Heavy clean`, `Operational load` (score ≥ 3), plus fulfillment status when recorded.
- **Booking detail hero:** Same operational load badges; fulfillment row in summary.
- **Filters:** `2-cleaner request`, `Operational load` on `/admin/bookings`.

---

## 3. Manual fulfillment tracking design

Stored in booking `metadata.adminOps.teamRequestFulfillment` (service-role write only):

```json
{
  "fulfilledCleanerCount": 1 | 2,
  "recordedAt": "ISO-8601",
  "recordedByProfileId": "uuid"
}
```

- **API:** `PATCH /api/admin/bookings/[bookingId]/team-request-fulfillment`
- **UI:** Admin booking detail → “2-cleaner fulfillment” panel (mark 2 fulfilled / 1 only).
- **Not connected** to assignment, payouts, earnings `teamSize`, or dispatch.

---

## 4. Pricing / demand observations

| Topic | Observation |
|-------|-------------|
| Surcharge | R200 (`TEAM_SUPPORT_REQUEST_SURCHARGE_CENTS = 20_000`) on checkout; earnings remain `teamSize: 1`. |
| Wording | Customer copy: “Request 2 cleaners”, “team availability confirmed after payment”, checkout: “We'll confirm team availability after payment.” |
| Cleaner note | Neutral: “Customer requested faster completion” (not “team assignment”). |
| Demand | Use analytics panel once production bookings exist; early sample may be small. |
| Home size | Compare avg bed+bath on team requests vs all regular cleaning in analytics. |

**Hypothesis to validate:** Larger homes (higher bed+bath) correlate with 2-cleaner requests; if not, surcharge may be misaligned with operational cost.

---

## 5. Operational risks observed (design-time)

| Risk | Mitigation in NF-7B.1 |
|------|------------------------|
| Customer assumes guaranteed 2 cleaners | Wording stresses confirmation after payment; fulfillment tracked manually. |
| Single cleaner assigned despite 2-cleaner request | Visible via fulfillment panel + badges; no auto second assignment. |
| Shalean equipment + heavy + 2-cleaner stack | `Operational load` badge when score ≥ 3. |
| Cleaner confusion | Cleaner note is neutral; equipment uses operational label “Bring cleaning equipment”. |
| Admin forgets to record fulfillment | Analytics shows “not recorded” count; filter surfaces open team requests. |

---

## 6. Recommended wording adjustments

| Audience | Current | Recommendation |
|----------|---------|----------------|
| Customer (wizard) | “Request 2 cleaners” + “team availability confirmed after payment” | Keep for NF-7B; if support tickets show “guaranteed team”, add: “Subject to availability — we'll contact you if we can't staff two cleaners.” |
| Customer (checkout) | “We'll confirm team availability after payment.” | Align with wizard; optional email/SMS after payment: “We're checking 2-cleaner availability for your booking.” |
| Cleaner | “Customer requested faster completion” | Sufficient for NF-7B; after NF-7C, replace with explicit staffing note. |
| Admin | “2-cleaner request” badge | Clear; use fulfillment panel on every team request before job day. |

---

## 7. Recommendation on NF-7C timing

**Defer NF-7C** until analytics show:

1. **Sustained demand:** e.g. team requests ≥ 5–10% of regular-cleaning bookings over 4–8 weeks, or ≥ N requests/month with ops pain.
2. **Fulfillment gap:** Manual tracking shows frequent “1 cleaner only” or high “not recorded” with customer complaints.
3. **Surcharge review:** Avg team-request price minus baseline; if coordination time (equipment + heavy + two staff) routinely exceeds R200 value, adjust surcharge before architecture work.

**Manual fulfillment is sufficient for now** if volume is low and ops can coordinate off-platform (WhatsApp/phone) using badges and filters.

**Proceed to NF-7C** when dual staffing becomes a recurring bottleneck or customer expectation failures appear in support data.

---

## 8. Tests run

```bash
npm test -- src/features/dashboards/server/adminTeamSupportObservation.test.ts \
  src/app/api/admin/bookings/[bookingId]/team-request-fulfillment/route.test.ts \
  src/features/dashboards/server/adminBookingsExport.test.ts \
  src/features/dashboards/server/adminOperationalHelpers.test.ts
```

---

## 9. Confirmation — no forbidden changes

This phase did **not** implement:

- Assignment engine changes  
- Payout logic / splitting  
- Lifecycle redesign  
- Second `cleaner_id` / multi-offer dispatch  
- Schema redesign for teams  
- Cleaner completion changes  
- Automatic team orchestration  

Only: admin analytics, badges, filters, CSV columns, metadata-based manual fulfillment tracking, and observation documentation.
