import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentSuccessVerifier } from "./PaymentSuccessVerifier";

export const metadata: Metadata = {
  title: "Payment verification",
  description: "Confirming your Paystack payment",
};

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
          <p className="text-sm text-zinc-600">Verifying payment…</p>
        </main>
      }
    >
      <PaymentSuccessVerifier />
    </Suspense>
  );
}
