import {
  AlertTriangle,
  CalendarCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { AdminMetricCard } from "@/components/dashboard/admin/overview/AdminMetricCard";
import type { DispatchOrchestrationSummary } from "@/features/dashboards/adminDispatchOrchestrationDisplay";

type Props = {
  summary: DispatchOrchestrationSummary;
};

export function AdminDispatchSummaryCards({ summary }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AdminMetricCard
        label="Confirmed"
        value={String(summary.confirmed)}
        footer="Scheduled today (SAST)"
        icon={CalendarCheck}
      />
      <AdminMetricCard
        label="Cleaners on duty"
        value={String(summary.cleanersOnDuty)}
        footer="Assigned to today's visits"
        icon={Users}
      />
      <AdminMetricCard
        label="Matching"
        value={String(summary.matching)}
        footer="Paid, awaiting cleaner"
        icon={Sparkles}
        secondary={summary.matching > 0 ? "In progress" : undefined}
      />
      <AdminMetricCard
        label="Attention"
        value={String(summary.attention)}
        footer="Dispatch needs review"
        icon={AlertTriangle}
        emphasize={summary.attention > 0}
        secondary={summary.attention > 0 ? "Action required" : undefined}
      />
    </div>
  );
}
