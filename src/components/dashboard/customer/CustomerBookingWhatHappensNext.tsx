import {
  CUSTOMER_BOOKING_DETAIL_CARD_CLASS,
  CUSTOMER_BOOKING_DETAIL_INSET_CLASS,
  customerBookingWhatHappensNext,
} from "@/features/dashboards/customerBookingDetailDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";

type Props = {
  status: BookingStatus;
};

export function CustomerBookingWhatHappensNext({ status }: Props) {
  const content = customerBookingWhatHappensNext(status);
  if (!content) return null;

  return (
    <section className={`${CUSTOMER_BOOKING_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
      <h2 className="text-sm font-medium text-zinc-800">{content.title}</h2>
      <ul className={`mt-3 space-y-3 ${CUSTOMER_BOOKING_DETAIL_INSET_CLASS} p-4`}>
        {content.steps.map((step) => (
          <li key={step.title} className="flex gap-3 text-sm">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400"
              aria-hidden
            />
            <div>
              <p className="font-medium text-zinc-900">{step.title}</p>
              <p className="mt-0.5 leading-relaxed text-zinc-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
