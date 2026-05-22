"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { RescheduleAssignmentHandling } from "@/features/bookings/server/commands/types";

type Props = {
  requestId: string;
  bookingId: string;
  preferredNewTime: string | null;
  disabled?: boolean;
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addHoursToLocalDatetime(local: string, hours: number): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  d.setHours(d.getHours() + hours);
  return toDatetimeLocalValue(d.toISOString());
}

function localDatetimeToIso(local: string): string {
  return new Date(local).toISOString();
}

export function AdminSupportExecuteRescheduleForm({
  requestId,
  bookingId,
  preferredNewTime,
  disabled,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePreferred, setUsePreferred] = useState(Boolean(preferredNewTime));
  const [startLocal, setStartLocal] = useState(() =>
    toDatetimeLocalValue(preferredNewTime),
  );
  const [endLocal, setEndLocal] = useState(() =>
    preferredNewTime ? addHoursToLocalDatetime(toDatetimeLocalValue(preferredNewTime), 3) : "",
  );
  const [assignmentHandling, setAssignmentHandling] =
    useState<RescheduleAssignmentHandling>("block_if_unavailable");
  const [adminNote, setAdminNote] = useState("");
  const [customerResponse, setCustomerResponse] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const warnings = useMemo(
    () => [
      "This changes the booking schedule.",
      "Payment status will not change.",
      "Cleaner assignment may need review.",
    ],
    [],
  );

  async function execute() {
    if (!confirmed) {
      setError("Check the confirmation box before executing.");
      return;
    }
    const startIso = localDatetimeToIso(startLocal);
    const endIso = localDatetimeToIso(endLocal);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/booking-support-requests/${requestId}/execute-reschedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newScheduledStart: startIso,
            newScheduledEnd: endIso,
            assignmentHandling,
            adminNote: adminNote.trim() || undefined,
            customerResponse: customerResponse.trim() || undefined,
            confirm: true,
          }),
        },
      );
      const body = (await res.json()) as {
        ok?: boolean;
        message?: string;
        assignmentOutcome?: string;
      };
      if (!body.ok) {
        setError(body.message ?? "Could not execute reschedule.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Connection issue.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center rounded-lg border border-sky-300 bg-sky-50 px-3 text-sm font-medium text-sky-950 hover:bg-sky-100 disabled:opacity-50"
      >
        Execute reschedule
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/80 p-4">
      <p className="text-sm font-semibold text-sky-950">Execute approved reschedule</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-sky-900">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      {preferredNewTime ? (
        <label className="mt-3 flex items-center gap-2 text-sm text-sky-900">
          <input
            type="checkbox"
            checked={usePreferred}
            onChange={(e) => {
              const checked = e.target.checked;
              setUsePreferred(checked);
              if (checked) {
                const start = toDatetimeLocalValue(preferredNewTime);
                setStartLocal(start);
                setEndLocal(addHoursToLocalDatetime(start, 3));
              }
            }}
          />
          Use customer preferred time (
          {new Date(preferredNewTime).toLocaleString("en-ZA")})
        </label>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-sky-900">
          New start
          <input
            type="datetime-local"
            disabled={usePreferred && Boolean(preferredNewTime)}
            value={startLocal}
            onChange={(e) => {
              setUsePreferred(false);
              setStartLocal(e.target.value);
              if (!endLocal) {
                setEndLocal(addHoursToLocalDatetime(e.target.value, 3));
              }
            }}
            className="mt-1 w-full rounded-lg border border-sky-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-sky-900">
          New end
          <input
            type="datetime-local"
            disabled={usePreferred && Boolean(preferredNewTime)}
            value={endLocal}
            onChange={(e) => {
              setUsePreferred(false);
              setEndLocal(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-sky-200 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="mt-3 block text-xs font-medium text-sky-900">
        If assigned cleaner is unavailable
        <select
          value={assignmentHandling}
          onChange={(e) =>
            setAssignmentHandling(e.target.value as RescheduleAssignmentHandling)
          }
          className="mt-1 w-full rounded-lg border border-sky-200 px-2 py-1.5 text-sm"
        >
          <option value="block_if_unavailable">Block execution (ask for another time)</option>
          <option value="unassign_if_unavailable">
            Unassign cleaner and return to pending assignment
          </option>
          <option value="keep_if_available">Only proceed if cleaner remains available</option>
        </select>
      </label>
      <label className="mt-3 block text-xs font-medium text-sky-900">
        Customer response (optional)
        <textarea
          value={customerResponse}
          onChange={(e) => setCustomerResponse(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-sky-200 px-2 py-1.5 text-sm"
          placeholder="Shown to customer when request is resolved"
        />
      </label>
      <label className="mt-2 block text-xs font-medium text-sky-900">
        Internal note (optional)
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-sky-200 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="mt-3 flex items-start gap-2 text-sm text-sky-950">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1"
        />
        <span>
          I confirm this will update booking{" "}
          <span className="font-mono text-xs">{bookingId.slice(0, 8)}…</span> schedule and resolve
          this support request.
        </span>
      </label>
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void execute()}
          className="inline-flex min-h-9 items-center rounded-lg bg-sky-700 px-3 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
        >
          {loading ? "Executing…" : "Confirm & execute"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => setOpen(false)}
          className="inline-flex min-h-9 items-center rounded-lg border border-sky-200 px-3 text-sm text-sky-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
