import Link from "next/link";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import {
  ADMIN_OVERVIEW_PANEL_CLASS,
  ADMIN_OVERVIEW_PANEL_HEADER_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";
import {
  formatEarningsZar,
  payoutStatusLabelUpper,
  payoutStatusTone,
  type AdminEarningsCleanerPayoutRow,
  type AdminEarningsPayoutTotals,
} from "@/features/earnings/server/adminEarningsDisplay";

function totalPillClass(tone: "info" | "success" | "warning"): string {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide";
  switch (tone) {
    case "info":
      return `${base} bg-blue-50 text-blue-800`;
    case "success":
      return `${base} bg-emerald-50 text-emerald-800`;
    case "warning":
      return `${base} bg-orange-50 text-orange-800`;
  }
}

function rowStatusClass(tone: "info" | "success" | "warning"): string {
  const base =
    "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide";
  switch (tone) {
    case "info":
      return `${base} bg-blue-100 text-blue-800`;
    case "success":
      return `${base} bg-emerald-100 text-emerald-800`;
    case "warning":
      return `${base} bg-orange-100 text-orange-800`;
  }
}

type Props = {
  totals: AdminEarningsPayoutTotals;
  rows: AdminEarningsCleanerPayoutRow[];
};

export function AdminEarningsCleanerPayouts({ totals, rows }: Props) {
  const scheduledTotal = formatEarningsZar(totals.scheduledCents);
  const releasedTotal = formatEarningsZar(totals.releasedCents);
  const heldTotal = formatEarningsZar(totals.heldCents);
  const canBatchRelease = totals.scheduledCents > 0;

  return (
    <section className={ADMIN_OVERVIEW_PANEL_CLASS} aria-label="Cleaner payouts">
      <header className={ADMIN_OVERVIEW_PANEL_HEADER_CLASS}>
        <div className="space-y-1">
          <h2 className={ADMIN_OVERVIEW_SERIF_TITLE_CLASS}>Cleaner payouts</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={totalPillClass("info")}>
            {scheduledTotal} SCHEDULED
          </span>
          <span className={totalPillClass("success")}>
            {releasedTotal} RELEASED
          </span>
          <span className={totalPillClass("warning")}>{heldTotal} HELD</span>
          {canBatchRelease ? (
            <Link
              href="/admin/bookings?view=completed"
              className="inline-flex items-center gap-1 rounded-full border border-blue-200/90 bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <Sparkles className="h-3 w-3" strokeWidth={1.75} aria-hidden />
              RELEASE SCHEDULED
            </Link>
          ) : (
            <span
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-full border border-slate-200/90 bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"
              aria-disabled="true"
            >
              <Sparkles className="h-3 w-3" strokeWidth={1.75} aria-hidden />
              RELEASE SCHEDULED
            </span>
          )}
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="px-5 py-6">
          <EmptyState
            title="No cleaner earnings in this period"
            description="Earnings appear here after jobs are completed and recorded."
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const tone = payoutStatusTone(row.status);
            const bookingHref = row.primaryBookingId
              ? `/admin/bookings/${row.primaryBookingId}`
              : null;

            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-800"
                    aria-hidden
                  >
                    {row.initials}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={row.href}
                      className="truncate text-sm font-semibold text-slate-900 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:rounded"
                    >
                      {row.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">{row.periodLabel}</p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3 sm:gap-4">
                  <p className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatEarningsZar(row.amountCents)}
                  </p>
                  <span className={rowStatusClass(tone)}>{payoutStatusLabelUpper(row.status)}</span>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {bookingHref && row.status === "scheduled" ? (
                      <Link
                        href={bookingHref}
                        className="text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:rounded"
                      >
                        Release
                      </Link>
                    ) : (
                      <span className="text-slate-400" aria-disabled="true">
                        Release
                      </span>
                    )}
                    {bookingHref && row.status === "held" ? (
                      <Link
                        href={bookingHref}
                        className="text-slate-700 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:rounded"
                      >
                        Review
                      </Link>
                    ) : (
                      <span className="text-slate-400" aria-disabled="true">
                        Hold
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
