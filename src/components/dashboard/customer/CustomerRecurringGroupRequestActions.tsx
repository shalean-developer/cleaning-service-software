"use client";

import { useState } from "react";
import { AdminRecurringConfirmSheet } from "@/components/dashboard/admin/recurring/AdminRecurringConfirmSheet";
import type {
  CustomerRecurringGroupActionsAllowed,
  CustomerRecurringGroupWeekdaySeriesItem,
} from "@/features/recurring/server/recurringManagementTypes";

type GroupRequestType =
  | "pause_group"
  | "cancel_group"
  | "reschedule_group"
  | "pause_weekday"
  | "cancel_weekday"
  | "reschedule_weekday";

type Pending =
  | { kind: "group"; type: GroupRequestType }
  | { kind: "weekday"; type: GroupRequestType; seriesId: string; weekday: number | null };

type Props = {
  groupId: string;
  actions: CustomerRecurringGroupActionsAllowed;
  weekdaySeries: CustomerRecurringGroupWeekdaySeriesItem[];
};

export function CustomerRecurringGroupRequestActions({
  groupId,
  actions,
  weekdaySeries,
}: Props) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState("");
  const [requestedDateTimeIso, setRequestedDateTimeIso] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(p: Pending) {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        requestType: p.type,
        confirm: true,
        note: note.trim() || undefined,
      };
      if (p.kind === "weekday") {
        body.targetSeriesId = p.seriesId;
        if (p.weekday != null) body.targetWeekday = p.weekday;
      }
      if (p.type.includes("reschedule") && requestedDateTimeIso.trim()) {
        body.requestedDateTimeIso = requestedDateTimeIso.trim();
      }

      const res = await fetch(`/api/customer/recurring/groups/${groupId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!data.ok) {
        setError(data.message ?? "Could not submit request.");
        return;
      }
      setSuccess(data.message ?? "Request submitted.");
      setPending(null);
      setNote("");
      setRequestedDateTimeIso("");
    } catch {
      setError("Connection issue.");
    } finally {
      setLoading(false);
    }
  }

  const btn =
    "inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50";

  const needsReschedule = pending?.type.includes("reschedule") ?? false;

  return (
    <div className="space-y-4">
      {success ? <p className="text-sm text-emerald-800">{success}</p> : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Entire schedule
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.canRequestPauseGroup ? (
            <button
              type="button"
              className={btn}
              onClick={() => setPending({ kind: "group", type: "pause_group" })}
            >
              Request pause all days
            </button>
          ) : null}
          {actions.canRequestRescheduleGroup ? (
            <button
              type="button"
              className={btn}
              onClick={() => setPending({ kind: "group", type: "reschedule_group" })}
            >
              Request reschedule all days
            </button>
          ) : null}
          {actions.canRequestCancelGroup ? (
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-800"
              onClick={() => setPending({ kind: "group", type: "cancel_group" })}
            >
              Request cancel all days
            </button>
          ) : null}
        </div>
      </div>

      {weekdaySeries.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            One weekday
          </p>
          <ul className="mt-2 space-y-2">
            {weekdaySeries.map((s) => (
              <li
                key={s.seriesId}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2"
              >
                <span className="text-sm font-medium text-zinc-900">{s.weekdayLabel}</span>
                {actions.canRequestPauseWeekday ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
                    onClick={() =>
                      setPending({
                        kind: "weekday",
                        type: "pause_weekday",
                        seriesId: s.seriesId,
                        weekday: s.weekday,
                      })
                    }
                  >
                    Pause
                  </button>
                ) : null}
                {actions.canRequestRescheduleWeekday ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
                    onClick={() =>
                      setPending({
                        kind: "weekday",
                        type: "reschedule_weekday",
                        seriesId: s.seriesId,
                        weekday: s.weekday,
                      })
                    }
                  >
                    Reschedule
                  </button>
                ) : null}
                {actions.canRequestCancelWeekday ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-red-800 underline-offset-2 hover:underline"
                    onClick={() =>
                      setPending({
                        kind: "weekday",
                        type: "cancel_weekday",
                        seriesId: s.seriesId,
                        weekday: s.weekday,
                      })
                    }
                  >
                    Cancel
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AdminRecurringConfirmSheet
        open={pending != null}
        title="Submit schedule change request?"
        description="Our team reviews every request before your schedule changes. nothing is updated automatically."
        confirmLabel="Submit request"
        destructive={pending?.type.includes("cancel") ?? false}
        loading={loading}
        error={error}
        onClose={() => !loading && setPending(null)}
        onConfirm={() => pending && void submit(pending)}
      >
        <label className="mt-3 block text-sm text-zinc-700">
          Note (optional)
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {needsReschedule ? (
          <label className="mt-3 block text-sm text-zinc-700">
            Preferred date & time (ISO)
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              onChange={(e) => {
                if (!e.target.value) {
                  setRequestedDateTimeIso("");
                  return;
                }
                setRequestedDateTimeIso(new Date(e.target.value).toISOString());
              }}
            />
          </label>
        ) : null}
      </AdminRecurringConfirmSheet>
    </div>
  );
}
