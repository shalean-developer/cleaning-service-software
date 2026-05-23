type Props = {
  assignmentDispatchAttention: number;
  confirmedWithoutAssignmentDispatch: number;
};

export function AdminAssistedAssignmentRecoveryPanel({
  assignmentDispatchAttention,
  confirmedWithoutAssignmentDispatch,
}: Props) {
  const hasIssues = assignmentDispatchAttention > 0 || confirmedWithoutAssignmentDispatch > 0;

  if (!hasIssues) {
    return (
      <section
        className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900"
        data-testid="admin-assisted-assignment-recovery-empty"
      >
        <p className="font-medium">No assignment recovery items</p>
        <p className="mt-1 text-xs">Confirmed bookings are progressing through assignment dispatch.</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm"
      data-testid="admin-assisted-assignment-recovery"
    >
      <h2 className="text-base font-semibold text-red-950">Assignment recovery visibility</h2>
      <p className="mt-1 text-sm text-red-900/90">
        Read-only — no auto-repair. Assignment starts only after payment confirmation.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-red-100 bg-white p-3">
          <p className="text-xs text-zinc-500">Confirmed but unassigned</p>
          <p className="text-xl font-semibold tabular-nums text-red-950">
            {confirmedWithoutAssignmentDispatch}
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            Payment confirmed but booking has not reached pending_assignment. Escalate to ops lead;
            verify finalizePaidBooking audit before manual intervention.
          </p>
        </div>
        <div className="rounded-lg border border-red-100 bg-white p-3">
          <p className="text-xs text-zinc-500">Assignment dispatch attention</p>
          <p className="text-xl font-semibold tabular-nums text-red-950">
            {assignmentDispatchAttention}
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            pending_assignment without cleaner or dispatch timestamp. Review assignment queue and
            recurring materialization before re-dispatch.
          </p>
        </div>
      </div>
    </section>
  );
}
