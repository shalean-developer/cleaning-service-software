import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import {
  customerBookingAmountLabel,
  customerBookingStatusHero,
  CUSTOMER_BOOKING_DETAIL_CARD_CLASS,
  CUSTOMER_BOOKING_DETAIL_INSET_CLASS,
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
}: Props) {
  const hero = customerBookingStatusHero(status, paymentFailureReason);
  const showPaymentChip = shouldShowPaymentStatusChip(status, paymentStatus);
  const amountLabel = customerBookingAmountLabel(status, paymentStatus);
  const amountFormatted = formatZar(priceCents, currency);

  return (
    <section className={`${CUSTOMER_BOOKING_DETAIL_CARD_CLASS} overflow-hidden`}>
      <div className="border-b border-zinc-100 px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">{serviceLabel}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
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
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-zinc-500">When</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900">{scheduleLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">Where</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900">{locationSummary}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-zinc-500">{amountLabel}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
              {amountFormatted}
            </dd>
          </div>
        </dl>
      </div>

      <div className={`mx-4 mb-4 px-4 py-3.5 sm:mx-5 sm:mb-5 sm:px-4 ${CUSTOMER_BOOKING_DETAIL_INSET_CLASS}`}>
        <p className="text-sm leading-relaxed text-zinc-700">{hero.description}</p>
        {hero.expectedUpdate ? (
          <p className="mt-2 text-xs text-zinc-500">
            <span className="font-medium text-zinc-600">Expected update:</span>{" "}
            {hero.expectedUpdate}
          </p>
        ) : null}
      </div>
    </section>
  );
}

