export type RetryPaymentApiError = {
  error?: string;
  message?: string;
};

export function mapRetryPaymentError(
  code: string | undefined,
  fallbackMessage?: string,
): string {
  switch (code) {
    case "QUOTE_STALE":
      return "This booking price has changed. Please start a new booking.";
    case "ACTIVE_LOCK_EXISTS":
      return "A payment attempt is already open. Please continue or wait for it to expire.";
    case "RETRY_NOT_ELIGIBLE":
      return "This booking can no longer be retried.";
    case "RETRY_NOT_SUPPORTED":
      return "This booking cannot be retried online. Please start a new booking.";
    case "INVALID_SCHEDULE":
      return "This booking time has passed. Please start a new booking.";
    case "CLEANER_INELIGIBLE":
      return "The selected cleaner is no longer available. Please start a new booking.";
    case "LOCK_EXPIRED":
      return "Your checkout session expired. Please try again.";
    case "PROVISIONING_INCOMPLETE":
      return "Please complete account setup before paying.";
    case "FORBIDDEN":
      return "You cannot retry payment for this booking.";
    case "BOOKING_NOT_FOUND":
      return "This booking was not found.";
    default:
      return (
        fallbackMessage ??
        "Could not start checkout. Please try again or start a new booking."
      );
  }
}

export function buildRetryCheckoutIdempotencyKey(bookingId: string): string {
  return `retry:${bookingId}:${crypto.randomUUID()}`;
}

type RetryLockSuccess = {
  ok: true;
  lockId: string;
  paymentIdempotencyKey: string;
};

type RetryLockFailure = {
  ok: false;
  message: string;
};

type InitializeSuccess = {
  ok: true;
  authorizationUrl: string;
};

export type StartPaymentRetryCheckoutResult = RetryLockFailure | InitializeSuccess;

export async function startPaymentRetryCheckout(
  bookingId: string,
  customerEmail: string,
): Promise<StartPaymentRetryCheckoutResult> {
  const checkoutIdempotencyKey = buildRetryCheckoutIdempotencyKey(bookingId);

  const lockResponse = await fetch(
    `/api/bookings/${encodeURIComponent(bookingId)}/payment-retry-lock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutIdempotencyKey }),
    },
  );

  const lockBody = (await lockResponse.json()) as RetryPaymentApiError & {
    ok?: boolean;
    lockId?: string;
    paymentIdempotencyKey?: string;
  };

  if (!lockResponse.ok || !lockBody.ok || !lockBody.lockId || !lockBody.paymentIdempotencyKey) {
    return {
      ok: false,
      message: mapRetryPaymentError(lockBody.error, lockBody.message),
    };
  }

  const initResponse = await fetch("/api/paystack/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingId,
      lockId: lockBody.lockId,
      paymentIdempotencyKey: lockBody.paymentIdempotencyKey,
      email: customerEmail,
    }),
  });

  const initBody = (await initResponse.json()) as RetryPaymentApiError & {
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
