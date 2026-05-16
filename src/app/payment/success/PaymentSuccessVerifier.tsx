"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  customerBookingDetailPath,
  parseVerifyPaymentResponse,
  resolvePaystackReference,
} from "@/lib/app/paymentReturn";

type Phase = "verifying" | "success" | "error";

export function PaymentSuccessVerifier() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [message, setMessage] = useState("Verifying payment…");
  const inFlight = useRef(false);

  const runVerify = useCallback(async () => {
    const reference = resolvePaystackReference(searchParams);
    if (!reference) {
      setPhase("error");
      setMessage(
        "No payment reference was found. If you completed payment, check your bookings or contact support.",
      );
      return;
    }

    if (inFlight.current) return;
    inFlight.current = true;
    setPhase("verifying");
    setMessage("Verifying payment…");

    try {
      const response = await fetch(
        `/api/paystack/verify?reference=${encodeURIComponent(reference)}`,
        { method: "GET", credentials: "include" },
      );
      const data: unknown = await response.json().catch(() => ({}));
      const result = parseVerifyPaymentResponse(data);

      if (!result.ok) {
        setPhase("error");
        setMessage(result.message);
        return;
      }

      if (result.paid && result.bookingId) {
        setPhase("success");
        setMessage(
          result.idempotent
            ? "Payment already confirmed. Taking you to your booking…"
            : "Payment successful! Taking you to your booking…",
        );
        window.setTimeout(() => {
          router.replace(customerBookingDetailPath(result.bookingId));
        }, 1500);
        return;
      }

      setPhase("error");
      setMessage(
        !result.paid && result.message
          ? result.message
          : `Payment is not complete yet (status: ${result.status || "unknown"}). Try again in a moment.`,
      );
    } catch {
      setPhase("error");
      setMessage("Could not reach the server. Check your connection and try again.");
    } finally {
      inFlight.current = false;
    }
  }, [router, searchParams]);

  useEffect(() => {
    void runVerify();
  }, [runVerify]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-16">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {phase === "verifying" ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900"
              role="status"
              aria-label="Verifying"
            />
            <p className="text-sm text-zinc-700">{message}</p>
          </div>
        ) : null}

        {phase === "success" ? (
          <div className="text-center">
            <p className="text-lg font-semibold text-zinc-900">Thank you</p>
            <p className="mt-2 text-sm text-zinc-600">{message}</p>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-red-800" role="alert">
              {message}
            </p>
            <button
              type="button"
              onClick={() => void runVerify()}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white"
            >
              Try again
            </button>
            <Link
              href="/customer/bookings"
              className="text-center text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
            >
              View my bookings
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
