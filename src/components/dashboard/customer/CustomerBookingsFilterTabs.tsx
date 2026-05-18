"use client";

import {
  CUSTOMER_BOOKING_FILTER_TAB_LABELS,
  type CustomerBookingFilterTab,
} from "@/features/dashboards/customerBookingsDashboardDisplay";

type Props = {
  activeTab: CustomerBookingFilterTab;
  onTabChange: (tab: CustomerBookingFilterTab) => void;
  counts: Record<CustomerBookingFilterTab, number>;
};

export function CustomerBookingsFilterTabs({ activeTab, onTabChange, counts }: Props) {
  return (
    <nav
      className="-mx-4 flex gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
      aria-label="Filter bookings"
    >
      {CUSTOMER_BOOKING_FILTER_TAB_LABELS.map(({ id, label }) => {
        const isActive = activeTab === id;
        const count = counts[id];

        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-pressed={isActive}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 ${
              isActive
                ? "bg-zinc-900 text-white shadow-sm"
                : "border border-zinc-200/80 bg-white text-zinc-600 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {label}
            {count > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                  isActive ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
