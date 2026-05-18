"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";
import { isAdminBookingSearchIgnored } from "@/features/dashboards/server/adminBookingsListQuery";
import { buildAdminBookingsExportHref } from "@/features/dashboards/server/parseAdminBookingsQueryParams";

const FILTER_OPTIONS: { value: AdminBookingFilter | ""; label: string }[] = [
  { value: "", label: "All bookings" },
  { value: "payment_failed", label: "Payment failed" },
  { value: "pending_assignment", label: "Pending assignment" },
  { value: "assignment_attention", label: "Assignment attention" },
  { value: "dispatch_not_started", label: "Dispatch not started" },
  { value: "selected_declined", label: "Selected cleaner declined" },
  { value: "max_attempts", label: "No cleaner accepted" },
  { value: "recovery_needed", label: "Recovery needed" },
  { value: "two_cleaner_request", label: "2-cleaner request" },
  { value: "operational_load", label: "Operational load" },
  { value: "team_awaiting_coordination", label: "Awaiting team coordination" },
  { value: "team_fully_coordinated", label: "Fully coordinated (team)" },
  { value: "high_operational_load", label: "High operational load" },
  { value: "team_high_risk_combo", label: "Team + equipment + heavy" },
];

type Props = {
  filter?: string;
  search?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  matchTotal: number | null;
  returnedCount: number;
  limit: number;
  capped: boolean;
  subsetFiltered?: boolean;
};

export function adminBookingsFooterCopy(input: {
  matchTotal: number | null;
  returnedCount: number;
  limit: number;
  capped: boolean;
  subsetFiltered?: boolean;
  hasActiveFilters: boolean;
}): string {
  const { matchTotal, returnedCount, limit, capped, subsetFiltered, hasActiveFilters } = input;

  if (!hasActiveFilters) {
    return `Showing up to ${returnedCount} bookings (newest by last update, limit ${limit}).`;
  }

  if (subsetFiltered) {
    return `Showing ${returnedCount} matching bookings in the newest ${limit} loaded by last update.`;
  }

  if (matchTotal !== null) {
    if (capped) {
      return `Showing ${returnedCount} of ${matchTotal} matching bookings (newest ${limit} by last update).`;
    }
    return `Showing ${returnedCount} of ${matchTotal} matching bookings.`;
  }

  return `Showing ${returnedCount} matching bookings.`;
}

export function AdminBookingsFilters({
  filter,
  search,
  scheduledFrom,
  scheduledTo,
  matchTotal,
  returnedCount,
  limit,
  capped,
  subsetFiltered,
}: Props) {
  const router = useRouter();

  function buildQueryParams(overrides: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams();
    const next = {
      filter: filter || undefined,
      q: search || undefined,
      from: scheduledFrom || undefined,
      to: scheduledTo || undefined,
      ...overrides,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    return params;
  }

  function buildHref(overrides: Record<string, string | undefined> = {}) {
    const qs = buildQueryParams(overrides).toString();
    return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
  }

  const exportHref = buildAdminBookingsExportHref({
    filter: filter || undefined,
    search: search || undefined,
    scheduledFrom: scheduledFrom || undefined,
    scheduledTo: scheduledTo || undefined,
  });

  return (
    <section className="mb-6 space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          router.push(
            buildHref({
              filter: (fd.get("filter") as string) || undefined,
              q: (fd.get("q") as string) || undefined,
              from: (fd.get("from") as string) || undefined,
              to: (fd.get("to") as string) || undefined,
            }),
          );
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Filter
          <select
            name="filter"
            defaultValue={filter ?? ""}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600">
          Search
          <input
            name="q"
            type="search"
            placeholder="Booking ID, customer, payment ref"
            defaultValue={search ?? ""}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          {isAdminBookingSearchIgnored(search) ? (
            <span className="font-normal text-zinc-500">
              Search uses 3 or more characters.
            </span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Schedule from
          <input
            name="from"
            type="date"
            defaultValue={scheduledFrom?.slice(0, 10) ?? ""}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Schedule to
          <input
            name="to"
            type="date"
            defaultValue={scheduledTo?.slice(0, 10) ?? ""}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Apply
        </button>
        <a
          href={exportHref}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Export CSV
        </a>
        {(filter || search || scheduledFrom || scheduledTo) && (
          <Link href="/admin/bookings" className="py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Clear
          </Link>
        )}
      </form>
      <p className="text-xs text-zinc-500">
        {adminBookingsFooterCopy({
          matchTotal,
          returnedCount,
          limit,
          capped,
          subsetFiltered,
          hasActiveFilters: Boolean(filter || search || scheduledFrom || scheduledTo),
        })}{" "}
        Export includes up to 500 matching rows (newest by last update).
      </p>
    </section>
  );
}
