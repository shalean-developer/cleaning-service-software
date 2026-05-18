import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentSuccessVerifier } from "./PaymentSuccessVerifier";
import { PaymentVerificationLoadingFallback } from "./PaymentVerificationShell";

export const metadata: Metadata = {
  title: "Payment verification",
  description: "Confirming your Paystack payment",
};

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentVerificationLoadingFallback />}>
      <PaymentSuccessVerifier />
    </Suspense>
  );
}
