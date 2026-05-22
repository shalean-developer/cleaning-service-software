import Link from "next/link";
import { Wand2 } from "lucide-react";
import {
  ADMIN_OVERVIEW_MUTED_CLASS,
  ADMIN_OVERVIEW_SECTION_LABEL_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";

type Props = {
  totalCount: number;
};

export function AdminCustomersRegistryHeader({ totalCount }: Props) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <p className={ADMIN_OVERVIEW_SECTION_LABEL_CLASS}>Customers</p>
        <h1 className={`${ADMIN_OVERVIEW_SERIF_TITLE_CLASS} text-3xl sm:text-4xl`}>
          Customer registry
        </h1>
        <p className={ADMIN_OVERVIEW_MUTED_CLASS}>
          Lifetime, recurring rhythm, and care flags.
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {totalCount} customer{totalCount === 1 ? "" : "s"}
        </p>
        <Link
          href="/admin/customers/new"
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-blue-200/90 bg-blue-50 px-4 text-xs font-semibold text-blue-800 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Wand2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          New booking
        </Link>
      </div>
    </header>
  );
}
