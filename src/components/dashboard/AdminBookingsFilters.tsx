"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";

const FILTER_OPTIONS: { value: AdminBookingFilter | ""; label: string }[] = [
  { value: "", label: "All bookings" },
  { value: "payment_failed", label: "Payment failed" },
  { value: "pending_assignment", label: "Pending assignment" },
  { value: "assignment_attention", label: "Assignment attention" },
  { value: "dispatch_not_started", label: "Dispatch not started" },
  { value: "selected_declined", label: "Selected cleaner declined" },
  { value: "max_attempts", label: "No cleaner accepted" },
  { value: "recovery_needed", label: "Recovery needed" },
];

type Props = {
  filter?: string;
  search?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  total: number;
  visible: number;
  limit: number;
};

export function AdminBookingsFilters({
  filter,
  search,
  scheduledFrom,
  scheduledTo,
  total,
  visible,
  limit,
}: Props) {
  const router = useRouter();

  function buildHref(overrides: Record<string, string | undefined>) {
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
    const qs = params.toString();
    return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
  }

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
        {(filter || search || scheduledFrom || scheduledTo) && (
          <Link href="/admin/bookings" className="py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Clear
          </Link>
        )}
      </form>
      <p className="text-xs text-zinc-500">
        Showing {visible} of {total} loaded bookings
        {total >= limit ? ` (newest ${limit} by last update)` : ""}.
      </p>
    </section>
  );
}
