import Link from "next/link";
import {
  ADMIN_OVERVIEW_MUTED_CLASS,
  ADMIN_OVERVIEW_SECTION_LABEL_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";

type Props = {
  totalCount: number;
};

export function AdminCleanersNetworkHeader({ totalCount }: Props) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <p className={ADMIN_OVERVIEW_SECTION_LABEL_CLASS}>Network</p>
        <h1 className={`${ADMIN_OVERVIEW_SERIF_TITLE_CLASS} text-3xl sm:text-4xl`}>Cleaners</h1>
        <p className={ADMIN_OVERVIEW_MUTED_CLASS}>
          Availability, performance and reliability across the network.
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {totalCount} cleaner{totalCount === 1 ? "" : "s"}
        </p>
        <Link
          href="/admin/cleaners/new"
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-slate-200/90 bg-white px-4 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Create cleaner
        </Link>
      </div>
    </header>
  );
}
