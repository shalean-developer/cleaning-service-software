import type { AdminAssignmentQueueItem } from "@/features/dashboards/server/types";
import { AdminRunbookRef } from "./AdminRunbookRef";

type Props = {
  item: AdminAssignmentQueueItem;
};

export function AdminAssignmentQueueGuidance({ item }: Props) {
  return (
    <section className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
      <p>{item.queueReason}</p>
      <ul className="mt-2 space-y-0.5 text-xs text-zinc-600">
        <li>{item.opsSearching ? "Searching: yes" : "Searching: no"}</li>
        <li>{item.opsAdminRequired ? "Admin action required: yes" : "Admin action required: no"}</li>
        <li>
          {item.recoveryCronCanHandle
            ? "Recovery cron: can handle"
            : "Recovery cron: not primary fix"}
        </li>
        <li>
          {item.manualInterventionNeeded
            ? "Manual intervention: likely needed"
            : "Manual intervention: not flagged"}
        </li>
      </ul>
      {item.runbookKey ? <AdminRunbookRef runbookKey={item.runbookKey} className="mt-3" /> : null}
    </section>
  );
}
