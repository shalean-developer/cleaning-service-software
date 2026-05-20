import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { UI_INTERACTIVE_LIST_CARD_CLASS, UI_LIST_STACK_CLASS } from "@/lib/ui/productUiTokens";
import {
  customerBookingListCardLayers,
  customerBookingPaymentLineClass,
} from "@/features/dashboards/customerBookingListCardDisplay";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";

type Props = {
  booking: CustomerBookingListItem;
};

export function CustomerBookingListCard({ booking }: Props) {
  const layers = customerBookingListCardLayers({
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentFailureReason: booking.paymentFailureReason,
    isUpcoming: booking.isUpcoming,
    display: booking.display,
    deferredAssignmentMessage: booking.deferredAssignmentMessage,
    assignedCleanerLabel: booking.assignedCleanerLabel,
  });
  const amountLabel = formatZar(booking.priceCents, booking.currency);

  return (
    <Link
      href={`/customer/bookings/${booking.id}`}
      className={`group ${UI_INTERACTIVE_LIST_CARD_CLASS}`}
    >
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <section className={`min-w-0 flex-1 ${UI_LIST_STACK_CLASS}`}>
          <div>
            <h2 className="break-words text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">
              {booking.display.serviceLabel}
            </h2>
            {layers.serviceSubtitle ? (
              <p className="mt-0.5 text-sm text-zinc-600">{layers.serviceSubtitle}</p>
            ) : null}
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2 sm:gap-x-6">
            <div>
              <dt className="sr-only">Schedule</dt>
              <dd className="text-zinc-600">{booking.scheduleLabel}</dd>
            </div>
            <div>
              <dt className="sr-only">Location</dt>
              <dd className="break-words text-zinc-500">{booking.display.locationSummary}</dd>
            </div>
          </dl>
          {layers.paymentStatusLine ? (
            <p className={customerBookingPaymentLineClass(layers.paymentStatusLine.tone)}>
              {layers.paymentStatusLine.text}
            </p>
          ) : null}
          {layers.supportingMessage?.kind === "assignment" ? (
            <p className="text-sm text-sky-800/90">{layers.supportingMessage.text}</p>
          ) : layers.supportingMessage?.kind === "cleaner" ? (
            <p className="text-sm text-emerald-700/90">{layers.supportingMessage.text}</p>
          ) : null}
        </section>

        <section className="flex flex-row flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-2.5">
          <StatusBadge
            label={layers.dominantBadge.label}
            tone={layers.dominantBadge.tone}
            variant="soft"
          />
          <p className="text-sm font-semibold tabular-nums text-zinc-900">{amountLabel}</p>
          <span className="inline-flex items-center text-sm font-medium text-zinc-600 transition-colors group-hover:text-zinc-900">
            {layers.ctaLabel}
            <span aria-hidden className="ml-1 transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </section>
      </section>
    </Link>
  );
}
