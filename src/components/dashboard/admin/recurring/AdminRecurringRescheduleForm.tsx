"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminRecurringConfirmSheet } from "./AdminRecurringConfirmSheet";

type Props = { seriesId: string; currentNext: string | null };

export function AdminRecurringRescheduleForm({ seriesId, currentNext }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(
    currentNext ? new Date(currentNext).toISOString().slice(0, 16) : "",
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value) {
      setError("Choose a date and time.");
      return;
    }
    const iso = new Date(value).toISOString();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/recurring/${encodeURIComponent(seriesId)}/reschedule-next`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true, nextScheduledStartIso: iso }),
        },
      );
      const body = (await res.json()) as { ok?: boolean; message?: string };
      if (!body.ok) {
        setError(body.message ?? "Could not reschedule.");
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    } catch {
      setError("Connection issue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Reschedule next occurrence</p>
      <p className="mt-1 text-sm text-slate-600">
        Moves the next unpaid slot. Times use your browser locale; stored in UTC (SAST-aligned
        engine).
      </p>
      <label className="mt-3 block text-sm text-slate-700">
        New start
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 block w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="button"
        className="mt-3 inline-flex min-h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        onClick={() => setConfirmOpen(true)}
      >
        Reschedule…
      </button>
      <AdminRecurringConfirmSheet
        open={confirmOpen}
        title="Reschedule next visit?"
        description="Any existing unpaid booking at the current next slot will be cancelled. A new visit may be generated at the new time."
        confirmLabel="Reschedule"
        loading={loading}
        error={error}
        onClose={() => !loading && setConfirmOpen(false)}
        onConfirm={() => void submit()}
      />
    </div>
  );
}
