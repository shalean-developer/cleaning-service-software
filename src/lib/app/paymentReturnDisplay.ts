/** Presentation-only copy for Paystack return pages (no payment logic). */

export const PAYMENT_VERIFY_TRUST_LABEL = "Secured by Paystack" as const;

export const PAYMENT_VERIFY_LOADING_COPY = {
  title: "Confirming your payment",
  body: "We're confirming your payment with Paystack. This usually takes a few seconds.",
  reassurance:
    "Your booking updates as soon as payment is confirmed — no need to refresh.",
  footnote: "Keep this window open while we finish up.",
} as const;

export type PaymentSuccessVariant = "confirmed" | "already_confirmed";

export function resolvePaymentSuccessVariant(idempotent: boolean): PaymentSuccessVariant {
  return idempotent ? "already_confirmed" : "confirmed";
}

export function paymentSuccessTitle(variant: PaymentSuccessVariant): string {
  return variant === "already_confirmed" ? "Payment already confirmed" : "Booking confirmed";
}

export function paymentSuccessLead(variant: PaymentSuccessVariant): string {
  return variant === "already_confirmed"
    ? "Your payment is on file. Opening your booking now."
    : "Your payment was successful. We're opening your booking now.";
}

export const PAYMENT_SUCCESS_NEXT_STEPS = [
  {
    title: "Payment confirmed",
    body: "Your payment is on file and your booking is active.",
  },
  {
    title: "Cleaner assignment",
    body: "We match a cleaner to your schedule and preferences after payment.",
  },
  {
    title: "Booking details",
    body: "Your full schedule, address, and service details are available on your booking page.",
  },
  {
    title: "Email updates",
    body: "We'll email you confirmation and any changes to your booking.",
  },
] as const;

export const PAYMENT_VERIFY_ERROR_INTRO =
  "We couldn't confirm your payment yet. This can happen if checkout is still processing." as const;

export const PAYMENT_VERIFY_ERROR_NEXT_STEPS = [
  "Wait a few seconds, then tap Try again.",
  "Open your bookings to see whether payment already went through.",
  "Contact support if you were charged but your booking still shows unpaid.",
] as const;
