"use client";

import type { AddonSlug } from "@/features/pricing/server/types";
import { UI_DETAILS_DISCLOSURE_CLASS, UI_DETAILS_SUMMARY_CLASS } from "@/lib/ui/productUiTokens";
import { getAddonsSectionTitle } from "../airbnbCleaningDisplay";
import type { ServiceSlug } from "@/features/pricing/server/types";

type Props = {
  serviceSlug: ServiceSlug | null;
  selected: AddonSlug[];
  children: React.ReactNode;
};

/** Collapsible add-ons block on the details step (selected extras stay visible in summary). */
export function DetailsExtrasDisclosure({ serviceSlug, selected, children }: Props) {
  const count = selected.length;
  const summaryLabel =
    count > 0 ? `${getAddonsSectionTitle(serviceSlug)} (${count} selected)` : "Add extras";

  return (
    <details
      className={`${UI_DETAILS_DISCLOSURE_CLASS} group`}
      open={count > 0}
    >
      <summary className={`${UI_DETAILS_SUMMARY_CLASS} list-none [&::-webkit-details-marker]:hidden`}>
        <span>{summaryLabel}</span>
        <span
          className="text-xs font-normal text-zinc-500 transition-transform group-open:rotate-180"
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-zinc-100 px-3.5 py-3 sm:px-4">{children}</div>
    </details>
  );
}
