import type { CleanerOperationalAuditRow } from "@/lib/database/types";
import { labelForCleanerLifecycleAuditAction } from "@/features/cleaners/server/admin/adminCleanerOperationalDisplay";
import { ADMIN_DETAIL_INSET_CLASS } from "@/features/dashboards/adminDisplay";

type Props = {
  entries: CleanerOperationalAuditRow[];
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AdminCleanerAuditLog({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No lifecycle audit entries recorded yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id} className={`${ADMIN_DETAIL_INSET_CLASS} px-3 py-2.5 text-sm`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-zinc-900">
              {labelForCleanerLifecycleAuditAction(entry.action)}
              <span className="ml-2 font-normal text-zinc-500">({entry.outcome})</span>
            </p>
            <time className="text-xs text-zinc-500" dateTime={entry.created_at}>
              {formatTimestamp(entry.created_at)}
            </time>
          </div>
          {entry.reason ? (
            <p className="mt-1 text-xs text-zinc-600">Reason: {entry.reason}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
