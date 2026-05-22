"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  trackAdminCleanerApplicationApproved,
  trackAdminCleanerApplicationConverted,
} from "@/features/analytics/cleanerApplyEvents";
import type { CleanerApplicationStatus } from "@/features/cleaner-applications/types";
import { ADMIN_ACTION_ERROR_CLASS } from "@/lib/app/dashboardEcosystemDisplay";

const STATUS_OPTIONS: CleanerApplicationStatus[] = [
  "new",
  "reviewing",
  "approved",
  "rejected",
  "duplicate",
];

type Props = {
  applicationId: string;
  currentStatus: CleanerApplicationStatus;
  adminNotes: string | null;
  createdCleanerId: string | null;
};

export function AdminCleanerApplicationActions({
  applicationId,
  currentStatus,
  adminNotes,
  createdCleanerId,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [notes, setNotes] = useState(adminNotes ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function patchStatus(nextStatus: CleanerApplicationStatus) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/cleaner-applications/${applicationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, adminNotes: notes || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Update failed.");
        return;
      }
      setStatus(nextStatus);
      setMessage("Status updated.");
      if (nextStatus === "approved") {
        trackAdminCleanerApplicationApproved(applicationId);
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function convertToCleaner() {
    if (!confirm("Create inactive onboarding cleaner from this application?")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/cleaner-applications/${applicationId}/convert`,
        { method: "POST" },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        cleanerId?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Conversion failed.");
        return;
      }
      trackAdminCleanerApplicationConverted(applicationId);
      setMessage(data.message ?? "Cleaner provisioned.");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Admin actions
      </h2>

      <div>
        <label htmlFor="adminNotes" className="text-sm font-medium text-zinc-700">
          Admin notes
        </label>
        <textarea
          id="adminNotes"
          rows={4}
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy || status === s}
            onClick={() => patchStatus(s)}
            className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${
              status === s
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            } disabled:opacity-50`}
          >
            {s}
          </button>
        ))}
      </div>

      {createdCleanerId ? (
        <p className="text-sm text-zinc-600">
          Converted cleaner:{" "}
          <Link
            href={`/admin/cleaners/${createdCleanerId}`}
            className="font-medium text-blue-600 underline"
          >
            View cleaner
          </Link>
        </p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={convertToCleaner}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Convert to cleaner
        </button>
      )}

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className={ADMIN_ACTION_ERROR_CLASS}>{error}</p> : null}
    </div>
  );
}
