# Stage 6F — Cleaner Mobile Polish Mini Audit

**Date:** 2026-05-18  
**Type:** Audit only — no code changes  
**Scope:** Shipped 6F slices — 6F-1a, 6F-1b, 6F-2a, 6F-2c-a  
**Related:** [stage-6f-cleaner-mobile-polish-design.md](../architecture/stage-6f-cleaner-mobile-polish-design.md), [stage-6f-2-cleaner-offers-mobile-layout-design.md](../architecture/stage-6f-2-cleaner-offers-mobile-layout-design.md), [stage-6f-2c-cleaner-offer-decline-confirmation-design.md](../architecture/stage-6f-2c-cleaner-offer-decline-confirmation-design.md), [stage-6-ui-polish.md](../operations/stage-6-ui-polish.md)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Cleaner nav consistency | **Pass** |
| Display-only job status labels | **Pass** (job surfaces); **Partial** (lifecycle timeline) |
| Offers/jobs error vs empty | **Pass** |
| Offer expiry visibility | **Pass** |
| Offers sectioning | **Pass** |
| Mobile action spacing | **Pass** |
| Decline confirmation | **Pass** |
| Accept one-tap | **Pass** |
| Decline API unchanged | **Pass** |
| Assignment / redispatch unchanged | **Pass** |
| Earnings formulas unchanged | **Pass** |
| RLS unchanged | **Pass** |
| Notifications unchanged | **Pass** |
| Tests + typecheck | **Pass** (36 tests) |
| Docs updated | **Pass** (minor stale cross-ref — see §Doc notes) |

**Overall:** Stage **6F** shipped work is **safe to pause here** for assignment and API boundaries. Remaining 6F items (6F-2b home expiry preview, 6F-3 jobs sectioning, 6F-4 sticky actions, 6F-5 bottom nav) are **UX polish**, not safety blockers.

**Recommendation:** Pause unless product priority demands jobs triage next — then prefer **6F-3** (jobs sectioning + home active count fix) over **6F-2b** (home offer expiry line alone).

---

## Shipped slices inventory

| Slice | Deliverables |
|-------|----------------|
| **6F-1a** | `CLEANER_NAV_ITEMS`; `labelForCleanerJobStatus` / `toneForCleanerJobStatus` on job cards/detail/home previews |
| **6F-1b** | `DashboardFetchError` on offers/jobs; home fetch-error hints; friendly empty copy |
| **6F-2a** | `formatOfferExpiryDisplay`, `OfferExpiryChip`, `partitionCleanerOffers`, `CleanerOfferCard`, mobile `OfferActions` spacing, offers sections |
| **6F-2c-a** | `DeclineOfferConfirmSheet`, decline confirm wiring, summary props, a11y |

**Not shipped (by design):** 6F-2b, 6F-3, 6F-4, 6F-5, decline reasons, sticky bars, bottom nav.

---

## Audit checklist

