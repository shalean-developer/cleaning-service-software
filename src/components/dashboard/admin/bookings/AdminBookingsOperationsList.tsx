import type { AdminBookingListItem } from "@/features/dashboards/server/types";
import { buildAdminBookingOpsCardModel } from "@/features/dashboards/adminBookingsOperationsDisplay";
import { AdminBookingOperationsCard } from "@/components/dashboard/admin/bookings/AdminBookingOperationsCard";

type Props = {
  bookings: AdminBookingListItem[];
};

export function AdminBookingsOperationsList({ bookings }: Props) {
  return (
    <ul className="space-y-3">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <AdminBookingOperationsCard model={buildAdminBookingOpsCardModel(booking)} />
        </li>
      ))}
    </ul>
  );
}
