"use client";

import type { ParsedAdminCustomersQuery } from "@/features/customers/server/admin/parseAdminCustomersQuery";
import {
  ADMIN_CUSTOMERS_ACTIVITY_FILTERS,
  ADMIN_CUSTOMERS_BOOKINGS_FILTERS,
  ADMIN_CUSTOMERS_HEALTH_FILTERS,
} from "@/features/customers/server/admin/parseAdminCustomersQuery";

type Props = {
  query: ParsedAdminCustomersQuery;
};

const BOOKINGS_LABELS: Record<ParsedAdminCustomersQuery["bookings"], string> = {
  all: "All customers",
  has_bookings: "Has bookings",
  no_bookings: "No bookings yet",
};

const HEALTH_LABELS: Record<ParsedAdminCustomersQuery["health"], string> = {
  all: "All health",
  healthy: "Healthy",
  needs_attention: "Needs attention",
};

const ACTIVITY_LABELS: Record<ParsedAdminCustomersQuery["activity"], string> = {
  all: "Any activity",
  created_last_7_days: "Created last 7 days",
  created_last_30_days: "Created last 30 days",
  active_last_30_days: "Active last 30 days",
};

const SELECT_CLASS =
  "min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900";

export function AdminCustomersSearchForm({ query }: Props) {
  return (
    <form method="get" className="mt-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Company, email, or phone"
            className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        >
          Apply filters
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">Bookings</span>
          <select name="bookings" defaultValue={query.bookings} className={SELECT_CLASS}>
            {ADMIN_CUSTOMERS_BOOKINGS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {BOOKINGS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">Domain health</span>
          <select name="health" defaultValue={query.health} className={SELECT_CLASS}>
            {ADMIN_CUSTOMERS_HEALTH_FILTERS.map((value) => (
              <option key={value} value={value}>
                {HEALTH_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">Recent activity</span>
          <select name="activity" defaultValue={query.activity} className={SELECT_CLASS}>
            {ADMIN_CUSTOMERS_ACTIVITY_FILTERS.map((value) => (
              <option key={value} value={value}>
                {ACTIVITY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {query.limit !== 50 ? <input type="hidden" name="limit" value={String(query.limit)} /> : null}

      <p className="text-xs text-zinc-500">
        Changing filters starts at page 1. Search scans company, phone, and auth email (email-like
        queries only).
      </p>
    </form>
  );
}
