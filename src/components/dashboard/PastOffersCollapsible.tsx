import type { ReactNode } from "react";
import {
  UI_DETAILS_DISCLOSURE_CLASS,
  UI_DETAILS_SUMMARY_CLASS,
} from "@/lib/ui/productUiTokens";

type Props = {
  count: number;
  children: ReactNode;
};

/** Collapsed-by-default historical offers (presentation only). */
export function PastOffersCollapsible({ count, children }: Props) {
  if (count === 0) return null;

  return (
    <details className={`${UI_DETAILS_DISCLOSURE_CLASS} group mt-4`}>
      <summary
        className={`${UI_DETAILS_SUMMARY_CLASS} list-none [&::-webkit-details-marker]:hidden`}
      >
        <span>Past offers ({count})</span>
        <span
          className="text-xs font-normal text-zinc-500 transition-transform group-open:rotate-180"
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-zinc-100 px-1 py-2">{children}</div>
    </details>
  );
}
