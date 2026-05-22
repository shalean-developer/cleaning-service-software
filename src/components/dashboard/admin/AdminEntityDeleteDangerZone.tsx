"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ADMIN_ACTION_ERROR_CLASS } from "@/lib/app/dashboardEcosystemDisplay";

export type AdminEntityDeleteDangerZoneProps = {
  entityLabel: string;
  entityId: string;
  archiveEndpoint: string;
  confirmPhrase: string;
  archivedAt?: string | null;
  canDelete?: boolean;
  canArchive?: boolean;
  deleteBlockedMessage?: string | null;
  archiveDescription: string;
  deleteDescription?: string;
};

export function AdminEntityDeleteDangerZone({
  entityLabel,
  entityId,
  archiveEndpoint,
  confirmPhrase,
  archivedAt,
  canDelete = true,
  canArchive = true,
  deleteBlockedMessage,
  archiveDescription,
  deleteDescription,
}: AdminEntityDeleteDangerZoneProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"archive" | "delete">("archive");
  const [reason, setReason] = useState("");
  const [typedConfirm, setTypedConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isArchived = Boolean(archivedAt);

  async function submit() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(archiveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          action: mode,
          confirmPhrase: typedConfirm,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        blockedReason?: string;
      };

      if (!response.ok || !result.ok) {
        setError(
          result.message ??
            result.blockedReason ??
            result.error ??
            "Archive action failed.",
        );
        return;
      }

      setMessage(result.message ?? `${entityLabel} archived.`);
      setOpen(false);
      setReason("");
      setTypedConfirm("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function openModal(nextMode: "archive" | "delete") {
    setMode(nextMode);
    setOpen(true);
    setError(null);
    setMessage(null);
    setTypedConfirm("");
  }

  if (isArchived) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Danger zone</h2>
        <p className="mt-2 text-sm text-zinc-600">
          This {entityLabel.toLowerCase()} was archived on{" "}
          {new Date(archivedAt!).toLocaleString("en-ZA")}. Financial and audit records are
          preserved.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-red-200 bg-red-50/40 p-4">
      <h2 className="text-sm font-semibold text-red-950">Danger zone</h2>
      <p className="mt-1 text-sm text-red-900/90">{archiveDescription}</p>
      {deleteBlockedMessage ? (
        <p className="mt-2 text-sm text-amber-900">{deleteBlockedMessage}</p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
      {error && !open ? <p className={`mt-2 ${ADMIN_ACTION_ERROR_CLASS}`}>{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canArchive ? (
          <button
            type="button"
            className="rounded-lg border border-red-300 bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            disabled={loading}
            onClick={() => openModal("archive")}
          >
            Archive {entityLabel.toLowerCase()}
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            className="rounded-lg border border-red-400 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-50 disabled:opacity-50"
            disabled={loading || Boolean(deleteBlockedMessage)}
            onClick={() => openModal("delete")}
          >
            Delete {entityLabel.toLowerCase()}
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-delete-dialog-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <h3 id="admin-delete-dialog-title" className="text-base font-semibold text-zinc-900">
              {mode === "delete" ? "Delete" : "Archive"} {entityLabel.toLowerCase()}
            </h3>
            <p className="mt-2 text-sm text-zinc-600">
              {mode === "delete"
                ? (deleteDescription ??
                  "Removes this record from admin views. Payment, payout, and audit rows are never hard-deleted.")
                : archiveDescription}
            </p>
            <p className="mt-2 text-xs text-zinc-500">Entity ID: {entityId}</p>

            <label className="mt-4 block text-sm">
              <span className="font-medium text-zinc-800">Reason (required)</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={loading}
              />
            </label>

            <label className="mt-3 block text-sm">
              <span className="font-medium text-zinc-800">
                Type <span className="font-mono text-red-800">{confirmPhrase}</span> to confirm
              </span>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm"
                value={typedConfirm}
                onChange={(e) => setTypedConfirm(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
            </label>

            {error ? <p className={`mt-3 ${ADMIN_ACTION_ERROR_CLASS}`}>{error}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800"
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={loading || !reason.trim() || typedConfirm !== confirmPhrase}
                onClick={() => void submit()}
              >
                {loading
                  ? "Working…"
                  : mode === "delete"
                    ? "Confirm delete"
                    : "Confirm archive"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
