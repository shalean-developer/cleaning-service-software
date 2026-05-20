import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CleanerPayDisplay } from "@/components/dashboard/cleaner/CleanerPayDisplay";
import {
  CLEANER_BADGE_ROW_CLASS,
  CLEANER_LIST_CARD_PADDING,
  CLEANER_META_LINE_CLASS,
  CLEANER_META_LOCATION_CLASS,
  CLEANER_SERVICE_EYEBROW_CLASS,
} from "@/features/dashboards/cleanerDashboardDisplay";
import {
  cleanerAirbnbJobStatusLabel,
  getAirbnbCleanerJobCopy,
  isAirbnbOperationalBooking,
} from "@/features/dashboards/airbnbOperationalDisplay";
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
  teamRoleLabel?: string | null;
};

export function CleanerJobListCard({
  href,
  serviceLabel,
  scheduleLabel,
  locationSummary,
  earningsLabel,
  status,
  teamRoleLabel,
}: Props) {
  const airbnb = isAirbnbOperationalBooking({ serviceLabel });
  const airbnbJob = airbnb ? getAirbnbCleanerJobCopy() : null;
  const statusLabel =
    cleanerAirbnbJobStatusLabel(status) ?? labelForCleanerJobStatus(status);

  return (
    <Link
      href={href}
      className={`block ${CLEANER_DETAIL_CARD_CLASS} ${CLEANER_LIST_CARD_PADDING} transition-colors hover:border-zinc-300`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={CLEANER_SERVICE_EYEBROW_CLASS}>{serviceLabel}</p>
          {airbnbJob ? (
            <p className="mt-0.5 text-sm text-zinc-600">{airbnbJob.heroSubtitle}</p>
          ) : null}
          <p className={CLEANER_META_LINE_CLASS}>
            <span className="font-medium text-zinc-900">{scheduleLabel}</span>
            <span className="text-zinc-400"> · </span>
            <span className={CLEANER_META_LOCATION_CLASS}>{locationSummary}</span>
          </p>
        </div>
        <CleanerPayDisplay earningsLabel={earningsLabel} className="shrink-0 text-right" />
      </div>
      <div className={CLEANER_BADGE_ROW_CLASS}>
        <StatusBadge
          label={statusLabel}
          tone={toneForCleanerJobStatus(status)}
          variant="soft"
        />
        {teamRoleLabel ? (
          <StatusBadge label={teamRoleLabel} tone="info" variant="soft" />
        ) : null}
      </div>
    </Link>
  );
}
