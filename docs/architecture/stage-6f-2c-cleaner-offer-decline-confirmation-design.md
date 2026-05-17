# Stage 6F-2c — Cleaner Offer Decline Confirmation Design

**Date:** 2026-05-18  
**Status:** **6F-2c-a implemented** (decline confirmation sheet + wiring). Decline reasons (6F-2c-b) deferred.  
**Depends on:** [stage-6f-2-cleaner-offers-mobile-layout-design.md](./stage-6f-2-cleaner-offers-mobile-layout-design.md) (6F-2a shipped), [stage-6f-cleaner-mobile-polish-design.md](./stage-6f-cleaner-mobile-polish-design.md)

**Goal:** Reduce accidental decline taps on mobile by adding a confirmation step before declining an offer, **without** changing the decline API, assignment/redispatch logic, notifications, or expiry behavior.

**Non-goals:** Decline reason capture, sticky action bars, bottom nav, new routes, API body fields, changes to `handleOfferDeclinedFollowUp`, notification templates, accept-flow changes.

---

## Executive summary

| Decision | Recommendation |
|----------|----------------|
| UX pattern | **Bottom sheet** on `max-sm`; **centered dialog** on `md+` (not inline double-button, not browser `confirm()`) |
| Accept | **One-tap** unchanged |
| Context in confirm | **Yes** — service, schedule, earnings (read-only summary) |
| Reassign copy | **One neutral line** — job may be offered to others; no ops jargon |
| Decline reason | **Not required** (defer) |
| API | **Unchanged** — `POST /api/cleaner/offers/[offerId]/decline` with empty body |
| Desktop | **Same confirmation** (dialog instead of sheet) |
| Safest first slice | **6F-2c-a** — `DeclineOfferConfirmSheet` + `OfferActions` wiring + display props from `CleanerOfferCard` only |

---

## Current decline behavior

Evidence from `OfferActions.tsx`, `CleanerOfferCard.tsx`, and `src/app/api/cleaner/offers/[offerId]/decline/route.ts`.

| Aspect | Current behavior |
|--------|------------------|
| Trigger | Tap **Decline** → immediate `fetch(…/decline, { method: "POST" })` |
| Request | No body; auth via session |
| Success | `router.refresh()`; card moves to Past offers on reload |
| Failure | Inline red error on `OfferActions` |
| Loading | Both buttons disabled while `loading !== null` |
| Accept | One-tap POST accept; navigate to job detail on success |
| Server | `declineCleanerOffer` → `DECLINE_CLEANER_ASSIGNMENT` command; optional `handleOfferDeclinedFollowUp` (redispatch) when not idempotent |
| Idempotency | Server-side `idempotencyKey: assignment:decline:${offer.id}` |

**Risk after 6F-2a:** Buttons are larger and stacked, but Decline is still a single tap with no undo. Mis-taps remain possible when scrolling or when targeting Accept.

---

## Design question answers

### 1. Should decline confirmation be a modal, sheet, or inline confirm?

| Pattern | Verdict | Rationale |
|---------|---------|-----------|
| **Browser `confirm()`** | **Reject** | Poor a11y branding; cannot show job context; inconsistent on mobile |
| **Inline confirm** (replace Decline with “Sure?” + Cancel) | **Reject** | Layout shift inside card; easy to tap wrong control in list scroll |
| **Bottom sheet** (`max-sm`) | **Adopt** | Thumb-friendly; clear separation from card actions; standard mobile destructive pattern |
| **Centered dialog** (`md+`) | **Adopt** | Appropriate for mouse/keyboard; same content as sheet |

**Recommendation:** One component `DeclineOfferConfirmSheet` (name reflects mobile-first; renders dialog on desktop) with shared inner content.

### 2. What copy should be shown?

