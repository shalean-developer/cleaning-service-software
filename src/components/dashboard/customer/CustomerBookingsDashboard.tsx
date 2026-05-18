"use client";

import { useMemo, useState } from "react";
import { CustomerBookingListCard } from "@/components/dashboard/customer/CustomerBookingListCard";
import { CustomerBookingsEmptyState } from "@/components/dashboard/customer/CustomerBookingsEmptyState";
import { CustomerBookingsFilterTabs } from "@/components/dashboard/customer/CustomerBookingsFilterTabs";
import {
  CUSTOMER_BOOKING_FILTER_TABS,
  customerBookingMatchesFilterTab,
  emptyStateForCustomerBookingTab,
  type CustomerBookingFilterTab,
} from "@/features/dashboards/customerBookingsDashboardDisplay";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";

type Props = {
  bookings: CustomerBookingListItem[];
};

export function CustomerBookingsDashboard({ bookings }: Props) {
  const [activeTab, setActiveTab] = useState<CustomerBookingFilterTab>("upcoming");

  const tabCounts = useMemo(() => {
    const counts = Object.fromEntries(
      CUSTOMER_BOOKING_FILTER_TABS.map((tab) => [tab, 0]),
    ) as Record<CustomerBookingFilterTab, number>;

    for (const booking of bookings) {
      for (const tab of CUSTOMER_BOOKING_FILTER_TABS) {
        if (customerBookingMatchesFilterTab(booking, tab)) {
          counts[tab] += 1;
        }
      }
    }

    return counts;
  }, [bookings]);

  const filteredBookings = useMemo(
    () => bookings.filter((b) => customerBookingMatchesFilterTab(b, activeTab)),
    [bookings, activeTab],
  );

  const tabEmpty = emptyStateForCustomerBookingTab(activeTab);

  return (
    <section className="space-y-6 sm:space-y-8">
      <CustomerBookingsFilterTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
      />
      {filteredBookings.length === 0 ? (
        <CustomerBookingsEmptyState title={tabEmpty.title} description={tabEmpty.description} />
      ) : (
        <ul className="space-y-3 sm:space-y-4">
          {filteredBookings.map((booking) => (
            <li key={booking.id}>
              <CustomerBookingListCard booking={booking} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
