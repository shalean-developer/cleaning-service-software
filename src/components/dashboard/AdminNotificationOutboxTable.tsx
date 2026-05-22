import Link from "next/link";
import type { AdminNotificationOutboxEntry } from "@/features/dashboards/server/types";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AdminNotificationRequeueAction } from "@/components/dashboard/AdminNotificationRequeueAction";

type Props = {
  notifications: AdminNotificationOutboxEntry[];
  emptyMessage?: string;
  showBookingLink?: boolean;
  /** Show requeue for eligible failed rows (booking detail + global /admin/notifications). */
  showRequeueActions?: boolean;
};

function toneForNotificationStatus(
  status: AdminNotificationOutboxEntry["status"],
): "neutral" | "success" | "warning" | "danger" {
  switch (status) {
    case "sent":
      return "success";
    case "failed":
      return "danger";
    case "processing":
      return "warning";
    default:
      return "neutral";
  }
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function formatNextRetry(nextRetryAt: string | null): string {
  if (!nextRetryAt) return "-";
  return new Date(nextRetryAt).toLocaleString("en-ZA");
}

function rowClassName(isDryRun: boolean): string {
  const base = "border-b border-zinc-100 last:border-0 align-middle";
  if (!isDryRun) return base;
  return `${base} bg-zinc-50/90 text-zinc-600`;
}

export function AdminNotificationOutboxTable({
  notifications,
  emptyMessage = "No notification records match these filters.",
  showBookingLink = false,
  showRequeueActions = false,
}: Props) {
  if (notifications.length === 0) {
    return <p className="mt-2 text-sm text-zinc-600">{emptyMessage}</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs text-zinc-500">
            <th className="py-2.5 pr-3 font-medium">Template</th>
            <th className="py-2.5 pr-3 font-medium">Status</th>
            <th className="py-2.5 pr-3 font-medium">Channel</th>
            {showBookingLink ? (
              <th className="py-2.5 pr-3 font-medium">Booking</th>
            ) : null}
            <th className="py-2.5 pr-3 font-medium">Attempts</th>
            <th className="py-2.5 pr-3 font-medium">Updated</th>
            <th className="py-2.5 pr-3 font-medium">Next retry</th>
            <th className="py-2.5 pr-3 font-medium">Note</th>
            <th className="py-2.5 font-medium">Offer</th>
            {showRequeueActions ? (
              <th className="w-28 py-2.5 pl-2 pr-0 text-right text-[11px] font-normal text-zinc-400">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {notifications.map((n) => (
            <tr key={n.id} className={rowClassName(n.isDryRun)}>
              <td className="py-2.5 pr-3">
                <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-xs">
                  <span className={n.isDryRun ? "text-zinc-600" : "text-zinc-800"}>
                    {n.template}
                  </span>
                  {n.isDryRun ? (
                    <span className="inline-flex rounded border border-zinc-300 bg-zinc-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                      Dry run
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="py-2.5 pr-3">
                <StatusBadge label={n.status} tone={toneForNotificationStatus(n.status)} />
              </td>
              <td className="py-2.5 pr-3">{n.channel}</td>
              {showBookingLink ? (
                <td className="py-2.5 pr-3 font-mono text-xs">
                  {n.bookingId ? (
                    <Link
                      href={`/admin/bookings/${n.bookingId}`}
                      className={
                        n.isDryRun
                          ? "text-zinc-500 hover:text-zinc-700"
                          : "text-sky-700 hover:text-sky-900"
                      }
                    >
                      {shortId(n.bookingId)}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
              ) : null}
              <td className="py-2.5 pr-3">{n.attemptCount}</td>
              <td className="py-2.5 pr-3 whitespace-nowrap">
                {new Date(n.updatedAt).toLocaleString("en-ZA")}
              </td>
              <td className="py-2.5 pr-3 whitespace-nowrap text-xs">
                {formatNextRetry(n.nextRetryAt)}
              </td>
              <td className="max-w-[14rem] py-2.5 pr-3 text-xs">
                {n.statusNote ? (
                  <span title={n.statusNote}>{n.statusNote}</span>
                ) : (
                  <span className="text-zinc-400">-</span>
                )}
              </td>
              <td className="py-2.5 font-mono text-xs text-zinc-500">
                {n.offerId ? (
                  <span title={n.offerId}>{shortId(n.offerId)}</span>
                ) : (
                  "-"
                )}
              </td>
              {showRequeueActions ? (
                <td className="w-28 py-2.5 pl-2 pr-0 text-right align-middle">
                  {n.canRequeue ? (
                    <AdminNotificationRequeueAction notification={n} />
                  ) : (
                    <span className="text-xs text-zinc-300">-</span>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
