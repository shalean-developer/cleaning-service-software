import Link from "next/link";
import { AdminBookingsFilterPresets } from "@/components/dashboard/admin/AdminBookingsFilterPresets";
import { AdminBookingsQueuesSummary } from "@/components/dashboard/admin/AdminBookingsQueuesSummary";
import { AdminBookingsFilters } from "@/components/dashboard/AdminBookingsFilters";
import {
  ADMIN_DETAILS_BODY_CLASS,
  ADMIN_DETAILS_DISCLOSURE_CLASS,
  ADMIN_DETAILS_SUMMARY_CLASS,
} from "@/features/dashboards/adminDisplay";
import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";
import type { AdminOperationalQueueCountItem } from "@/features/dashboards/server/adminOperationalQueueCounts";

type Props = {
  queues: AdminOperationalQueueCountItem[];
  activeFilter?: AdminBookingFilter;
  filter?: AdminBookingFilter;
  search?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  matchTotal: number | null;
  returnedCount: number;
  limit: number;
  capped: boolean;
  subsetFiltered?: boolean;
};

export function AdminBookingsOperationsExtras({
  queues,
  activeFilter,
  filter,
  search,
  scheduledFrom,
  scheduledTo,
  matchTotal,
  returnedCount,
  limit,
  capped,
  subsetFiltered,
}: Props) {
  return (
    <div className="mt-8 space-y-3 border-t border-slate-200/80 pt-6">
      <AdminBookingsQueuesSummary queues={queues} activeFilter={activeFilter} />

      <details className={ADMIN_DETAILS_DISCLOSURE_CLASS}>
        <summary className={ADMIN_DETAILS_SUMMARY_CLASS}>
          Advanced search &amp; export
        </summary>
        <div className={`${ADMIN_DETAILS_BODY_CLASS} space-y-3 pt-2`}>
          <AdminBookingsFilterPresets
            filter={filter}
            search={search}
            scheduledFrom={scheduledFrom}
            scheduledTo={scheduledTo}
          />
          <AdminBookingsFilters
            filter={filter}
            search={search}
            scheduledFrom={scheduledFrom}
            scheduledTo={scheduledTo}
            matchTotal={matchTotal}
            returnedCount={returnedCount}
            limit={limit}
            capped={capped}
            subsetFiltered={subsetFiltered}
          />
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-600">
            <Link href="/admin" className="hover:text-slate-900">
              Operations home
            </Link>
            <Link href="/admin/assignments" className="hover:text-slate-900">
              Assignments workbench
            </Link>
          </nav>
        </div>
      </details>
    </div>
  );
}
