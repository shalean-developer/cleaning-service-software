/** Read-only distinction between strip counts and the assignments work queue (7A-2c). */
export const ADMIN_ASSIGNMENT_QUEUE_STRIP_FOOTNOTE_COPY =
  "The queue strip shows exact counts across all bookings. This page shows the detailed assignment work queue used for triage, so counts may differ from the Assignment attention chip.";

export function AdminAssignmentQueueStripFootnote() {
  return (
    <p className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs leading-relaxed text-zinc-600">
      {ADMIN_ASSIGNMENT_QUEUE_STRIP_FOOTNOTE_COPY}
    </p>
  );
}
