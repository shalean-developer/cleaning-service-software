import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import {
  customerBookingAmountLabel,
  customerBookingStatusHero,
  CUSTOMER_BOOKING_DETAIL_CARD_CLASS,
  shouldShowPaymentStatusChip,
} from "@/features/dashboards/customerBookingDetailDisplay";
import {
  labelForCustomerBookingStatus,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import {
  labelForPaymentStatus,
  toneForPaymentStatus,
} from "@/features/bookings/server/statusLabels";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { PaymentStatus } from "@/lib/database/types";

type Props = {
  serviceLabel: string;
  scheduleLabel: string;
  locationSummary: string;
  priceCents: number;
  currency: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  paymentFailureReason: PaymentFailureReason;
  deferredAssignmentMessage?: string | null;
  assignedCleanerLabel?: string | null;
  teamSupportLabel?: string | null;
};

export function CustomerBookingStatusHero({
  serviceLabel,
  scheduleLabel,
  locationSummary,
  priceCents,
  currency,
  status,
  paymentStatus,
  paymentFailureReason,
  deferredAssignmentMessage,
  assignedCleanerLabel,
  teamSupportLabel,
}: Props) {
  const hero = customerBookingStatusHero(status, paymentFailureReason, {
    deferredAssignmentMessage,
  });
  const showPaymentChip = shouldShowPaymentStatusChip(status, paymentStatus);
  const amountLabel = customerBookingAmountLabel(status, paymentStatus);
  const amountFormatted = formatZar(priceCents, currency);

  return (
    <section className={`${CUSTOMER_BOOKING_DETAIL_CARD_CLASS} px-4 py-3.5 sm:px-5 sm:py-4`}>
      <h1 className="break-words text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
        {serviceLabel}
      </h1>

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        <StatusBadge
          label={labelForCustomerBookingStatus(status, paymentFailureReason)}
          tone={hero.tone}
          variant="soft"
        />
        {showPaymentChip ? (
          <StatusBadge
            label={labelForPaymentStatus(paymentStatus)}
            tone={toneForPaymentStatus(paymentStatus)}
            variant="soft"
          />
        ) : null}
        <span className="ml-auto text-sm font-semibold tabular-nums text-zinc-900 sm:ml-0 sm:w-full sm:text-right">
          <span className="sr-only">{amountLabel}</span>
          {amountFormatted}
        </span>
      </div>

      <p className="mt-2 text-sm text-zinc-600">
        <span className="font-medium text-zinc-800">{scheduleLabel}</span>
        <span className="mx-1.5 text-zinc-300" aria-hidden>
          ·
        </span>
        <span className="break-words">{locationSummary}</span>
      </p>

      {assignedCleanerLabel ? (
        <p className="mt-1.5 text-sm font-medium text-emerald-800">{assignedCleanerLabel}</p>
      ) : null}

      {teamSupportLabel ? (
        <p className="mt-1 text-sm text-sky-900/90">{teamSupportLabel}</p>
      ) : null}

      {hero.showStatusNarrative && hero.statusLine ? (
        <p className="mt-2 text-sm leading-snug text-zinc-700">{hero.statusLine}</p>
      ) : null}

      {hero.showStatusNarrative && hero.timingHint ? (
        <p className="mt-1 text-xs text-zinc-500">{hero.timingHint}</p>
      ) : null}
    </section>
  );
}
