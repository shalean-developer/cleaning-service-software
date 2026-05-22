"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { deferEffectWork } from "@/lib/react/deferEffectWork";
import type { CleanerPublicCard } from "@/features/cleaners/server/types";
import type { AdminOperationalStatus } from "@/features/dashboards/server/adminOperationalHelpers";
import {
  ADMIN_ACTION_ERROR_CLASS,
  ADMIN_LOADING_ELIGIBLE_CLEANERS_LABEL,
} from "@/lib/app/dashboardEcosystemDisplay";

type Props = {
  bookingId: string;
  operational: Pick<
    AdminOperationalStatus,
    | "replaceOfferEligible"
    | "openOfferForReplace"
    | "maxDispatchAttemptsReached"
    | "dispatchOfferCount"
  >;
};

export function showAdminReplaceOpenOfferPanel(
  operational: Pick<AdminOperationalStatus, "replaceOfferEligible">,
): boolean {
  return operational.replaceOfferEligible;
}

export function AdminReplaceOpenOfferAction({ bookingId, operational }: Props) {
  const router = useRouter();
  const [cleaners, setCleaners] = useState<CleanerPublicCard[]>([]);
  const [loadingCleaners, setLoadingCleaners] = useState(true);
  const [targetCleanerId, setTargetCleanerId] = useState("");
  const [reason, setReason] = useState("");
  const [acknowledgeMaxAttempts, setAcknowledgeMaxAttempts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openOffer = operational.openOfferForReplace;

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
    deferEffectWork(() => {
      void loadCleaners();
    });
  }, [loadCleaners]);

  if (!operational.replaceOfferEligible) {
    return null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/bookings/${bookingId}/replace-open-offer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetCleanerId,
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
            : "Could not replace open offer.",
        );
        return;
      }

      setMessage(
        typeof record.message === "string"
          ? record.message
          : "Open offer replaced.",
      );
      setReason("");
      setTargetCleanerId("");
      setAcknowledgeMaxAttempts(false);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const selected = cleaners.find((c) => c.cleanerId === targetCleanerId);
  const canSubmit =
    targetCleanerId.length > 0 &&
    reason.trim().length >= 8 &&
    selected?.eligibilityStatus === "eligible" &&
    targetCleanerId !== openOffer?.cleanerId &&
    (!operational.maxDispatchAttemptsReached || acknowledgeMaxAttempts);

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-lg border border-orange-200 bg-orange-50/80 p-4"
    >
      <h3 className="text-sm font-semibold text-orange-950">Replace open offer</h3>
      <p className="mt-1 text-xs text-orange-900/80">
        Cancels the current open offer and sends a new offer to another eligible cleaner.
        The booking is assigned only after the new cleaner accepts.
      </p>

      {openOffer ? (
        <p className="mt-2 text-xs text-orange-900">
          Current open offer:{" "}
          <span className="font-medium">
            {openOffer.cleanerName ?? openOffer.cleanerId.slice(0, 8)}
          </span>
        </p>
      ) : null}

      {loadingCleaners ? (
        <p className="mt-3 text-sm text-zinc-600">{ADMIN_LOADING_ELIGIBLE_CLEANERS_LABEL}</p>
      ) : cleaners.length === 0 ? (
        <p className="mt-3 text-sm text-orange-900/70">No cleaners returned for this booking.</p>
      ) : (
        <label className="mt-3 block text-xs font-medium text-orange-900">
          New cleaner
          <select
            name="targetCleanerId"
            required
            value={targetCleanerId}
            onChange={(e) => setTargetCleanerId(e.target.value)}
            disabled={loading}
            className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
          >
            <option value="">Select a cleaner…</option>
            {cleaners.map((c) => (
              <option
                key={c.cleanerId}
                value={c.cleanerId}
                disabled={
                  c.eligibilityStatus !== "eligible" || c.cleanerId === openOffer?.cleanerId
                }
              >
                {c.displayName}
                {c.cleanerId === openOffer?.cleanerId
                  ? ". current open offer"
                  : c.eligibilityStatus === "eligible"
                    ? ""
                    : `. ${c.eligibilityReason}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="mt-3 block text-xs font-medium text-orange-900">
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
          placeholder="e.g. Original cleaner not responding; offering backup for same slot"
          className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
        />
      </label>

      {operational.maxDispatchAttemptsReached ? (
        <label className="mt-3 flex items-start gap-2 text-xs text-orange-900">
          <input
            type="checkbox"
            checked={acknowledgeMaxAttempts}
            onChange={(e) => setAcknowledgeMaxAttempts(e.target.checked)}
            disabled={loading}
            className="mt-0.5"
          />
          <span>
            I acknowledge this booking already reached the maximum automatic dispatch attempts
            ({operational.dispatchOfferCount} offers) and I am replacing the open offer manually.
          </span>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={loading || !canSubmit}
        className="mt-3 rounded-lg bg-orange-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Replacing offer…" : "Replace open offer"}
      </button>
      {message ? <p className="mt-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className={`mt-2 ${ADMIN_ACTION_ERROR_CLASS}`}>{error}</p> : null}
    </form>
  );
}
