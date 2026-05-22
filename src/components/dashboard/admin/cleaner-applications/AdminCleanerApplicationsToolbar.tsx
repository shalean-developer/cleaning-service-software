"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminCleanerApplicationsFilter } from "@/features/cleaner-applications/server/adminCleanerApplicationsReadModel";

const FILTERS: { value: AdminCleanerApplicationsFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "duplicate", label: "Duplicate" },
];

type Props = {
  currentFilter: AdminCleanerApplicationsFilter;
  currentSearch: string;
};

export function AdminCleanerApplicationsToolbar({ currentFilter, currentSearch }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function buildHref(filter: string, q?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") params.delete("status");
    else params.set("status", filter);
    if (q?.trim()) params.set("q", q.trim());
    else params.delete("q");
    const qs = params.toString();
    return `/admin/cleaner-applications${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
          router.push(buildHref(currentFilter === "all" ? "all" : currentFilter, q));
        }}
      >
        <input
          name="q"
          type="search"
          defaultValue={currentSearch}
          placeholder="Search name, phone, email…"
          className="w-full min-w-[12rem] rounded-lg border border-zinc-200 px-3 py-2 text-sm sm:w-64"
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
