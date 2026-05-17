import type { AdminNotificationWorkerRunListItem } from "@/features/notifications/server/notificationWorkerRunTypes";
import { formatWorkerRunAge } from "@/features/notifications/server/mapNotificationWorkerRunForAdmin";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

type Props = {
  runs: AdminNotificationWorkerRunListItem[];
};

function formatCompletedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function formatProvider(
  deliveryEnabled: boolean,
  emailProvider: string | null,
): string {
  if (!deliveryEnabled) return "off";
  return emailProvider ?? "unknown";
}

function formatTrigger(trigger: AdminNotificationWorkerRunListItem["triggerSource"]): string {
  return trigger === "manual" ? "Manual" : "Cron";
}

export function AdminNotificationRecentWorkerRunsTable({ runs }: Props) {
  return (
    <section className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-4">
      <h2 className="text-sm font-semibold text-zinc-900">Recent worker runs</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Read-only cron history. Raw error payloads and emails are not shown.
      </p>

      {runs.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">No worker runs recorded yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-600">
                <th className="py-2 pr-3 font-medium">Time</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Provider</th>
                <th className="py-2 pr-3 font-medium">Trigger</th>
                <th className="py-2 pr-3 font-medium">Delivery</th>
                <th className="py-2 font-medium">Counters</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={`${run.idShort}-${run.completedAt}`}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="py-2.5 pr-3 align-top">
                    <p className="font-medium text-zinc-900">{formatCompletedAt(run.completedAt)}</p>
                    <p className="text-xs text-zinc-500">
                      {formatWorkerRunAge(run.ageMinutes)} · {run.idShort}
                    </p>
                  </td>
                  <td className="py-2.5 pr-3 align-top">
                    <StatusBadge label={run.statusLabel} tone={run.statusTone} />
                  </td>
                  <td className="py-2.5 pr-3 align-top font-mono text-xs text-zinc-800">
                    {formatProvider(run.deliveryEnabled, run.emailProvider)}
                  </td>
                  <td className="py-2.5 pr-3 align-top text-zinc-800">
                    {formatTrigger(run.triggerSource)}
                  </td>
                  <td className="py-2.5 pr-3 align-top text-zinc-800">
                    {run.deliveryEnabled ? "on" : "off"}
                  </td>
                  <td className="py-2.5 align-top font-mono text-xs text-zinc-700">
                    reclaimed {run.reclaimed} · scanned {run.scanned} · sent {run.sent} · skipped{" "}
                    {run.skipped} · dry-run {run.dryRun} · failed {run.failed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
