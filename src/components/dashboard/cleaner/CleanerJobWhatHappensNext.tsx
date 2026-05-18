import {
  CLEANER_DETAIL_CARD_CLASS,
  CLEANER_DETAIL_INSET_CLASS,
  cleanerJobWhatHappensNext,
} from "@/features/dashboards/cleanerJobDetailDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";

type Props = {
  status: BookingStatus;
};

export function CleanerJobWhatHappensNext({ status }: Props) {
  const content = cleanerJobWhatHappensNext(status);
  if (!content) return null;

  return (
    <section className={`${CLEANER_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
      <h2 className="text-sm font-medium text-zinc-800">{content.title}</h2>
      <ul className={`mt-3 space-y-3 ${CLEANER_DETAIL_INSET_CLASS} p-4`}>
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
