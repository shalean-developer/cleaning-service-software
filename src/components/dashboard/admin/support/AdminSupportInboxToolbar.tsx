"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminSupportInboxFilter } from "@/features/support/server/adminSupportInboxReadModel";

const FILTERS: { value: AdminSupportInboxFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "urgent", label: "Urgent" },
  { value: "booking", label: "One-off bookings" },
  { value: "recurring", label: "Recurring" },
  { value: "resolved", label: "Resolved" },
];

type Props = {
  currentFilter: AdminSupportInboxFilter;
  currentSearch: string;
};

export function AdminSupportInboxToolbar({ currentFilter, currentSearch }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function buildHref(filter: AdminSupportInboxFilter, q?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") params.delete("filter");
    else params.set("filter", filter);
    if (q?.trim()) params.set("q", q.trim());
    else params.delete("q");
    const qs = params.toString();
    return `/admin/support${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={buildHref(f.value, currentSearch)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              currentFilter === f.value
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const q = String(fd.get("q") ?? "");
          router.push(buildHref(currentFilter, q));
        }}
      >
        <input
          name="q"
          type="search"
          defaultValue={currentSearch}
          placeholder="Search customer, phone, reference, suburb, type…"
          className="w-full min-w-[12rem] rounded-lg border border-zinc-200 px-3 py-2 text-sm sm:flex-1"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700"
        >
          Search
        </button>
      </form>
    </div>
  );
}