| # | Check | Verdict | Evidence |
|---|--------|---------|----------|
| 1 | Cleaner nav consistent | **Pass** | `cleanerNav.ts` — Home, Offers, Jobs, Earnings; all five routes use `nav={[...CLEANER_NAV_ITEMS]}` (`page.tsx`, `offers`, `jobs`, `jobs/[bookingId]`, `earnings`); `cleanerNav.test.ts`, `cleanerPagesStage6f1a.test.ts` |
| 2 | Job labels display-only | **Pass** / **Partial** | **Pass:** `labelForCleanerJobStatus` on home job previews, jobs list, job detail badge only; `labelForBookingStatus` unchanged; `statusLabels.test.ts` asserts admin labels unchanged. **Partial:** `humanAuditStatusTitle` in `lifecycleTimelinePresentation.ts` still uses `labelForBookingStatus` for `audience === "cleaner"` on timeline rows — not job badges; no DB status change |
| 3 | Offers/jobs error vs empty | **Pass** | Offers: `!result.ok` → `DashboardFetchError` before empty (`offers/page.tsx`). Jobs: same (`jobs/page.tsx`). Home: `—` + inline hint + section `DashboardFetchError` (`page.tsx`). `cleanerPagesStage6f1b.test.ts` |
| 4 | Offer expiry visible | **Pass** | `OfferExpiryChip` in header + absolute footer on open cards; `formatOfferExpiryDisplay` warning &lt;1h; `formatOfferExpiryDisplay.test.ts`, `CleanerOfferCard.test.tsx` |
| 5 | Offers sectioned | **Pass** | `partitionCleanerOffers` → “Needs your response” + “Past offers”; sort `expiresAt` asc for open; `partitionCleanerOffers.test.ts`, `cleanerPagesStage6f2a.test.ts` |
| 6 | Mobile actions stack safely | **Pass** | `OfferActions`: `flex-col gap-3 min-h-11 w-full` on mobile; `md:flex-row` desktop; `OfferActions.test.tsx` |
| 7 | Decline requires confirmation | **Pass** | Decline → `openDeclineConfirm`; confirm → `respond("decline")`; `DeclineOfferConfirmSheet`; `OfferActions.test.tsx`, `cleanerPagesStage6f2c.test.ts` |
| 8 | Accept one-tap | **Pass** | `onClick={() => respond("accept")}` direct; no confirm wrapper; navigate on success unchanged |
| 9 | Decline API payload unchanged | **Pass** | `decline/route.ts`: `POST` with `_request` unused; no `request.json()`; `declineCleanerOffer` → `DECLINE_CLEANER_ASSIGNMENT`; `cleanerPagesStage6f2c.test.ts`, `cleanerMutationRoutes.test.ts` |
| 10 | Assignment / redispatch unchanged | **Pass** | No edits to `respondToOffer.ts`, `handleOfferDeclinedFollowUp`, `executeBookingCommand` decline branch, or accept route in 6F scope; UI-only layer |
| 11 | Earnings formulas unchanged | **Pass** | `resolveCleanerEarningsDisplay` / `computeCleanerEarnings` not modified; cards display existing `earningsLabel` only |
| 12 | RLS unchanged | **Pass** | No new Supabase migrations in 6F; cleaner read models use existing queries |
| 13 | Notifications unchanged | **Pass** | No changes to outbox worker, templates, or enqueue paths in 6F files |
| 14 | Tests pass | **Pass** | `npm run typecheck` — pass; 13 files / **36 tests** — pass (see §Test run) |
| 15 | Docs updated | **Pass** | `stage-6-ui-polish.md` sections 6F-1a, 6F-1b, 6F-2a, 6F-2c-a; architecture docs marked shipped; see §Doc notes |

---

## Accessibility review (6F-2c-a)

| Requirement | Verdict | Notes |
|-------------|---------|-------|
| `role="dialog"` / `aria-modal` | **Pass** | `DeclineOfferConfirmSheet.tsx` |
| Labelled title + description | **Pass** | `aria-labelledby` / `aria-describedby` |
| Focus trap (Tab) | **Pass** | Panel-scoped focusable cycle |
| Escape closes | **Pass** | Blocked while `loading` |
| Backdrop closes | **Pass** | `aria-hidden` backdrop click |
| Cancel closes | **Pass** | “Keep offer” + initial focus |
| Focus return to Decline | **Pass** | `returnFocusRef` on cleanup |
| Error announced | **Pass** | `role="alert"` in sheet |
| Touch targets | **Pass** | `min-h-11` on sheet buttons |
| Reduced motion | **Pass** | `motion-reduce:transition-none` on panel |

**Manual QA still recommended:** iOS Safari focus trap + VoiceOver on device (not automated).

---

## Known gaps (deferred — not failures)

| Gap | Stage | Risk |
|-----|-------|------|
| Home offer previews lack expiry chip | 6F-2b | Low — offers list has full expiry UX |
| Jobs list not sectioned (in progress / upcoming / completed) | 6F-3 | Medium — scan noise; no mutation risk |
| Home “Active jobs” count includes `payout_ready` / `paid_out` (`status !== "completed"`) | 6F-3 | Low — display-only miscount |
| Earnings page conflates fetch error with empty (`!result.ok \|\| length === 0`) | Optional follow-up | Low — same class of bug fixed on offers/jobs in 6F-1b |
| Cleaner lifecycle timeline uses ops booking labels | Optional | Low — timeline only, not badges |
| Sticky job actions, bottom nav | 6F-4 / 6F-5 | N/A — not started |

---

## Backend / API boundary verification

