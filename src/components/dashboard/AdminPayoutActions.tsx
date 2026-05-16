"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  status: string;
};

export function AdminPayoutActions({ bookingId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"ready" | "paid" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, action: "ready" | "paid") {
    setLoading(action);
    setError(null);
    try {
      const response = await fetch(path, { method: "POST" });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const record = body as Record<string, unknown>;
        setError(
          typeof record.message === "string"
            ? record.message
            : "Action failed.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="mt-4 flex flex-wrap gap-2">
      {status === "completed" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() =>
            call(`/api/admin/bookings/${bookingId}/payout-ready`, "ready")
          }
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading === "ready" ? "Updating…" : "Mark payout-ready"}
        </button>
      ) : null}
      {status === "payout_ready" ? (
        <button
          type="button"
          disabled={loading !== null}
          onClick={() =>
            call(`/api/admin/bookings/${bookingId}/mark-paid-out`, "paid")
          }
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading === "paid" ? "Updating…" : "Mark paid out"}
        </button>
      ) : null}
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
