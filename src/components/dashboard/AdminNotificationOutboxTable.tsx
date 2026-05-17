import Link from "next/link";
import type { AdminNotificationOutboxEntry } from "@/features/dashboards/server/types";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AdminNotificationRequeueAction } from "@/components/dashboard/AdminNotificationRequeueAction";

type Props = {
  notifications: AdminNotificationOutboxEntry[];
  emptyMessage?: string;
  showBookingLink?: boolean;
  /** Booking detail only — show requeue for eligible failed rows (5E-1a). */
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
  if (!nextRetryAt) return "—";
  return new Date(nextRetryAt).toLocaleString("en-ZA");
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
            <th className="py-2 pr-3 font-medium">Template</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium">Channel</th>
            {showBookingLink ? (
              <th className="py-2 pr-3 font-medium">Booking</th>
            ) : null}
            <th className="py-2 pr-3 font-medium">Attempts</th>
            <th className="py-2 pr-3 font-medium">Updated</th>
            <th className="py-2 pr-3 font-medium">Next retry</th>
            <th className="py-2 pr-3 font-medium">Note</th>
            <th className="py-2 font-medium">Offer</th>
            {showRequeueActions ? (
              <th className="py-2 pl-3 font-medium">Actions</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {notifications.map((n) => (
            <tr key={n.id} className="border-b border-zinc-100 last:border-0">
              <td className="py-2 pr-3 font-mono text-xs text-zinc-800">
                {n.template}
                {n.isDryRun ? (
                  <span className="ml-1 text-zinc-500">(dry run)</span>
                ) : null}
              </td>
              <td className="py-2 pr-3">
                <StatusBadge label={n.status} tone={toneForNotificationStatus(n.status)} />
              </td>
              <td className="py-2 pr-3 text-zinc-700">{n.channel}</td>
              {showBookingLink ? (
                <td className="py-2 pr-3 font-mono text-xs">
                  {n.bookingId ? (
                    <Link
                      href={`/admin/bookings/${n.bookingId}`}
                      className="text-sky-700 hover:text-sky-900"
                    >
                      {shortId(n.bookingId)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              ) : null}
              <td className="py-2 pr-3 text-zinc-700">{n.attemptCount}</td>
              <td className="py-2 pr-3 whitespace-nowrap text-zinc-600">
                {new Date(n.updatedAt).toLocaleString("en-ZA")}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap text-xs text-zinc-600">
                {formatNextRetry(n.nextRetryAt)}
              </td>
              <td className="py-2 pr-3 text-xs text-zinc-600">
                {n.statusNote ? (
                  <span title={n.statusNote}>{n.statusNote}</span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              <td className="py-2 font-mono text-xs text-zinc-500">
                {n.offerId ? (
                  <span title={n.offerId}>{shortId(n.offerId)}</span>
                ) : (
                  "—"
                )}
              </td>
              {showRequeueActions ? (
                <td className="py-2 pl-3 align-top">
                  {n.canRequeue ? (
                    <AdminNotificationRequeueAction notification={n} />
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
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