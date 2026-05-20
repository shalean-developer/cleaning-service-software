import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CustomerBookACleanCta } from "@/components/dashboard/customer/CustomerBookACleanCta";
import { customerBookingListCardLayers } from "@/features/dashboards/customerBookingListCardDisplay";
import { formatUpcomingScheduleShort } from "@/features/dashboards/customerHomeDisplay";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";
import {
  UI_BUTTON_SECONDARY_CLASS,
  UI_CARD_SHELL_CLASS,
  UI_EMPTY_STATE_DESCRIPTION_CLASS,
  UI_EMPTY_STATE_TITLE_CLASS,
  UI_LINK_SECONDARY_ACTION_CLASS,
} from "@/lib/ui/productUiTokens";

type Props = {
  featured: CustomerBookingListItem | null;
};

export function CustomerHomeUpcomingCard({ featured }: Props) {
  if (!featured) {
    return (
      <section className={`${UI_CARD_SHELL_CLASS} px-4 py-5 sm:px-5 sm:py-6`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Upcoming cleaning</p>
        <h2 className={`mt-2 ${UI_EMPTY_STATE_TITLE_CLASS}`}>No upcoming bookings</h2>
        <p className={UI_EMPTY_STATE_DESCRIPTION_CLASS}>
          Book your next clean in under 2 minutes — we will match a cleaner after checkout.
        </p>
        <div className="mt-4">
          <CustomerBookACleanCta />
        </div>
      </section>
    );
  }

  const layers = customerBookingListCardLayers({
    status: featured.status,
    paymentStatus: featured.paymentStatus,
    paymentFailureReason: featured.paymentFailureReason,
    isUpcoming: featured.isUpcoming,
    display: featured.display,
    deferredAssignmentMessage: featured.deferredAssignmentMessage,
    assignedCleanerLabel: featured.assignedCleanerLabel,
  });
  const scheduleShort = formatUpcomingScheduleShort(
    featured.scheduledStart,
    featured.scheduledEnd,
  );
  const amount = formatZar(featured.priceCents, featured.currency);
  const location =
    featured.display.suburb && featured.display.city
      ? `${featured.display.suburb}, ${featured.display.city}`
      : featured.display.locationSummary;

  return (
    <section
      className={`${UI_CARD_SHELL_CLASS} border-zinc-200/90 px-4 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:px-5 sm:py-5`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Upcoming cleaning
          </p>
          <h2 className="mt-1 break-words text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
            {featured.display.serviceLabel}
          </h2>
          {layers.serviceSubtitle ? (
            <p className="mt-0.5 text-sm text-zinc-600">{layers.serviceSubtitle}</p>
          ) : null}
        </div>
        <StatusBadge label={layers.dominantBadge.label} tone={layers.dominantBadge.tone} variant="soft" />
      </div>

      <p className="mt-3 text-sm text-zinc-700">
        <span className="font-medium text-zinc-900">{scheduleShort}</span>
      </p>
      <p className="mt-0.5 text-sm text-zinc-600">{location}</p>

      {layers.supportingMessage ? (
        <p
          className={`mt-2 text-sm ${
            layers.supportingMessage.kind === "cleaner"
              ? "font-medium text-emerald-800"
              : "text-sky-900/90"
          }`}
        >
          {layers.supportingMessage.text}
        </p>
      ) : null}

      {layers.paymentStatusLine ? (
        <p className="mt-1.5 text-sm text-amber-800/90">{layers.paymentStatusLine.text}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
        <p className="text-base font-semibold tabular-nums text-zinc-900">{amount}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/customer/bookings/${featured.id}`} className={UI_BUTTON_SECONDARY_CLASS}>
            View booking
          </Link>
          <Link
            href={
              featured.display.serviceSlug
                ? `/customer/book/${featured.display.serviceSlug}`
                : "/customer/book"
            }
            className={UI_LINK_SECONDARY_ACTION_CLASS}
          >
            Book again
          </Link>
        </div>
      </div>
    </section>
  );
}
