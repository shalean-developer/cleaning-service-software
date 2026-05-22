import { buildAdminSupportRequestHistory } from "@/features/support/server/supportRequestHistory";

type Props = {
  createdAt: string;
  updatedAt: string;
  status: string;
  statusChangedAt: string;
  respondedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  customerResponse: string | null;
  adminNotes: string | null;
};

export function AdminSupportRequestHistoryPanel(props: Props) {
  const entries = buildAdminSupportRequestHistory({
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
    status: props.status,
    statusChangedAt: props.statusChangedAt,
    respondedAt: props.respondedAt,
    resolvedAt: props.resolvedAt,
    resolvedBy: props.resolvedBy,
    customerResponse: props.customerResponse,
    adminNotes: props.adminNotes,
  });

  return (
    <details className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/80">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-700">
        Request history
      </summary>
      <ol className="space-y-2 border-t border-zinc-100 px-3 py-2">
        {entries.map((entry) => (
          <li key={entry.key} className="text-xs text-zinc-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-zinc-800">{entry.label}</span>
              {entry.adminOnly ? (
                <span className="rounded bg-zinc-200 px-1 py-0.5 text-[10px] text-zinc-600">
                  Admin
                </span>
              ) : null}
              {entry.at ? (
                <time dateTime={entry.at} className="text-zinc-400">
                  {new Date(entry.at).toLocaleString("en-ZA")}
                </time>
              ) : null}
            </div>
            {entry.detail ? <p className="mt-0.5 text-zinc-700">{entry.detail}</p> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
