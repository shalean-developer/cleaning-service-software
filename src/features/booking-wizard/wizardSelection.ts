/** Shared zinc selection chrome for wizard pickers (presentation only). */

export const WIZARD_FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900";

export const WIZARD_CARD_SELECTED =
  "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900/10 shadow-[0_1px_2px_rgba(24,24,27,0.06),0_4px_14px_rgba(24,24,27,0.08)]";

export const WIZARD_CARD_UNSELECTED =
  "border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)] hover:border-zinc-300 hover:bg-zinc-50/50";

export const WIZARD_CARD_TRANSITION =
  "transition-[border-color,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none";

export function wizardCardClass(selected: boolean): string {
  return selected ? WIZARD_CARD_SELECTED : WIZARD_CARD_UNSELECTED;
}
