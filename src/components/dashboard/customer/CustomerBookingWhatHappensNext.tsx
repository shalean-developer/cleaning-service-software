import {
  CUSTOMER_BOOKING_DETAIL_CARD_CLASS,
  customerBookingCompactGuidance,
} from "@/features/dashboards/customerBookingDetailDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";

type Props = {
  status: BookingStatus;
  serviceSlug?: string | null;
  deferredAssignmentMessage?: string | null;
};

export function CustomerBookingWhatHappensNext({
  status,
  serviceSlug,
  deferredAssignmentMessage,
}: Props) {
  const guidance = customerBookingCompactGuidance(status, {
    deferredAssignmentMessage,
    serviceSlug,
  });
  if (!guidance) return null;

  const hasDetails = (guidance.detailSteps?.length ?? 0) > 0;

  return (
    <section className={`${CUSTOMER_BOOKING_DETAIL_CARD_CLASS} px-4 py-3 sm:px-5 sm:py-3.5`}>
      <p className="text-sm leading-snug text-zinc-700">{guidance.primary}</p>
      {guidance.secondary ? (
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{guidance.secondary}</p>
      ) : null}
      {hasDetails ? (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer font-medium text-zinc-600 hover:text-zinc-900">
            More about your booking
          </summary>
          <ul className="mt-2 space-y-2 border-l border-zinc-200 pl-3">
            {guidance.detailSteps?.map((step) => (
              <li key={step.title}>
                <p className="font-medium text-zinc-800">{step.title}</p>
                <p className="text-xs leading-relaxed text-zinc-600">{step.body}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
