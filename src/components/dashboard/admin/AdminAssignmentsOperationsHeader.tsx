import Link from "next/link";
import type { AdminOperationalQueueCountItem } from "@/features/dashboards/server/adminOperationalQueueCounts";
import type { CronHealthSummary } from "@/features/dashboards/adminAssignmentsPageDisplay";
import type { DeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import { ADMIN_DETAIL_CARD_CLASS } from "@/features/dashboards/adminDisplay";

type Props = {
  workQueueCount: number;
  workQueueTotal: number;
  queues: AdminOperationalQueueCountItem[];
  cronSummary: CronHealthSummary | null;
  deferredDiagnostics: DeferredAssignmentDiagnostics | null;
};

function queueByKey(
  queues: AdminOperationalQueueCountItem[],
  key: AdminOperationalQueueCountItem["key"],
): AdminOperationalQueueCountItem | undefined {
  return queues.find((q) => q.key === key);
}

export function AdminAssignmentsOperationsHeader({
  workQueueCount,
  workQueueTotal,
  queues,
  cronSummary,
  deferredDiagnostics,
}: Props) {
  const assignmentAttention = queueByKey(queues, "assignment_attention");
  const needsAssignment = queueByKey(queues, "needs_assignment");

  return (
    <section className={`${ADMIN_DETAIL_CARD_CLASS} px-4 py-3 sm:px-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Dispatch work queue</h2>
          <p className="mt-0.5 text-sm text-zinc-600">
            <span className="font-semibold tabular-nums text-zinc-900">{workQueueCount}</span>
            {workQueueTotal !== workQueueCount ? (
              <span className="text-zinc-500"> shown</span>
            ) : null}
            {" · "}
            triage bookings below — open booking for actions
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {assignmentAttention ? (
            <Link
              href={assignmentAttention.href}
              className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-950 ring-1 ring-amber-200 hover:bg-amber-100"
            >
              Assignment attention{" "}
              <span className="tabular-nums">{assignmentAttention.count}</span>
            </Link>
          ) : null}
          {needsAssignment ? (
            <Link
              href={needsAssignment.href}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50"
            >
              Needs assignment{" "}
              <span className="tabular-nums">{needsAssignment.count}</span>
            </Link>
          ) : null}
          {deferredDiagnostics && deferredDiagnostics.overdueDispatchCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950 ring-1 ring-amber-300">
              Deferred overdue{" "}
              <span className="tabular-nums">{deferredDiagnostics.overdueDispatchCount}</span>
            </span>
          ) : null}
          {cronSummary ? (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                cronSummary.worstLevel === "critical"
                  ? "bg-red-50 text-red-900 ring-red-200"
                  : cronSummary.worstLevel === "warning"
                    ? "bg-amber-50 text-amber-950 ring-amber-200"
                    : "bg-emerald-50 text-emerald-900 ring-emerald-200"
              }`}
            >
              Cron{" "}
              {cronSummary.worstLevel === "critical"
                ? `${cronSummary.criticalCount} critical`
                : cronSummary.worstLevel === "warning"
                  ? `${cronSummary.warningCount} warning`
                  : "healthy"}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
