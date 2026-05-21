"use client";

import { useState } from "react";
import { AdminRecurringConfirmSheet } from "@/components/dashboard/admin/recurring/AdminRecurringConfirmSheet";
import type { RecurringSeriesActionsAllowed } from "@/features/recurring/server/recurringManagementTypes";

type RequestType = "pause" | "cancel" | "reschedule";

type Props = {
  seriesId: string;
  actions: RecurringSeriesActionsAllowed;
};

export function CustomerRecurringRequestActions({ seriesId, actions }: Props) {
  const [pending, setPending] = useState<RequestType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(type: RequestType) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/recurring/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, requestType: type, confirm: true }),
      });
      const body = (await res.json()) as { ok?: boolean; message?: string };
      if (!body.ok) {
        setError(body.message ?? "Could not submit request.");
        return;
      }
      setSuccess(body.message ?? "Request submitted.");
      setPending(null);
    } catch {
      setError("Connection issue.");
    } finally {
      setLoading(false);
    }
  }

  const btn =
    "inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50";

  return (
    <div className="space-y-3">
      {success ? <p className="text-sm text-emerald-800">{success}</p> : null}
      <div className="flex flex-wrap gap-2">
        {actions.canRequestPause ? (
          <button type="button" className={btn} onClick={() => setPending("pause")}>
            Request pause
          </button>
        ) : null}
        {actions.canRequestReschedule ? (
          <button type="button" className={btn} onClick={() => setPending("reschedule")}>
            Request reschedule
          </button>
        ) : null}
        {actions.canRequestCancel ? (
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-800"
            onClick={() => setPending("cancel")}
          >
            Request cancellation
          </button>
        ) : null}
      </div>

      <AdminRecurringConfirmSheet
        open={pending === "pause"}
        title="Request to pause?"
        description="We'll review your request and confirm before pausing your recurring schedule."
        confirmLabel="Submit request"
        loading={loading}
        error={error}
        onClose={() => !loading && setPending(null)}
        onConfirm={() => void submit("pause")}
      />
      <AdminRecurringConfirmSheet
        open={pending === "reschedule"}
        title="Request a reschedule?"
        description="Tell us you'd like to move your next visit. Our team will follow up to confirm."
        confirmLabel="Submit request"
        loading={loading}
        error={error}
        onClose={() => !loading && setPending(null)}
        onConfirm={() => void submit("reschedule")}
      />
      <AdminRecurringConfirmSheet
        open={pending === "cancel"}
        title="Request cancellation?"
        description="We'll review before cancelling your recurring schedule. Completed visits stay on your history."
        confirmLabel="Submit request"
        destructive
        loading={loading}
        error={error}
        onClose={() => !loading && setPending(null)}
        onConfirm={() => void submit("cancel")}
      />
    </div>
  );
}
