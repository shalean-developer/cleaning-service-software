"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  DeclineOfferConfirmSheet,
  type DeclineOfferConfirmSummary,
} from "@/components/dashboard/DeclineOfferConfirmSheet";

type Props = DeclineOfferConfirmSummary & {
  offerId: string;
  disabled?: boolean;
};

export function OfferActions({
  offerId,
  disabled,
  serviceLabel,
  scheduleLabel,
  earningsLabel,
}: Props) {
  const router = useRouter();
  const declineButtonRef = useRef<HTMLButtonElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "accept" | "decline") {
    setLoading(action);
    setError(null);
    try {
      const response = await fetch(`/api/cleaner/offers/${offerId}/${action}`, {
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const record = body as Record<string, unknown>;
        setError(
          typeof record.message === "string"
            ? record.message
            : `Could not ${action} offer.`,
        );
        return;
      }
      if (action === "decline") {
        setConfirmOpen(false);
      }
      router.refresh();
      if (action === "accept") {
        const record = body as Record<string, unknown>;
        const bookingId = typeof record.bookingId === "string" ? record.bookingId : null;
        if (bookingId) router.push(`/cleaner/jobs/${bookingId}`);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(null);
    }
  }

  function openDeclineConfirm() {
    setError(null);
    setConfirmOpen(true);
  }

  function closeDeclineConfirm() {
    if (loading === "decline") return;
    setConfirmOpen(false);
    setError(null);
  }

  return (
    <>
      <section className="flex w-full flex-col gap-3 md:flex-row md:flex-wrap md:gap-2">
        <button
          type="button"
          disabled={disabled || loading !== null}
          onClick={() => respond("accept")}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 md:min-h-10 md:w-auto"
        >
          {loading === "accept" ? "Accepting…" : "Accept"}
        </button>
        <button
          ref={declineButtonRef}
          type="button"
          disabled={disabled || loading !== null}
          onClick={openDeclineConfirm}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50 md:min-h-10 md:w-auto"
        >
          Decline
        </button>
        {!confirmOpen && error ? (
          <p className="w-full text-sm text-red-600">{error}</p>
        ) : null}
      </section>

      <DeclineOfferConfirmSheet
        open={confirmOpen}
        loading={loading === "decline"}
        error={confirmOpen ? error : null}
        onClose={closeDeclineConfirm}
        onConfirm={() => respond("decline")}
        returnFocusRef={declineButtonRef}
        serviceLabel={serviceLabel}
        scheduleLabel={scheduleLabel}
        earningsLabel={earningsLabel}
      />
    </>
  );
}
