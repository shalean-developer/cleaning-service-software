import Link from "next/link";
import { buildAdminCustomerDetailHref } from "@/features/customers/server/admin/buildAdminCustomerDetailHref";
import { ADMIN_CUSTOMER_BOOKING_FILTER_OPTIONS } from "@/features/customers/server/admin/adminCustomerBookingOperations";
import type { AdminCustomerDetailBookingFilter } from "@/features/customers/server/admin/parseAdminCustomerDetailQuery";

type Props = {
  customerId: string;
  activeFilter: AdminCustomerDetailBookingFilter;
};

const FILTER_LINK_CLASS =
  "inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors";
const FILTER_ACTIVE_CLASS = "border-zinc-900 bg-zinc-900 text-white";
const FILTER_INACTIVE_CLASS =
  "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50";

export function AdminCustomerBookingFilters({ customerId, activeFilter }: Props) {
  return (
    <nav aria-label="Booking history filters" className="flex flex-wrap gap-2">
      {ADMIN_CUSTOMER_BOOKING_FILTER_OPTIONS.map((option) => {
        const isActive = option.value === activeFilter;
        return (
          <Link
            key={option.value}
            href={buildAdminCustomerDetailHref(customerId, {
              bookingFilter: option.value,
            })}
            className={`${FILTER_LINK_CLASS} ${
              isActive ? FILTER_ACTIVE_CLASS : FILTER_INACTIVE_CLASS
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
