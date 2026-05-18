import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import { CUSTOMER_BOOKING_DETAIL_CARD_CLASS } from "@/features/dashboards/customerBookingDetailDisplay";

type SummaryField = {
  label: string;
  value: string;
  valueClassName?: string;
};

type Props = {
  scheduleLabel: string;
  locationSummary: string;
  priceCents: number;
  currency: string;
  cleanerPreferenceLabel: string;
  assignedCleanerLabel: string | null;
  assignmentCustomerMessage: string | null;
  specialInstructions: string | null;
};

export function CustomerBookingSummaryGrid({
  scheduleLabel,
  locationSummary,
  priceCents,
  currency,
  cleanerPreferenceLabel,
  assignedCleanerLabel,
  assignmentCustomerMessage,
  specialInstructions,
}: Props) {
  const fields: SummaryField[] = [
    { label: "Schedule", value: scheduleLabel },
    { label: "Location", value: locationSummary },
    { label: "Total", value: formatZar(priceCents, currency) },
    { label: "Cleaner preference", value: cleanerPreferenceLabel },
  ];

  if (assignedCleanerLabel) {
    fields.push({
      label: "Assigned cleaner",
      value: assignedCleanerLabel,
      valueClassName: "text-emerald-800",
    });
  }

  return (
    <section className={`${CUSTOMER_BOOKING_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
      <h2 className="text-sm font-semibold text-zinc-900">Booking summary</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-4">
        {fields.map((field) => (
          <section key={field.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {field.label}
            </dt>
            <dd
              className={`mt-1 text-sm font-semibold text-zinc-900 ${field.valueClassName ?? ""}`}
            >
              {field.value}
            </dd>
          </section>
        ))}
      </dl>

      {assignmentCustomerMessage ? (
        <p className="mt-4 rounded-xl border border-sky-200/80 bg-sky-50/80 px-3.5 py-3 text-sm leading-relaxed text-sky-950">
          {assignmentCustomerMessage}
        </p>
      ) : null}

      {specialInstructions ? (
        <p className="mt-4 border-t border-zinc-100 pt-4 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">Notes</span>
          <span className="mt-1 block text-zinc-700">{specialInstructions}</span>
        </p>
      ) : null}
    </section>
  );
}
