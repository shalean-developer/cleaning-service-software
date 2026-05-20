import {
  CLEANER_EARNINGS_SUMMARY_COMPLETED_JOBS_HELPER,
  CLEANER_EARNINGS_SUMMARY_TOTAL_EARNINGS_HELPER,
} from "@/features/dashboards/cleanerEarningsPresentation";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import { UI_CARD_SHELL_CLASS } from "@/lib/ui/productUiTokens";

type Props = {
  completedJobCount: number;
  totalEarningsCents: number;
};

const cardClassName = `${UI_CARD_SHELL_CLASS} px-3.5 py-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50/50 sm:px-4 sm:py-3.5`;

function CompletedJobsIcon() {
  return (
    <svg
      className="h-4 w-4 text-zinc-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5 13 4 4L19 7M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

function EarningsIcon() {
  return (
    <svg
      className="h-4 w-4 text-zinc-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path strokeLinecap="round" d="M12 3v18M8 7h8a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h8" />
    </svg>
  );
}

export function CleanerEarningsSummaryCards({ completedJobCount, totalEarningsCents }: Props) {
  return (
    <section
      className="mb-5 grid grid-cols-2 gap-2.5 sm:mb-6 sm:gap-3"
      aria-label="Earnings overview"
    >
      <article className={cardClassName}>
        <span className="flex items-center gap-2">
          <CompletedJobsIcon />
          <h2 className="text-xs font-medium text-zinc-500">Completed jobs</h2>
        </span>
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-[1.65rem]">
          {completedJobCount}
        </p>
        <p className="mt-1 text-xs leading-snug text-zinc-500">
          {CLEANER_EARNINGS_SUMMARY_COMPLETED_JOBS_HELPER}
        </p>
      </article>

      <article className={cardClassName}>
        <span className="flex items-center gap-2">
          <EarningsIcon />
          <h2 className="text-xs font-medium text-zinc-500">Total earnings</h2>
        </span>
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-[1.65rem]">
          {formatZar(totalEarningsCents)}
        </p>
        <p className="mt-1 text-xs leading-snug text-zinc-500">
          {CLEANER_EARNINGS_SUMMARY_TOTAL_EARNINGS_HELPER}
        </p>
      </article>
    </section>
  );
}
