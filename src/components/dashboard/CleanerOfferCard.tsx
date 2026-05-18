import Link from "next/link";
import { OfferActions } from "@/components/dashboard/OfferActions";
import { OfferExpiryChip } from "@/components/dashboard/OfferExpiryChip";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
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

  return (
    <article
      className={`${CLEANER_DETAIL_CARD_CLASS} p-4 sm:p-5 ${
        isPast ? "opacity-90" : ""
      }`}
    >
      <p className="break-words text-xs font-semibold uppercase tracking-wide text-sky-800">
        {offer.serviceLabel}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
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

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-zinc-500">When</dt>
          <dd className="mt-0.5 text-sm font-medium text-zinc-900">{offer.scheduleLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-500">Your pay</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900 sm:text-base">
            {offer.earningsLabel}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-zinc-500">Where</dt>
          <dd className="mt-0.5 break-words text-sm text-zinc-700">{offer.locationSummary}</dd>
        </div>
      </dl>

      {canRespond && expiry.absoluteLabel ? (
        <p className="mt-3 text-xs text-zinc-500">Respond by {expiry.absoluteLabel}</p>
      ) : null}

      {canRespond ? (
        <section className="mt-4 border-t border-zinc-100 pt-4">
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
          className="mt-4 inline-flex text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          View job
        </Link>
      ) : null}
    </article>
  );
}

