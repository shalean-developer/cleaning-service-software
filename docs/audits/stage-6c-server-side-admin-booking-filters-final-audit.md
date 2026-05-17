# Stage 6C — Server-Side Admin Booking Filters/Search Final Audit

**Date:** 2026-05-17  
**Type:** Audit only — no code changes  
**Scope:** `/admin/bookings` list read model — filters, search, counts, cap messaging (6C-1 through 6C-3d)  
**Related:** [stage-6c-server-side-admin-booking-filters-design.md](../architecture/stage-6c-server-side-admin-booking-filters-design.md), [stage-6c-3-server-side-assignment-visibility-filters-design.md](../architecture/stage-6c-3-server-side-assignment-visibility-filters-design.md), [stage-6-ui-polish.md](../operations/stage-6-ui-polish.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Status filters (`payment_failed`, `pending_assignment`) server-side | **Pass** |
| Schedule `from` / `to` server-side | **Pass** |
| Search `q` server-side (min length 3) | **Pass** |
| Assignment presets server-side (6C-3a–3d) | **Pass** |
| SQL applied before `LIMIT 200` | **Pass** |
| Honest `matchTotal` / `returnedCount` / `capped` | **Pass** (when filters/search/dates active) |
| `subsetFiltered` false for graduated filters | **Pass** |
| Filters combine with `q` + date range | **Pass** (tests) |
| No new mutation routes on list API | **Pass** |
| Lifecycle / payment / assignment / RLS / commands unchanged | **Pass** (read-model only) |
| Docs updated (operations + 6C-3 sub-docs) | **Pass** (parent 6C design header slightly stale — see §Doc notes) |
| Typecheck + targeted tests | **Pass** |

**Overall:** Stage **6C** is **complete** for its stated scope. Safe to proceed to **Stage 6E** (CSV export) or **Stage 6F** (cleaner mobile polish); neither is blocked by 6C. **6E** is the natural follow-on if ops needs export of the same filtered set 6C now computes honestly.

---

## Query pipeline (authoritative)

`listAdminBookings` (`adminOperationsReadModel.ts`):

1. Normalize query (`normalizeAdminBookingsQuery`) — trims search, validates dates.
2. Resolve search SQL (`resolveAdminBookingsSearchSql`) when `q` length ≥ 3.
3. Resolve assignment SQL (`resolveAdminAssignmentFilterSql`) when filter is an assignment preset.
4. **List query:** `applyAdminBookingsSqlFilters` → `applyAdminBookingsSearchSql` → `order(updated_at DESC)` → **`limit(200)`**.
5. **Count query** (when `hasHonestMatchTotal`): identical filters, `count: exact`, head-only — no limit.
6. Enrich rows only; **no** `filterAdminBookings` when all active filters are server-side.

```text
bookings SELECT
  → WHERE status / schedule / assignment OR / search OR
  → ORDER BY updated_at DESC
  → LIMIT 200
(parallel) COUNT(*) with same WHERE
```

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | `payment_failed` server-side | **Pass** | `SERVER_SIDE_STATUS_FILTERS`; `applyAdminBookingsSqlFilters` → `eq("status", "payment_failed")`; integration `adminOperationsReadModel.test.ts` |
| 2 | `pending_assignment` server-side | **Pass** | Same pattern with `pending_assignment` |
| 3 | Scheduled `from` / `to` server-side | **Pass** | `gte(scheduled_start, fromT00Z)` + `lt(scheduled_start, toExclusive)`; `adminBookingsListQuery.test.ts` |
| 4 | `q` server-side, min length 3 | **Pass** | `MIN_ADMIN_BOOKING_SEARCH_LENGTH = 3`; `normalizeAdminBookingSearch` drops shorter; `hasServerSideSearch` |
| 5 | Booking ID prefix search | **Pass** | `isBookingIdPrefixSearch` (8+ hex); `id.ilike.{prefix}%` in `resolveAdminBookingsSearchSql`; test |
| 6 | Customer / company search | **Pass** | `customers.ilike(company_name)` → `customer_id.in.(...)`; test |
| 7 | Payment provider ref search | **Pass** | `payments.ilike(provider_ref)` → `id.in.(...)`; test |
| 8 | `max_attempts` server-side | **Pass** | `SERVER_SIDE_ASSIGNMENT_FILTERS`; metadata reason ILIKE + `pending_assignment`; SQL before limit test |
| 9 | `selected_declined` server-side | **Pass** | Metadata + declined-offer id pre-query; `.or()` on list; integration tests |
| 10 | `dispatch_not_started` server-side | **Pass** | Reason ILIKE + recovery-candidate `id.in`; golden parity tests |
| 11 | `recovery_needed` server-side | **Pass** | Same bundle as dispatch (`applyDispatchOrRecoveryNeededFilterSql`); equivalence tests |
| 12 | `assignment_attention` server-side | **Pass** | Composed OR (max_attempts + selected_declined + needs_assignment + confirmed edge); golden parity; 6C-3d shipped |
| 13 | `matchTotal` / `returnedCount` / `capped` accurate | **Pass** | `hasHonestMatchTotal` → parallel exact count; `capped = matchTotal > returnedCount`; capped fixture test |
| 14 | `subsetFiltered` false for graduated filters | **Pass** | `needsInMemoryRefinement` false for every dropdown filter; `subsetFiltered` only set when `refineInMemory`; all integration tests expect `undefined` |
| 15 | Filters combine with `q` + date range | **Pass** | Same filter chain on list + count; tests for search+dates+`max_attempts`, `selected_declined`, `dispatch_not_started`, `recovery_needed`, `assignment_attention` |
| 16 | No new mutation routes / admin actions | **Pass** | `GET` only on `/api/admin/bookings`; `route.test.ts` asserts no POST/PUT/PATCH/DELETE; per-booking POST routes unchanged |
| 17 | No lifecycle / payment / assignment / RLS / command changes | **Pass** | 6C touches read model + SQL helpers + tests + docs only; no migrations; `filterAdminBookings` retained but bypassed for all valid presets |
| 18 | Docs updated | **Pass** | `stage-6-ui-polish.md` (6C-1–3d); architecture 6C-3a–3d + parent 6C-3; see §Doc notes |

---

## Filter / search inventory

| Control | Server-side mechanism | Pre-query helpers | In-memory fallback |
|---------|----------------------|-------------------|-------------------|
| All bookings (no filter) | None — global top 200 by `updated_at` | — | N/A (`matchTotal` null by design) |
| `payment_failed` | `status = payment_failed` | — | None |
| `pending_assignment` | `status = pending_assignment` | — | None |
| `from` / `to` | `scheduled_start` range | — | None |
| `q` (≥3 chars) | Customer / payment / id OR | `customers`, `payments` | None |
| `max_attempts` | `pending_assignment` + reason ILIKE | — | None |
| `selected_declined` | Metadata + `.or(declined…)` | Declined offer booking ids | None |
| `dispatch_not_started` | Reason ILIKE OR confirmed + recovery ids | Recovery candidate ids | None |
| `recovery_needed` | Same as dispatch bundle | Recovery candidate ids | None |
| `assignment_attention` | Four-branch composed `.or()` | Declined + open offer booking ids | None |

**Assignment parity:** Classifiers in `adminAssignmentFilterSql.ts` are tested against `matchesAdminBookingFilter` on enriched fields (6C-3a–3d golden matrices).

---

## Count contract

| Scenario | `matchTotal` | `subsetFiltered` | Footer copy |
|----------|--------------|------------------|-------------|
| Any graduated filter and/or `q` (≥3) and/or schedule range | Exact DB count | Omitted (`undefined`) | “Showing X of Y matching bookings…” |
| `matchTotal > 200` | Exact | Omitted | `capped: true` + newest-200 wording |
| **All bookings**, no `q`/dates/filter | `null` | Omitted | “Showing up to N bookings…” (baseline cap, not a 6C regression) |

`hasHonestMatchTotal` = `hasServerSideSqlFilters && !needsInMemoryRefinement`. All eight dropdown presets satisfy both.

---

## Test execution summary

| Command / suite | Result |
|-----------------|--------|
| `npm run typecheck` | **Pass** |
| `adminBookingsListQuery.test.ts` | **Pass** (included in run) |
| `adminAssignmentFilterSql.test.ts` | **Pass** (included in run) |
| `adminOperationsReadModel.test.ts` | **Pass** (included in run) |
| `AdminBookingsFilters.test.tsx` | **Pass** (included in run) |
| `src/app/api/admin/bookings/route.test.ts` | **Pass** (included in run) |
| **Bundled run** | **5 files, 91 tests, all passed** |

---

## Behavior unchanged (confirmed)

| Layer | 6C impact |
|-------|-----------|
| Booking lifecycle transitions | None |
| Payment capture / webhooks | None |
| Assignment engine / dispatch / recovery commands | None — separate POST routes under `/api/admin/bookings/[bookingId]/` |
| RLS policies | None — no migrations in 6C |
| Admin home summary cards | None — `getAdminOperationsSummary` still calls `listAdminBookings` without filters (unchanged cap semantics) |
| Assignment queue (`/admin/assignments`) | None — separate `listAdminAssignmentQueue` |

---

## Known limitations (in scope / deferred)

| Item | Status |
|------|--------|
| Customer **email** in search | **Deferred** (not on RLS-visible columns) |
| Cursor pagination beyond 200 | **Deferred** → 6E / later |
| CSV export of filtered set | **Deferred** → **6E** |
| Unfiltered list exact `matchTotal` | **Out of 6C scope** — only filtered/search/date queries get exact counts |
| Assignment filter pre-queries | Extra reads on `assignment_offers` / `payments` when assignment presets active — acceptable for admin volume; indexes not added in 6C |

---

## Doc notes

| Document | Status |
|----------|--------|
| `docs/operations/stage-6-ui-polish.md` | **Current** — 6C-1 through 6C-3d implemented sections |
| `docs/architecture/stage-6c-3*.md` | **Current** — shipped statuses |
| `docs/architecture/stage-6c-3-server-side-assignment-visibility-filters-design.md` | **Current** — all presets server-side |
| `docs/architecture/stage-6c-server-side-admin-booking-filters-design.md` | **Header stale** — still says “6C-1 + 6C-2 shipped”; body is historical design. Operations doc is the live status reference. |

---

## Final recommendation

### Is Stage 6C complete?

**Yes.** Every admin bookings dropdown filter and the documented search/date controls run in SQL before the 200-row cap, with golden-tested assignment parity and honest counts whenever filters are active.

### Safe to move to 6E or 6F?

**Yes.**

| Next stage | Recommendation |
|------------|----------------|
| **6E — CSV export** | **Preferred next step** if ops needs exports: 6C established the exact filtered `matchTotal` and SQL WHERE semantics that 6E should reuse (may require pagination or batched reads above 200). |
| **6F — cleaner mobile polish** | **Independent** — no dependency on 6C; safe in parallel. |

**Risk level for closing 6C:** **Low** for production read paths, with the documented caveats above (unfiltered list cap, no email search, assignment pre-query cost).
