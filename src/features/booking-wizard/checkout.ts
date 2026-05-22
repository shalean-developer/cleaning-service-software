import {
  buildPaymentSuccessCallbackUrl,
  getClientAppBaseUrl,
} from "@/lib/app/paymentReturn";
import type { PricingBreakdown } from "@/features/pricing/server/types";
import type { BookingWizardState } from "./types";
import { canProceedToCheckout } from "./validation";

export type InitializeCheckoutPayload = {
  bookingId: string;
  lockId: string;
  paymentIdempotencyKey: string;
  email: string;
  callbackUrl?: string;
};

export function buildInitializeCheckoutPayload(
  params: {
    bookingId: string;
    lockId: string;
    paymentIdempotencyKey: string;
    email: string;
  },
  state: BookingWizardState,
  quote: PricingBreakdown,
): InitializeCheckoutPayload | { error: string } {
  if (state.cleanerPreferenceMode === "selected" && state.selectedCleanerId) {
    const card = state.availableCleaners.find(
      (c) => c.cleanerId === state.selectedCleanerId,
    );
    if (!card || card.eligibilityStatus !== "eligible") {
      return { error: "Selected cleaner is not eligible for checkout." };
    }
  }

  if (!canProceedToCheckout({ ...state, quote })) {
    return { error: "Complete all steps and confirm your booking before checkout." };
  }

  const appBaseUrl = getClientAppBaseUrl();

  return {
    bookingId: params.bookingId,
    lockId: params.lockId,
    paymentIdempotencyKey: params.paymentIdempotencyKey,
    email: params.email.trim(),
    callbackUrl: buildPaymentSuccessCallbackUrl(appBaseUrl, state.serviceSlug),
  };
}

/** Client must never treat booking as confirmed. only redirect to Paystack. */
export function isPaystackRedirectResponse(body: unknown): body is {
  ok: true;
  authorization_url: string;
  status: "pending_payment";
} {
  if (body == null || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return (
    record.ok === true &&
    typeof record.authorization_url === "string" &&
    record.status === "pending_payment"
  );
}
