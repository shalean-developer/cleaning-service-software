"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  offerId: string;
  disabled?: boolean;
};

export function OfferActions({ offerId, disabled }: Props) {
  const router = useRouter();
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

  return (
    <section className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled || loading !== null}
        onClick={() => respond("accept")}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading === "accept" ? "Accepting…" : "Accept"}
      </button>
      <button
        type="button"
        disabled={disabled || loading !== null}
        onClick={() => respond("decline")}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
      >
        {loading === "decline" ? "Declining…" : "Decline"}
      </button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
