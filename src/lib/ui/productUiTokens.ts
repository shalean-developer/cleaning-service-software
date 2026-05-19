/**
 * Phase 2F — shared presentation tokens across customer, cleaner, admin, and booking.
 * Presentation only; no business logic.
 */

/** Primary elevated surface (cards, panels). */
export const UI_CARD_SHELL_CLASS =
  "rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

/** List cards with softer border (hover affordance). */
export const UI_CARD_SHELL_SOFT_BORDER_CLASS =
  "rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

export const UI_CARD_PADDING_COMPACT = "p-3.5 sm:p-4";

export const UI_CARD_PADDING_DEFAULT = "p-4 sm:p-5";

/** Nested inset blocks inside cards. */
export const UI_INSET_PANEL_CLASS = "rounded-xl border border-zinc-200 bg-zinc-50/80";

/** Vertical rhythm between sections on a page. */
export const UI_PAGE_SECTION_GAP_CLASS = "mt-5 sm:mt-6";

/** Stack spacing inside cards and lists. */
export const UI_SECTION_STACK_CLASS = "space-y-3";

export const UI_LIST_STACK_CLASS = "space-y-3";

/** Section headings. */
export const UI_SECTION_TITLE_CLASS = "text-sm font-semibold text-zinc-900";

export const UI_SECTION_SUBTITLE_CLASS = "text-sm font-medium text-zinc-800";

/** Service / operational eyebrow labels. */
export const UI_EYEBROW_LABEL_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-sky-800";

export const UI_HELPER_TEXT_CLASS = "text-xs leading-snug text-zinc-500";

export const UI_BODY_MUTED_CLASS = "text-sm leading-relaxed text-zinc-600";

/** Empty and fetch-error shells (centered). */
export const UI_EMPTY_STATE_SHELL_CLASS = `${UI_CARD_SHELL_CLASS} px-5 py-8 text-center sm:px-6 sm:py-10`;

export const UI_FETCH_ERROR_SHELL_CLASS =
  "rounded-2xl border border-zinc-200 bg-zinc-50/90 px-5 py-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-6 sm:py-10";

export const UI_EMPTY_STATE_TITLE_CLASS = "text-base font-medium text-zinc-900";

export const UI_EMPTY_STATE_DESCRIPTION_CLASS = "mt-2 text-sm leading-relaxed text-zinc-600";

export const UI_EMPTY_STATE_ACTIONS_CLASS = "mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center";

/** Collapsible details/summary (progressive disclosure). */
export const UI_DETAILS_DISCLOSURE_CLASS = `${UI_CARD_SHELL_CLASS} group`;

export const UI_DETAILS_SUMMARY_CLASS =
  "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-sm font-medium text-zinc-800 marker:content-none outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden sm:px-4";

/** Admin operational guides and queue summaries. */
export const UI_DETAILS_SUMMARY_COMPACT_CLASS =
  "flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-zinc-800 marker:content-none outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden sm:px-4";

export const UI_DETAILS_BODY_CLASS = "border-t border-zinc-100 px-3.5 py-3 sm:px-4";

/** Primary / secondary CTAs (44px touch target on mobile). */
export const UI_BUTTON_PRIMARY_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.12)] transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const UI_BUTTON_SECONDARY_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Link-wrapped list cards. */
export const UI_LINK_CARD_INTERACTION_CLASS =
  "transition-[border-color,box-shadow] hover:border-zinc-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2";

export const UI_INTERACTIVE_LIST_CARD_CLASS = `block ${UI_CARD_SHELL_SOFT_BORDER_CLASS} ${UI_CARD_PADDING_COMPACT} ${UI_LINK_CARD_INTERACTION_CLASS}`;

/** Skeleton pulse blocks. */
export const UI_SKELETON_PULSE_CLASS = "block animate-pulse rounded-lg bg-zinc-200";

export const UI_SKELETON_LIST_CARD_CLASS = `${UI_CARD_SHELL_CLASS} ${UI_CARD_PADDING_COMPACT}`;

/** Filter/chip nav: horizontal scroll on narrow viewports, wrap from sm. */
export const UI_FILTER_CHIP_NAV_CLASS =
  "-mx-1 flex gap-2 overflow-x-auto scroll-px-1 px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0";

/** Long detail values (addresses, addon lists, payment refs). */
export const UI_DETAIL_VALUE_CLASS = "min-w-0 break-words [overflow-wrap:anywhere]";

/** List card titles and meta lines. */
export const UI_LIST_TITLE_CLASS = "break-words text-sm font-semibold text-zinc-900";

export const UI_LIST_META_CLASS =
  "break-words text-sm text-zinc-600 [overflow-wrap:anywhere]";

/** Secondary location segment in schedule · location rows. */
export const UI_META_LOCATION_CLASS = "break-words [overflow-wrap:anywhere]";
