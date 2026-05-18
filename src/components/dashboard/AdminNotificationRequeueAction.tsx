"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminNotificationOutboxEntry } from "@/features/dashboards/server/types";
import { ADMIN_ACTION_ERROR_CLASS } from "@/lib/app/dashboardEcosystemDisplay";

type Props = {
  notification: AdminNotificationOutboxEntry;
};

export function AdminNotificationRequeueAction({ notification }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!notification.canRequeue) {
    return null;
  }

  const isDryRunRequeue =
    notification.isDryRun && notification.status === "sent";
  const buttonLabel = isDryRunRequeue ? "Requeue dry-run" : "Requeue";
  const formTitle = isDryRunRequeue
    ? "Requeue dry-run sent notification"
    : "Requeue failed notification";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/notifications/${notification.id}/requeue`,
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
            : "Notification could not be requeued.",
        );
        return;
      }

      const dedupeBlocked = record.deliveryDedupeWouldBlock === true;
      const baseMessage =
        typeof record.message === "string"
          ? record.message
          : "Notification requeued to pending.";
      setMessage(
        dedupeBlocked
          ? `${baseMessage} Another row may already be sent — worker dedupe may skip email.`
          : baseMessage,
      );
      setReason("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
        >
          {buttonLabel}
        </button>
      ) : (
        <form
          onSubmit={submit}
          className="rounded-lg border border-amber-200 bg-amber-50/80 p-3"
        >
          <p className="text-xs font-medium text-amber-950">{formTitle}</p>
          <p className="mt-1 text-xs text-amber-900/80">
            Resets this row to pending for the worker on the next cron run. Does not
            send email immediately or bypass delivery dedupe.
            {isDryRunRequeue
              ? " Next delivery follows your environment (dry-run or Resend)."
              : null}
          </p>
          <label className="mt-2 block text-xs font-medium text-amber-900">
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
              placeholder="e.g. Fixed Resend config after provider outage"
              className="mt-1 w-full rounded border border-amber-200 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading || reason.trim().length < 8}
              className="rounded bg-amber-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {loading ? "Requeuing…" : "Confirm requeue"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="rounded border border-amber-300 px-3 py-1.5 text-xs text-amber-950 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {message ? <p className="mt-2 text-xs text-emerald-800">{message}</p> : null}
          {error ? <p className={`mt-2 text-xs ${ADMIN_ACTION_ERROR_CLASS}`}>{error}</p> : null}
        </form>
      )}
    </div>
  );
}
