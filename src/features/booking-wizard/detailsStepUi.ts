/** Step 4 details presentation tokens (no pricing or form behavior). */

import {
  WIZARD_CARD_TRANSITION,
  WIZARD_FOCUS_RING,
} from "./wizardSelection";

export { WIZARD_CARD_TRANSITION, WIZARD_FOCUS_RING };

export const DETAILS_STEP_SECTION = "mb-4 min-w-0 last:mb-0";

export const DETAILS_STEP_TITLE = "text-base font-semibold tracking-tight text-zinc-900 sm:text-lg";

export const DETAILS_STEP_INTRO = "mt-1 text-sm leading-snug text-zinc-600";

/** Extra rooms + equipment + team support row on the details step. */
export const DETAILS_OPTION_ROW_GRID =
  "grid grid-cols-1 items-stretch gap-3 sm:gap-3 md:grid-cols-3";

export const DETAILS_OPTION_ROW_CELL =
  "flex h-full min-h-0 flex-col [&_.wizard-field]:mb-0";

export const DETAILS_STEP_SECTION_ROW = "mb-0 flex h-full min-w-0 flex-col";

export const DETAILS_STEP_LABEL = "mb-1.5 block text-sm font-medium text-zinc-800";

export const DETAILS_STEP_HINT = "mb-1.5 text-xs leading-snug text-zinc-500";

export const DETAILS_OPTION_TITLE = "block text-sm font-medium leading-snug text-zinc-900";

export const DETAILS_OPTION_DESC = "mt-0.5 block text-[11px] leading-snug text-zinc-500 sm:text-xs";

/** Step 4 section headings — presentation only. */
export const DETAILS_SECTION_HEADING =
  "mb-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500";

/** Step 4 option-row info tooltips — presentation only. */
export const EXTRA_ROOMS_INFO_TEXT =
  "Add extra spaces such as a study, laundry, playroom, or second lounge.";

export const BRING_EQUIPMENT_INFO_TEXT =
  "Adds R100. Cleaner arrives with Shalean supplies and equipment.";

export const REQUEST_TWO_CLEANERS_INFO_TEXT =
  "Adds R200. Helps us plan a faster clean when available. We'll confirm team availability after payment.";

export const DETAILS_OPTION_CARD =
  "flex h-full min-h-[4.25rem] min-w-0 flex-col justify-center rounded-xl border px-3 py-2.5 text-left sm:py-3";

export const DETAILS_INPUT =
  "w-full min-h-[2.75rem] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";

/** Compact toggle row — label/hint above, switch in this row. */
export const DETAILS_TOGGLE_CONTROL =
  "flex w-full items-center justify-end rounded-lg border border-zinc-200/90 bg-zinc-50/50 px-2.5 py-2";

export const DETAILS_CARD_SELECTED =
  "border-zinc-900 bg-zinc-50 ring-1 ring-inset ring-zinc-900/[0.08] shadow-sm";

export const DETAILS_CARD_UNSELECTED =
  "border-zinc-200/90 bg-white shadow-sm hover:border-zinc-300 hover:bg-zinc-50/60";

export function detailsCardClass(selected: boolean): string {
  return selected ? DETAILS_CARD_SELECTED : DETAILS_CARD_UNSELECTED;
}
