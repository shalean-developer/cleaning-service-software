import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import { UI_DETAIL_VALUE_CLASS } from "@/lib/ui/productUiTokens";
import type { PaymentSummary } from "@/features/dashboards/server/types";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { labelForCustomerPaymentStatus } from "@/features/bookings/server/paymentFailureDisplay";
import { toneForPaymentStatus } from "@/features/bookings/server/statusLabels";
import {
  getAirbnbCustomerBookingDetailCopy,
  isAirbnbCleaningSlug,
} from "@/features/dashboards/airbnbCustomerDisplay";
import { isDeepCleaningSlug } from "@/features/booking-wizard/deepCleaningDisplay";
import { isCarpetCleaningSlug } from "@/features/booking-wizard/carpetCleaningDisplay";
import { isMovingCleaningSlug } from "@/features/booking-wizard/movingCleaningDisplay";
import { isOfficeCleaningSlug } from "@/features/booking-wizard/officeCleaningDisplay";
import { getDeepCustomerBookingDetailCopy } from "@/features/dashboards/deepCustomerDisplay";
import { getCarpetCustomerBookingDetailCopy } from "@/features/dashboards/carpetCustomerDisplay";
import { getMovingCustomerBookingDetailCopy } from "@/features/dashboards/movingCustomerDisplay";
import { getOfficeCustomerBookingDetailCopy } from "@/features/dashboards/officeCustomerDisplay";
import {
  getRegularCustomerBookingDetailCopy,
  isRegularCleaningSlug,
} from "@/features/dashboards/regularCustomerDisplay";

type DetailRowProps = {
  label: string;
  value: string;
  valueClassName?: string;
};

function DetailRow({ label, value, valueClassName }: DetailRowProps) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs font-medium text-zinc-500">{label}</dt>
      <dd
        className={`${UI_DETAIL_VALUE_CLASS} text-sm font-medium text-zinc-900 sm:text-right ${valueClassName ?? ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

type Props = {
  serviceSlug?: string | null;
  homeSizeSummary: string | null;
  cleaningIntensityLabel: string | null;
  equipmentSupplyLabel: string | null;
  frequencyLabel: string | null;
  addonsSummary: string | null;
  teamSupportLabel: string | null;
  cleanerPreferenceLabel: string;
  assignedCleanerLabel: string | null;
  assignmentCustomerMessage: string | null;
  suppressAssignmentCallout?: boolean;
  specialInstructions: string | null;
  contactPhoneDisplay: string | null;
  priceCents: number;
  currency: string;
  payments: PaymentSummary[];
  /** When true, team support is shown only in the hero. */
  teamSupportShownInHero?: boolean;
  /** When true, assigned cleaner is shown only in the hero. */
  assignedCleanerShownInHero?: boolean;
};

export function CustomerBookingDetailsCard({
  serviceSlug,
  homeSizeSummary,
  cleaningIntensityLabel,
  equipmentSupplyLabel,
  frequencyLabel,
  addonsSummary,
  teamSupportLabel,
  cleanerPreferenceLabel,
  assignedCleanerLabel,
  assignmentCustomerMessage,
  suppressAssignmentCallout = false,
  specialInstructions,
  contactPhoneDisplay,
  priceCents,
  currency,
  payments,
  teamSupportShownInHero = false,
  assignedCleanerShownInHero = false,
}: Props) {
  const serviceLabels = isAirbnbCleaningSlug(serviceSlug)
    ? getAirbnbCustomerBookingDetailCopy()
    : isOfficeCleaningSlug(serviceSlug)
      ? getOfficeCustomerBookingDetailCopy()
      : isMovingCleaningSlug(serviceSlug)
        ? getMovingCustomerBookingDetailCopy()
        : isDeepCleaningSlug(serviceSlug)
          ? getDeepCustomerBookingDetailCopy()
          : isCarpetCleaningSlug(serviceSlug)
            ? getCarpetCustomerBookingDetailCopy()
            : isRegularCleaningSlug(serviceSlug)
              ? getRegularCustomerBookingDetailCopy()
              : null;
  const hasServiceDetails =
    homeSizeSummary != null ||
    cleaningIntensityLabel != null ||
    equipmentSupplyLabel != null ||
    frequencyLabel != null ||
    addonsSummary != null ||
    (teamSupportLabel != null && !teamSupportShownInHero);

  const showAssignmentCallout =
    !suppressAssignmentCallout && assignmentCustomerMessage?.trim();
  const showAssignedCleaner = assignedCleanerLabel && !assignedCleanerShownInHero;
  const showTeamSupport = teamSupportLabel && !teamSupportShownInHero;

  return (
    <div className="space-y-3 px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
      {hasServiceDetails ? (
        <dl className="space-y-2.5">
          {homeSizeSummary ? (
            <DetailRow
              label={serviceLabels?.homeSizeLabel ?? "Home size"}
              value={homeSizeSummary}
            />
          ) : null}
          {cleaningIntensityLabel ? (
            <DetailRow label="Cleaning intensity" value={cleaningIntensityLabel} />
          ) : null}
          {equipmentSupplyLabel ? (
            <DetailRow label="Cleaning supplies" value={equipmentSupplyLabel} />
          ) : null}
          {frequencyLabel ? (
            <DetailRow
              label={serviceLabels?.frequencyLabel ?? "Frequency"}
              value={frequencyLabel}
            />
          ) : null}
          {addonsSummary ? (
            <DetailRow label={serviceLabels?.addonsLabel ?? "Add-ons"} value={addonsSummary} />
          ) : null}
          {showTeamSupport ? <DetailRow label="Team support" value={teamSupportLabel} /> : null}
        </dl>
      ) : null}

      <dl className="space-y-2.5 border-t border-zinc-100 pt-3">
        {contactPhoneDisplay ? (
          <DetailRow label="Contact number" value={contactPhoneDisplay} />
        ) : null}
        <DetailRow
          label={serviceLabels?.cleanerPreferenceLabel ?? "Cleaner preference"}
          value={cleanerPreferenceLabel}
        />
        {showAssignedCleaner ? (
          <DetailRow
            label={serviceLabels?.assignedCleanerLabel ?? "Assigned cleaner"}
            value={assignedCleanerLabel}
            valueClassName="text-emerald-800"
          />
        ) : null}
      </dl>

      {showAssignmentCallout ? (
        <p className="rounded-lg border border-sky-200/80 bg-sky-50/80 px-3 py-2.5 text-sm leading-snug text-sky-950">
          {assignmentCustomerMessage}
        </p>
      ) : null}

      {specialInstructions ? (
        <p className="border-t border-zinc-100 pt-3 text-sm leading-snug text-zinc-600">
          <span className="font-medium text-zinc-800">
            {serviceLabels?.notesLabel ?? "Notes"}
          </span>
          <span className="mt-0.5 block text-zinc-700">{specialInstructions}</span>
        </p>
      ) : null}

      {payments.length > 0 ? (
        <section className="border-t border-zinc-100 pt-3" aria-labelledby="payment-summary-heading">
          <h3
            id="payment-summary-heading"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            Payment summary
          </h3>
          <ul className="mt-1.5 divide-y divide-zinc-100">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex min-w-0 items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <span className="min-w-0 shrink">
                  <StatusBadge
                    label={labelForCustomerPaymentStatus(payment.status)}
                    tone={toneForPaymentStatus(payment.status)}
                    variant="soft"
                  />
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
                  {formatZar(payment.amountCents, payment.currency)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-zinc-500">
            Booking total {formatZar(priceCents, currency)}
          </p>
        </section>
      ) : null}
    </div>
  );
}
