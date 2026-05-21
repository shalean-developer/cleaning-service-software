import type {
  LaunchReadinessLevel,
  RecurringHealthSummary,
} from "@/features/recurring/server/recurringHealthTypes";
import { AdminMetricCard } from "@/components/dashboard/admin/overview/AdminMetricCard";
import { ADMIN_OVERVIEW_SNAPSHOT_SHELL_CLASS } from "@/components/dashboard/admin/overview/adminOverviewStyles";
import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  PauseCircle,
  Repeat,
  XCircle,
} from "lucide-react";

type Props = { summary: RecurringHealthSummary };

function launchFooter(level: LaunchReadinessLevel): string {
  if (level === "green") return "Launch safe";
  if (level === "amber") return "Watch — review warnings";
  return "Blocker — do not launch";
}

function statusFooter(status: RecurringHealthSummary["overallStatus"]): string {
  if (status === "healthy") return "No critical alerts";
  if (status === "warning") return "Review warnings below";
  return "Critical issues need attention";
}

export function AdminRecurringHealthSummaryCards({ summary }: Props) {
  return (
    <section className={ADMIN_OVERVIEW_SNAPSHOT_SHELL_CLASS} aria-label="Recurring health summary">
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        <li className="sm:col-span-2 xl:col-span-4">
          <AdminMetricCard
            label="Launch readiness"
            value={summary.launchReadiness.toUpperCase()}
            footer={launchFooter(summary.launchReadiness)}
            icon={summary.launchReadiness === "green" ? Repeat : AlertTriangle}
            emphasize={summary.launchReadiness === "red"}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Active series"
            value={String(summary.activeSeriesCount)}
            footer={statusFooter(summary.overallStatus)}
            icon={Repeat}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Paused / cancelled"
            value={`${summary.pausedSeriesCount} / ${summary.cancelledSeriesCount}`}
            footer="Not generating new visits"
            icon={PauseCircle}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Next 45 days"
            value={String(summary.childrenGeneratedNext45Days)}
            footer="Generated child visits in horizon"
            icon={CalendarClock}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Payment required"
            value={String(summary.paymentRequiredChildrenCount)}
            footer={
              summary.overdueUnpaidChildrenCount > 0
                ? `${summary.overdueUnpaidChildrenCount} overdue (>48h)`
                : "Unpaid generated children"
            }
            icon={CreditCard}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Stale next occurrence"
            value={String(summary.staleNextOccurrenceCount)}
            footer="Active series past due >24h"
            icon={AlertTriangle}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Generation risks"
            value={String(summary.failedGenerationRiskCount)}
            footer="Stale pointer or paused still generating"
            icon={AlertTriangle}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Audit issues"
            value={String(summary.auditIssuesCount)}
            footer={summary.auditIssuesCount === 0 ? "Healthy" : "Run ops audit for detail"}
            icon={XCircle}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Open requests"
            value={String(summary.openSupportRequestsCount)}
            footer="Customer pause / cancel / reschedule"
            icon={AlertTriangle}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Cleaner visibility risk"
            value={String(summary.cleanerVisibilityRiskCount)}
            footer="Unpaid children visible to cleaners"
            icon={XCircle}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Cron last run"
            value={
              summary.cronLastRunAgeHours != null
                ? `${summary.cronLastRunAgeHours}h`
                : "—"
            }
            footer={
              summary.cronLastRunStatus
                ? `Status: ${summary.cronLastRunStatus}`
                : "No run logged"
            }
            icon={CalendarClock}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Overall alerts"
            value={summary.overallStatus.toUpperCase()}
            footer={statusFooter(summary.overallStatus)}
            icon={summary.overallStatus === "healthy" ? Repeat : AlertTriangle}
          />
        </li>
      </ul>
    </section>
  );
}
