import Link from "next/link";
import { Sparkles, Wallet } from "lucide-react";
import type { AdminHomePayoutSummaryView } from "@/features/dashboards/adminHomeOperationsDisplay";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";

type Props = {
  payout: AdminHomePayoutSummaryView;
  /** Presentation-only subtitle (e.g. cleaner count from loaded slice). */
  releaseSubtitle?: string;
};

export function AdminWeeklyPayoutBar({ payout, releaseSubtitle }: Props) {
  const hasReady = payout.payoutReadyCount > 0 && payout.dataAvailable;
  const canRelease = hasReady;

  return (
    <section
      className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white via-blue-50/30 to-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
      aria-label="Weekly payouts"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {hasReady ? "Weekly payouts ready" : "Payout-ready bookings"}
            </p>
            <p className="mt-0.5 text-sm text-slate-600">
              {releaseSubtitle ?? payout.weeklyReadyLabel}
            </p>
            {payout.pendingReviewCents > 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                Pending review: {formatZar(payout.pendingReviewCents)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {canRelease ? (
            <Link
              href={payout.previewHref}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              aria-label="Release payout-ready bookings now"
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Release now
            </Link>
          ) : (
            <span
              className="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400"
              aria-disabled="true"
              title={
                payout.dataAvailable
                  ? "Nothing awaiting release"
                  : "Payout summary unavailable"
              }
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Release now
            </span>
          )}
          <Link
            href="/admin/payouts"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            aria-label="Open earnings and payouts"
          >
            Open earnings →
          </Link>
        </div>
      </div>
    </section>
  );
}