| Element | Copy |
|---------|------|
| **Title** | Decline this job offer? |
| **Body (primary)** | You will not be assigned to this booking if you decline. |
| **Body (reassign)** | The job may be offered to another cleaner. |
| **Context block** | Service · schedule · earnings (from card, not editable) |
| **Cancel** | Keep offer |
| **Confirm (destructive)** | Decline offer |
| **Loading** | Declining… on confirm button only |
| **Error** | Show API `message` inside sheet/dialog (same as today on card) |

Tone: plain language, no “command”, “dispatch”, or “redispatch” jargon.

### 3. Should accept remain one-tap?

**Yes.**

| Action | Steps | Rationale |
|--------|-------|-----------|
| **Accept** | 1 tap → POST → refresh / navigate | Positive action; user intent is clear; 6F-2a spacing already reduces mis-tap |
| **Decline** | 1 tap → confirm sheet → confirm → POST | Destructive; harder to undo; extra friction appropriate |

Do not add accept confirmation in 6F-2c.

### 4. Should confirmation show booking/service/schedule?

**Yes — compact read-only summary.**

| Field | Source | Display |
|-------|--------|---------|
| Service | `offer.serviceLabel` | Primary line |
| Schedule | `offer.scheduleLabel` | Secondary |
| Earnings | `offer.earningsLabel` | “Your earnings: R …” |

Optional: location one line if short — **defer** if it lengthens sheet; service + schedule + earnings are sufficient for “wrong job” prevention.

Props passed from `CleanerOfferCard` → `OfferActions` → confirm component (display only).

### 5. Should confirmation explain that declining may reassign the job?

**Yes — one short neutral sentence** (see §2).

| Include | Avoid |
|---------|-------|
| “The job may be offered to another cleaner.” | “System will redispatch”, “admin will assign”, SLA details |
| Implies user is not locked in | Promising immediate reassignment or earnings impact |

No change to `handleOfferDeclinedFollowUp` behavior; copy is expectation-setting only.

### 6. Should a reason be required?

**No — not in 6F-2c.**

| Item | Status |
|------|--------|
| Reason textarea / picklist | **Defer** (future stage if product wants analytics) |
| API field for reason | **Out of scope** — would require command/API change |

Confirm button alone triggers existing POST.

### 7. Should this change API payloads?

**No.**

| Layer | Change |
|-------|--------|
| `POST …/decline` | Still no body; same route handler |
| `declineCleanerOffer` | Unchanged |
| `DECLINE_CLEANER_ASSIGNMENT` | Unchanged |
| Idempotency | Unchanged |
| Response shape | Unchanged `{ ok, bookingId, status, idempotent }` |

Client-only: open sheet → user confirms → same `respond("decline")` function as today.

### 8. Should desktop also confirm decline?

**Yes.**

| Breakpoint | Surface |
|------------|---------|
| `max-sm` | Bottom sheet (full-width panel, backdrop, slide-up optional) |
| `md+` | Centered modal dialog (~`max-w-md`) |

Same copy and buttons; avoids behavioral drift between devices.

### 9. What accessibility requirements apply?

| Requirement | Implementation |
|-------------|----------------|
| **Focus trap** | Tab cycles Cancel + Confirm while open |
| **Initial focus** | Cancel (safer default) or first focusable — **prefer Cancel** |
| **Escape** | Closes sheet/dialog without POST |
| **Backdrop click** | Closes without POST (same as Cancel) |
| **Roles** | `role="dialog"` + `aria-modal="true"` |
| **Labeling** | `aria-labelledby` → title; `aria-describedby` → body + context |
| **Focus return** | On close, return focus to Decline button that opened sheet |
| **Motion** | `prefers-reduced-motion`: no slide animation; instant show/hide |
| **Live region** | Errors: `role="alert"` in dialog |
| **Touch targets** | Confirm/Cancel `min-h-11` on mobile |
| **Color** | Destructive confirm: outline or red text — not only color (label “Decline offer”) |

Do not use `window.confirm`.

### 10. What tests are required?

#### Component tests (`DeclineOfferConfirmSheet.test.tsx`)

