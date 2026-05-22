"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminSupportInboxItem } from "@/features/support/server/adminSupportInboxReadModel";
import { SUPPORT_INBOX_TRIAGE_NOTICE } from "@/features/support/server/supportInboxTriage";

const STATUS_CLASS: Record<string, string> = {
  open: "bg-blue-50 text-blue-800",
  acknowledged: "bg-amber-50 text-amber-900",
  resolved: "bg-emerald-50 text-emerald-800",
  rejected: "bg-red-50 text-red-800",
};

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "bg-red-100 text-red-900",
  normal: "bg-zinc-100 text-zinc-700",
  low: "bg-slate-100 text-slate-600",
};

const SOURCE_LABEL = {
  booking_support: "One-off booking",
  recurring_support: "Recurring",
} as const;

type Props = {
  items: AdminSupportInboxItem[];
};

export function AdminSupportInboxList({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">
        No support requests match this filter.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <AdminSupportInboxCard key={`${item.source}-${item.id}`} item={item} />
      ))}
    </ul>
  );
}

function AdminSupportInboxCard({ item }: { item: AdminSupportInboxItem }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateBookingStatus(status: "acknowledged" | "resolved" | "rejected") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/booking-support-requests/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await res.json()) as { ok?: boolean; message?: string };
      if (!body.ok) {
        setError(body.message ?? "Could not update request.");
        return;
      }
      router.refresh();
    } catch {
      setError("Connection issue.");
    } finally {
      setLoading(false);
    }
  }

  async function updateRecurringStatus(options: { acknowledgeOnly?: boolean; reject?: boolean }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/recurring/requests/${item.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      const body = (await res.json()) as { ok?: boolean; message?: string };
      if (!body.ok) {
        setError(body.message ?? "Could not update request.");
        return;
      }
      router.refresh();
    } catch {
      setError("Connection issue.");
    } finally {
      setLoading(false);
    }
  }

  const contextLine =
    item.source === "booking_support"
      ? [
          item.bookingReference ? `Ref ${item.bookingReference}` : null,
          item.serviceLabel,
          item.scheduledStart
            ? new Date(item.scheduledStart).toLocaleString("en-ZA", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : null,
          item.addressSummary,
        ]
          .filter(Boolean)
          .join(" · ")
      : [
          item.frequencyLabel,
          item.targetWeekdayLabel ? `Weekday ${item.targetWeekdayLabel}` : null,
          item.groupId ? "Schedule group" : item.seriesId ? "Series" : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {item.requestTypeLabel}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_CLASS[item.status] ?? "bg-zinc-100"}`}
            >
              {item.statusLabel}
            </span>
            <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-600">
              {SOURCE_LABEL[item.source]}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PRIORITY_CLASS[item.priority]}`}
            >
              {item.priority}
            </span>
          </div>
          <p className="font-medium text-zinc-900">{item.customerName}</p>
          <p className="text-sm text-zinc-500">
            {[item.customerPhone, item.customerEmail].filter(Boolean).join(" · ") || "No contact on file"}
          </p>
          {contextLine ? <p className="text-sm text-zinc-600">{contextLine}</p> : null}
          {item.bookingStatus || item.paymentStatus ? (
            <p className="text-xs text-zinc-500">
              Booking {item.bookingStatus ?? "—"}
              {item.paymentStatus ? ` · Payment ${item.paymentStatus}` : ""}
            </p>
          ) : null}
        </div>
        <time className="shrink-0 text-xs text-zinc-400" dateTime={item.createdAt}>
          {new Date(item.createdAt).toLocaleString("en-ZA")}
        </time>
      </div>

      {item.messagePreview ? (
        <p className="mt-3 line-clamp-2 text-sm text-zinc-700">&ldquo;{item.messagePreview}&rdquo;</p>
      ) : null}
      {item.preferredNewTime ? (
        <p className="mt-1 text-sm text-zinc-600">
          Preferred: {new Date(item.preferredNewTime).toLocaleString("en-ZA")}
        </p>
      ) : null}

      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-medium text-slate-800">Suggested: </span>
        {item.suggestedNextAction}
      </p>

      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {item.bookingHref ? (
          <Link
            href={item.bookingHref}
            className="inline-flex min-h-9 items-center rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Open booking
          </Link>
        ) : null}
        {item.seriesHref ? (
          <Link
            href={item.seriesHref}
            className="inline-flex min-h-9 items-center rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Open series
          </Link>
        ) : null}
        {item.groupHref ? (
          <Link
            href={item.groupHref}
            className="inline-flex min-h-9 items-center rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Open schedule group
          </Link>
        ) : null}
        {item.canAcknowledge ? (
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void (item.source === "booking_support"
                ? updateBookingStatus("acknowledged")
                : updateRecurringStatus({ acknowledgeOnly: true }))
            }
            className="inline-flex min-h-9 items-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            Acknowledge
          </button>
        ) : null}
        {item.canResolve ? (
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void (item.source === "booking_support"
                ? updateBookingStatus("resolved")
                : updateRecurringStatus({}))
            }
            className="inline-flex min-h-9 items-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Resolve
          </button>
        ) : null}
        {item.canReject ? (
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void (item.source === "booking_support"
                ? updateBookingStatus("rejected")
                : updateRecurringStatus({ reject: true }))
            }
            className="inline-flex min-h-9 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Reject
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function AdminSupportInboxTriageBanner() {
  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
      {SUPPORT_INBOX_TRIAGE_NOTICE}
    </div>
  );
}
