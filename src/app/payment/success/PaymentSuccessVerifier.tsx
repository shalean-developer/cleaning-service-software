"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  customerBookingDetailPath,
  parseVerifyPaymentResponse,
  resolvePaystackReference,
} from "@/lib/app/paymentReturn";
import { PAYMENT_VERIFY_STATUS_MESSAGE } from "@/lib/app/dashboardEcosystemDisplay";
import { resolvePaymentSuccessVariant } from "@/lib/app/paymentReturnDisplay";
import {
  PaymentConfirmedPanel,
  PaymentVerifyingPanel,
  PaymentVerifyErrorPanel,
} from "./PaymentReturnPanels";
import {
  PaymentVerificationPanel,
  PaymentVerificationShell,
} from "./PaymentVerificationShell";

type Phase = "verifying" | "success" | "error";

export function PaymentSuccessVerifier() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [message, setMessage] = useState<string>(PAYMENT_VERIFY_STATUS_MESSAGE);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [successIdempotent, setSuccessIdempotent] = useState(false);
  const inFlight = useRef(false);

  const runVerify = useCallback(async () => {
    const reference = resolvePaystackReference(searchParams);
    if (!reference) {
      setPhase("error");
      setMessage(
        "We couldn't find a payment reference for this visit. If you completed checkout, open your bookings or contact support.",
      );
      return;
    }

    if (inFlight.current) return;
    inFlight.current = true;
    setPhase("verifying");
    setMessage(PAYMENT_VERIFY_STATUS_MESSAGE);
    setConfirmedBookingId(null);

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
        setConfirmedBookingId(result.bookingId);
        setSuccessIdempotent(result.idempotent);
        setMessage(
          result.idempotent
            ? "Payment already confirmed. Opening your booking…"
            : "Payment confirmed. Opening your booking…",
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
          : "Payment is still processing. Wait a moment and try again.",
      );
    } catch {
      setPhase("error");
      setMessage(
        "We could not reach our servers. Check your connection and try again.",
      );
    } finally {
      inFlight.current = false;
    }
  }, [router, searchParams]);

  useEffect(() => {
    void runVerify();
  }, [runVerify]);

  return (
    <PaymentVerificationShell>
      <PaymentVerificationPanel busy={phase === "verifying"}>
        {phase === "verifying" ? <PaymentVerifyingPanel statusMessage={message} /> : null}

        {phase === "success" && confirmedBookingId ? (
          <PaymentConfirmedPanel
            variant={resolvePaymentSuccessVariant(successIdempotent)}
            bookingDetailHref={customerBookingDetailPath(confirmedBookingId)}
          />
        ) : null}

        {phase === "error" ? (
          <PaymentVerifyErrorPanel message={message} onRetry={() => void runVerify()} />
        ) : null}
      </PaymentVerificationPanel>
    </PaymentVerificationShell>
  );
}
