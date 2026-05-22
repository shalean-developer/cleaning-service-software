/**
 * Booking wizard palette — aligned with marketing homepage (shalean-* + slate).
 */

export const WIZARD_SHELL_BG = "bg-shalean-surface";

export const WIZARD_TEXT_PRIMARY = "text-shalean-navy";
export const WIZARD_TEXT_SECONDARY = "text-slate-600";
export const WIZARD_TEXT_MUTED = "text-slate-500";
export const WIZARD_TEXT_LABEL = "text-slate-700";

export const WIZARD_FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shalean-primary";

export const WIZARD_INPUT_FOCUS =
  "focus:border-shalean-primary/80 focus:ring-2 focus:ring-shalean-primary/10";

export const WIZARD_CARD_SELECTED =
  "border-shalean-primary bg-shalean-soft-blue/50 ring-1 ring-shalean-primary/10 shadow-[0_1px_2px_rgba(37,99,235,0.06),0_4px_14px_rgba(37,99,235,0.08)]";

export const WIZARD_CARD_UNSELECTED =
  "border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-shalean-soft-blue/30";

export const WIZARD_CARD_TRANSITION =
  "transition-[border-color,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none";

export const WIZARD_BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-xl bg-shalean-primary text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

export const WIZARD_BTN_PRIMARY_SHADOW =
  "shadow-[0_2px_10px_rgba(37,99,235,0.25)]";

export const WIZARD_BTN_SECONDARY =
  "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-shalean-soft-blue/40 hover:text-shalean-navy disabled:opacity-50";

export const WIZARD_STEPPER_ACTIVE = "bg-shalean-primary text-white";
export const WIZARD_STEPPER_DONE = "bg-shalean-soft-blue text-shalean-primary";
export const WIZARD_STEPPER_PENDING = "bg-slate-100 text-slate-500";

export const WIZARD_PROGRESS_ACTIVE = "bg-shalean-primary";
export const WIZARD_PROGRESS_DONE = "bg-shalean-primary/35";
export const WIZARD_PROGRESS_PENDING = "bg-slate-200";

export const WIZARD_TOGGLE_ON = "bg-shalean-primary";
export const WIZARD_TOGGLE_OFF = "bg-slate-200";

export const WIZARD_BADGE = "bg-shalean-primary text-white";

export function wizardCardClass(selected: boolean): string {
  return selected ? WIZARD_CARD_SELECTED : WIZARD_CARD_UNSELECTED;
}
