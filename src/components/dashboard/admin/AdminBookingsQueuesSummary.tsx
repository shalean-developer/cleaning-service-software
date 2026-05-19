import Link from "next/link";
import { AdminOperationalQueueStrip } from "@/components/dashboard/AdminOperationalQueueStrip";
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
};

export function AdminBookingsQueuesSummary({ queues, activeFilter }: Props) {
  const urgentCount =
    (queues.find((q) => q.key === "payment_attention")?.count ?? 0) +
    (queues.find((q) => q.key === "assignment_attention")?.count ?? 0);

  return (
    <details className={`mb-4 ${ADMIN_DETAILS_DISCLOSURE_CLASS}`}>
      <summary className={ADMIN_DETAILS_SUMMARY_CLASS}>
        Operational queues
        {urgentCount > 0 ? (
          <span className="ml-2 font-normal text-amber-800">({urgentCount} need attention)</span>
        ) : null}
      </summary>
      <div className={`${ADMIN_DETAILS_BODY_CLASS} pb-2 pt-2`}>
        <p className="text-[11px] text-zinc-600">
          Exact counts · use presets above or open a workbench.
        </p>
        <nav className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-zinc-600">
          <Link href="/admin" className="hover:text-zinc-900">
            Operations home
          </Link>
          <Link href="/admin/assignments" className="hover:text-zinc-900">
            Assignments workbench
          </Link>
        </nav>
        <AdminOperationalQueueStrip queues={queues} activeFilter={activeFilter} compact />
      </div>
    </details>
  );
}
