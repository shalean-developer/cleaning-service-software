import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import {
  CUSTOMER_BOOKING_DETAIL_CARD_CLASS,
} from "@/features/dashboards/customerBookingDetailDisplay";
import type { PaymentSummary } from "@/features/dashboards/server/types";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  labelForPaymentStatus,
  toneForPaymentStatus,
} from "@/features/bookings/server/statusLabels";

type DetailRowProps = {
  label: string;
  value: string;
  valueClassName?: string;
};

function DetailRow({ label, value, valueClassName }: DetailRowProps) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className={`text-sm font-medium text-zinc-900 sm:text-right ${valueClassName ?? ""}`}>
        {value}
      </dd>
    </div>
  );
}

type Props = {
  serviceLabel: string;
  homeSizeSummary: string | null;
  cleaningIntensityLabel: string | null;
  equipmentSupplyLabel: string | null;
  frequencyLabel: string | null;
  addonsSummary: string | null;
  teamSupportLabel: string | null;
  cleanerPreferenceLabel: string;
  assignedCleanerLabel: string | null;
  assignmentCustomerMessage: string | null;
  specialInstructions: string | null;
  contactPhoneDisplay: string | null;
  priceCents: number;
  currency: string;
  payments: PaymentSummary[];
};

export function CustomerBookingDetailsCard({
  serviceLabel,
  homeSizeSummary,
  cleaningIntensityLabel,
  equipmentSupplyLabel,
  frequencyLabel,
  addonsSummary,
  teamSupportLabel,
  cleanerPreferenceLabel,
  assignedCleanerLabel,
  assignmentCustomerMessage,
  specialInstructions,
  contactPhoneDisplay,
  priceCents,
  currency,
  payments,
}: Props) {
  const hasServiceDetails =
    homeSizeSummary != null ||
    cleaningIntensityLabel != null ||
    equipmentSupplyLabel != null ||
    frequencyLabel != null ||
    addonsSummary != null ||
    teamSupportLabel != null;

  return (
    <section className={`${CUSTOMER_BOOKING_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
      <h2 className="text-sm font-medium text-zinc-800">Booking details</h2>

      <dl className="mt-4 space-y-3">
        <DetailRow label="Service" value={serviceLabel} valueClassName="text-sky-900" />
        {hasServiceDetails ? (
          <>
            {homeSizeSummary ? <DetailRow label="Home size" value={homeSizeSummary} /> : null}
            {cleaningIntensityLabel ? (
              <DetailRow label="Cleaning intensity" value={cleaningIntensityLabel} />
            ) : null}
            {equipmentSupplyLabel ? (
              <DetailRow label="Cleaning supplies" value={equipmentSupplyLabel} />
            ) : null}
            {frequencyLabel ? <DetailRow label="Frequency" value={frequencyLabel} /> : null}
            {addonsSummary ? <DetailRow label="Add-ons" value={addonsSummary} /> : null}
            {teamSupportLabel ? (
              <DetailRow label="Team support" value={teamSupportLabel} />
            ) : null}
          </>
        ) : null}
        {contactPhoneDisplay ? (
          <DetailRow label="Contact number" value={contactPhoneDisplay} />
        ) : null}
        <DetailRow label="Cleaner preference" value={cleanerPreferenceLabel} />
        {assignedCleanerLabel ? (
          <DetailRow
            label="Assigned cleaner"
            value={assignedCleanerLabel}
            valueClassName="text-emerald-800"
          />
        ) : null}
      </dl>

      {assignmentCustomerMessage ? (
        <p className="mt-4 rounded-xl border border-sky-200/80 bg-sky-50/80 px-3.5 py-3 text-sm leading-relaxed text-sky-950">
          {assignmentCustomerMessage}
        </p>
      ) : null}

      {specialInstructions ? (
        <p className="mt-4 border-t border-zinc-100 pt-4 text-sm leading-relaxed text-zinc-600">
          <span className="font-medium text-zinc-800">Notes</span>
          <span className="mt-1 block text-zinc-700">{specialInstructions}</span>
        </p>
      ) : null}

      {payments.length > 0 ? (
        <section className="mt-5 border-t border-zinc-100 pt-4" aria-labelledby="payment-summary-heading">
          <h3 id="payment-summary-heading" className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Payment summary
          </h3>
          <ul className="mt-2 divide-y divide-zinc-100">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <StatusBadge
                  label={labelForPaymentStatus(payment.status)}
                  tone={toneForPaymentStatus(payment.status)}
                  variant="soft"
                />
                <span className="text-sm font-semibold tabular-nums text-zinc-900">
                  {formatZar(payment.amountCents, payment.currency)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500">
            Booking total {formatZar(priceCents, currency)}
          </p>
        </section>
      ) : null}
    </section>
  );
}
