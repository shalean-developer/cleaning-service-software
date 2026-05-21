"use client";

import type { AdminRecurringGroupSupportRequestItem } from "@/features/recurring/server/recurringManagementTypes";
import { AdminRecurringSupportRequestPanel } from "./AdminRecurringSupportRequestPanel";

type Props = {
  open: AdminRecurringGroupSupportRequestItem[];
  acknowledged: AdminRecurringGroupSupportRequestItem[];
  resolved: AdminRecurringGroupSupportRequestItem[];
};

function RequestSection({
  title,
  items,
}: {
  title: string;
  items: AdminRecurringGroupSupportRequestItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {items.map((req) => (
        <div key={req.id} className="space-y-1">
          <p className="text-xs text-slate-500">
            {req.scopeLabel}
            {req.targetWeekdayLabel ? ` · ${req.targetWeekdayLabel}` : ""}
            {req.weekdayLabel !== "All weekdays" ? ` · ${req.weekdayLabel}` : ""}
            {req.seriesId ? (
              <>
                {" "}
                ·{" "}
                <a
                  href={`/admin/recurring/${req.seriesId}`}
                  className="font-medium text-blue-700 hover:text-blue-900"
                >
                  Open series
                </a>
              </>
            ) : null}
          </p>
          {req.requestedDateTimeIso ? (
            <p className="text-xs text-slate-600">
              Requested: {new Date(req.requestedDateTimeIso).toLocaleString("en-ZA")}
            </p>
          ) : null}
          {req.status === "open" || req.status === "acknowledged" ? (
            <AdminRecurringSupportRequestPanel
              seriesId={req.seriesId ?? ""}
              request={{
                id: req.id,
                requestType: req.requestType,
                requestTypeLabel: req.requestTypeLabel,
                scope: req.scope,
                scopeLabel: req.scopeLabel,
                status: req.status,
                statusLabel: req.statusLabel,
                createdAt: req.createdAt,
                note: req.note,
                targetWeekday: req.targetWeekday,
                targetWeekdayLabel: req.targetWeekdayLabel,
                requestedDateTimeIso: req.requestedDateTimeIso,
              }}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p>
                {req.requestTypeLabel} · {req.scopeLabel} · Resolved{" "}
                {req.resolvedAt
                  ? new Date(req.resolvedAt).toLocaleString("en-ZA")
                  : ""}
              </p>
              {req.note ? <p className="mt-1 text-slate-600">&ldquo;{req.note}&rdquo;</p> : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function AdminRecurringGroupSupportRequestsPanel({
  open,
  acknowledged,
  resolved,
}: Props) {
  const total = open.length + acknowledged.length + resolved.length;
  if (total === 0) {
    return <p className="text-sm text-slate-600">No customer support requests for this group.</p>;
  }

  return (
    <div className="space-y-6">
      <RequestSection title="Open" items={open} />
      <RequestSection title="Acknowledged" items={acknowledged} />
      <RequestSection title="Resolved" items={resolved} />
    </div>
  );
}
