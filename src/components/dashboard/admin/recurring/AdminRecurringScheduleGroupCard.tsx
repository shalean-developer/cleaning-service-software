"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminRecurringScheduleGroupListItem } from "@/features/recurring/server/recurringManagementTypes";
import { AdminRecurringSeriesCard } from "./AdminRecurringSeriesCard";

type Props = { item: AdminRecurringScheduleGroupListItem };

export function AdminRecurringScheduleGroupCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            {item.frequencyLabel} recurring schedule
          </h2>
          <p className="text-sm text-zinc-600">
            {item.selectedDaysLabel} · {item.serviceLabel}
          </p>
          <p className="text-sm text-zinc-500">
            {item.customerName} · {item.activeSeriesCount} active series
            {item.totalUnpaidChildren > 0
              ? ` · ${item.totalUnpaidChildren} payment required`
              : ""}
            {item.openCustomerRequestsCount > 0
              ? ` · ${item.openCustomerRequestsCount} open request${item.openCustomerRequestsCount === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/recurring/groups/${item.groupId}`}
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Manage group
          </Link>
          <button
            type="button"
            className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide series" : "Show series"}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="space-y-2 border-t border-zinc-100 p-4 pt-3">
          {item.series.map((series) => (
            <AdminRecurringSeriesCard key={series.seriesId} item={series} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