| Case | Assert |
|------|--------|
| Renders title, context, both buttons | Copy present |
| Cancel / backdrop / Escape | `onCancel` called; no `onConfirm` |
| Confirm | `onConfirm` called once |
| Confirm while loading | Button disabled |
| `aria-modal`, labelled title | a11y attributes |

Use `renderToStaticMarkup` for closed/open markup where possible; interaction tests optional if test env lacks jsdom — prefer static wiring + manual QA for focus trap.

#### `OfferActions.test.tsx` (extend)

| Case | Assert |
|------|--------|
| Decline click opens confirm (does not fetch immediately) | Source or mocked behavior |
| Confirm triggers same decline URL | Still `POST …/decline` |
| Accept still direct POST | No confirm wrapper |

#### Page wiring (`cleanerPagesStage6f2c.test.ts`)

| Case | Assert |
|------|--------|
| `CleanerOfferCard` passes context props to `OfferActions` | serviceLabel, scheduleLabel, earningsLabel |
| Decline route file untouched | Static read of `decline/route.ts` |

#### Regression

```bash
npm run test -- src/app/api/cleaner/cleanerMutationRoutes.test.ts src/features/dashboards/server/cleanerApiRoutes.test.ts
```

#### Manual QA

1. Decline → sheet opens; Cancel → no network decline.
2. Confirm → POST; card moves to Past.
3. Accept still one-tap → job detail.
4. Double-tap Confirm → single POST (loading guard).
5. VoiceOver / TalkBack: title and buttons announced.
6. Desktop: dialog centered; keyboard Escape closes.

---

## Proposed confirmation UX

### Flow

```
[Decline tap]
     ↓
[Sheet/Dialog open] ──Cancel/Escape/backdrop──→ [Closed, no POST]
     ↓
[Decline offer confirm]
     ↓
[POST /decline] ──ok──→ [refresh list]
              └──fail──→ [error in sheet + keep open]
```

### Mobile sheet (wireframe)

```
┌──────────────────────────────────────┐
│ ░░░░░░░ card list dimmed ░░░░░░░░░░░ │
├──────────────────────────────────────┤
│ Decline this job offer?              │
│                                      │
│ You will not be assigned to this     │
│ booking if you decline.              │
│ The job may be offered to another    │
│ cleaner.                             │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Standard clean                   │ │
│ │ Sat 19 May, 14:00–16:00          │ │
│ │ Your earnings: R 350.00          │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [ Keep offer          ]  (primary)   │
│ [ Decline offer       ]  (destructive)│
└──────────────────────────────────────┘
```

### Desktop dialog

Same content; `max-w-md` centered card; backdrop `bg-black/40`.

---

## Mobile vs desktop behavior

| Aspect | Mobile (`max-sm`) | Desktop (`md+`) |
|--------|-------------------|-----------------|
| Container | Bottom sheet, rounded top, safe-area padding | Centered dialog |
| Button layout | Stacked full-width, Cancel above Decline | Stacked or row (Cancel left, Decline right) |
| Accept on card | Unchanged one-tap | Unchanged |
| Sticky bars | **No** | **No** |

---

## Copy (final strings)

```text
Title:       Decline this job offer?
Body 1:      You will not be assigned to this booking if you decline.
Body 2:      The job may be offered to another cleaner.
Cancel:      Keep offer
Confirm:       Decline offer
Loading:       Declining…
```

Context block (dynamic):

```text
{serviceLabel}
{scheduleLabel}
Your earnings: {earningsLabel}
```

---

## API unchanged guarantee

| Check | Status |
|-------|--------|
| Route path | `POST /api/cleaner/offers/[offerId]/decline` |
| Request body | None |
| Auth / RLS | Unchanged |
| Command type | `DECLINE_CLEANER_ASSIGNMENT` |
| Redispatch follow-up | Unchanged (`handleOfferDeclinedFollowUp`) |
| Notifications | Unchanged (enqueue driven by command, not UI) |
| Expiry display | Unchanged (`formatOfferExpiryDisplay`, chips) |
| Accept route | Unchanged |