```text
Decline flow (unchanged server path):

  OfferActions → POST /api/cleaner/offers/[offerId]/decline (no body)
              → declineCleanerOffer()
              → DECLINE_CLEANER_ASSIGNMENT
              → handleOfferDeclinedFollowUp() (when not idempotent)

Accept flow (unchanged):

  OfferActions → POST …/accept (no body)
              → acceptCleanerOffer()
              → navigate to /cleaner/jobs/[bookingId] on success
```

| File | 6F change |
|------|-----------|
| `src/app/api/cleaner/offers/[offerId]/decline/route.ts` | None |
| `src/app/api/cleaner/offers/[offerId]/accept/route.ts` | None |
| `src/features/assignments/server/respondToOffer.ts` | None |
| `src/features/pricing/server/computeCleanerEarnings.ts` | None |
| `supabase/migrations/*` (6F period) | None for cleaner UI polish |

---

## Test run

```bash
npm run typecheck
# exit 0

npm run test -- \
  src/features/dashboards/cleanerNav.test.ts \
  src/features/bookings/server/statusLabels.test.ts \
  src/app/(cleaner)/cleaner/cleanerPagesStage6f1a.test.ts \
  src/app/(cleaner)/cleaner/cleanerPagesStage6f1b.test.ts \
  src/app/(cleaner)/cleaner/cleanerPagesStage6f2a.test.ts \
  src/app/(cleaner)/cleaner/cleanerPagesStage6f2c.test.ts \
  src/features/dashboards/server/formatOfferExpiryDisplay.test.ts \
  src/features/dashboards/server/partitionCleanerOffers.test.ts \
  src/components/dashboard/OfferExpiryChip.test.tsx \
  src/components/dashboard/CleanerOfferCard.test.tsx \
  src/components/dashboard/OfferActions.test.tsx \
  src/components/dashboard/DeclineOfferConfirmSheet.test.tsx \
  src/app/api/cleaner/cleanerMutationRoutes.test.ts
# 13 files, 36 tests, all pass
```

---

## Doc notes

| Doc | Status |
|-----|--------|
| `docs/operations/stage-6-ui-polish.md` | **Current** — 6F-1a, 6F-1b, 6F-2a, 6F-2c-a sections present |
| `docs/architecture/stage-6f-cleaner-mobile-polish-design.md` | Parent design; phased plan still lists future 6F-2–5 |
| `docs/architecture/stage-6f-2-cleaner-offers-mobile-layout-design.md` | Header says 6F-2c deferred; **6F-2c-a actually shipped** — update header on next doc pass |
| `docs/architecture/stage-6f-2c-cleaner-offer-decline-confirmation-design.md` | Marked 6F-2c-a shipped |

---

## Final question: Pause or continue?

### Is 6F safe enough to pause here?

**Yes.** The shipped slices meet the Stage 6 presentation-only guarantee:

- No assignment, earnings, RLS, notification, or API contract changes detected.
- Highest-risk mobile control (decline) now has confirmation + a11y.
- Offers triage (expiry, sections, error vs empty) is materially improved.

Pausing does **not** block production from an assignment-safety perspective.

### Should we continue to 6F-2b and/or 6F-3?

| Option | Value | Effort | Suggestion |
|--------|-------|--------|------------|
| **Pause 6F** | Ship current polish; pick up later | None | **Reasonable default** if other stages have higher priority |
| **6F-2b** — home preview expiry | Consistency with offers list; low risk | Low | Nice-to-have; do with or after 6F-3 |
| **6F-3** — jobs sectioning + home active fix | Better day-of-work triage; fixes misleading home count | Low–medium | **Best next slice** if continuing 6F |
| **6F-4** — sticky job actions | High mobile value; medium regression risk | Medium | After 6F-3 or device QA on current work |
| **6F-5** — bottom nav | Broad shell touch | Medium | Last |

**Recommended order if continuing:** **6F-3 → 6F-2b → (device QA) → 6F-4 → 6F-5**.

Optional quick win before pause: earnings page error vs empty (same pattern as 6F-1b, ~15 lines).

---

## Sign-off

| Role | Result |
|------|--------|
| Assignment safety | **No regression identified** |
| API / RLS / notifications | **Unchanged** |
| Accessibility (decline confirm) | **Adequate for ship**; device soak advised |
| Test coverage | **Adequate for shipped scope** |
| **6F pause recommendation** | **Approved**
