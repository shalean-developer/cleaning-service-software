import Link from "next/link";
import {
  ADMIN_OVERVIEW_MUTED_CLASS,
  ADMIN_OVERVIEW_SECTION_LABEL_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";
import { ADMIN_BOOKING_CREATE_PATH } from "@/features/dashboards/adminNav";

const PREVIEW_MODE_TOOLTIP =
  "Preview mode until admin-assisted booking is enabled.";

type Props = {
  shownCount: number;
  draftBookingEnabled?: boolean;
};

export function AdminBookingsOperationsHeader({
  shownCount,
  draftBookingEnabled = false,
}: Props) {
  return (
    <header className="mb-5 flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <aside className="min-w-0 space-y-1.5">
          <p className={ADMIN_OVERVIEW_SECTION_LABEL_CLASS}>Bookings</p>
          <h1 className={`${ADMIN_OVERVIEW_SERIF_TITLE_CLASS} text-3xl sm:text-4xl`}>
            Booking operations
          </h1>
          <p className={ADMIN_OVERVIEW_MUTED_CLASS}>
            Search, filter, and triage today&apos;s queue.
          </p>
        </aside>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:shrink-0 lg:justify-end lg:pt-1">
          <Link
            href={ADMIN_BOOKING_CREATE_PATH}
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
            data-testid="admin-bookings-create-booking"
            title={!draftBookingEnabled ? PREVIEW_MODE_TOOLTIP : undefined}
          >
            Create booking
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {shownCount} shown
          </p>
        </div>
      </div>
    </header>
  );
}
