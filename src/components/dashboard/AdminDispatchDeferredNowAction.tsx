"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ADMIN_ACTION_ERROR_CLASS } from "@/lib/app/dashboardEcosystemDisplay";

type Props = {
  bookingId: string;
  deferredDispatchNowEligible: boolean;
};

export function AdminDispatchDeferredNowAction({
  bookingId,
  deferredDispatchNowEligible,
}: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!deferredDispatchNowEligible) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/bookings/${bookingId}/dispatch-deferred-assignment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const body: unknown = await response.json().catch(() => ({}));
      const record = body as Record<string, unknown>;

      if (!response.ok) {
        setError(
          typeof record.message === "string"
            ? record.message
            : "Dispatch could not be completed.",
        );
        return;
      }

      setMessage(
        typeof record.message === "string"
          ? record.message
          : "Deferred assignment dispatch completed.",
      );
      setReason("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-lg border border-teal-200 bg-teal-50/80 p-4"
    >
      <h3 className="text-sm font-semibold text-teal-950">Dispatch now</h3>
      <p className="mt-1 text-xs text-teal-900/80">
        Runs the standard post-payment assignment engine for this deferred booking. Does not
        assign a cleaner directly or change booking status manually.
      </p>
      <label className="mt-3 block text-xs font-medium text-teal-900">
        Reason (required)
        <textarea
          name="reason"
          required
          minLength={8}
          maxLength={500}
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={loading}
          placeholder="e.g. Staging verification. force dispatch before cron window"
          className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
        />
      </label>
      <button
        type="submit"
        disabled={loading || reason.trim().length < 8}
        className="mt-3 rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Dispatching…" : "Dispatch now"}
      </button>
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className={`mt-2 ${ADMIN_ACTION_ERROR_CLASS}`}>{error}</p> : null}
    </form>
  );
}
