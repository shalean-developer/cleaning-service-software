import type { ReactNode } from "react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
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
      <div className="border-b border-zinc-100 px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">{serviceLabel}</p>
        <div className="mt-2">
          <StatusBadge
            label={labelForCleanerJobStatus(status)}
            tone={hero.tone}
            variant="soft"
          />
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-zinc-500">When</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900">{scheduleLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">Where</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900">{locationSummary}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-zinc-500">Your pay</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">{earningsLabel}</dd>
          </div>
        </dl>
      </div>

      <div className={`mx-4 mb-4 px-4 py-3.5 sm:mx-5 sm:mb-5 ${CLEANER_DETAIL_INSET_CLASS}`}>
        <p className="text-sm leading-relaxed text-zinc-700">{hero.description}</p>
        {hero.expectedUpdate ? (
          <p className="mt-2 text-xs text-zinc-500">
            <span className="font-medium text-zinc-600">Next:</span> {hero.expectedUpdate}
          </p>
        ) : null}
      </div>

      {actionSlot ? (
        <div className="border-t border-zinc-100 px-4 py-4 sm:px-5">{actionSlot}</div>
      ) : null}
    </section>
  );
}

