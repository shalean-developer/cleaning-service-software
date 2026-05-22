"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookingSupportRequestSummary } from "@/features/bookings/server/bookingSupportRequestsService";
import { AdminSupportRequestResponseFields } from "@/components/dashboard/admin/support/AdminSupportRequestResponseFields";
import { AdminSupportExecuteRescheduleForm } from "@/components/dashboard/admin/support/AdminSupportExecuteRescheduleForm";

type Props = {
  bookingId: string;
  requests: BookingSupportRequestSummary[];
};

export function AdminBookingSupportRequestsPanel({ bookingId, requests }: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [responseById, setResponseById] = useState<Record<string, string>>({});
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [showFieldsId, setShowFieldsId] = useState<string | null>(null);

  if (requests.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Customer support requests</h2>
        <p className="mt-2 text-sm text-zinc-600">No support requests for this booking.</p>
      </section>
    );
  }

  async function updateStatus(
    requestId: string,
    status: "acknowledged" | "resolved" | "rejected",
  ) {
    setLoadingId(requestId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/booking-support-requests/${requestId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          customerResponse:
            status === "resolved" || status === "rejected"
              ? responseById[requestId]
              : undefined,
          adminNotes: notesById[requestId],
        }),
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
      setLoadingId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Customer support requests</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Reschedule requests can be executed here after review. Cancel and other types remain
          review-only until a later phase.
        </p>
      </div>
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <ul className="space-y-3">
        {requests.map((r) => {
          const loading = loadingId === r.id;
          return (
            <li
              key={r.id}
              className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-amber-950">{r.requestTypeLabel}</p>
                  <p className="mt-0.5 text-xs text-amber-900">
                    {r.statusLabel} · {new Date(r.createdAt).toLocaleString("en-ZA")}
                  </p>
                </div>
                <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                  {r.status}
                </span>
              </div>
              {r.preferredNewTime ? (
                <p className="mt-2 text-sm text-amber-900">
                  Preferred time:{" "}
                  <span className="font-medium">
                    {new Date(r.preferredNewTime).toLocaleString("en-ZA")}
                  </span>
                </p>
              ) : null}
              {r.message ? (
                <p className="mt-2 text-sm text-amber-800">&ldquo;{r.message}&rdquo;</p>
              ) : null}
              {r.customerResponse ? (
                <p className="mt-2 text-sm text-amber-900">
                  <span className="font-medium">Customer-visible: </span>
                  {r.customerResponse}
                </p>
              ) : null}
              {r.requestType === "reschedule" &&
              (r.status === "open" || r.status === "acknowledged") ? (
                <AdminSupportExecuteRescheduleForm
                  requestId={r.id}
                  bookingId={bookingId}
                  preferredNewTime={r.preferredNewTime}
                  disabled={loading}
                />
              ) : null}
              {r.status === "resolved" && r.requestType === "reschedule" ? (
                <p className="mt-2 text-xs font-medium text-emerald-800">
                  Reschedule executed -{" "}
                  <a href={`/admin/bookings/${bookingId}`} className="underline">
                    view booking
                  </a>
                </p>
              ) : null}
              {r.status === "open" || r.status === "acknowledged" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === "open" ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void updateStatus(r.id, "acknowledged")}
                      className="inline-flex min-h-9 items-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      setShowFieldsId((id) => (id === r.id ? null : r.id))
                    }
                    className="inline-flex min-h-9 items-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950"
                  >
                    {showFieldsId === r.id ? "Hide response" : "Add response"}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void updateStatus(r.id, "resolved")}
                    className="inline-flex min-h-9 items-center rounded-lg bg-amber-900 px-3 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                  >
                    Mark resolved
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void updateStatus(r.id, "rejected")}
                    className="inline-flex min-h-9 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
              <AdminSupportRequestResponseFields
                showResponse={showFieldsId === r.id}
                customerResponse={responseById[r.id] ?? ""}
                adminNotes={notesById[r.id] ?? ""}
                onCustomerResponseChange={(v) =>
                  setResponseById((prev) => ({ ...prev, [r.id]: v }))
                }
                onAdminNotesChange={(v) => setNotesById((prev) => ({ ...prev, [r.id]: v }))}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
