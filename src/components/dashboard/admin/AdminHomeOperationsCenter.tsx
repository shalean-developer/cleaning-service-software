import Link from "next/link";
import { AdminCronHealthCriticalBanner } from "@/components/dashboard/AdminCronHealthPanel";
import { AdminDispatchAlerts } from "@/components/dashboard/admin/overview/AdminDispatchAlerts";
import { AdminLiveOperationsFeed } from "@/components/dashboard/admin/overview/AdminLiveOperationsFeed";
import { AdminOperationalRhythm } from "@/components/dashboard/admin/overview/AdminOperationalRhythm";
import { AdminOverviewHero } from "@/components/dashboard/admin/overview/AdminOverviewHero";
import { AdminSnapshotCards } from "@/components/dashboard/admin/overview/AdminSnapshotCards";
import { AdminSupportQueue } from "@/components/dashboard/admin/overview/AdminSupportQueue";
import { AdminWeeklyPayoutBar } from "@/components/dashboard/admin/overview/AdminWeeklyPayoutBar";
import type { DeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import type { CronHealthSummary } from "@/features/dashboards/adminAssignmentsPageDisplay";
import type {
  AdminHomeDispatchAlert,
  AdminHomeLiveFeedItem,
  AdminHomePayoutSummaryView,
  AdminHomeRhythmPresentation,
  AdminHomeSnapshotPresentation,
  AdminHomeSupportRow,
  AdminHomeTodaySnapshot,
} from "@/features/dashboards/adminHomeOperationsDisplay";
import type { AdminOperationalQueueCountItem } from "@/features/dashboards/server/adminOperationalQueueCounts";
import type { CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";

type Props = {
  referenceNow: string;
  queues: AdminOperationalQueueCountItem[];
  cronSummary: CronHealthSummary | null;
  criticalCronJobs: CronJobHealthSnapshot[];
  deferredDiagnostics: DeferredAssignmentDiagnostics | null;
  assignmentWorkQueueTotal: number;
  snapshot: AdminHomeTodaySnapshot;
  snapshotPresentation: AdminHomeSnapshotPresentation;
  liveFeed: AdminHomeLiveFeedItem[];
  dispatchAlerts: AdminHomeDispatchAlert[];
  supportRows: AdminHomeSupportRow[];
  rhythm: AdminHomeRhythmPresentation;
  payoutView: AdminHomePayoutSummaryView;
};

function StatusBanners({
  criticalCronJobs,
  deferredOverdue,
}: {
  criticalCronJobs: CronJobHealthSnapshot[];
  deferredOverdue: number;
}) {
  return (
    <>
      {criticalCronJobs.length > 0 ? (
        <AdminCronHealthCriticalBanner jobs={criticalCronJobs} />
      ) : null}
      {deferredOverdue > 0 ? (
        <p
          className="rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-2.5 text-sm text-amber-950"
          role="status"
        >
          <span className="font-semibold">{deferredOverdue} deferred dispatch overdue</span>
          {". "}
          <Link
            href="/admin/assignments"
            className="font-medium underline underline-offset-2 hover:text-amber-900"
          >
            Open assignments diagnostics
          </Link>
        </p>
      ) : null}
    </>
  );
}

export function AdminHomeOperationsCenter({
  referenceNow,
  queues,
  cronSummary,
  criticalCronJobs,
  deferredDiagnostics,
  assignmentWorkQueueTotal,
  snapshot,
  snapshotPresentation,
  liveFeed,
  dispatchAlerts,
  supportRows,
  rhythm,
  payoutView,
}: Props) {
  const criticalSignals =
    (cronSummary?.criticalCount ?? 0) + (deferredDiagnostics?.overdueDispatchCount ?? 0);

  const rhythmForDisplay = rhythm.metrics.map((metric) =>
    metric.id === "attention" ? { ...metric, label: "Attention" } : metric,
  );
  const deferredOverdue = deferredDiagnostics?.overdueDispatchCount ?? 0;

  const payoutReleaseSubtitle =
    payoutView.payoutReadyCount > 0
      ? `${payoutView.payoutReadyLabel} booking${payoutView.payoutReadyCount === 1 ? "" : "s"} ready · ${payoutView.weeklyReadyLabel}`
      : payoutView.dataAvailable
        ? payoutView.weeklyReadyLabel
        : payoutView.weeklyReadyLabel;

  return (
    <div className="space-y-6 sm:space-y-8" aria-label="Operations command center">
      <StatusBanners
        criticalCronJobs={criticalCronJobs}
        deferredOverdue={deferredOverdue}
      />

      <AdminOverviewHero />

      <AdminSnapshotCards
        snapshot={snapshot}
        presentation={snapshotPresentation}
        criticalSignals={criticalSignals}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
        <AdminLiveOperationsFeed items={liveFeed} />
        <div className="flex flex-col gap-6">
          <AdminDispatchAlerts alerts={dispatchAlerts} />
          <AdminSupportQueue rows={supportRows} />
        </div>
      </div>

      <AdminOperationalRhythm
        metrics={rhythmForDisplay}
        emptyWindowHint={rhythm.emptyWindowHint}
      />

      <AdminWeeklyPayoutBar payout={payoutView} releaseSubtitle={payoutReleaseSubtitle} />
    </div>
  );
}
