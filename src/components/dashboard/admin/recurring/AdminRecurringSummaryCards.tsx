import type { AdminRecurringSeriesSummary } from "@/features/recurring/server/recurringManagementTypes";
import { AdminMetricCard } from "@/components/dashboard/admin/overview/AdminMetricCard";
import { ADMIN_OVERVIEW_SNAPSHOT_SHELL_CLASS } from "@/components/dashboard/admin/overview/adminOverviewStyles";
import { CalendarClock, CreditCard, PauseCircle, Repeat } from "lucide-react";

type Props = { summary: AdminRecurringSeriesSummary };

export function AdminRecurringSummaryCards({ summary }: Props) {
  return (
    <section className={ADMIN_OVERVIEW_SNAPSHOT_SHELL_CLASS} aria-label="Recurring summary">
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        <li>
          <AdminMetricCard
            label="Active series"
            value={String(summary.activeCount)}
            footer="Generating visits on schedule"
            icon={Repeat}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Paused series"
            value={String(summary.pausedCount)}
            footer="No new visits generated"
            icon={PauseCircle}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Payment required"
            value={String(summary.paymentRequiredChildrenCount)}
            footer="Unpaid generated child visits"
            icon={CreditCard}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Next 7 days"
            value={String(summary.nextSevenDaysCount)}
            footer="Scheduled series visits"
            icon={CalendarClock}
          />
        </li>
      </ul>
    </section>
  );
}
