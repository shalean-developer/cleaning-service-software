import Link from "next/link";
import { customerHubRebookHref, formatHubStayDateLine } from "@/features/dashboards/customerHubDisplay";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";

type Props = {
  stays: CustomerBookingListItem[];
};

export function CustomerHomeRecentActivity({ stays }: Props) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-xl font-medium text-shalean-navy">Recent stays</h2>
        <Link
          href="/customer/bookings"
          className="text-xs font-medium text-shalean-primary transition-colors hover:underline"
        >
          View all
        </Link>
      </div>

      {stays.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Completed visits will appear here.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100">
          {stays.map((stay) => {
            const rebookHref = customerHubRebookHref(stay.display.serviceSlug);
            const canRate =
              stay.status === "completed" ||
              stay.status === "payout_ready" ||
              stay.status === "paid_out";

            return (
              <li
                key={stay.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{stay.display.serviceLabel}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{formatHubStayDateLine(stay)}</p>
                  {canRate ? (
                    <Link
                      href={`/customer/bookings/${stay.id}`}
                      className="mt-1.5 inline-block text-xs font-medium text-shalean-primary hover:underline"
                    >
                      Rate this visit
                    </Link>
                  ) : null}
                </div>
                <Link
                  href={rebookHref}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <path strokeLinecap="round" d="M4 12a8 8 0 0 1 13.3-5.7M20 6v4h-4M20 12a8 8 0 0 1-13.3 5.7M4 18v-4h4" />
                  </svg>
                  Rebook
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
