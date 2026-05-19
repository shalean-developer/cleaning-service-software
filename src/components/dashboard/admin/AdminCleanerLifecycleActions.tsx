"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CleanerOperationalState } from "@/features/cleaners/server/lifecycle/operationalState";
import { CLEANER_LIFECYCLE_UX_COPY } from "@/features/cleaners/server/admin/adminCleanerOperationalDisplay";
import type { AdminCleanerSafetyCounts } from "@/features/cleaners/server/admin/types";
import { ADMIN_ACTION_ERROR_CLASS } from "@/lib/app/dashboardEcosystemDisplay";

type LifecycleAction =
  | "completeOnboarding"
  | "deactivate"
  | "suspend"
  | "reactivate"
  | "unsuspend"
  | "archive";

type Props = {
  cleanerId: string;
  operationalState: CleanerOperationalState;
  safetyCounts: AdminCleanerSafetyCounts;
};

const ACTION_ENDPOINTS: Record<LifecycleAction, string> = {
  completeOnboarding: "complete-onboarding",
  deactivate: "deactivate",
  suspend: "suspend",
  reactivate: "reactivate",
  unsuspend: "unsuspend",
  archive: "archive",
};

export function AdminCleanerLifecycleActions({
  cleanerId,
  operationalState,
  safetyCounts,
}: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [suspensionEndsAt, setSuspensionEndsAt] = useState("");
  const [loadingAction, setLoadingAction] = useState<LifecycleAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isArchived = operationalState === "archived";
  const isSuspended = operationalState === "suspended";
  const isOnboarding = operationalState === "onboarding";

  async function submitAction(action: LifecycleAction) {
    setLoadingAction(action);
    setError(null);
    setMessage(null);

    const body: Record<string, unknown> = {};
    if (action === "deactivate" || action === "suspend" || action === "archive") {
      body.reason = reason;
    }
    if (action === "suspend" && suspensionEndsAt.trim()) {
      body.suspensionEndsAt = new Date(suspensionEndsAt).toISOString();
    }
    if (action === "unsuspend") {
      body.setActive = true;
    }

    try {
      const response = await fetch(
        `/api/admin/cleaners/${cleanerId}/${ACTION_ENDPOINTS[action]}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        setError(result.message ?? result.error ?? "Lifecycle action failed.");
        return;
      }

      setMessage(result.message ?? "Lifecycle action completed.");
      setReason("");
      setSuspensionEndsAt("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-zinc-600">{CLEANER_LIFECYCLE_UX_COPY.inactive}</p>
      <p className="text-xs leading-relaxed text-zinc-600">{CLEANER_LIFECYCLE_UX_COPY.suspended}</p>
      <p className="text-xs leading-relaxed text-zinc-600">{CLEANER_LIFECYCLE_UX_COPY.archived}</p>
      <p className="text-xs leading-relaxed text-zinc-600">{CLEANER_LIFECYCLE_UX_COPY.earnings}</p>

      <label className="block text-sm">
        <span className="font-medium text-zinc-800">Reason (required for deactivate, suspend, archive)</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={loadingAction !== null}
        />
      </label>

      {!isArchived ? (
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Suspension end (optional, for suspend)</span>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            value={suspensionEndsAt}
            onChange={(e) => setSuspensionEndsAt(e.target.value)}
            disabled={loadingAction !== null}
          />
        </label>
      ) : null}

      {error ? <p className={ADMIN_ACTION_ERROR_CLASS}>{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        {isOnboarding ? (
          <button
            type="button"
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={loadingAction !== null || isArchived}
            onClick={() => void submitAction("completeOnboarding")}
          >
            {loadingAction === "completeOnboarding"
              ? "Completing…"
              : "Complete onboarding"}
          </button>
        ) : null}

        <button
          type="button"
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={loadingAction !== null || isArchived}
          onClick={() => void submitAction("deactivate")}
        >
          {loadingAction === "deactivate" ? "Deactivating…" : "Deactivate"}
        </button>

        <button
          type="button"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 disabled:opacity-50"
          disabled={loadingAction !== null || isArchived}
          onClick={() => void submitAction("suspend")}
        >
          {loadingAction === "suspend" ? "Suspending…" : "Suspend"}
        </button>

        <button
          type="button"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
          disabled={loadingAction !== null || isArchived}
          onClick={() => void submitAction("reactivate")}
        >
          {loadingAction === "reactivate" ? "Reactivating…" : "Reactivate"}
        </button>

        {isSuspended ? (
          <button
            type="button"
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900 disabled:opacity-50"
            disabled={loadingAction !== null || isArchived}
            onClick={() => void submitAction("unsuspend")}
          >
            {loadingAction === "unsuspend" ? "Unsuspending…" : "Unsuspend"}
          </button>
        ) : null}

        <button
          type="button"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 disabled:opacity-50"
          disabled={loadingAction !== null || isArchived}
          onClick={() => void submitAction("archive")}
        >
          {loadingAction === "archive" ? "Archiving…" : "Archive"}
        </button>
      </div>

      {!isArchived && safetyCounts.activeBookingsCount > 0 ? (
        <p className="text-xs text-amber-800">
          Archive is blocked while {safetyCounts.activeBookingsCount} active booking
          {safetyCounts.activeBookingsCount === 1 ? "" : "s"} exist.
        </p>
      ) : null}

      {isArchived ? (
        <p className="text-xs text-zinc-500">
          Archived cleaners cannot be reactivated. Historical earnings remain in the ledger.
        </p>
      ) : null}
    </div>
  );
}
