import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  formatAdminCustomerLastActivity,
  formatAdminCustomerLatestBooking,
} from "@/features/customers/server/admin/adminCustomersListDisplay";
import {
  labelForCustomerDomainHealth,
  toneForCustomerDomainHealth,
} from "@/features/customers/server/admin/adminCustomerOperationalDisplay";
import type { AdminCustomerListItem } from "@/features/customers/server/admin/types";
import { ADMIN_LIST_CARD_CLASS } from "@/features/dashboards/adminDisplay";

type Props = {
  items: AdminCustomerListItem[];
};

const CUSTOMER_LIST_ROW_GRID_CLASS =
  "grid w-full grid-cols-1 gap-3 sm:grid-cols-[minmax(0,20fr)_minmax(0,14fr)_minmax(0,12fr)_minmax(0,10fr)_minmax(0,16fr)_minmax(0,14fr)_minmax(0,14fr)] sm:items-center sm:gap-0 sm:text-sm";

const CUSTOMER_LIST_HEADER_GRID_CLASS =
  "hidden border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500 sm:grid sm:grid-cols-[minmax(0,20fr)_minmax(0,14fr)_minmax(0,12fr)_minmax(0,10fr)_minmax(0,16fr)_minmax(0,14fr)_minmax(0,14fr)]";

const QUICK_ACTION_CLASS =
  "inline-flex min-h-8 items-center rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900";

function truncate(value: string, max = 48): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function AdminCustomerListTable({ items }: Props) {
  return (
    <div className="mt-4 overflow-hidden">
      <div className={CUSTOMER_LIST_HEADER_GRID_CLASS}>
        <div className="px-3 py-2">Customer</div>
        <div className="px-3 py-2">Phone</div>
        <div className="px-3 py-2 text-right">Bookings</div>
        <div className="px-3 py-2">Last activity</div>
        <div className="px-3 py-2">Latest booking</div>
        <div className="px-3 py-2">Health</div>
        <div className="px-3 py-2">Actions</div>
      </div>

      <ul className="mt-2 space-y-2">
        {items.map((item) => {
          const detailHref = `/admin/customers/${item.customerId}`;
          const editHref = `/admin/customers/${item.customerId}/edit`;
          const latestBookingLabel = formatAdminCustomerLatestBooking(item.latestBooking);

          return (
            <li key={item.customerId}>
              <article
                className={`${ADMIN_LIST_CARD_CLASS} ${CUSTOMER_LIST_ROW_GRID_CLASS} py-3`}
              >
                <div className="min-w-0 sm:px-3">
                  <p className="text-xs font-medium uppercase text-zinc-500 sm:hidden">Customer</p>
                  <Link
                    href={detailHref}
                    className="block truncate font-medium text-zinc-900 underline-offset-2 hover:underline"
                    title={item.companyName}
                  >
                    {truncate(item.companyName)}
                  </Link>
                  <p
                    className="mt-0.5 truncate text-sm text-zinc-600"
                    title={item.authEmail ?? undefined}
                  >
                    {item.authEmail ?? "No auth email"}
                  </p>
                </div>

                <div className="min-w-0 sm:px-3">
                  <p className="text-xs font-medium uppercase text-zinc-500 sm:hidden">Phone</p>
                  <span className="block truncate text-zinc-700">{item.phone ?? "—"}</span>
                </div>

                <div className="sm:px-3 sm:text-right">
                  <p className="text-xs font-medium uppercase text-zinc-500 sm:hidden">Bookings</p>
                  <span className="font-medium text-zinc-900">{item.bookingCount}</span>
                  {item.recurringCount > 0 ? (
                    <span className="block text-xs text-zinc-500">
                      {item.recurringCount} series
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 sm:px-3">
                  <p className="text-xs font-medium uppercase text-zinc-500 sm:hidden">
                    Last activity
                  </p>
                  <span className="text-zinc-700">
                    {formatAdminCustomerLastActivity(item.lastActivityAt)}
                  </span>
                </div>

                <div className="min-w-0 sm:px-3">
                  <p className="text-xs font-medium uppercase text-zinc-500 sm:hidden">
                    Latest booking
                  </p>
                  <span
                    className={`block truncate ${item.latestBooking ? "text-zinc-700" : "text-zinc-500 italic"}`}
                    title={latestBookingLabel}
                  >
                    {latestBookingLabel}
                  </span>
                </div>

                <div className="sm:px-3">
                  <p className="text-xs font-medium uppercase text-zinc-500 sm:hidden">Health</p>
                  <StatusBadge
                    label={labelForCustomerDomainHealth(item.domainHealth)}
                    tone={toneForCustomerDomainHealth(item.domainHealth)}
                    variant="soft"
                  />
                </div>

                <div className="flex flex-wrap gap-2 sm:px-3">
                  <p className="w-full text-xs font-medium uppercase text-zinc-500 sm:hidden">
                    Actions
                  </p>
                  <Link href={detailHref} className={QUICK_ACTION_CLASS}>
                    View
                  </Link>
                  <Link href={editHref} className={QUICK_ACTION_CLASS}>
                    Edit contact
                  </Link>
                  <span
                    className={`${QUICK_ACTION_CLASS} cursor-not-allowed border-dashed text-zinc-400`}
                    title="Admin-assisted booking coming soon"
                  >
                    Create booking
                  </span>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
