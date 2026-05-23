import { mapRetryPaymentError } from "./retryPaymentFlow";

type PendingPaymentApiError = {
  error?: string;
  message?: string;
};

export type StartPendingPaymentCheckoutResult =
  | { ok: true; authorizationUrl: string }
  | { ok: false; message: string };

export async function startPendingPaymentCheckout(
  bookingId: string,
  customerEmail: string,
): Promise<StartPendingPaymentCheckoutResult> {
  const initResponse = await fetch("/api/paystack/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId,
      email: customerEmail,
      paymentIdempotencyKey: `paystack:booking:${bookingId}`,
    }),
  });

  const initBody = (await initResponse.json()) as PendingPaymentApiError & {
    ok?: boolean;
    authorization_url?: string;
  };

  if (!initResponse.ok || !initBody.ok || !initBody.authorization_url) {
    return {
      ok: false,
      message: mapRetryPaymentError(initBody.error, initBody.message),
    };
  }

  return { ok: true, authorizationUrl: initBody.authorization_url };
}
