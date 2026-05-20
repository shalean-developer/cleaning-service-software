import Link from "next/link";
import { OfferExpiryChip } from "@/components/dashboard/OfferExpiryChip";
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
  getAirbnbCleanerOfferCopy,
  isAirbnbOperationalBooking,
} from "@/features/dashboards/airbnbOperationalDisplay";
import {
  getDeepCleanerOfferCopy,
  isDeepOperationalBooking,
} from "@/features/dashboards/deepOperationalDisplay";
import {
  getCarpetCleanerOfferCopy,
  isCarpetOperationalBooking,
} from "@/features/dashboards/carpetOperationalDisplay";
import {
  getMovingCleanerOfferCopy,
  isMovingOperationalBooking,
} from "@/features/dashboards/movingOperationalDisplay";
import {
  getOfficeCleanerOfferCopy,
  isOfficeOperationalBooking,
} from "@/features/dashboards/officeOperationalDisplay";
import { CLEANER_DETAIL_CARD_CLASS } from "@/features/dashboards/cleanerJobDetailDisplay";
import type { OfferExpiryUrgency } from "@/features/dashboards/server/formatOfferExpiryDisplay";
import {
  labelForOfferStatus,
  toneForOfferStatus,
} from "@/features/bookings/server/statusLabels";
import type { AssignmentOfferStatus } from "@/lib/database/types";

type ExpiryPresentation = {
  relativeLabel: string;
  ariaLabel: string;
  urgency: OfferExpiryUrgency;
};

type Props = {
  href: string;
  serviceLabel: string;
  scheduleLabel: string;
  locationSummary: string;
  earningsLabel: string;
  status: AssignmentOfferStatus;
  isExpired: boolean;
  expiry?: ExpiryPresentation | null;
};

export function CleanerOfferListCard({
  href,
  serviceLabel,
  scheduleLabel,
  locationSummary,
  earningsLabel,
  status,
  isExpired,
  expiry,
}: Props) {
  const statusLabel = isExpired && status === "offered" ? "Expired" : labelForOfferStatus(status);
  const statusTone = isExpired && status === "offered" ? "warning" : toneForOfferStatus(status);
  const showExpiry = status === "offered" && !isExpired && expiry?.relativeLabel;
  const airbnb = isAirbnbOperationalBooking({ serviceLabel });
  const office = isOfficeOperationalBooking({ serviceLabel });
  const moving = isMovingOperationalBooking({ serviceLabel });
  const deep = isDeepOperationalBooking({ serviceLabel });
  const carpet = isCarpetOperationalBooking({ serviceLabel });
  const opsOffer = airbnb
    ? getAirbnbCleanerOfferCopy()
    : office
      ? getOfficeCleanerOfferCopy()
      : moving
        ? getMovingCleanerOfferCopy()
        : deep
          ? getDeepCleanerOfferCopy()
          : carpet
            ? getCarpetCleanerOfferCopy()
            : null;

  return (
    <Link
      href={href}
      className={`block ${CLEANER_DETAIL_CARD_CLASS} ${CLEANER_LIST_CARD_PADDING} transition-colors hover:border-zinc-300`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={CLEANER_SERVICE_EYEBROW_CLASS}>
            {opsOffer?.serviceEyebrow ?? serviceLabel}
          </p>
          {opsOffer ? (
            <p className="mt-0.5 text-sm text-zinc-600">{opsOffer.offerSubtitle}</p>
          ) : null}
          <p className={CLEANER_META_LINE_CLASS}>
            <span className="font-medium text-zinc-900">
              {opsOffer?.schedulePrefix ? `${opsOffer.schedulePrefix}: ` : ""}
              {scheduleLabel}
            </span>
            <span className="text-zinc-400"> · </span>
            <span className={CLEANER_META_LOCATION_CLASS}>{locationSummary}</span>
          </p>
          {opsOffer ? (
            <p className="mt-1 text-xs text-zinc-500">
              {opsOffer.accessHint} · {opsOffer.standardHint}
            </p>
          ) : null}
        </div>
        <CleanerPayDisplay earningsLabel={earningsLabel} className="shrink-0 text-right" />
      </div>
      <div className={CLEANER_BADGE_ROW_CLASS}>
        <StatusBadge label={statusLabel} tone={statusTone} variant="soft" />
        {showExpiry ? (
          <OfferExpiryChip
            relativeLabel={expiry.relativeLabel}
            ariaLabel={expiry.ariaLabel}
            urgency={expiry.urgency}
          />
        ) : null}
      </div>
    </Link>
  );
}
