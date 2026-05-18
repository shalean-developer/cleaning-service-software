import type { AdminAssignmentQueueItem } from "@/features/dashboards/server/types";
import { ADMIN_DETAIL_INSET_CLASS } from "@/features/dashboards/adminDisplay";
import { AdminRunbookRef } from "./AdminRunbookRef";

type Props = {
  item: AdminAssignmentQueueItem;
};

export function AdminAssignmentQueueGuidance({ item }: Props) {
  return (
    <section className={`mt-3 ${ADMIN_DETAIL_INSET_CLASS} px-3 py-2.5 text-sm text-zinc-700`}>
      <p className="text-sm leading-snug text-zinc-800">{item.queueReason}</p>
      <ul className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
        <li>{item.opsSearching ? "Searching: yes" : "Searching: no"}</li>
        <li>
          {item.opsAdminRequired ? "Admin action: required" : "Admin action: not flagged"}
        </li>
        <li>
          {item.recoveryCronCanHandle ? "Recovery cron: can handle" : "Recovery cron: secondary"}
        </li>
        <li>
          {item.manualInterventionNeeded
            ? "Manual: likely needed"
            : "Manual: not flagged"}
        </li>
      </ul>
      {item.runbookKey ? <AdminRunbookRef runbookKey={item.runbookKey} className="mt-2" /> : null}
    </section>
  );
}
