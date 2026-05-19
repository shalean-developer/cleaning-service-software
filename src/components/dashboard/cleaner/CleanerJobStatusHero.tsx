import type { ReactNode } from "react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CleanerPayDisplay } from "@/components/dashboard/cleaner/CleanerPayDisplay";
import {
  CLEANER_BADGE_ROW_CLASS,
  CLEANER_LIST_CARD_PADDING,
  CLEANER_META_LINE_CLASS,
  CLEANER_SERVICE_EYEBROW_CLASS,
} from "@/features/dashboards/cleanerDashboardDisplay";
import {
  CLEANER_DETAIL_CARD_CLASS,
  CLEANER_DETAIL_INSET_CLASS,
  cleanerJobStatusHero,
} from "@/features/dashboards/cleanerJobDetailDisplay";
import { labelForCleanerJobStatus } from "@/features/bookings/server/statusLabels";
import type { BookingStatus } from "@/features/bookings/server/types";

type Props = {
  serviceLabel: string;
  scheduleLabel: string;
  locationSummary: string;
  earningsLabel: string;
  status: BookingStatus;
  actionSlot?: ReactNode;
};

export function CleanerJobStatusHero({
  serviceLabel,
  scheduleLabel,
  locationSummary,
  earningsLabel,
  status,
  actionSlot,
}: Props) {
  const hero = cleanerJobStatusHero(status);

  return (
    <section className={`${CLEANER_DETAIL_CARD_CLASS} overflow-hidden`}>
      <div className={`border-b border-zinc-100 ${CLEANER_LIST_CARD_PADDING}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={CLEANER_SERVICE_EYEBROW_CLASS}>{serviceLabel}</p>
            <p className={CLEANER_META_LINE_CLASS}>
              <span className="font-medium text-zinc-900">{scheduleLabel}</span>
              <span className="text-zinc-400"> · </span>
              <span>{locationSummary}</span>
            </p>
          </div>
          <CleanerPayDisplay
            earningsLabel={earningsLabel}
            includeCalculatingHelper
            className="shrink-0 text-right"
          />
        </div>
        <div className={CLEANER_BADGE_ROW_CLASS}>
          <StatusBadge
            label={labelForCleanerJobStatus(status)}
            tone={hero.tone}
            variant="soft"
          />
        </div>
      </div>

      {hero.expectedUpdate ? (
        <p
          className={`mx-3.5 mb-3.5 text-xs text-zinc-600 sm:mx-4 sm:mb-4 ${CLEANER_DETAIL_INSET_CLASS} px-3 py-2`}
        >
          <span className="font-medium text-zinc-700">Next:</span> {hero.expectedUpdate}
        </p>
      ) : (
        <p className="mx-3.5 mb-3.5 px-1 text-xs leading-snug text-zinc-600 sm:mx-4 sm:mb-4">
          {hero.description}
        </p>
      )}

      {actionSlot ? (
        <div className="border-t border-zinc-100 px-3.5 py-3 sm:px-4">{actionSlot}</div>
      ) : null}
    </section>
  );
}
