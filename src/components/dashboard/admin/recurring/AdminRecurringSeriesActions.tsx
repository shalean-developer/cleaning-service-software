"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RecurringSeriesActionsAllowed } from "@/features/recurring/server/recurringManagementTypes";
import { AdminRecurringConfirmSheet } from "./AdminRecurringConfirmSheet";

type PendingAction =
  | "pause"
  | "resume"
  | "cancel"
  | "skip"
  | null;

type Props = {
  seriesId: string;
  actions: RecurringSeriesActionsAllowed;
  compact?: boolean;
};

async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok?: boolean; message?: string; error?: string };
}

export function AdminRecurringSeriesActions({ seriesId, actions, compact }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/admin/recurring/${encodeURIComponent(seriesId)}`;

  async function runAction(action: PendingAction) {
    if (!action) return;
    setLoading(true);
    setError(null);
    try {
      let result: { ok?: boolean; message?: string; error?: string };
      if (action === "pause") {
        result = await postJson(`${base}/pause`, {});
      } else if (action === "resume") {
        result = await postJson(`${base}/resume`, {});
      } else if (action === "cancel") {
        result = await postJson(`${base}/cancel`, { confirm: true, reason: "Admin cancelled series" });
      } else {
        result = await postJson(`${base}/skip-next`, { confirm: true });
      }
      if (!result.ok) {
        setError(result.message ?? result.error ?? "Action failed.");
        return;
      }
      setPending(null);
      router.refresh();
    } catch {
      setError("Connection issue. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const btn =
    "inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50";

  return (
    <>
      <div className={compact ? "flex flex-wrap gap-2" : "flex flex-wrap gap-2 pt-2"}>
        <a href={`/admin/recurring/${seriesId}`} className={btn}>
          View series
        </a>
        {actions.canPause ? (
          <button type="button" className={btn} onClick={() => setPending("pause")}>
            Pause
          </button>
        ) : null}
        {actions.canResume ? (
          <button type="button" className={btn} onClick={() => setPending("resume")}>
            Resume
          </button>
        ) : null}
        {actions.canSkipNext ? (
          <button type="button" className={btn} onClick={() => setPending("skip")}>
            Skip next
          </button>
        ) : null}
        {actions.canCancelSeries ? (
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-800 hover:bg-red-100"
            onClick={() => setPending("cancel")}
          >
            Cancel series
          </button>
        ) : null}
      </div>

      <AdminRecurringConfirmSheet
        open={pending === "pause"}
        title="Pause recurring series?"
        description="No new visits will be generated while paused. Existing unpaid visits may remain until cancelled manually."
        confirmLabel="Pause series"
        loading={loading}
        error={error}
        onClose={() => !loading && setPending(null)}
        onConfirm={() => void runAction("pause")}
      />
      <AdminRecurringConfirmSheet
        open={pending === "resume"}
        title="Resume recurring series?"
        description="The series will become active again and future visits will be generated on schedule."
        confirmLabel="Resume series"
        loading={loading}
        error={error}
        onClose={() => !loading && setPending(null)}
        onConfirm={() => void runAction("resume")}
      />
      <AdminRecurringConfirmSheet
        open={pending === "cancel"}
        title="Cancel entire series?"
        description="This cancels unpaid future visits. Paid and completed visits are preserved."
        confirmLabel="Cancel series"
        destructive
        loading={loading}
        error={error}
        onClose={() => !loading && setPending(null)}
        onConfirm={() => void runAction("cancel")}
      />
      <AdminRecurringConfirmSheet
        open={pending === "skip"}
        title="Skip next occurrence?"
        description="The next unpaid visit will be cancelled and the schedule will advance."
        confirmLabel="Skip next visit"
        loading={loading}
        error={error}
        onClose={() => !loading && setPending(null)}
        onConfirm={() => void runAction("skip")}
      />
    </>
  );
}
