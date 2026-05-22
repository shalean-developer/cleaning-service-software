import type { BookingStatus } from "@/features/bookings/server/types";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";

export const CUSTOMER_BOOKING_FILTER_TABS = [
  "upcoming",
  "completed",
  "cancelled",
  "unpaid",
] as const;

export type CustomerBookingFilterTab = (typeof CUSTOMER_BOOKING_FILTER_TABS)[number];

export type CustomerBookingFilterTabLabel = {
  id: CustomerBookingFilterTab;
  label: string;
};

export const CUSTOMER_BOOKING_FILTER_TAB_LABELS: CustomerBookingFilterTabLabel[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "unpaid", label: "Unpaid" },
];

const COMPLETED_STATUSES: BookingStatus[] = ["completed", "payout_ready", "paid_out"];

const UNPAID_STATUSES: BookingStatus[] = ["pending_payment", "payment_failed", "draft"];

/** Presentation-only tab filter using existing list item fields (no new business rules). */
export function customerBookingMatchesFilterTab(
  booking: Pick<CustomerBookingListItem, "status" | "isUpcoming">,
  tab: CustomerBookingFilterTab,
): boolean {
  switch (tab) {
    case "upcoming":
      return booking.isUpcoming;
    case "completed":
      return COMPLETED_STATUSES.includes(booking.status);
    case "cancelled":
      return booking.status === "cancelled";
    case "unpaid":
      return UNPAID_STATUSES.includes(booking.status);
    default:
      return false;
  }
}

export function filterCustomerBookingsForTab(
  bookings: CustomerBookingListItem[],
  tab: CustomerBookingFilterTab,
): CustomerBookingListItem[] {
  return bookings.filter((b) => customerBookingMatchesFilterTab(b, tab));
}

export type CustomerBookingsTabEmptyState = {
  title: string;
  description: string;
};

export function emptyStateForCustomerBookingTab(
  tab: CustomerBookingFilterTab,
): CustomerBookingsTabEmptyState {
  switch (tab) {
    case "upcoming":
      return {
        title: "No upcoming bookings",
        description: "Scheduled cleans appear here after checkout.",
      };
    case "completed":
      return {
        title: "No completed bookings",
        description: "Finished cleans appear here after your service is done.",
      };
    case "cancelled":
      return {
        title: "No cancelled bookings",
        description: "Cancelled bookings are kept here for your records.",
      };
    case "unpaid":
      return {
        title: "No unpaid bookings",
        description: "You're all caught up. nothing to pay right now.",
      };
    default:
      return {
        title: "No bookings",
        description: "Nothing to show in this view.",
      };
  }
}
