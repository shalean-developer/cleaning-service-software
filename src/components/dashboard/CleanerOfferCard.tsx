import Link from "next/link";
import { OfferActions } from "@/components/dashboard/OfferActions";
import { OfferExpiryChip } from "@/components/dashboard/OfferExpiryChip";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CleanerPayDisplay } from "@/components/dashboard/cleaner/CleanerPayDisplay";
import {
  CLEANER_BADGE_ROW_CLASS,
  CLEANER_LIST_CARD_PADDING,
  CLEANER_META_LINE_CLASS,
  CLEANER_META_LOCATION_CLASS,
  CLEANER_OFFER_ACTIONS_DIVIDER_CLASS,
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
import { formatOfferExpiryDisplay } from "@/features/dashboards/server/formatOfferExpiryDisplay";
import { canRespondToCleanerOffer } from "@/features/dashboards/server/partitionCleanerOffers";
import type { CleanerOfferListItem } from "@/features/dashboards/server/types";
import {
  labelForOfferStatus,
  toneForOfferStatus,
} from "@/features/bookings/server/statusLabels";

type Props = {
  offer: CleanerOfferListItem;
};

export function CleanerOfferCard({ offer }: Props) {
  const canRespond = canRespondToCleanerOffer(offer);
  const isPast = !canRespond;
  const expiry = formatOfferExpiryDisplay({
    expiresAt: offer.expiresAt,
    isExpired: offer.isExpired,
  });

  const statusLabel =
    offer.isExpired && offer.status === "offered" ? "Expired" : labelForOfferStatus(offer.status);
  const statusTone =
    offer.isExpired && offer.status === "offered" ? "warning" : toneForOfferStatus(offer.status);
  const airbnb = isAirbnbOperationalBooking({ serviceLabel: offer.serviceLabel });
  const office = isOfficeOperationalBooking({ serviceLabel: offer.serviceLabel });
  const moving = isMovingOperationalBooking({ serviceLabel: offer.serviceLabel });
  const deep = isDeepOperationalBooking({ serviceLabel: offer.serviceLabel });
  const carpet = isCarpetOperationalBooking({ serviceLabel: offer.serviceLabel });
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
    <article
      className={`${CLEANER_DETAIL_CARD_CLASS} ${CLEANER_LIST_CARD_PADDING} ${
        isPast ? "opacity-90" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={CLEANER_SERVICE_EYEBROW_CLASS}>
            {opsOffer?.serviceEyebrow ?? offer.serviceLabel}
          </p>
          {opsOffer ? (
            <p className="mt-0.5 text-sm text-zinc-600">{opsOffer.offerSubtitle}</p>
          ) : null}
          <p className={CLEANER_META_LINE_CLASS}>
            <span className="font-medium text-zinc-900">
              {opsOffer?.schedulePrefix ? `${opsOffer.schedulePrefix}: ` : ""}
              {offer.scheduleLabel}
            </span>
            <span className="text-zinc-400"> · </span>
            <span className={CLEANER_META_LOCATION_CLASS}>{offer.locationSummary}</span>
          </p>
          {opsOffer ? (
            <p className="mt-1 text-xs text-zinc-500">
              {opsOffer.accessHint} · {opsOffer.standardHint}
            </p>
          ) : null}
        </div>
        <CleanerPayDisplay earningsLabel={offer.earningsLabel} className="shrink-0 text-right" />
      </div>

      <div className={CLEANER_BADGE_ROW_CLASS}>
        <StatusBadge label={statusLabel} tone={statusTone} variant="soft" />
        {offer.teamRoleLabel ? (
          <StatusBadge label={offer.teamRoleLabel} tone="info" variant="soft" />
        ) : null}
        {canRespond && expiry.relativeLabel ? (
          <OfferExpiryChip
            relativeLabel={expiry.relativeLabel}
            ariaLabel={expiry.ariaLabel ?? expiry.relativeLabel}
            urgency={expiry.urgency}
          />
        ) : null}
      </div>

      {canRespond ? (
        <section className={CLEANER_OFFER_ACTIONS_DIVIDER_CLASS}>
          <OfferActions
            offerId={offer.offerId}
            serviceLabel={offer.serviceLabel}
            scheduleLabel={offer.scheduleLabel}
            earningsLabel={offer.earningsLabel}
          />
        </section>
      ) : offer.status === "accepted" ? (
        <Link
          href={`/cleaner/jobs/${offer.bookingId}`}
          className="mt-3 inline-flex text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          View job
        </Link>
      ) : null}
    </article>
  );
}
