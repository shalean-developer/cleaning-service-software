/** Step 4 details presentation tokens (no pricing or form behavior). */

import {
  WIZARD_CARD_TRANSITION,
  WIZARD_FOCUS_RING,
  WIZARD_INPUT_FOCUS,
  WIZARD_TEXT_LABEL,
  WIZARD_TEXT_MUTED,
  WIZARD_TEXT_PRIMARY,
  WIZARD_TEXT_SECONDARY,
} from "./wizardTheme";

export { WIZARD_CARD_TRANSITION, WIZARD_FOCUS_RING };

export const DETAILS_STEP_SECTION = "mb-4 min-w-0 last:mb-0";

export const DETAILS_STEP_TITLE = `text-base font-semibold tracking-tight ${WIZARD_TEXT_PRIMARY} sm:text-lg`;

export const DETAILS_STEP_INTRO = `mt-1 text-sm leading-snug ${WIZARD_TEXT_SECONDARY}`;

/** Equipment + team support row on the details step (regular cleaning). */
export const DETAILS_OPTION_ROW_GRID =
  "grid grid-cols-1 items-stretch gap-3 sm:gap-3 md:grid-cols-2";

export const DETAILS_OPTION_ROW_CELL =
  "flex h-full min-h-0 flex-col [&_.wizard-field]:mb-0";

export const DETAILS_STEP_SECTION_ROW = "mb-0 flex h-full min-w-0 flex-col";

export const DETAILS_STEP_LABEL = `mb-1.5 block text-sm font-medium ${WIZARD_TEXT_LABEL}`;

export const DETAILS_STEP_HINT = `mb-1.5 text-xs leading-snug ${WIZARD_TEXT_MUTED}`;

export const DETAILS_OPTION_TITLE = `block text-sm font-medium leading-snug ${WIZARD_TEXT_PRIMARY}`;

export const DETAILS_OPTION_DESC = `mt-0.5 block text-[11px] leading-snug ${WIZARD_TEXT_MUTED} sm:text-xs`;

/** Step 4 section headings. presentation only. */
export const DETAILS_SECTION_HEADING =
  `mb-2.5 text-xs font-semibold uppercase tracking-wide ${WIZARD_TEXT_MUTED}`;

/** Step 4 option-row info tooltips. presentation only. */
export const EXTRA_ROOMS_INFO_TEXT =
  "Add extra spaces such as a study, laundry, playroom, or second lounge.";

export const BRING_EQUIPMENT_INFO_TEXT =
  "Adds R100. Cleaner arrives with Shalean supplies and equipment.";

export const REQUEST_TWO_CLEANERS_INFO_TEXT =
  "Adds R200. Helps us plan a faster clean when available. We'll confirm team availability after payment.";

export const DETAILS_OPTION_CARD =
  "flex h-full min-h-[4.25rem] min-w-0 flex-col justify-center rounded-xl border px-3 py-2.5 text-left sm:py-3";

export const DETAILS_INPUT = `w-full min-h-[2.75rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ${WIZARD_TEXT_PRIMARY} outline-none ${WIZARD_INPUT_FOCUS}`;

/** Compact toggle row. label/hint above, switch in this row. */
export const DETAILS_TOGGLE_CONTROL =
  "flex w-full items-center justify-end rounded-lg border border-slate-200/90 bg-shalean-soft-blue/30 px-2.5 py-2";

export const DETAILS_CARD_SELECTED =
  "border-shalean-primary bg-shalean-soft-blue/50 ring-1 ring-inset ring-shalean-primary/10 shadow-sm";

export const DETAILS_CARD_UNSELECTED =
  "border-slate-200/90 bg-white shadow-sm hover:border-slate-300 hover:bg-shalean-soft-blue/30";

export function detailsCardClass(selected: boolean): string {
  return selected ? DETAILS_CARD_SELECTED : DETAILS_CARD_UNSELECTED;
}
