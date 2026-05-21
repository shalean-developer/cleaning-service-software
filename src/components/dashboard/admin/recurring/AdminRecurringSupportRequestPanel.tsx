"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RecurringSeriesRequestBadge } from "@/features/recurring/server/recurringManagementTypes";

type Props = {
  seriesId: string;
  request: RecurringSeriesRequestBadge;
};

export function AdminRecurringSupportRequestPanel({ seriesId, request }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function resolve(acknowledgeOnly: boolean) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/recurring/requests/${request.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgeOnly }),
      });
      const body = (await res.json()) as { ok?: boolean; message?: string };
      if (!body.ok) {
        setError(body.message ?? "Could not update request.");
        return;
      }
      setMessage(body.message ?? "Updated.");
      router.refresh();
    } catch {
      setError("Connection issue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-amber-950">Customer support request</h2>
          <p className="mt-1 text-sm text-amber-900">
            {request.requestTypeLabel} · {request.statusLabel} ·{" "}
            {new Date(request.createdAt).toLocaleString("en-ZA")}
          </p>
          {request.note ? (
            <p className="mt-2 text-sm text-amber-800">&ldquo;{request.note}&rdquo;</p>
          ) : null}
        </div>
        <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
          {request.status}
        </span>
      </div>
      <p className="mt-2 text-xs text-amber-800">
        Requests are not auto-applied. Pause, cancel, or reschedule the series manually, then mark
        resolved.
      </p>
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {request.status === "open" ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void resolve(true)}
            className="inline-flex min-h-9 items-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            Acknowledge
          </button>
        ) : null}
        <button
          type="button"
          disabled={loading}
          onClick={() => void resolve(false)}
          className="inline-flex min-h-9 items-center rounded-lg bg-amber-900 px-3 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          Mark resolved
        </button>
        <a
          href={`/admin/recurring/${seriesId}`}
          className="inline-flex min-h-9 items-center text-sm font-medium text-amber-950 underline"
        >
          Series detail
        </a>
      </div>
    </section>
  );
}
