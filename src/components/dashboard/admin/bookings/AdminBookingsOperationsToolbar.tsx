"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  ADMIN_BOOKINGS_VIEW_CHIPS,
  buildAdminBookingsViewChipHref,
  resolveAdminBookingsViewChip,
  type AdminBookingsViewChipId,
} from "@/features/dashboards/adminBookingsViewPresets";
import { buildAdminBookingsHref } from "@/features/dashboards/adminBookingsFilterUrl";
import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";
import { isAdminBookingSearchIgnored } from "@/features/dashboards/server/adminBookingsListQuery";

type Props = {
  filter?: AdminBookingFilter;
  view?: string;
  search?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
};

function viewChipClass(active: boolean): string {
  const base =
    "inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
  return active
    ? `${base} border-blue-600 bg-blue-600 text-white shadow-sm`
    : `${base} border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
}

export function AdminBookingsOperationsToolbar({
  filter,
  view,
  search,
  scheduledFrom,
  scheduledTo,
}: Props) {
  const router = useRouter();
  const current = {
    filter,
    q: search,
    from: scheduledFrom,
    to: scheduledTo,
    view,
  };
  const activeChip = resolveAdminBookingsViewChip({ filter, view, from: scheduledFrom, to: scheduledTo });

  return (
    <section className="mb-5 space-y-3">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          router.push(
            buildAdminBookingsHref(current, {
              q: (fd.get("q") as string) || undefined,
            }),
          );
        }}
      >
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          name="q"
          type="search"
          placeholder="Search ref, customer, area, cleaner"
          defaultValue={search ?? ""}
          className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        />
        {isAdminBookingSearchIgnored(search) ? (
          <p className="mt-1.5 text-xs text-slate-500">Search uses 3 or more characters.</p>
        ) : null}
      </form>

      <nav
        aria-label="Booking queue filters"
        className="flex flex-wrap gap-2"
      >
        {ADMIN_BOOKINGS_VIEW_CHIPS.map((chip) => {
          const href = buildAdminBookingsViewChipHref(current, chip.id as AdminBookingsViewChipId);
          const active = activeChip === chip.id;
          return (
            <Link
              key={chip.id}
              href={href}
              aria-current={active ? "true" : undefined}
              className={viewChipClass(active)}
            >
              {chip.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
