import type { AdminNotificationOutboxEntry } from "@/features/dashboards/server/types";
import { AdminNotificationOutboxTable } from "@/components/dashboard/AdminNotificationOutboxTable";

type Props = {
  notifications: AdminNotificationOutboxEntry[];
};

export function AdminBookingNotificationsSection({ notifications }: Props) {
  return (
    <AdminNotificationOutboxTable
      notifications={notifications}
      emptyMessage="No notification records for this booking yet."
      showRequeueActions
    />
  );
}
