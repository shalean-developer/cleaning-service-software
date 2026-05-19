import { CustomerBookACleanCta } from "@/components/dashboard/customer/CustomerBookACleanCta";
import { CustomerBookingsDashboard } from "@/components/dashboard/customer/CustomerBookingsDashboard";
import { CustomerBookingsEmptyState } from "@/components/dashboard/customer/CustomerBookingsEmptyState";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";

const NO_BOOKINGS_TITLE = "No bookings yet";
const NO_BOOKINGS_DESCRIPTION =
  "Book a clean and it will show here once checkout is complete.";

type Props = {
  bookings: CustomerBookingListItem[];
};

/** Shared filtered booking list + empty states for /customer and /customer/bookings. */
export function CustomerBookingsListContent({ bookings }: Props) {
  if (bookings.length === 0) {
    return (
      <CustomerBookingsEmptyState
        title={NO_BOOKINGS_TITLE}
        description={NO_BOOKINGS_DESCRIPTION}
        action={<CustomerBookACleanCta />}
      />
    );
  }

  return <CustomerBookingsDashboard bookings={bookings} />;
}
