"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RecoveryEligibility } from "@/features/dashboards/server/adminOperationalHelpers";

type Props = {
  bookingId: string;
  recoveryEligibility: RecoveryEligibility;
};

export function showAdminRecoverAssignmentAction(
  recoveryEligibility: RecoveryEligibility,
): boolean {
  return recoveryEligibility === "eligible";
}

export function AdminRecoverAssignmentAction({ bookingId, recoveryEligibility }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!showAdminRecoverAssignmentAction(recoveryEligibility)) {
    return null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/bookings/${bookingId}/recover-assignment`,
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
            : "Recovery could not be completed.",
        );
        return;
      }

      setMessage(
        typeof record.message === "string"
          ? record.message
          : "Assignment recovery completed.",
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
      className="mt-4 rounded-lg border border-violet-200 bg-violet-50/80 p-4"
    >
      <h3 className="text-sm font-semibold text-violet-950">Recover assignment</h3>
      <p className="mt-1 text-xs text-violet-900/80">
        Re-runs post-payment dispatch for this booking only. Does not change payment or
        assign a cleaner manually.
      </p>
      <label className="mt-3 block text-xs font-medium text-violet-900">
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
          placeholder="e.g. Paid booking stuck on confirmed after payment incident"
          className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
        />
      </label>
      <button
        type="submit"
        disabled={loading || reason.trim().length < 8}
        className="mt-3 rounded-lg bg-violet-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Recovering…" : "Run assignment recovery"}
      </button>
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
