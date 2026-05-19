import {
  UI_CARD_PADDING_COMPACT,
  UI_EYEBROW_LABEL_CLASS,
} from "@/lib/ui/productUiTokens";

/** Presentation tokens for cleaner dashboard list/offer surfaces (no business logic). */

export const CLEANER_LIST_CARD_PADDING = UI_CARD_PADDING_COMPACT;

export const CLEANER_SERVICE_EYEBROW_CLASS = `break-words ${UI_EYEBROW_LABEL_CLASS}`;

export const CLEANER_EARNINGS_HERO_CLASS =
  "shrink-0 text-right text-lg font-semibold tabular-nums leading-tight text-zinc-900";

export const CLEANER_EARNINGS_LIST_CLASS =
  "text-sm font-semibold tabular-nums text-zinc-900";

export const CLEANER_META_LINE_CLASS =
  "mt-1 break-words text-sm leading-snug text-zinc-700";

/** Location segment in schedule · location meta rows. */
export const CLEANER_META_LOCATION_CLASS =
  "break-words [overflow-wrap:anywhere] sm:line-clamp-2";

export const CLEANER_BADGE_ROW_CLASS = "mt-2 flex flex-wrap items-center gap-1.5";

export const CLEANER_OFFER_ACTIONS_DIVIDER_CLASS =
  "mt-3 border-t border-zinc-100 pt-3";
