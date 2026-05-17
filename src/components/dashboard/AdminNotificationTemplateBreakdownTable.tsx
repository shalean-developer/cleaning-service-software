import type { AdminNotificationAnalytics } from "@/features/notifications/server/notificationAdminTypes";

type Props = {
  analytics: Pick<
    AdminNotificationAnalytics,
    "deliverableTemplates" | "unsupportedTemplates"
  >;
};

export function AdminNotificationTemplateBreakdownTable({ analytics }: Props) {
  const { deliverableTemplates, unsupportedTemplates } = analytics;
  const hasUnsupported = unsupportedTemplates.some((row) => row.pending > 0);

  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">Template breakdown</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Counts by template and status. Template keys only — no payload bodies.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500">
              <th className="py-2 pr-4 font-medium">Template</th>
              <th className="py-2 pr-4 font-medium">Channel</th>
              <th className="py-2 pr-4 font-medium">Sent</th>
              <th className="py-2 pr-4 font-medium">Failed</th>
              <th className="py-2 pr-4 font-medium">Pending</th>
              <th className="py-2 font-medium">Processing</th>
            </tr>
          </thead>
          <tbody>
            {deliverableTemplates.map((row) => (
              <tr key={`${row.template}-${row.channel}`} className="border-b border-zinc-100">
                <td className="py-2 pr-4 font-mono text-xs">{row.template}</td>
                <td className="py-2 pr-4 text-zinc-700">{row.channel}</td>
                <td className="py-2 pr-4">{row.counts.sent}</td>
                <td className="py-2 pr-4">{row.counts.failed}</td>
                <td className="py-2 pr-4">{row.counts.pending}</td>
                <td className="py-2">{row.counts.processing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasUnsupported ? (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Unsupported pending (enqueue-only)
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {unsupportedTemplates
              .filter((row) => row.pending > 0)
              .map((row) => (
                <li key={row.template}>
                  <span className="font-mono text-xs">{row.template}</span>
                  <span className="text-zinc-500"> — {row.pending} pending</span>
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-xs text-zinc-500">No unsupported template backlog.</p>
      )}
    </section>
  );
}
