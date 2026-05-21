import {
  ADMIN_OVERVIEW_MUTED_CLASS,
  ADMIN_OVERVIEW_SECTION_LABEL_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";

type Props = {
  shownCount: number;
};

export function AdminBookingsOperationsHeader({ shownCount }: Props) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <p className={ADMIN_OVERVIEW_SECTION_LABEL_CLASS}>Bookings</p>
        <h1 className={`${ADMIN_OVERVIEW_SERIF_TITLE_CLASS} text-3xl sm:text-4xl`}>
          Booking operations
        </h1>
        <p className={ADMIN_OVERVIEW_MUTED_CLASS}>
          Search, filter, and triage today&apos;s queue.
        </p>
      </div>
      <p className="shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {shownCount} shown
      </p>
    </header>
  );
}
