import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CLEANER_DETAIL_CARD_CLASS } from "@/features/dashboards/cleanerJobDetailDisplay";
import {
  labelForCleanerJobStatus,
  toneForCleanerJobStatus,
} from "@/features/bookings/server/statusLabels";
import type { BookingStatus } from "@/features/bookings/server/types";

type Props = {
  href: string;
  serviceLabel: string;
  scheduleLabel: string;
  locationSummary: string;
  earningsLabel: string;
  status: BookingStatus;
};

export function CleanerJobListCard({
  href,
  serviceLabel,
  scheduleLabel,
  locationSummary,
  earningsLabel,
  status,
}: Props) {
  return (
    <Link
      href={href}
      className={`block ${CLEANER_DETAIL_CARD_CLASS} p-4 transition-colors hover:border-zinc-300 sm:p-5`}
    >
      <p className="break-words text-xs font-semibold uppercase tracking-wide text-sky-800">
        {serviceLabel}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge
          label={labelForCleanerJobStatus(status)}
          tone={toneForCleanerJobStatus(status)}
          variant="soft"
        />
      </div>

      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium text-zinc-500">When</dt>
          <dd className="mt-0.5 text-sm font-medium text-zinc-900">{scheduleLabel}</dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="text-xs font-medium text-zinc-500">Where</dt>
          <dd className="mt-0.5 break-words text-sm text-zinc-700">{locationSummary}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-500">Pay</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900">{earningsLabel}</dd>
        </div>
      </dl>
    </Link>
  );
}

