import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  CLEANER_BADGE_ROW_CLASS,
  CLEANER_EARNINGS_HERO_CLASS,
  CLEANER_LIST_CARD_PADDING,
  CLEANER_META_LINE_CLASS,
  CLEANER_SERVICE_EYEBROW_CLASS,
} from "@/features/dashboards/cleanerDashboardDisplay";
import { CLEANER_DETAIL_CARD_CLASS } from "@/features/dashboards/cleanerJobDetailDisplay";
import {
  cleanerPayoutStatusHelper,
  labelForCleanerPayoutStatus,
  toneForCleanerPayoutStatus,
} from "@/features/dashboards/cleanerEarningsPresentation";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import type { EarningPayoutStatus } from "@/lib/database/types";

export type CleanerEarningsListCardItem = {
  id: string;
  serviceLabel: string;
  scheduleLabel: string;
  payoutAmountCents: number;
  payoutStatus: EarningPayoutStatus;
  bookingId?: string | null;
};

type Props = {
  item: CleanerEarningsListCardItem;
};

export function CleanerEarningsListCard({ item }: Props) {
  const statusHelper = cleanerPayoutStatusHelper(item.payoutStatus);
  const jobHref = item.bookingId ? `/cleaner/jobs/${item.bookingId}` : null;

  return (
    <article className={`${CLEANER_DETAIL_CARD_CLASS} ${CLEANER_LIST_CARD_PADDING}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={CLEANER_SERVICE_EYEBROW_CLASS}>{item.serviceLabel}</p>
          <p className={CLEANER_META_LINE_CLASS}>{item.scheduleLabel}</p>
          <div className={CLEANER_BADGE_ROW_CLASS}>
            <StatusBadge
              label={labelForCleanerPayoutStatus(item.payoutStatus)}
              tone={toneForCleanerPayoutStatus(item.payoutStatus)}
              variant="soft"
            />
          </div>
          {statusHelper ? (
            <p className="mt-1 text-xs leading-snug text-zinc-500">{statusHelper}</p>
          ) : null}
        </div>
        <p className={CLEANER_EARNINGS_HERO_CLASS}>{formatZar(item.payoutAmountCents)}</p>
      </div>
      {jobHref ? (
        <Link
          href={jobHref}
          className="mt-2 inline-block text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          View job
        </Link>
      ) : null}
    </article>
  );
}
