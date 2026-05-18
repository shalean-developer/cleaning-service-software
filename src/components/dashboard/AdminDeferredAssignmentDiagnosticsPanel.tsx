import type { DeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import {
  ADMIN_DETAIL_CARD_CLASS,
  ADMIN_SECTION_MUTED_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
} from "@/features/dashboards/adminDisplay";

type Props = {
  diagnostics: DeferredAssignmentDiagnostics;
};

export function AdminDeferredAssignmentDiagnosticsPanel({ diagnostics }: Props) {
  const last = diagnostics.lastCronRun;

  return (
    <section className={`${ADMIN_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
      <h2 className={ADMIN_SECTION_TITLE_CLASS}>Deferred assignment diagnostics</h2>
      <p className={ADMIN_SECTION_MUTED_CLASS}>
        Feature flag: {diagnostics.deferredAssignmentEnabled ? "enabled" : "disabled"} (env{" "}
        <code className="text-xs">DEFERRED_ASSIGNMENT_ENABLED</code>)
      </p>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Awaiting window
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
            {diagnostics.awaitingDispatchWindowCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Ready for dispatch
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
            {diagnostics.readyForDispatchCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Overdue dispatch
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-amber-900">
            {diagnostics.overdueDispatchCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Oldest overdue
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-zinc-900">
            {diagnostics.oldestOverdueDispatchAt
              ? new Date(diagnostics.oldestOverdueDispatchAt).toLocaleString("en-ZA")
              : "—"}
          </dd>
        </div>
      </dl>

      {last ? (
        <section className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Last cron run
          </h3>
          <p className="mt-1 text-zinc-800">
            {new Date(last.completedAt).toLocaleString("en-ZA")} —{" "}
            {last.ok ? "success" : "failure"} ({last.triggerSource})
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Candidates {last.candidateCount} · attempted {last.attemptedCount} · dispatched{" "}
            {last.dispatchedCount} · skipped {last.skippedCount} · failed {last.failedCount}
          </p>
        </section>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">No deferred dispatch cron runs recorded yet.</p>
      )}
    </section>
  );
}
