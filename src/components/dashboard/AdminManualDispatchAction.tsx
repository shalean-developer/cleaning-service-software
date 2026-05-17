"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { CleanerPublicCard } from "@/features/cleaners/server/types";
import type { AdminOperationalStatus } from "@/features/dashboards/server/adminOperationalHelpers";

type Props = {
  bookingId: string;
  operational: Pick<
    AdminOperationalStatus,
    | "manualDispatchEligible"
    | "maxDispatchAttemptsReached"
    | "dispatchOfferCount"
    | "openOfferSummary"
  >;
};

export function showAdminManualDispatchPanel(
  bookingStatus: string,
  operational: Pick<AdminOperationalStatus, "manualDispatchEligible">,
): boolean {
  return bookingStatus === "pending_assignment" && operational.manualDispatchEligible;
}

export function AdminManualDispatchAction({ bookingId, operational }: Props) {
  const router = useRouter();
  const [cleaners, setCleaners] = useState<CleanerPublicCard[]>([]);
  const [loadingCleaners, setLoadingCleaners] = useState(true);
  const [cleanerId, setCleanerId] = useState("");
  const [reason, setReason] = useState("");
  const [acknowledgeMaxAttempts, setAcknowledgeMaxAttempts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCleaners = useCallback(async () => {
    setLoadingCleaners(true);
    try {
      const response = await fetch(
        `/api/booking/cleaners?bookingId=${encodeURIComponent(bookingId)}`,
      );
      const body: unknown = await response.json().catch(() => ({}));
      const record = body as { ok?: boolean; cleaners?: CleanerPublicCard[] };
      if (response.ok && record.ok && Array.isArray(record.cleaners)) {
        setCleaners(record.cleaners);
      } else {
        setCleaners([]);
      }
    } catch {
      setCleaners([]);
    } finally {
      setLoadingCleaners(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void loadCleaners();
  }, [loadCleaners]);

  if (!operational.manualDispatchEligible) {
    return null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/bookings/${bookingId}/dispatch-offer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cleanerId,
            reason,
            acknowledgeMaxAttempts:
              operational.maxDispatchAttemptsReached ? acknowledgeMaxAttempts : false,
          }),
        },
      );
      const body: unknown = await response.json().catch(() => ({}));
      const record = body as Record<string, unknown>;

      if (!response.ok) {
        setError(
          typeof record.message === "string"
            ? record.message
            : "Could not send offer to cleaner.",
        );
        return;
      }

      setMessage(
        typeof record.message === "string"
          ? record.message
          : "Offer sent to cleaner.",
      );
      setReason("");
      setCleanerId("");
      setAcknowledgeMaxAttempts(false);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const selected = cleaners.find((c) => c.cleanerId === cleanerId);
  const canSubmit =
    cleanerId.length > 0 &&
    reason.trim().length >= 8 &&
    selected?.eligibilityStatus === "eligible" &&
    (!operational.maxDispatchAttemptsReached || acknowledgeMaxAttempts);

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-4"
    >
      <h3 className="text-sm font-semibold text-amber-950">Send offer to cleaner</h3>
      <p className="mt-1 text-xs text-amber-900/80">
        Sends an assignment offer only. The booking is assigned after the cleaner accepts —
        not when you submit this form.
      </p>

      {loadingCleaners ? (
        <p className="mt-3 text-sm text-amber-900/70">Loading eligible cleaners…</p>
      ) : cleaners.length === 0 ? (
        <p className="mt-3 text-sm text-amber-900/70">No cleaners returned for this booking.</p>
      ) : (
        <label className="mt-3 block text-xs font-medium text-amber-900">
          Cleaner
          <select
            name="cleanerId"
            required
            value={cleanerId}
            onChange={(e) => setCleanerId(e.target.value)}
            disabled={loading}
            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
          >
            <option value="">Select a cleaner…</option>
            {cleaners.map((c) => (
              <option
                key={c.cleanerId}
                value={c.cleanerId}
                disabled={c.eligibilityStatus !== "eligible"}
              >
                {c.displayName}
                {c.eligibilityStatus === "eligible"
                  ? ""
                  : ` — ${c.eligibilityReason}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="mt-3 block text-xs font-medium text-amber-900">
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
          placeholder="e.g. Selected cleaner declined; offering next available for slot"
          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
        />
      </label>

      {operational.maxDispatchAttemptsReached ? (
        <label className="mt-3 flex items-start gap-2 text-xs text-amber-900">
          <input
            type="checkbox"
            checked={acknowledgeMaxAttempts}
            onChange={(e) => setAcknowledgeMaxAttempts(e.target.checked)}
            disabled={loading}
            className="mt-0.5"
          />
          <span>
            I acknowledge this booking already reached the maximum automatic dispatch attempts
            ({operational.dispatchOfferCount} offers) and I am sending another offer manually.
          </span>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={loading || !canSubmit}
        className="mt-3 rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Sending offer…" : "Send offer to cleaner"}
      </button>
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
