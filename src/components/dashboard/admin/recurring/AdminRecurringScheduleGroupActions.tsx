"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RecurringScheduleGroupActionsAllowed } from "@/features/recurring/server/recurringManagementTypes";
import { AdminRecurringConfirmSheet } from "./AdminRecurringConfirmSheet";

type PendingAction = "pause" | "resume" | "cancel" | null;

type Props = {
  groupId: string;
  actions: RecurringScheduleGroupActionsAllowed;
};

async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok?: boolean; message?: string; error?: string };
}

export function AdminRecurringScheduleGroupActions({ groupId, actions }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/admin/recurring/groups/${encodeURIComponent(groupId)}`;

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
      } else {
        result = await postJson(`${base}/cancel`, { confirm: true });
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
      <div className="flex flex-wrap gap-2 pt-2">
        {actions.canPause ? (
          <button type="button" className={btn} onClick={() => setPending("pause")}>
            Pause entire group
          </button>
        ) : null}
        {actions.canResume ? (
          <button type="button" className={btn} onClick={() => setPending("resume")}>
            Resume entire group
          </button>
        ) : null}
        {actions.canCancelGroup ? (
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-800 hover:bg-red-100"
            onClick={() => setPending("cancel")}
          >
            Cancel entire group
          </button>
        ) : null}
      </div>

      <AdminRecurringConfirmSheet
        open={pending === "pause"}
        title="Pause entire schedule group?"
        description="All active weekday series under this group will be paused. No new visits will be generated until resumed."
        confirmLabel="Pause group"
        loading={loading}
        error={error}
        onClose={() => !loading && setPending(null)}
        onConfirm={() => void runAction("pause")}
      />
      <AdminRecurringConfirmSheet
        open={pending === "resume"}
        title="Resume entire schedule group?"
        description="The group and paused weekday series will become active again. Future visits will be generated on schedule."
        confirmLabel="Resume group"
        loading={loading}
        error={error}
        onClose={() => !loading && setPending(null)}
        onConfirm={() => void runAction("resume")}
      />
      <AdminRecurringConfirmSheet
        open={pending === "cancel"}
        title="Cancel entire schedule group?"
        description="This cancels all active and paused weekday series and removes unpaid future visits. Paid and completed visits are preserved."
        confirmLabel="Cancel group"
        destructive
        loading={loading}
        error={error}
        onClose={() => !loading && setPending(null)}
        onConfirm={() => void runAction("cancel")}
      />
    </>
  );
}
