"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  ADMIN_CUSTOMERS_REGISTRY_VIEW_CHIPS,
  buildAdminCustomersRegistryHref,
} from "@/features/customers/server/admin/adminCustomersRegistryUrl";
import type { AdminCustomerRegistryViewFilter } from "@/features/customers/server/admin/adminCustomersRegistryDisplay";

type Props = {
  view: AdminCustomerRegistryViewFilter;
  search?: string;
};

function viewChipClass(active: boolean): string {
  const base =
    "inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
  return active
    ? `${base} border-blue-600 bg-blue-600 text-white shadow-sm`
    : `${base} border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
}

export function AdminCustomersRegistryToolbar({ view, search }: Props) {
  const router = useRouter();
  const current = { view: view === "all" ? undefined : view, q: search };

  return (
    <section className="mb-5 space-y-3">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          router.push(
            buildAdminCustomersRegistryHref(current, {
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
          placeholder="Search name, area, cleaner"
          defaultValue={search ?? ""}
          className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        />
      </form>

      <nav className="flex flex-wrap gap-2" aria-label="Customer registry filters">
        {ADMIN_CUSTOMERS_REGISTRY_VIEW_CHIPS.map((chip) => {
          const active = view === chip.id;
          return (
            <Link
              key={chip.id}
              href={buildAdminCustomersRegistryHref(current, {
                view: chip.id === "all" ? undefined : chip.id,
              })}
              className={viewChipClass(active)}
              aria-current={active ? "page" : undefined}
            >
              {chip.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
