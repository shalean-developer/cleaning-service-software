"use client";

import { useState } from "react";
import { startPaymentRetryCheckout } from "@/features/payments/client/retryPaymentFlow";

type Props = {
  bookingId: string;
  customerEmail: string;
};

export function PayNextVisitButton({ bookingId, customerEmail }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!customerEmail) {
      setError("A verified email is required to pay.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await startPaymentRetryCheckout(bookingId, customerEmail);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      window.location.href = result.authorizationUrl;
    } catch {
      setError("Connection issue. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void handlePay()}
        disabled={loading}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
      >
        {loading ? "Opening checkout…" : "Pay next visit"}
      </button>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
