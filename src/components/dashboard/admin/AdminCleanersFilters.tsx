"use client";

import Link from "next/link";
import type { AdminCleanerOperationalFilter } from "@/features/cleaners/server/admin/types";

const FILTER_OPTIONS: { value: AdminCleanerOperationalFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Onboarding" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

type Props = {
  filter: AdminCleanerOperationalFilter;
  totalCount: number;
};

export function AdminCleanersFilters({ filter, totalCount }: Props) {
  return (
    <section className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav className="flex flex-wrap gap-2" aria-label="Cleaner operational filters">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option.value;
          const href =
            option.value === "all" ? "/admin/cleaners" : `/admin/cleaners?filter=${option.value}`;
          return (
            <Link
              key={option.value}
              href={href}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {option.label}
            </Link>
          );
        })}
      </nav>
      <p className="text-xs text-zinc-500">
        Showing {totalCount} cleaner{totalCount === 1 ? "" : "s"}
      </p>
    </section>
  );
}
