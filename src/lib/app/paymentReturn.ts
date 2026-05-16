/** Paystack return paths (no trailing slash on base when composing). */
export const PAYMENT_SUCCESS_PATH = "/payment/success" as const;
export const PAYMENT_FAILED_PATH = "/payment/failed" as const;

export function normalizeAppBaseUrl(base: string): string {
  return base.trim().replace(/\/$/, "");
}

/** Builds `${base}/payment/success` for Paystack `callback_url`. */
export function buildPaymentSuccessCallbackUrl(appBaseUrl: string): string {
  return `${normalizeAppBaseUrl(appBaseUrl)}${PAYMENT_SUCCESS_PATH}`;
}

/**
 * Paystack appends `reference` (and sometimes `trxref`) on redirect.
 */
export function resolvePaystackReference(
  searchParams: Pick<URLSearchParams, "get">,
): string | null {
  const reference = searchParams.get("reference")?.trim();
  if (reference) return reference;
  const trxref = searchParams.get("trxref")?.trim();
  if (trxref) return trxref;
  return null;
}

export type VerifyPaymentClientResult =
  | {
      ok: true;
      paid: true;
      bookingId: string;
      reference: string;
      idempotent: boolean;
      status: string;
    }
  | {
      ok: true;
      paid: false;
      reference: string;
      status: string;
      message?: string;
    }
  | { ok: false; error: string; message: string };

export function parseVerifyPaymentResponse(data: unknown): VerifyPaymentClientResult {
  if (data == null || typeof data !== "object") {
    return { ok: false, error: "INVALID_RESPONSE", message: "Unexpected verify response." };
  }
  const record = data as Record<string, unknown>;
  if (record.ok !== true) {
    return {
      ok: false,
      error: String(record.error ?? "VERIFY_FAILED"),
      message: typeof record.message === "string" ? record.message : "Payment verification failed.",
    };
  }

  const reference = typeof record.reference === "string" ? record.reference : "";
  const status = typeof record.status === "string" ? record.status : "";
  const paid = record.paid === true;
  const idempotent = record.idempotent === true;

  if (paid) {
    const bookingId = typeof record.bookingId === "string" ? record.bookingId.trim() : "";
    if (!bookingId) {
      return {
        ok: false,
        error: "INVALID_RESPONSE",
        message: "Payment verified but booking id was missing.",
      };
    }
    return { ok: true, paid: true, bookingId, reference, idempotent, status };
  }

  return {
    ok: true,
    paid: false,
    reference,
    status,
    message: typeof record.message === "string" ? record.message : undefined,
  };
}

export function customerBookingDetailPath(bookingId: string): string {
  return `/customer/bookings/${bookingId}`;
}

/** Browser-safe base URL for checkout callback (wizard). */
export function getClientAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return normalizeAppBaseUrl(fromEnv);
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}
