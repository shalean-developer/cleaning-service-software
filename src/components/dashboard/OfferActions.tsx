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
      <section className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
        <button
          type="button"
          disabled={disabled || loading !== null}
          onClick={() => respond("accept")}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.12)] disabled:opacity-50 sm:min-h-10"
        >
          {loading === "accept" ? "Accepting…" : "Accept job"}
        </button>
        <button
          ref={declineButtonRef}
          type="button"
          disabled={disabled || loading !== null}
          onClick={openDeclineConfirm}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 sm:min-h-10"
        >
          Decline
        </button>
        {!confirmOpen && error ? (
          <p
            className="w-full rounded-xl border border-amber-100 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 sm:basis-full"
            role="alert"
          >
            {error}
          </p>
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
