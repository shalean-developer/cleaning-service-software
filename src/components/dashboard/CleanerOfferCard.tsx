import Link from "next/link";
import { OfferActions } from "@/components/dashboard/OfferActions";
import { OfferExpiryChip } from "@/components/dashboard/OfferExpiryChip";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatOfferExpiryDisplay } from "@/features/dashboards/server/formatOfferExpiryDisplay";
import {
  canRespondToCleanerOffer,
} from "@/features/dashboards/server/partitionCleanerOffers";
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
    offer.isExpired && offer.status === "offered"
      ? "Expired"
      : labelForOfferStatus(offer.status);
  const statusTone =
    offer.isExpired && offer.status === "offered"
      ? "danger"
      : toneForOfferStatus(offer.status);

  return (
    <article
      className={`rounded-xl border bg-white p-5 ${
        isPast ? "border-zinc-200 opacity-90" : "border-zinc-200"
      }`}
    >
      <section className="flex flex-wrap items-center gap-2">
        <StatusBadge label={statusLabel} tone={statusTone} />
        {canRespond && expiry.relativeLabel ? (
          <OfferExpiryChip
            relativeLabel={expiry.relativeLabel}
            ariaLabel={expiry.ariaLabel ?? expiry.relativeLabel}
            urgency={expiry.urgency}
          />
        ) : null}
      </section>

      <p className="mt-3 text-sm font-medium text-zinc-900 md:text-base">
        {offer.scheduleLabel}
      </p>

      <section className="mt-3">
        <p className="text-xs text-zinc-500 md:hidden">Your earnings</p>
        <p className="text-lg font-semibold text-zinc-900 md:text-sm md:font-medium">
          <span className="hidden text-zinc-500 md:inline">Your earnings · </span>
          {offer.earningsLabel}
        </p>
      </section>

      <p className="mt-2 font-medium text-zinc-900 md:mt-3 md:text-base">
        {offer.serviceLabel}
      </p>
      <p className="text-sm text-zinc-500">{offer.locationSummary}</p>

      {canRespond && expiry.absoluteLabel ? (
        <p className="mt-2 text-xs text-zinc-500">Expires {expiry.absoluteLabel}</p>
      ) : null}

      {canRespond ? (
        <section className="mt-4">
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
          className="mt-4 inline-block text-sm font-medium text-zinc-700 hover:text-zinc-900"
        >
          View job →
        </Link>
      ) : null}
    </article>
  );
}
