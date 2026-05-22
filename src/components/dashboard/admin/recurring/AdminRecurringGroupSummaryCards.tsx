import type { AdminRecurringScheduleGroupDetail } from "@/features/recurring/server/recurringManagementTypes";
import { AdminMetricCard } from "@/components/dashboard/admin/overview/AdminMetricCard";
import { ADMIN_OVERVIEW_SNAPSHOT_SHELL_CLASS } from "@/components/dashboard/admin/overview/adminOverviewStyles";
import { AlertTriangle, CalendarClock, CreditCard, Inbox, Repeat } from "lucide-react";

type Props = { group: AdminRecurringScheduleGroupDetail };

export function AdminRecurringGroupSummaryCards({ group }: Props) {
  return (
    <section className={ADMIN_OVERVIEW_SNAPSHOT_SHELL_CLASS} aria-label="Group summary">
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-5">
        <li>
          <AdminMetricCard
            label="Active weekday series"
            value={String(group.activeSeriesCount)}
            footer={`${group.pausedSeriesCount} paused · ${group.cancelledSeriesCount} cancelled`}
            icon={Repeat}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Payment required visits"
            value={String(group.unpaidChildVisits)}
            footer="Unpaid generated child visits"
            icon={CreditCard}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Next upcoming visit"
            value={group.nextUpcomingVisit ? "Scheduled" : "-"}
            footer={group.nextUpcomingVisit?.scheduleLabel ?? "No upcoming visits"}
            icon={CalendarClock}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Open requests"
            value={String(group.openCustomerRequestsCount)}
            footer="Customer pause / cancel / reschedule"
            icon={Inbox}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Overdue unpaid"
            value={String(group.overdueUnpaidCount)}
            footer="Generated visits unpaid >48h"
            icon={AlertTriangle}
          />
        </li>
      </ul>
    </section>
  );
}
