import { CLEANER_LIST_CARD_PADDING } from "@/features/dashboards/cleanerDashboardDisplay";
import {
  CLEANER_DETAIL_CARD_CLASS,
  cleanerJobWhatHappensNext,
} from "@/features/dashboards/cleanerJobDetailDisplay";
import {
  UI_DETAILS_BODY_CLASS,
  UI_DETAILS_SUMMARY_CLASS,
} from "@/lib/ui/productUiTokens";
import type { BookingStatus } from "@/features/bookings/server/types";

type Props = {
  status: BookingStatus;
};

export function CleanerJobWhatHappensNext({ status }: Props) {
  const content = cleanerJobWhatHappensNext(status);
  if (!content) return null;

  return (
    <details className={`${CLEANER_DETAIL_CARD_CLASS} group ${CLEANER_LIST_CARD_PADDING}`}>
      <summary className={UI_DETAILS_SUMMARY_CLASS}>
        <span className="inline-flex items-center gap-2">
          {content.title}
          <span className="text-xs font-normal text-zinc-500 group-open:hidden" aria-hidden>
            Show steps
          </span>
        </span>
      </summary>
      <ol className={`${UI_DETAILS_BODY_CLASS} space-y-2`}>
        {content.steps.map((step, index) => (
          <li key={step.title} className="flex gap-2.5 text-sm">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[0.625rem] font-semibold text-zinc-600"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-zinc-900">{step.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-zinc-600">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
