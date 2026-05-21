"use client";

import { useRouter } from "next/navigation";
import {
  buildAdminRecurringHref,
  type AdminRecurringListQuery,
} from "@/features/recurring/adminRecurringQuery";

type Props = {
  query: AdminRecurringListQuery;
};

const FILTER_CHIPS: { label: string; patch: Partial<AdminRecurringListQuery> }[] = [
  { label: "All", patch: {} },
  { label: "Active", patch: { status: "active" } },
  { label: "Paused", patch: { status: "paused" } },
  { label: "Cancelled", patch: { status: "cancelled" } },
  { label: "Weekly", patch: { frequency: "weekly" } },
  { label: "Bi-weekly", patch: { frequency: "biweekly" } },
  { label: "Monthly", patch: { frequency: "monthly" } },
  { label: "Payment required", patch: { paymentRequired: true } },
];

function chipActive(query: AdminRecurringListQuery, patch: Partial<AdminRecurringListQuery>): boolean {
  if (patch.status) return query.status === patch.status;
  if (patch.frequency) return query.frequency === patch.frequency;
  if (patch.paymentRequired) return query.paymentRequired === true;
  return !query.status && !query.frequency && !query.paymentRequired;
}

export function AdminRecurringToolbar({ query }: Props) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const q = String(fd.get("q") ?? "").trim();
          router.push(buildAdminRecurringHref({ ...query, search: q || undefined }));
        }}
      >
        <input
          name="q"
          type="search"
          defaultValue={query.search ?? ""}
          placeholder="Search customer, suburb, service…"
          className="min-h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
        />
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Search
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() =>
              router.push(
                buildAdminRecurringHref({
                  search: query.search,
                  ...chip.patch,
                }),
              )
            }
            className={
              chipActive(query, chip.patch)
                ? "rounded-full bg-blue-700 px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            }
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
