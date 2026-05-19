"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ASSIGNMENT_QUEUE_PRESETS,
  matchesAssignmentQueuePreset,
  queueCountForPreset,
  type AssignmentQueuePresetId,
} from "@/features/dashboards/adminAssignmentsPageDisplay";
import type { AdminAssignmentQueueItem } from "@/features/dashboards/server/types";
import { ADMIN_QUEUE_CARD_CLASS } from "@/features/dashboards/adminDisplay";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AdminAssignmentQueueGuidance } from "@/components/dashboard/AdminAssignmentQueueGuidance";
import {
  labelForAssignmentAttention,
  labelForBookingStatus,
  labelForOfferStatus,
  toneForBookingStatus,
  toneForOfferStatus,
} from "@/features/bookings/server/statusLabels";

type Props = {
  items: AdminAssignmentQueueItem[];
  total: number;
  limit: number;
};

export function AdminAssignmentsQueueWorkbench({ items, total, limit }: Props) {
  const [preset, setPreset] = useState<AssignmentQueuePresetId>("all");

  const filtered = useMemo(
    () => items.filter((item) => matchesAssignmentQueuePreset(item, preset)),
    [items, preset],
  );

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {ASSIGNMENT_QUEUE_PRESETS.map((option) => {
          const count = queueCountForPreset(items, option.id);
          const active = preset === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setPreset(option.id)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {option.label}
              <span className="ml-1 tabular-nums opacity-80">{count}</span>
            </button>
          );
        })}
      </div>

      {total > 0 ? (
        <p className="mb-2.5 text-xs text-zinc-500">
          Showing {filtered.length} of {items.length} in view
          {total >= limit ? ` · queue scans newest ${limit} rows` : ""}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "Queue is clear" : "No bookings match this filter"}
          description={
            items.length === 0
              ? "No bookings need assignment attention right now."
              : "Try another preset or open diagnostics below."
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((item) => (
            <li key={item.bookingId} className={ADMIN_QUEUE_CARD_CLASS}>
              <section className="flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  label={labelForAssignmentAttention(
                    item.assignmentAttention,
                    item.assignmentReason,
                  )}
                  tone="warning"
                />
                <StatusBadge
                  label={labelForBookingStatus(item.status)}
                  tone={toneForBookingStatus(item.status)}
                />
              </section>
              <p className="mt-2 break-words text-sm font-semibold text-zinc-900">{item.serviceLabel}</p>
              <p className="mt-0.5 break-words text-sm text-zinc-600 [overflow-wrap:anywhere]">
                {item.customerLabel} · {item.scheduleLabel}
              </p>
              {item.assignmentReason ? (
                <p className="mt-1.5 line-clamp-3 break-words text-xs text-amber-900/90">
                  {item.assignmentReason}
                </p>
              ) : null}

              <details className="mt-2 text-sm">
                <summary className="min-h-11 cursor-pointer py-1 font-medium text-zinc-600 hover:text-zinc-900">
                  Ops guidance
                </summary>
                <AdminAssignmentQueueGuidance item={item} />
              </details>

              {item.openOffers.length > 0 ? (
                <section className="mt-2 border-t border-zinc-100 pt-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Open offers ({item.openOffers.length})
                  </h3>
                  <ul className="mt-1 space-y-1 text-sm">
                    {item.openOffers.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={labelForOfferStatus(o.status)}
                          tone={toneForOfferStatus(o.status)}
                        />
                        <span>{o.cleanerName ?? o.cleanerId.slice(0, 8)}</span>
                        {o.expiresAt ? (
                          <span className="text-xs text-zinc-500">
                            expires {new Date(o.expiresAt).toLocaleString("en-ZA")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">No open offers</p>
              )}

              <Link
                href={`/admin/bookings/${item.bookingId}`}
                className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Open booking →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
