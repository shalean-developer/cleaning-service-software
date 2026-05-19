import {
  CLEANER_EARNINGS_HERO_CLASS,
  CLEANER_EARNINGS_LIST_CLASS,
} from "@/features/dashboards/cleanerDashboardDisplay";
import { presentCleanerPayLine } from "@/features/dashboards/cleanerEarningsPresentation";

type Props = {
  earningsLabel: string;
  earningsCents?: number | null;
  /** Use compact list styling (job detail fallback). */
  variant?: "hero" | "inline";
  includeCalculatingHelper?: boolean;
  className?: string;
};

export function CleanerPayDisplay({
  earningsLabel,
  earningsCents,
  variant = "hero",
  includeCalculatingHelper = false,
  className = "",
}: Props) {
  const pay = presentCleanerPayLine(earningsLabel, earningsCents, {
    includeCalculatingHelper,
  });
  const amountClass = pay.isCalculating
    ? "text-sm font-medium text-zinc-600"
    : variant === "hero"
      ? CLEANER_EARNINGS_HERO_CLASS
      : CLEANER_EARNINGS_LIST_CLASS;

  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <p className={amountClass} aria-label={pay.isCalculating ? pay.amountText : `Your pay ${pay.amountText}`}>
        {pay.amountText}
      </p>
      {pay.helperText ? (
        <p className="mt-0.5 max-w-[12rem] text-right text-[0.6875rem] leading-snug text-zinc-500 sm:max-w-none sm:text-left">
          {pay.helperText}
        </p>
      ) : null}
    </div>
  );
}