**Client diff only:** interpose confirmation UI before calling existing `respond("decline")`.

---

## Phased implementation plan

| Phase | ID | Deliverables | Risk |
|-------|-----|--------------|------|
| **1** | **6F-2c-a** | `DeclineOfferConfirmSheet`; extend `OfferActions` with `open` state; pass display props from `CleanerOfferCard`; a11y + reduced motion; tests | **Low–medium** — **shipped** |
| **Defer** | 6F-2c-b | Decline reason optional field + API (only if product approves command change) | High — out of current scope |
| **Defer** | 6F-2b | Home preview expiry using same formatter | Low — independent |

**Files expected (implementation reference only):**

| File | Change |
|------|--------|
| `src/components/dashboard/DeclineOfferConfirmSheet.tsx` | **New** |
| `src/components/dashboard/OfferActions.tsx` | Open sheet on Decline; confirm → existing POST |
| `src/components/dashboard/CleanerOfferCard.tsx` | Pass `serviceLabel`, `scheduleLabel`, `earningsLabel` to `OfferActions` |
| `*test.tsx` | Component + wiring |

**Explicitly not changed:** `decline/route.ts`, `respondToOffer.ts`, `executeBookingCommand`, notification templates.

---

## Test strategy

| Layer | Path |
|-------|------|
| Unit/component | `DeclineOfferConfirmSheet.test.tsx` |
| Component wiring | `OfferActions.test.tsx` |
| Page wiring | `cleanerPagesStage6f2c.test.ts` |
| API guard | `cleanerMutationRoutes.test.ts` |
| Manual | 6-step checklist in §10 |

---

## Final recommendation

### Safest first implementation slice: **6F-2c-a — Decline confirm sheet + OfferActions wiring only**

| Deliverable | Why safest |
|-------------|------------|
| New `DeclineOfferConfirmSheet` (presentational + callbacks) | Isolated UI; no server changes |
| `OfferActions`: Decline opens sheet; Confirm calls existing `respond("decline")` | Single mutation path preserved |
| Display props from `CleanerOfferCard` only | No new API reads |
| Cancel / Escape / backdrop = close without POST | Easy to verify |
| Accept path untouched | No regression on happy path |
| **Exclude** decline reason, analytics, API changes, sticky bars | Scope control |

**Do not** use browser `confirm()`, inline card replacement, or a second Decline button on the card.

**Ship order:** Implement 6F-2c-a after 6F-2a is verified on a real device; run manual decline-cancel QA before merge.

---

## Related files

| Area | Path |
|------|------|
| Offer actions | `src/components/dashboard/OfferActions.tsx` |
| Offer card | `src/components/dashboard/CleanerOfferCard.tsx` |
| Decline API | `src/app/api/cleaner/offers/[offerId]/decline/route.ts` |
| Command | `src/features/assignments/server/respondToOffer.ts` |
| Parent 6F-2 | `docs/architecture/stage-6f-2-cleaner-offers-mobile-layout-design.md` |
| Ops status | `docs/operations/stage-6-ui-polish.md` |

---

## Design checklist (requirements trace)

| Requirement | Section |
|-------------|---------|
| Current behavior | [Current decline behavior](#current-decline-behavior) |
| Confirmation UX | [Proposed confirmation UX](#proposed-confirmation-ux) |
| Mobile/desktop | [Mobile vs desktop behavior](#mobile-vs-desktop-behavior) |
| Copy | [Copy (final strings)](#copy-final-strings) |
| a11y | [Accessibility requirements](#9-what-accessibility-requirements-apply) |
| API guarantee | [API unchanged guarantee](#api-unchanged-guarantee) |
| Phased plan | [Phased implementation plan](#phased-implementation-plan) |
| Tests | [Test strategy](#test-strategy) |
| Safest slice | [Final recommendation](#final-recommendation) |
